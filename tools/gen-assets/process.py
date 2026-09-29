#!/usr/bin/env python3
"""Post-processing for Nano Banana output.

Subcommands
  key    IN OUT                 chroma-key #00FF00 background -> transparent PNG (with despill + soft edge)
  slice  IN OUTDIR [--expect N] content-aware slice a keyed sheet into trimmed frames (left->right, top->bottom)
  split  IN... OUTDIR           one PNG per figure (for Flow outputs that drew the character twice)
  pack   MANIFEST.json OUT.png  build a uniform-cell, foot-anchored atlas + OUT.json for the game
  sheet  IN OUT                 make a checkerboard preview of a transparent image (for review)

Manifest format (pack):
{
  "cell": [320, 448],            # atlas cell size in px
  "height": 400,                 # px height of a standing frame inside the cell
  "anims": {
    "idle": {"frames": ["raw/vega/idle_0.png", ...], "fps": 6, "loop": true, "scale": 1.0},
    ...
  }
}
"scale" = expected height of this anim's tallest frame relative to standing height.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def load_rgba(p):
    return np.array(Image.open(p).convert("RGBA"))


def cmd_key(inp, out):
    img = load_rgba(inp).astype(np.float32)
    rgb = img[..., :3] / 255.0
    hsv = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255  # h in degrees
    green = (np.abs(h - 122) < 22) & (s > 0.45) & (v > 0.3)
    # Background = green regions connected to the image border (or very large). Green enclosed by a
    # figure (costume stripes, lime trims) stays opaque instead of being punched out as holes.
    ng, glbl, gstats, _ = cv2.connectedComponentsWithStats(green.astype(np.uint8), 8)
    border = set(np.unique(np.concatenate([glbl[0], glbl[-1], glbl[:, 0], glbl[:, -1]])).tolist())
    # Enclosed pockets (gaps between arm and body) are still background if their colour matches the
    # sampled screen colour; costume greens (e.g. lime, R≈180) sit far from it.
    edge_px = np.concatenate([img[0, :, :3], img[-1, :, :3], img[:, 0, :3], img[:, -1, :3]])
    bg_rgb = np.median(edge_px, axis=0)  # borders are (almost) all screen green
    bgk = np.zeros(ng, bool)
    for i in range(1, ng):
        if i in border or gstats[i, cv2.CC_STAT_AREA] > green.size * 0.01:
            bgk[i] = True
        else:
            mean = img[..., :3][glbl == i].mean(axis=0)
            bgk[i] = np.abs(mean - bg_rgb).max() < 60
    green = bgk[glbl]
    # "greenness": how much G dominates R and B -> soft matte on edges
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = np.clip((g - np.maximum(r, b)) * 2.2, 0, 1)
    # Only colours whose hue is near the key count as "spill". Without this, legit costume greens
    # (Roxy's lime #b6ff2e, hue ~83°) were matted semi-transparent and despilled to grey.
    keyish = (np.abs(h - 122) < 30) & (s > 0.3) & ~cv2.erode((~green).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    alpha = 1 - np.where(green, 1.0, np.where(keyish, dom * 0.9, 0.0))
    # remove isolated noise, keep only large components
    hard = (alpha > 0.5).astype(np.uint8)
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    keep = np.zeros_like(hard)
    minarea = max(80, hard.size * 0.0004)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= minarea:
            keep[lbl == i] = 1
    # fill small holes inside the sprite (green reflections)
    alpha = alpha * cv2.dilate(keep, np.ones((3, 3), np.uint8))
    # erode 1px and blur for clean anti-aliased edge
    a8 = (alpha * 255).astype(np.uint8)
    a8 = cv2.erode(a8, np.ones((2, 2), np.uint8))
    a8 = cv2.GaussianBlur(a8, (3, 3), 0)
    # despill: clamp green to max(r,b) near edges
    edge = (a8 > 0) & (a8 < 250)
    g2 = np.where(edge | keyish, np.minimum(g, np.maximum(r, b) * 1.05), g)
    out_rgb = np.stack([r, g2, b], -1)
    res = np.dstack([(out_rgb * 255).clip(0, 255).astype(np.uint8), a8])
    Image.fromarray(res, "RGBA").save(out)
    print("keyed ->", out)


def runs(occ, min_gap):
    """Contiguous True runs in a 1-D boolean array, bridging gaps shorter than min_gap."""
    out, start, gap = [], None, 0
    for i, v in enumerate(occ):
        if v:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        out.append((start, len(occ) - gap))
    return out


def clean_frame(crop):
    """Drop stray bits (swatch squares, specks) that aren't part of the main figure, then re-trim."""
    a = crop[..., 3]
    n, lbl, stats, _ = cv2.connectedComponentsWithStats((a > 40).astype(np.uint8), 8)
    if n > 2:
        areas = stats[1:, cv2.CC_STAT_AREA]
        main = 1 + int(areas.argmax())
        feet = stats[main, cv2.CC_STAT_TOP] + stats[main, cv2.CC_STAT_HEIGHT]
        keep = np.zeros(n, bool)
        keep[1:] = areas >= areas.max() * 0.05  # drops slivers of neighbouring figures
        # color-swatch rows on ref sheets sit below the feet: never part of the figure
        keep[1:] &= stats[1:, cv2.CC_STAT_TOP] < feet - stats[main, cv2.CC_STAT_HEIGHT] * 0.03
        crop[..., 3] = np.where(keep[lbl], a, 0)
    ys, xs = np.where(crop[..., 3] > 8)
    return crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cmd_slice(inp, outdir, expect=None):
    """Split a sheet into frames: row bands by empty rows, then frames by empty columns."""
    img = load_rgba(inp)
    m = img[..., 3] > 40
    H, W = m.shape
    boxes = []
    for y0, y1 in runs(m.any(axis=1), max(4, H // 150)):
        band = m[y0:y1]
        for x0, x1 in runs(band.any(axis=0), max(3, W // 400)):
            sub = band[:, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            by0, by1 = y0 + ys.min(), y0 + ys.max() + 1
            # ignore tiny bits (swatches, specks): need a figure-like height
            if (by1 - by0) < H * 0.12 or sub.sum() < m.size * 0.002:
                continue
            boxes.append((x0, by0, x1 - x0, by1 - by0))
    if not boxes:
        sys.exit("no sprites found")
    # Overlapping figures merge into one wide box: split the widest box at its thinnest column
    # (least opaque pixels) until we reach the expected frame count.
    while expect and len(boxes) < expect:
        i = max(range(len(boxes)), key=lambda k: boxes[k][2] / boxes[k][3])
        x, y, w, h = boxes[i]
        if w < h * 0.35:
            break  # nothing wide enough to be two figures
        cov = m[y:y + h, x:x + w].sum(axis=0).astype(float)
        cov = np.convolve(cov, np.ones(9) / 9, mode="same")
        lo, hi = int(w * 0.2), int(w * 0.8)
        cut = lo + int(np.argmin(cov[lo:hi]))
        boxes[i:i + 1] = [(x, y, cut, h), (x + cut, y, w - cut, h)]
        boxes.sort(key=lambda b: (b[1] // max(1, H // 4), b[0]))
    Path(outdir).mkdir(parents=True, exist_ok=True)
    stem = Path(inp).stem.replace("_keyed", "")
    for i, (x, y, w, h) in enumerate(boxes):
        crop = clean_frame(img[y:y + h, x:x + w].copy())
        Image.fromarray(crop, "RGBA").save(Path(outdir) / f"{stem}_{i}.png")
    print(f"{len(boxes)} frames -> {outdir}")
    if expect and len(boxes) != expect:
        print(f"WARNING: expected {expect} frames, found {len(boxes)}", file=sys.stderr)
        sys.exit(4)


def foot_center_x(a):
    """x of the center of the lowest 12% of opaque pixels (feet) -> stable anchor."""
    ys, xs = np.where(a > 60)
    if len(ys) == 0:
        return a.shape[1] / 2
    cut = ys.max() - (ys.max() - ys.min()) * 0.12
    sel = ys >= cut
    return float(xs[sel].mean())


def cmd_pack(manifest, out):
    man = json.loads(Path(manifest).read_text())
    base = Path(manifest).parent
    cw, ch = man["cell"]
    stand_h = man["height"]
    anims = man["anims"]
    cols = max(len(a["frames"]) for a in anims.values())
    rows = len(anims)
    atlas = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    meta = {"cell": [cw, ch], "cols": cols, "rows": rows, "anchorY": 0.04, "anims": {}}
    for k in ("interim", "heightScale"):
        if k in man:
            meta[k] = man[k]
    for r, (name, a) in enumerate(anims.items()):
        frames = [Image.open(base / f).convert("RGBA") for f in a["frames"]]
        tallest = max(f.height for f in frames)
        k = stand_h * a.get("scale", 1.0) / tallest
        for c, f in enumerate(frames):
            f2 = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            arr = np.array(f2)
            fx = foot_center_x(arr[..., 3])
            if f2.height > ch * 0.97:
                s = ch * 0.97 / f2.height
                f2 = f2.resize((round(f2.width * s), round(f2.height * s)), Image.LANCZOS)
                fx *= s
            # Keep one scale per animation (no per-frame shrinking = no size pulsing). Frames wider than
            # the cell (disc trails, outstretched arms) are cropped around the foot anchor instead.
            ox = round(cw / 2 - fx + a.get("dx", 0))
            if f2.width <= cw:
                ox = max(0, min(cw - f2.width, ox))
            else:
                left = max(0, -ox)
                f2 = f2.crop((left, 0, min(f2.width, left + cw), f2.height))
                ox = max(0, ox)
            oy = round(ch * (1 - meta["anchorY"]) - f2.height)
            atlas.paste(f2, (c * cw + ox, r * ch + max(0, oy)), f2)
        meta["anims"][name] = {"row": r, "frames": len(frames), "fps": a.get("fps", 8), "loop": a.get("loop", True)}
    atlas.save(out, optimize=True)
    Path(out).with_suffix(".json").write_text(json.dumps(meta, indent=1))
    print("atlas ->", out, atlas.size)


def keep_figure(arr, which="left"):
    """Flow sometimes draws the character twice: keep one figure (left / right / largest) and drop the rest.
    Figures = connected shapes at least 20% the size of the biggest one."""
    a = (arr[..., 3] > 40).astype(np.uint8)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(a, 8)
    if n <= 2:
        return arr
    areas = st[1:, cv2.CC_STAT_AREA]
    figs = [i + 1 for i in range(n - 1) if areas[i] >= areas.max() * 0.2]
    if len(figs) < 2:
        return split_touching(arr, which)
    cx = {i: st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH] / 2 for i in figs}
    if which == "right":
        keep = max(figs, key=lambda i: cx[i])
    elif which == "largest":
        keep = max(figs, key=lambda i: st[i, cv2.CC_STAT_AREA])
    else:
        keep = min(figs, key=lambda i: cx[i])
    # keep the chosen figure plus small bits (disc, sparks) nearer to it than to the other figures
    out = arr.copy()
    others = [i for i in figs if i != keep]
    for i in range(1, n):
        if i == keep:
            continue
        if i in others:
            out[..., 3][lbl == i] = 0
            continue
        c = st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH] / 2
        if min(abs(c - cx[o]) for o in others) < abs(c - cx[keep]):
            out[..., 3][lbl == i] = 0
    return drop_faint(out)


def drop_faint(arr):
    """Clear faint soft-edge pixels (alpha <= 40) that no longer border a kept solid pixel."""
    near = cv2.dilate((arr[..., 3] > 40).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    arr[..., 3] = np.where(near, arr[..., 3], 0)
    return arr


def split_touching(arr, which):
    """Two duplicates drawn touching form one blob: if it is wider than tall, cut at the thinnest
    column in its middle third and keep one side."""
    a = arr[..., 3] > 40
    xs = np.where(a.any(axis=0))[0]
    ys = np.where(a.any(axis=1))[0]
    if not len(xs) or (xs[-1] - xs[0]) < (ys[-1] - ys[0]) * 0.9 or which == "largest":
        return arr
    x0, x1 = xs[0], xs[-1]
    lo, hi = x0 + (x1 - x0) // 3, x0 + 2 * (x1 - x0) // 3
    cut = lo + int(np.argmin(a[:, lo:hi].sum(axis=0)))
    out = arr.copy()
    if which == "right":
        out[:, :cut, 3] = 0
    else:
        out[:, cut:, 3] = 0
    return drop_faint(out)


def figures(arr):
    """Every separate figure of an image as its own RGBA array, left to right."""
    a = (arr[..., 3] > 40).astype(np.uint8)
    n, _, st, _ = cv2.connectedComponentsWithStats(a, 8)
    areas = st[1:, cv2.CC_STAT_AREA] if n > 1 else np.array([0])
    count = int((areas >= areas.max() * 0.2).sum()) if n > 1 else 0
    if count >= 2:
        # keep_figure by rank: peel off the leftmost repeatedly
        out, rest = [], arr
        for _ in range(count - 1):
            out.append(keep_figure(rest, "left"))
            rest = rest.copy()
            rest[..., 3] = np.where(out[-1][..., 3] > 0, 0, rest[..., 3])
        out.append(drop_faint(rest))
        return out
    left = split_touching(arr, "left")
    return [left, split_touching(arr, "right")] if left is not arr else [arr]


def cmd_split(inp, outdir):
    """Still image (green screen or already keyed) -> one PNG per figure: <stem>_fig0.png, _fig1.png..."""
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    src = Path(inp)
    keyed = out / (src.stem + "_keyed.png")
    arr = np.array(Image.open(src).convert("RGBA"))
    if (arr[..., 3] < 255).mean() < 0.01:  # opaque: key it first
        cmd_key(src, keyed)
        arr = np.array(Image.open(keyed))
        keyed.unlink()
    figs = figures(arr)
    for k, f in enumerate(figs):
        Image.fromarray(clean_frame(f), "RGBA").save(out / f"{src.stem}_fig{k}.png")
    print(f"{src.name}: {len(figs)} figure(s) -> {out}")


def cmd_video(inp, outdir, fps=24, start=0.0, dur=None, figure=None):
    """Video (green screen) -> keyed, trimmed frames k_0000.png... + numbered contact sheet.jpg."""
    import subprocess
    import imageio_ffmpeg

    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"):
        f.unlink()
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-ss", str(start)]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += ["-i", str(inp), "-vf", f"fps={fps}", str(out / "raw_%04d.png")]
    subprocess.run(cmd, check=True)
    raws = sorted(out.glob("raw_*.png"))
    thumbs = []
    for i, r in enumerate(raws):
        k = out / f"k_{i:04d}.png"
        cmd_key(r, k)
        arr = np.array(Image.open(k))
        if (arr[..., 3] > 40).sum() < arr[..., 3].size * 0.002:
            k.unlink()  # empty frame (character left the shot)
        else:
            if figure:
                arr = keep_figure(arr, figure)
            Image.fromarray(clean_frame(arr), "RGBA").save(k)
            thumbs.append((i, k))
        r.unlink()
    # contact sheet with frame numbers, for picking
    from PIL import ImageDraw
    cols, tw, th = 10, 150, 220
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, max(1, rows) * th), (70, 70, 80))
    d = ImageDraw.Draw(sheet)
    for n, (i, k) in enumerate(thumbs):
        t = Image.open(k)
        t.thumbnail((tw - 6, th - 22))
        x, y = (n % cols) * tw, (n // cols) * th
        sheet.paste(t, (x + 3, y + 18), t)
        d.text((x + 4, y + 2), str(i), fill=(255, 230, 0))
    sheet.save(out / "sheet.jpg", quality=85)
    print(f"{len(thumbs)} frames ({len(raws)} extracted) -> {out}")


def cmd_sheet(inp, out):
    img = Image.open(inp).convert("RGBA")
    w, h = img.size
    bg = Image.new("RGBA", (w, h), (60, 60, 70, 255))
    tile = 16
    arr = np.array(bg)
    yy, xx = np.mgrid[0:h, 0:w]
    arr[((yy // tile + xx // tile) % 2) == 0] = (90, 90, 100, 255)
    bg = Image.fromarray(arr)
    bg.alpha_composite(img)
    bg.convert("RGB").save(out)
    print("preview ->", out)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "key":
        cmd_key(a[1], a[2])
    elif cmd == "slice":
        exp = int(a[a.index("--expect") + 1]) if "--expect" in a else None
        cmd_slice(a[1], a[2], exp)
    elif cmd == "pack":
        cmd_pack(a[1], a[2])
    elif cmd == "video":
        opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d  # noqa: E731
        cmd_video(a[1], a[2], float(opt("--fps", 24)), float(opt("--start", 0)), opt("--dur"), opt("--figure"))
    elif cmd == "split":
        for f in a[1:-1]:
            cmd_split(f, a[-1])
    elif cmd == "sheet":
        cmd_sheet(a[1], a[2])
    else:
        sys.exit(__doc__)

#!/usr/bin/env python3
"""Post-processing for Nano Banana output.

Subcommands
  key    IN OUT                 chroma-key #00FF00 background -> transparent PNG (with despill + soft edge)
  slice  IN OUTDIR [--expect N] content-aware slice a keyed sheet into trimmed frames (left->right, top->bottom)
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
    green = (np.abs(h - 120) < 28) & (s > 0.28) & (v > 0.25)
    # "greenness": how much G dominates R and B -> soft matte on edges
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dom = np.clip((g - np.maximum(r, b)) * 2.2, 0, 1)
    alpha = 1 - np.where(green, 1.0, dom * 0.9)
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
    edge = (a8 > 0) & (a8 < 255) | (dom > 0.05)
    g2 = np.where(edge | (a8 > 0), np.minimum(g, np.maximum(r, b) * 1.05), g)
    out_rgb = np.stack([r, g2, b], -1)
    res = np.dstack([(out_rgb * 255).clip(0, 255).astype(np.uint8), a8])
    Image.fromarray(res, "RGBA").save(out)
    print("keyed ->", out)


def components(alpha, min_area):
    m = (alpha > 40).astype(np.uint8)
    # merge nearby parts of the same figure (hair strands, disc in hand)
    m = cv2.dilate(m, np.ones((25, 25), np.uint8))
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    boxes = []
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a >= min_area:
            boxes.append((x, y, w, h))
    return boxes


def cmd_slice(inp, outdir, expect=None):
    img = load_rgba(inp)
    alpha = img[..., 3]
    min_area = alpha.size * 0.004
    boxes = components(alpha, min_area)
    if not boxes:
        sys.exit("no sprites found")
    # order in rows: cluster by vertical center
    boxes.sort(key=lambda b: b[1] + b[3] / 2)
    rows, cur = [], [boxes[0]]
    for b in boxes[1:]:
        prev = cur[-1]
        if abs((b[1] + b[3] / 2) - (prev[1] + prev[3] / 2)) < max(b[3], prev[3]) * 0.5:
            cur.append(b)
        else:
            rows.append(cur)
            cur = [b]
    rows.append(cur)
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[0])]
    Path(outdir).mkdir(parents=True, exist_ok=True)
    stem = Path(inp).stem.replace("_keyed", "")
    for i, (x, y, w, h) in enumerate(ordered):
        crop = img[y:y + h, x:x + w].copy()
        # zero pixels that belong to neighbours bleeding into the box? keep simple: trim to own alpha bbox
        a = crop[..., 3]
        ys, xs = np.where(a > 8)
        crop = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        Image.fromarray(crop, "RGBA").save(Path(outdir) / f"{stem}_{i}.png")
    print(f"{len(ordered)} frames -> {outdir}")
    if expect and len(ordered) != expect:
        print(f"WARNING: expected {expect} frames, found {len(ordered)}", file=sys.stderr)
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
    for r, (name, a) in enumerate(anims.items()):
        frames = [Image.open(base / f).convert("RGBA") for f in a["frames"]]
        tallest = max(f.height for f in frames)
        k = stand_h * a.get("scale", 1.0) / tallest
        for c, f in enumerate(frames):
            f2 = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            arr = np.array(f2)
            fx = foot_center_x(arr[..., 3])
            if f2.width > cw or f2.height > ch * 0.97:
                s = min(cw / f2.width, ch * 0.97 / f2.height)
                f2 = f2.resize((round(f2.width * s), round(f2.height * s)), Image.LANCZOS)
                fx *= s
            ox = round(cw / 2 - fx + a.get("dx", 0))
            ox = max(0, min(cw - f2.width, ox))
            oy = round(ch * (1 - meta["anchorY"]) - f2.height)
            atlas.paste(f2, (c * cw + ox, r * ch + max(0, oy)), f2)
        meta["anims"][name] = {"row": r, "frames": len(frames), "fps": a.get("fps", 8), "loop": a.get("loop", True)}
    atlas.save(out, optimize=True)
    Path(out).with_suffix(".json").write_text(json.dumps(meta, indent=1))
    print("atlas ->", out, atlas.size)


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
    elif cmd == "sheet":
        cmd_sheet(a[1], a[2])
    else:
        sys.exit(__doc__)

#!/usr/bin/env python3
"""Build game assets from director-approved art (tools/gen-assets/approved.json).

Characters: approved animation strips are keyed, sliced (with expected frame counts), and the
picked frames packed into public/assets/characters/<id>/atlas.png. Animations without approved
art fall back to the reference sheet's 3/4 pose flagged "interim" (the renderer fakes motion).
Arenas: courts (rotated to landscape if generated portrait) and backdrops are copied into
public/assets/arenas/<id>/.

Usage: python3 tools/gen-assets/build_assets.py
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public/assets"
WORK = HERE / "raw/_interim"
PROC = [sys.executable, str(HERE / "process.py")]

ANIMS = [("idle", 6, True), ("run", 12, True), ("dash", 14, False), ("hold", 6, True), ("throw", 14, False),
         ("lob", 10, False), ("block", 12, False), ("knock", 10, False), ("win", 3, True), ("lose", 3, True)]


def run(*args):
    r = subprocess.run(PROC + [str(a) for a in args], capture_output=True, text=True)
    if r.returncode not in (0,):
        raise SystemExit(f"process.py {' '.join(map(str, args))} failed:\n{r.stdout}\n{r.stderr}")


def strip_ground_line(path: Path):
    """Remove thin, nearly full-width lines (some generations draw a floor line)."""
    im = np.array(Image.open(path))
    hi = (im[..., 3] > 40).mean(axis=1) > 0.85
    y, H = 0, len(hi)
    while y < H:
        if hi[y]:
            y2 = y
            while y2 < H and hi[y2]:
                y2 += 1
            if y2 - y <= 8:
                im[max(0, y - 2):y2 + 2, :, 3] = 0
            y = y2
        else:
            y += 1
    Image.fromarray(im).save(path)


def frames_of(src: Path, expect: int, work: Path, ground_line=False):
    work.mkdir(parents=True, exist_ok=True)
    keyed = work / (src.stem + "_keyed.png")
    run("key", src, keyed)
    if ground_line:
        strip_ground_line(keyed)
    fdir = work / (src.stem + "_frames")
    if fdir.exists():
        for f in fdir.glob("*.png"):
            f.unlink()
    run("slice", keyed, fdir, "--expect", expect)
    return sorted(fdir.glob("*.png"), key=lambda p: int(p.stem.rsplit("_", 1)[1]))


def build_character(cid: str, spec: dict):
    work = WORK / cid
    ref_frames = frames_of(HERE / spec["ref"], 4, work)
    front, three_q = ref_frames[0], ref_frames[1]
    anims, flags = {}, {}
    for name, fps, loop in ANIMS:
        a = spec.get("anims", {}).get(name)
        if a and "video" in a:
            # video source: frames are indices into the keyed video frames (see process.py video + sheet.jpg)
            vdir = work / (Path(a["video"]).stem + "_video")
            vargs = ["video", HERE / a["video"], vdir, "--fps", a.get("fps", 24), "--start", a.get("start", 0)]
            if "dur" in a:
                vargs += ["--dur", a["dur"]]
            run(*vargs)
            anims[name] = {"frames": [str(vdir / f"k_{i:04d}.png") for i in a["frames"]], "fps": a.get("playFps", fps), "loop": loop}
            flags[name] = {"discInArt": bool(a.get("discInArt"))}
        elif a:
            fr = frames_of(HERE / a["src"], a["expect"], work, a.get("groundLine", False))
            anims[name] = {"frames": [str(fr[i]) for i in a["frames"]], "fps": fps, "loop": loop}
            flags[name] = {"discInArt": bool(a.get("discInArt"))}
        else:
            anims[name] = {"frames": [str(three_q)], "fps": fps, "loop": loop}
            flags[name] = {"interim": True}
    man = {"cell": [400, 448], "height": 430, "heightScale": spec.get("heightScale", 1.0), "anims": anims}
    (work / "manifest.json").write_text(json.dumps(man))
    dst = OUT / "characters" / cid
    dst.mkdir(parents=True, exist_ok=True)
    run("pack", work / "manifest.json", dst / "atlas.png")
    meta = json.loads((dst / "atlas.json").read_text())
    for name, f in flags.items():
        meta["anims"][name].update(f)
    (dst / "atlas.json").write_text(json.dumps(meta, indent=1))

    # portrait: upper ~55% of the front view on a transparent 3:4 canvas
    im = Image.open(front)
    upper = im.crop((0, 0, im.width, int(im.height * 0.55)))
    W, H = 600, 800
    s = min(W * 0.95 / upper.width, H / upper.height)
    upper = upper.resize((round(upper.width * s), round(upper.height * s)), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(upper, ((W - upper.width) // 2, H - upper.height), upper)
    canvas.save(dst / "portrait.png", optimize=True)
    real = [n for n in flags if not flags[n].get("interim")]
    print(f"{cid}: real {real}, interim {[n for n in flags if flags[n].get('interim')]}")


def build_arena(aid: str, spec: dict):
    dst = OUT / "arenas" / aid
    dst.mkdir(parents=True, exist_ok=True)
    if "court" in spec:
        im = Image.open(HERE / spec["court"]).convert("RGB")
        if spec.get("rotateCourt") or im.height > im.width:
            im = im.rotate(90, expand=True)
        im.save(dst / "court.jpg", quality=92)
    if "backdrop" in spec:
        Image.open(HERE / spec["backdrop"]).convert("RGB").save(dst / "backdrop.jpg", quality=92)
    print(f"arena {aid}: {', '.join(k for k in ('court', 'backdrop') if k in spec)}")


if __name__ == "__main__":
    appr = json.loads((HERE / "approved.json").read_text())
    for cid, spec in appr["characters"].items():
        build_character(cid, spec)
    for aid, spec in appr["arenas"].items():
        build_arena(aid, spec)
    subprocess.run(["node", str(ROOT / "tools/asset-manifest.mjs")], check=True)

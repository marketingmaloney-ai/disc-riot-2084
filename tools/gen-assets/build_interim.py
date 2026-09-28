#!/usr/bin/env python3
"""Build interim character assets from the approved reference sheets.

Until the animation batches land, each character uses the 3/4 view (facing right) for every
animation, and the renderer fakes motion (atlas meta "interim": true). The portrait is the
front view's upper body. Re-run after approving new refs; delete once the real atlases exist.

Usage: python3 tools/gen-assets/build_interim.py
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "tools/gen-assets/raw"
OUT = ROOT / "public/assets/characters"
WORK = RAW / "_interim"
PROC = [sys.executable, str(ROOT / "tools/gen-assets/process.py")]

# approved picks (see queue/batch01_review.md)
REFS = {"vega": "vega/ref_v3", "kaito": "kaito/ref_v1", "roxy": "roxy/ref_v3", "brick": "brick/ref_v1"}
HEIGHT = {"brick": 1.08}
ANIMS = [("idle", 6, True), ("run", 12, True), ("dash", 14, False), ("hold", 6, True), ("throw", 18, False),
         ("lob", 10, False), ("block", 12, False), ("knock", 10, False), ("win", 3, True), ("lose", 3, True)]

for cid, ref in REFS.items():
    wd = WORK / cid
    wd.mkdir(parents=True, exist_ok=True)
    keyed = wd / "ref_keyed.png"
    subprocess.run(PROC + ["key", str(RAW / f"{ref}.png"), str(keyed)], check=True, capture_output=True)
    frames = wd / "frames"
    subprocess.run(PROC + ["slice", str(keyed), str(frames), "--expect", "4"], check=True, capture_output=True)
    views = sorted(frames.glob("*.png"), key=lambda p: int(p.stem.rsplit("_", 1)[1]))
    front, three_q = views[0], views[1]

    man = {
        "cell": [320, 448], "height": 430, "interim": True, "heightScale": HEIGHT.get(cid, 1.0),
        "anims": {a: {"frames": [str(three_q)], "fps": fps, "loop": loop} for a, fps, loop in ANIMS},
    }
    (wd / "manifest.json").write_text(json.dumps(man))
    dst = OUT / cid
    dst.mkdir(parents=True, exist_ok=True)
    subprocess.run(PROC + ["pack", str(wd / "manifest.json"), str(dst / "atlas.png")], check=True, capture_output=True)

    # portrait: upper ~55% of the front view, centered on a 3:4 transparent canvas
    im = Image.open(front)
    upper = im.crop((0, 0, im.width, int(im.height * 0.55)))
    W, H = 600, 800
    s = min(W * 0.95 / upper.width, H / upper.height)
    upper = upper.resize((round(upper.width * s), round(upper.height * s)), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(upper, ((W - upper.width) // 2, H - upper.height), upper)
    canvas.save(dst / "portrait.png", optimize=True)
    print(f"{cid}: atlas + portrait")

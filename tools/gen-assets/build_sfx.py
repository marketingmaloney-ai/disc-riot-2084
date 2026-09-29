#!/usr/bin/env python3
"""Cut character sounds from the Flow videos' audio (tools/gen-assets/sfx.json).

Each cut: leading silence trimmed, peak-normalized to -3 dBFS, 5 ms fade-in / 60 ms fade-out,
mono 96 kbps MP3 -> public/assets/sfx/<char>/<name>.mp3. Also writes a waveform preview
(raw/_interim/sfx_preview.png) for review.

Usage: python3 tools/gen-assets/build_sfx.py
"""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public/assets/sfx"
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100


def decode(src: Path, start: float, end: float) -> np.ndarray:
    raw = subprocess.run([FF, "-loglevel", "error", "-ss", str(start), "-t", str(end - start), "-i", str(src),
                          "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def shape(x: np.ndarray) -> np.ndarray:
    # trim leading silence (below -40 dBFS relative to the clip's peak), keep 10 ms of lead-in
    peak = np.abs(x).max() or 1.0
    loud = np.where(np.abs(x) > peak * 0.01)[0]
    if len(loud):
        x = x[max(0, loud[0] - SR // 100):]
    x = x / peak * 10 ** (-3 / 20)
    fi, fo = SR * 5 // 1000, min(len(x) // 2, SR * 60 // 1000)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    return x


def encode(x: np.ndarray, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "96k", str(out)], input=x.astype(np.float32).tobytes(), check=True)


def preview(cuts):
    from PIL import Image, ImageDraw
    W, H = 900, 60
    img = Image.new("RGB", (W, H * len(cuts)), (20, 20, 30))
    d = ImageDraw.Draw(img)
    for i, (label, x) in enumerate(cuts):
        y0 = i * H + H // 2
        step = max(1, len(x) // (W - 160))
        env = np.abs(x[: step * ((len(x)) // step)]).reshape(-1, step).max(1)
        for k, v in enumerate(env[: W - 160]):
            d.line([(160 + k, y0 - v * 26), (160 + k, y0 + v * 26)], fill=(255, 190, 0))
        d.text((6, y0 - 6), f"{label} {len(x) / SR:.2f}s", fill=(230, 230, 230))
    p = HERE / "raw/_interim/sfx_preview.png"
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p)


if __name__ == "__main__":
    spec = json.loads((HERE / "sfx.json").read_text())
    cuts = []
    for cid, sounds in spec.items():
        if cid.startswith("_"):
            continue
        for name, s in sounds.items():
            x = shape(decode(HERE / s["src"], s["start"], s["end"]))
            encode(x, OUT / cid / f"{name}.mp3")
            cuts.append((f"{cid}/{name}", x))
            print(f"sfx {cid}/{name}: {len(x) / SR:.2f}s")
    preview(cuts)
    subprocess.run(["node", str(ROOT / "tools/asset-manifest.mjs")], check=True)

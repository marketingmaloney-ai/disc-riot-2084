#!/usr/bin/env python3
"""Build the shared game sounds from tools/gen-assets/sfx_common.json.

Sources are in raw/sfx_lib/ (committed: Kenney CC0 packs + Gregor Quendel's CC BY 4.0 crowd).
Each sound: optionally start from its loudest moment, trim silence, cut to `max` seconds with a
short fade, peak-normalize to `peak` dBFS, encode MP3 -> public/assets/sfx/common/<name>.mp3.
`loop` sounds get their tail crossfaded into their head so they loop seamlessly.
Then refreshes the credits (build_music.py --credits-only).

Usage: python3 tools/gen-assets/build_sfx_lib.py
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = HERE / "raw/sfx_lib"
OUT = ROOT / "public/assets/sfx/common"
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100


def decode(path: Path, ch: int) -> np.ndarray:
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy().reshape(-1, ch)


def shape(x: np.ndarray, s: dict) -> np.ndarray:
    env = np.abs(x).max(axis=1)
    if s.get("fromLoudest"):  # start just before the biggest swell (cheers build up)
        win = SR // 4
        rms = np.sqrt(np.convolve(env ** 2, np.ones(win) / win, "same"))
        x = x[max(0, int(np.argmax(rms)) - SR // 2):]
        env = np.abs(x).max(axis=1)
    loud = np.where(env > env.max() * 0.02)[0]
    if len(loud):
        x = x[max(0, loud[0] - SR // 200): loud[-1] + SR // 20]
    n = min(len(x), int(s["max"] * SR) + (SR if s.get("loop") else 0))
    x = x[:n].copy()
    if s.get("loop"):  # crossfade the extra second at the end into the start
        xf = SR
        ramp = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
        x = np.concatenate([x[-xf:] * (1 - ramp) + x[:xf] * ramp, x[xf:-xf]])
    else:
        fo = min(len(x) // 3, int(0.06 * SR))
        x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
        fi = int(0.003 * SR)
        x[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    return x / (np.abs(x).max() + 1e-9) * 10 ** (s["peak"] / 20)


def encode(x: np.ndarray, dst: Path, br: str):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]), "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", br, str(dst)], input=x.astype(np.float32).tobytes(), check=True)


if __name__ == "__main__":
    spec = json.loads((HERE / "sfx_common.json").read_text())
    for f in OUT.glob("*.mp3"):
        f.unlink()
    for name, s in spec["sounds"].items():
        ch = 2 if s.get("stereo") else 1
        x = shape(decode(RAW / s["src"], ch), s)
        encode(x, OUT / f"{name}.mp3", "128k" if ch == 2 else "96k")
        print(f"sfx {name:16} <- {s['src']:32} {len(x) / SR:5.2f}s")
    subprocess.run([sys.executable, str(HERE / "build_music.py"), "--credits-only"], check=True)

#!/usr/bin/env python3
"""Turn downloaded sound-effect candidates (raw/sfx_lib/, see fetch_sfx.py) into game sounds.

For each slot in sfx_candidates.json it uses `pick` (candidate index, default 0) if that file is
present, else the first candidate that was downloaded. Each sound is trimmed of leading/trailing
silence, cut to the slot's max length with a short fade, peak-normalized and encoded as MP3 into
public/assets/sfx/common/<slot>.mp3. The crowd bed loops seamlessly (crossfaded tail). Writes
sfx_library.json (what was used, for credits) and re-runs the music build to refresh credits.

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
# slot -> (max seconds, peak dBFS)
SHAPE = {"throw": (0.7, -3), "catch": (0.6, -2), "bigcatch": (1.6, -1), "wall": (0.6, -4), "score": (4.0, -3),
         "crowd": (20.0, -10), "whistle": (1.2, -4), "ui_move": (0.25, -8), "ui_confirm": (0.6, -6),
         "super": (1.6, -4), "drop": (0.9, -3), "jingle": (3.5, -4), "airhorn": (1.8, -6), "announcer": (2.2, -2)}


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def shape(x: np.ndarray, slot: str) -> np.ndarray:
    maxlen, peak_db = SHAPE.get(slot, (2.0, -3))
    thr = np.abs(x).max() * 0.02
    loud = np.where(np.abs(x) > thr)[0]
    if len(loud):
        x = x[max(0, loud[0] - SR // 200): loud[-1] + SR // 20]
    if slot == "crowd":  # seamless loop: crossfade the tail into the head
        n = min(len(x), int(maxlen * SR) + SR)
        x = x[:n]
        xf = SR
        head, tail = x[:xf], x[-xf:]
        ramp = np.linspace(0, 1, xf, dtype=np.float32)
        x = np.concatenate([tail * (1 - ramp) + head * ramp, x[xf:-xf]])
    else:
        x = x[: int(maxlen * SR)]
        fo = min(len(x) // 3, int(0.04 * SR))
        x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    fi = int(0.002 * SR)
    x[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def encode(x: np.ndarray, dst: Path, br="96k"):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", br, str(dst)], input=x.astype(np.float32).tobytes(), check=True)


if __name__ == "__main__":
    lib = json.loads((HERE / "sfx_candidates.json").read_text())
    used = {}
    for slot, cands in lib["candidates"].items():
        order = list(range(len(cands)))
        pick = lib.get("pick", {}).get(slot, 0)
        order.remove(pick)
        order.insert(0, pick)
        for i in order:
            src = RAW / f"{slot}__{cands[i]['id'][:8]}.mp3"
            if src.exists() and src.stat().st_size > 1000:
                x = shape(decode(src), slot)
                encode(x, OUT / f"{slot}.mp3", "112k" if slot in ("crowd", "score", "jingle") else "96k")
                used[slot] = cands[i]
                print(f"sfx {slot:10} <- [{i}] {cands[i]['title'][:50]}  ({len(x) / SR:.2f}s)")
                break
        else:
            print(f"sfx {slot:10}  (no file downloaded yet: run fetch_sfx.py on a home computer)")
    (HERE / "sfx_library.json").write_text(json.dumps({"sounds": used}, indent=1))
    if not used:
        sys.exit("nothing built")
    subprocess.run([sys.executable, str(HERE / "build_music.py"), "--credits-only"], check=True)

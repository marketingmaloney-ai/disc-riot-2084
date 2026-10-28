"""Cut the promo: intro -> best gameplay moments (flash cuts + captions) -> end card, with a soundtrack rebuilt
from the game's own sound effects, announcer and music. Inputs come from record.mjs (frame folders + events.json).

    python3 mix.py <work dir> <out.mp4>

<work>/plan.json: {"intro": "intro", "end": "end", "clips": [{"dir": "g0", "len": 6.5, "start": null | seconds,
"caption": ["TITLE", "SUB"]}], "music": "pier"} (paths relative to <work>; captions are PNGs made by caption.html).
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SFX = ROOT / "public/assets/sfx"
MUSIC = ROOT / "public/assets/music"
FPS = 30
SR = 48000

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FF = shutil.which("ffmpeg")


def load_audio(path, rate=1.0):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    if rate != 1.0:  # pitch/speed up like playbackRate
        idx = np.arange(0, len(a) - 1, rate)
        a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in (0, 1)], axis=1).astype(np.float32)
    return a


_cache = {}


def sfx(name, rate=1.0):
    key = (name, rate)
    if key not in _cache:
        p = SFX / f"{name}.mp3"
        _cache[key] = load_audio(p, rate) if p.exists() else None
    return _cache[key]


def place(bus, clip, t, vol=1.0):
    if clip is None:
        return
    i = int(t * SR)
    if i >= len(bus) or i + len(clip) <= 0:
        return
    a, b = max(0, i), min(len(bus), i + len(clip))
    bus[a:b] += clip[a - i:b - i] * vol


def event_sounds(e):
    """What the game's audio engine plays for an event: [(sfx name, volume, delay, rate)] (see src/audio/audio.ts)."""
    t, ch = e["type"], e.get("char")
    voice = lambda n, v=1.0, d=0.0: [(f"{ch}/{n}", v, d, 1.0)] if ch and (SFX / ch / f"{n}.mp3").exists() else []  # noqa: E731
    if t == "catch":
        return [("common/bigcatch" if e.get("big") else "common/catch", 0.9, 0, 1.0)]
    if t == "super":
        return [("common/super", 0.9, 0, 1.0)] + voice("shout", 1.0)
    if t == "supersonic":
        return [("common/punch", 0.55, 0, 1.25)] + voice("throw", 0.8)
    if t == "throw":
        return voice("throw", 0.7)
    if t == "wall":
        return [("common/wall", 0.55, 0, 1.0)]
    if t == "bumper":
        return [("common/wall", 0.9, 0, 1.45), ("common/punch", 0.45, 0, 1.6)]
    if t == "score":
        return [("common/score_big" if e.get("big") else "common/score", 0.9 if e.get("big") else 0.7, 0, 1.0)]
    if t == "drop":
        return [("common/drop", 0.8, 0, 1.0)]
    if t == "setEnd":
        return [("common/jingle", 0.7, 0, 1.0)]
    if t == "matchEnd":
        return [("common/jingle_win", 0.8, 0.5, 1.0), ("common/vo_winner", 1.0, 1.1, 1.0)]
    if t == "vo":
        return [(f"common/{e['name']}", 1.0, 0, 1.0)]
    if t == "round":
        if e.get("sd"):
            return [("common/vo_sudden_death", 1.0, 0.2, 1.0)]
        n = "vo_final_round" if e.get("decider") else f"vo_round_{min(5, e['set'])}"
        return [(f"common/{n}", 1.0, 0.2, 1.0), ("common/vo_fight", 1.0, 1.65, 1.0)]
    return []


def best_window(events, total, length):
    """Start time of the most exciting `length`-second window (supers, goals, bumpers, call-outs)."""
    w = {"super": 5, "score": 3, "bumper": 2, "vo": 2, "supersonic": 1.5, "catch": 0.4, "setEnd": 2, "reversal": 4}
    best, best_s = -1, 0.0
    for s10 in range(0, int((total - length) * 10) + 1):
        s = s10 / 10
        sc = sum(w.get(e["type"], 0) for e in events if s + 0.3 <= e["t"] <= s + length - 0.6)
        if sc > best:
            best, best_s = sc, s
    return best_s


def main(work, out):
    work = Path(work)
    plan = json.loads((work / "plan.json").read_text())
    seq = work / "seq"
    shutil.rmtree(seq, ignore_errors=True)
    seq.mkdir()
    n = 0
    timeline = []  # (kind, t0 seconds in the video, extra)

    def add_frames(files):
        nonlocal n
        for f in files:
            (seq / f"s_{n:05d}.jpg").symlink_to(f)
            n += 1

    def flash_frames(a, b, k=5):
        # white flash cut: last frame of a -> white -> first frame of b
        nonlocal n
        A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
        white = Image.new("RGB", A.size, (255, 255, 255))
        for i in range(k):
            x = (i + 1) / (k + 1)
            im = Image.blend(A, white, min(1, x * 2)) if x < 0.5 else Image.blend(white, B, (x - 0.5) * 2)
            p = work / "flash" / f"fl_{n:05d}.jpg"
            p.parent.mkdir(exist_ok=True)
            im.save(p, quality=92)
            (seq / f"s_{n:05d}.jpg").symlink_to(p)
            n += 1

    intro = sorted((work / plan["intro"]).glob("f_*.jpg"))
    timeline.append(("intro", 0.0, None))
    add_frames(intro)
    prev_last = intro[-1]
    for c in plan["clips"]:
        d = work / c["dir"]
        frames = sorted(d.glob("f_*.jpg"))
        events = json.loads((d / "events.json").read_text())
        L = c["len"]
        s = c.get("start")
        if s is None:
            s = best_window(events, len(frames) / FPS, L)
        a, b = int(s * FPS), int((s + L) * FPS)
        flash_frames(prev_last, frames[a])
        t0 = n / FPS
        timeline.append(("clip", t0, {"events": [dict(e, t=e["t"] - s) for e in events if s <= e["t"] < s + L], "caption": c.get("caption"), "len": L, "src": c["dir"], "start": s}))
        add_frames(frames[a:b])
        prev_last = frames[b - 1]
    end = sorted((work / plan["end"]).glob("f_*.jpg"))
    t_end = n / FPS
    timeline.append(("end", t_end, None))
    add_frames(end)
    total = n / FPS
    print(f"{n} frames = {total:.1f}s")
    for k, t0, x in timeline:
        print(f"  {t0:6.2f}s {k}" + (f" {x['src']} from {x['start']:.1f}s, {len(x['events'])} events" if x else ""))

    # ---- soundtrack
    bus = np.zeros((int((total + 1) * SR), 2), np.float32)
    music = load_audio(MUSIC / f"{plan.get('music', 'pier')}.mp3")
    m0 = int(plan.get("musicStart", 0) * SR)
    music = music[m0:m0 + len(bus)]
    env = np.ones(len(music), np.float32) * 0.62
    fade = int(1.5 * SR)
    env[-fade:] *= np.linspace(1, 0, fade)
    env[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    bus[: len(music)] += music * env[:, None]
    # intro hits (see intro.html timings)
    for name, t, v in [("common/super", 0.45, 0.6), ("common/bigcatch", 1.05, 1.0), ("common/punch", 1.42, 0.9), ("common/ui_confirm", 1.65, 0.5)] + \
            [("common/wall", 2.47 + i * 0.26, 0.7) for i in range(8)] + \
            [("common/punch", 5.36, 0.9), ("common/punch", 5.96, 0.9), ("common/punch", 6.56, 0.9), ("common/vo_ready", 7.15, 1.0), ("common/super", 7.6, 0.6)]:
        place(bus, sfx(name), t, v)
    # gameplay: crowd bed + every logged event
    crowd = sfx("common/crowd")
    for k, t0, x in timeline:
        if k != "clip":
            continue
        if crowd is not None:
            seg = crowd[: int(x["len"] * SR)]
            place(bus, seg, t0, 0.35)
        for e in x["events"]:
            for name, vol, delay, rate in event_sounds(e):
                place(bus, sfx(name, rate), t0 + e["t"] + delay, vol)
    # end card
    place(bus, sfx("common/score_big"), t_end + 0.05, 0.8)
    place(bus, sfx("common/jingle_win"), t_end + 0.3, 0.7)
    # soft limiter, then normalise to -1 dBFS
    bus = np.tanh(bus * 1.1) / np.tanh(1.1)
    bus *= 0.89 / max(1e-6, np.abs(bus).max())
    wav = work / "mix.f32"
    bus[: int(total * SR)].astype(np.float32).tofile(wav)

    # ---- captions + encode
    cmd = [FF, "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(seq / "s_%05d.jpg"),
           "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(wav)]
    filt, last, inputs = [], "[0:v]", 2
    for k, t0, x in timeline:
        if k != "clip" or not x["caption"]:
            continue
        cmd += ["-loop", "1", "-framerate", str(FPS), "-t", str(total), "-i", str(work / x["caption"])]
        a, b = t0 + 0.35, t0 + min(x["len"], 3.4)
        filt.append(f"[{inputs}:v]format=rgba,fade=in:st={a:.2f}:d=0.2:alpha=1,fade=out:st={b - 0.25:.2f}:d=0.25:alpha=1[c{inputs}]")
        filt.append(f"{last}[c{inputs}]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[v{inputs}]")
        last = f"[v{inputs}]"
        inputs += 1
    if filt:
        cmd += ["-filter_complex", ";".join(filt), "-map", last, "-map", "1:a"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", str(out)]
    subprocess.run(cmd, check=True)
    print("->", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

#!/usr/bin/env python3
"""Build in-game music from tools/gen-assets/music.json.

Each slot: download the source once (raw/music/, git-ignored), cut start..end, fade in/out,
loudness-normalize (two-pass EBU R128 to -16 LUFS, -1.5 dBTP) and encode 128 kbps stereo MP3 ->
public/assets/music/<slot>.mp3. Also writes public/assets/credits.json (shown on the CREDITS screen)
and CREDITS.md, from music.json and sfx_library.json.

Usage: python3 tools/gen-assets/build_music.py
"""
import json
import subprocess
import urllib.request
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public/assets/music"
RAW = HERE / "raw/music"
FF = imageio_ffmpeg.get_ffmpeg_exe()
UA = "DiscRiot2084-asset-fetch/1.0 (game dev; github.com/marketingmaloney-ai)"
FADE_IN, FADE_OUT = 0.4, 4.0


def fetch(url: str, dst: Path):
    if dst.exists() and dst.stat().st_size > 100_000:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=180) as r:
        dst.write_bytes(r.read())


def loudnorm_measure(src: Path, start: float, end: float) -> dict:
    r = subprocess.run([FF, "-hide_banner", "-ss", str(start), "-to", str(end), "-i", str(src),
                        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    return json.loads(txt[txt.rindex("{"):txt.rindex("}") + 1])


def build_slot(slot: str, s: dict):
    src = RAW / f"{s['id']}.mp3"
    fetch(s["src"], src)
    start, end = float(s["start"]), float(s["end"])
    m = loudnorm_measure(src, start, end)
    dur = end - start
    af = (f"afade=t=in:st=0:d={FADE_IN},afade=t=out:st={dur - FADE_OUT}:d={FADE_OUT},"
          f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{slot}.mp3"
    subprocess.run([FF, "-loglevel", "error", "-y", "-ss", str(start), "-to", str(end), "-i", str(src),
                    "-af", af, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k",
                    "-map_metadata", "-1", str(dst)], check=True)
    print(f"music {slot}: {s['artist']} - {s['title']}  {dur:.0f}s  in {m['input_i']} LUFS -> -16  ({dst.stat().st_size // 1024} KB)")


def write_credits(music: dict):
    sfx = json.loads((HERE / "sfx_library.json").read_text()) if (HERE / "sfx_library.json").exists() else {"sounds": {}}
    entries = [{"what": f"Music · {slot.upper()}", "title": s["title"], "artist": s["artist"],
                "license": s["license"], "licenseUrl": s["licenseUrl"], "page": s["page"]}
               for slot, s in music["slots"].items()]
    seen = set()
    for name, s in sfx.get("sounds", {}).items():
        if s.get("page") in seen:
            continue
        seen.add(s.get("page"))
        entries.append({"what": f"Sound · {name}", "title": s["title"], "artist": s["artist"],
                        "license": s["license"], "licenseUrl": s.get("licenseUrl", ""), "page": s["page"]})
    (ROOT / "public/assets/credits.json").write_text(json.dumps({"credits": entries}, indent=1))
    lines = ["# Credits", "", "DISC RIOT 2084 uses these Creative Commons works, found via [Openverse](https://openverse.org).",
             "Music and sounds were trimmed, faded and loudness-normalized for the game.", ""]
    for e in entries:
        lines.append(f"- **{e['what']}**: \"{e['title']}\" by {e['artist']}, [{e['license']}]({e['licenseUrl']}), {e['page']}")
    (ROOT / "CREDITS.md").write_text("\n".join(lines) + "\n")
    print(f"credits: {len(entries)} entries -> public/assets/credits.json, CREDITS.md")


if __name__ == "__main__":
    import sys
    music = json.loads((HERE / "music.json").read_text())
    if "--credits-only" not in sys.argv:
        for slot, s in music["slots"].items():
            build_slot(slot, s)
    write_credits(music)
    subprocess.run(["node", str(ROOT / "tools/asset-manifest.mjs")], check=True)

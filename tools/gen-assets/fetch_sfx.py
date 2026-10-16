#!/usr/bin/env python3
"""Download the sound-effect candidates in sfx_candidates.json into raw/sfx_lib/.

Run this on a HOME computer: Freesound (where Openverse's sound effects are hosted) blocks
cloud servers. Standard-library Python only, no installs needed.

    cd disc-riot-2084
    git pull
    python3 tools/gen-assets/fetch_sfx.py
    git add tools/gen-assets/raw/sfx_lib && git commit -m "SFX candidates from Openverse" && git push
"""
import json
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DST = HERE / "raw/sfx_lib"
UA = "Mozilla/5.0 (DiscRiot2084 asset fetch; game dev)"

if __name__ == "__main__":
    lib = json.loads((HERE / "sfx_candidates.json").read_text())
    DST.mkdir(parents=True, exist_ok=True)
    ok = fail = 0
    for slot, cands in lib["candidates"].items():
        for c in cands:
            out = DST / f"{slot}__{c['id'][:8]}.mp3"
            if out.exists() and out.stat().st_size > 1000:
                ok += 1
                continue
            try:
                req = urllib.request.Request(c["src"], headers={"User-Agent": UA, "Referer": "https://freesound.org/"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    out.write_bytes(r.read())
                ok += 1
                print(f"ok    {out.name}  ({out.stat().st_size // 1024} KB)  {c['title']}")
            except Exception as e:  # keep going; report at the end
                fail += 1
                print(f"FAIL  {out.name}  {e}")
            time.sleep(0.5)
    print(f"\n{ok} downloaded, {fail} failed -> {DST}")
    print("Next: git add tools/gen-assets/raw/sfx_lib && git commit -m 'SFX candidates from Openverse' && git push")

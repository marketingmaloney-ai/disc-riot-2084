# DISC RIOT 2084 — Project Memory

A digest of everything decided and built on this project so far, for importing into a memory system.
Everything was built in Claude Code cloud sessions (September 2026). Keep it current as the project moves on.
Companion docs in this repo: `CHECKLIST.md` (task status and resume protocol), `BALANCE.md` (tuning notes),
`ANTIGRAVITY_HANDOFF.md` and `tools/gen-assets/ART_BRIEF.md` (art generation), `README.md`.

## 1. What it is
- A **Windjammers-style, fast-paced arcade flying-disc game**, a full playable prototype in **three.js**.
- Repo: `github.com/marketingmaloney-ai/disc-riot-2084` (private, branch `main`).
- Playable build: a private Claude artifact at https://claude.ai/artifact/AqhyW8e7KXJJEYVT5a2grU (version 26 as of 2026-09-29: audit fixes, connect-controller screen, freeze jitter, memory leak, REVERSAL text).
  Republish it from `dist/` after `npm run build`.

## 2. Owner preferences and working style
- Wants a **full playable prototype, never greybox**. They said a greybox is "a waste of time".
- Claude acts as **first approver / creative director**: art must be "AAA", at or above the original Windjammers.
- Keep interviewing the owner when direction is unclear; ask before downloading or installing tools. Open-source tools are OK.
- Declined: downloading the Windjammers 2 ROM, because that's piracy. Rules were researched from public sources instead.
- Plays mostly **on an iPhone** inside the Claude app, so mobile touch, layout and rotation issues matter.
- Art route: generates images and videos in **Google Flow** (Nano Banana 2 / Veo), either personally or via their **Antigravity agent**.
  They find Flow annoying: it often draws the character **twice**. **No Gemini API** (decided 2026-09-29):
  art is made in Flow only. The old key should be deleted in Google AI Studio (it was pasted in chat); never commit keys.
- Shares art through **Google Photos shared-album links** or by pushing to `tools/gen-assets/inbox/`.

## 3. Locked creative decisions
- Title **DISC RIOT 2084**. Theme: **80s cyberpunk beach**. Art style: **bold western pop-comic** (locked after batch01).
- 4 characters, "pin-up heavy" but non-explicit; all adults:

  | Character | Speed | Power | Curve | Super |
  |---|---|---|---|---|
  | **Vega Starr** | 7.0 | 23.3 | 1.0 | wave, LASER SURF |
  | **Kaito "Riptide" Mori** | 8.2 | 21.3 | 1.35 | zigzag, GLITCH STORM |
  | **Roxy Voltage** | 7.4 | 22.6 | 0.85 | fireball, THUNDER KISS |
  | **Brick Diamond** | 6.4 | 24.3 | 0.75 | meteor, METEOR SLAM; drawn 1.08× taller |

- 4 arenas, each with its own 5-point goal-zone width and its own music track:

  | Arena | 5-pt zone half-width | Music |
  |---|---|---|
  | Sunset Strip | 1.65 | classic Miami synthwave, 118 BPM |
  | Neon Pier | 1.35 | dark night drive, 128 BPM |
  | Laser Lagoon | 2.05 | laid-back beach funk, 104 BPM |
  | Orbital Cabana | 1.1 | half-time space darkwave, 136 BPM |

- Platforms: desktop keyboard and gamepad, plus mobile touch (landscape).
- Features: super cut-ins, generated audio.

## 4. Gameplay rules (aligned with the original Windjammers)
- 30-second sets, first to 12 points.
  - Goal zones score 3 or 5 points; a dropped disc gives 2 points.
  - A tied set counts for both players; at 2–2 in sets it goes to **sudden death**.
- **Power shot:** tap A right after catching. The timing window is wider when you're behind (comeback window).
- **Reversal:** perfectly timed catch of a super fires your own super back.
- **Super:** pop the disc up with B just before it hits you, or toss it with back + B. Stand in the landing circle to charge, then throw.
  - **Toss lock:** once you're inside your own toss's landing circle, you lock onto it until you catch. The owner asked for this.
- **Curves:** a quarter-circle motion, aimed to break toward the opposite corner.
- **Human assists** (CPU unchanged; the owner said Easy was too hard):
  - catch reach ×1.6 (about 0.99 units);
  - run speed ×1.12.
- **Progression:**
  - Attributes: SPEED, POWER, TECHNIQUE and REFLEX, earned through 18 achievements per fighter (24 points).
  - The player chooses the upgrades.
  - Upgrades apply in **VS CPU only**, cap at +5 levels (about 15%), and are saved on the device.
- CPU difficulty levels: easy, normal and hard.

## 5. Tech architecture
- **Stack:** Vite + TypeScript + three.js. Rendering uses EffectComposer + UnrealBloom (threshold 0.9) with a 2.5D presentation:
  - textured court plane;
  - billboard sprite characters;
  - 3D disc with trail and particles;
  - leaning painted backdrop.
- `src/sim/`: deterministic 60 Hz fixed-step simulation with **no three.js dependency**.
  - `constants.ts` holds all tuning values.
  - `game.ts` holds the rules.
  - `characters.ts` holds the stats.
- Other source folders:
  - `src/ai/cpu.ts`: CPU with human-like errors.
  - `src/render/scene.ts`: renderer. Setups are generation-checked so overlapping loads can't leave ghost fighters, and it resizes every frame.
  - `src/render/arena.ts`: arenas.
  - `src/audio/audio.ts`: Web Audio synth SFX, a per-arena procedural song table, and per-character sound clips.
  - `src/ui/`: HUD, upgrade screen and styles. There's an on-screen BACK button, and layout is compact below 520 px tall.
  - `src/meta/`: progress, achievements and match tracker.
- **Tests:** `npx vitest run`, 9 tests. The balance harness is opt-in: `BALANCE=1 npx vitest run src/sim/balance.test.ts`.
- **Dev:** `npx vite --port 5173`. Quick start: `?quick=1&p1=roxy&p2=brick&arena=0`. The arena parameter is an **index**, 0–3.
- **Asset detection:** `public/assets/manifest.json`, built by `tools/asset-manifest.mjs`. There are no HEAD probes.

## 6. Art and audio pipeline (`tools/gen-assets/`)
- `process.py` subcommands:
  - `key`: border-connected green-screen keying. Costume greens survive.
  - `slice`: splits sprite sheets, with `--expect N`.
  - `pack`: builds the atlas, foot-anchored, one scale per animation, cropping rather than shrinking.
  - `video`: extracts frames, keys them and writes a numbered `sheet.jpg`; `--figure left|right|largest` keeps one figure.
  - `split`: writes one PNG per figure, for Flow's duplicated characters.
  - `sheet`: makes a review preview.
- `approved.json` drives `build_assets.py`, which builds atlases, portraits and arena images. Animation sources can be:
  - a strip image with `expect`;
  - `mode: "components"`;
  - a `video` with `fps`, `frames`, `playFps`, `refFrame` (scale against the standing pose), `dx` and `figure`.
  - Video extraction is cached.
- **Video-to-sprite works best:** a Flow image-to-video clip on green gives smooth, consistent frames.
  - Roxy's and Brick's full animation sets came from 6 clips (A throw/win, B dive/lob/block, D defeat).
  - Vega's hold and throw came from a test clip.
- `sfx.json` + `build_sfx.py` cut character sounds from the videos' audio into `public/assets/sfx/<char>/*.mp3`:
  throw, super shout, dash, lob, block, win and lose.
  - Roxy and Brick have them. Vega's clip is only background noise, and Kaito has no clips.
  - Anything missing falls back to the synth sounds.
- Atlases are **format 2** (since 2026-09-29): `process.py pack` trims each frame, keeps one scale per animation, shelf-packs frames with an 8 px clear margin and writes per-frame rects `[x, y, w, h, footX]`; the renderer sizes and anchors each sprite per frame. Nothing is cropped or shrunk, both atlas dimensions stay ≤4096 px for phones, and the four atlases take ~109 MB of GPU memory (was ~236 MB). `process.py video` falls back to system `ffmpeg` when `imageio-ffmpeg` is not installed.

## 7. Current state (end of September 2026)
- All 4 characters have all 10 animations from real art: idle, run, dash, hold, throw, lob, block, knock, win, lose.
- All 4 arenas have a painted court and backdrop.
- Menus work on phones; the play area no longer shrinks after rotation; there are no ghost fighters.
- The game is playable end to end on desktop and iPhone.

## 8. Open items / next steps
- **batch05:** 4 portraits and 4 super cut-ins. The prompts are queued; run them in Flow or via the Antigravity agent.
- **batch04:** 2 landscape backdrops, jobs 4.27–4.28.
- Re-download Roxy's and Brick's B and D clips at 720p; the current copies are only 568×320.
- Brick's run cycle still comes from an older, pinker still image. It needs a new run clip.
- Proper knock-back clips for Roxy and Brick; the knockdown currently reuses the get-up from the dive clip.
- Voice and sound clips for Vega and Kaito.
- Optional: produced music tracks to replace the procedural songs.
- Keep checking that the Easy CPU is beatable on a phone. Next lever: make the Easy CPU itself weaker.

## 9. Gotchas learned
- Flow often draws a character twice. Use `process.py split`, or `"figure"` in `approved.json`.
- Flow's mobile version produces portrait images. Courts get rotated automatically; backdrops must be landscape.
- iOS in-app browsers don't reliably fire `resize`, which is why the renderer checks its size every frame.
- The audio context must be unlocked by the first tap or key press; that's handled globally.
- Publishing the artifact: upload only changed files from `dist/`, and remove the old hashed JS file.

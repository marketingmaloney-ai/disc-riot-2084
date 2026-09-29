# DISC RIOT 2084: master checklist and resume protocol

> **If a session is interrupted, read this file first.** It is the single source of truth for task status. `PROJECT_MEMORY.md` is the digest of everything decided and built. Update this file and commit/push **after every completed item** so nothing is lost.

## Resume protocol (do this at the start of every new session)
1. Clone or open the repo, `git pull`, then run `npm install` and `pip install pillow numpy opencv-python-headless`.
2. Read `PROJECT_MEMORY.md`, this file, `tools/gen-assets/ART_BRIEF.md` and `tools/gen-assets/AGENT_ART_TASK.md`.
3. Run `git log --oneline | head -20` to see the latest work, and `npm test` to confirm the sim is green.
4. Start the dev server with `npm run dev`. Screenshot with Playwright (Chromium at `/opt/pw-browsers`); `?quick=1&p1=roxy&p2=brick&arena=0` jumps straight into a match (arena is an index 0-3).
5. Continue from the **first unchecked item** below. Any item marked 🔄 was in progress: check `tools/gen-assets/raw/` and `tools/gen-assets/inbox/` for partial outputs before regenerating.
6. Art approval rule: the main session is creative director. Nothing enters `public/assets/` until the director approves it against the Windjammers quality bar (AAA).

## Decisions locked with the user
- [x] Title: **DISC RIOT 2084**
- [x] Theme: 80s cyberpunk beach, **bold pop-comic style (locked after batch01)**, pin-up heavy but non-explicit, all characters adult (25+)
- [x] Platforms: desktop (keyboard + gamepad) and mobile (touch, landscape). The user plays mostly on iPhone.
- [x] Roster: 4 characters (Vega Starr, Kaito "Riptide" Mori, Roxy Voltage, Brick Diamond)
- [x] Audio: procedurally generated (Web Audio SFX + per-arena synthwave), plus per-character clips cut from Flow videos
- [x] No greybox. Go straight to a full prototype.
- [x] Arenas: **4**, each with its own 5-pt zone half-width: Sunset Strip 1.65, Neon Pier 1.35, Laser Lagoon 2.05, Orbital Cabana 1.1 (widened in balance pass 1; order is locked).
- [x] Super cut-ins: **yes**. Implemented (`Hud.cutin`, 0.7 s freeze `HITSTOP_CUTIN`); uses `cutin.png` > `portrait.png` > atlas frame.
- [x] **No Gemini API.** Art is made in Google Flow only (2026-09-29). `gen.mjs` stays in the repo but is unused.

## Art generation route
- **Google Flow only.** Claude writes `tools/gen-assets/queue/batchNN.md` (STATUS: READY). The user, or their Antigravity agent in Flow mode (`ANTIGRAVITY_HANDOFF.md`), generates in Google Flow and pushes to `tools/gen-assets/raw/...`, or drops files into `tools/gen-assets/inbox/<batch>/`, or shares a Google Photos album link. Claude sorts, reviews, keys, and approves or writes a revision batch.
- **Animation: video beats stills.** Flow image-to-video on green screen, from start frames in `tools/gen-assets/video_starts/`, then `process.py video` and a `video` source in `approved.json`.
- Flow gotchas: it often draws the character twice (`process.py split` or `"figure"`), and mobile Flow defaults to portrait (set landscape before every generation).

## Blockers / user actions
- [x] GitHub repo: **marketingmaloney-ai/disc-riot-2084** (private, branch `main`). Always push after each item.
- [x] Gemini API billing: **not needed** (user decision 2026-09-29).
- [ ] User: delete the Gemini API key in Google AI Studio (no longer used, and it was pasted in chat). Never commit keys.

## Phase 1: Engine and playable prototype ✅
- [x] Vite + TS + three.js project, fixed 60 Hz deterministic sim (`src/sim`)
- [x] Moves: walk, dash, catch, straight/angle throw, curve (motion input), power shot, lob with reticle, block/toss, super charge, 4 supers, super-lob, knockback
- [x] Rules: 3/5-point goals, 2-point drops, sets to 12 or 30 s, best of 3, sudden death
- [x] CPU AI with easy/normal/hard (`src/ai/cpu.ts`)
- [x] Input: keyboard (solo + 2P split), Gamepad API, touch joystick + A/B
- [x] 2.5D renderer: court, walls, goal zones, net, crowd lights, bloom, trails, particles, shake, hit-stop, super zoom
- [x] Camera framing solved (pos 0, 13.5, 15 · look 0, 0, -2.75 · fov 34)
- [x] Audio: SFX + synthwave
- [x] Menus: title/attract demo, mode, CPU level, how-to, character select, arena select, VS, pause, results
- [x] Mobile: landscape layout, rotate prompt, touch controls, pause button
- [x] Tests: full CPU match, determinism, half-court bounds (`npm test`)

## Phase 2: Art pipeline ✅
- [x] `gen.mjs` (Gemini REST; unused, see locked decisions)
- [x] `process.py`: `key` (border-connected green only, costume greens survive), `slice` (`--expect`, component mode for overlapping figures), `pack` (foot-anchored, one scale per animation), `video`, `split`, `sheet`
- [x] `approved.json` + `build_assets.py` (atlases, portraits, arenas; image, component and video sources; cached video extraction)
- [x] `sfx.json` + `build_sfx.py` (character sounds cut from video audio)
- [x] Asset manifest (`tools/asset-manifest.mjs`) instead of HEAD probes
- [x] PLAYER_HEIGHT raised to 3.0 (Brick heightScale 1.08)
- [x] Painted backdrops on a plane leaning toward the camera

## Phase 3: Art production
Status key: ⬜ not started · 🔄 in progress · 👀 awaiting approval · ✅ approved and integrated · ❌ rejected (see notes)

### Style and designs
- ✅ Style test: keyart **v2** is the reference (`queue/batch01_review.md`). Bold pop-comic style locked.
- ✅ Reference sheets: Vega **ref_v3**, Kaito **ref_v1**, Roxy **ref_v3** (tattoo locked to left arm), Brick **ref_v1**

### Animations (all 10 per character are real art)
Order and frames: idle(4) run(6) dash(3) hold(2) throw(3) lob(2) block(2) knock(2) win(2) lose(2). Atlases are tightly packed (format 2: per-frame rects, 8 px margins, both sides ≤4096 px); see `process.py pack`.

| Character | Source | Status |
|---|---|---|
| Vega | batch03 + batch04 stills; hold/throw from Flow video test clip | ✅ all 10 |
| Kaito | batch03 + batch04 stills | ✅ all 10 |
| Roxy | idle/run/hold from batch03; the rest from Flow videos A, B, D | ✅ all 10 (B and D clips only 568×320; knock reuses the dive get-up) |
| Brick | idle/run from batch03; the rest from Flow videos A, B, D | ✅ all 10 (B and D clips only 568×320; run is the older pinker still; knock reuses the dive get-up) |

### Arenas
- ✅ Sunset Strip court + backdrop (backdrop_v2)
- ✅ Neon Pier court + backdrop
- ✅ Laser Lagoon court + backdrop
- ✅ Orbital Cabana court + backdrop (backdrop_v2)
- ⬜ Arena `preview.jpg` thumbnails (optional)

### Character sounds
- ✅ Roxy, Brick (throw, super shout, dash, lob, block, win, lose)
- ⬜ Vega (her test clip is background noise only) · ⬜ Kaito (no clips). Both fall back to synth sounds.

### Batches
- batch01, batch02, batch03: ✅ generated and reviewed
- batch04: ✅ SUPERSEDED. Jobs 4.01-4.13 integrated; Roxy/Brick jobs replaced by Flow videos; backdrop jobs 4.27-4.28 replaced by the Sunset/Orbital backdrop_v2 images (commit 292713b).
- video01, video02: cancelled as batches; the video route itself is now the preferred animation route.
- **batch05: READY.** 4 portraits (3:4) + 4 super cut-ins (16:9, green screen). Drop results into `tools/gen-assets/inbox/batch05/`.

### Open art work
- [ ] **batch05:** real portraits (current `portrait.png` files are interim crops from the ref sheets) and super cut-in art (`public/assets/characters/<id>/cutin.png`)
- [ ] Re-download Roxy's and Brick's B and D clips at 720p
- [ ] New run clip for Brick
- [ ] Proper knock-back clips for Roxy and Brick
- [ ] Voice/sound clips for Vega and Kaito
- [ ] Optional: title logo (the CSS logo exists); produced music tracks to replace the procedural songs

## Phase 3c: Progression ✅
- [x] 4 attributes (SPEED, POWER, TECHNIQUE, REFLEX), +5 levels each (~+15%), applied in **VS CPU only** (2P uses base stats)
- [x] 18 achievements per character (24 pts; maxing costs 20), tracked by `src/meta/tracker.ts`, saved on-device (`localStorage`, key `discriot2084.profile.v1`)
- [x] FIGHTER UPGRADES screen (mode menu + "SPEND POINTS" on results), LV badges and bonus bars on character select, unlock panel on results
- [x] Tests: `src/meta/progress.test.ts`
- [ ] Later: cloud save when online play lands; optional per-achievement toast mid-match

## Phase 4: Integration and polish
- [x] Balance pass 1: see `BALANCE.md` (harness `src/sim/balance.test.ts`)
- [x] Rules aligned with the original WJ (30 s sets, tied sets, sudden death, post-catch power shot, comeback window, reversals). See BALANCE.md pass 2.
- [x] Human assists: catch reach ×1.6, run speed ×1.12 (CPU unchanged)
- [x] Toss lock: once inside your own toss's landing circle, you lock on until you catch
- [x] Phones: BACK button, menus fit small screens, play area no longer shrinks after rotation, no ghost fighters after restarting a match
- [x] Procedural music track per arena
- [x] Production build (`npm run build`, which also writes `public/assets/manifest.json`)
- [x] Playable link (private Claude artifact): https://claude.ai/artifact/AqhyW8e7KXJJEYVT5a2grU. To update: `npm run build`, then republish `dist/index.html` + `dist/assets/**` to that URL (upload only changed files; remove the old hashed JS).
- [ ] Human play-test on iPhone: is Easy beatable by a first-timer? Do supers feel strong enough? Next lever: weaken the Easy CPU itself.
- [ ] Performance check on mobile (target 60 fps; drop bloom resolution if needed)
- [ ] Tune sprite height/anchor per character now that real atlases are in
- [ ] Re-screenshot every arena × character combo and do the director review pass
- [ ] Future arena idea: a court with bounce barriers (the original had some)

### Visual audit (2026-09-29, iPhone 15 landscape playtest)
- [x] Backdrop hid fighters at the back of the court (only feet showed) and deep lobs: backdrop is now a background layer (`depthTest` off, drawn first) and the apron stops at the backdrop's floor line
- [x] Touch joystick and A/B sat on top of the pause and results menus and ate the left half of every button; now hidden unless actually playing. Pause button disabled after match end
- [x] One-shot animations (throw, lob, block, knock) got cut off at ~0.16 s; they now finish before going back to idle/hold (running still cuts in)
- [x] Back-row fighters read as standing in the crowd once drawn over the backdrop (reported from iPhone): added a tinted glass barrier + neon rail above the far wall, painted as background so fighters always draw in front. Also held the backdrop under the bloom threshold and toned down the far-wall/rail neon, which were bloom-washing back-row fighters in Sunset Strip and Orbital Cabana
- [x] Far-wall neon strips still cut across back-row fighters' legs (reported from iPhone): the far wall, its strips and the floor apron are now drawn as background too, so anything on the court draws over them
- [x] Sprite frames were clipped at the atlas cell edges (30+ frames, worst on Brick): `process.py pack` rewritten to a tight atlas with per-frame rects and 8 px margins, all 4 atlases rebuilt. No cropping, no neighbour bleed, GPU memory for fighters down from ~236 MB to ~109 MB
- [x] CPU flickered between walk and idle every frame, restarting its run cycle: renderer now waits 0.12 s of standing still before run gives way to idle (AI and gameplay unchanged)
- [ ] Disc glow/trail/sparks cut out by fighters in the near half (sprite `renderOrder` beats depth)
- [ ] Hit-stop jitter: `px` isn't updated during freezes, so the disc buzzes on 120 Hz screens
- [ ] REVERSAL! announcement hidden behind the super cut-in
- [ ] Trail length and super sparks depend on frame rate
- [ ] GPU memory leak: old arenas never disposed (attract demo loops leak), plus ~315 MB of atlases resident
- [ ] Results screen overflows on phones (TITLE pushed off screen); A/B cover the near-right court corner
- [ ] Minor: sudden-death timer blinks "0"; first arena's goal labels use the fallback font; pause-menu BACK covers the P1 name

## Phase 5: Stretch
- [ ] More arenas / characters
- [ ] Online play (rollback netcode over WebRTC; the sim is already deterministic)

## Session log
- **S1 (2026-09-28):** Research + plan. Built the full engine, AI, renderer, audio, menus, mobile, pipeline and tests. Created the Antigravity bridge and batch01, the repo, 2 extra arenas and cut-ins.
- **S2 (2026-09-28 to 09-29):** Reviewed batch01-04; interim then real art; balance passes 1 and 2; progression; video-to-sprite pipeline; Roxy/Brick full sets from Flow videos; character sounds; all 4 backdrops; phone fixes; per-arena music; human assists; toss lock; `PROJECT_MEMORY.md`.
- **S3 (2026-09-29):** Checklist cleanup: brought every section up to date with the code and git history, marked batch04 superseded, recorded the "no Gemini API, Flow only" decision, removed the reference to the missing `PLAN.md`.
- **S4 (2026-09-29, Mac session):** Visual audit (full code read, atlas edge scan, headless-Chrome playtest at iPhone size). Fixed the backdrop hiding back-court fighters, touch controls over menus, and cut-off one-shot animations. Then, from Brice's iPhone screenshot, the glass barrier so back-row fighters don't read as standing in the crowd. Remaining findings listed under Phase 4 "Visual audit".

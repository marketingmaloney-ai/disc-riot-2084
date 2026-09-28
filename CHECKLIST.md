# DISC RIOT 2084: master checklist and resume protocol

> **If a session is interrupted, read this file first.** It is the single source of truth for where the project stands. Update it and commit/push **after every completed item** so nothing is lost.

## Resume protocol (do this at the start of every new session)
1. Clone or open the repo, then run `npm install` and `pip install pillow numpy opencv-python-headless`.
2. Read this file, `PLAN.md`, `tools/gen-assets/ART_BRIEF.md` and `tools/gen-assets/AGENT_ART_TASK.md`.
3. Run `git log --oneline | head -20` to see the latest work, and `npm test` to confirm the sim is green.
4. Check for the Gemini key: `test -n "$GEMINI_API_KEY" || test -f .env`. If neither exists, ask the user to add `GEMINI_API_KEY` in the environment settings. Never commit the key.
5. Start the dev server with `npm run dev`. Screenshot with Playwright (Chromium at `/opt/pw-browsers`); `?quick=1` jumps straight into a match.
6. Continue from the **first unchecked item** below. Any item marked 🔄 was in progress: check `tools/gen-assets/raw/` for partial outputs before regenerating.
7. Art approval rule: the main session is creative director. One subagent per art piece. Nothing enters `public/assets/` until the director approves it against the Windjammers quality bar.

## Decisions locked with the user
- [x] Title: **DISC RIOT 2084**
- [x] Theme: 80s cyberpunk beach, **bold pop-comic style (locked after batch01)**, pin-up heavy but non-explicit, all characters adult (25+)
- [x] Platforms: desktop (keyboard + gamepad) and mobile (touch, landscape)
- [x] Roster: 4 characters (Vega Starr, Kaito "Riptide" Mori, Roxy Voltage, Brick Diamond)
- [x] Audio: procedurally generated (Web Audio SFX + synthwave)
- [x] No greybox. Go straight to a full prototype.
- [x] Arenas: **4**: Sunset Strip (5-pt zone 1.3), Neon Pier (1.0), Laser Lagoon (1.7), Orbital Cabana (0.8). The zone size varies gameplay per court.
- [x] Super cut-ins: **yes**. Implemented (`Hud.cutin`, 0.7 s freeze `HITSTOP_CUTIN`); uses `cutin.png` > `portrait.png` > atlas frame.

## Art generation route
- **Primary: Antigravity bridge.** Claude writes `tools/gen-assets/queue/batchNN.md` (STATUS: READY). The user's Antigravity agent follows `ANTIGRAVITY_HANDOFF.md`, generates with Nano Banana on the user's subscription, pushes `tools/gen-assets/raw/...` and sets STATUS: GENERATED. Claude pulls, reviews, keys, and approves or writes a revision batch.
- **Flow mode:** when the Antigravity API quota runs out, its browser agent generates in Google Flow (see handoff). Manual fallback: the user drops files into `tools/gen-assets/inbox/<batch>/` and Claude sorts them visually.
- Fallback: `gen.mjs` with an API key, once billing is enabled on the key's Cloud project.

## Blockers / user actions
- [x] Gemini API key provided (Google AI Studio)
- [ ] **Enable billing on the Google AI Studio project.** The key works, but the free tier has 0 quota for every image model (HTTP 429, `limit: 0`). Test command:
  `set -a; . ./.env; set +a; node tools/gen-assets/gen.mjs --model gemini-3.1-flash-image --size 1K --out tools/gen-assets/raw/test/ping.png --prompt "pink frisbee on #00FF00"`
- [ ] Store the key as `GEMINI_API_KEY` in the environment settings, so new sessions have it. `.env` in the container is lost when the container is reclaimed.
- [ ] Rotate the key: it was pasted in chat.
- [x] GitHub repo: **marketingmaloney-ai/disc-riot-2084** (private, branch `main`). Always push after each item.

## Phase 1: Engine and playable prototype ✅
- [x] Vite + TS + three.js project, fixed 60 Hz deterministic sim (`src/sim`)
- [x] Moves: walk, dash, catch, straight/angle throw, curve (motion input), power shot, lob with reticle, block/toss, super charge, 4 supers, super-lob, knockback
- [x] Rules: 3/5-point goals, 2-point drops, sets to 12 or 45 s, best of 3, sudden death
- [x] CPU AI with easy/normal/hard (`src/ai/cpu.ts`)
- [x] Input: keyboard (solo + 2P split), Gamepad API, touch joystick + A/B
- [x] 2.5D renderer: court, walls, goal zones, net, crowd lights, bloom, trails, particles, shake, hit-stop, super zoom
- [x] Camera framing solved (pos 0, 13.5, 15 · look 0, 0, -2.75 · fov 34)
- [x] Procedural stand-in art (characters + 2 arenas) in the same atlas format as the final art
- [x] Audio: SFX + 2 synthwave tracks
- [x] Menus: title/attract demo, mode, CPU level, how-to, character select, arena select, VS, pause, results
- [x] Mobile: landscape layout, rotate prompt, touch controls, pause button
- [x] Tests: full CPU match, determinism, half-court bounds (`npm test`)

## Phase 2: Art pipeline
- [x] `gen.mjs` (Gemini REST, proxy-aware, refs, sidecar prompt log)
- [x] `process.py` (chroma key + despill, content-aware slice, foot-anchored atlas pack, preview)
- [x] First real run: keying ✅, slicer rewritten (gap projection) ✅, pack + in-game render ✅
- [ ] Raise PLAYER_HEIGHT to about 3.0 when the real animations land (sprites read small)
- [ ] Update the backdrop plane geometry to fit the generated backdrop aspect (only about the lower 55% shows in-game)

## Phase 3: Art production (one subagent per piece, director approval required)
Status key: ⬜ not started · 🔄 in progress · 👀 awaiting approval · ✅ approved and integrated · ❌ rejected (see notes)

### Style
- ✅ Style test: keyart **v2** approved as the reference (see `queue/batch01_review.md`). **User locked the bold pop-comic style** (style_bible.txt rewritten to match).

### Character reference sheets (gemini-3-pro-image, 16:9 2K)
- ✅ Vega Starr: design approved (**ref_v3**)
- ✅ Kaito Mori: design approved (**ref_v1**)
- ✅ Roxy Voltage: design approved (**ref_v3**, tattoo locked to the left arm)
- ✅ Brick Diamond: design approved (**ref_v1**)

### Animation sheets (gemini-3.1-flash-image + ref), per character
batch03 = idle/run/hold/throw ×4 (queued). batch04 = dash/lob/block/knock/win/lose ×4 (write after reviewing batch03). batch05 = portraits + cut-ins.
Order: idle(4) run(6) dash(3) hold(2) throw(3) lob(2) block(2) knock(2) win(2) lose(2)

| Character | idle | run | dash | hold | throw | lob | block | knock | win | lose | packed atlas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Vega  | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Kaito | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Roxy  | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Brick | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Portraits (3:4 2K), for character select and the VS screen
- ⬜ Vega · ⬜ Kaito · ⬜ Roxy · ⬜ Brick

### Arenas (batch02 queued: court + backdrop each)
- 🔄 Sunset Strip court · 🔄 backdrop · ⬜ preview.jpg
- 🔄 Neon Pier court · 🔄 backdrop · ⬜ preview.jpg
- 🔄 Laser Lagoon court · 🔄 backdrop · ⬜ preview.jpg
- 🔄 Orbital Cabana court · 🔄 backdrop · ⬜ preview.jpg

### UI art
- ⬜ Title logo (optional; the CSS logo exists)
- ⬜ Super cut-in art ×4 (`public/assets/characters/<id>/cutin.png`, transparent, dramatic waist-up super pose facing right). Queue after the ref sheets are approved (batch03).

## Phase 3b: Interim art (in the game now, replaced automatically as batches land) ✅
- [x] `build_interim.py`: approved ref sheets → the 3/4-view atlas (`"interim": true`) + a front-view portrait per character
- [x] Renderer fakes motion for interim atlases (lean, squash/stretch, hops per state)
- [x] PLAYER_HEIGHT 2.35 → 3.0; Brick heightScale 1.08
- [x] Character select, VS and cut-ins use the real portraits
- [x] Fixed: menu taps shorter than one frame were ignored
- When batch03 lands, pack real atlases **without** `interim`, and re-run portraits only if batch05 isn't done.

## Art status after batch02/03 (reviewed; picks in `tools/gen-assets/approved.json`; build: `python3 tools/gen-assets/build_assets.py`)
- ✅ Real animations: Vega and Kaito idle/run/hold/throw; Roxy and Brick idle/run/hold. The rest falls back to the interim pose with procedural motion.
- ✅ Courts: all 4 arenas. ✅ Backdrops: Neon Pier, Laser Lagoon. ❌ Sunset and Orbital backdrops came back portrait: re-queued.
- Pipeline: the slicer now splits overlapping figures (`--expect`), strips floor lines, and drops neighbour slivers. The renderer hides the 3D disc when the hold art shows it and tones painted courts down.
- **batch04 READY:** Roxy/Brick throw, dash/lob/block/knock/win/lose for all 4, and 2 landscape backdrops (28 jobs).
- Next after batch04: batch05 = portraits and super cut-ins.

## Pending art batches (quota exhausted; resume any time)
- batch02 + batch03: generated via Flow and reviewed ✅
- Resume: tell the Antigravity agent "Follow ANTIGRAVITY_HANDOFF.md (Flow mode if needed). Do batch02 and batch03."

## Phase 3c: Progression ✅
- [x] 4 attributes (SPEED, POWER, TECHNIQUE, REFLEX), +5 levels each (~+15%), applied in **VS CPU only** (2P uses base stats)
- [x] 18 achievements per character (24 pts; maxing costs 20), tracked by `src/meta/tracker.ts`, saved on-device (`localStorage`, key `discriot2084.profile.v1`)
- [x] FIGHTER UPGRADES screen (mode menu + "SPEND POINTS" on results), LV badges and bonus bars on character select, unlock panel on results
- [x] Tests: `src/meta/progress.test.ts`
- [ ] Later: cloud save when online play lands; optional per-achievement toast mid-match

## Phase 4: Integration and polish
- [ ] Tune sprite height/anchor per character after the real atlases land
- [ ] Re-screenshot every arena × character combo and do the director review pass
- [x] Balance pass 1: see `BALANCE.md` (harness `src/sim/balance.test.ts`). Characters at 45–55%, supers 34% conversion, curves 31%.
- [x] Rules aligned with the original WJ (30 s sets, tied sets, sudden death, post-catch power shot, comeback window, reversals). See BALANCE.md pass 2.
- [ ] Future arena idea: a court with bounce barriers (the original had some)
- [ ] Human play-test: is Easy beatable by a first-timer? Do supers feel strong enough?
- [ ] Performance check on mobile (target 60 fps; drop bloom resolution if needed)
- [x] Production build (`npm run build`, which also writes `public/assets/manifest.json`)
- [x] Playable link (private Claude artifact): https://claude.ai/artifact/AqhyW8e7KXJJEYVT5a2grU. To update: `npm run build`, then republish `dist/index.html` + `dist/assets/**` to that URL.

## Phase 5: Stretch
- [ ] More arenas / characters
- [ ] Online play (rollback netcode over WebRTC; the sim is already deterministic)

## Session log
- **S1 (2026-09-28):** Research + plan. Built the full engine, AI, renderer, audio, menus, mobile, pipeline and tests. Commits `ffaf872`, `74539f3`. The key was provided but image quota is 0 (billing needed; the subscription does not cover API keys). Created the Antigravity bridge plus batch01 (style test + 4 ref sheets). Created the repo and pushed to `main`. Added 2 arenas + cut-ins (code done), queued batch02 (arenas). **Next: wait for the Antigravity agent to push batch01/02, then review.**

# Restart plan: freemium roster expansion (paused 2026-10-16)

The owner wants a **free-to-play** game where people can pay to unlock fighters. Before release, the
game should be polished and have more fighters, more supers and **multiplayer**. Decisions so far:
- **Pricing:** 4 free fighters. The other fighters unlock by playing, or instantly by purchase, singly or as a "Full Roster" bundle. No ads.
- **Roster:** +4 fighters (8 total): Nova Kain (speed), Diesel Reyes (power), Saki Vance (technique), Zara Volkov (defense).
- **Supers:** 3 per fighter: A = super 1, up/down + A = super 2, B = super lob.
- **First polish priority:** game feel and balance.

## Done (committed as WIP)
- The 8-fighter roster and all 24 supers are in the sim (`src/sim/characters.ts`). New flight paths: spiral, decoy, rush, orbit, stop-and-go, plus freeze/knockback params. Lob supers: bounce, corner, quake.
- Cut-ins name the specific super; the select screen lists all three; the renderer draws decoy discs and the icy tint.
- New fighters use procedural placeholder art until Flow art arrives.
- `tools/gen-assets/queue/batch06.md` holds the Flow prompts for the 4 new fighters. The owner can generate these at any time.
- A test confirms every fighter's 3 supers fire and resolve.

## Update 2026-10-16 (published as v32)
- **New fighters' art:** from the owner's Flow album (inbox/batch06). All approved and in the game.
  - Saki: complete except run.
  - Nova, Diesel, Zara: idle, hold, throw, knock and lose; Nova also has win.
  - Anything missing falls back to the reference pose with procedural motion.
- **Missing clips:** made from the single-figure start images in `tools/gen-assets/video_starts/<id>_start.png`.
  - Nova: B (dive/lob/block), R (run).
  - Diesel: B, D? (has a kneel from C), win (victory without losing the shirt), R.
  - Saki: R.
  - Zara: B, D, win, R.
- **Balance (hard vs hard CPU, 640 matches):**
  - Overall: vega 64 · kaito 54 · roxy 41 · brick 53 · nova 51 · diesel 44 · saki 44 · zara 51.
  - Super success: most supers score 15–60%. Still out of range:
    - Vega's spiral (63%, too strong).
    - The rush supers (Nova ROLLER RUSH 9%, Roxy SAMBA SURGE 9%).
    - The bounce lobs (Vega, Nova, Saki: 2–6%).
  - Fixed: quake knockdowns no longer hand the disc to the knocked player. The CPU stands off super-lob slams.

## Balance: DONE (2026-10-16 04:30 session)
- Win rates (768 hard-vs-hard CPU matches): vega 43 · kaito 55 · roxy 50 · brick 48 · nova 51 · diesel 50 · saki 48 · zara 43.
- All 24 supers score between 21% and 79%.
- Changes:
  - Rush supers swerve toward the open corner at the burst; bouncing super lobs end in a corner skid.
  - The CPU positions smartly against super lobs.
  - Stat nudges.

## Game feel: DONE (published as v33)
- Input buffering: A/B taps made during a catch freeze-frame or up to 6 frames early are kept, not dropped. Regression test added.
- Catch "pop": the catcher's sprite squashes and springs back; bigger on super catches. This adds to the existing shake, particles and hit-stop.
- Easy CPU made weaker: slower reactions, more aim error, no supersonic shots, rarely dashes.
- Owner to check on iPhone: does Easy now feel winnable?

## Arena rules + contrast (2026-10-21, v40)
- `src/sim/courts.ts` holds each arena's goal wall and bumpers.
  - Unchanged: Sunset Strip and Neon Pier (classic 3-5-3, no bumpers).
  - Laser Lagoon: 5 in the corners (|z| > 3.1), 3 in the middle, two posts on the net line.
  - Orbital Cabana: a 3-5-3-5-3 wall and four posts at (±1.8, ±2.0).
- Bumpers kick a shot into a new lane, never back at the thrower; supers smash through and lobs fly over. The CPU predicts deflections.
- Tuned so a bumped shot scores about as often as a normal one (11-13% vs 14%). The first version let reversed shots score 41-54%.
- Fighters: a shader ink outline (atlas frames padded 7 px), +contrast and saturation, kept under the bloom threshold, and a faint dark halo.
- Music: each arena already had its own track (verified). If iOS refuses the track change, it now starts on the next tap.

## Hype pass (2026-10-20, v38)
- `src/ui/hype.ts` (tested in `hype.test.ts`): call-outs and a rally counter. Pure presentation; it never changes the game.
  - Rally counter under the clock, plus 6-HIT COMBO / ON FIRE and COMBO BREAKER.
  - SET POINT and MATCH POINT at the serve.
  - FINAL 10 SECONDS, then the announcer counts 3-2-1 and calls TIME.
  - Streaks ("3 IN A ROW", "UNSTOPPABLE"), COMEBACK, FLAWLESS.
  - Slow-motion punch-in on set- or match-winning goals; offline only, since online both phones must keep pace.
- New Kenney announcer clips: combo, combo breaker, final round, 3/2/1, time, flawless victory, it's a tie, player 1/2. The deciding set is announced as "FINAL ROUND".
- Dev play-testing: `?quick=1&auto=1` lets a Hard CPU play P1.

## Multiplayer (2026-10-16)
Owner chose: **both** local and online · **free tier only** · **friend room codes**.
- **Same-device 2P on touch:** DONE (v34). 2 PLAYER VERSUS → SHARE THIS SCREEN gives each player a stick and A/B on their half of the screen; USE A CONTROLLER is the old flow.
- **Online versus:** BUILT and tested locally (unit tests plus two browser tabs through the real relay in `wrangler dev`). It still needs the relay deployed.
  - Netcode: rollback (`src/net/rollback.ts`), 2-frame input delay, up to 10 frames of rollback, and time sync. The host sends a state snapshot every second so iPhone and Android can't drift apart.
  - Relay: `server/`, a Cloudflare Worker plus Durable Object, free plan. About 180 matches a day free.
  - Menu: ONLINE VERSUS → CREATE ROOM (shows a code) / JOIN ROOM (type the code). Each player picks a fighter; the host picks the arena. Rematch needs both votes; there's an "opponent left" screen.
  - **Owner to-do:** follow `server/README.md`. Make a free Cloudflare account, `npx wrangler login`, `npx wrangler deploy`, then send Claude the workers.dev URL. Claude then builds with `VITE_NET_URL` and republishes.
  - To check once deployed: whether the Claude artifact page may open a WebSocket to workers.dev. The iOS/Android apps can regardless.

## Next, in order
1. ~~**Finish balance**~~ (done; history below). Run `npx vitest run`, then `BALANCE=1 BALANCE_N=10 npx vitest run src/sim/balance.test.ts --silent=false -t "character matrix"`.
   - Before the last round of fixes: Vega won 74% (spiral and orbit too strong); Kaito 40% and Zara 43% were weak.
   - Permafrost, decoy and rush supers almost never scored, and super lobs scored 0%.
   - Fixes just applied, not yet measured: weaker spiral and orbit, faster Permafrost, the CPU gets fooled by decoys, rush aims at the open corner, and super-lob slams can't be caught.
   - Target: every fighter at 42–58% overall; every super scoring 15–45%.
2. ~~**Game feel pass:**~~ (done, v33) hit-stop, shake, input buffering, touch controls, and an easier Easy CPU on iPhone.
3. ~~**Multiplayer**~~ (built; see above; relay deploy pending). Recommended path, as a quick decision for the owner:
   - (a) local same-device 2P on iPad/phone;
   - (b) **online versus**. The sim is deterministic at 60 Hz, which suits rollback netcode: a small relay/WebRTC server, with Game Center / Play Games matchmaking later.
   - Ask whether online play needs ranked/friends, and whether the owner will pay for a server (about $5–20/month).
4. **Unlocks + purchases:** profile flags for unlocked fighters, unlock-by-play goals, purchase hooks. Native store integration via RevenueCat or StoreKit/Play Billing in the Capacitor app.
   - Because it adds in-app purchases, update `tools/store/LISTING.md` (in-app purchases: yes) and the privacy answers.
5. **Integrate the new fighters' Flow art** when the owner shares it (same pipeline as Roxy and Brick).
6. Republish the playable build (https://claude.ai/artifact/AqhyW8e7KXJJEYVT5a2grU), update `PROJECT_MEMORY.md`, commit and push.

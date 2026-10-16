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

## Next, in order
1. **Finish balance** (in progress). Run `npx vitest run`, then `BALANCE=1 BALANCE_N=10 npx vitest run src/sim/balance.test.ts --silent=false -t "character matrix"`.
   - Before the last round of fixes: Vega won 74% (spiral and orbit too strong); Kaito 40% and Zara 43% were weak.
   - Permafrost, decoy and rush supers almost never scored, and super lobs scored 0%.
   - Fixes just applied, not yet measured: weaker spiral and orbit, faster Permafrost, the CPU gets fooled by decoys, rush aims at the open corner, and super-lob slams can't be caught.
   - Target: every fighter at 42–58% overall; every super scoring 15–45%.
2. **Game feel pass:** hit-stop, shake, input buffering, touch controls, and an easier Easy CPU on iPhone.
3. **Multiplayer** (new request). Recommended path, as a quick decision for the owner:
   - (a) local same-device 2P on iPad/phone;
   - (b) **online versus**. The sim is deterministic at 60 Hz, which suits rollback netcode: a small relay/WebRTC server, with Game Center / Play Games matchmaking later.
   - Ask whether online play needs ranked/friends, and whether the owner will pay for a server (about $5–20/month).
4. **Unlocks + purchases:** profile flags for unlocked fighters, unlock-by-play goals, purchase hooks. Native store integration via RevenueCat or StoreKit/Play Billing in the Capacitor app.
   - Because it adds in-app purchases, update `tools/store/LISTING.md` (in-app purchases: yes) and the privacy answers.
5. **Integrate the new fighters' Flow art** when the owner shares it (same pipeline as Roxy and Brick).
6. Republish the playable build (https://claude.ai/artifact/AqhyW8e7KXJJEYVT5a2grU), update `PROJECT_MEMORY.md`, commit and push.

# batch01: director review

Generated with Nano Banana 2 at 1K (the queue asked for Pro at 2K). Brick has 1 of 3 variants (quota).

## Verdicts
| Job | Pick | Verdict | Notes |
|---|---|---|---|
| 1.1 Style key art | **v2** | ✅ approved as style reference | Best energy (charged disc, crowd, composition). v3 rejected: stray text "2084" and a sign. The look is western pop-comic, close to Windjammers 2 and not the smooth-anime target. **Style direction is pending the user's decision.** |
| 1.2 Vega | **v3** | ✅ design approved | Biggest 80s hair, correct gloves, leg warmers, visor and tattoo. Pure green bg. v1 was flat; v2's 3/4 view barely turned. |
| 1.3 Kaito | **v1** | ✅ design approved | Only variant where the cyber arm is consistently his LEFT (visible when facing right) in every view. v2: wrong arm. v3: side view lost the cyber arm and the bg is off-green (#04D02D). |
| 1.4 Roxy | **v3** | ✅ design approved, with a lock | Tattoo placement varies between views. **Locking it to her LEFT arm** (visible when facing right). v2 rejected: side view is missing an arm (anatomy). |
| 1.5 Brick | **v1** | ✅ design approved | Deviation: full short beard plus mustache instead of a handlebar only. Accepted; it reads better. The chrome pad is consistently on his left. |

## Pipeline validation (on the real outputs)
- `process.py key`: ✅ clean edges, no green fringe on hair, chrome or skin. It also tolerates off-green (#04D02D).
- `process.py slice`: ❌ merged close figures → **rewritten** to empty-row/column projection. It now returns 4/4 frames on every sheet.
- `pack` plus an in-game test: ✅ renders correctly. **Finding: sprites read small and stiff at the gameplay camera.** Raise PLAYER_HEIGHT from 2.35 to about 3.0 when the animations land, and require wide, dynamic action poses in the animation prompts.

## Brief updates locked
- Kaito: cyber arm = LEFT. Roxy: lightning tattoos = LEFT arm. Brick: short blond beard plus mustache.

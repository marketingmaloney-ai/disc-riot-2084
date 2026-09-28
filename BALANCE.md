# Balance report (pass 1)

Measured with the headless harness: `BALANCE=1 BALANCE_N=25 npx vitest run src/sim/balance.test.ts --silent=false`.
It plays deterministic CPU-vs-CPU matches (hard vs hard, both court sides, distinct seeds per matchup). 400+ matches take about 5 s.

## Before → after

| Metric | Before | After |
|---|---|---|
| Character overall win % | Roxy **3%** · Vega 47% · Brick 67% · Kaito **75%** | Vega 55% · Roxy 49% · Kaito 45% · Brick 45% |
| Worst matchup | 0% / 100% | 36% / 64% |
| Points from supers | ~all (normal throws never scored) | ~25%; curves ~30% and power shots ~35% carry the rest |
| Super conversion | 56% at 17/match | 34% at 8/match |
| Curve shot conversion | 0% | 31% |
| Power shot conversion | 2% | 16% |
| Point length | 11.5 s, 10 throws | 8.2 s, median 6 throws |
| Hard beats Normal | 46% (no difference) | 97% |
| 5-pt share by arena | 8–30% | 7% (Orbital) → 21% (Lagoon) |

## What changed and why
- **Super charging:** only your *own* toss/block charges a super. Catching the enemy's lob no longer hands the defender a free super, which had been the cause of super spam.
- **Faster game:** discs are ~25% faster, the catch radius is 0.75 → 0.62, and the power-shot multiplier is 1.35 → 1.45.
- **Curve shots** now swing out to the input side and break hard to the **opposite goal corner**. They used to end at the center, where the defender stands.
- **CPU reads like a human:** intercept error grows with shot speed, curve and supers, and curves are read late (the CPU assumes straight flight until the bend is visible). It defends the *center line* of oscillating supers.
- **Supers:**
  - Vega's LASER SURF wave: amp 2.55, freq 8.
  - Kaito's GLITCH STORM zigzag: wider, plus a diagonal drift.
  - Roxy's THUNDER KISS: now a lightning-bolt kink mid-flight (it was a plain straight fireball).
  - Brick's METEOR SLAM: it was unblockable (airborne until the goal line). It now rises, slams down just past the net and **ricochets away from the defender** along the ground.
  - Supers get a 1.12× catch window, since they're big and glowing.
- **Character stats (speed / power / curve):**

  | Character | Speed | Power | Curve |
  |---|---|---|---|
  | Vega | 7.0 | 22.7 | 1.0 |
  | Kaito | 8.2 | 21.3 | 1.35 |
  | Roxy | 7.4 | 23.0 | 0.85 |
  | Brick | 6.4 | 24.3 | 0.75 |

- **5-point zones** are wider on every arena, keeping their order: Orbital 1.1 < Pier 1.35 < Sunset 1.65 < Lagoon 2.05.
- **CPU levels:** easy reaction 15 ticks / error 0.75 m; normal 10 / 0.45; hard 6 / 0.24.

## Known limits
- CPU-vs-CPU can't measure how the game *feels* to a human. The difficulty gaps look extreme in bot-vs-bot play (a small per-point edge compounds over ~40 points), so they still need a human sanity check: Easy should be beatable by a first-timer.
- All tuning constants live in `src/sim/constants.ts` and `src/sim/characters.ts`. Re-run the harness after any change.

# DISC RIOT 2084

A Windjammers-style 1v1 disc-throwing arcade game with a 2.5D Three.js stage and an 80s cyberpunk-beach theme.

```bash
npm install
npm run dev        # http://localhost:5173  (add ?quick=1 to jump straight into a VS CPU match)
npm test           # headless deterministic sim tests (full CPU matches)
npm run build
```

## Controls
| | Keyboard (solo) | 2P keyboard | Gamepad | Touch |
|---|---|---|---|---|
| Move | WASD / arrows | WASD · arrows | stick / d-pad | left-side joystick |
| A: throw, dash, power shot | J / Space | J · `.` | A/X/RB | A button |
| B: lob, block/toss | K | K · `/` | B/Y/LB | B button |
| Pause | Esc / P | | Start | II button |

## Moves
- **Curve shot:** press ↓ (or ↑), then toward your opponent, then A.
- **Power shot:** tap A just before, or right as, the disc reaches you. The timing window widens when you're 4+ points behind in a set.
- **Reversal:** tap A just before a super reaches you to fire your own super straight back.
- **Lob:** press B while holding the disc. The longer you wait, the shorter it lands.
- **Supers:** press B as a disc arrives to pop it up (block), or press ← (away from your opponent) + B to toss it yourself. Stand on the ring when it lands to charge your super, then throw.

## Progression
In VS CPU, each fighter earns achievement points that are spent on SPEED / POWER / TECHNIQUE / REFLEX (FIGHTER UPGRADES in the mode menu). 2-player versus always uses base stats. Progress is saved in the browser.

## Layout
- `src/sim`: deterministic 60 Hz game logic. No Three.js; unit-tested.
- `src/ai`: CPU opponent.
- `src/render`: Three.js arena, sprites, VFX and bloom.
- `src/audio`: synthesized SFX and synthwave music.
- `src/ui`: menus, HUD and the upgrade screen.
- `src/meta`: progression (profiles, achievements, match tracker).
- `tools/gen-assets`: Nano Banana generation and sprite post-processing (see `ART_BRIEF.md` and `AGENT_ART_TASK.md`).

Art drops into `public/assets/characters/<id>/{atlas.png,atlas.json,portrait.png}` and `public/assets/arenas/<id>/{court.png,backdrop.png}`. The game picks it up automatically and falls back to procedural stand-ins until then.

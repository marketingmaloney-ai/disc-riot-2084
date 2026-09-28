# Art subagent task spec

The creative director session spawns one subagent per art piece. Each subagent follows this spec and returns preview images for approval. **Do not integrate an asset into `public/assets/` until the director approves it.**

## Tools
- Generate: `node tools/gen-assets/gen.mjs --style --out tools/gen-assets/raw/<asset>/<name>.png --model <id> --aspect <r> --size <s> [--ref ...] --prompt "..."`
  - `gemini-3-pro-image` for reference sheets, portraits and backdrops.
  - `gemini-3.1-flash-image` for animation sheets, always with `--ref` pointing to the approved reference sheet.
- Key out the background: `python3 tools/gen-assets/process.py key IN.png OUT_keyed.png`
- Slice: `python3 tools/gen-assets/process.py slice OUT_keyed.png frames_dir --expect N`
- Preview: `python3 tools/gen-assets/process.py sheet OUT_keyed.png preview.jpg`
- Pack (after approval): `python3 tools/gen-assets/process.py pack manifest.json public/assets/characters/<id>/atlas.png`

## Deliverables per task type

### A. Character reference sheet (`raw/<id>/ref.png`)
Use 16:9 at 2K. Show front view, 3/4 view facing right, side view facing right, and back view of the same character at the same scale, on a flat #00FF00 background, plus a small color-swatch row. Follow ART_BRIEF.md exactly.

### B. Portrait (`public/assets/characters/<id>/portrait.png`, after approval)
Use 3:4 at 2K. A waist-up character-select portrait in a dynamic pin-up sports pose, with a synthwave gradient background (sunset pink to violet with a grid), in the style of a Windjammers 2 or KOF XIII select-screen portrait.

### C. Animation sheets (`raw/<id>/anim_<name>.png`)
One animation per image, with the frames in a single row, facing right, full body, on flat #00FF00. Use the aspect that fits the frame count: 3:2 for 2–3 frames, 21:9 for 4–6 frames. The prompt must list what happens in each frame. Every frame must keep identical outfit, colors and proportions matching the reference.

### D. Arena court (`raw/arenas/<id>/court.png` → `public/assets/arenas/<id>/court.png`)
Use 16:9 at 4K. A **straight top-down orthographic** view of the court surface only. No perspective, people, net, text or goal numbers. The long axis is horizontal and the center line is vertical at exact center. The court boundary is inset about 1.5% from the edges. It must stay readable under sprites: medium value, not busy in the middle of each half.

### E. Arena backdrop (`public/assets/arenas/<id>/backdrop.png`)
Use 21:9 at 4K. The scene seen behind the far wall: stands with a stylized neon crowd in the lower third, then skyline, ocean, sunset or night sky. The lower 55% of the image is what shows in-game, so put the interesting content there.

## Self-QA before returning (reject and regenerate yourself up to 4 times)
- Anatomy is correct: 5 fingers, correct limbs, and a consistent face.
- The character matches the reference: outfit, hair, colors and body type.
- The background is pure green with no shadows or floor, and keying leaves no green fringe (check the preview).
- Every character is clearly adult and the image is non-explicit.

## Return to the director
The paths of the best candidate(s) and the preview JPGs, the exact prompt used, and any known flaws.

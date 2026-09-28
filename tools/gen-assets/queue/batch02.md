# batch02: arena courts and backdrops (4 arenas)
STATUS: READY

Variants per job: **2**. These jobs are independent of batch01 and can run right after it.
Model for all: Nano Banana Pro (`gemini-3-pro-image`). No refs.

**Courts** are straight top-down, orthographic floor textures that the game lays flat on the 3D court. **Backdrops** are what the camera sees behind the far wall; only the **lower ~55%** of each image is visible in-game.

---

## Job 2.1: SUNSET STRIP court
- aspect: 16:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/sunset/court`
```
Game texture: a perfectly top-down orthographic view (camera pointing straight down, zero perspective, no vanishing point) of a single rectangular sports court surface for a Windjammers-style flying-disc game, filling the entire frame edge to edge. Theme: Miami beach at golden hour in 2084, 80s synthwave. Surface: smooth warm peach-orange sand with subtle fine grain and soft long palm-tree shadows cast from the left. Court markings in glowing neon paint: hot-pink (#ff2e9a) boundary lines inset slightly from the image edges, a bright white center line running exactly vertically through the middle of the image, thin dashed cyan lines a short distance either side of the center line, and a large quarter-circle arc in pink at the middle of each short (left and right) end. At the exact center, a large faded painted emblem of a striped synthwave sun. Keep both halves otherwise clean and uncluttered so characters stay readable on top. Hand-painted anime background art quality, clean, crisp. No people, no net, no objects, no walls, no text, no numbers, no logos.
```

## Job 2.2: SUNSET STRIP backdrop
- aspect: 21:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/sunset/backdrop`
```
Wide background painting for a 2D arcade sports game, anime background art quality like Windjammers 2 and King of Fighters XIII stages. Eye-level view looking across a beach stadium in Miami, 2084, at sunset, 80s synthwave cyberpunk. Lower third: packed low bleacher stands full of a stylized cheering crowd in silhouette-and-rim-light style waving pink, cyan and yellow glow sticks, with chrome railings and a glowing neon sign strip. Middle: a line of tall palm trees and retro-futurist art-deco beach hotels with pink and cyan neon trim, a boardwalk. Upper half: a gigantic striped synthwave sun sinking into an ocean that has a glowing neon grid on its surface, and a gradient sky from deep violet at the top through magenta to orange at the horizon. Vibrant, readable, saturated. No text, no logos, no watermark.
```

## Job 2.3: NEON PIER court
- aspect: 16:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/pier/court`
```
Game texture: a perfectly top-down orthographic view (camera pointing straight down, zero perspective) of a single rectangular sports court surface for a Windjammers-style flying-disc game, filling the entire frame edge to edge. Theme: a court built on a wet wooden boardwalk pier in Neo-Tokyo Bay at night, 2084. Surface: dark violet-blue wooden planks running horizontally, glossy and wet with soft reflections of magenta and cyan neon light. Court markings as glowing inlaid neon tubes: cyan (#19e6ff) boundary lines inset slightly from the image edges, a white center line running exactly vertically through the middle, thin dashed magenta lines just either side of the center line, and a large quarter-circle arc at the middle of each short end. At the exact center, a subtle glowing circular emblem. Keep both halves clean and uncluttered. Hand-painted anime background art quality. No people, no net, no objects, no walls, no text, no numbers, no logos.
```

## Job 2.4: NEON PIER backdrop
- aspect: 21:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/pier/backdrop`
```
Wide background painting for a 2D arcade sports game, anime background art quality like Windjammers 2 and King of Fighters XIII stages. Eye-level view from a night-time pier stadium in Neo-Tokyo Bay, 2084, cyberpunk with 80s retro flair. Lower third: packed bleachers with a stylized cheering crowd in silhouette with rim light, waving cyan and magenta glow sticks, chrome railings, a neon sign strip. Middle: the dark bay water reflecting a dense skyline of skyscrapers covered in giant holographic billboards and neon kanji-style shapes (abstract, not readable text), paper-lantern strings, a glowing ferris wheel. Upper half: deep indigo night sky with light haze, stars and a crescent moon. Vibrant cyan, magenta and violet palette. No readable text, no logos, no watermark.
```

## Job 2.5: LASER LAGOON court
- aspect: 16:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/lagoon/court`
```
Game texture: a perfectly top-down orthographic view (camera pointing straight down, zero perspective) of a single rectangular sports court surface for a Windjammers-style flying-disc game, filling the entire frame edge to edge. Theme: Venice Beach boardwalk skatepark court in 2084, bright sunny afternoon, 80s retro-futurism. Surface: smooth pale-pink and cream painted concrete with subtle speckle, with a few bold faded graffiti-style geometric shapes (triangles, zigzags, squiggles in 80s Memphis design style) in pastel teal, pink and yellow near the four corners only. Court markings: lime-green (#b6ff2e) boundary lines inset slightly from the image edges, a white center line running exactly vertically through the middle, dashed hot-pink lines just either side of the center line, and a large quarter-circle arc at the middle of each short end. Keep the main play areas clean. Hand-painted anime background art quality. No people, no net, no objects, no walls, no text, no numbers, no logos.
```

## Job 2.6: LASER LAGOON backdrop
- aspect: 21:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/lagoon/backdrop`
```
Wide background painting for a 2D arcade sports game, anime background art quality like Windjammers 2 and King of Fighters XIII stages. Eye-level view of Venice Beach boardwalk in 2084 on a bright sunny afternoon, 80s retro-futurism with a cyberpunk touch. Lower third: low bleacher stands with a stylized cheering crowd (rim-lit silhouettes, some roller skaters, boomboxes, waving lime and pink foam fingers), chrome railings, a neon sign strip. Middle: a colorful boardwalk of retro arcade storefronts and surf shops with pastel Memphis-pattern facades and neon signs (abstract shapes, no readable text), a skate bowl, tall palm trees, a holographic dolphin leaping above the water. Upper half: turquoise ocean with a laser-light show beaming from a floating stage, a pastel sky from bright blue to pink with puffy clouds. Vibrant, cheerful, saturated. No readable text, no logos, no watermark.
```

## Job 2.7: ORBITAL CABANA court
- aspect: 16:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/orbital/court`
```
Game texture: a perfectly top-down orthographic view (camera pointing straight down, zero perspective) of a single rectangular sports court surface for a Windjammers-style flying-disc game, filling the entire frame edge to edge. Theme: the pool-deck court of a luxury space resort in low Earth orbit, 2084, 80s retro sci-fi. Surface: brushed pale chrome and white deck panels in a hexagonal pattern with thin glowing seams, a few small circular porthole-windows near the corners showing starfield. Court markings as glowing light strips: yellow (#ffe600) boundary lines inset slightly from the image edges, a white center line running exactly vertically through the middle, dashed cyan lines just either side of the center line, and a large quarter-circle arc at the middle of each short end. Keep both halves clean. Hand-painted anime background art quality. No people, no net, no objects, no walls, no text, no numbers, no logos.
```

## Job 2.8: ORBITAL CABANA backdrop
- aspect: 21:9 · resolution: 4K · output: `tools/gen-assets/raw/arenas/orbital/backdrop`
```
Wide background painting for a 2D arcade sports game, anime background art quality like Windjammers 2 and King of Fighters XIII stages. Eye-level view inside a luxury orbital space-resort stadium in 2084, 80s retro sci-fi glamour. Lower third: curved bleacher stands with a stylized cheering crowd in rim-lit silhouette (some in retro space suits with bubble helmets) waving yellow and cyan glow sticks, chrome railings, a neon sign strip. Middle: an infinity pool with glowing turquoise water and inflatable pool floats, tiki cabanas made of chrome, potted holographic palm trees. Upper half: a huge curved glass dome through which planet Earth fills the view, glowing blue with swirling clouds and a bright atmospheric rim, a ring-shaped space station arc and stars. Vibrant, glamorous. No readable text, no logos, no watermark.
```

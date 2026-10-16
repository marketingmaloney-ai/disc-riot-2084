// Store screenshots with captions: node tools/store/render_shots.mjs
// App Store 6.9" iPhone landscape 2868x1320; Google Play 1920x1080 (16:9).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = [
  ['1_power.png', 'ARCADE DISC BATTLES', 'THROW · CURVE · SMASH'],
  ['2_fighters.png', '4 FIGHTERS · 4 SUPERS', 'LEVEL UP YOUR FAVORITE'],
  ['3_curve.png', 'CURVE IT. BANK IT.', 'TRICK SHOTS OFF THE WALLS'],
  ['4_score.png', 'HIT THE 5-POINT ZONE', 'FIRST TO 12 TAKES THE SET'],
  ['5_arenas.png', '4 NEON ARENAS', 'EACH WITH ITS OWN SOUNDTRACK'],
  ['6_title.png', 'RETRO 2084 ARCADE ACTION', 'VS CPU · 2 PLAYERS · CONTROLLERS'],
];
const b = await chromium.launch();
for (const [store, w, h, mode] of [['appstore', 2868, 1320, 'overlay'], ['play', 1920, 1080, 'band']]) {
  const dir = path.join(here, 'out', store);
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, t, s] of shots) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    // the fighter-select screen has its own heading: no overlay caption on the full-bleed App Store version
    const cap = mode === 'overlay' && f.startsWith('2_') ? '' : t;
    const q = new URLSearchParams({ w, h, mode, img: `shots/${f.replace('.png', '.jpg')}`, t: cap, s });
    await p.goto(`file://${path.join(here, 'shot.html')}?${q}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(dir, f.replace('.png', '.jpg')), type: 'jpeg', quality: 93 });
    await p.close();
  }
  console.log('wrote', store);
}
await b.close();

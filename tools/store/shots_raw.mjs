// Captures candidate store screenshots from the dev server (npx vite --port 5173).
// node tools/store/shots_raw.mjs OUTDIR  -> many 2868x1320 PNGs to pick from.
import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 956, height: 440 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const pairs = [['vega', 'kaito', 0], ['roxy', 'brick', 1], ['kaito', 'roxy', 2], ['brick', 'vega', 3]];
for (const [p1, p2, arena] of pairs) {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:5173/?quick=1&p1=${p1}&p2=${p2}&arena=${arena}`);
  await p.waitForTimeout(5000);
  for (let i = 0; i < 14; i++) {
    // play a little so there's action: move + throw
    await p.keyboard.down(i % 2 ? 'KeyW' : 'KeyS'); await p.waitForTimeout(250); await p.keyboard.up(i % 2 ? 'KeyW' : 'KeyS');
    if (i % 3 === 0) await p.keyboard.press('KeyJ');
    await p.waitForTimeout(450);
    await p.screenshot({ path: `${out}/a${arena}_${String(i).padStart(2, '0')}.png` });
  }
  await p.close();
}
// menus
const p = await ctx.newPage();
await p.goto('http://localhost:5173/'); await p.waitForTimeout(3500);
await p.screenshot({ path: `${out}/m_title.png` });
await p.locator('.screen').first().tap(); await p.waitForTimeout(500);
await p.getByText('VS CPU', { exact: true }).tap(); await p.waitForTimeout(300);
await p.getByText('NORMAL', { exact: true }).tap(); await p.waitForTimeout(1800);
await p.screenshot({ path: `${out}/m_select.png` });
await b.close();

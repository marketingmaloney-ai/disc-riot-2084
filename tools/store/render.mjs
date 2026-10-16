// Renders store art from art.html: node tools/store/render.mjs  (needs Playwright + Chromium)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });
const jobs = [
  ['icon', 1024, 1024, 'icon-1024.png'],
  ['splash', 2732, 2732, 'splash-2732.png'],
  ['feature', 1024, 500, 'play-feature-1024x500.png'],
];
const b = await chromium.launch();
for (const [kind, w, h, name] of jobs) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`file://${path.join(here, 'art.html')}?kind=${kind}&w=${w}&h=${h}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, name), omitBackground: false });
  await p.close();
  console.log('wrote', name);
}
await b.close();

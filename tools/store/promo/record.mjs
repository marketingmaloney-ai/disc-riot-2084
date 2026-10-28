// Promo video recorder. Run with the dev server up (`npx vite --port 5173` in the repo root).
//   node record.mjs page <url> <outDir> [fps]            -> frames of a page exposing window.render(t) / DURATION
//   node record.mjs game <url> <outDir> <seconds> [fps]  -> gameplay frames + events.json
// Gameplay runs on a virtual clock (performance.now + requestAnimationFrame are replaced), so every frame is an
// exact 1/fps step however slowly the headless browser renders. events.json lists what the game's audio was told
// to play, with times, so mix.py can rebuild the soundtrack (headless Chromium has no audio output to record).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [mode, url, outDir, a4, a5] = process.argv.slice(2);
const fps = Number((mode === 'page' ? a4 : a5) || 30);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
const shot = (i) => page.screenshot({ path: path.join(outDir, `f_${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });

if (mode === 'page') {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const dur = await page.evaluate(() => window.DURATION);
  const n = Math.round(dur * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / fps);
    await shot(i);
  }
  console.log(`${n} frames -> ${outDir}`);
} else {
  const seconds = Number(a4);
  await page.addInitScript(() => {
    let now = 0;
    let q = [];
    performance.now = () => now;
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__vstep = (ms) => { now += ms; const cbs = q; q = []; for (const cb of cbs) cb(now); };
    window.__vnow = () => now;
  });
  await page.goto(url);
  // let the page load (real time) while nudging the virtual clock so its startup frames run
  for (let i = 0; i < 400; i++) {
    const ready = await page.evaluate(() => { window.__vstep(16); const g = window.__game?.(); return !!g && !!window.__dbg && document.querySelector('#hud:not(.hidden)') !== null; });
    if (ready) break;
    await page.waitForTimeout(50);
  }
  // log everything the audio engine is asked to play
  await page.evaluate(() => {
    const log = (window.__evlog = []);
    const t0 = window.__vnow();
    const a = window.__dbg.audio;
    const at = () => (window.__vnow() - t0) / 1000;
    const he = a.handleEvents.bind(a);
    a.handleEvents = (ev, g) => {
      for (const e of ev) log.push({ t: at(), type: e.type, p: e.p, big: e.big, pts: e.pts, char: e.p !== undefined && g ? g.players[e.p].charId : undefined });
      return he(ev, g);
    };
    const co = a.callout.bind(a);
    a.callout = (name, when = 0) => { log.push({ t: at() + when, type: 'vo', name }); return co(name, when); };
    const ar = a.announceRound.bind(a);
    a.announceRound = (g) => { log.push({ t: at(), type: 'round', set: g.setNo, sd: g.suddenDeath, decider: g.sets[0] === 1 && g.sets[1] === 1 }); return ar(g); };
  });
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((ms) => window.__vstep(ms), 1000 / fps);
    await shot(i);
  }
  const events = await page.evaluate(() => window.__evlog);
  fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(events));
  console.log(`${n} frames, ${events.length} events -> ${outDir}`);
}
await browser.close();

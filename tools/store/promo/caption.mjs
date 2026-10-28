// node caption.mjs <out.png> "TITLE" "SUBTITLE"  -> transparent 1280x720 overlay from caption.html (dev server up)
import { chromium } from 'playwright';
const [out, t, s] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(`http://127.0.0.1:5173/tools/store/promo/caption.html?t=${encodeURIComponent(t)}&s=${encodeURIComponent(s)}`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({ path: out, omitBackground: true });
await b.close();

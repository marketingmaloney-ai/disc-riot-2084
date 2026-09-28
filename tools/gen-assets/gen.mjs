#!/usr/bin/env node
// Nano Banana (Gemini image) generator. Offline/build-time only — the API key never ships in the game.
//
// Usage:
//   GEMINI_API_KEY=... node tools/gen-assets/gen.mjs --out raw/vega_ref.png \
//     [--model gemini-3-pro-image] [--aspect 16:9] [--size 2K] \
//     [--ref style.png --ref vega_ref.png] (--prompt "..." | --prompt-file p.txt) [--style]
//
// --style prepends tools/gen-assets/prompts/style_bible.txt to the prompt.
// Writes the image plus a sidecar .json with the exact prompt/model/refs for reproducibility.
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.NODE_USE_ENV_PROXY && process.env.HTTPS_PROXY) {
  // Node's built-in fetch only honors HTTPS_PROXY with this flag; re-exec ourselves with it set.
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}

const args = process.argv.slice(2);
const opt = { refs: [], model: 'gemini-3.1-flash-image', aspect: '1:1', size: '2K', style: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  if (a === '--out') opt.out = next();
  else if (a === '--model') opt.model = next();
  else if (a === '--aspect') opt.aspect = next();
  else if (a === '--size') opt.size = next();
  else if (a === '--ref') opt.refs.push(next());
  else if (a === '--prompt') opt.prompt = next();
  else if (a === '--prompt-file') opt.prompt = fs.readFileSync(next(), 'utf8');
  else if (a === '--style') opt.style = true;
  else { console.error('Unknown arg', a); process.exit(2); }
}

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!key) { console.error('GEMINI_API_KEY is not set'); process.exit(3); }
if (!opt.out || !opt.prompt) { console.error('--out and --prompt/--prompt-file are required'); process.exit(2); }

const here = path.dirname(new URL(import.meta.url).pathname);
let prompt = opt.prompt.trim();
if (opt.style) prompt = fs.readFileSync(path.join(here, 'prompts/style_bible.txt'), 'utf8').trim() + '\n\n' + prompt;

const mime = (f) => (f.endsWith('.jpg') || f.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
const parts = [
  ...opt.refs.map((f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString('base64') } })),
  { text: prompt },
];

const body = {
  contents: [{ role: 'user', parts }],
  generationConfig: {
    responseModalities: ['IMAGE'],
    imageConfig: { aspectRatio: opt.aspect, imageSize: opt.size },
  },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/${opt.model}:generateContent`;
let lastErr;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 600)}`);
    const outParts = json.candidates?.[0]?.content?.parts ?? [];
    const img = outParts.find((p) => p.inlineData?.data);
    if (!img) {
      const txt = outParts.map((p) => p.text).filter(Boolean).join(' ');
      throw new Error(`No image returned. finishReason=${json.candidates?.[0]?.finishReason} text=${txt.slice(0, 400)} feedback=${JSON.stringify(json.promptFeedback ?? {})}`);
    }
    fs.mkdirSync(path.dirname(opt.out), { recursive: true });
    fs.writeFileSync(opt.out, Buffer.from(img.inlineData.data, 'base64'));
    fs.writeFileSync(opt.out.replace(/\.\w+$/, '') + '.gen.json', JSON.stringify({ model: opt.model, aspect: opt.aspect, size: opt.size, refs: opt.refs, prompt }, null, 2));
    console.log(`wrote ${opt.out} (${img.inlineData.mimeType})`);
    process.exit(0);
  } catch (e) {
    lastErr = e;
    console.error(`attempt ${attempt} failed: ${e.message}`);
    if (/No image returned|HTTP 4\d\d/.test(e.message) && !/HTTP 429/.test(e.message)) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}
console.error('FAILED:', lastErr?.message);
process.exit(1);

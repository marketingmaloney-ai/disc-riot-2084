// Writes public/assets/manifest.json listing every shipped asset, so the game knows which
// generated art exists without probing URLs (static hosts don't all answer HEAD requests).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/assets');
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== 'manifest.json') files.push('assets/' + path.relative(root, p).split(path.sep).join('/'));
  }
};
fs.mkdirSync(root, { recursive: true });
walk(root);
files.sort();
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ files }, null, 1));
console.log(`asset manifest: ${files.length} files`);

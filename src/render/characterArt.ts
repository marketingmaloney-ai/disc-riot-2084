import * as THREE from 'three';
import { charById, type CharacterDef } from '../sim/characters';

export interface AtlasMeta {
  cell: [number, number];
  cols: number;
  rows: number;
  anchorY: number;
  anims: Record<string, { row: number; frames: number; fps: number; loop: boolean }>;
}

export interface CharacterArt {
  texture: THREE.Texture;
  meta: AtlasMeta;
  portrait: string | null; // URL for UI
  generated: boolean;
}

export const ANIMS: [string, number, number, boolean][] = [
  ['idle', 4, 6, true],
  ['run', 6, 12, true],
  ['dash', 3, 14, false],
  ['hold', 2, 6, true],
  ['throw', 3, 18, false],
  ['lob', 2, 10, false],
  ['block', 2, 12, false],
  ['knock', 2, 10, false],
  ['win', 2, 3, true],
  ['lose', 2, 3, true],
];

const cache = new Map<string, Promise<CharacterArt>>();

export function loadCharacterArt(id: string): Promise<CharacterArt> {
  if (!cache.has(id)) cache.set(id, load(id));
  return cache.get(id)!;
}

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = r.headers.get('content-type') ?? '';
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

async function load(id: string): Promise<CharacterArt> {
  const base = `assets/characters/${id}/`;
  const portrait = (await exists(base + 'portrait.png')) ? base + 'portrait.png' : null;
  if (await exists(base + 'atlas.json')) {
    const meta = (await (await fetch(base + 'atlas.json')).json()) as AtlasMeta;
    const texture = await new THREE.TextureLoader().loadAsync(base + 'atlas.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, meta, portrait, generated: true };
  }
  return { ...placeholderAtlas(charById(id)), portrait, generated: false };
}

// ---------------------------------------------------------------------------
// Procedural stand-in art (used until Nano Banana sprites are approved).
// ---------------------------------------------------------------------------

interface Pose {
  bob: number; lean: number; crouch: number;
  armF: [number, number]; armB: [number, number];
  legF: [number, number]; legB: [number, number];
  disc?: [number, number] | null;
}

const P = (o: Partial<Pose>): Pose => ({
  bob: 0, lean: 0.05, crouch: 0,
  armF: [0.5, -0.6], armB: [-0.4, -0.5], legF: [0.2, 0.1], legB: [-0.15, 0.1], disc: null, ...o,
});

function poseFor(anim: string, f: number): Pose {
  const s = Math.sin((f / 6) * Math.PI * 2);
  switch (anim) {
    case 'idle': return P({ bob: f % 2 ? 3 : 0, crouch: 8 + (f % 2) * 4, armF: [0.9, -1.4], armB: [-0.6, -1.2], legF: [0.35, 0.4], legB: [-0.3, 0.4] });
    case 'run': return P({ lean: 0.25, bob: Math.abs(s) * 8, legF: [s * 0.9, 0.3 + Math.max(0, -s) * 1.2], legB: [-s * 0.9, 0.3 + Math.max(0, s) * 1.2], armF: [-s * 1.0, -1.3], armB: [s * 1.0, -1.3] });
    case 'dash': return P({ lean: 1.1, crouch: 60 - f * 5, legF: [1.3, 0.2], legB: [-1.0, 0.6], armF: [1.6, -0.2], armB: [-1.2, -0.3] });
    case 'hold': return P({ lean: -0.15, crouch: 12, armF: [-2.0, -0.8], armB: [0.8, -0.8], legF: [0.5, 0.3], legB: [-0.45, 0.3], disc: [-60, -40 + f * 2] });
    case 'throw': return P({ lean: 0.35 + f * 0.1, crouch: 10, armF: [0.4 + f * 0.9, -0.1], armB: [-1.2, -0.6], legF: [0.7, 0.2], legB: [-0.6, 0.5] });
    case 'lob': return P({ lean: -0.1, armF: [-3.0 + f * 0.8, -0.2], armB: [-0.4, -0.4], legF: [0.2, 0.1], legB: [-0.3, 0.2] });
    case 'block': return P({ crouch: 5, armF: [-2.6, -0.3], armB: [-2.3, -0.3], legF: [0.3, 0.2], legB: [-0.3, 0.2] });
    case 'knock': return P({ lean: -0.45 - f * 0.1, crouch: 18, armF: [1.2, -0.8], armB: [0.8, -0.8], legF: [0.6, 0.5], legB: [-0.1, 0.8], disc: [30, -10] });
    case 'win': return P({ bob: f * 4, armF: [-2.7, -0.2 - f * 0.2], armB: [-2.4, -0.3], legF: [0.3, 0.1], legB: [-0.3, 0.1] });
    case 'lose': return P({ lean: 0.5, crouch: 30, armF: [0.2, -0.2], armB: [0.1, -0.2], legF: [0.4, 0.8], legB: [-0.2, 0.8] });
  }
  return P({});
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

function drawFigure(g: CanvasRenderingContext2D, c: CharacterDef, pose: Pose, cw: number, ch: number) {
  const big = c.id === 'brick';
  const fem = c.id === 'vega' || c.id === 'roxy';
  const sc = big ? 1.08 : 1;
  const ink = '#1a0b2e';
  const ground = ch - 16;
  const hipY = ground - 128 * sc + pose.crouch + pose.bob;
  const hipX = cw / 2;
  const torsoLen = 96 * sc;
  const shX = hipX + Math.sin(pose.lean) * torsoLen;
  const shY = hipY - Math.cos(pose.lean) * torsoLen;

  const limb = (x: number, y: number, a1: number, a2: number, l1: number, l2: number, w: number, col: string, dark: boolean) => {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const ex = kx + Math.sin(a1 + a2) * l2, ey = ky + Math.cos(a1 + a2) * l2;
    const col2 = dark ? shade(col, 0.72) : col;
    for (const [lw, cc] of [[w + 7, ink], [w, col2]] as [number, string][]) {
      g.strokeStyle = cc;
      g.lineWidth = lw;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(kx, ky); g.lineTo(ex, ey); g.stroke();
    }
    return [ex, ey] as [number, number];
  };
  const leg = (p: [number, number], dark: boolean) => {
    const [ex, ey] = limb(hipX, hipY, p[0], -p[1] - p[0] * 0.2, 64 * sc, 62 * sc, big ? 28 : fem ? 20 : 22, c.colors.skin, dark);
    // shoe
    g.fillStyle = ink;
    g.beginPath(); g.ellipse(ex + 8, ey + 2, 19, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark ? shade(c.colors.secondary, 0.7) : c.id === 'kaito' ? c.colors.skin : '#f4f4ff';
    g.beginPath(); g.ellipse(ex + 8, ey, 15, 8, 0, 0, Math.PI * 2); g.fill();
  };
  const arm = (p: [number, number], dark: boolean) =>
    limb(shX, shY + 8, p[0], p[1], 50 * sc, 48 * sc, big ? 24 : 15, c.colors.skin, dark);

  // back limbs
  leg(pose.legB, true);
  arm(pose.armB, true);

  // torso (outfit)
  g.save();
  g.translate(hipX, hipY);
  g.rotate(pose.lean);
  const tw = (big ? 62 : fem ? 40 : 46) * sc;
  g.fillStyle = ink;
  roundRect(g, -tw / 2 - 4, -torsoLen - 6, tw + 8, torsoLen + 26, 18);
  g.fill();
  g.fillStyle = c.colors.skin;
  roundRect(g, -tw / 2, -torsoLen - 2, tw, torsoLen + 18, 16);
  g.fill();
  // outfit pieces
  g.fillStyle = c.colors.primary;
  if (c.id === 'vega') {
    roundRect(g, -tw / 2, -torsoLen + 18, tw, 26, 10); g.fill(); // bandeau
    g.fillStyle = c.colors.secondary; roundRect(g, -tw / 2, -torsoLen + 22, tw, 8, 4); g.fill();
    g.fillStyle = c.colors.primary; roundRect(g, -tw / 2 - 2, -6, tw + 4, 26, 8); g.fill();
  } else if (c.id === 'roxy') {
    roundRect(g, -tw / 2, -torsoLen + 16, tw, torsoLen + 4, 14); g.fill();
    g.fillStyle = c.colors.secondary;
    for (let i = 0; i < 3; i++) { g.fillRect(-tw / 2, -torsoLen + 34 + i * 22, tw, 6); }
  } else if (c.id === 'kaito') {
    g.fillStyle = '#10101a'; roundRect(g, -tw / 2 - 2, -8, tw + 4, 30, 8); g.fill();
    g.fillStyle = c.colors.primary; g.fillRect(-tw / 2 - 2, -6, 6, 26);
    g.fillStyle = c.colors.secondary; g.globalAlpha = 0.95;
    g.fillRect(-tw / 2 - 6, -torsoLen - 2, 14, torsoLen); g.fillRect(tw / 2 - 8, -torsoLen - 2, 14, torsoLen);
    g.globalAlpha = 1;
  } else {
    g.fillStyle = c.colors.secondary; roundRect(g, -tw / 2 - 4, -torsoLen - 4, tw + 8, 50, 12); g.fill();
    g.fillStyle = '#c0c8d8'; g.beginPath(); g.ellipse(-tw / 2 + 4, -torsoLen + 6, 18, 12, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.colors.primary; roundRect(g, -tw / 2 - 2, -6, tw + 4, 28, 8); g.fill();
    g.fillStyle = '#10101a'; for (let i = 0; i < 3; i++) g.fillRect(-tw / 2, -2 + i * 9, tw, 3);
  }
  // head
  const hr = 26 * (big ? 1.05 : 1);
  const hy = -torsoLen - hr - 6;
  g.fillStyle = ink; g.beginPath(); g.arc(4, hy, hr + 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.colors.skin; g.beginPath(); g.arc(4, hy, hr, 0, Math.PI * 2); g.fill();
  // hair
  g.fillStyle = c.colors.hair;
  g.strokeStyle = ink; g.lineWidth = 4;
  g.beginPath();
  if (c.id === 'vega') {
    g.moveTo(-26, hy + 40); g.quadraticCurveTo(-48, hy - 30, 0, hy - 36); g.quadraticCurveTo(42, hy - 34, 34, hy - 6);
    g.quadraticCurveTo(10, hy - 20, -6, hy - 6); g.quadraticCurveTo(-14, hy + 30, -26, hy + 40);
  } else if (c.id === 'roxy') {
    g.moveTo(-12, hy - 18); g.lineTo(-4, hy - 62); g.lineTo(10, hy - 30); g.lineTo(20, hy - 64); g.lineTo(26, hy - 18);
  } else if (c.id === 'kaito') {
    for (let i = 0; i < 5; i++) { g.lineTo(-24 + i * 12, hy - 30 - (i % 2) * 22); g.lineTo(-18 + i * 12, hy - 20); }
    g.lineTo(30, hy - 4); g.lineTo(-26, hy - 2);
  } else {
    g.rect(-22, hy - 40, 50, 20);
  }
  g.closePath(); g.fill(); g.stroke();
  // shades
  g.fillStyle = c.id === 'kaito' ? c.colors.secondary : c.id === 'brick' ? c.colors.primary : '#d8e0f0';
  roundRect(g, 4, hy - 8, 26, 10, 4); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(8, hy - 6, 8, 3);
  if (c.id === 'brick') { g.fillStyle = c.colors.hair; g.fillRect(8, hy + 10, 22, 5); }
  g.restore();

  // front limbs
  leg(pose.legF, false);
  const hand = arm(pose.armF, false);
  if (pose.disc) {
    g.fillStyle = ink; g.beginPath(); g.ellipse(hand[0], hand[1], 22, 9, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe600'; g.beginPath(); g.ellipse(hand[0], hand[1], 18, 6, 0.2, 0, Math.PI * 2); g.fill();
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function placeholderAtlas(c: CharacterDef): { texture: THREE.Texture; meta: AtlasMeta } {
  const cw = 256, ch = 384;
  const cols = Math.max(...ANIMS.map((a) => a[1]));
  const canvas = document.createElement('canvas');
  canvas.width = cw * cols;
  canvas.height = ch * ANIMS.length;
  const g = canvas.getContext('2d')!;
  const meta: AtlasMeta = { cell: [cw, ch], cols, rows: ANIMS.length, anchorY: 16 / ch, anims: {} };
  ANIMS.forEach(([name, frames, fps, loop], row) => {
    meta.anims[name] = { row, frames, fps, loop };
    for (let f = 0; f < frames; f++) {
      g.save();
      g.translate(f * cw, row * ch);
      g.beginPath(); g.rect(0, 0, cw, ch); g.clip();
      drawFigure(g, c, poseFor(name, f), cw, ch);
      g.restore();
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, meta };
}

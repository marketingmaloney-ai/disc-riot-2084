import type { InputFrame } from '../sim/types';

/** A source produces raw (screen-space) intent each tick. Screen right == court +x, screen down == court +z. */
export interface InputSource {
  poll(): InputFrame;
  label: string;
}

const keysDown = new Set<string>();
const pressedQueue = new Set<string>();
const menuQueue = new Set<string>(); // separate so gameplay ticks can't swallow menu taps

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keysDown.add(e.code);
  pressedQueue.add(e.code);
  menuQueue.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());

/** Call once per sim tick after all sources polled. */
export function endTick() {
  pressedQueue.clear();
}

export function wasPressed(code: string) {
  return pressedQueue.has(code);
}

export interface KeyMap { up: string[]; down: string[]; left: string[]; right: string[]; a: string[]; b: string[] }

export const P1_KEYS: KeyMap = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  a: ['KeyJ', 'Space'], b: ['KeyK'],
};
export const P2_KEYS: KeyMap = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  a: ['Numpad1', 'Period'], b: ['Numpad2', 'Slash'],
};
export const SOLO_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  a: ['KeyJ', 'Space', 'KeyZ'], b: ['KeyK', 'KeyX'],
};

const any = (codes: string[]) => codes.some((c) => keysDown.has(c));
const anyPressed = (codes: string[]) => codes.some((c) => pressedQueue.has(c));

export class KeyboardSource implements InputSource {
  constructor(private map: KeyMap, public label = 'Keyboard') {}
  poll(): InputFrame {
    const m = this.map;
    return {
      mx: (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0),
      mz: (any(m.down) ? 1 : 0) - (any(m.up) ? 1 : 0),
      a: anyPressed(m.a),
      b: anyPressed(m.b),
    };
  }
}

export class GamepadSource implements InputSource {
  private prevA = false;
  private prevB = false;
  label: string;
  constructor(public padIndex: number) {
    this.label = `Gamepad ${padIndex + 1}`;
  }
  poll(): InputFrame {
    const gp = navigator.getGamepads?.()[this.padIndex];
    if (!gp) return { mx: 0, mz: 0, a: false, b: false };
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const dead = 0.4;
    let mx = ax > dead ? 1 : ax < -dead ? -1 : 0;
    let mz = ay > dead ? 1 : ay < -dead ? -1 : 0;
    if (btn(15)) mx = 1; if (btn(14)) mx = -1;
    if (btn(13)) mz = 1; if (btn(12)) mz = -1;
    const aNow = btn(0) || btn(2) || btn(5);
    const bNow = btn(1) || btn(3) || btn(4);
    const f = { mx, mz, a: aNow && !this.prevA, b: bNow && !this.prevB };
    this.prevA = aNow;
    this.prevB = bNow;
    return f;
  }
}

/** Merge several sources (e.g. keyboard + pad for a solo player). */
export class MergedSource implements InputSource {
  constructor(private sources: InputSource[], public label = 'Merged') {}
  poll(): InputFrame {
    const out: InputFrame = { mx: 0, mz: 0, a: false, b: false };
    for (const s of this.sources) {
      const f = s.poll();
      if (f.mx) out.mx = f.mx;
      if (f.mz) out.mz = f.mz;
      out.a ||= f.a;
      out.b ||= f.b;
    }
    return out;
  }
}

export function connectedPads(): number[] {
  const pads = navigator.getGamepads?.() ?? [];
  const out: number[] = [];
  for (let i = 0; i < pads.length; i++) if (pads[i]) out.push(i);
  return out;
}

/** Menu navigation helper: returns edge-triggered directions/confirm from keyboard and all pads. */
export class MenuInput {
  private prev = { l: false, r: false, u: false, d: false, ok: false, back: false };
  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    let l = any(['ArrowLeft', 'KeyA']), r = any(['ArrowRight', 'KeyD']);
    let u = any(['ArrowUp', 'KeyW']), d = any(['ArrowDown', 'KeyS']);
    let ok = any(['Enter', 'Space', 'KeyJ']);
    let back = any(['Escape', 'Backspace', 'KeyK']);
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      l ||= ax < -0.5 || !!gp.buttons[14]?.pressed;
      r ||= ax > 0.5 || !!gp.buttons[15]?.pressed;
      u ||= ay < -0.5 || !!gp.buttons[12]?.pressed;
      d ||= ay > 0.5 || !!gp.buttons[13]?.pressed;
      ok ||= !!gp.buttons[0]?.pressed || !!gp.buttons[9]?.pressed;
      back ||= !!gp.buttons[1]?.pressed;
    }
    const cur = { l, r, u, d, ok, back };
    // Keyboard taps shorter than a frame never show up in keysDown, so also consume queued presses.
    const tapped = (codes: string[]) => codes.some((c) => menuQueue.has(c));
    const edge = {
      l: (l && !this.prev.l) || tapped(['ArrowLeft', 'KeyA']),
      r: (r && !this.prev.r) || tapped(['ArrowRight', 'KeyD']),
      u: (u && !this.prev.u) || tapped(['ArrowUp', 'KeyW']),
      d: (d && !this.prev.d) || tapped(['ArrowDown', 'KeyS']),
      ok: (ok && !this.prev.ok) || tapped(['Enter', 'Space', 'KeyJ']),
      back: (back && !this.prev.back) || tapped(['Escape', 'Backspace', 'KeyK']),
    };
    menuQueue.clear();
    this.prev = cur;
    return edge;
  }
}

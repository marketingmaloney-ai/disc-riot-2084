import type { InputFrame } from '../sim/types';
import type { InputSource } from './input';

/**
 * On-screen floating joystick (left half) + A/B buttons (right side).
 * `half` = 'l' / 'r': shared-screen 2P, each player gets one half (stick on the outer edge, buttons inside).
 */
export class TouchSource implements InputSource {
  label = 'Touch';
  private root: HTMLDivElement;
  private knob: HTMLDivElement;
  private base: HTMLDivElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private aPressed = false;
  private bPressed = false;

  constructor(parent: HTMLElement, half?: 'l' | 'r') {
    this.root = document.createElement('div');
    this.root.className = 'touch-ui' + (half ? ` half-${half}` : '');
    this.root.innerHTML = `
      <div class="touch-stick-zone"></div>
      <div class="touch-base"><div class="touch-knob"></div></div>
      <button class="touch-btn touch-a">A<small>THROW</small></button>
      <button class="touch-btn touch-b">B<small>LOB</small></button>`;
    parent.appendChild(this.root);
    this.base = this.root.querySelector('.touch-base')!;
    this.knob = this.root.querySelector('.touch-knob')!;
    const zone = this.root.querySelector('.touch-stick-zone') as HTMLDivElement;

    zone.addEventListener('pointerdown', (e) => {
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.origin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('on');
      this.move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.vec = { x: 0, y: 0 };
      this.knob.style.transform = '';
      this.base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const bind = (sel: string, fn: () => void) => {
      const el = this.root.querySelector(sel) as HTMLElement;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
        el.classList.add('down');
        navigator.vibrate?.(8);
      });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
    };
    bind('.touch-a', () => (this.aPressed = true));
    bind('.touch-b', () => (this.bPressed = true));
  }

  private move(x: number, y: number) {
    const dx = x - this.origin.x, dy = y - this.origin.y;
    const max = 50;
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.vec = { x: dx, y: dy };
  }

  poll(): InputFrame {
    const dead = 16;
    const { x, y } = this.vec;
    const len = Math.hypot(x, y);
    let mx = 0, mz = 0;
    if (len > dead) {
      // 8-way quantization
      const ang = Math.atan2(y, x);
      const oct = Math.round(ang / (Math.PI / 4));
      const a = oct * (Math.PI / 4);
      mx = Math.round(Math.cos(a));
      mz = Math.round(Math.sin(a));
    }
    const f = { mx, mz, a: this.aPressed, b: this.bPressed };
    this.aPressed = false;
    this.bPressed = false;
    return f;
  }

  /** Shared-screen 2P: squeeze this player's controls into the left half ('l'), or back to full screen (null). */
  setHalf(half: 'l' | null) {
    this.root.classList.toggle('half-l', half === 'l');
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
    if (!v) {
      // hidden mid-drag (pause, match end): drop the held direction so the fighter doesn't keep running
      this.stickId = null;
      this.vec = { x: 0, y: 0 };
      this.knob.style.transform = '';
      this.base.classList.remove('on');
    }
  }
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

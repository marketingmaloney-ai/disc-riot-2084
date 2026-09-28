import { charById } from '../sim/characters';
import * as C from '../sim/constants';
import type { GameEvent, GameState } from '../sim/types';

export class Hud {
  private el: HTMLElement;
  private s1!: HTMLElement;
  private s2!: HTMLElement;
  private time!: HTMLElement;
  private setLbl!: HTMLElement;
  private pips1!: HTMLElement;
  private pips2!: HTMLElement;
  private ch1!: HTMLElement;
  private ch2!: HTMLElement;
  private announceEl: HTMLElement | null = null;
  private announceTimer = 0;
  private last = [-1, -1];
  private lastPhase = '';

  constructor(root: HTMLElement) {
    this.el = root;
  }

  setup(g: GameState, labels: [string, string]) {
    const c1 = charById(g.players[0].charId), c2 = charById(g.players[1].charId);
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-side p1">
          <div><div class="hud-name p1c">${c1.name}</div><div class="hud-set">${labels[0]}</div><div class="pips" data-p="1"></div><div class="charge" data-c="1"></div></div>
          <div class="hud-score" data-s="1">0</div>
        </div>
        <div class="hud-mid"><div class="hud-time">45</div><div class="hud-set">SET 1</div></div>
        <div class="hud-side p2">
          <div style="text-align:right"><div class="hud-name p2c">${c2.name}</div><div class="hud-set">${labels[1]}</div><div class="pips" data-p="2" style="justify-content:flex-end"></div><div class="charge" data-c="2"></div></div>
          <div class="hud-score" data-s="2">0</div>
        </div>
      </div>`;
    this.s1 = this.el.querySelector('[data-s="1"]')!;
    this.s2 = this.el.querySelector('[data-s="2"]')!;
    this.time = this.el.querySelector('.hud-time')!;
    this.setLbl = this.el.querySelector('.hud-mid .hud-set')!;
    this.pips1 = this.el.querySelector('[data-p="1"]')!;
    this.pips2 = this.el.querySelector('[data-p="2"]')!;
    this.ch1 = this.el.querySelector('[data-c="1"]')!;
    this.ch2 = this.el.querySelector('[data-c="2"]')!;
    this.last = [-1, -1];
    this.lastPhase = '';
  }

  announce(html: string, ms = 1300, small = false) {
    this.announceEl?.remove();
    const a = document.createElement('div');
    a.className = 'announce' + (small ? ' small' : '');
    a.innerHTML = html;
    this.el.appendChild(a);
    this.announceEl = a;
    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => a.remove(), ms);
  }

  events(events: GameEvent[], g: GameState) {
    for (const e of events) {
      if (e.type === 'score') {
        const who = charById(g.players[e.p!].charId).name.split(' ')[0];
        this.announce(`${e.pts} POINTS!<span class="pts">${who}</span>`, 1500);
      } else if (e.type === 'super') {
        this.announce(charById(g.players[e.p!].charId).superName, 900, true);
      } else if (e.type === 'supersonic') {
        this.announce('POWER SHOT!', 600, true);
      } else if (e.type === 'setEnd') {
        const who = charById(g.players[e.p!].charId).name.split(' ')[0];
        this.announce(`SET ${g.setNo}<span class="pts">${who} WINS</span>`, 2800);
      } else if (e.type === 'serve' && g.score[0] === 0 && g.score[1] === 0) {
        this.announce(`SET ${g.setNo}`, 1100);
      }
    }
  }

  update(g: GameState) {
    if (!this.s1) return;
    for (const i of [0, 1]) {
      if (g.score[i] !== this.last[i]) {
        const el = i === 0 ? this.s1 : this.s2;
        el.textContent = String(g.score[i]);
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
        this.last[i] = g.score[i];
      }
    }
    const t = Math.ceil(g.setTime);
    this.time.textContent = String(t);
    this.time.classList.toggle('low', t <= 10);
    this.setLbl.textContent = g.setTime <= 0 && g.score[0] === g.score[1] ? 'SUDDEN DEATH' : `SET ${g.setNo} · FIRST TO ${C.SET_POINTS}`;
    const pips = (n: number) => Array.from({ length: C.SETS_TO_WIN }, (_, i) => `<div class="pip ${i < n ? 'on' : ''}"></div>`).join('');
    const key = `${g.sets[0]}-${g.sets[1]}`;
    if (this.lastPhase !== key) {
      this.pips1.innerHTML = pips(g.sets[0]);
      this.pips2.innerHTML = pips(g.sets[1]);
      this.lastPhase = key;
    }
    this.ch1.textContent = g.players[0].charged ? '★ SUPER READY' : '';
    this.ch2.textContent = g.players[1].charged ? 'SUPER READY ★' : '';
  }
}

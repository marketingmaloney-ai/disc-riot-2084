import { charById, superNames } from '../sim/characters';
import * as C from '../sim/constants';
import type { GameEvent, GameState } from '../sim/types';
import { uiImageURL } from '../render/characterArt';

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
  private cutinSrc: string[] = ['', ''];

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
        <div class="hud-mid"><div class="hud-time">45</div><div class="hud-set">SET 1</div><div class="rally"></div></div>
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
    this.rallyEl = this.el.querySelector('.rally');
    this.rallyShown = -1;
    this.ch1 = this.el.querySelector('[data-c="1"]')!;
    this.ch2 = this.el.querySelector('[data-c="2"]')!;
    this.last = [-1, -1];
    this.lastPhase = '';
    g.players.forEach((p, i) => void uiImageURL(p.charId, 'cutin', 'win').then((u) => (this.cutinSrc[i] = u)));
  }

  /** Full-screen super cut-in; runs while the sim is frozen for HITSTOP_CUTIN ticks. */
  cutin(g: GameState, idx: number, v = 0) {
    const c = charById(g.players[idx].charId);
    const name = superNames(c)[v] ?? superNames(c)[0];
    const side = idx === 0 ? 'l' : 'r';
    const el = document.createElement('div');
    el.className = `cutin cutin-${side}`;
    el.style.setProperty('--c1', c.colors.primary);
    el.style.setProperty('--c2', c.colors.secondary);
    el.innerHTML = `<div class="cutin-band"><div class="cutin-lines"></div>
      ${this.cutinSrc[idx] ? `<img class="cutin-art" src="${this.cutinSrc[idx]}" alt="">` : ''}
      <div class="cutin-text"><div class="cutin-super">SUPER!</div><div class="cutin-name">${name}</div></div></div>`;
    this.el.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  private calloutEl: HTMLElement | null = null;
  private calloutTimer = 0;
  private rallyEl: HTMLElement | null = null;
  private rallyShown = -1;

  /** Second banner line, below the main announcement (combos, set point, streaks...). */
  callout(text: string, hot = false, ms = 1500, low = false) {
    this.calloutEl?.remove();
    const a = document.createElement('div');
    a.className = 'callout' + (hot ? ' hot' : '') + (low ? ' low' : '');
    a.textContent = text;
    this.el.appendChild(a);
    this.calloutEl = a;
    clearTimeout(this.calloutTimer);
    this.calloutTimer = window.setTimeout(() => a.remove(), ms);
  }

  /** Live rally counter under the clock: appears at 3 catches, heats up with length. */
  rally(n: number) {
    if (!this.rallyEl || n === this.rallyShown) return;
    this.rallyShown = n;
    this.rallyEl.textContent = n >= 3 ? `RALLY ×${n}` : '';
    this.rallyEl.className = 'rally' + (n >= 10 ? ' fire' : n >= 6 ? ' warm' : '');
    if (n >= 3) { this.rallyEl.classList.remove('bump'); void this.rallyEl.offsetWidth; this.rallyEl.classList.add('bump'); }
  }

  announce(html: string, ms = 1300, small = false, extra = '') {
    this.announceEl?.remove();
    const a = document.createElement('div');
    a.className = 'announce' + (small ? ' small' : '') + extra;
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
        this.cutin(g, e.p!, e.v ?? 0);
      } else if (e.type === 'supersonic') {
        this.announce('POWER SHOT!', 600, true);
      } else if (e.type === 'setEnd') {
        if (e.p! < 0) this.announce(`SET ${g.setNo}<span class="pts">DRAW · BOTH SCORE</span>`, 2800);
        else this.announce(`SET ${g.setNo}<span class="pts">${charById(g.players[e.p!].charId).name.split(' ')[0]} WINS</span>`, 2800);
      } else if (e.type === 'reversal') {
        // fires on the same tick as the super cut-in, which covers the middle of the screen: show it below the band
        this.announce('REVERSAL!', 1100, true, ' rev');
      } else if (e.type === 'serve' && g.score[0] === 0 && g.score[1] === 0) {
        const decider = g.sets[0] === C.SETS_TO_WIN - 1 && g.sets[1] === C.SETS_TO_WIN - 1;
        this.announce(g.suddenDeath ? 'SUDDEN DEATH' : decider ? 'FINAL SET' : `SET ${g.setNo}`, 1100, g.suddenDeath);
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
    // Sudden death has no clock (setTime is 0): show "SD" steadily instead of a blinking pink 0.
    const t = Math.ceil(g.setTime);
    this.time.textContent = g.suddenDeath ? 'SD' : String(t);
    this.time.classList.toggle('low', !g.suddenDeath && t <= 10);
    this.setLbl.textContent = g.suddenDeath ? 'SUDDEN DEATH · NEXT SCORE WINS' : `SET ${g.setNo} · FIRST TO ${C.SET_POINTS}`;
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

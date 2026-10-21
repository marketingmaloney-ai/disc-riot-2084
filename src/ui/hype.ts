import * as C from '../sim/constants';
import { charById } from '../sim/characters';
import type { GameEvent, GameState } from '../sim/types';

/** Something worth shouting about: a banner line under the main announcement, and/or an announcer clip. */
export interface Callout {
  text?: string;
  hot?: boolean; // pink "on fire" styling
  vo?: string; // common sfx name, e.g. 'vo_combo'
  voDelay?: number;
  slowmo?: boolean; // set / match winning goal
  low?: boolean; // sits under the taller SET banner
  speed?: { kmh: number; p: number; x: number; z: number }; // speed-gun readout for a power shot or super
}

const COMBO_AT = 6; // catches in one rally
const FIRE_AT = 10;
const COMEBACK_GAP = 7;
/** Speed gun: m/s on our 16 m arcade court, shown as "km/h" scaled to feel like a full-size one. */
export const toKmh = (ms: number) => Math.round(ms * 3.6 * 2);

export interface MatchStats {
  fastest: { kmh: number; p: number };
  longestRally: number;
  supersScored: [number, number];
}

/**
 * Arcade hype layer: rally combos, set / match point, the final-seconds countdown, streaks, comebacks and
 * flawless sets. Pure presentation, read from the sim's events and state; it never changes the game.
 */
export class Hype {
  rally = 0;
  stats: MatchStats = { fastest: { kmh: 0, p: -1 }, longestRally: 0, supersScored: [0, 0] };
  private streak = { p: -1, n: 0 };
  private maxGap = [0, 0]; // biggest deficit each player has faced this set
  private comebackDone = false;
  private lastT = C.SET_TIME;
  private lastSet = 1;

  reset() {
    this.rally = 0;
    this.stats = { fastest: { kmh: 0, p: -1 }, longestRally: 0, supersScored: [0, 0] };
    this.streak = { p: -1, n: 0 };
    this.maxGap = [0, 0];
    this.comebackDone = false;
    this.lastT = C.SET_TIME;
    this.lastSet = 1;
  }

  /** Call every tick with that tick's events. */
  update(events: GameEvent[], g: GameState): Callout[] {
    const out: Callout[] = [];
    if (g.setNo !== this.lastSet) {
      this.lastSet = g.setNo;
      this.streak = { p: -1, n: 0 };
      this.maxGap = [0, 0];
      this.comebackDone = false;
    }
    for (const e of events) {
      if ((e.type === 'supersonic' || e.type === 'super') && e.p !== undefined) {
        const d = g.disc;
        const ms = e.type === 'super' && d.superDef ? d.superBase * (d.superDef.speed ?? 1.12) : Math.hypot(d.vx, d.vz);
        const kmh = toKmh(ms);
        if (kmh > this.stats.fastest.kmh) this.stats.fastest = { kmh, p: e.p };
        out.push({ speed: { kmh, p: e.p, x: g.players[e.p].x, z: g.players[e.p].z } });
      } else if (e.type === 'catch') {
        this.rally++;
        this.stats.longestRally = Math.max(this.stats.longestRally, this.rally);
        if (this.rally === COMBO_AT) out.push({ text: `${COMBO_AT}-HIT COMBO!`, vo: 'vo_combo' });
        else if (this.rally === FIRE_AT) out.push({ text: 'ON FIRE!', hot: true });
        else if (this.rally > FIRE_AT && this.rally % 5 === 0) out.push({ text: `${this.rally}-HIT RALLY!`, hot: true });
      } else if (e.type === 'serve') {
        this.rally = 0;
        const pt = this.pointCall(g);
        if (pt) out.push(pt);
      } else if (e.type === 'score') { // a dropped disc also ends in a 'score' for the other side
        const p = e.p ?? -1;
        const finisher = p >= 0 && (g.suddenDeath || g.score[p] >= C.SET_POINTS);
        if (p >= 0 && e.shot === 'super') this.stats.supersScored[p]++;
        if (this.rally >= COMBO_AT) out.push({ text: `COMBO BREAKER! · ${this.rally} HITS`, vo: 'vo_combo_breaker', voDelay: 0.5 });
        if (p >= 0) {
          this.streak = this.streak.p === p ? { p, n: this.streak.n + 1 } : { p, n: 1 };
          for (const i of [0, 1]) this.maxGap[i] = Math.max(this.maxGap[i], g.score[1 - i] - g.score[i]);
          if (this.streak.n === 3 && !finisher) out.push({ text: `${short(g, p)} · 3 IN A ROW!` });
          else if (this.streak.n === 5 && !finisher) out.push({ text: `${short(g, p)} IS UNSTOPPABLE!`, hot: true });
          if (!this.comebackDone && this.maxGap[p] >= COMEBACK_GAP && g.score[p] >= g.score[1 - p]) {
            this.comebackDone = true;
            out.push({ text: `COMEBACK! ${short(g, p)} ${g.score[p] === g.score[1 - p] ? 'TIES IT' : 'TAKES THE LEAD'}`, hot: true });
          }
        }
        if (finisher) out.push({ slowmo: true });
        this.rally = 0;
      } else if (e.type === 'setEnd') {
        const w = e.p ?? -1;
        if (w < 0) out.push({ vo: 'vo_its_a_tie', voDelay: 0.6 });
        else if (g.score[1 - w] === 0) out.push({ text: 'FLAWLESS!', hot: true, low: true, vo: 'vo_flawless_victory', voDelay: 0.9 });
      }
    }
    // the final seconds of a set: banner at 10, announcer counts 3-2-1, "TIME!" at the buzzer
    if (g.phase === 'play' && !g.suddenDeath) {
      const t = g.setTime;
      if (this.lastT > 10 && t <= 10) out.push({ text: 'FINAL 10 SECONDS!', hot: true });
      for (const n of [3, 2, 1]) if (this.lastT > n && t <= n) out.push({ vo: `vo_${n}` });
      if (this.lastT > 0 && t <= 0) out.push({ vo: 'vo_time' });
    }
    this.lastT = g.setTime;
    return out;
  }

  /** At the serve: someone one goal from taking the set (or the match)? */
  private pointCall(g: GameState): Callout | null {
    if (g.suddenDeath) return null;
    if (g.score[0] === g.score[1]) return null;
    const lead = g.score[0] > g.score[1] ? 0 : 1;
    if (g.score[lead] < C.SET_POINTS - 3) return null;
    const match = g.sets[lead] === C.SETS_TO_WIN - 1;
    return { text: `${match ? 'MATCH' : 'SET'} POINT · ${short(g, lead)}`, hot: match };
  }
}

const short = (g: GameState, p: number) => charById(g.players[p].charId).name.split(' ')[0];

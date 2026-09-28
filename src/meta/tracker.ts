import type { GameEvent, GameState } from '../sim/types';
import { ACHIEVEMENTS, isDone, type Achievement } from './achievements';
import { charProfile, saveProfile } from './progress';

/**
 * Watches a VS CPU match for the human player (P1) and, at match end, folds the results into
 * that character's lifetime stats and unlocks achievements. Quitting mid-match records nothing.
 */
export class MatchTracker {
  private curve = 0;
  private power = 0;
  private sup = 0;
  private big = 0;
  private catches = 0;
  private superCatches = 0;
  private flawless = 0;
  private comebacks = 0;
  private conceded = 0;
  private maxDeficit = 0;
  done = false;

  constructor(
    private me: number,
    private charId: string,
    private oppId: string,
    private arenaId: string,
    private difficulty: 'easy' | 'normal' | 'hard',
  ) {}

  /** Returns newly unlocked achievements when the match ends, else null. */
  onEvents(events: GameEvent[], g: GameState): Achievement[] | null {
    let result: Achievement[] | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'catch':
          if (e.p === this.me) {
            this.catches++;
            if (e.big) this.superCatches++;
          }
          break;
        case 'score':
          if (e.p === this.me) {
            if (e.by === this.me) {
              if (e.shot === 'curve') this.curve++;
              else if (e.shot === 'supersonic') this.power++;
              else if (e.shot === 'super') this.sup++;
            }
            if (e.big) this.big++;
          } else {
            this.conceded++;
          }
          this.maxDeficit = Math.max(this.maxDeficit, g.score[1 - this.me] - g.score[this.me]);
          break;
        case 'setEnd':
          if (e.p === this.me) {
            if (this.conceded === 0) this.flawless++;
            if (this.maxDeficit >= 6) this.comebacks++;
          }
          this.conceded = 0;
          this.maxDeficit = 0;
          break;
        case 'matchEnd':
          result = this.finish(e.p === this.me);
          break;
      }
    }
    return result;
  }

  private finish(won: boolean): Achievement[] {
    this.done = true;
    const cp = charProfile(this.charId);
    const s = cp.stats;
    s.matches++;
    s.curveGoals += this.curve;
    s.powerGoals += this.power;
    s.superGoals += this.sup;
    s.bigGoals += this.big;
    s.catches += this.catches;
    s.superCatches += this.superCatches;
    s.flawlessSets += this.flawless;
    s.comebacks += this.comebacks;
    if (won) {
      s.wins++;
      if (this.difficulty !== 'easy') s.winsNormal++;
      if (this.difficulty === 'hard') s.winsHard++;
      if (!s.arenasWon.includes(this.arenaId)) s.arenasWon.push(this.arenaId);
      if (!s.rivalsBeaten.includes(this.oppId) && this.oppId !== this.charId) s.rivalsBeaten.push(this.oppId);
    }
    const fresh = ACHIEVEMENTS.filter((a) => !cp.unlocked.includes(a.id) && isDone(a, s));
    for (const a of fresh) {
      cp.unlocked.push(a.id);
      cp.earned += a.points;
    }
    saveProfile();
    return fresh;
  }
}

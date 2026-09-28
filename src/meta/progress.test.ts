import { describe, expect, it } from 'vitest';
import { CpuPlayer, DIFFICULTIES } from '../ai/cpu';
import * as C from '../sim/constants';
import { createGame, step } from '../sim/game';
import { charProfile, downgrade, freePoints, resetAllProgress, upgrade } from './progress';
import { MatchTracker } from './tracker';

describe('attribute levels', () => {
  it('scale the player stats and clamp at the cap', () => {
    const base = createGame('vega', 'kaito').players[0];
    const up = createGame('vega', 'kaito', undefined, [{ speed: 5, power: 5, technique: 5, reflex: 9 }]).players[0];
    expect(up.speed / base.speed).toBeCloseTo(1 + 5 * C.ATTR_SPEED);
    expect(up.power / base.power).toBeCloseTo(1 + 5 * C.ATTR_POWER);
    expect(up.curve / base.curve).toBeCloseTo(1 + 5 * C.ATTR_TECH_CURVE);
    expect(up.catchR / base.catchR).toBeCloseTo(1 + C.MAX_ATTR_LEVEL * C.ATTR_REFLEX_REACH); // 9 clamped to 5
    expect(up.ssWindow).toBe(base.ssWindow + C.MAX_ATTR_LEVEL);
  });
});

describe('achievements', () => {
  it('a won match unlocks achievements and awards spendable points', () => {
    resetAllProgress();
    const tracker = new MatchTracker(0, 'brick', 'vega', 'sunset', 'normal');
    const g = createGame('brick', 'vega');
    const ai = [new CpuPlayer(0, DIFFICULTIES.hard, 3), new CpuPlayer(1, DIFFICULTIES.easy, 4)];
    let unlocked = null;
    for (let t = 0; t < 60 * 600 && g.phase !== 'matchEnd'; t++) {
      step(g, [ai[0].think(g), ai[1].think(g)]);
      unlocked = tracker.onEvents(g.events, g) ?? unlocked;
    }
    expect(g.matchWinner).toBe(0);
    const ids = unlocked!.map((a) => a.id);
    expect(ids).toContain('first_win');
    expect(ids).toContain('win_normal');
    const cp = charProfile('brick');
    expect(cp.stats.wins).toBe(1);
    expect(cp.stats.rivalsBeaten).toEqual(['vega']);
    expect(freePoints(cp)).toBe(cp.earned);
    expect(cp.earned).toBeGreaterThanOrEqual(2);

    // spending points
    expect(upgrade('brick', 'power')).toBe(true);
    expect(freePoints(cp)).toBe(cp.earned - 1);
    expect(downgrade('brick', 'power')).toBe(true);
    expect(freePoints(charProfile('vega'))).toBe(0);
    expect(upgrade('vega', 'speed')).toBe(false); // no points on an unplayed fighter
  });
});

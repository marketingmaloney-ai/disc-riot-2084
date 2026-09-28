import { describe, expect, it } from 'vitest';
import { CpuPlayer, DIFFICULTIES } from '../ai/cpu';
import { createGame, step } from './game';
import type { GameEvent } from './types';

function playMatch(seedA: number, seedB: number, p1 = 'vega', p2 = 'brick', maxTicks = 60 * 60 * 6) {
  const g = createGame(p1, p2);
  const ai = [new CpuPlayer(0, DIFFICULTIES.normal, seedA), new CpuPlayer(1, DIFFICULTIES.hard, seedB)];
  const counts: Record<string, number> = {};
  let ticks = 0;
  while (g.phase !== 'matchEnd' && ticks < maxTicks) {
    step(g, [ai[0].think(g), ai[1].think(g)]);
    g.events.forEach((e: GameEvent) => (counts[e.type] = (counts[e.type] ?? 0) + 1));
    ticks++;
  }
  return { g, counts, ticks };
}

describe('simulation', () => {
  it('plays a full CPU match to completion', () => {
    const { g, counts, ticks } = playMatch(1, 2);
    expect(g.phase).toBe('matchEnd');
    expect(Math.max(...g.sets)).toBe(2);
    expect(counts.catch).toBeGreaterThan(10);
    expect(counts.score).toBeGreaterThan(3);
    // Match should take a sensible amount of time (not instant, not endless)
    expect(ticks / 60).toBeGreaterThan(30);
    console.log('match seconds', (ticks / 60).toFixed(1), counts);
  });

  it('is deterministic', () => {
    const a = playMatch(5, 9, 'kaito', 'roxy');
    const b = playMatch(5, 9, 'kaito', 'roxy');
    expect(a.ticks).toBe(b.ticks);
    expect(a.g.score).toEqual(b.g.score);
    expect(a.g.sets).toEqual(b.g.sets);
  });

  it('keeps players on their own half', () => {
    const g = createGame('vega', 'kaito');
    for (let i = 0; i < 400; i++) {
      step(g, [{ mx: 1, mz: 1, a: false, b: false }, { mx: -1, mz: -1, a: false, b: false }]);
      expect(g.players[0].x).toBeLessThan(0);
      expect(g.players[1].x).toBeGreaterThan(0);
    }
  });
});

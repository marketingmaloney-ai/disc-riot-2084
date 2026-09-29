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

  it('locks you under your own toss so pushing/dashing away still catches it and charges the super', () => {
    const g = createGame('vega', 'kaito', undefined, [], [true, false]);
    const idle = { mx: 0, mz: 0, a: false, b: false };
    let t = 0;
    while (!(g.phase === 'play' && g.players.some((p) => p.state === 'hold')) && t++ < 600) step(g, [idle, idle]);
    const p = g.players.find((q) => q.state === 'hold')!;
    const fwd = -p.side; // toward the opponent
    const inputs = (i: number) => {
      const me = i === 0 ? { mx: -fwd, mz: 0, a: false, b: true } // B + back: self-toss
        : i < 6 ? { mx: fwd, mz: 0, a: false, b: false } // walk into the landing circle
        : { mx: fwd, mz: 1, a: i % 4 === 0, b: false }; // then keep pushing diagonally away + dashing
      return (p.idx === 0 ? [me, idle] : [idle, me]) as [typeof me, typeof me];
    };
    let charged = false;
    for (let i = 0; i < 120 && !charged; i++) {
      step(g, inputs(i));
      charged = g.events.some((e) => e.type === 'charge' && e.p === p.idx);
    }
    expect(charged).toBe(true);
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

describe('original Windjammers rules', () => {
  const idle = { mx: 0, mz: 0, a: false, b: false };
  const run = (g: ReturnType<typeof createGame>, n: number) => { for (let i = 0; i < n; i++) step(g, [idle, idle]); };

  it('a tied set is awarded to both players', () => {
    const g = createGame('vega', 'kaito');
    run(g, 80);
    g.score = [6, 6];
    g.setTime = 0.01;
    run(g, 2);
    expect(g.phase).toBe('setEnd');
    expect(g.sets).toEqual([1, 1]);
  });

  it('two sets each goes to sudden death, next score wins', () => {
    const g = createGame('vega', 'kaito');
    run(g, 80);
    g.sets = [1, 1];
    g.score = [3, 3];
    g.setTime = 0.01;
    run(g, 2);
    expect(g.sets).toEqual([2, 2]);
    run(g, 60 * 4);
    expect(g.suddenDeath).toBe(true);
    expect(g.phase).not.toBe('matchEnd');
    // server throws straight into the opponent's goal (opponent never moves)
    const server = g.server;
    run(g, 80);
    step(g, server === 0 ? [{ mx: 1, mz: 0, a: true, b: false }, idle] : [idle, { mx: -1, mz: 0, a: true, b: false }]);
    for (let i = 0; i < 400 && g.phase !== 'matchEnd'; i++) {
      // keep the defender out of the way
      step(g, server === 0 ? [idle, { mx: 0, mz: -1, a: false, b: false }] : [{ mx: 0, mz: -1, a: false, b: false }, idle]);
    }
    expect(g.phase).toBe('matchEnd');
    expect(g.matchWinner).toBe(server);
  });

  it('pressing A right after a catch fires a power shot', () => {
    const g = createGame('vega', 'kaito');
    run(g, 80); // serve delay over; P1 (server) holds the disc
    g.players[0].serving = false;
    g.players[0].holdT = 0;
    step(g, [{ mx: 1, mz: 0, a: true, b: false }, idle]);
    expect(g.events.some((e) => e.type === 'supersonic')).toBe(true);
  });
});

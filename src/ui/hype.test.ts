import { describe, expect, it } from 'vitest';
import { createGame } from '../sim/game';
import type { GameEvent } from '../sim/types';
import { Hype } from './hype';

const score = (g: ReturnType<typeof createGame>, p: number, pts: number): GameEvent[] => {
  g.score[p] += pts;
  return [{ type: 'score', p, pts }];
};

describe('hype call-outs', () => {
  it('calls a comeback only for the player who was behind', () => {
    const g = createGame('vega', 'kaito');
    const h = new Hype();
    const texts: string[] = [];
    const run = (ev: GameEvent[]) => texts.push(...h.update(ev, g).map((c) => c.text ?? ''));
    run(score(g, 0, 5)); run(score(g, 0, 5)); // 10-0: kaito down by 10
    expect(texts.join()).not.toContain('COMEBACK');
    run(score(g, 0, 1)); // still leading: no comeback for vega
    expect(texts.join()).not.toContain('COMEBACK');
    g.score[1] = 8; run(score(g, 1, 3)); // kaito 11-11
    expect(texts.join()).toContain('COMEBACK! KAITO TIES IT');
  });

  it('counts a rally and breaks the combo on the score', () => {
    const g = createGame('vega', 'kaito');
    const h = new Hype();
    const all = [];
    for (let i = 0; i < 7; i++) all.push(...h.update([{ type: 'catch', p: i % 2 }], g));
    expect(h.rally).toBe(7);
    expect(all.some((c) => c.vo === 'vo_combo')).toBe(true);
    const end = h.update(score(g, 0, 3), g);
    expect(end.some((c) => c.vo === 'vo_combo_breaker')).toBe(true);
    expect(h.rally).toBe(0);
  });
});

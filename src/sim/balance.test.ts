/**
 * Balance harness: `BALANCE=1 npx vitest run src/sim/balance.test.ts --silent=false`
 * Plays many deterministic CPU-vs-CPU matches and prints balance metrics.
 * Skipped in normal `npm test` runs.
 */
import { describe, it } from 'vitest';
import { CpuPlayer, DIFFICULTIES, type Difficulty } from '../ai/cpu';
import { CHARACTERS } from './characters';
import { createGame, step } from './game';

const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const RUN = !!env.BALANCE;
const N = Number(env.BALANCE_N ?? 12);

interface Stats {
  wins: [number, number];
  matches: number;
  seconds: number;
  points: number;
  pts: Record<string, number>; // "3" | "5" | "2"
  rallyThrows: number[];
  pointSeconds: number[];
  supers: number;
  superScores: number;
  supersonic: number;
  supersonicScores: number;
  curves: number;
  curveScores: number;
  lobs: number;
  catches: number;
  byChar: Record<string, Record<string, number>>; // points scored per character per shot type
  superV: Record<string, [number, number]>; // `${char}:${variant}` -> [fired, scored]
}

const blank = (): Stats => ({
  wins: [0, 0], matches: 0, seconds: 0, points: 0, pts: {}, rallyThrows: [], pointSeconds: [],
  supers: 0, superScores: 0, supersonic: 0, supersonicScores: 0, curves: 0, curveScores: 0, lobs: 0, catches: 0, byChar: {}, superV: {},
});

export function playMatch(c1: string, c2: string, d1: Difficulty, d2: Difficulty, seed: number, arenaZone?: number, s = blank()) {
  const g = createGame(c1, c2, arenaZone);
  const ai = [new CpuPlayer(0, d1, seed * 7 + 1), new CpuPlayer(1, d2, seed * 13 + 5)];
  let ticks = 0, rally = 0, pointStart = 0;
  let lastShot = '';
  let lastSuper = '';
  while (g.phase !== 'matchEnd' && ticks < 60 * 60 * 10) {
    step(g, [ai[0].think(g), ai[1].think(g)]);
    ticks++;
    for (const e of g.events) {
      switch (e.type) {
        case 'throw': rally++; if (!g.events.some((x) => x.type === 'curve')) lastShot = 'normal'; break;
        case 'curve': s.curves++; lastShot = 'curve'; break;
        case 'supersonic': rally++; s.supersonic++; lastShot = 'supersonic'; break;
        case 'super': { rally++; s.supers++; lastShot = 'super'; lastSuper = `${g.players[e.p!].charId}:${e.v ?? 0}`; (s.superV[lastSuper] ??= [0, 0])[0]++; break; }
        case 'lob': rally++; s.lobs++; lastShot = 'lob'; break;
        case 'catch': s.catches++; break;
        case 'serve': rally = 0; pointStart = ticks; lastShot = ''; break;
        case 'score': {
          s.points++;
          s.pts[String(e.pts)] = (s.pts[String(e.pts)] ?? 0) + 1;
          s.rallyThrows.push(rally);
          s.pointSeconds.push((ticks - pointStart) / 60);
          const bc = (s.byChar[g.players[e.p!].charId] ??= {});
          bc[lastShot || '?'] = (bc[lastShot || '?'] ?? 0) + e.pts!;
          if (lastShot === 'super') { s.superScores++; if (e.p === Number(g.players[1].charId === lastSuper.split(':')[0]) || true) (s.superV[lastSuper] ??= [0, 0])[1]++; }
          if (lastShot === 'supersonic') s.supersonicScores++;
          if (lastShot === 'curve') s.curveScores++;
          break;
        }
      }
    }
  }
  s.matches++;
  s.seconds += ticks / 60;
  if (g.matchWinner >= 0) s.wins[g.matchWinner]++;
  return s;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '-');

function summary(s: Stats) {
  return [
    `matches ${s.matches}, avg match ${(s.seconds / s.matches).toFixed(0)}s, points/match ${(s.points / s.matches).toFixed(1)}`,
    `point types: ${Object.entries(s.pts).map(([k, v]) => `${k}pt ${pct(v, s.points)}`).join(' · ')}`,
    `rally throws avg ${avg(s.rallyThrows).toFixed(1)} (median ${med(s.rallyThrows)}), point length avg ${avg(s.pointSeconds).toFixed(1)}s`,
    `catches/point ${(s.catches / s.points).toFixed(1)}`,
    `supers ${(s.supers / s.matches).toFixed(1)}/match → scored ${pct(s.superScores, s.supers)}`,
    `power shots ${(s.supersonic / s.matches).toFixed(1)}/match → scored ${pct(s.supersonicScores, s.supersonic)}`,
    `curves ${(s.curves / s.matches).toFixed(1)}/match → scored ${pct(s.curveScores, s.curves)}; lobs ${(s.lobs / s.matches).toFixed(1)}/match`,
    `super success (fired→scored) by fighter:variant: ${Object.entries(s.superV).sort().map(([k, [f, sc]]) => `${k} ${f}→${pct(sc, f)}`).join(' · ')}`,
    `points by character/shot: ${Object.entries(s.byChar).map(([c, o]) => `${c}{${Object.entries(o).map(([k, v]) => `${k}:${v}`).join(' ')}}`).join(' ')}`,
  ].join('\n  ');
}

describe.runIf(RUN)('balance', () => {
  it('character matrix (hard vs hard, both sides)', () => {
    const all = blank();
    const winRate: Record<string, [number, number]> = {};
    const lines: string[] = [];
    for (const a of CHARACTERS) {
      const row: string[] = [];
      for (const b of CHARACTERS) {
        let aw = 0, n = 0;
        for (let seed = 1; seed <= N; seed++) {
          const s1 = playMatch(a.id, b.id, DIFFICULTIES.hard, DIFFICULTIES.hard, seed, undefined, all);
          void s1;
          // distinct seeds per matchup so cells don't share RNG streams
          const cell = 10000 * (CHARACTERS.indexOf(a) * CHARACTERS.length + CHARACTERS.indexOf(b) + 1);
          const r1 = blank(); playMatch(a.id, b.id, DIFFICULTIES.hard, DIFFICULTIES.hard, cell + seed, undefined, r1);
          const r2 = blank(); playMatch(b.id, a.id, DIFFICULTIES.hard, DIFFICULTIES.hard, cell + 5000 + seed, undefined, r2);
          aw += r1.wins[0] + r2.wins[1];
          n += 2;
        }
        row.push(a.id === b.id ? '  -  ' : `${String(Math.round((100 * aw) / n)).padStart(3)}% `);
        const w = (winRate[a.id] ??= [0, 0]);
        if (a.id !== b.id) { w[0] += aw; w[1] += n; }
      }
      lines.push(`${a.id.padEnd(6)} ${row.join(' ')}`);
    }
    console.log(`\n=== CHARACTER MATRIX (row win% vs column), N=${N * 2}/cell ===\n       ${CHARACTERS.map((c) => c.id.padEnd(6)).join('')}\n${lines.join('\n')}`);
    console.log('overall: ' + Object.entries(winRate).map(([k, [w, n]]) => `${k} ${pct(w, n)}`).join(' · '));
    console.log(`\n=== GAME FLOW (hard vs hard) ===\n  ${summary(all)}`);
  });

  it('difficulty ladder', () => {
    const pairs: [keyof typeof DIFFICULTIES, keyof typeof DIFFICULTIES][] = [['easy', 'normal'], ['normal', 'hard'], ['easy', 'hard']];
    console.log('\n=== DIFFICULTY LADDER (win% of the harder CPU) ===');
    for (const [lo, hi] of pairs) {
      let hw = 0, n = 0;
      for (let seed = 1; seed <= N * 2; seed++) {
        const c = CHARACTERS[seed % CHARACTERS.length].id, c2 = CHARACTERS[(seed + 1) % CHARACTERS.length].id;
        const r = blank(); playMatch(c, c2, DIFFICULTIES[lo], DIFFICULTIES[hi], seed, undefined, r); hw += r.wins[1]; n++;
        const q = blank(); playMatch(c2, c, DIFFICULTIES[hi], DIFFICULTIES[lo], seed + 500, undefined, q); hw += q.wins[0]; n++;
      }
      console.log(`  ${hi} beats ${lo}: ${pct(hw, n)}`);
    }
  });

  it('arena zones', () => {
    console.log('\n=== ARENA 5-PT ZONE (hard vs hard) ===');
    for (const z of [1.1, 1.35, 1.65, 2.05]) {
      const s = blank();
      for (let seed = 1; seed <= N * 2; seed++) playMatch(CHARACTERS[seed % 4].id, CHARACTERS[(seed + 2) % 4].id, DIFFICULTIES.hard, DIFFICULTIES.hard, seed, z, s);
      console.log(`  zone ${z}: 5pt share ${pct(s.pts['5'] ?? 0, s.points)}, avg match ${(s.seconds / s.matches).toFixed(0)}s, points/match ${(s.points / s.matches).toFixed(1)}`);
    }
  });
});

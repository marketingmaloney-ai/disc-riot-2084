import { CHARACTERS } from '../sim/characters';
import type { CharStats } from './progress';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  points: number;
  /** current progress / goal, for the progress bar */
  progress: (s: CharStats) => [number, number];
}

const count = (key: keyof CharStats, goal: number) => (s: CharStats): [number, number] => [Math.min(goal, s[key] as number), goal];

/** Each character earns these separately. Total 24 points; maxing all attributes costs 20. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'FIRST BLOOD', desc: 'Win a match', points: 1, progress: count('wins', 1) },
  { id: 'win_normal', name: 'CONTENDER', desc: 'Beat a NORMAL CPU', points: 1, progress: count('winsNormal', 1) },
  { id: 'win_hard', name: 'CHAMPION', desc: 'Beat a HARD CPU', points: 2, progress: count('winsHard', 1) },
  { id: 'flawless', name: 'FLAWLESS', desc: 'Win a set without conceding a point', points: 1, progress: count('flawlessSets', 1) },
  { id: 'comeback', name: 'COMEBACK KID', desc: 'Win a set after trailing by 6+', points: 1, progress: count('comebacks', 1) },
  { id: 'curve10', name: 'CURVE ARTIST', desc: 'Score 10 curve-shot goals', points: 1, progress: count('curveGoals', 10) },
  { id: 'curve50', name: 'CURVE MASTER', desc: 'Score 50 curve-shot goals', points: 2, progress: count('curveGoals', 50) },
  { id: 'power10', name: 'SONIC BOOM', desc: 'Score 10 power-shot goals', points: 1, progress: count('powerGoals', 10) },
  { id: 'power50', name: 'SOUND BARRIER', desc: 'Score 50 power-shot goals', points: 2, progress: count('powerGoals', 50) },
  { id: 'super5', name: 'SUPERSTAR', desc: 'Score 5 goals with your super', points: 1, progress: count('superGoals', 5) },
  { id: 'super25', name: 'MEGASTAR', desc: 'Score 25 goals with your super', points: 2, progress: count('superGoals', 25) },
  { id: 'big10', name: 'BULLSEYE', desc: 'Score 10 five-point goals', points: 1, progress: count('bigGoals', 10) },
  { id: 'catch100', name: 'THE WALL', desc: 'Make 100 catches', points: 1, progress: count('catches', 100) },
  { id: 'supercatch', name: 'NOT TODAY', desc: 'Catch an enemy super', points: 1, progress: count('superCatches', 1) },
  { id: 'veteran10', name: 'REGULAR', desc: 'Play 10 matches', points: 1, progress: count('matches', 10) },
  { id: 'veteran50', name: 'VETERAN', desc: 'Play 50 matches', points: 1, progress: count('matches', 50) },
  { id: 'tour', name: 'WORLD TOUR', desc: 'Win a match on every arena', points: 2, progress: (s) => [Math.min(4, s.arenasWon.length), 4] },
  { id: 'rivals', name: 'NO RIVALS', desc: 'Beat every other fighter', points: 2, progress: (s) => [Math.min(CHARACTERS.length - 1, s.rivalsBeaten.length), CHARACTERS.length - 1] },
];

export const isDone = (a: Achievement, s: CharStats) => {
  const [v, g] = a.progress(s);
  return v >= g;
};

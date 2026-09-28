import { CHARACTERS } from '../sim/characters';
import { MAX_ATTR_LEVEL } from '../sim/constants';
import type { StatLevels } from '../sim/types';

export type Attr = keyof StatLevels;
export const ATTRS: { id: Attr; label: string; desc: string }[] = [
  { id: 'speed', label: 'SPEED', desc: '+3% run & dash per level' },
  { id: 'power', label: 'POWER', desc: '+3% throw speed per level' },
  { id: 'technique', label: 'TECHNIQUE', desc: '+5% curve bend, +2% power-shot speed' },
  { id: 'reflex', label: 'REFLEX', desc: '+3% catch reach, wider power-shot timing' },
];

/** Lifetime counters per character (VS CPU only). */
export interface CharStats {
  matches: number;
  wins: number;
  winsNormal: number;
  winsHard: number;
  curveGoals: number;
  powerGoals: number;
  superGoals: number;
  bigGoals: number;
  catches: number;
  superCatches: number;
  flawlessSets: number;
  comebacks: number;
  arenasWon: string[];
  rivalsBeaten: string[];
}

export interface CharProfile {
  levels: StatLevels;
  earned: number; // total points ever earned
  unlocked: string[]; // achievement ids
  stats: CharStats;
}

export interface Profile {
  version: 1;
  chars: Record<string, CharProfile>;
}

const KEY = 'discriot2084.profile.v1';

const blankStats = (): CharStats => ({
  matches: 0, wins: 0, winsNormal: 0, winsHard: 0, curveGoals: 0, powerGoals: 0, superGoals: 0,
  bigGoals: 0, catches: 0, superCatches: 0, flawlessSets: 0, comebacks: 0, arenasWon: [], rivalsBeaten: [],
});
const blankChar = (): CharProfile => ({
  levels: { speed: 0, power: 0, technique: 0, reflex: 0 }, earned: 0, unlocked: [], stats: blankStats(),
});

let cache: Profile | null = null;

export function loadProfile(): Profile {
  if (cache) return cache;
  let p: Profile = { version: 1, chars: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = JSON.parse(raw) as Profile;
  } catch {
    /* private mode / blocked storage: play without saving */
  }
  for (const c of CHARACTERS) {
    const cp = (p.chars[c.id] ??= blankChar());
    cp.stats = { ...blankStats(), ...cp.stats };
    cp.levels = { ...blankChar().levels, ...cp.levels };
  }
  cache = p;
  return p;
}

export function saveProfile() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export const charProfile = (id: string) => loadProfile().chars[id];
export const spentPoints = (cp: CharProfile) => Object.values(cp.levels).reduce((a, b) => a + b, 0);
export const freePoints = (cp: CharProfile) => cp.earned - spentPoints(cp);
export const totalLevel = (cp: CharProfile) => spentPoints(cp);

export function upgrade(id: string, attr: Attr): boolean {
  const cp = charProfile(id);
  if (freePoints(cp) <= 0 || cp.levels[attr] >= MAX_ATTR_LEVEL) return false;
  cp.levels[attr]++;
  saveProfile();
  return true;
}

export function downgrade(id: string, attr: Attr): boolean {
  const cp = charProfile(id);
  if (cp.levels[attr] <= 0) return false;
  cp.levels[attr]--;
  saveProfile();
  return true;
}

export function resetAllProgress() {
  cache = { version: 1, chars: {} };
  saveProfile();
  cache = null;
  loadProfile();
}

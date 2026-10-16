import type { LobSuperDef, SuperDef, SuperKind } from './characters';

/** One tick of input for one player, in court space. mx>0 = toward +x (screen right), mz>0 = toward camera. */
/** Attribute upgrade levels (0..MAX_ATTR_LEVEL) earned through achievements. VS CPU only. */
export interface StatLevels {
  speed: number;
  power: number;
  technique: number;
  reflex: number;
}

export interface InputFrame {
  mx: number;
  mz: number;
  a: boolean; // pressed this tick (edge)
  b: boolean; // pressed this tick (edge)
}

export const NO_INPUT: InputFrame = { mx: 0, mz: 0, a: false, b: false };

export type PlayerState =
  | 'idle' | 'walk' | 'dash' | 'recover' | 'hold' | 'throw' | 'lob' | 'block' | 'knock' | 'win' | 'lose';

export interface Player {
  idx: 0 | 1;
  side: -1 | 1; // -1 = left half (x<0)
  charId: string;
  speed: number;
  power: number;
  curve: number;
  supers: [SuperDef, SuperDef];
  lobSuper: LobSuperDef;
  catchR: number; // catch reach (REFLEX)
  ssWindow: number; // power-shot timing window in ticks (REFLEX)
  ssMult: number; // power-shot speed multiplier (TECHNIQUE)
  x: number;
  z: number;
  px: number; // previous tick position (render interpolation)
  pz: number;
  dvx: number; // dash direction velocity
  dvz: number;
  moving: boolean;
  state: PlayerState;
  t: number; // time in state
  holdT: number;
  charged: boolean;
  serving: boolean;
  dirHist: { mx: number; mz: number }[];
  aAge: number; // ticks since A pressed
  bAge: number;
  knockT: number; // how long the current knock lasts (s)
  knockV: number; // knockback speed (m/s)
  frozen: number; // >0 while frozen by an ice super (render tint)
}

export type DiscMode = 'held' | 'flight' | 'lob' | 'ground' | 'dead';
export type ShotKind = 'normal' | 'supersonic' | 'curve' | 'super' | 'lob' | 'toss';

export interface Lob {
  sx: number; sz: number; sh: number;
  tx: number; tz: number;
  t: number; T: number; peak: number;
  superLob: boolean;
  lobSuper: LobSuperDef | null; // what a super lob does on landing
  bounces: number; // bounces left for a bouncing super lob
}

export interface Disc {
  mode: DiscMode;
  x: number; z: number; h: number;
  px: number; pz: number; ph: number;
  vx: number; vz: number;
  az: number; // lateral (curve) acceleration
  kind: ShotKind;
  superKind: SuperKind | null;
  superDef: SuperDef | null; // the super in flight (knock/stun/speed params)
  superBase: number; // thrower's power, for speed-shaped supers
  superDir: number; // +1/-1 travel direction along x
  superDone: boolean; // one-shot phase change already happened (orbit loop, stop-and-go fire)
  superT: number;
  zigSign: number;
  thrower: number; // player idx who last threw, -1 none
  holder: number; // player idx holding, -1 none
  lob: Lob | null;
  spin: number;
}

export type Phase = 'serve' | 'play' | 'point' | 'setEnd' | 'matchEnd';

export interface GameEvent {
  type:
    | 'catch' | 'throw' | 'supersonic' | 'curve' | 'super' | 'lob' | 'toss' | 'block'
    | 'wall' | 'score' | 'drop' | 'reversal' | 'dash' | 'charge' | 'serve' | 'setEnd' | 'matchEnd' | 'land';
  p?: number;
  x?: number;
  z?: number;
  pts?: number;
  big?: boolean;
  shot?: ShotKind; // for 'score': the kind of shot that scored
  v?: number; // for 'super': which of the thrower's supers (0 = A, 1 = up/down + A, 2 = lob)
  by?: number; // for 'score': who threw it (-1 = none)
}

export interface GameState {
  tick: number;
  players: [Player, Player];
  disc: Disc;
  score: [number, number];
  sets: [number, number];
  setNo: number;
  setTime: number;
  phase: Phase;
  phaseT: number;
  server: number;
  hitstop: number;
  lastScorer: number;
  lastPts: number;
  matchWinner: number;
  bigZoneHalf: number; // arena-specific 5-point zone half-width
  suddenDeath: boolean; // sets tied at 2-2: next score wins the match
  events: GameEvent[];
}

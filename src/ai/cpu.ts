import { deflect } from '../sim/game';
import * as C from '../sim/constants';
import type { GameState, InputFrame } from '../sim/types';

export interface Difficulty {
  reaction: number; // ticks before reacting to a new throw
  error: number; // meters of intercept error
  supersonic: number; // chance to attempt timed return
  dash: number; // willingness to dash for far discs
  variety: number; // chance of fancy shots (curve/lob/toss)
  holdMin: number;
  holdMax: number; // ticks held before throwing
}

export const DIFFICULTIES: Record<'easy' | 'normal' | 'hard', Difficulty> = {
  easy: { reaction: 20, error: 0.95, supersonic: 0, dash: 0.12, variety: 0.15, holdMin: 18, holdMax: 44 }, // a learning partner: slow reads, loose aim, no power shots
  normal: { reaction: 10, error: 0.45, supersonic: 0.15, dash: 0.7, variety: 0.5, holdMin: 6, holdMax: 26 },
  hard: { reaction: 6, error: 0.24, supersonic: 0.4, dash: 1, variety: 0.7, holdMin: 2, holdMax: 14 },
};

export class CpuPlayer {
  private rngState: number;
  private plan: InputFrame[] = [];
  private lastThrowTick = -1;
  private lastThrower = -2;
  private reactUntil = 0;
  private aimErr = 0;
  private triedSS = false;
  private holdStart = -1;
  private holdWait = 0;

  constructor(public idx: 0 | 1, public diff: Difficulty, seed = 1234) {
    this.rngState = seed >>> 0;
  }

  private rand() {
    // mulberry32
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  think(g: GameState): InputFrame {
    const me = g.players[this.idx];
    const d = g.disc;
    const none: InputFrame = { mx: 0, mz: 0, a: false, b: false };
    if (g.phase !== 'play') { this.plan = []; this.holdStart = -1; return none; }

    if (this.plan.length) return this.plan.shift()!;

    // --- Holding: decide a shot ---
    if (me.state === 'hold') {
      if (this.holdStart < 0) {
        this.holdStart = g.tick;
        const D = this.diff;
        this.holdWait = Math.floor(D.holdMin + this.rand() * (D.holdMax - D.holdMin));
        if (me.serving) this.holdWait += 20;
      }
      if (g.tick - this.holdStart < this.holdWait) return none;
      this.holdStart = -1;
      this.buildShotPlan(g);
      return this.plan.shift() ?? none;
    }
    this.holdStart = -1;

    // --- React to new throws ---
    if (d.thrower !== this.lastThrower || (d.mode === 'flight' && this.lastThrowTick < 0)) {
      this.lastThrower = d.thrower;
      this.lastThrowTick = g.tick;
      this.reactUntil = g.tick + this.diff.reaction;
      // Harder shots are harder to read: error grows with speed, curve and supers.
      const spd = Math.hypot(d.vx, d.vz);
      const read = 1 + Math.abs(d.az) / 22 + Math.max(0, spd - 18) / 10 + (d.kind === 'super' ? 0.3 : 0);
      this.aimErr = (this.rand() * 2 - 1) * this.diff.error * read;
      this.triedSS = false;
    }
    if (d.mode === 'held' || d.mode === 'dead') this.lastThrowTick = -1;

    let tx = me.side * 5.2;
    let tz = d.z * 0.35;
    let urgent = false;
    let timeToArrive = 99;

    if (g.tick >= this.reactUntil) {
      if (d.mode === 'lob' && d.lob && Math.sign(d.lob.tx) === me.side) {
        tx = d.lob.tx;
        tz = d.lob.tz + this.aimErr * 0.4;
        if (d.lob.superLob) {
          // a super lob's slam can't be caught: stand off it, between the landing and the goal, to grab the skid
          tx = clampX(d.lob.tx + me.side * C.SUPER_LOB_STANDOFF, me.side);
          if (d.lob.lobSuper?.kind === 'corner' || (d.lob.lobSuper?.kind === 'bounce' && d.lob.bounces === 0)) tz = d.lob.tz + (me.z > d.lob.tz ? 1 : -1) * 1.2;
        }
        timeToArrive = (d.lob.T - d.lob.t) / C.DT;
        urgent = true;
      } else if ((d.mode === 'flight' || d.mode === 'ground') && d.thrower !== this.idx) {
        // Curves are read late: until the bend is visible, assume the disc flies straight.
        const readsCurve = g.tick - this.lastThrowTick > this.diff.reaction * 2.5;
        const pred = predictIntercept(g, me.x, readsCurve);
        if (pred) {
          tz = pred.z + this.aimErr;
          tx = me.x;
          timeToArrive = pred.ticks;
          urgent = true;
        }
      }
    }

    const dx = tx - me.x;
    const dz = tz - me.z;
    const mx = Math.abs(dx) > 0.2 ? Math.sign(dx) : 0;
    const mz = Math.abs(dz) > 0.15 ? Math.sign(dz) : 0;
    let a = false;
    let b = false;

    if (urgent && d.mode !== 'lob') {
      const dist = Math.hypot(dx, dz);
      const reachable = me.speed * timeToArrive * C.DT;
      if (dist > reachable + 0.4 && dist < reachable * C.DASH_MULT + 1 && this.rand() < this.diff.dash * 0.25 && me.state === 'walk') {
        a = true; // dash
      }
      if (!this.triedSS && timeToArrive <= 4 && dist < C.CATCH_RADIUS) {
        this.triedSS = true;
        if (this.rand() < this.diff.supersonic) a = true;
        else if (this.rand() < this.diff.variety * 0.15) b = true; // block toss for a super
      }
    }
    
    return { mx, mz, a, b };
  }

  private buildShotPlan(g: GameState) {
    const me = g.players[this.idx];
    const opp = g.players[1 - this.idx];
    const fwd = -me.side;
    const r = this.rand();
    const V = this.diff.variety;
    // Aim away from the opponent.
    const away = opp.z > 0.5 ? -1 : opp.z < -0.5 ? 1 : this.rand() < 0.5 ? -1 : 1;

    if (!me.charged && r < V * 0.12) {
      // self toss to charge a super
      this.plan.push({ mx: -fwd, mz: 0, a: false, b: true });
      return;
    }
    if (r < V * 0.35) {
      // curve: vertical then forward + A
      const v = away;
      for (let i = 0; i < 3; i++) this.plan.push({ mx: 0, mz: v, a: false, b: false });
      this.plan.push({ mx: fwd, mz: 0, a: true, b: false });
      return;
    }
    if (r < V * 0.5 && opp.x * opp.side < 5.5) {
      this.plan.push({ mx: 0, mz: away, a: false, b: true });
      return;
    }
    const angled = this.rand() < 0.6;
    this.plan.push({ mx: fwd, mz: angled ? away : 0, a: true, b: false });
  }
}

/** Roll the disc forward (ignoring supers' exotic paths) to where it crosses x = lineX. */
function predictIntercept(g: GameState, lineX: number, knowsCurve = true): { z: number; ticks: number } | null {
  const d = g.disc;
  let x = d.x, z = d.z, vx = d.vx, vz = d.vz, az = knowsCurve ? d.az : 0;
  // Oscillating supers: defend the center line of the wave/zigzag, not its current swing.
  if (d.kind === 'super' && (d.superKind === 'wave' || d.superKind === 'zigzag' || d.superKind === 'spiral')) {
    vz = 0;
    az = 0;
    if (d.superKind === 'wave') z = d.z - C.WAVE_AMP * Math.sin(C.WAVE_FREQ * d.superT) * d.zigSign;
  }
  // decoys: until the fakes fade, the CPU follows the fake that flies straight
  if (d.kind === 'super' && d.superKind === 'decoy' && d.superT < C.DECOY_FOOL) {
    vz = 0;
    az = 0;
    z = d.z - Math.max(0, d.superT - C.DECOY_SPLIT) * C.DECOY_DRIFT * d.zigSign;
  }
  if (vx === 0) return null;
  const zLim = C.COURT_HALF_WID - C.DISC_RADIUS;
  for (let i = 0; i < 150; i++) {
    vz += az * C.DT;
    x += vx * C.DT;
    z += vz * C.DT;
    if (Math.abs(z) > zLim) { z = Math.sign(z) * zLim; vz = -vz; az = -az; }
    if (!d.superKind && g.court.bumpers.length) {
      const b = deflect(g.court, x, z, vx, vz);
      if (b) { ({ x, z, vx, vz } = b); az = 0; }
    }
    if ((vx > 0 && x >= lineX) || (vx < 0 && x <= lineX)) return { z, ticks: i };
  }
  return null;
}

/** Keep an x target inside the player's own half. */
function clampX(x: number, side: number) {
  const lim = C.PLAYER_MAX_X;
  return side < 0 ? Math.max(-lim, Math.min(-C.PLAYER_MIN_X, x)) : Math.min(lim, Math.max(C.PLAYER_MIN_X, x));
}

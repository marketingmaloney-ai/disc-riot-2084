import { step } from '../sim/game';
import type { GameEvent, GameState, InputFrame } from '../sim/types';

/**
 * Rollback netcode for online versus (GGPO style). The sim is a pure function of (state, inputs), so each
 * peer runs the match locally, guesses the opponent's input for frames it hasn't heard yet, and when the
 * real input arrives and differs, rewinds to the saved state of that frame and re-simulates to now.
 *
 * - Local inputs are delayed by `delay` frames, which hides most of the latency without any rollback.
 * - A peer that gets more than `maxRollback` frames ahead of what it has heard waits (stalls) instead.
 * - Time sync: each message says how far ahead its sender is; the peer that runs ahead skips a frame now
 *   and then so neither side does all the rollbacks.
 * - Inputs go out in pairs of frames: half the messages, which keeps the relay inside its free tier.
 * - Desync guard: phones differ in the last bit of Math.sin & co (iPhone vs Android engines), so the host
 *   sends its confirmed state every SYNC_EVERY frames and the guest adopts it if its own hash differs.
 */

export type NetMsg =
  | { t: 'in'; f: number; i: number[]; a: number } // inputs for frames f, f+1, ..., sender's frame advantage
  | { t: 'sync'; f: number; s: string }; // host: JSON of the state after frame f (both inputs confirmed)

export const SYNC_EVERY = 60;
const NEUTRAL = 5; // pack({mx:0, mz:0, a:false, b:false})

export const pack = (i: InputFrame) => (i.mx + 1) | ((i.mz + 1) << 2) | (i.a ? 16 : 0) | (i.b ? 32 : 0);
export const unpack = (n: number): InputFrame => ({ mx: (n & 3) - 1, mz: ((n >> 2) & 3) - 1, a: !!(n & 16), b: !!(n & 32) });
/** Guess for an unheard frame: keep holding the same direction, but never repeat a button tap. */
const predict = (last: number) => last & 15;

export function hashState(g: GameState) {
  const s = JSON.stringify({ ...g, events: undefined });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const clone = (g: GameState): GameState => structuredClone(g);

export class RollbackSession {
  /** next frame to simulate */
  frame = 0;
  /** highest frame for which the remote input is known (they arrive in order) */
  remoteConfirmed = -1;
  rollbacks = 0;
  resimFrames = 0;
  stalledFor = 0;
  desyncs = 0;
  private localIn = new Map<number, number>();
  private remoteIn = new Map<number, number>();
  private used = new Map<number, number>(); // remote input each simulated frame was run with
  private snaps = new Map<number, GameState>(); // state BEFORE simulating frame f
  private rollbackFrom = Infinity;
  private lastRemote = NEUTRAL;
  private remoteAdvantage = 0;
  private skipT = 0;
  private synced = -1; // highest frame both sides have confirmed and this peer has hashed
  private myHash = new Map<number, string>();
  private hostState = new Map<number, string>();
  private outbox: number[] = [];
  private outFrom = 0;

  constructor(
    public game: GameState,
    public readonly me: 0 | 1,
    private send: (m: NetMsg) => void,
    public readonly delay = 2,
    public readonly maxRollback = 10,
    public readonly batch = 2,
  ) {
    // the opening `delay` frames have no input from anyone: neutral on both sides, never sent
    for (let f = 0; f < delay; f++) { this.localIn.set(f, NEUTRAL); this.remoteIn.set(f, NEUTRAL); }
    this.remoteConfirmed = delay - 1;
  }

  /** How many frames this peer runs ahead of the opponent (smoothed). */
  get advantage() {
    return this.frame - 1 - this.remoteConfirmed;
  }

  /** True when the next tick must wait for the opponent. */
  get stalled() {
    return this.frame - this.remoteConfirmed > this.maxRollback;
  }

  /**
   * One fixed tick. `poll` is called only when a frame really advances, so taps made while waiting aren't
   * lost. Returns the events of the newest frame, or null when waiting for the opponent (or skipping a
   * frame to let them catch up).
   */
  tick(poll: () => InputFrame): GameEvent[] | null {
    this.applyRollback();
    if (this.stalled) { this.stalledFor++; return null; }
    this.stalledFor = 0;
    // time sync: if we're clearly ahead of the opponent, wait one frame every so often
    const lead = (this.advantage - this.remoteAdvantage) / 2;
    if (lead > 1 && ++this.skipT >= 6) { this.skipT = 0; return null; }
    const f = this.frame + this.delay;
    const v = pack(poll());
    this.localIn.set(f, v);
    if (!this.outbox.length) this.outFrom = f;
    this.outbox.push(v);
    if (this.outbox.length >= this.batch) {
      this.send({ t: 'in', f: this.outFrom, i: this.outbox, a: this.advantage });
      this.outbox = [];
    }
    this.simFrame();
    this.checkSync();
    this.prune();
    return this.game.events;
  }

  receive(m: NetMsg) {
    if (m.t === 'in') {
      m.i.forEach((v, k) => {
        const f = m.f + k;
        this.remoteIn.set(f, v);
        if (f < this.frame && this.used.get(f) !== v) this.rollbackFrom = Math.min(this.rollbackFrom, f);
      });
      this.remoteAdvantage = m.a;
      while (this.remoteIn.has(this.remoteConfirmed + 1)) this.remoteConfirmed++;
      this.lastRemote = this.remoteIn.get(this.remoteConfirmed)!;
      this.checkSync();
    } else if (m.t === 'sync' && this.me === 1) {
      this.hostState.set(m.f, m.s);
      this.compare(m.f);
    }
  }

  private inputs(f: number): [InputFrame, InputFrame] {
    const local = this.localIn.get(f) ?? NEUTRAL;
    let remote = this.remoteIn.get(f);
    if (remote === undefined) remote = predict(this.lastRemote);
    this.used.set(f, remote);
    return this.me === 0 ? [unpack(local), unpack(remote)] : [unpack(remote), unpack(local)];
  }

  private simFrame() {
    this.snaps.set(this.frame, clone(this.game));
    step(this.game, this.inputs(this.frame));
    this.frame++;
  }

  /** Rewind to the first mispredicted frame and replay to now. Events of replayed frames are dropped. */
  private applyRollback() {
    if (this.rollbackFrom === Infinity) return;
    const from = this.rollbackFrom;
    this.rollbackFrom = Infinity;
    const snap = this.snaps.get(from);
    if (!snap || from >= this.frame) return;
    const to = this.frame;
    this.game = clone(snap);
    this.frame = from;
    while (this.frame < to) { this.simFrame(); this.resimFrames++; }
    this.rollbacks++;
  }

  /** The state after frame f, if we still have it. */
  private stateAfter(f: number) {
    return f + 1 === this.frame ? this.game : this.snaps.get(f + 1);
  }

  private checkSync() {
    this.applyRollback(); // never hash a state built on a guess we already know is wrong
    const upTo = Math.min(this.remoteConfirmed, this.frame - 1);
    while (this.synced < upTo) {
      this.synced++;
      const f = this.synced;
      if (f % SYNC_EVERY !== 0) continue;
      const st = this.stateAfter(f);
      if (!st) continue;
      if (this.me === 0) this.send({ t: 'sync', f, s: JSON.stringify({ ...st, events: [] }) });
      else { this.myHash.set(f, hashState({ ...st, events: [] })); this.compare(f); }
    }
  }

  /** Guest: adopt the host's state for frame f if ours differs, then replay forward from it. */
  private compare(f: number) {
    const mine = this.myHash.get(f), host = this.hostState.get(f);
    if (mine === undefined || host === undefined) return;
    this.myHash.delete(f);
    this.hostState.delete(f);
    const hs = JSON.parse(host) as GameState;
    if (hashState(hs) === mine) return;
    this.desyncs++;
    const to = this.frame;
    this.game = hs;
    this.frame = f + 1;
    while (this.frame < to) this.simFrame();
  }

  private prune() {
    const keep = Math.min(this.synced, this.remoteConfirmed) - 1;
    for (const k of this.snaps.keys()) if (k < keep) this.snaps.delete(k);
    const old = this.frame - 600;
    for (const m of [this.localIn, this.remoteIn, this.used]) for (const k of m.keys()) { if (k < old) m.delete(k); else break; }
    for (const k of this.myHash.keys()) if (k < old) this.myHash.delete(k);
    for (const k of this.hostState.keys()) if (k < old) this.hostState.delete(k);
  }
}

import * as C from './constants';
import { charById } from './characters';
import type { Disc, GameState, InputFrame, Player } from './types';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function makePlayer(idx: 0 | 1, charId: string): Player {
  const c = charById(charId);
  return {
    idx, side: idx === 0 ? -1 : 1, charId,
    speed: c.speed, power: c.power, curve: c.curve, superKind: c.superKind,
    x: 0, z: 0, px: 0, pz: 0, dvx: 0, dvz: 0, moving: false,
    state: 'idle', t: 0, holdT: 0, charged: false, serving: false,
    dirHist: [], aAge: 999, bAge: 999,
  };
}

function makeDisc(): Disc {
  return {
    mode: 'held', x: 0, z: 0, h: 1, px: 0, pz: 0, ph: 1, vx: 0, vz: 0, az: 0,
    kind: 'normal', superKind: null, superT: 0, zigSign: 1,
    thrower: -1, holder: -1, lob: null, spin: 0,
  };
}

export function createGame(p1Char: string, p2Char: string, bigZoneHalf = C.BIG_ZONE_HALF): GameState {
  const g: GameState = {
    tick: 0,
    players: [makePlayer(0, p1Char), makePlayer(1, p2Char)],
    disc: makeDisc(),
    score: [0, 0], sets: [0, 0], setNo: 1, setTime: C.SET_TIME,
    phase: 'serve', phaseT: C.SERVE_DELAY, server: 0, hitstop: 0,
    lastScorer: -1, lastPts: 0, matchWinner: -1, bigZoneHalf, events: [],
  };
  resetForServe(g);
  return g;
}

const fwdOf = (p: Player) => -p.side; // +1 means toward +x

function resetForServe(g: GameState) {
  for (const p of g.players) {
    p.x = p.px = p.side * 5.5;
    p.z = p.pz = 0;
    p.state = 'idle'; p.t = 0; p.charged = false; p.serving = false; p.holdT = 0;
  }
  const s = g.players[g.server];
  s.state = 'hold'; s.serving = true;
  const d = g.disc;
  d.mode = 'held'; d.holder = s.idx; d.thrower = -1; d.lob = null; d.kind = 'normal';
  placeHeld(d, s);
  d.px = d.x; d.pz = d.z; d.ph = d.h;
  g.phase = 'serve';
  g.phaseT = C.SERVE_DELAY;
  g.events.push({ type: 'serve', p: s.idx });
}

function placeHeld(d: Disc, p: Player) {
  d.x = p.x + fwdOf(p) * 0.45;
  d.z = p.z + 0.05;
  d.h = 1.05;
}

/** Advance the game exactly one fixed tick. Pure function of (state, inputs). */
export function step(g: GameState, inputs: [InputFrame, InputFrame]) {
  g.events = [];
  for (let i = 0; i < 2; i++) recordInput(g.players[i], inputs[i]);

  if (g.hitstop > 0) { g.hitstop--; return; }
  g.tick++;

  for (const p of g.players) { p.px = p.x; p.pz = p.z; }
  const d = g.disc;
  d.px = d.x; d.pz = d.z; d.ph = d.h;

  switch (g.phase) {
    case 'serve':
      g.phaseT -= C.DT;
      if (g.phaseT <= 0) g.phase = 'play';
      break;
    case 'play':
      for (let i = 0; i < 2; i++) updatePlayer(g, g.players[i], inputs[i]);
      updateDisc(g);
      g.setTime = Math.max(0, g.setTime - C.DT);
      if (g.phase === 'play' && g.setTime <= 0 && g.score[0] !== g.score[1]) endSet(g);
      break;
    case 'point':
      g.phaseT -= C.DT;
      settlePlayers(g);
      if (g.phaseT <= 0) {
        const [a, b] = g.score;
        if (a >= C.SET_POINTS || b >= C.SET_POINTS || (g.setTime <= 0 && a !== b)) endSet(g);
        else resetForServe(g);
      }
      break;
    case 'setEnd':
      g.phaseT -= C.DT;
      if (g.phaseT <= 0) {
        if (g.sets[0] >= C.SETS_TO_WIN || g.sets[1] >= C.SETS_TO_WIN) {
          g.phase = 'matchEnd';
          g.matchWinner = g.sets[0] > g.sets[1] ? 0 : 1;
          g.events.push({ type: 'matchEnd', p: g.matchWinner });
        } else {
          g.setNo++;
          g.score = [0, 0];
          g.setTime = C.SET_TIME;
          resetForServe(g);
        }
      }
      break;
    case 'matchEnd':
      break;
  }
  d.spin += C.DT * (d.mode === 'flight' ? 30 : d.mode === 'lob' ? 14 : 2);
}

function recordInput(p: Player, inp: InputFrame) {
  p.dirHist.push({ mx: inp.mx, mz: inp.mz });
  if (p.dirHist.length > C.CURVE_WINDOW) p.dirHist.shift();
  p.aAge = inp.a ? 0 : Math.min(999, p.aAge + 1);
  p.bAge = inp.b ? 0 : Math.min(999, p.bAge + 1);
}

function settlePlayers(g: GameState) {
  for (const p of g.players) {
    p.t += C.DT;
    if (p.state === 'dash' || p.state === 'walk') p.state = 'idle';
  }
}

function endSet(g: GameState) {
  const w = g.score[0] > g.score[1] ? 0 : 1;
  g.sets[w]++;
  g.phase = 'setEnd';
  g.phaseT = 3.2;
  g.server = 1 - w;
  g.players[w].state = 'win';
  g.players[1 - w].state = 'lose';
  g.disc.mode = 'dead';
  g.events.push({ type: 'setEnd', p: w });
}

function setState(p: Player, s: Player['state']) {
  p.state = s;
  p.t = 0;
}

function updatePlayer(g: GameState, p: Player, inp: InputFrame) {
  p.t += C.DT;
  const d = g.disc;
  const fwd = fwdOf(p);
  p.moving = false;

  switch (p.state) {
    case 'hold': {
      p.holdT += C.DT;
      placeHeld(d, p);
      const maxHold = p.serving ? C.HOLD_MAX * 2 : C.HOLD_MAX;
      if (p.bAge === 0) {
        const back = inp.mx * fwd < 0;
        if (back && !p.charged) selfToss(g, p);
        else throwLob(g, p, inp);
      } else if (p.aAge === 0 || p.holdT >= maxHold) {
        throwDisc(g, p, inp, false);
      }
      return;
    }
    case 'throw':
    case 'lob':
    case 'block':
      if (p.t > 0.16) setState(p, 'idle');
      return;
    case 'recover':
      if (p.t > C.DASH_RECOVER) setState(p, 'idle');
      return;
    case 'knock':
      p.x = clamp(p.x - fwd * 3.2 * C.DT, -C.PLAYER_MAX_X, C.PLAYER_MAX_X);
      clampToHalf(p);
      if (p.t > 0.22) setState(p, 'hold');
      placeHeld(d, p);
      return;
    case 'dash':
      p.x += p.dvx * C.DT;
      p.z += p.dvz * C.DT;
      clampToHalf(p);
      p.moving = true;
      if (p.t > C.DASH_TIME) setState(p, 'recover');
      tryCatch(g, p);
      return;
    case 'win':
    case 'lose':
      return;
    default: {
      // idle / walk
      let mx = inp.mx, mz = inp.mz;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }
      if (p.bAge === 0 && tryBlock(g, p)) return;
      if (p.aAge === 0 && len > 0) {
        setState(p, 'dash');
        p.dvx = mx * p.speed * C.DASH_MULT;
        p.dvz = mz * p.speed * C.DASH_MULT;
        g.events.push({ type: 'dash', p: p.idx });
        return;
      }
      p.x += mx * p.speed * C.DT;
      p.z += mz * p.speed * C.DT;
      clampToHalf(p);
      p.moving = len > 0;
      if (p.state !== (p.moving ? 'walk' : 'idle')) p.state = p.moving ? 'walk' : 'idle';
      tryCatch(g, p);
    }
  }
}

function clampToHalf(p: Player) {
  if (p.side < 0) p.x = clamp(p.x, -C.PLAYER_MAX_X, -C.PLAYER_MIN_X);
  else p.x = clamp(p.x, C.PLAYER_MIN_X, C.PLAYER_MAX_X);
  p.z = clamp(p.z, -C.PLAYER_MAX_Z, C.PLAYER_MAX_Z);
}

function tryCatch(g: GameState, p: Player) {
  const d = g.disc;
  if (d.mode !== 'flight' && d.mode !== 'ground') return;
  if (d.thrower === p.idx && d.mode === 'flight') return;
  if (d.h > C.CATCH_HEIGHT) return;
  const reach = d.kind === 'super' ? C.CATCH_RADIUS * C.SUPER_CATCH_MULT : C.CATCH_RADIUS;
  if (Math.hypot(d.x - p.x, d.z - p.z) > reach) return;
  catchDisc(g, p, false);
}

function catchDisc(g: GameState, p: Player, fromLob: boolean) {
  const d = g.disc;
  const wasSuper = d.kind === 'super';
  d.mode = 'held';
  d.holder = p.idx;
  d.lob = null;
  d.superKind = null;
  p.holdT = 0;
  p.serving = false;
  if (fromLob && d.thrower === p.idx) {
    p.charged = true;
    g.events.push({ type: 'charge', p: p.idx, x: p.x, z: p.z });
  }
  g.events.push({ type: 'catch', p: p.idx, x: d.x, z: d.z, big: wasSuper });
  if (wasSuper) {
    setState(p, 'knock');
    g.hitstop = C.HITSTOP_SUPER;
  } else {
    setState(p, 'hold');
    g.hitstop = C.HITSTOP_CATCH;
    // Timed A press right before the catch => instant supersonic return.
    if (!fromLob && p.aAge <= C.SUPERSONIC_WINDOW) {
      const last = p.dirHist[p.dirHist.length - 1] ?? { mx: 0, mz: 0 };
      throwDisc(g, p, { mx: last.mx, mz: last.mz, a: true, b: false }, true);
    }
  }
  placeHeld(d, p);
}

/** Detect a motion input (vertical -> forward) in the recent direction history. Returns the vertical sign or 0. */
function detectCurve(p: Player): number {
  const fwd = fwdOf(p);
  const h = p.dirHist;
  let v = 0;
  let seenForward = false;
  for (let i = 0; i < h.length; i++) {
    const e = h[i];
    if (e.mz !== 0 && e.mx * fwd <= 0) { v = e.mz; seenForward = false; }
    else if (v !== 0 && e.mx * fwd > 0) seenForward = true;
  }
  return v !== 0 && seenForward ? v : 0;
}

function throwDisc(g: GameState, p: Player, inp: InputFrame, supersonic: boolean) {
  const d = g.disc;
  const fwd = fwdOf(p);
  const holdF = Math.max(C.HOLD_MIN_FACTOR, 1 - C.HOLD_DECAY * p.holdT);
  let sp = p.power * holdF * (supersonic ? C.SUPERSONIC_MULT : 1);
  d.mode = 'flight';
  d.holder = -1;
  d.thrower = p.idx;
  d.az = 0;
  d.superT = 0;
  d.superKind = null;
  d.h = 1.0;
  d.x = p.x + fwd * 0.6;

  if (p.charged) {
    p.charged = false;
    d.kind = 'super';
    d.superKind = p.superKind;
    const opp = g.players[1 - p.idx];
    d.zigSign = inp.mz !== 0 ? Math.sign(inp.mz) : opp.z > 0 ? -1 : 1; // default: break away from the defender
    sp = p.power * 1.12;
    const ang = inp.mz * C.ANGLE_SHOT * 0.6;
    if (p.superKind === 'fireball') sp = p.power * 1.3;
    if (p.superKind === 'meteor') sp = p.power * C.METEOR_AIR; // hangs in the air, then slams mid-court
    d.vx = fwd * Math.cos(ang) * sp;
    d.vz = Math.sin(ang) * sp;
    if (p.superKind === 'wave' || p.superKind === 'zigzag') d.vz = 0;
    g.hitstop = C.HITSTOP_CUTIN;
    g.events.push({ type: 'super', p: p.idx, x: p.x, z: p.z });
  } else {
    const cv = detectCurve(p);
    if (cv !== 0) {
      d.kind = 'curve';
      // Swing out toward the input side, then break hard across to the opposite goal corner.
      d.vx = fwd * sp * 0.86;
      d.vz = cv * sp * 0.45;
      const T = Math.max(0.25, (C.COURT_HALF_LEN - fwd * d.x) / Math.abs(d.vx));
      const zEnd = -cv * Math.min(C.COURT_HALF_WID - 0.5, C.CURVE_END_BASE + C.CURVE_END_PER * p.curve);
      d.az = (2 * (zEnd - d.z - d.vz * T)) / (T * T);
      g.events.push({ type: 'curve', p: p.idx });
    } else {
      d.kind = supersonic ? 'supersonic' : 'normal';
      const ang = inp.mz * C.ANGLE_SHOT;
      d.vx = fwd * Math.cos(ang) * sp;
      d.vz = Math.sin(ang) * sp;
    }
    g.events.push({ type: supersonic ? 'supersonic' : 'throw', p: p.idx, x: d.x, z: d.z });
  }
  p.serving = false;
  setState(p, 'throw');
}

function startLob(d: Disc, tx: number, tz: number, T: number, peak: number, superLob: boolean) {
  d.mode = 'lob';
  d.holder = -1;
  d.lob = { sx: d.x, sz: d.z, sh: d.h, tx, tz, t: 0, T, peak, superLob };
}

function throwLob(g: GameState, p: Player, inp: InputFrame) {
  const d = g.disc;
  const fwd = fwdOf(p);
  const k = Math.min(1, p.holdT / C.HOLD_MAX);
  const tx = fwd * lerp(6.9, 2.0, k);
  const tz = clamp(inp.mz * 3.2, -C.PLAYER_MAX_Z, C.PLAYER_MAX_Z);
  const superLob = p.charged;
  p.charged = false;
  d.thrower = p.idx;
  d.kind = superLob ? 'super' : 'lob';
  startLob(d, tx, tz, C.LOB_TIME, C.LOB_PEAK, superLob);
  p.serving = false;
  setState(p, 'lob');
  if (superLob) g.hitstop = C.HITSTOP_CUTIN;
  g.events.push({ type: superLob ? 'super' : 'lob', p: p.idx, x: tx, z: tz });
}

function selfToss(g: GameState, p: Player) {
  const d = g.disc;
  d.thrower = p.idx;
  d.kind = 'toss';
  startLob(d, clamp(p.x + fwdOf(p) * C.TOSS_FORWARD, -C.PLAYER_MAX_X, C.PLAYER_MAX_X), p.z, C.TOSS_TIME, C.TOSS_PEAK, false);
  p.serving = false;
  setState(p, 'lob');
  g.events.push({ type: 'toss', p: p.idx, x: d.lob!.tx, z: d.lob!.tz });
}

/** B pressed near an incoming disc: pop it up on your own side (landing under you charges a super). */
function tryBlock(g: GameState, p: Player): boolean {
  const d = g.disc;
  if (d.mode !== 'flight' || d.thrower === p.idx || d.h > C.CATCH_HEIGHT) return false;
  if (Math.hypot(d.x - p.x, d.z - p.z) > C.BLOCK_RANGE) return false;
  d.thrower = p.idx;
  d.kind = 'toss';
  d.superKind = null;
  const tx = clamp(p.x + fwdOf(p) * 0.9, -C.PLAYER_MAX_X, C.PLAYER_MAX_X);
  startLob(d, p.side < 0 ? Math.min(tx, -C.PLAYER_MIN_X) : Math.max(tx, C.PLAYER_MIN_X), p.z, C.TOSS_TIME, C.TOSS_PEAK, false);
  setState(p, 'block');
  g.hitstop = C.HITSTOP_CATCH;
  g.events.push({ type: 'block', p: p.idx, x: d.x, z: d.z });
  return true;
}

function updateDisc(g: GameState) {
  const d = g.disc;
  if (d.mode === 'lob' && d.lob) {
    const L = d.lob;
    L.t += C.DT;
    const u = Math.min(1, L.t / L.T);
    d.x = lerp(L.sx, L.tx, u);
    d.z = lerp(L.sz, L.tz, u);
    d.h = lerp(L.sh, 0, u) + 4 * L.peak * u * (1 - u);
    if (u >= 1) landLob(g);
    return;
  }
  if (d.mode !== 'flight' && d.mode !== 'ground') return;

  if (d.kind === 'super' && d.superKind) {
    d.superT += C.DT;
    const t = d.superT;
    switch (d.superKind) {
      case 'wave':
        d.vz = C.WAVE_AMP * C.WAVE_FREQ * Math.cos(C.WAVE_FREQ * t) * d.zigSign;
        break;
      case 'zigzag':
        d.vz = ((Math.floor(t / C.ZIG_PERIOD) % 2 === 0 ? 1 : -1) * C.ZIG_VZ + C.ZIG_DRIFT) * d.zigSign;
        break;
      case 'meteor':
        // rise, slam down just past the net, then skid along the ground (catchable) toward the goal
        d.h = t < C.METEOR_RISE ? 1 + (C.METEOR_PEAK - 1) * (t / C.METEOR_RISE) : Math.max(0.3, C.METEOR_PEAK - (t - C.METEOR_RISE) * C.METEOR_DROP);
        if (t > C.METEOR_RISE && t - C.DT <= C.METEOR_RISE) {
          d.vx *= C.METEOR_BOOST;
          d.vz = C.METEOR_KICK * d.zigSign; // ricochets off the slam, away from the defender
        }
        break;
      case 'fireball':
        // THUNDER KISS: a lightning-bolt kink — snaps diagonally across the court once, then straightens.
        if (t < C.BOLT_AT) d.vz = 0;
        else if (t < C.BOLT_AT + C.BOLT_LEN) d.vz = C.BOLT_VZ * d.zigSign;
        else d.vz = 0;
        break;
    }
  } else {
    d.vz += d.az * C.DT;
  }
  d.x += d.vx * C.DT;
  d.z += d.vz * C.DT;

  const zLim = C.COURT_HALF_WID - C.DISC_RADIUS;
  if (Math.abs(d.z) > zLim) {
    d.z = Math.sign(d.z) * zLim;
    d.vz = -d.vz;
    d.az = -d.az;
    d.zigSign = -d.zigSign;
    g.events.push({ type: 'wall', x: d.x, z: d.z });
  }

  for (const p of g.players) {
    if (p.state === 'idle' || p.state === 'walk' || p.state === 'dash' || p.state === 'recover') tryCatch(g, p);
    if ((d.mode as string) === 'held') return;
  }

  const xLim = C.COURT_HALF_LEN - C.DISC_RADIUS;
  if (Math.abs(d.x) > xLim) {
    const goalSide = Math.sign(d.x); // +1 = right player's goal
    const scorer = goalSide > 0 ? 0 : 1;
    const big = Math.abs(d.z) < g.bigZoneHalf;
    d.x = goalSide * xLim;
    award(g, scorer, big ? C.POINTS_BIG : C.POINTS_SMALL, big);
  }
}

function landLob(g: GameState) {
  const d = g.disc;
  const L = d.lob!;
  const landSide = L.tx < 0 ? 0 : 1;
  const p = g.players[landSide];
  const canCatch = p.state !== 'hold' && p.state !== 'knock';
  d.h = 0;
  if (canCatch && Math.hypot(p.x - L.tx, p.z - L.tz) < C.CATCH_RADIUS * 1.25) {
    catchDisc(g, p, true);
    return;
  }
  g.events.push({ type: 'land', x: d.x, z: d.z });
  if (L.superLob) {
    // Super lob: skids along the ground toward the goal after landing.
    d.mode = 'ground';
    d.kind = 'super';
    d.superKind = null;
    d.lob = null;
    d.vx = (landSide === 0 ? -1 : 1) * 14;
    d.vz = 0;
    d.az = 0;
    d.h = 0.25;
    d.thrower = 1 - landSide;
    return;
  }
  g.events.push({ type: 'drop', x: d.x, z: d.z });
  award(g, 1 - landSide, C.POINTS_DROP, false);
}

function award(g: GameState, scorer: number, pts: number, big: boolean) {
  const d = g.disc;
  d.mode = 'dead';
  d.lob = null;
  g.score[scorer] += pts;
  g.lastScorer = scorer;
  g.lastPts = pts;
  g.server = 1 - scorer;
  g.phase = 'point';
  g.phaseT = C.SCORE_PAUSE;
  g.hitstop = 8;
  g.events.push({ type: 'score', p: scorer, pts, big, x: d.x, z: d.z });
}

/** Deep clone for AI lookahead / replays. */
export function cloneState(g: GameState): GameState {
  return structuredClone(g);
}

import * as C from './constants';
import { charById, type LobSuperDef } from './characters';
import type { Disc, GameState, InputFrame, Player, StatLevels } from './types';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function makePlayer(idx: 0 | 1, charId: string, lv?: StatLevels, human = false): Player {
  const c = charById(charId);
  const L = (n = 0) => Math.max(0, Math.min(C.MAX_ATTR_LEVEL, n));
  const sp = L(lv?.speed), pw = L(lv?.power), te = L(lv?.technique), rf = L(lv?.reflex);
  return {
    idx, side: idx === 0 ? -1 : 1, charId,
    speed: c.speed * (1 + C.ATTR_SPEED * sp) * (human ? C.HUMAN_SPEED_MULT : 1),
    power: c.power * (1 + C.ATTR_POWER * pw),
    curve: c.curve * (1 + C.ATTR_TECH_CURVE * te),
    supers: c.supers,
    lobSuper: c.lobSuper,
    catchR: C.CATCH_RADIUS * (c.reach ?? 1) * (1 + C.ATTR_REFLEX_REACH * rf) * (human ? C.HUMAN_CATCH_MULT : 1),
    ssWindow: C.SUPERSONIC_WINDOW + rf,
    ssMult: C.SUPERSONIC_MULT * (1 + C.ATTR_TECH_SS * te),
    x: 0, z: 0, px: 0, pz: 0, dvx: 0, dvz: 0, moving: false,
    state: 'idle', t: 0, holdT: 0, charged: false, serving: false,
    dirHist: [], aAge: 999, bAge: 999,
    knockT: C.KNOCK_TIME, knockV: C.KNOCK_SPEED, frozen: 0,
  };
}

function makeDisc(): Disc {
  return {
    mode: 'held', x: 0, z: 0, h: 1, px: 0, pz: 0, ph: 1, vx: 0, vz: 0, az: 0,
    kind: 'normal', superKind: null, superDef: null, superBase: 0, superDir: 1, superDone: false, superT: 0, zigSign: 1,
    thrower: -1, holder: -1, lob: null, spin: 0,
  };
}

export function createGame(
  p1Char: string,
  p2Char: string,
  bigZoneHalf = C.BIG_ZONE_HALF,
  levels: [StatLevels?, StatLevels?] = [],
  humans: [boolean, boolean] = [false, false],
): GameState {
  const g: GameState = {
    tick: 0,
    players: [makePlayer(0, p1Char, levels[0], humans[0]), makePlayer(1, p2Char, levels[1], humans[1])],
    disc: makeDisc(),
    score: [0, 0], sets: [0, 0], setNo: 1, setTime: C.SET_TIME,
    phase: 'serve', phaseT: C.SERVE_DELAY, server: 0, hitstop: 0,
    lastScorer: -1, lastPts: 0, matchWinner: -1, bigZoneHalf, suddenDeath: false, events: [],
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
      if (g.phase === 'play' && g.setTime <= 0 && !g.suddenDeath) endSet(g);
      break;
    case 'point':
      g.phaseT -= C.DT;
      settlePlayers(g);
      if (g.phaseT <= 0) {
        const [a, b] = g.score;
        if (g.suddenDeath) endMatch(g, g.lastScorer);
        else if (a >= C.SET_POINTS || b >= C.SET_POINTS || g.setTime <= 0) endSet(g);
        else resetForServe(g);
      }
      break;
    case 'setEnd':
      g.phaseT -= C.DT;
      if (g.phaseT <= 0) {
        const done = g.sets[0] >= C.SETS_TO_WIN || g.sets[1] >= C.SETS_TO_WIN;
        if (done && g.sets[0] !== g.sets[1]) {
          endMatch(g, g.sets[0] > g.sets[1] ? 0 : 1);
        } else if (done) {
          // both reached the target through tied sets: sudden death, first score wins
          g.suddenDeath = true;
          g.setNo++;
          g.score = [0, 0];
          g.setTime = 0;
          resetForServe(g);
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
  g.phase = 'setEnd';
  g.phaseT = 3.2;
  g.disc.mode = 'dead';
  if (g.score[0] === g.score[1]) {
    // tied set: both players are awarded the set (original Windjammers rule)
    g.sets[0]++;
    g.sets[1]++;
    g.server = 1 - g.server;
    for (const p of g.players) p.state = 'idle';
    g.events.push({ type: 'setEnd', p: -1 });
    return;
  }
  const w = g.score[0] > g.score[1] ? 0 : 1;
  g.sets[w]++;
  g.server = 1 - w;
  g.players[w].state = 'win';
  g.players[1 - w].state = 'lose';
  g.events.push({ type: 'setEnd', p: w });
}

function endMatch(g: GameState, winner: number) {
  g.phase = 'matchEnd';
  g.matchWinner = winner;
  g.players[winner].state = 'win';
  g.players[1 - winner].state = 'lose';
  g.disc.mode = 'dead';
  g.events.push({ type: 'matchEnd', p: winner });
}

/** Power-shot timing window, widened for the player trailing in the current set. */
function ssWindow(g: GameState, p: Player) {
  return p.ssWindow + (g.score[1 - p.idx] - g.score[p.idx] >= C.COMEBACK_DEFICIT ? C.COMEBACK_WINDOW : 0);
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
      } else if (p.aAge === 0 && !p.serving && p.holdT <= (C.SUPERSONIC_AFTER + (ssWindow(g, p) - p.ssWindow)) * C.DT) {
        throwDisc(g, p, inp, true); // A right after the catch: power shot
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
      // pushed back by a super's impact; ice supers freeze you in place for longer
      if (p.t < C.KNOCK_TIME) p.x = clamp(p.x - fwd * p.knockV * C.DT, -C.PLAYER_MAX_X, C.PLAYER_MAX_X);
      clampToHalf(p);
      // knocked down by a super lob's quake: the disc stays loose, so recover empty-handed
      const holding = d.mode === 'held' && d.holder === p.idx;
      if (p.t > p.knockT) { p.frozen = 0; setState(p, holding ? 'hold' : 'idle'); }
      if (holding) placeHeld(d, p);
      return;
    case 'dash':
      if (lockUnderToss(g, p)) { setState(p, 'idle'); return; }
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
      if (lockUnderToss(g, p)) return;
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

/** Under your own toss/block pop-up: once inside the landing circle you're locked on its centre
 * until it lands, so a stray stick push or dash can't slide you out and lose the super charge. */
function lockUnderToss(g: GameState, p: Player): boolean {
  const d = g.disc;
  const L = d.lob;
  if (d.mode !== 'lob' || !L || d.kind !== 'toss' || d.thrower !== p.idx) return false;
  if (Math.hypot(p.x - L.tx, p.z - L.tz) >= p.catchR * C.TOSS_LOCK_MULT) return false;
  p.x = L.tx;
  p.z = L.tz;
  p.moving = false;
  if (p.state === 'walk') p.state = 'idle';
  return true;
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
  const reach = d.kind === 'super' ? p.catchR * C.SUPER_CATCH_MULT : p.catchR;
  if (Math.hypot(d.x - p.x, d.z - p.z) > reach) return;
  catchDisc(g, p, false);
}

function catchDisc(g: GameState, p: Player, fromLob: boolean) {
  const d = g.disc;
  const wasSuper = d.kind === 'super';
  const superDefOnCatch = d.superDef;
  d.mode = 'held';
  d.holder = p.idx;
  d.lob = null;
  d.superKind = null;
  d.superDef = null;
  p.holdT = 0;
  p.serving = false;
  if (fromLob && d.thrower === p.idx) {
    p.charged = true;
    g.events.push({ type: 'charge', p: p.idx, x: p.x, z: p.z });
  }
  g.events.push({ type: 'catch', p: p.idx, x: d.x, z: d.z, big: wasSuper });
  if (wasSuper && !fromLob && p.aAge <= C.REVERSAL_WINDOW) {
    // REVERSAL: perfectly timed catch of a super fires your own super straight back
    placeHeld(d, p);
    setState(p, 'hold');
    p.charged = true;
    g.events.push({ type: 'reversal', p: p.idx, x: d.x, z: d.z });
    const last = p.dirHist[p.dirHist.length - 1] ?? { mx: 0, mz: 0 };
    throwDisc(g, p, { mx: last.mx, mz: last.mz, a: true, b: false }, false);
    return;
  }
  if (wasSuper) {
    const sd = superDefOnCatch;
    p.knockV = C.KNOCK_SPEED * (sd?.knock ?? 1);
    p.knockT = C.KNOCK_TIME + (sd?.stun ?? 0);
    p.frozen = sd?.stun ?? 0;
    setState(p, 'knock');
    g.hitstop = C.HITSTOP_SUPER;
  } else {
    setState(p, 'hold');
    g.hitstop = C.HITSTOP_CATCH;
    // Timed A press right before the catch => instant supersonic return.
    if (!fromLob && p.aAge <= ssWindow(g, p)) {
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
  let sp = p.power * holdF * (supersonic ? p.ssMult : 1);
  d.mode = 'flight';
  d.holder = -1;
  d.thrower = p.idx;
  d.az = 0;
  d.superT = 0;
  d.superKind = null;
  d.superDef = null;
  d.h = 1.0;
  d.x = p.x + fwd * 0.6;
  let superEvent = 0;

  if (p.charged) {
    p.charged = false;
    d.kind = 'super';
    // stick up/down at release picks the second super; neutral/forward the signature one
    const v = inp.mz !== 0 ? 1 : 0;
    const sd = p.supers[v];
    d.superDef = sd;
    d.superKind = sd.kind;
    d.superBase = p.power;
    d.superDir = fwd;
    d.superDone = false;
    const opp = g.players[1 - p.idx];
    d.zigSign = inp.mz !== 0 ? Math.sign(inp.mz) : opp.z > 0 ? -1 : 1; // default: break away from the defender
    sp = p.power * (sd.speed ?? 1.12);
    let ang = inp.mz * C.ANGLE_SHOT * 0.6;
    if (sd.kind === 'meteor') sp = p.power * C.METEOR_AIR; // hangs in the air, then slams mid-court
    if (sd.kind === 'rush') { sp = p.power * C.RUSH_START; ang = (opp.z > 0 ? -1 : 1) * C.RUSH_ANGLE; } // burst toward the open corner
    if (sd.kind === 'straight' && sd.stun) ang = (opp.z > 0 ? -1 : 1) * C.RUSH_ANGLE; // ice shots aim for the open corner too
    if (sd.kind === 'wave' || sd.kind === 'zigzag' || sd.kind === 'spiral' || sd.kind === 'orbit' || sd.kind === 'decoy' || sd.kind === 'stopgo') ang = 0;
    d.vx = fwd * Math.cos(ang) * sp;
    d.vz = Math.sin(ang) * sp;
    superEvent = v;
    g.hitstop = C.HITSTOP_CUTIN;
    g.events.push({ type: 'super', p: p.idx, x: p.x, z: p.z, v: superEvent });
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

function startLob(d: Disc, tx: number, tz: number, T: number, peak: number, superLob: boolean, lobSuper: LobSuperDef | null = null, bounces = 0) {
  d.mode = 'lob';
  d.holder = -1;
  d.lob = { sx: d.x, sz: d.z, sh: d.h, tx, tz, t: 0, T, peak, superLob, lobSuper, bounces };
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
  startLob(d, tx, tz, C.LOB_TIME, C.LOB_PEAK, superLob, superLob ? p.lobSuper : null, superLob ? (p.lobSuper.bounces ?? 0) : 0);
  p.serving = false;
  setState(p, 'lob');
  if (superLob) g.hitstop = C.HITSTOP_CUTIN;
  g.events.push({ type: superLob ? 'super' : 'lob', p: p.idx, x: tx, z: tz, v: superLob ? 2 : undefined });
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
      case 'zigzag': {
        const per = d.superDef?.period ?? C.ZIG_PERIOD;
        const vz = per < C.ZIG_PERIOD ? C.ZIG_VZ * 1.15 : C.ZIG_VZ; // tighter snaps swing harder
        d.vz = ((Math.floor(t / per) % 2 === 0 ? 1 : -1) * vz + C.ZIG_DRIFT) * d.zigSign;
        break;
      }
      case 'spiral': {
        // a weave that keeps widening: easy to read early, wild by the goal
        const amp = C.SPIRAL_AMP0 + C.SPIRAL_GROW * t;
        d.vz = amp * C.SPIRAL_FREQ * Math.cos(C.SPIRAL_FREQ * t) * d.zigSign;
        break;
      }
      case 'decoy':
        // the real disc slides into one lane (two fakes are drawn fanning out the other ways)
        d.vz = t < C.DECOY_SPLIT ? 0 : C.DECOY_DRIFT * d.zigSign;
        break;
      case 'rush': {
        // crawls out of the hand, then explodes to top speed, swerving at the burst toward the corner the defender left open
        if (t >= C.RUSH_RAMP && !d.superDone) {
          d.superDone = true;
          const opp = g.players[d.thrower === 0 ? 1 : 0];
          const goalX = d.superDir * C.COURT_HALF_LEN;
          const tz = (opp.z > d.z ? -1 : 1) * (C.COURT_HALF_WID - C.RUSH_CORNER_MARGIN);
          const dx = goalX - d.x, dz = tz - d.z, l = Math.hypot(dx, dz) || 1;
          d.vx = dx / l;
          d.vz = dz / l;
        }
        const k = Math.min(1, t / C.RUSH_RAMP);
        const sp = d.superBase * (C.RUSH_START + ((d.superDef?.speed ?? 1.6) - C.RUSH_START) * k * k);
        const len = Math.hypot(d.vx, d.vz) || 1;
        d.vx = (d.vx / len) * sp;
        d.vz = (d.vz / len) * sp;
        break;
      }
      case 'orbit':
        // ECLIPSE ORBIT: one full loop around the net, then on toward the goal
        if (t >= C.ORBIT_AT && t < C.ORBIT_AT + C.ORBIT_TIME) {
          const w = ((2 * Math.PI) / C.ORBIT_TIME) * C.DT * d.zigSign;
          const c = Math.cos(w), sn = Math.sin(w);
          const vx = d.vx * c - d.vz * sn;
          d.vz = d.vx * sn + d.vz * c;
          d.vx = vx;
        } else if (t >= C.ORBIT_AT + C.ORBIT_TIME && !d.superDone) {
          d.superDone = true; // snap back to straight after the loop
          d.vx = d.superDir * d.superBase * (d.superDef?.speed ?? 1.05) * C.ORBIT_EXIT;
          d.vz = 0;
        }
        break;
      case 'stopgo':
        // BASS DROP: stops dead mid-court ("the drop"), then fires at the corner away from the defender
        if (t >= C.STOPGO_AT && t < C.STOPGO_AT + C.STOPGO_HOLD) {
          d.vx = 0;
          d.vz = 0;
        } else if (t >= C.STOPGO_AT + C.STOPGO_HOLD && !d.superDone) {
          d.superDone = true;
          const opp = g.players[d.thrower === 0 ? 1 : 0];
          const goalX = d.superDir * C.COURT_HALF_LEN;
          const tz = (opp.z > 0 ? -1 : 1) * (C.COURT_HALF_WID - 1.0);
          const dx = goalX - d.x, dz = tz - d.z, len = Math.hypot(dx, dz) || 1;
          const sp = d.superBase * (d.superDef?.speed ?? 1.45);
          d.vx = (dx / len) * sp;
          d.vz = (dz / len) * sp;
        }
        break;
      case 'straight':
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
  // a super lob's slam can't be caught: read where it skids or bounces next and intercept that
  if (canCatch && !L.superLob && Math.hypot(p.x - L.tx, p.z - L.tz) < p.catchR * 1.25) {
    catchDisc(g, p, true);
    return;
  }
  g.events.push({ type: 'land', x: d.x, z: d.z });
  if (L.superLob) {
    const ls = L.lobSuper;
    const dir = landSide === 0 ? -1 : 1; // toward the defender's goal
    if (ls?.kind === 'bounce' && L.bounces > 0) {
      // bounces again, deeper and away from the defender
      const tz2 = clamp(L.tz + (p.z > L.tz ? -1 : 1) * C.LOB_BOUNCE_SIDE, -C.PLAYER_MAX_Z, C.PLAYER_MAX_Z);
      startLob(d, dir * C.LOB_BOUNCE_X, tz2, C.LOB_BOUNCE_TIME, C.LOB_BOUNCE_PEAK, true, ls, L.bounces - 1);
      return;
    }
    if (ls?.kind === 'quake' && Math.hypot(p.x - L.tx, p.z - L.tz) < (ls.radius ?? 2)) {
      // shockwave: the defender is knocked down and can't get to the skidding disc
      p.knockV = C.KNOCK_SPEED;
      p.knockT = C.KNOCK_TIME + (ls.stun ?? 0.3);
      p.frozen = 0;
      setState(p, 'knock');
      g.events.push({ type: 'wall', x: d.x, z: d.z });
    }
    // then it skids along the ground toward the goal
    d.mode = 'ground';
    d.kind = 'super';
    d.superKind = null;
    d.superDef = ls?.stun ? { name: ls.name, kind: 'straight', stun: ls.stun } : null;
    d.lob = null;
    d.vx = dir * C.SUPER_SKID;
    // corner lobs (and the last bounce of a bouncing lob) skid diagonally away from the defender
    d.vz = ls?.kind === 'corner' || ls?.kind === 'bounce' ? (p.z > d.z ? -1 : 1) * C.SUPER_SKID_CORNER : 0;
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
  g.events.push({ type: 'score', p: scorer, pts, big, x: d.x, z: d.z, shot: d.kind, by: d.thrower });
}

/** Deep clone for AI lookahead / replays. */
export function cloneState(g: GameState): GameState {
  return structuredClone(g);
}

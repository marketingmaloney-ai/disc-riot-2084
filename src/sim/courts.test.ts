import { describe, expect, it } from 'vitest';
import * as C from './constants';
import { COURTS, courtRules, zonePoints } from './courts';
import { createGame, step } from './game';
import type { GameState } from './types';

const idle = { mx: 0, mz: 0, a: false, b: false };

/** Put the disc in flight at (x, z) with velocity (vx, vz), nobody holding it, players out of the way. */
function fly(g: GameState, x: number, z: number, vx: number, vz: number, superKind = false) {
  g.phase = 'play';
  const d = g.disc;
  Object.assign(d, { mode: 'flight', holder: -1, thrower: vx > 0 ? 0 : 1, x, z, h: 1, vx, vz, az: 0, lob: null, kind: superKind ? 'super' : 'normal', superKind: superKind ? 'straight' : null, superDef: superKind ? { name: 'T', kind: 'straight' } : null });
  for (const p of g.players) { p.z = -4; p.state = 'idle'; }
}

describe('arena courts', () => {
  it('Sunset Strip and Neon Pier keep the classic 3-5-3 wall and no bumpers', () => {
    for (const id of ['sunset', 'pier']) {
      expect(COURTS[id].bumpers).toHaveLength(0);
      expect(COURTS[id].zones.map((z) => z.pts)).toEqual([3, 5, 3]);
    }
    expect(zonePoints(COURTS.sunset, 0)).toBe(5);
    expect(zonePoints(COURTS.sunset, 3)).toBe(3);
  });

  it('Laser Lagoon pays 5 in the corners, Orbital Cabana pays 5 off-centre', () => {
    expect(zonePoints(COURTS.lagoon, 4)).toBe(5);
    expect(zonePoints(COURTS.lagoon, 0)).toBe(3);
    expect(zonePoints(COURTS.orbital, 0)).toBe(3);
    expect(zonePoints(COURTS.orbital, -1.8)).toBe(5);
  });

  it('every court is mirror-symmetric and covers the whole goal wall', () => {
    for (const c of Object.values(COURTS)) {
      expect(c.zones[0].z0).toBe(-C.COURT_HALF_WID);
      expect(c.zones[c.zones.length - 1].z1).toBe(C.COURT_HALF_WID);
      for (let z = -4.4; z <= 4.4; z += 0.2) expect(zonePoints(c, z)).toBe(zonePoints(c, -z));
      for (const b of c.bumpers) expect(c.bumpers.some((o) => Math.abs(o.x + b.x) < 1e-9 && Math.abs(o.z + b.z) < 1e-9) || c.bumpers.some((o) => o.x === b.x && o.z === -b.z)).toBe(true);
    }
  });

  it('a shot into a bumper glances off; a super punches through', () => {
    const b = COURTS.lagoon.bumpers[1]; // (0, 2.3)
    const g = createGame('vega', 'kaito', courtRules('lagoon'));
    fly(g, b.x - 2, b.z - 0.3, 20, 0);
    let bumped = false;
    for (let i = 0; i < 20 && !bumped; i++) { step(g, [idle, idle]); bumped = g.events.some((e) => e.type === 'bumper'); }
    expect(bumped).toBe(true);
    expect(g.disc.vz).toBeLessThan(0); // hit below the post's centre: kicked toward -z
    expect(Math.hypot(g.disc.vx, g.disc.vz)).toBeGreaterThan(19.9);

    const s = createGame('vega', 'kaito', courtRules('lagoon'));
    fly(s, b.x - 2, b.z, 20, 0, true);
    let hit = false;
    for (let i = 0; i < 20; i++) { step(s, [idle, idle]); hit ||= s.events.some((e) => e.type === 'bumper'); }
    expect(hit).toBe(false);
  });

  it('even a head-on hit keeps going forward, kicked into a new lane', () => {
    const b = COURTS.lagoon.bumpers[0];
    const g = createGame('vega', 'kaito', courtRules('lagoon'));
    fly(g, b.x - 2, b.z, 20, 0);
    let bumped = false;
    for (let i = 0; i < 20 && !bumped; i++) { step(g, [idle, idle]); bumped = g.events.some((e) => e.type === 'bumper'); }
    expect(bumped).toBe(true);
    expect(g.disc.vx).toBeGreaterThan(0);
    expect(Math.abs(g.disc.vz)).toBeGreaterThan(5);
    expect(g.disc.thrower).toBe(0);
  });
});

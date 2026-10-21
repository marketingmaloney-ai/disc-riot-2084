import * as C from './constants';

/** A stretch of the goal wall, from z0 to z1 (z runs across the court, -COURT_HALF_WID..+COURT_HALF_WID). */
export interface GoalZone { z0: number; z1: number; pts: number }
/** A round post on the court that deflects shots in flight (normal, curve and power shots; supers and lobs pass). */
export interface Bumper { x: number; z: number; r: number }

export interface CourtRules {
  id: string;
  zones: GoalZone[]; // ordered from -z to +z, covering the whole goal wall
  bumpers: Bumper[];
}

const W = C.COURT_HALF_WID;
/** The classic layout: a 5-point slot in the middle, 3 points either side. */
const classic = (half: number): GoalZone[] => [
  { z0: -W, z1: -half, pts: C.POINTS_SMALL },
  { z0: -half, z1: half, pts: C.POINTS_BIG },
  { z0: half, z1: W, pts: C.POINTS_SMALL },
];

/**
 * Per-arena rules. Sunset Strip and Neon Pier are the classic courts; Laser Lagoon and Orbital Cabana
 * change the goal wall and add bumpers. Every layout is mirror-symmetric, so neither side is favoured.
 */
export const COURTS: Record<string, CourtRules> = {
  sunset: { id: 'sunset', zones: classic(1.65), bumpers: [] },
  pier: { id: 'pier', zones: classic(1.35), bumpers: [] },
  // corners pay 5, the middle only 3; two posts on the net line split the court into lanes
  lagoon: {
    id: 'lagoon',
    zones: [
      { z0: -W, z1: -3.1, pts: 5 },
      { z0: -3.1, z1: 3.1, pts: 3 },
      { z0: 3.1, z1: W, pts: 5 },
    ],
    bumpers: [{ x: 0, z: -2.3, r: 0.5 }, { x: 0, z: 2.3, r: 0.5 }],
  },
  // two off-centre 5-point slots (a straight shot only gets 3), and a diamond of four posts
  orbital: {
    id: 'orbital',
    zones: [
      { z0: -W, z1: -2.7, pts: 3 },
      { z0: -2.7, z1: -0.9, pts: 5 },
      { z0: -0.9, z1: 0.9, pts: 3 },
      { z0: 0.9, z1: 2.7, pts: 5 },
      { z0: 2.7, z1: W, pts: 3 },
    ],
    bumpers: [
      { x: -1.8, z: -2.0, r: 0.36 }, { x: -1.8, z: 2.0, r: 0.36 },
      { x: 1.8, z: -2.0, r: 0.36 }, { x: 1.8, z: 2.0, r: 0.36 },
    ],
  },
};

export const DEFAULT_COURT = COURTS.sunset;
export const courtRules = (id: string) => COURTS[id] ?? DEFAULT_COURT;

export function zonePoints(court: CourtRules, z: number): number {
  for (const zn of court.zones) if (z >= zn.z0 && z <= zn.z1) return zn.pts;
  return C.POINTS_SMALL;
}

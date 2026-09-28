// All gameplay tuning lives here. Units: meters, seconds. Court long axis = x.
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const COURT_HALF_LEN = 8; // goal walls at x = ±8
export const COURT_HALF_WID = 4.5; // side walls at z = ±4.5
export const PLAYER_MIN_X = 0.6; // distance from net players must keep
export const PLAYER_MAX_X = 7.5;
export const PLAYER_MAX_Z = 4.1;
export const DISC_RADIUS = 0.28;

export const CATCH_RADIUS = 0.75;
export const CATCH_HEIGHT = 2.2; // disc above this can't be caught (lobs in flight)
export const HOLD_MAX = 1.1; // auto-throw after this long
export const HOLD_DECAY = 0.45; // speed lost per second held (fraction)
export const HOLD_MIN_FACTOR = 0.62;
export const SUPERSONIC_WINDOW = 7; // frames: A pressed this close before catch => supersonic
export const SUPERSONIC_MULT = 1.35;
export const HITSTOP_CATCH = 5; // frames of freeze on catch
export const HITSTOP_SUPER = 12;
export const HITSTOP_CUTIN = 42; // freeze while the super cut-in plays (~0.7s)

export const DASH_TIME = 0.2;
export const DASH_RECOVER = 0.16;
export const DASH_MULT = 2.4;

export const LOB_TIME = 1.15;
export const LOB_PEAK = 4.2;
export const TOSS_TIME = 0.95;
export const TOSS_PEAK = 3.4;
export const TOSS_FORWARD = 1.6;
export const BLOCK_RANGE = 1.5;

export const ANGLE_SHOT = 0.62; // radians for up/down throws
export const CURVE_WINDOW = 14; // frames of direction history for motion inputs

export const POINTS_DROP = 2;
export const POINTS_SMALL = 3;
export const POINTS_BIG = 5;
export const BIG_ZONE_HALF = 1.3; // |z| < this on goal wall = 5 pts

export const SET_POINTS = 12;
export const SET_TIME = 45;
export const SETS_TO_WIN = 2;
export const SERVE_DELAY = 1.2;
export const SCORE_PAUSE = 1.8;

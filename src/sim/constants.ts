// All gameplay tuning lives here. Units: meters, seconds. Court long axis = x.
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const COURT_HALF_LEN = 8; // goal walls at x = ±8
export const COURT_HALF_WID = 4.5; // side walls at z = ±4.5
export const PLAYER_MIN_X = 0.6; // distance from net players must keep
export const PLAYER_MAX_X = 7.5;
export const PLAYER_MAX_Z = 4.1;
export const DISC_RADIUS = 0.28;

export const CATCH_RADIUS = 0.62;
export const HUMAN_CATCH_MULT = 1.6; // human players get a wider catch reach than the CPU (0.62 -> ~0.99)
export const HUMAN_SPEED_MULT = 1.12; // ...and run a bit faster (the CPU reads the disc perfectly, people don't)
export const SUPER_CATCH_MULT = 1.12; // supers are big, glowing and catchable if you read them
export const CATCH_HEIGHT = 2.2; // disc above this can't be caught (lobs in flight)
export const HOLD_MAX = 1.1; // auto-throw after this long
export const HOLD_DECAY = 0.45; // speed lost per second held (fraction)
export const HOLD_MIN_FACTOR = 0.62;
export const SUPERSONIC_WINDOW = 7; // frames: A pressed this close before catch => supersonic
export const SUPERSONIC_MULT = 1.45;
export const SUPERSONIC_AFTER = 5; // ticks after a catch where A still fires a power shot
export const COMEBACK_DEFICIT = 4; // trailing by this many points in a set...
export const COMEBACK_WINDOW = 2; // ...widens the power-shot window by this many ticks
export const REVERSAL_WINDOW = 4; // A this close before catching a super fires your own super straight back
export const HITSTOP_CATCH = 5; // frames of freeze on catch
export const HITSTOP_SUPER = 12;
export const HITSTOP_CUTIN = 42; // freeze while the super cut-in plays (~0.7s)

export const DASH_TIME = 0.2;
export const DASH_RECOVER = 0.16;
export const DASH_MULT = 2.4;

// supers
export const WAVE_AMP = 2.55;
export const METEOR_AIR = 0.72; // meteor airborne speed (x power): slams down around the opponent's mid-court
export const METEOR_BOOST = 1.7; // speed multiplier once it starts slamming down
export const METEOR_RISE = 0.40;
export const METEOR_PEAK = 3.8;
export const METEOR_DROP = 26; // m/s descent
export const METEOR_KICK = 19; // sideways ricochet speed after the slam
export const WAVE_FREQ = 8;
export const BOLT_AT = 0.16; // seconds before the Thunder Kiss kink
export const BOLT_LEN = 0.13;
export const BOLT_VZ = 15.5;
export const ZIG_PERIOD = 0.19;
export const ZIG_VZ = 13.5;
export const ZIG_DRIFT = 3.5; // net diagonal slide so the zigzag's midline isn't a free read

export const LOB_TIME = 1.15;
export const LOB_PEAK = 4.2;
export const TOSS_TIME = 0.95;
export const TOSS_PEAK = 3.4;
export const TOSS_FORWARD = 1.6;
export const BLOCK_RANGE = 1.5;

export const ANGLE_SHOT = 0.62; // radians for up/down throws
export const CURVE_WINDOW = 14;
export const CURVE_END_BASE = 2.3; // |z| where a curve shot finishes at the goal = base + per * curve stat
export const CURVE_END_PER = 1.1; // frames of direction history for motion inputs

export const POINTS_DROP = 2;
export const POINTS_SMALL = 3;
export const POINTS_BIG = 5;
export const BIG_ZONE_HALF = 1.65; // |z| < this on goal wall = 5 pts

// attribute upgrades (per level, VS CPU only)
export const MAX_ATTR_LEVEL = 5;
export const ATTR_SPEED = 0.03;
export const ATTR_POWER = 0.03;
export const ATTR_TECH_CURVE = 0.05;
export const ATTR_TECH_SS = 0.02;
export const ATTR_REFLEX_REACH = 0.03;

export const SET_POINTS = 12;
export const SET_TIME = 30; // original Windjammers default
export const SETS_TO_WIN = 2;
export const SERVE_DELAY = 1.2;
export const SCORE_PAUSE = 1.8;

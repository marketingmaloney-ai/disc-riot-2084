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
export const TOSS_LOCK_MULT = 1.25; // inside this x catch reach of your own toss's landing spot you lock onto it
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

// ---- super variants (see characters.ts) ----
export const KNOCK_TIME = 0.22; // s pushed back after catching a super
export const KNOCK_SPEED = 3.2; // m/s
export const SPIRAL_AMP0 = 0.9; // m
export const SPIRAL_GROW = 2.0; // m/s of extra swing
export const SPIRAL_FREQ = 9;
export const DECOY_SPLIT = 0.14; // s before the decoys fan out
export const DECOY_DRIFT = 4.4; // m/s lateral drift of the real disc
export const DECOY_FAN = 5.0; // m/s lateral fan of the fake discs (render)
export const DECOY_FADE_X = 0.55; // fakes vanish after this fraction of the trip
export const RUSH_START = 0.7; // x power at release
export const RUSH_RAMP = 0.3; // s to reach top speed
export const ORBIT_AT = 0.22; // s before the loop starts
export const ORBIT_TIME = 0.5; // s for one full loop
export const ORBIT_EXIT = 1.0; // speed boost out of the loop
export const STOPGO_AT = 0.2; // s before the stop
export const STOPGO_HOLD = 0.32; // s hovering
export const SUPER_SKID = 16; // m/s super-lob skid
export const SUPER_SKID_CORNER = 4.5; // m/s lateral for corner skids
export const LOB_BOUNCE_X = 6.4; // m, second-bounce landing depth
export const LOB_BOUNCE_SIDE = 3.0; // m sideways, away from the defender
export const LOB_BOUNCE_TIME = 0.38;
export const LOB_BOUNCE_PEAK = 1.8;
export const RUSH_ANGLE = 0.32; // rad toward the far corner, away from the defender
export const DECOY_FOOL = 0.32; // s the CPU follows the straight fake before it reads the real disc
export const SUPER_LOB_STANDOFF = 1.4; // m the CPU backs off a super lob's landing spot toward its goal
export const RUSH_CORNER_MARGIN = 1.8; // m inside the side wall that the rush swerve aims for
export const INPUT_BUFFER = 6; // ticks (0.1 s) a tap stays valid, so slightly early presses still register

// Bumpers (arena-specific posts, see courts.ts)
export const BUMPER_KICK = 1.0; // speed multiplier on a deflection
export const BUMPER_MIN_FWD = 0.7; // after a deflection, at least this share of the speed runs along x (toward a goal)
export const BUMPER_MAX_FWD = 0.9; // ...and at most this share, so every hit visibly kicks it sideways
export const PLAYER_RADIUS = 0.42; // body size for walking around bumpers

/** Flight path of a thrown super (see updateDisc in game.ts). */
export type SuperKind =
  | 'wave' // sine weave
  | 'zigzag' // square-wave snaps
  | 'fireball' // one lightning-bolt kink across the court
  | 'meteor' // rises, slams just past the net, ricochets
  | 'spiral' // weave that widens as it travels
  | 'decoy' // drifts to one lane while two fake discs fan out
  | 'rush' // starts slow, then bursts to top speed
  | 'orbit' // loops a full circle at the net, then carries on
  | 'stopgo' // stops dead mid-court, then fires at the far corner
  | 'straight'; // straight line (heavy or freezing supers)

/** What a charged LOB does when it lands on the far side (see landLob in game.ts). */
export type LobSuperKind =
  | 'skid' // skids straight at the goal
  | 'corner' // skids diagonally into the far corner, off the wall
  | 'bounce' // bounces deep again (n times), then skids
  | 'quake'; // shockwave knocks down anyone near the landing, then skids

export interface SuperDef {
  name: string;
  kind: SuperKind;
  speed?: number; // x power (default 1.12)
  knock?: number; // knockback on the catcher, x normal (default 1)
  stun?: number; // extra seconds the catcher is frozen
  period?: number; // zigzag snap period (s)
}

export interface LobSuperDef {
  name: string;
  kind: LobSuperKind;
  bounces?: number;
  radius?: number; // quake radius (m)
  stun?: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  nation: string;
  tagline: string;
  speed: number; // m/s walking
  power: number; // base throw speed m/s
  curve: number; // lateral accel multiplier
  reach?: number; // catch reach multiplier (default 1)
  /** [0] charged A (stick neutral or forward), [1] charged A while holding up/down. */
  supers: [SuperDef, SuperDef];
  /** Charged B: a super lob. */
  lobSuper: LobSuperDef;
  colors: { primary: string; secondary: string; skin: string; hair: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vega', name: 'VEGA STARR', nation: 'MIAMI', tagline: 'Chrome & Sunset',
    speed: 7.0, power: 23.3, curve: 1.0,
    supers: [{ name: 'LASER SURF', kind: 'wave' }, { name: 'SUNSET SPIRAL', kind: 'spiral', speed: 1.0 }],
    lobSuper: { name: 'NEON DIVE', kind: 'bounce', bounces: 1 },
    colors: { primary: '#ff2e9a', secondary: '#c0c8d8', skin: '#f2c3a0', hair: '#ff5ec4' },
  },
  {
    id: 'kaito', name: 'KAITO "RIPTIDE" MORI', nation: 'NEO-TOKYO', tagline: 'Faster Than Light',
    speed: 8.2, power: 21.3, curve: 1.35,
    supers: [{ name: 'GLITCH STORM', kind: 'zigzag' }, { name: 'AFTERIMAGE', kind: 'decoy', speed: 1.16 }],
    lobSuper: { name: 'RIPTIDE DROP', kind: 'corner' },
    colors: { primary: '#19e6ff', secondary: '#ffe600', skin: '#e8b98f', hair: '#101018' },
  },
  {
    id: 'roxy', name: 'ROXY VOLTAGE', nation: 'RIO', tagline: 'High Voltage Heat',
    speed: 7.4, power: 22.6, curve: 0.85,
    supers: [{ name: 'THUNDER KISS', kind: 'fireball', speed: 1.3 }, { name: 'SAMBA SURGE', kind: 'rush', speed: 1.55 }],
    lobSuper: { name: 'LIGHTNING ROD', kind: 'quake', radius: 2.0, stun: 0.25 },
    colors: { primary: '#2f6bff', secondary: '#b6ff2e', skin: '#9a5f3c', hair: '#27a7ff' },
  },
  {
    id: 'brick', name: 'BRICK DIAMOND', nation: 'GOLD COAST', tagline: 'Built Like a Bulldozer',
    speed: 6.4, power: 24.3, curve: 0.75,
    supers: [{ name: 'METEOR SLAM', kind: 'meteor' }, { name: 'WRECKING BALL', kind: 'straight', speed: 1.22, knock: 2.2 }],
    lobSuper: { name: 'BODY SLAM', kind: 'quake', radius: 2.4, stun: 0.3 },
    colors: { primary: '#ff7a1a', secondary: '#2b2b3a', skin: '#d99a6c', hair: '#f5d06a' },
  },
  {
    id: 'nova', name: 'NOVA KAIN', nation: 'SELENE CITY', tagline: 'Fastest Wheels on the Moon',
    speed: 8.6, power: 20.6, curve: 1.1,
    supers: [{ name: 'ECLIPSE ORBIT', kind: 'orbit', speed: 0.98 }, { name: 'ROLLER RUSH', kind: 'rush', speed: 1.75 }],
    lobSuper: { name: 'MOONSHOT', kind: 'bounce', bounces: 2 },
    colors: { primary: '#9b5cff', secondary: '#d8dcf0', skin: '#f0c9b0', hair: '#f4f4ff' },
  },
  {
    id: 'diesel', name: 'DIESEL REYES', nation: 'MEXICO CITY', tagline: 'Drop the Beat',
    speed: 6.2, power: 24.8, curve: 0.7,
    supers: [{ name: 'BASS DROP', kind: 'stopgo', speed: 1.32 }, { name: 'MIC CHECK', kind: 'straight', speed: 1.2, knock: 2.6 }],
    lobSuper: { name: 'PILEDRIVER', kind: 'quake', radius: 2.8, stun: 0.35 },
    colors: { primary: '#39ff6a', secondary: '#ff3b3b', skin: '#b97a52', hair: '#141414' },
  },
  {
    id: 'saki', name: 'SAKI VANCE', nation: 'SEOUL', tagline: 'Now You See It',
    speed: 7.3, power: 21.6, curve: 1.5,
    supers: [{ name: 'HOLO DECOY', kind: 'decoy', speed: 1.12 }, { name: 'PIXEL STORM', kind: 'zigzag', speed: 1.2, period: 0.11 }],
    lobSuper: { name: 'ENCORE', kind: 'bounce', bounces: 2 },
    colors: { primary: '#5effd0', secondary: '#c39bff', skin: '#f2cfb4', hair: '#b9a7ff' },
  },
  {
    id: 'zara', name: 'ZARA VOLKOV', nation: 'SIBERIA', tagline: 'Nothing Gets Past',
    speed: 6.9, power: 22.4, curve: 0.9, reach: 1.12,
    supers: [{ name: 'PERMAFROST', kind: 'straight', speed: 1.36, stun: 0.6 }, { name: 'BLIZZARD', kind: 'wave', speed: 1.05, stun: 0.4 }],
    lobSuper: { name: 'AVALANCHE', kind: 'corner', stun: 0.4 },
    colors: { primary: '#6fd8ff', secondary: '#ffffff', skin: '#f5ddd0', hair: '#f3eccf' },
  },
];

/** The three super names, in input order: A, up/down + A, B. */
export const superNames = (c: CharacterDef) => [c.supers[0].name, c.supers[1].name, c.lobSuper.name];

export function charById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export type SuperKind = 'wave' | 'zigzag' | 'fireball' | 'meteor';

export interface CharacterDef {
  id: string;
  name: string;
  nation: string;
  tagline: string;
  speed: number; // m/s walking
  power: number; // base throw speed m/s
  curve: number; // lateral accel multiplier
  superKind: SuperKind;
  superName: string;
  colors: { primary: string; secondary: string; skin: string; hair: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vega',
    name: 'VEGA STARR',
    nation: 'MIAMI',
    tagline: 'Chrome & Sunset',
    speed: 7.0, power: 23.3, curve: 1.0,
    superKind: 'wave', superName: 'LASER SURF',
    colors: { primary: '#ff2e9a', secondary: '#c0c8d8', skin: '#f2c3a0', hair: '#ff5ec4' },
  },
  {
    id: 'kaito',
    name: 'KAITO "RIPTIDE" MORI',
    nation: 'NEO-TOKYO',
    tagline: 'Faster Than Light',
    speed: 8.2, power: 21.3, curve: 1.35,
    superKind: 'zigzag', superName: 'GLITCH STORM',
    colors: { primary: '#19e6ff', secondary: '#ffe600', skin: '#e8b98f', hair: '#101018' },
  },
  {
    id: 'roxy',
    name: 'ROXY VOLTAGE',
    nation: 'RIO',
    tagline: 'High Voltage Heat',
    speed: 7.4, power: 22.6, curve: 0.85,
    superKind: 'fireball', superName: 'THUNDER KISS',
    colors: { primary: '#2f6bff', secondary: '#b6ff2e', skin: '#9a5f3c', hair: '#27a7ff' },
  },
  {
    id: 'brick',
    name: 'BRICK DIAMOND',
    nation: 'GOLD COAST',
    tagline: 'Built Like a Bulldozer',
    speed: 6.4, power: 24.3, curve: 0.75,
    superKind: 'meteor', superName: 'METEOR SLAM',
    colors: { primary: '#ff7a1a', secondary: '#2b2b3a', skin: '#d99a6c', hair: '#f5d06a' },
  },
];

export function charById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

import type { GameEvent, GameState } from '../sim/types';
import { hasAsset } from '../render/assets';

/** Per-character sounds cut from the art videos (tools/gen-assets/sfx.json). Missing ones use the synth. */
const VOICE_NAMES = ['throw', 'shout', 'dash', 'lob', 'block', 'win', 'lose'];

/** Shared sound effects (tools/gen-assets/sfx_candidates.json -> public/assets/sfx/common/). Missing ones use the synth. */
const COMMON_SFX = ['catch', 'bigcatch', 'punch', 'wall', 'drop', 'super', 'ui_move', 'ui_confirm', 'ui_back', 'jingle', 'jingle_win',
  'score', 'score_big', 'crowd', 'vo_ready', 'vo_fight', 'vo_round_1', 'vo_round_2', 'vo_round_3', 'vo_round_4', 'vo_round_5',
  'vo_sudden_death', 'vo_you_win', 'vo_you_lose', 'vo_winner', 'vo_choose'];
/** Licensed music per slot (tools/gen-assets/music.json -> public/assets/music/<slot>.mp3). ARENAS order for matches. */
const ARENA_TRACKS = ['sunset', 'pier', 'lagoon', 'orbital'];
const MUSIC_VOL = 0.5;

interface Song {
  bpm: number;
  prog: number[]; // 8 bar roots (MIDI)
  chord: (bar: number) => number[]; // pad intervals above the root
  kick: number[]; snare: number[]; clap?: number[]; // 16th-step positions
  hats: (i: number) => boolean;
  bass: (i: number) => number | null; // semitones above root-12, or rest
  bassWave: OscillatorType; bassLen: number;
  arp: number[]; arpFrom: number; arpEvery: number; // lead enters at bar arpFrom
  leadWave: OscillatorType; leadLen: number; leadVol: number;
  padCutoff: number;
}

/** One procedural track per arena (ARENAS order: sunset, pier, lagoon, orbital). */
const SONGS: Song[] = [
  { // SUNSET STRIP — classic Miami synthwave, Am-F-C-G
    bpm: 118, prog: [45, 41, 48, 43, 45, 41, 48, 43],
    chord: (bar) => [0, bar % 4 === 1 || bar % 4 === 2 ? 4 : 3, 7, 12],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: (i) => i % 2 === 1,
    bass: (i) => (i % 2 === 1 ? 12 : 0), bassWave: 'sawtooth', bassLen: 0.12,
    arp: [0, 7, 12, 15, 12, 7, 3, 7], arpFrom: 4, arpEvery: 2, leadWave: 'square', leadLen: 0.1, leadVol: 0.045, padCutoff: 1800,
  },
  { // NEON PIER — darker, driving night-drive, Em-C-D-Bm, rolling 16th bass
    bpm: 128, prog: [40, 36, 38, 35, 40, 36, 38, 35],
    chord: (bar) => [0, bar % 4 === 1 || bar % 4 === 2 ? 4 : 3, 7, 10],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: () => true,
    bass: (i) => [0, 0, 12, 0][i % 4], bassWave: 'sawtooth', bassLen: 0.08,
    arp: [12, 10, 7, 3, 7, 10, 12, 15], arpFrom: 2, arpEvery: 2, leadWave: 'sawtooth', leadLen: 0.07, leadVol: 0.035, padCutoff: 1200,
  },
  { // LASER LAGOON — laid-back sunny beach funk, Dmaj7-Bm7-Gmaj7-A, syncopated bass
    bpm: 104, prog: [50, 47, 43, 45, 50, 47, 43, 45],
    chord: (bar) => (bar % 4 === 1 ? [0, 3, 7, 10] : bar % 4 === 3 ? [0, 4, 7, 12] : [0, 4, 7, 11]),
    kick: [0, 6, 8], snare: [4, 12], clap: [12], hats: (i) => i % 2 === 0 || i === 7 || i === 15,
    bass: (i) => ({ 0: 0, 3: 12, 6: 7, 8: 0, 10: 10, 14: 12 } as Record<number, number>)[i] ?? null, bassWave: 'triangle', bassLen: 0.18,
    arp: [12, 16, 19, 23, 19, 16], arpFrom: 4, arpEvery: 4, leadWave: 'triangle', leadLen: 0.22, leadVol: 0.07, padCutoff: 2400,
  },
  { // ORBITAL CABANA — spacey half-time darkwave, Dm-Bb-Gm-A, bell arps
    bpm: 136, prog: [38, 34, 43, 45, 38, 34, 43, 45],
    chord: (bar) => [0, bar % 4 === 3 ? 4 : bar % 4 === 1 ? 4 : 3, 7, 14],
    kick: [0, 10], snare: [8], hats: (i) => i % 4 === 2,
    bass: (i) => (i % 2 === 0 ? (i % 8 === 6 ? 12 : 0) : null), bassWave: 'square', bassLen: 0.14,
    arp: [0, 7, 14, 19, 24, 19, 14, 7], arpFrom: 0, arpEvery: 2, leadWave: 'sine', leadLen: 0.25, leadVol: 0.06, padCutoff: 900,
  },
];

/** Web Audio: synthesized arcade SFX + a procedural synthwave loop, layered with per-character sounds. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step16 = 0;
  private song = 0;
  muted = false;
  private chars: string[] = [];
  private voices = new Map<string, AudioBuffer>();
  private pending = new Map<string, ArrayBuffer>();
  private lastEndVoice = -1e9;
  // streamed music: ONE <audio> element, reused for every track (iOS only lets media play after a tap;
  // an element that has played once keeps that permission, so switching its src later just works)
  private musicEl: HTMLAudioElement | null = null;
  private musicGain!: GainNode;
  private track = '';
  private trackTimer: number | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private announceNext = false;
  private lastAnnounce = -1e9;
  private human = -1; // VS CPU: the human player's index, for "YOU WIN" / "YOU LOSE"

  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
    // simple stereo-ish delay for synthwave space
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.375;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.musicEl = new Audio();
    this.musicEl.loop = true;
    this.musicEl.preload = 'auto';
    this.musicEl.setAttribute('playsinline', '');
    ctx.createMediaElementSource(this.musicEl).connect(this.musicGain);
    this.loadSamples(COMMON_SFX.map((n) => `common/${n}`));
    this.decodePending();
  }

  private loadSamples(keys: string[]) {
    for (const key of keys) {
      if (this.voices.has(key) || this.pending.has(key)) continue;
      const url = `assets/sfx/${key}.mp3`;
      void hasAsset(url).then(async (ok) => {
        if (!ok || this.pending.has(key) || this.voices.has(key)) return;
        const r = await fetch(url).catch(() => null);
        if (!r?.ok) return;
        this.pending.set(key, await r.arrayBuffer());
        this.decodePending();
      });
    }
  }

  /** Play a shared sample; false if it isn't available (caller falls back to synth). */
  private sample(name: string, vol = 1, when = 0, rate = 1): boolean {
    if (!this.ctx || this.muted) return false;
    const buf = this.voices.get(`common/${name}`);
    if (!buf) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.sfxBus);
    s.start(this.ctx.currentTime + when);
    return true;
  }

  /** Match fighters (P1, P2): fetch their character sounds. */
  setCharacters(ids: string[]) {
    this.chars = ids;
    this.loadSamples([...new Set(ids)].flatMap((id) => VOICE_NAMES.map((n) => `${id}/${n}`)));
  }

  private decodePending() {
    if (!this.ctx) return; // decoded once the context exists (after the first user gesture)
    for (const [key, data] of this.pending) {
      this.pending.delete(key);
      this.ctx.decodeAudioData(data).then((b) => this.voices.set(key, b)).catch(() => {});
    }
  }

  /** Play player p's character sound; false if that character has none (caller falls back to synth). */
  private voice(p: number | undefined, name: string, vol = 1, when = 0): boolean {
    if (!this.ctx || this.muted || p === undefined || p < 0) return false;
    const buf = this.voices.get(`${this.chars[p]}/${name}`);
    if (!buf) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.sfxBus);
    s.start(this.ctx.currentTime + when);
    return true;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  // ---------- primitives ----------
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, fType: BiquadFilterType, f0: number, f1: number, when = 0, bus?: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = fType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  play(name: string) {
    if (!this.ctx || this.muted) return;
    const r = 0.94 + Math.random() * 0.12; // slight pitch variety so repeats don't sound copy-pasted
    switch (name) {
      case 'catch': if (this.sample('catch', 1, 0, r)) return; break;
      case 'bigcatch': if (this.sample('bigcatch', 0.9)) { this.sample('punch', 0.9); return; } break;
      case 'wall': if (this.sample('wall', 0.6, 0, r)) return; break;
      case 'drop': if (this.sample('drop', 1)) return; break;
      case 'menu': if (this.sample('ui_move', 0.7)) return; break;
      case 'back': if (this.sample('ui_back', 0.7)) return; this.play('menu'); return;
      case 'confirm': if (this.sample('ui_confirm', 0.8)) return; break;
      case 'charge': if (this.sample('super', 0.8)) return; break;
      case 'setEnd': if (this.sample('jingle', 0.8)) return; break;
      case 'choose': this.sample('vo_choose', 0.9, 0.1); return;
    }
    switch (name) {
      case 'throw': this.noise(0.18, 0.5, 'bandpass', 900, 3500, 0, undefined, 2); this.tone('triangle', 500, 900, 0.08, 0.15); break;
      case 'curve': this.noise(0.3, 0.45, 'bandpass', 3000, 700, 0, undefined, 3); this.tone('sine', 700, 1400, 0.25, 0.12); break;
      case 'supersonic': this.noise(0.35, 0.6, 'highpass', 6000, 1500); this.tone('sawtooth', 1800, 200, 0.3, 0.2); this.tone('square', 90, 50, 0.15, 0.3); break;
      case 'catch': this.tone('sine', 180, 60, 0.12, 0.7); this.noise(0.05, 0.4, 'highpass', 3000, 3000); break;
      case 'bigcatch': this.tone('sine', 120, 40, 0.3, 0.9); this.noise(0.25, 0.6, 'lowpass', 2000, 200); break;
      case 'wall': this.tone('square', 1320, 1100, 0.06, 0.12); this.tone('sine', 660, 600, 0.12, 0.2); break;
      case 'dash': this.noise(0.2, 0.35, 'bandpass', 600, 2400, 0, undefined, 1.5); break;
      case 'lob': this.tone('sine', 300, 1200, 0.35, 0.18); this.noise(0.25, 0.2, 'bandpass', 1500, 4000, 0, undefined, 4); break;
      case 'land': this.tone('sine', 140, 50, 0.2, 0.5); this.noise(0.2, 0.4, 'lowpass', 900, 150); break;
      case 'charge': [0, 0.06, 0.12, 0.18].forEach((w, i) => this.tone('square', 440 * Math.pow(1.26, i), 440 * Math.pow(1.26, i), 0.08, 0.1, w)); break;
      case 'super':
        this.tone('sawtooth', 110, 880, 0.5, 0.25); this.tone('sawtooth', 112, 890, 0.5, 0.2);
        this.noise(0.6, 0.5, 'bandpass', 400, 6000, 0, undefined, 2); this.tone('sine', 60, 30, 0.5, 0.8);
        break;
      case 'score':
        this.noise(0.5, 0.6, 'lowpass', 5000, 300); this.tone('sine', 90, 30, 0.4, 0.9);
        [0, 0.08, 0.16, 0.24, 0.32].forEach((w, i) => this.tone('square', [523, 659, 784, 1047, 1319][i], [523, 659, 784, 1047, 1319][i], 0.12, 0.12, w + 0.1));
        break;
      case 'drop': this.tone('sine', 200, 60, 0.3, 0.6); this.tone('square', 300, 150, 0.2, 0.1, 0.05); break;
      case 'whistle': this.tone('sine', 2200, 2200, 0.12, 0.2); this.tone('sine', 2600, 2600, 0.25, 0.2, 0.14); break;
      case 'menu': this.tone('square', 880, 880, 0.04, 0.08); break;
      case 'confirm': this.tone('square', 660, 660, 0.06, 0.1); this.tone('square', 990, 990, 0.1, 0.1, 0.06); break;
      case 'setEnd': [0, 0.15, 0.3, 0.5].forEach((w, i) => this.tone('sawtooth', [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.3, 0.12, w)); break;
    }
  }

  /** Arcade announcer: "ROUND n ... FIGHT!" at the start of each set, "SUDDEN DEATH" at 2-2. */
  announceRound(g: GameState) {
    this.announceNext = false;
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastAnnounce < 3) return; // match start can reach here twice (start + opening serve)
    this.lastAnnounce = now;
    if (g.suddenDeath) this.sample('vo_sudden_death', 0.95, 0.2);
    else if (this.sample(`vo_round_${Math.min(5, g.setNo)}`, 0.95, 0.2)) this.sample('vo_fight', 1, 1.65);
  }

  /** VS CPU: index of the human player (-1 = none / 2P) for the end-of-match call. */
  setHuman(p: number) { this.human = p; }

  handleEvents(events: GameEvent[], g?: GameState) {
    for (const e of events) {
      switch (e.type) {
        case 'catch': this.play(e.big ? 'bigcatch' : 'catch'); break;
        case 'throw': if (!this.voice(e.p, 'throw')) this.play('throw'); break;
        case 'curve': this.play('curve'); break;
        case 'supersonic': this.play('supersonic'); this.voice(e.p, 'throw', 0.8); break;
        case 'super': this.play('super'); this.voice(e.p, 'shout'); this.duck(0.35, 1.6); break;
        case 'reversal': this.play('supersonic'); break;
        case 'lob': case 'toss': if (!this.voice(e.p, 'lob')) this.play('lob'); break;
        case 'block': if (!this.voice(e.p, 'block') && !this.voice(e.p, 'lob')) this.play('lob'); break;
        case 'wall': this.play('wall'); break;
        case 'dash': if (!this.voice(e.p, 'dash', 0.8)) this.play('dash'); break;
        case 'land': this.play('land'); break;
        case 'charge': this.play('charge'); break;
        case 'score':
          this.play('score');
          this.sample(e.big ? 'score_big' : 'score', e.big ? 0.9 : 0.65);
          this.duck(0.6, 1.2);
          break;
        case 'drop': this.play('drop'); break;
        case 'serve':
          this.play('whistle');
          if (this.announceNext && g) this.announceRound(g);
          break;
        case 'setEnd': case 'matchEnd': {
          this.play('setEnd');
          this.announceNext = e.type === 'setEnd';
          // winner celebrates, loser pants (once per set end: setEnd and matchEnd can fire together)
          const now = this.ctx?.currentTime ?? 0;
          if (e.type === 'matchEnd') {
            this.sample('jingle_win', 0.8, 0.5);
            if (e.p !== undefined && e.p >= 0) this.sample(this.human < 0 ? 'vo_winner' : e.p === this.human ? 'vo_you_win' : 'vo_you_lose', 1, 1.1);
          }
          if (e.p !== undefined && e.p >= 0 && now - this.lastEndVoice > 2) {
            this.lastEndVoice = now;
            this.voice(e.p, 'win', 1, 0.35);
            this.voice(1 - e.p, 'lose', 0.7, 0.9);
          }
          break;
        }
      }
    }
  }

  // ---------- Music: licensed tracks (streamed), procedural synthwave as fallback ----------
  /** Match music for arena index `arena` (also starts the crowd and queues the announcer). */
  startMusic(arena = 0) {
    if (!this.ctx) return;
    this.announceNext = true;
    this.startCrowd();
    void this.playTrack(ARENA_TRACKS[arena % ARENA_TRACKS.length], () => this.startSynth(arena));
  }
  /** Title / menu music. No-op if it's already playing. */
  startTitleMusic() {
    if (!this.ctx) return;
    this.stopCrowd();
    void this.playTrack('title', () => this.stopSynth());
  }
  stopMusic() {
    this.stopSynth();
    this.stopCrowd();
    this.fadeMusic(0, 0.4);
    this.track = '';
    window.setTimeout(() => { if (this.track === '') this.musicEl?.pause(); }, 450);
  }

  private async playTrack(slot: string, fallback: () => void) {
    if (this.track === slot) return;
    this.track = slot;
    const url = `assets/music/${slot}.mp3`;
    if (!this.musicEl || !(await hasAsset(url))) { fallback(); return; }
    if (this.track !== slot) return; // superseded while checking
    this.stopSynth();
    const el = this.musicEl;
    const swap = () => {
      if (this.track !== slot) return;
      el.src = url;
      el.currentTime = 0;
      void el.play().catch(() => {});
      this.fadeMusic(MUSIC_VOL, 0.8);
    };
    if (this.trackTimer !== null) clearTimeout(this.trackTimer);
    if (!el.paused && el.src) { this.fadeMusic(0, 0.45); this.trackTimer = window.setTimeout(swap, 470); } else swap();
  }

  private fadeMusic(to: number, secs: number) {
    if (!this.ctx || !this.musicGain) return;
    const g = this.musicGain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + secs);
  }

  /** Dip the music under a big moment, then bring it back. */
  private duck(level: number, secs: number) {
    if (!this.ctx || !this.musicGain || !this.track) return;
    const g = this.musicGain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(MUSIC_VOL * level, t + 0.08);
    g.setValueAtTime(MUSIC_VOL * level, t + secs);
    g.linearRampToValueAtTime(MUSIC_VOL, t + secs + 0.6);
  }

  private startCrowd() {
    if (!this.ctx || this.crowd) return;
    const buf = this.voices.get('common/crowd');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 1.5);
    src.connect(gain).connect(this.sfxBus);
    src.start();
    this.crowd = { src, gain };
  }
  private stopCrowd() {
    if (!this.ctx || !this.crowd) return;
    const { src, gain } = this.crowd, t = this.ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    src.stop(t + 0.7);
    this.crowd = null;
  }

  private startSynth(song = 0) {
    if (!this.ctx) return;
    this.stopSynth();
    this.song = song % SONGS.length;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step16 = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }
  private stopSynth() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule() {
    const ctx = this.ctx!;
    const s16 = 60 / SONGS[this.song].bpm / 4;
    while (this.nextNote < ctx.currentTime + 0.12) {
      this.playStep(this.step16, this.nextNote - ctx.currentTime);
      this.nextNote += s16;
      this.step16 = (this.step16 + 1) % 128;
    }
  }

  private playStep(s: number, when: number) {
    const song = SONGS[this.song];
    const bar = Math.floor(s / 16) % 8;
    const i = s % 16;
    const root = song.prog[bar];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const bus = this.musicBus;
    if (song.kick.includes(i)) this.tone('sine', 150, 40, 0.25, 0.9, when, bus);
    if (song.snare.includes(i)) { this.noise(0.18, 0.5, 'bandpass', 1800, 1200, when, bus, 0.8); this.tone('triangle', 220, 180, 0.08, 0.25, when, bus); }
    if (song.clap?.includes(i)) this.noise(0.09, 0.35, 'bandpass', 2400, 1600, when, bus, 1.5);
    if (song.hats(i)) this.noise(0.04, i % 4 === 3 ? 0.18 : 0.1, 'highpass', 8000, 8000, when, bus);
    const b = song.bass(i);
    if (b !== null) this.tone(song.bassWave, hz(root - 12 + b), hz(root - 12 + b) * 0.99, song.bassLen, 0.16, when, bus);
    if (i === 0) {
      for (const iv of song.chord(bar)) this.padNote(hz(root + 12 + iv), when, (60 / song.bpm) * 4, song.padCutoff);
    }
    if (bar >= song.arpFrom && i % song.arpEvery === 0) {
      const n = hz(root + 24 + song.arp[(i / song.arpEvery) % song.arp.length]);
      this.tone(song.leadWave, n, n, song.leadLen, song.leadVol, when, bus);
    }
  }

  private padNote(f: number, when: number, dur: number, cutoff = 1800) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = cutoff;
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(flt);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    flt.connect(g).connect(this.musicBus);
  }
}

export const audio = new AudioEngine();

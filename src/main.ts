import './ui/styles.css';
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/russo-one';
import '@fontsource/monoton';
import { DT } from './sim/constants';
import { CHARACTERS, charById } from './sim/characters';
import { createGame, step } from './sim/game';
import type { GameState, InputFrame } from './sim/types';
import { GameRenderer } from './render/scene';
import { ARENAS } from './render/arena';
import { frameDataURL, loadCharacterArt } from './render/characterArt';
import { CpuPlayer, DIFFICULTIES } from './ai/cpu';
import {
  connectedPads, endTick, GamepadSource, KeyboardSource, MenuInput, MergedSource,
  P1_KEYS, P2_KEYS, SOLO_KEYS, type InputSource,
} from './input/input';
import { isTouchDevice, TouchSource } from './input/touch';
import { audio } from './audio/audio';
import { Hud } from './ui/hud';
import { MatchTracker } from './meta/tracker';
import type { Achievement } from './meta/achievements';
import { charProfile, freePoints, totalLevel } from './meta/progress';
import { upgradeScreen } from './ui/upgrades';
import * as SC from './sim/constants';

type Controller = { kind: 'human'; src: InputSource } | { kind: 'cpu'; ai: CpuPlayer };

const stage = document.getElementById('stage')!;
const screens = document.getElementById('screens')!;
const hudEl = document.getElementById('hud')!;
const renderer = new GameRenderer(stage);
const hud = new Hud(hudEl);
const menuInput = new MenuInput();
const touch = isTouchDevice() ? new TouchSource(document.getElementById('app')!) : null;
touch?.setVisible(false);

let game: GameState;
let controllers: [Controller, Controller];
let demo = true;
let paused = false;
let acc = 0;
let difficulty: keyof typeof DIFFICULTIES = 'normal';
let mode: '1p' | '2p' = '1p';
let picks: [string, string] = ['vega', 'kaito'];
let arenaIdx = 0;
let onMenuInput: ((e: ReturnType<MenuInput['poll']>) => void) | null = null;

// ---------------------------------------------------------------- game setup
let tracker: MatchTracker | null = null;
let newAchievements: Achievement[] = [];

let loading = 0; // startMatch calls still loading art
let touchWanted = false; // this match is played with the on-screen controls
let touchShown = false;

async function startMatch(p1: string, p2: string, arena: number, ctrls: [Controller, Controller], isDemo: boolean) {
  // a newer startMatch began while this one was loading: drop this one entirely
  loading++;
  const current = await renderer.setup(ARENAS[arena], p1, p2).finally(() => loading--);
  if (!current) return;
  demo = isDemo;
  paused = false;
  controllers = ctrls;
  // Upgrades apply only to the human in VS CPU; 2P versus stays on base stats.
  const upgraded = !isDemo && mode === '1p';
  audio.setCharacters([p1, p2]);
  game = createGame(p1, p2, ARENAS[arena].bigZone, upgraded ? [charProfile(p1).levels] : [], [ctrls[0].kind === 'human', ctrls[1].kind === 'human']);
  tracker = upgraded ? new MatchTracker(0, p1, p2, ARENAS[arena].id, difficulty) : null;
  newAchievements = [];
  acc = 0;
  if (!isDemo) {
    const lbl = (c: Controller, i: number) => (c.kind === 'cpu' ? `CPU · ${difficulty.toUpperCase()}` : `PLAYER ${i + 1}`);
    hud.setup(game, [lbl(ctrls[0], 0), lbl(ctrls[1], 1)]);
    hudEl.classList.remove('hidden');
    touchWanted = ctrls[0].kind === 'human' && ctrls[0].src instanceof MergedSource;
    audio.startMusic(arena); // each arena has its own track
  } else {
    hudEl.classList.add('hidden');
    touchWanted = false;
  }
}

function startDemo() {
  const a = Math.floor(Math.random() * CHARACTERS.length);
  const b = (a + 1 + Math.floor(Math.random() * (CHARACTERS.length - 1))) % CHARACTERS.length;
  return startMatch(CHARACTERS[a].id, CHARACTERS[b].id, Math.floor(Math.random() * ARENAS.length), [
    { kind: 'cpu', ai: new CpuPlayer(0, DIFFICULTIES.hard, 11) },
    { kind: 'cpu', ai: new CpuPlayer(1, DIFFICULTIES.hard, 29) },
  ], true);
}

function humanSources(): [InputSource, InputSource] {
  const pads = connectedPads();
  if (mode === '1p') {
    const srcs: InputSource[] = [new KeyboardSource(SOLO_KEYS), ...pads.map((i) => new GamepadSource(i))];
    if (touch) srcs.push(touch);
    return [new MergedSource(srcs), new KeyboardSource(P2_KEYS)];
  }
  if (pads.length >= 2) {
    return [new MergedSource([new KeyboardSource(P1_KEYS), new GamepadSource(pads[0])]), new MergedSource([new KeyboardSource(P2_KEYS), new GamepadSource(pads[1])])];
  }
  if (pads.length === 1) {
    return [new MergedSource([new KeyboardSource(P1_KEYS), ...(touch ? [touch] : [])]), new MergedSource([new KeyboardSource(P2_KEYS), new GamepadSource(pads[0])])];
  }
  return [new MergedSource([new KeyboardSource(P1_KEYS), ...(touch ? [touch] : [])]), new KeyboardSource(P2_KEYS)];
}

function beginVersus() {
  const [s1, s2] = humanSources();
  const ctrls: [Controller, Controller] = [
    { kind: 'human', src: s1 },
    mode === '1p' ? { kind: 'cpu', ai: new CpuPlayer(1, DIFFICULTIES[difficulty], (Math.random() * 1e9) | 0) } : { kind: 'human', src: s2 },
  ];
  clearScreens();
  void startMatch(picks[0], picks[1], arenaIdx, ctrls, false);
}

// ---------------------------------------------------------------- main loop
function tick() {
  const inputs = controllers.map((c) => (c.kind === 'human' ? c.src.poll() : c.ai.think(game))) as [InputFrame, InputFrame];
  endTick();
  step(game, inputs);
  if (game.events.length) {
    renderer.handleEvents(game.events, game);
    if (!demo) {
      audio.handleEvents(game.events);
      hud.events(game.events, game);
      const unlocked = tracker?.onEvents(game.events, game);
      if (unlocked) newAchievements = unlocked;
      if (game.events.some((e) => e.type === 'matchEnd')) window.setTimeout(showResults, 1600);
    }
  }
}

let last = performance.now();
let pausePrev = false;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  let edge = menuInput.poll();
  if (onMenuInput) onMenuInput(edge);
  for (let n = 0; n < 8 && menuInput.hasQueued(); n++) {
    edge = menuInput.poll();
    if (onMenuInput) onMenuInput(edge);
  }

  // pause toggle (Esc / Start)
  const padStart = (navigator.getGamepads?.() ?? []).some((p) => p?.buttons[9]?.pressed);
  const escNow = padStart || escDown;
  if (!demo && game && game.phase !== 'matchEnd' && escNow && !pausePrev) togglePause();
  pausePrev = escNow;

  if (game) {
    if (!paused) {
      acc += dt;
      while (acc >= DT) { tick(); acc -= DT; }
    } else {
      endTick();
    }
    if (!demo) hud.update(game);
    // touch pause button: only during a real match, not over menus, the results or the attract demo
    pauseBtn?.classList.toggle('hidden', demo || game.phase === 'matchEnd' || (screens.childElementCount > 0 && !paused));
    // joystick + A/B only while actually playing: over the pause menu or results they swallow the menu taps
    const tv = touchWanted && !demo && !paused && game.phase !== 'matchEnd' && screens.childElementCount === 0;
    if (tv !== touchShown) { touchShown = tv; touch?.setVisible(tv); }
    renderer.render(game, paused ? 1 : acc / DT, paused ? 0 : dt);
    if (demo && game.phase === 'matchEnd' && !loading) void startDemo(); // once, not every frame while it loads
  }
}
let escDown = false;
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' || e.code === 'KeyP') escDown = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'Escape' || e.code === 'KeyP') escDown = false; });

// ---------------------------------------------------------------- screens
function clearScreens() {
  screens.innerHTML = '';
  onMenuInput = null;
  setBack(null);
}

// On-screen BACK for touch (keyboard/pad already have Esc / Ⓑ): shown whenever the screen has somewhere to go back to.
const backBtn = document.createElement('button');
backBtn.className = 'back-btn hidden';
backBtn.textContent = '‹ BACK';
let onBack: (() => void) | null = null;
backBtn.addEventListener('click', () => { if (onBack) { audio.play('menu'); onBack(); } });
document.getElementById('app')!.appendChild(backBtn);
function setBack(fn: (() => void) | null) {
  onBack = fn;
  backBtn.classList.toggle('hidden', !fn);
}

function openUpgrades(back: () => void, startChar?: string) {
  upgradeScreen(show, clearScreens, (h) => (onMenuInput = h), cardVisual, back, startChar);
  setBack(back);
}

function show(html: string, cls = '') {
  clearScreens();
  const s = document.createElement('div');
  s.className = 'screen ' + cls;
  s.innerHTML = html;
  screens.appendChild(s);
  return s;
}

/** Vertical button menu with keyboard/pad/touch navigation. */
function menu(el: HTMLElement, items: { label: string; action: () => void }[], back?: () => void) {
  const box = document.createElement('div');
  box.className = 'menu';
  let sel = 0;
  const btns = items.map((it, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = it.label;
    b.addEventListener('pointerenter', () => { sel = i; paint(); });
    b.addEventListener('click', () => { audio.unlock(); audio.play('confirm'); it.action(); });
    box.appendChild(b);
    return b;
  });
  const paint = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  paint();
  el.appendChild(box);
  onMenuInput = (e) => {
    if (e.u) { sel = (sel + items.length - 1) % items.length; audio.play('menu'); paint(); }
    if (e.d) { sel = (sel + 1) % items.length; audio.play('menu'); paint(); }
    if (e.ok) { audio.unlock(); audio.play('confirm'); items[sel].action(); }
    if (e.back && back) { audio.play('menu'); back(); }
  };
  if (back) setBack(back);
}

function titleScreen() {
  hudEl.classList.add('hidden');
  const s = show(`
    <div class="logo"><div class="l1">DISC RIOT</div><div class="l2">2084</div></div>
    <div class="sub blink">PRESS START</div>
    <div class="art-badge"></div>`, 'clear');
  const go = () => { audio.unlock(); audio.play('confirm'); modeScreen(); };
  s.addEventListener('click', go);
  onMenuInput = (e) => { if (e.ok) go(); };
  void refreshArtBadge(s.querySelector('.art-badge')!);
}

async function refreshArtBadge(el: HTMLElement) {
  const arts = await Promise.all(CHARACTERS.map((c) => loadCharacterArt(c.id)));
  const n = arts.filter((a) => a.generated).length;
  el.textContent = n === CHARACTERS.length ? '' : `PROTOTYPE · ${n}/${CHARACTERS.length} FINAL CHARACTER ART LOADED`;
}

function modeScreen() {
  const s = show(`<div class="title-h">SELECT MODE</div>`);
  menu(s, [
    { label: 'VS CPU', action: () => { mode = '1p'; difficultyScreen(); } },
    { label: '2 PLAYER VERSUS', action: () => { mode = '2p'; if (touch) controllerScreen(); else void charSelect(); } },
    { label: 'FIGHTER UPGRADES', action: () => openUpgrades(modeScreen) },
    { label: 'HOW TO PLAY', action: () => howTo() },
  ], titleScreen);
  s.insertAdjacentHTML('beforeend', `<div class="hint">↑↓ / D-PAD · ENTER / Ⓐ TO SELECT · ESC / Ⓑ BACK</div>`);
}

/**
 * 2P on a touch device: the touch controls only ever drive Player 1, so Player 2 needs a controller. A web page
 * can't pair Bluetooth (that happens in the phone's settings) and the browser only exposes a controller after a
 * button press on it, so this screen walks through both steps and shows live whether the game can see it.
 * humanSources() gives one connected controller to Player 2; with two, each player gets their own.
 */
function controllerScreen() {
  const s = show(`
    <div class="title-h">CONNECT CONTROLLER</div>
    <div class="pad-steps">
      <div><b>1</b><span>PUT YOUR CONTROLLER IN PAIRING MODE<small>HOLD ITS BLUETOOTH / SHARE BUTTON UNTIL THE LIGHT FLASHES</small></span></div>
      <div><b>2</b><span>PAIR IT IN YOUR PHONE'S SETTINGS › BLUETOOTH<small>TAP IT UNDER "OTHER DEVICES", THEN COME BACK HERE</small></span></div>
      <div><b>3</b><span>PRESS ANY BUTTON ON THE CONTROLLER<small>THE GAME CAN'T SEE IT UNTIL YOU DO</small></span></div>
    </div>
    <div class="pad-status"></div>`);
  const status = s.querySelector('.pad-status') as HTMLElement;
  menu(s, [{ label: 'CONTINUE', action: () => void charSelect() }], modeScreen);
  const cont = s.querySelector('.menu .btn') as HTMLElement;
  // The press that wakes a controller must not also "confirm" CONTINUE: ignore confirm briefly after it connects.
  // Checked here, every frame, right before the press is read (a slower timer lets the same press through).
  let lock = 0, lastN = connectedPads().length;
  const inner = onMenuInput!;
  onMenuInput = (e) => {
    const n = connectedPads().length;
    if (n > lastN) lock = performance.now() + 900;
    lastN = n;
    inner(performance.now() < lock ? { ...e, ok: false } : e);
  };
  const padName = (p: Gamepad) => (p.id.replace(/\s*\(.*$/, '').trim() || 'CONTROLLER').toUpperCase().slice(0, 34);
  let seenN = connectedPads().length, lastHtml = '';
  const paint = () => {
    const all = navigator.getGamepads?.() ?? [];
    const live = connectedPads().map((i) => all[i]!).filter(Boolean);
    if (live.length > seenN) audio.play('charge');
    seenN = live.length;
    const hit = live.some((p) => p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.5));
    const html = live.length === 0
      ? `<div class="pad-l blink">WAITING FOR A CONTROLLER…</div><div class="pad-s">NO CONTROLLER? PLAYER 2 CAN PLAY ON A KEYBOARD INSTEAD</div>`
      : live.length === 1
        ? `<div class="pad-l">✓ ${padName(live[0])}</div><div class="pad-s">PLAYER 2 PLAYS WITH THIS CONTROLLER · PLAYER 1 KEEPS THE TOUCH CONTROLS</div>`
        : `<div class="pad-l">✓ ${live.length} CONTROLLERS CONNECTED</div><div class="pad-s">ONE PER PLAYER · TOUCH CONTROLS OFF</div>`;
    status.className = 'pad-status' + (live.length ? ' ok' : '') + (hit ? ' hit' : '');
    if (html !== lastHtml) { status.innerHTML = html; lastHtml = html; }
    cont.textContent = live.length ? 'CONTINUE' : 'CONTINUE WITHOUT CONTROLLER';
  };
  const timer = window.setInterval(() => { if (!s.isConnected) window.clearInterval(timer); else paint(); }, 100);
  paint();
}

function difficultyScreen() {
  const s = show(`<div class="title-h">CPU LEVEL</div>`);
  menu(s, (['easy', 'normal', 'hard'] as const).map((d) => ({ label: d.toUpperCase(), action: () => { difficulty = d; charSelect(); } })), modeScreen);
}

function howTo() {
  const s = show(`
    <div class="title-h">HOW TO PLAY</div>
    <div class="controls-help">
      <b>MOVE</b><span>WASD / ARROWS · LEFT STICK / D-PAD · TOUCH LEFT SIDE</span>
      <b>A · THROW / DASH</b><span>J / SPACE · Ⓐ   (2P: J  vs  .)</span>
      <b>B · LOB / BLOCK</b><span>K · Ⓑ   (2P: K  vs  /)</span>
      <b>ANGLE SHOT</b><span>HOLD ↑ OR ↓ + A</span>
      <b>CURVE SHOT</b><span>↓ THEN → (TOWARD FOE) + A — QUARTER CIRCLE</span>
      <b>POWER SHOT</b><span>TAP A JUST BEFORE OR RIGHT AS YOU CATCH · EASIER WHEN YOU'RE BEHIND</span>
      <b>REVERSAL</b><span>TAP A JUST BEFORE A SUPER HITS YOU TO FIRE YOUR OWN SUPER BACK</span>
      <b>LOB</b><span>B WHILE HOLDING — WAIT LONGER TO DROP IT SHORTER</span>
      <b>SUPER</b><span>B JUST BEFORE A DISC HITS YOU TO POP IT UP, OR ← + B TO TOSS. STAND ON THE RING TO CHARGE, THEN THROW!</span>
      <b>SCORE</b><span>GOAL ZONES 3 / 5 PTS · DROPPED DISC = 2 PTS · 30 S SETS · TIED SET COUNTS FOR BOTH · 2–2 = SUDDEN DEATH</span>
      <b>UPGRADES</b><span>WIN MATCHES & UNLOCK ACHIEVEMENTS IN VS CPU TO EARN POINTS · SPEND THEM IN FIGHTER UPGRADES</span>
      <b>PAUSE</b><span>ESC / P · START</span>
    </div>`);
  menu(s, [{ label: 'BACK', action: modeScreen }], modeScreen);
}

async function cardVisual(id: string): Promise<string> {
  const art = await loadCharacterArt(id);
  if (art.portrait) return `<img class="portrait" src="${art.portrait}" alt="">`;
  return `<img src="${frameDataURL(art, 'idle')}" alt="">`;
}

async function charSelect() {
  const s = show(`<div class="title-h" data-t>SELECT YOUR FIGHTER</div><div class="cs-grid"></div><div class="cs-info"></div><div class="hint">←→ CHOOSE · ENTER / Ⓐ CONFIRM · ESC / Ⓑ BACK</div>`);
  const grid = s.querySelector('.cs-grid')!;
  const info = s.querySelector('.cs-info')!;
  const visuals = await Promise.all(CHARACTERS.map((c) => cardVisual(c.id)));
  const cards = CHARACTERS.map((c, i) => {
    const d = document.createElement('div');
    d.className = 'card';
    const cp = charProfile(c.id);
    const badge = mode === '1p' ? `<div class="lvl">LV ${totalLevel(cp)}${freePoints(cp) > 0 ? ` <b>+${freePoints(cp)}</b>` : ''}</div>` : '';
    d.innerHTML = `${visuals[i]}${badge}<div class="nm">${c.name}<br><span class="nation">${c.nation}</span></div>`;
    grid.appendChild(d);
    return d;
  });
  let cursor = [0, 1];
  let who = 0; // which player is picking
  const title = s.querySelector('[data-t]')!;
  const paint = () => {
    title.textContent = who === 0 ? (mode === '2p' ? 'PLAYER 1 · SELECT' : 'SELECT YOUR FIGHTER') : 'PLAYER 2 · SELECT';
    cards.forEach((c, i) => {
      c.classList.toggle('p1', cursor[0] === i);
      c.classList.toggle('p2', mode === '2p' && who === 1 && cursor[1] === i);
      c.querySelectorAll('.tag').forEach((t) => t.remove());
      if (cursor[0] === i) c.insertAdjacentHTML('beforeend', `<div class="tag t1">1P</div>`);
      if (mode === '2p' && who === 1 && cursor[1] === i) c.insertAdjacentHTML('beforeend', `<div class="tag t2">2P</div>`);
    });
    const ch = CHARACTERS[cursor[who]];
    // base bar + bonus segment from upgrades (VS CPU only)
    const lv = mode === '1p' && who === 0 ? charProfile(ch.id).levels : { speed: 0, power: 0, technique: 0, reflex: 0 };
    const w = (v: number, lo: number, hi: number) => Math.max(8, Math.round(((v - lo) / (hi - lo)) * 75 + 20));
    const bar = (v: number, lo: number, hi: number, bonus: number) =>
      `<div class="bar"><i style="width:${w(v, lo, hi)}%"></i>${bonus > 0 ? `<em style="width:${w(v * (1 + bonus), lo, hi) - w(v, lo, hi)}%"></em>` : ''}</div>`;
    info.innerHTML = `<div class="who"><div class="n ${who ? 'p2c' : 'p1c'}">${ch.name}</div><div class="sp">SUPER: ${ch.superName}</div><div class="hint">${ch.tagline.toUpperCase()}</div></div>
      <div class="stats"><span>SPEED</span>${bar(ch.speed, 6, 8.6, SC.ATTR_SPEED * lv.speed)}<span>POWER</span>${bar(ch.power, 20, 26, SC.ATTR_POWER * lv.power)}<span>TECHNIQUE</span>${bar(ch.curve, 0.6, 1.6, SC.ATTR_TECH_CURVE * lv.technique)}<span>REFLEX</span>${bar(1, 0.8, 1.3, SC.ATTR_REFLEX_REACH * lv.reflex)}</div>`;
  };
  const confirm = () => {
    audio.play('confirm');
    if (who === 0 && mode === '2p') { picks[0] = CHARACTERS[cursor[0]].id; who = 1; paint(); return; }
    if (who === 0) {
      picks[0] = CHARACTERS[cursor[0]].id;
      const others = CHARACTERS.filter((c) => c.id !== picks[0]);
      picks[1] = others[Math.floor(Math.random() * others.length)].id;
    } else picks[1] = CHARACTERS[cursor[1]].id;
    arenaSelect();
  };
  cards.forEach((c, i) => {
    c.addEventListener('pointerenter', () => { cursor[who] = i; paint(); });
    c.addEventListener('click', () => { cursor[who] = i; confirm(); });
  });
  paint();
  const goBack = () => { if (who === 1) { who = 0; paint(); } else modeScreen(); };
  setBack(goBack);
  onMenuInput = (e) => {
    const n = CHARACTERS.length;
    if (e.l) { cursor[who] = (cursor[who] + n - 1) % n; audio.play('menu'); paint(); }
    if (e.r) { cursor[who] = (cursor[who] + 1) % n; audio.play('menu'); paint(); }
    if (e.ok) confirm();
    if (e.back) goBack();
  };
}

function arenaSelect() {
  const s = show(`<div class="title-h">SELECT ARENA</div><div class="arena-grid"></div><div class="hint">←→ CHOOSE · ENTER / Ⓐ FIGHT!</div>`);
  const grid = s.querySelector('.arena-grid')!;
  const cards = ARENAS.map((a, i) => {
    const d = document.createElement('div');
    d.className = 'arena-card';
    d.style.backgroundImage = `linear-gradient(180deg, ${a.sky[0]}, ${a.sky[1]} 55%, ${a.sky[2]} 60%, ${a.sand[0]} 62%, ${a.sand[1]})`;
    d.innerHTML = `<div class="nm">${a.name}<br><span class="nation">${a.subtitle}</span></div>`;
    d.addEventListener('pointerenter', () => { arenaIdx = i; paint(); });
    d.addEventListener('click', () => { arenaIdx = i; audio.play('confirm'); vsScreen(); });
    grid.appendChild(d);
    return d;
  });
  const paint = () => cards.forEach((c, i) => c.classList.toggle('sel', i === arenaIdx));
  paint();
  onMenuInput = (e) => {
    if (e.l || e.r) { arenaIdx = (arenaIdx + (e.l ? ARENAS.length - 1 : 1)) % ARENAS.length; audio.play('menu'); paint(); }
    if (e.ok) { audio.play('confirm'); vsScreen(); }
    if (e.back) charSelect();
  };
  setBack(charSelect);
}

async function vsScreen() {
  const [v1, v2] = await Promise.all([cardVisual(picks[0]), cardVisual(picks[1])]);
  const c1 = charById(picks[0]), c2 = charById(picks[1]);
  show(`
    <div style="display:flex;align-items:center;gap:4vw">
      <div class="card p1" style="width:24vw">${v1}<div class="nm">${c1.name}</div></div>
      <div class="logo"><div class="l2" style="font-size:9vw">VS</div></div>
      <div class="card p2" style="width:24vw;transform:scaleX(-1)">${v2}<div class="nm" style="transform:scaleX(-1)">${c2.name}</div></div>
    </div>
    <div class="sub">${ARENAS[arenaIdx].name} · ${ARENAS[arenaIdx].subtitle}</div>`);
  audio.play('super');
  window.setTimeout(beginVersus, 2200);
}

function togglePause() {
  paused = !paused;
  if (paused) {
    const s = show(`<div class="title-h">PAUSED</div>`, 'clear');
    menu(s, [
      { label: 'RESUME', action: () => { paused = false; clearScreens(); } },
      { label: 'QUIT TO TITLE', action: () => { paused = false; audio.stopMusic(); void startDemo(); titleScreen(); } },
    ], () => { paused = false; clearScreens(); });
  } else clearScreens();
}

function showResults() {
  hudEl.classList.add('hidden');
  const w = charById(game.players[game.matchWinner].charId);
  const ach = newAchievements.length
    ? `<div class="ach-unlocked"><div class="ach-h">ACHIEVEMENTS UNLOCKED</div>${newAchievements
        .map((a) => `<div class="ach-row"><b>${a.name}</b><span>${a.desc}</span><i>+${a.points} PT${a.points > 1 ? 'S' : ''}</i></div>`)
        .join('')}</div>`
    : '';
  const s = show(`<div class="sub">MATCH OVER</div><div class="winner">${w.name} WINS!</div><div class="sub">${game.sets[0]} - ${game.sets[1]}</div>${ach}`, 'results clear');
  const pts = tracker ? freePoints(charProfile(picks[0])) : 0;
  menu(s, [
    ...(pts > 0 ? [{ label: `SPEND ${pts} UPGRADE POINT${pts > 1 ? 'S' : ''}`, action: () => { void startDemo(); openUpgrades(modeScreen, picks[0]); } }] : []),
    { label: 'REMATCH', action: () => beginVersus() },
    { label: 'CHARACTER SELECT', action: () => { void startDemo(); charSelect(); } },
    { label: 'TITLE', action: () => { audio.stopMusic(); void startDemo(); titleScreen(); } },
  ]);
}

let pauseBtn: HTMLElement | null = null;
if (touch) {
  const pb = document.createElement('button');
  pb.className = 'pause-btn';
  pb.textContent = 'II';
  pb.addEventListener('click', () => { if (!demo && game.phase !== 'matchEnd') togglePause(); });
  document.getElementById('app')!.appendChild(pb);
  pauseBtn = pb;
}

// Browsers only allow audio after a user gesture: unlock on the first key, tap or click anywhere.
for (const ev of ['keydown', 'pointerdown', 'touchend'] as const) window.addEventListener(ev, () => audio.unlock(), { once: true, capture: true });

// Allow URL shortcuts for testing: ?quick=1 jumps straight into VS CPU.
const params = new URLSearchParams(location.search);
if (import.meta.env.DEV) (window as unknown as { __game: () => GameState }).__game = () => game;
if (import.meta.env.DEV) Object.assign(window, { __dbg: { renderer, startDemo, beginVersus } });
await startDemo();
requestAnimationFrame(frame);
if (params.get('quick')) {
  picks = [params.get('p1') ?? 'vega', params.get('p2') ?? 'roxy'];
  arenaIdx = Number(params.get('arena') ?? 0);
  mode = '1p';
  beginVersus();
} else titleScreen();

import { audio } from '../audio/audio';
import { ACHIEVEMENTS } from '../meta/achievements';
import { ATTRS, charProfile, downgrade, freePoints, totalLevel, upgrade } from '../meta/progress';
import { CHARACTERS } from '../sim/characters';
import { MAX_ATTR_LEVEL } from '../sim/constants';
import type { MenuInput } from '../input/input';

type Edge = ReturnType<MenuInput['poll']>;

/**
 * FIGHTER UPGRADES: spend achievement points on SPEED / POWER / TECHNIQUE / REFLEX.
 * Row 0 switches fighter; rows 1-4 are attributes (←/→ = -/+). Upgrades apply in VS CPU only.
 */
export function upgradeScreen(
  show: (html: string, cls?: string) => HTMLElement,
  _clear: () => void,
  setInput: (h: (e: Edge) => void) => void,
  cardVisual: (id: string) => Promise<string>,
  back: () => void,
  startChar?: string,
) {
  let ci = Math.max(0, CHARACTERS.findIndex((c) => c.id === startChar));
  let row = startChar ? 1 : 0;
  const s = show(`
    <div class="title-h">FIGHTER UPGRADES</div>
    <div class="up-wrap">
      <div class="up-left"><div class="up-card card p1"></div><div class="up-switch"><button class="btn up-prev">◀</button><div class="up-name"></div><button class="btn up-next">▶</button></div></div>
      <div class="up-mid"><div class="up-pts"></div><div class="up-attrs"></div><div class="hint">UPGRADES APPLY IN VS CPU · 2P VERSUS USES BASE STATS</div></div>
      <div class="up-right"><div class="ach-h">ACHIEVEMENTS</div><div class="ach-list"></div></div>
    </div>
    <div class="hint">↑↓ SELECT · ←→ CHANGE · ESC / Ⓑ BACK</div>`);
  const card = s.querySelector('.up-card') as HTMLElement;
  const nameEl = s.querySelector('.up-name') as HTMLElement;
  const ptsEl = s.querySelector('.up-pts') as HTMLElement;
  const attrsEl = s.querySelector('.up-attrs') as HTMLElement;
  const achEl = s.querySelector('.ach-list') as HTMLElement;

  const switchChar = async (d: number) => {
    ci = (ci + d + CHARACTERS.length) % CHARACTERS.length;
    audio.play('menu');
    await paintCard();
    paint();
  };
  s.querySelector('.up-prev')!.addEventListener('click', () => void switchChar(-1));
  s.querySelector('.up-next')!.addEventListener('click', () => void switchChar(1));

  const paintCard = async () => {
    card.innerHTML = await cardVisual(CHARACTERS[ci].id);
  };

  const change = (attr: (typeof ATTRS)[number]['id'], d: number) => {
    const id = CHARACTERS[ci].id;
    const ok = d > 0 ? upgrade(id, attr) : downgrade(id, attr);
    audio.play(ok ? (d > 0 ? 'charge' : 'menu') : 'drop');
    paint();
  };

  function paint() {
    const c = CHARACTERS[ci];
    const cp = charProfile(c.id);
    nameEl.innerHTML = `<b>${c.name}</b><span>LV ${totalLevel(cp)} / ${ATTRS.length * MAX_ATTR_LEVEL}</span>`;
    s.querySelector('.up-switch')!.classList.toggle('sel', row === 0);
    const free = freePoints(cp);
    ptsEl.innerHTML = `<span>UPGRADE POINTS</span><b class="${free > 0 ? 'hot' : ''}">${free}</b>`;
    attrsEl.innerHTML = ATTRS.map((a, i) => {
      const lv = cp.levels[a.id];
      const pips = Array.from({ length: MAX_ATTR_LEVEL }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="up-row ${row === i + 1 ? 'sel' : ''}" data-i="${i}">
        <div class="up-l"><b>${a.label}</b><small>${a.desc}</small></div>
        <button class="up-btn" data-d="-1" ${lv <= 0 ? 'disabled' : ''}>−</button>
        <div class="pips5">${pips}</div>
        <button class="up-btn" data-d="1" ${lv >= MAX_ATTR_LEVEL || free <= 0 ? 'disabled' : ''}>+</button>
      </div>`;
    }).join('');
    attrsEl.querySelectorAll('.up-row').forEach((r) => {
      const i = Number((r as HTMLElement).dataset.i);
      r.addEventListener('pointerenter', () => { row = i + 1; s.querySelector('.up-switch')!.classList.remove('sel'); attrsEl.querySelectorAll('.up-row').forEach((x, k) => x.classList.toggle('sel', k === i)); });
      r.querySelectorAll('.up-btn').forEach((b) =>
        b.addEventListener('click', () => change(ATTRS[i].id, Number((b as HTMLElement).dataset.d))),
      );
    });
    achEl.innerHTML = ACHIEVEMENTS.map((a) => {
      const done = cp.unlocked.includes(a.id);
      const [v, goal] = a.progress(cp.stats);
      return `<div class="ach ${done ? 'done' : ''}">
        <div class="ach-t"><b>${a.name}</b><i>${done ? '✓' : `+${a.points}`}</i></div>
        <small>${a.desc}</small>
        ${done || goal <= 1 ? '' : `<div class="ach-bar"><span style="width:${Math.round((100 * v) / goal)}%"></span></div><small class="ach-n">${v} / ${goal}</small>`}
      </div>`;
    }).join('');
  }

  void paintCard().then(paint);
  paint();
  setInput((e) => {
    if (e.u) { row = (row + ATTRS.length) % (ATTRS.length + 1); audio.play('menu'); paint(); }
    if (e.d) { row = (row + 1) % (ATTRS.length + 1); audio.play('menu'); paint(); }
    if (e.l || e.r) {
      const d = e.l ? -1 : 1;
      if (row === 0) void switchChar(d);
      else change(ATTRS[row - 1].id, d);
    }
    if (e.ok && row > 0) change(ATTRS[row - 1].id, 1);
    if (e.back) { audio.play('menu'); back(); }
  });
}

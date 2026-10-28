/**
 * Landscape in a browser that can't rotate. The in-app browsers of X, YouTube, Instagram... are often locked to
 * portrait, so the "rotate your device" screen never went away. "PLAY ANYWAY" turns the whole game 90° on the
 * screen instead (automatically, whenever a touch screen is upright): the player holds the phone sideways and
 * plays as usual.
 *
 * Layout sizes (clientWidth / clientHeight) ignore CSS transforms, so the renderer and HUD need nothing special.
 * Raw pointer coordinates are still in screen space: touch code maps them with toApp().
 */
let turned = false;
const KEY = 'discriot2084.turned';

export const isTurned = () => turned;

let screenW = 0; // width of the visible area when the turn was applied (toApp needs the same number)

/** The area actually on screen. X's in-app browser reports window.innerWidth / innerHeight that don't match
 * what's visible, so prefer visualViewport (what WebKit really shows), then the layout viewport. */
function visible() {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) return { w: vv.width, h: vv.height, x: vv.offsetLeft, y: vv.offsetTop };
  const de = document.documentElement;
  return { w: de.clientWidth || window.innerWidth, h: de.clientHeight || window.innerHeight, x: 0, y: 0 };
}

/** Screen (client) point -> point in the game's own landscape coordinates. */
export function toApp(x: number, y: number) {
  return turned && document.body.classList.contains('turned') ? { x: y, y: screenW - x } : { x, y };
}

const portrait = matchMedia('(orientation: portrait)');

function apply() {
  const on = turned && portrait.matches;
  document.body.classList.toggle('turned', on);
  const app = document.getElementById('app')!;
  if (on) {
    // the game's width runs down the screen: size it to the visible area turned sideways
    const v = visible();
    screenW = v.w;
    Object.assign(app.style, { width: `${v.h}px`, height: `${v.w}px`, left: `${v.x + v.w}px`, top: `${v.y}px`, right: 'auto', bottom: 'auto' });
    requestAnimationFrame(check);
  } else {
    for (const k of ['width', 'height', 'left', 'top', 'right', 'bottom'] as const) app.style[k] = '';
  }
}

/** After turning: the game must exactly cover the visible area. If a browser still disagrees, show the numbers
 * (a screenshot of them tells us what that browser reports) instead of silently showing a cropped game. */
function check() {
  const el = document.getElementById('turn-diag');
  if (!document.body.classList.contains('turned')) { el?.remove(); return; }
  const r = document.getElementById('app')!.getBoundingClientRect(), v = visible();
  const off = Math.abs(r.left - v.x) > 3 || Math.abs(r.top - v.y) > 3 || Math.abs(r.width - v.w) > 3 || Math.abs(r.height - v.h) > 3;
  if (!off) { el?.remove(); return; }
  const d = el ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'turn-diag' }));
  const vv = window.visualViewport;
  d.textContent = `layout ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} | vis ${Math.round(v.w)}x${Math.round(v.h)} | inner ${innerWidth}x${innerHeight} | doc ${document.documentElement.clientWidth}x${document.documentElement.clientHeight} | vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${vv.scale}` : '-'} | dpr ${devicePixelRatio}`;
}

export function setupOrientation() {
  // Turn automatically: in X's browser the phone can be rotated but the page stays upright, so waiting for a
  // rotation (or a tap on a button the player may never notice) lost people. Where the browser does rotate,
  // the portrait media query stops matching and the game drops the turn by itself.
  turned = true;
  try { if (sessionStorage.getItem(KEY) === '0') turned = false; } catch { /* storage blocked: keep the default */ }
  const rot = document.getElementById('rotate')!;
  rot.insertAdjacentHTML('beforeend', `
    <button class="rot-play">PLAY ANYWAY</button>
    <div class="rot-tip">CAN'T ROTATE? YOU'RE PROBABLY IN AN APP'S BUILT-IN BROWSER.<br>TAP <b>PLAY ANYWAY</b> AND HOLD YOUR PHONE SIDEWAYS,<br>OR OPEN THE LINK IN SAFARI / CHROME.</div>`);
  rot.querySelector('.rot-play')!.addEventListener('click', () => {
    turned = true;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* fine for this visit */ }
    apply();
  });
  portrait.addEventListener('change', apply); // the phone really rotated: drop the turn (and bring it back in portrait)
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 300));
  setTimeout(apply, 500); // in-app browsers settle their toolbars after load
  apply();
}

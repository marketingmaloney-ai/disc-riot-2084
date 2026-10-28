/**
 * Landscape in a browser that can't rotate. The in-app browsers of X, YouTube, Instagram... are often locked to
 * portrait, so the "rotate your device" screen never went away. "PLAY ANYWAY" turns the whole game 90° on the
 * screen instead: the player holds the phone sideways and plays as usual.
 *
 * Layout sizes (clientWidth / clientHeight) ignore CSS transforms, so the renderer and HUD need nothing special.
 * Raw pointer coordinates are still in screen space: touch code maps them with toApp().
 */
let turned = false;
const KEY = 'discriot2084.turned';

export const isTurned = () => turned;

/** Screen (client) point -> point in the game's own landscape coordinates. */
export function toApp(x: number, y: number) {
  return turned ? { x: y, y: window.innerWidth - x } : { x, y };
}

const portrait = matchMedia('(orientation: portrait)');

function apply() {
  const on = turned && portrait.matches;
  document.body.classList.toggle('turned', on);
  const app = document.getElementById('app')!;
  if (on) {
    // the game's width runs down the screen: size it to the screen turned sideways
    app.style.width = `${window.innerHeight}px`;
    app.style.height = `${window.innerWidth}px`;
    app.style.left = `${window.innerWidth}px`;
  } else {
    app.style.width = app.style.height = app.style.left = '';
  }
}

export function setupOrientation() {
  try { turned = sessionStorage.getItem(KEY) === '1'; } catch { /* storage blocked: ask again */ }
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
  apply();
}

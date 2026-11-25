/**
 * Full screen. iPad, Android and desktop browsers can hide their bars, but only from a tap: turning the device
 * isn't enough, so the first tap after turning it sideways does it. iPhone browsers can't at all; there the only
 * way is the Home Screen icon, so the title screen says so.
 */
interface Now { supported: boolean; active: boolean; standalone: boolean; touch: boolean; landscape: boolean }

/** When a tap should go full screen by itself. */
export class AutoFullscreen {
  private off = false; // the player left full screen, or the browser refused: wait for the next turn
  onTap(n: Now): boolean {
    return n.supported && n.touch && n.landscape && !n.active && !n.standalone && !this.off;
  }
  left() { this.off = true; }
  refused() { this.off = true; }
  turned() { this.off = false; }
}

export const homeScreenHint = (d: { iphone: boolean; standalone: boolean }) => d.iphone && !d.standalone;

type Doc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type El = HTMLElement & { webkitRequestFullscreen?: () => void };

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches && !fullscreenOn() || (navigator as { standalone?: boolean }).standalone === true;
export const isIphone = () => /iPhone|iPod/.test(navigator.userAgent);
export const fullscreenOn = () => !!(document.fullscreenElement ?? (document as Doc).webkitFullscreenElement);
export const fullscreenSupported = () => {
  const el = document.documentElement as El;
  return !isIphone() && !!(el.requestFullscreen ?? el.webkitRequestFullscreen);
};

async function enter() {
  const el = document.documentElement as El;
  if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
  else el.webkitRequestFullscreen?.();
}
function exit() {
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  else (document as Doc).webkitExitFullscreen?.();
}
/** Menu button: must run inside the tap. */
export function toggleFullscreen() {
  if (fullscreenOn()) exit();
  else void enter().catch(() => {});
}

export function setupFullscreen(touch: boolean) {
  if (!fullscreenSupported()) return;
  const auto = new AutoFullscreen();
  const sideways = window.matchMedia('(orientation: landscape)');
  let was = false;
  sideways.addEventListener('change', () => auto.turned());
  const changed = () => {
    if (was && !fullscreenOn()) auto.left();
    was = fullscreenOn();
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  // touchend / click count as a user gesture on iOS; pointerdown does not
  const tap = () => {
    if (!auto.onTap({ supported: true, active: fullscreenOn(), standalone: isStandalone(), touch, landscape: sideways.matches })) return;
    void enter().catch(() => auto.refused());
  };
  for (const ev of ['touchend', 'click'] as const) document.addEventListener(ev, tap, { capture: true, passive: true });
}

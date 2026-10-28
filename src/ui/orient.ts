/**
 * The game is landscape-only. In-app browsers (X, YouTube, Instagram...) usually can't rotate, so the "rotate your
 * device" screen tells those players to open the link in Safari / Chrome, with a one-tap COPY LINK.
 * (Turning the whole game 90° inside a portrait-locked browser was tried on 2026-10-28: X's browser reported
 * sizes and touch directions that didn't match the screen, so it was dropped.)
 */

/** Screen (client) point -> point in the game's own coordinates (identity: the game is never turned). */
export function toApp(x: number, y: number) {
  return { x, y };
}

export function setupOrientation() {
  const rot = document.getElementById('rotate')!;
  rot.insertAdjacentHTML('beforeend', `
    <div class="rot-tip">TURNED YOUR PHONE AND NOTHING HAPPENED?<br>YOU'RE IN AN APP'S BUILT-IN BROWSER (LIKE X), WHICH CAN'T ROTATE.<br>
      TAP <b>⋯</b> OR THE <b>SHARE</b> ICON AND CHOOSE <b>OPEN IN SAFARI</b>.</div>
    <button class="rot-play">COPY LINK</button>`);
  const btn = rot.querySelector('.rot-play') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const done = () => { btn.textContent = 'COPIED! PASTE IT IN SAFARI'; };
    const url = location.href.split('#')[0];
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
  });
}

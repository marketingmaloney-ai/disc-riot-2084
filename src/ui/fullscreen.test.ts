import { describe, expect, it } from 'vitest';
import { AutoFullscreen, homeScreenHint } from './fullscreen';

const ipad = { supported: true, active: false, standalone: false, touch: true, landscape: true };

describe('automatic full screen', () => {
  it('goes full screen on a tap when a touch device is sideways', () => {
    expect(new AutoFullscreen().onTap(ipad)).toBe(true);
  });
  it('never on desktop, in portrait, from the Home Screen, where unsupported, or when already full', () => {
    for (const o of [{ touch: false }, { landscape: false }, { standalone: true }, { supported: false }, { active: true }]) expect(new AutoFullscreen().onTap({ ...ipad, ...o })).toBe(false);
  });
  it('leaving it sticks until the device is turned again', () => {
    const a = new AutoFullscreen();
    a.left();
    expect(a.onTap(ipad)).toBe(false);
    a.turned();
    expect(a.onTap(ipad)).toBe(true);
  });
  it('a refused request is not repeated on every tap', () => {
    const a = new AutoFullscreen();
    expect(a.onTap(ipad)).toBe(true);
    a.refused();
    expect(a.onTap(ipad)).toBe(false);
  });
});

describe('Home Screen hint', () => {
  it('shows only on iPhones in the browser', () => {
    expect(homeScreenHint({ iphone: true, standalone: false })).toBe(true);
    expect(homeScreenHint({ iphone: true, standalone: true })).toBe(false);
    expect(homeScreenHint({ iphone: false, standalone: false })).toBe(false);
  });
});

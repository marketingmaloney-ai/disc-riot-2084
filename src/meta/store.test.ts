import { describe, expect, it } from 'vitest';
import { allUnlocked, earnUnlock, FREE_FIGHTERS, isUnlocked, LOCKED_FIGHTERS, storeAvailable } from './store';

describe('fighter unlocks', () => {
  it('starts with the four free fighters, the other four locked', () => {
    expect(FREE_FIGHTERS.every(isUnlocked)).toBe(true);
    expect(LOCKED_FIGHTERS.some(isUnlocked)).toBe(false);
    expect(allUnlocked()).toBe(false);
  });
  it('beating a locked fighter unlocks them once', () => {
    expect(earnUnlock('diesel')).toBe(true);
    expect(isUnlocked('diesel')).toBe(true);
    expect(earnUnlock('diesel')).toBe(false);
    expect(earnUnlock('vega')).toBe(false); // free fighters are never "earned"
  });
  it('outside the apps there is no store (earn-only)', () => {
    expect(storeAvailable()).toBe(false);
  });
});

import { Capacitor } from '@capacitor/core';

/**
 * Fighter unlocks. Four fighters are free; the other four unlock by beating them in VS CPU on HARD, or instantly
 * by purchase in the iOS / Android apps (one fighter, or the Full Roster bundle). The web build is earn-only.
 *
 * Purchases are non-consumable in-app products, handled on the device by @capgo/native-purchases (StoreKit 2 /
 * Google Play Billing; no server). Product ids must match what is set up in App Store Connect and the Play
 * Console (see RELEASE.md).
 */
export const FREE_FIGHTERS = ['vega', 'kaito', 'nova', 'saki'];
export const LOCKED_FIGHTERS = ['roxy', 'brick', 'diesel', 'zara'];

const APP = 'com.maloneymarketing.discriot2084';
export const ROSTER_PRODUCT = `${APP}.full_roster`;
export const fighterProduct = (id: string) => `${APP}.fighter_${id}`;
const ALL_PRODUCTS = [...LOCKED_FIGHTERS.map(fighterProduct), ROSTER_PRODUCT];
/** Shown until the store reports real (localised) prices. */
export const DEFAULT_PRICES: Record<string, string> = Object.fromEntries([...LOCKED_FIGHTERS.map((id) => [fighterProduct(id), '$0.99']), [ROSTER_PRODUCT, '$2.99']]);

interface Unlocks { earned: string[]; bought: string[] } // bought = product ids
const KEY = 'discriot2084.unlocks.v1';
let state: Unlocks | null = null;

function load(): Unlocks {
  if (state) return state;
  state = { earned: [], bought: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...state, ...(JSON.parse(raw) as Unlocks) };
  } catch { /* private mode / blocked storage: start locked, nothing saved */ }
  return state;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* see load() */ }
}

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const devUnlockAll = import.meta.env.DEV && params.has('unlockall');

export const isLockedFighter = (id: string) => LOCKED_FIGHTERS.includes(id);

export function isUnlocked(id: string): boolean {
  if (!isLockedFighter(id) || devUnlockAll) return true;
  const s = load();
  return s.earned.includes(id) || s.bought.includes(ROSTER_PRODUCT) || s.bought.includes(fighterProduct(id));
}

/** How a fighter was unlocked, for the UI. */
export function unlockedBy(id: string): 'free' | 'earned' | 'bought' | null {
  if (!isLockedFighter(id)) return 'free';
  const s = load();
  if (s.bought.includes(ROSTER_PRODUCT) || s.bought.includes(fighterProduct(id))) return 'bought';
  if (s.earned.includes(id)) return 'earned';
  return devUnlockAll ? 'free' : null;
}

export const allUnlocked = () => LOCKED_FIGHTERS.every(isUnlocked);

/** Beat a locked fighter on HARD in VS CPU: unlock them. Returns true if this was new. */
export function earnUnlock(id: string): boolean {
  if (!isLockedFighter(id) || isUnlocked(id)) return false;
  load().earned.push(id);
  save();
  return true;
}

function grant(productIds: string[]) {
  const s = load();
  let changed = false;
  for (const p of productIds) if (ALL_PRODUCTS.includes(p) && !s.bought.includes(p)) { s.bought.push(p); changed = true; }
  if (changed) save();
  return changed;
}

// ---------------------------------------------------------------- store backend
interface Backend {
  prices(): Promise<Record<string, string>>;
  buy(productId: string): Promise<boolean>;
  owned(): Promise<string[]>; // product ids the store says this account owns
  restore(): Promise<string[]>;
}

type NP = typeof import('@capgo/native-purchases');
let npMod: Promise<NP> | null = null;
const np = () => (npMod ??= import('@capgo/native-purchases'));

const nativeBackend: Backend = {
  async prices() {
    const { NativePurchases, PURCHASE_TYPE } = await np();
    const { products } = await NativePurchases.getProducts({ productIdentifiers: ALL_PRODUCTS, productType: PURCHASE_TYPE.INAPP });
    return Object.fromEntries(products.map((p) => [p.identifier, p.priceString]));
  },
  async buy(productId) {
    const { NativePurchases, PURCHASE_TYPE } = await np();
    const t = await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, quantity: 1 });
    // Android reports a pending payment (e.g. cash at a shop) as state "0": only "1" is paid
    return t.productIdentifier === productId && (t.purchaseState === undefined || t.purchaseState === '1');
  },
  async owned() {
    const { NativePurchases, PURCHASE_TYPE } = await np();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    return purchases.filter((t) => t.purchaseState === undefined || t.purchaseState === '1').map((t) => t.productIdentifier);
  },
  async restore() {
    const { NativePurchases } = await np();
    await NativePurchases.restorePurchases();
    return this.owned();
  },
};

/** Dev only (`?store=mock`): a pretend store, to try the purchase flow in a browser. */
const mockOwned: string[] = [];
const mockBackend: Backend = {
  async prices() { return { ...DEFAULT_PRICES }; },
  async buy(productId) {
    await new Promise((r) => setTimeout(r, 400));
    if (!window.confirm(`[TEST STORE] Buy ${productId}?`)) return false;
    mockOwned.push(productId);
    return true;
  },
  async owned() { return [...mockOwned]; },
  async restore() { return [...mockOwned]; },
};

const backend: Backend | null = Capacitor.isNativePlatform() ? nativeBackend : import.meta.env.DEV && params.get('store') === 'mock' ? mockBackend : null;

/** True where purchases are possible (the iOS / Android apps). On the web, fighters are earn-only. */
export const storeAvailable = () => backend !== null;

let priceCache: Record<string, string> = { ...DEFAULT_PRICES };
export const priceOf = (productId: string) => priceCache[productId] ?? DEFAULT_PRICES[productId];

/** At launch in the apps: fetch real prices, and re-sync anything owned (reinstall, second device). */
export async function initStore(): Promise<void> {
  if (!backend) return;
  try { priceCache = { ...DEFAULT_PRICES, ...(await backend.prices()) }; } catch { /* offline: keep default prices */ }
  try { grant(await backend.owned()); } catch { /* offline: keep what's saved */ }
}

export type BuyResult = 'bought' | 'cancelled' | 'unavailable' | 'error';

export async function buy(productId: string): Promise<BuyResult> {
  if (!backend) return 'unavailable';
  try {
    if (!(await backend.buy(productId))) return 'cancelled';
    grant([productId]);
    return 'bought';
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    return msg.includes('cancel') ? 'cancelled' : 'error';
  }
}

/** Apple requires a Restore Purchases button for non-consumables. Returns how many fighters it brought back. */
export async function restorePurchases(): Promise<number | 'unavailable' | 'error'> {
  if (!backend) return 'unavailable';
  const before = LOCKED_FIGHTERS.filter(isUnlocked).length;
  try {
    grant(await backend.restore());
    return LOCKED_FIGHTERS.filter(isUnlocked).length - before;
  } catch {
    return 'error';
  }
}

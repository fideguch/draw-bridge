import { describe, expect, it, vi } from 'vitest';
import { AD_PLACEMENTS } from '@platform/interfaces';
import type { AdPlacement } from '@platform/interfaces';
import { MemoryStorage, NoopAds, NoopAnalytics, NoopHaptics } from '@platform/noop';

/**
 * T077/T078 conformance suite (contracts/platform-interfaces.md §5).
 *
 * Scope: noop/ implementations + MemoryStorage + frozen placement constants.
 * The web/ and capacitor/ implementations wrap browser / native APIs that are
 * absent in the vitest `node` environment, so they are verified by `tsc`
 * (compile-time) + eslint boundaries only — no device APIs are exercised here.
 */

describe('AD_PLACEMENTS — frozen placement ids (conventions §3)', () => {
  it('exposes exactly the three frozen ad placement ids', () => {
    expect(AD_PLACEMENTS.rvCoinMultiplier).toBe('rv_coin_multiplier');
    expect(AD_PLACEMENTS.rvContinueHint).toBe('rv_continue_hint');
    expect(AD_PLACEMENTS.interstitialLevelComplete).toBe('interstitial_level_complete');
  });
});

describe('NoopAds — BR-008 default terminator', () => {
  it('is never ready and resolves unavailable (never rejects)', async () => {
    const ads = new NoopAds();
    expect(ads.isReady(AD_PLACEMENTS.rvCoinMultiplier)).toBe(false);
    await expect(ads.showRewarded('rv_coin_multiplier')).resolves.toBe('unavailable');
    await expect(ads.showInterstitial('interstitial_level_complete')).resolves.toBe('unavailable');
    await expect(ads.showRewarded('rv_continue_hint')).resolves.toBeDefined();
  });

  it('on() returns an unsubscribe function and fires nothing by default', () => {
    const ads = new NoopAds();
    const listener = vi.fn();
    const off = ads.on('rewarded', listener);
    expect(typeof off).toBe('function');
    off();
    expect(listener).not.toHaveBeenCalled();
  });

  it('instantSuccess dev flag grants rewarded / closed immediately (flag-hidden UI exercise)', async () => {
    const ads = new NoopAds({ instantSuccess: true });
    expect(ads.isReady('rv_coin_multiplier' as AdPlacement)).toBe(true);
    await expect(ads.showRewarded('rv_coin_multiplier')).resolves.toBe('rewarded');
    await expect(ads.showInterstitial('interstitial_level_complete')).resolves.toBe('closed');
  });
});

describe('NoopAnalytics — fire-and-forget, never throws', () => {
  it('track is a no-op for every frozen event with typed params', () => {
    const analytics = new NoopAnalytics();
    expect(() => analytics.track('level_start', { level_name: 'ch1-l01' })).not.toThrow();
    expect(() =>
      analytics.track('level_end', {
        level_name: 'ch1-l01',
        success: true,
        stars: 3,
        ink_consumed: 4,
        duration_ticks: 300,
      }),
    ).not.toThrow();
    expect(() =>
      analytics.track('earn_virtual_currency', {
        virtual_currency_name: 'coins',
        value: 25,
        source: 'clear_reward',
      }),
    ).not.toThrow();
    expect(() =>
      analytics.track('spend_virtual_currency', {
        virtual_currency_name: 'coins',
        value: 75,
        item_name: 'ink_capacity',
      }),
    ).not.toThrow();
  });
});

describe('NoopHaptics — unavailable, no-throw', () => {
  it('is unavailable and impact never throws (incl. stress intensity)', () => {
    const haptics = new NoopHaptics();
    expect(haptics.isAvailable()).toBe(false);
    expect(() => haptics.impact('confirm')).not.toThrow();
    expect(() => haptics.impact('creak', 0.7)).not.toThrow();
    expect(() => haptics.impact('starSequence', 1)).not.toThrow();
  });
});

describe('MemoryStorage — StorageInterface conformance (§4)', () => {
  it('get returns null for a missing key', async () => {
    const storage = new MemoryStorage();
    await expect(storage.get('missing')).resolves.toBeNull();
  });

  it('set/get roundtrip, then remove clears it', async () => {
    const storage = new MemoryStorage();
    await storage.set('k', 'v');
    await expect(storage.get('k')).resolves.toBe('v');
    await storage.remove('k');
    await expect(storage.get('k')).resolves.toBeNull();
  });

  it('set is atomic per key — last write wins', async () => {
    const storage = new MemoryStorage();
    await storage.set('k', 'a');
    await storage.set('k', 'b');
    await expect(storage.get('k')).resolves.toBe('b');
  });
});

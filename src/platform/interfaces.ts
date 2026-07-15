/**
 * Platform interfaces — the four seams game logic (engine/meta/render) uses to
 * reach platform capabilities. Implementations live in `noop/`, `web/`,
 * `capacitor/` and are selected once at startup by runtime detection.
 *
 * Interface names, method names, placement IDs, and the analytics event
 * vocabulary are FROZEN per constitution (Decision Freeze) and conventions.md
 * §3. Renaming any of them requires a constitution amendment, not a refactor.
 *
 * Global conformance rules (FR-022, contracts/platform-interfaces.md):
 * - No interface method throws synchronously. Ad/analytics/haptics failures are
 *   recorded (dev console) and swallowed — they never block game progress.
 * - Storage is the one exception: its promises may reject and callers follow the
 *   FR-021 recovery path (see SaveManager).
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Ads
// ────────────────────────────────────────────────────────────────────────────

/** Placement constants — FROZEN (conventions.md §3). */
export const AD_PLACEMENTS = {
  /** rewarded: bonus-level "collect ×2". */
  rvCoinMultiplier: 'rv_coin_multiplier',
  /** rewarded: hint/continue (reserved). */
  rvContinueHint: 'rv_continue_hint',
  interstitialLevelComplete: 'interstitial_level_complete',
} as const;

export type RewardedPlacement = 'rv_coin_multiplier' | 'rv_continue_hint';
export type InterstitialPlacement = 'interstitial_level_complete';
export type AdPlacement = RewardedPlacement | InterstitialPlacement;

export type AdResult =
  | 'rewarded' // rewarded ad watched to completion — grant the reward
  | 'closed' // dismissed early (rewarded: no grant) / interstitial finished
  | 'failed' // load/show error — proceed as if closed, never block
  | 'unavailable'; // no fill / not ready / noop default

export type AdEvent = 'loaded' | 'opened' | 'closed' | 'rewarded' | 'failed';

export interface AdInterface {
  showRewarded(placement: RewardedPlacement): Promise<AdResult>;
  showInterstitial(placement: InterstitialPlacement): Promise<AdResult>;
  isReady(placement: AdPlacement): boolean;
  /** Subscribe to ad lifecycle events; returns an unsubscribe function. */
  on(event: AdEvent, listener: (placement: AdPlacement) => void): () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Analytics — GA4 vocabulary, FROZEN (conventions.md §3)
// ────────────────────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | 'level_start'
  | 'level_end'
  | 'earn_virtual_currency'
  | 'spend_virtual_currency';

/** Param names follow the GA4 standard (snake_case is the GA4 wire format). */
export interface AnalyticsParams {
  level_start: { level_name: string };
  level_end: {
    level_name: string;
    success: boolean;
    stars?: 1 | 2 | 3; // clear only
    fail_cause?: 'fall' | 'tipOver' | 'timeout'; // fail only
    ink_consumed?: number;
    duration_ticks?: number;
  };
  earn_virtual_currency: {
    virtual_currency_name: 'coins';
    value: number;
    source: 'clear_reward' | 'level_coins' | 'bonus_reward'; // custom param
  };
  spend_virtual_currency: {
    virtual_currency_name: 'coins';
    value: number;
    item_name: 'ink_capacity' | 'engine_speed';
  };
}

export interface AnalyticsInterface {
  track<E extends AnalyticsEvent>(event: E, params: AnalyticsParams[E]): void;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Haptics
// ────────────────────────────────────────────────────────────────────────────

export type HapticEvent =
  | 'confirm' // line commit
  | 'launch'
  | 'land' // big jumps only
  | 'coin' // thinned: 1 per coin.hapticThinning (3)
  | 'creak' // repeated while stress in [0.6, 1.0]
  | 'starSequence' // 3 steps: light → medium → heavy
  | 'inkDepleted'; // warning

export interface HapticsInterface {
  /** intensity 0..1 — used by 'creak' (stress-proportional); others use the fixed mapping. */
  impact(kind: HapticEvent, intensity?: number): void;
  isAvailable(): boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Storage
// ────────────────────────────────────────────────────────────────────────────

export interface StorageInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

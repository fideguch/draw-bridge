# Contract: Platform Interfaces

Defined in `src/platform/interfaces.ts`; implementations in `src/platform/noop/`, `src/platform/web/`, `src/platform/capacitor/`. Selected once at startup by runtime environment detection (`Capacitor.isNativePlatform()` → capacitor; else web; noop injected for ads/analytics in v1.0 everywhere).

**Interface names, method names, placement IDs, and the analytics event vocabulary are FROZEN per constitution (Decision Freeze) and conventions.md §3.** Renaming any of them requires a constitution amendment, not a refactor.

Global conformance rules (FR-022):
- No interface method may throw synchronously. Ad/analytics/haptics failures are recorded (dev console) and swallowed — they never block game progress. Storage is the one exception: its promises may reject, and callers follow the FR-021 recovery path.
- Game logic (engine/meta/render) calls platform capabilities **only** through these four interfaces — zero direct platform API calls (ESLint boundaries + grep-verifiable).

## 1. AdInterface

```ts
// Placement constants — FROZEN (conventions.md §3)
export const AD_PLACEMENTS = {
  rvCoinMultiplier: 'rv_coin_multiplier',        // rewarded: bonus-level "collect ×2"
  rvContinueHint: 'rv_continue_hint',            // rewarded: hint/continue (reserved)
  interstitialLevelComplete: 'interstitial_level_complete',
} as const;

export type RewardedPlacement = 'rv_coin_multiplier' | 'rv_continue_hint';
export type InterstitialPlacement = 'interstitial_level_complete';
export type AdPlacement = RewardedPlacement | InterstitialPlacement;

export type AdResult =
  | 'rewarded'      // rewarded ad watched to completion — grant the reward
  | 'closed'        // dismissed early (rewarded: no grant) / interstitial finished
  | 'failed'        // load/show error — proceed as if closed, never block
  | 'unavailable';  // no fill / not ready / noop default

export type AdEvent = 'loaded' | 'opened' | 'closed' | 'rewarded' | 'failed';

export interface AdInterface {
  showRewarded(placement: RewardedPlacement): Promise<AdResult>;
  showInterstitial(placement: InterstitialPlacement): Promise<AdResult>;
  isReady(placement: AdPlacement): boolean;
  /** Subscribe to ad lifecycle events; returns an unsubscribe function. */
  on(event: AdEvent, listener: (placement: AdPlacement) => void): () => void;
}
```

Rules: the returned promise always resolves (never rejects). Reward grants key off the resolved `'rewarded'` value, not off events. Frequency caps and timing live in TuningConstants `ads.*` (values TBD, v1.1, remote-config-ready). All ad UI entry points exist in v1.0 but are hidden behind flags (FR-022).

## 2. AnalyticsInterface

```ts
// Event vocabulary — FROZEN (GA4 vocabulary, conventions.md §3)
export type AnalyticsEvent =
  | 'level_start'
  | 'level_end'
  | 'earn_virtual_currency'
  | 'spend_virtual_currency';

// Param names follow GA4 standard (snake_case is the GA4 wire format).
export interface AnalyticsParams {
  level_start: { level_name: string };
  level_end: {
    level_name: string;
    success: boolean;
    stars?: 1 | 2 | 3;                            // clear only
    fail_cause?: 'fall' | 'tipOver' | 'timeout';  // fail only
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
```

Rules: fire-and-forget, synchronous signature, never throws. Emission points: level start (Idle→Drawing first entry per attempt is NOT an event; level load is), level end (clear/fail confirm), every coin credit, every purchase. v1.0 transmits nothing (Noop).

## 3. HapticsInterface

```ts
export type HapticEvent =
  | 'confirm'       // line commit
  | 'launch'
  | 'land'          // big jumps only
  | 'coin'          // thinned: 1 per coin.hapticThinning (3)
  | 'creak'         // repeated while stress in [0.6, 1.0]
  | 'starSequence'  // 3 steps: light → medium → heavy
  | 'inkDepleted';  // warning

export interface HapticsInterface {
  /** intensity 0..1 — used by 'creak' (stress-proportional); others use the fixed mapping. */
  impact(kind: HapticEvent, intensity?: number): void;
  isAvailable(): boolean;
}
```

**Event → haptic mapping (single central table, co-located with TuningConstants — FR-014, research R6 / game_design §8.6):**

| HapticEvent | iOS (prepared generators) | Android (API 30+ primitives) | Strength |
|---|---|---|---|
| `confirm` | `.light` (`prepare()`d) | `PRIMITIVE_TICK` | 0.6 |
| `launch` | `.medium` | `PRIMITIVE_THUD` | 0.8 |
| `land` | `.heavy` | `PRIMITIVE_THUD` | 1.0 |
| `coin` | `.light` | `PRIMITIVE_TICK` | 0.4 |
| `creak` | weak repeated | `PRIMITIVE_LOW_TICK` repeated | stress-proportional (`intensity`) |
| `starSequence` | light→medium→heavy | TICK→CLICK→THUD composition | ascending |
| `inkDepleted` | `.notificationOccurred(.warning)` | `EFFECT_DOUBLE_CLICK` | — |

Rules:
- **Capability check + fallback (Android)**: at startup, check primitive support (`areAllPrimitivesSupported()` over the primitives above). If ANY used primitive is unsupported → the implementation switches to amplitude-based fallback for ALL events (a partially-silent event set is forbidden, FR-014).
- Devices without vibration hardware / unsupported browsers: `isAvailable()` returns false and `impact()` no-ops without throwing.
- The settings `haptics: false` gate lives ABOVE the interface (a single HapticsRouter in render/juice stops calling); implementations stay stateless.
- Touch→haptic latency ≤ 100 ms (iOS: generators pre-prepared at scene start).

## 4. StorageInterface

```ts
export interface StorageInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Rules: `set` is atomic **per key** — after resolution the full value is durable; after rejection the previous value must still be intact (no torn writes). Multi-key atomicity is NOT provided; the temp-key-then-swap save protocol is built on top in `SaveManager` (see [save-data.md](./save-data.md)). Rejections propagate (FR-021: retain last good data, retry at next trigger).

## 5. Implementation Conformance

### Noop (`src/platform/noop/`) — default for ads/analytics in v1.0 (BR-008)

| Interface | Behavior |
|---|---|
| NoopAd | `isReady` → `false`; `showRewarded`/`showInterstitial` → resolve `'unavailable'`; no events fire. Dev-only config flag `instantSuccess` (constructor option, dev builds): `isReady` → `true`, `showRewarded` → resolve `'rewarded'` immediately, `showInterstitial` → resolve `'closed'` — for exercising the flag-hidden ad UI without an SDK |
| NoopAnalytics | `track` → no-op (dev builds: `console.debug` the event + params) |
| NoopHaptics | `impact` → no-op; `isAvailable` → `false` |
| NoopStorage | in-memory Map (tests only — never selected at runtime) |

### Web (`src/platform/web/`)

- Storage: `localStorage` wrapped in resolved promises; `QuotaExceededError`/security errors → rejected promise (FR-021 path).
- Haptics: `navigator.vibrate` amplitude-only approximation where present, else no-op; `isAvailable` reflects support.
- Ads/Analytics: Noop in v1.0. Web-game-portal SDK events (Poki/CrazyGames) map onto AdInterface as alternative implementations (GTM phase) — the `AdResult` vocabulary above is the compatibility target.

### Capacitor (`src/platform/capacitor/`)

- Haptics: `@capacitor/haptics` — iOS impact styles per the table with prepared generators; Android primitive-composition path with the startup capability check + all-or-nothing amplitude fallback.
- Storage: `@capacitor/preferences` (async native KV; atomic per key).
- Ads/Analytics: Noop in v1.0. v1.1 adapters (pre-selected, NOT installed): `@capacitor-community/admob`, `@capacitor-firebase/analytics` (research R5).

### Contract tests (`tests/contract/`)

Every implementation passes one shared conformance suite per interface: promise-resolution guarantees, no-throw guarantees, Noop default results, storage atomicity (set-reject leaves previous value readable), haptics fallback all-or-nothing behavior.

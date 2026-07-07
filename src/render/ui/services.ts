/**
 * services.ts — the render-side PORT the meta/platform layers plug into.
 *
 * WHY A PORT (dependency inversion): eslint `boundaries` forbids `render → meta`
 * (conventions.md §1 / constitution IV). Scenes therefore never import
 * SaveManager/Economy directly. The composition root (src/main.ts, element-free)
 * constructs the concrete meta+platform+audio objects, wraps them in an object
 * that structurally satisfies `GameServices`, and publishes it on
 * `game.registry` under SERVICES_KEY. BootScene runs first and guarantees it is
 * present before any other scene reads it.
 *
 * The port exposes only primitives and render-local unions so no meta type ever
 * crosses the boundary.
 */

import Phaser from 'phaser';
import type { EngineEvents } from '@engine/EngineEvents';

/** Registry key holding the injected GameServices (set by main.ts). */
export const SERVICES_KEY = 'services';

/** Upgrade axes (mirrors meta UpgradeAxis; kept render-local to avoid the import). */
export type UpgradeAxisId = 'inkCapacity' | 'engineSpeed';

export interface LevelProgressView {
  readonly bestStars: number;
  readonly cleared: boolean;
}

/** Outcome of a purchase attempt (mirror of meta PurchaseResult, port-shaped). */
export type PurchaseOutcome =
  | { readonly ok: true; readonly newLevel: number; readonly newBalance: number }
  | { readonly ok: false; readonly reason: 'insufficientFunds' | 'maxLevel' };

/** Surfaced after load when a corrupt save triggered a restore (SC-001, FR-021). */
export interface SaveNotice {
  readonly fullReset: boolean;
  readonly progressReset: boolean;
}

/** A cleared attempt handed to the economy for crediting (BR-003), port-shaped. */
export interface LevelResultInputView {
  readonly levelId: string;
  readonly starRating: 1 | 2 | 3;
  /** Coins picked up during the run (credited on first clear only — BR-003). */
  readonly collectedCoins: number;
  /** Present for bonus levels (level JSON `bonusMultiplier`, 5–10). */
  readonly bonusMultiplier?: number;
}

/** What the economy credited for the attempt (Result overlay reads newBalance). */
export interface LevelResultCreditView {
  readonly totalCredited: number;
  readonly newBalance: number;
  readonly firstClear: boolean;
}

/**
 * Per-attempt juice handle (returned by attachEngineJuice). Bundles the
 * engine-event SFX/haptic detach with the render-driven audio+haptics the scene
 * fires from its own loop: the continuous drawing/running sounds (§4.1 1-4 /
 * §4.2 2-1 / 2-5) and the goal 5-beat celebration cues (§4.3). The concrete
 * SfxPlayer / HapticsRouter / AudioBus live in the composition root (main.ts) —
 * `render → meta` / `render → platform-impl` are forbidden — so the scene never
 * touches them directly; it drives these semantic methods and the root maps them
 * to buffers/haptics behind the port (sound/haptic settings gated there).
 */
export interface AttemptJuice {
  /** Detach the engine-event SFX + haptics for this attempt. */
  detach(): void;

  // ── continuous drawing / running sounds (scene-cadenced) ──────────────────
  /** Draw-scrub tick at draw speed [0,1] → volume/pitch (§4.1 1-4). */
  drawScrub(speed01: number): void;
  /** Anticipation engine-rev tick at progress [0,1] → rising pitch (§4.2 2-1). */
  revTick(progress01: number): void;
  /** Engine-hum tick at speed ratio [0,1] → gear-stepped pitch (§4.2 2-5). */
  engineHum(speedRatio01: number): void;

  // ── goal celebration cues (§4.3) ──────────────────────────────────────────
  /** Duck the BGM bus for the celebration (§4.3 3-8). */
  duckBgm(): void;
  /** Restore the BGM bus after the celebration. */
  unduckBgm(): void;
  /** Star beat i (0-2): C-E-G arpeggio + cymbal on the 3rd + ascending haptic (§4.3 3-4). */
  goalStarBeat(index: number): void;
  /** Reward count-up tick at progress [0,1] → pitch 1.0→1.3 (§4.3 3-5). */
  goalCountTick(progress01: number): void;
  /** Coin arrival i: a semitone-up chime (§4.3 3-6). */
  goalCoinArrive(index: number): void;
  /** Confetti cannon side (0 left / 1 right): pop SFX + heavy haptic on side 0 (§4.3 3-3). */
  goalConfettiPop(sideIndex: number): void;
}

/**
 * The full service surface the meta screens consume. Every method is
 * synchronous-safe to call from a scene; the async ones persist through the
 * SaveManager triggers behind the port.
 */
export interface GameServices {
  /** Idempotent first-gesture AudioContext unlock (called on every button press). */
  resumeAudio(): void;
  /** Play the shared UI tap SFX (respects the sound setting). */
  playTap(): void;
  /** Fire a light UI haptic (respects the haptics setting). */
  uiHaptic(): void;

  /** Load persisted save; resolves to a notice only when a restore lost data. */
  loadSave(): Promise<SaveNotice | null>;

  /** Single coin balance shown identically on Home/Shop/Result (FR-018, P1). */
  getBalance(): number;

  /** Progress for a level id, or null when never played. */
  getProgress(levelId: string): LevelProgressView | null;
  /** Convenience: has this level ever been cleared (drives unlock chains). */
  isCleared(levelId: string): boolean;

  /** Current upgrade level for an axis (0..maxUpgradeLevel). */
  getUpgradeLevel(axis: UpgradeAxisId): number;
  /** Next-level price, or null when the axis is already maxed. */
  getUpgradePrice(axis: UpgradeAxisId): number | null;
  /** Buy one level; persists on success (FR-019). Double-tap-safe (meta V9). */
  purchase(axis: UpgradeAxisId): Promise<PurchaseOutcome>;

  isSoundEnabled(): boolean;
  isHapticsEnabled(): boolean;
  /** Toggle sound: applies to the audio bus immediately + persists (FR-014/020). */
  setSoundEnabled(enabled: boolean): Promise<void>;
  /** Toggle haptics: gates the router immediately + persists (FR-014/020). */
  setHapticsEnabled(enabled: boolean): Promise<void>;
  /** Wipe progress + coins + upgrades, retain settings, persist (FR-020). */
  resetProgress(): Promise<void>;

  /**
   * Persist a cleared attempt: credit coins (clear reward + first-clear coins,
   * BR-003) and update bestStars progress (monotonic, V10). PlayScene calls this
   * on clear; a later LevelSelect visit reads the refreshed progress/unlock.
   */
  creditLevelResult(input: LevelResultInputView): Promise<LevelResultCreditView>;

  /**
   * Wire engine-event juice (SFX + haptics) for ONE attempt's event bus and
   * return an AttemptJuice handle (detach + scene-driven celebration cues). The
   * composition root owns the concrete SfxPlayer/HapticsRouter/AudioBus —
   * `render → meta` and `render → platform-impl` are forbidden (constitution IV
   * / conventions §1) — so PlayScene hands it the sim's events rather than
   * constructing those itself. Camera/renderer juice (kick, trauma, stress tint,
   * coin pop, confetti, stars) stays in PlayScene where the scene objects live.
   */
  attachEngineJuice(events: EngineEvents): AttemptJuice;
}

/** Read the injected services from a scene registry (throws if BootScene skipped). */
export function getServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(SERVICES_KEY) as GameServices | undefined;
  if (services === undefined) {
    throw new Error('GameServices missing on registry — BootScene must run first.');
  }
  return services;
}

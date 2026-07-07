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
}

/** Read the injected services from a scene registry (throws if BootScene skipped). */
export function getServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(SERVICES_KEY) as GameServices | undefined;
  if (services === undefined) {
    throw new Error('GameServices missing on registry — BootScene must run first.');
  }
  return services;
}

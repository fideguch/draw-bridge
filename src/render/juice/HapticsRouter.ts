/**
 * HapticsRouter — routes Engine events + UI moments to HapticsInterface calls
 * (T056, FR-014, game_design §4/§8.6, contracts/platform-interfaces.md §3).
 *
 * This is the single settings-gate above the platform interface (contract §3
 * rule: "the settings `haptics: false` gate lives ABOVE the interface — a single
 * HapticsRouter in render/juice stops calling; implementations stay stateless").
 * When disabled it issues zero impact() calls.
 *
 * Frozen HapticEvent mapping (the enum has no dedicated `break`/`land`/`ink`
 * source event, so those are routed via UI-moment hooks or a composed burst):
 * - strokeCommitted (engine) → impact('confirm')   .light / TICK   (0.6)
 * - launchReleased  (engine) → impact('launch')    .medium / THUD  (0.8)
 * - creak           (engine) → impact('creak', stress)   stress-proportional
 * - break           (engine) → weak burst: two rapid 'confirm' (.light) pulses
 * - coinCollected   (engine) → impact('coin'), thinned 1 per coin.hapticThinning
 * - onLanding()     (UI)     → impact('land')      .heavy / THUD   (1.0)
 * - starBeat(i)     (UI)     → impact('starSequence', ascending)  light→medium→heavy
 * - onInkEmpty()    (UI)     → impact('inkDepleted')  warning pattern
 *
 * `break` note: the frozen `HapticEvent` enum (constitution Decision Freeze)
 * has no 'break' member. game_design §4.2 (2-8) specifies no dedicated break
 * haptic; the task spec calls for "a weak burst (rapid two light pulses)", so we
 * compose it from two `confirm` (.light) impacts rather than amend the frozen
 * contract.
 */

import type { EngineEvents } from '@engine/EngineEvents';
import type { HapticEvent, HapticsInterface } from '@platform/interfaces';
import { coin, haptic } from '@tuning/TuningConstants';

/**
 * Ascending star-beat intensities (light → medium → heavy). Reuses the frozen
 * strength constants so the three beats match confirm/launch/land feel without
 * introducing magic numbers.
 */
const STAR_BEAT_INTENSITY = [
  haptic.confirmStrength, // light  (0.6)
  haptic.launchStrength, //  medium (0.8)
  haptic.landStrength, //    heavy  (1.0)
] as const;

export interface HapticsRouterOptions {
  /** Start enabled? Defaults to true. Mirrors the settings toggle (FR-014). */
  readonly enabled?: boolean;
  /** 1 haptic per N coins. Defaults to coin.hapticThinning (3). */
  readonly coinThinning?: number;
}

export class HapticsRouter {
  private readonly haptics: HapticsInterface;
  private readonly events: EngineEvents;
  private readonly coinThinning: number;
  private enabled: boolean;
  private coinPickupCount = 0;
  private readonly unsubscribes: Array<() => void> = [];
  private isAttached = false;

  constructor(haptics: HapticsInterface, events: EngineEvents, options: HapticsRouterOptions = {}) {
    this.haptics = haptics;
    this.events = events;
    this.enabled = options.enabled ?? true;
    this.coinThinning = Math.max(1, Math.floor(options.coinThinning ?? coin.hapticThinning));
  }

  /** Subscribe to the engine event bus. Idempotent. */
  attach(): void {
    if (this.isAttached) {
      return;
    }
    this.isAttached = true;
    this.unsubscribes.push(
      this.events.on('strokeCommitted', () => this.fire('confirm')),
      this.events.on('launchReleased', () => this.fire('launch')),
      this.events.on('creak', (payload) => this.fire('creak', payload.stress)),
      this.events.on('break', () => this.fireBreakBurst()),
      this.events.on('coinCollected', () => this.onCoinCollected()),
    );
  }

  /** Unsubscribe from every event (clean teardown). Idempotent. */
  detach(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
    this.isAttached = false;
  }

  /** Settings toggle (FR-014). Disabling also resets the coin-thinning phase. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.coinPickupCount = 0;
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  // ── UI moments (not engine events) ──────────────────────────────────────────

  /** Big-jump landing (Phase 6 wiring supplies the detection). */
  onLanding(): void {
    this.fire('land');
  }

  /** Ink depleted mid-stroke → warning pattern. */
  onInkEmpty(): void {
    this.fire('inkDepleted');
  }

  /** Goal celebration star `index` (0,1,2) → ascending light→medium→heavy. */
  starBeat(index: number): void {
    const clamped = Math.min(Math.max(Math.floor(index), 0), STAR_BEAT_INTENSITY.length - 1);
    const intensity = STAR_BEAT_INTENSITY[clamped] ?? haptic.landStrength;
    this.fire('starSequence', intensity);
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private onCoinCollected(): void {
    if (!this.enabled) {
      return;
    }
    this.coinPickupCount += 1;
    // Fire on the first pickup of every group of N (1st, 1+N th, …): immediate
    // feedback, then thinned to avoid buzz spam (game_design §4.2 2-13).
    if ((this.coinPickupCount - 1) % this.coinThinning === 0) {
      this.fire('coin');
    }
  }

  private fireBreakBurst(): void {
    this.fire('confirm');
    this.fire('confirm');
  }

  private fire(kind: HapticEvent, intensity?: number): void {
    if (!this.enabled) {
      return;
    }
    this.haptics.impact(kind, intensity);
  }
}

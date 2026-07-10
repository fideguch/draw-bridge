/**
 * inkUpsell — the pure DESIGN.md §8.4 ink-shortage upsell decision (round-7
 * migration, game_plan_v5 §4), extracted from PlayScene so it is unit-testable
 * headless (PlayScene itself imports Phaser).
 *
 * The 強化 ink upsell is offered when the ink was ~fully spent AND still upgradable,
 * on EITHER signal that "the bridge could not reach on this ink":
 *   A. a USER-FACING fail — hazardContact / tipOver / timeout (the causes that now
 *      surface a fail overlay; `fall` / `divergence` silent-reset instead), OR
 *   B. ≥2 consecutive out-of-world FAILSAFE resets in one level (a repeated,
 *      invisible "bridge didn't reach").
 * AND (both branches): consumed ≥ 90% of the effective budget, and the ink-capacity
 * axis still has headroom.
 *
 * Migrated off the pre-round-7 cause==='fall' key: `fall` is now the demoted
 * out-of-world killY failsafe (F3), so keying on it alone never fired.
 */
import type { FailCause } from '@engine/rules/Judge';
import { isFailsafeReset } from '@engine/rules/Judge';

/** Ink-upsell decision inputs (all pure scalars — no Phaser / engine handles). */
export interface InkUpsellInputs {
  /** The resolved attempt's fail cause. */
  readonly cause: FailCause;
  /** Consecutive out-of-world failsafe resets in this level (≥2 = repeated). */
  readonly consecutiveFailsafeResets: number;
  /** Ink consumed by the failing attempt (world m of arc length). */
  readonly consumed: number;
  /** Effective ink budget for the attempt (post-upgrade). */
  readonly effectiveBudget: number;
  /** Current ink-capacity upgrade level. */
  readonly inkCapacityLevel: number;
  /** Max upgrade level for the ink-capacity axis (economy.maxUpgradeLevel). */
  readonly maxUpgradeLevel: number;
}

/** True when the ink upsell should be surfaced on this fail (see module header). */
export function shouldOfferInkUpsell(input: InkUpsellInputs): boolean {
  const isUserFacingFail =
    input.cause === 'hazardContact' || input.cause === 'tipOver' || input.cause === 'timeout';
  const hasRepeatedFailsafe =
    isFailsafeReset({ outcome: 'fail', cause: input.cause }) && input.consecutiveFailsafeResets >= 2;
  if (!isUserFacingFail && !hasRepeatedFailsafe) {
    return false;
  }
  const isNearlyDepleted = input.effectiveBudget > 0 && input.consumed >= input.effectiveBudget * 0.9;
  const hasHeadroom = input.inkCapacityLevel < input.maxUpgradeLevel;
  return isNearlyDepleted && hasHeadroom;
}

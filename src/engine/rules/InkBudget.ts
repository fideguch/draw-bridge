/**
 * InkBudget — per-attempt ink accounting (FR-002, FR-003, FR-019).
 *
 * Effective budget = level.inkBudget x (1 + inkCapacityLv x
 * economy.inkPerLevelPct / 100). The upgrade is a REAL multiplier (BR-005):
 * base ink is authored to clear every level, the upgrade genuinely extends it.
 *
 * consume() decrements in the same frame the stroke grows (FR-002);
 * refund() restores ink when a below-minimum stroke is discarded (FR-003).
 * Both clamp (consume to remaining, refund to consumed) and return the
 * amount actually applied, so callers can settle partial amounts safely.
 *
 * Zone contract (render bar colors, ink.warnYellowRatio / warnRedRatio):
 * - 'ok'       : remaining ratio  > 0.5   (normal)
 * - 'low'      : 0.2 <= ratio <= 0.5      (bar turns yellow AT the 50% mark)
 * - 'critical' : ratio < 0.2              (red strictly BELOW the 20% mark)
 *
 * `consumed` is the raw world-meter consumption — StarRating compares it
 * against level thresholds unscaled (data-model §1.6).
 */

import { economy, ink } from '@tuning/TuningConstants';

export type InkZone = 'ok' | 'low' | 'critical';

export interface InkBudgetOptions {
  /** Level JSON inkBudget in world meters (> 0). */
  readonly levelInkBudget: number;
  /** Ink capacity upgrade level, 0..economy.maxUpgradeLevel (FR-019). */
  readonly inkCapacityLv?: number;
}

export class InkBudget {
  /** Level budget after the upgrade multiplier (world meters). */
  readonly effectiveBudget: number;

  private remainingInk: number;

  constructor(options: InkBudgetOptions) {
    const { levelInkBudget } = options;
    const inkCapacityLv = options.inkCapacityLv ?? 0;
    if (!Number.isFinite(levelInkBudget) || levelInkBudget <= 0) {
      throw new Error(`InkBudget: levelInkBudget must be a finite number > 0 (got ${levelInkBudget})`);
    }
    if (!Number.isInteger(inkCapacityLv) || inkCapacityLv < 0 || inkCapacityLv > economy.maxUpgradeLevel) {
      throw new Error(
        `InkBudget: inkCapacityLv must be an integer in 0..${economy.maxUpgradeLevel} (got ${inkCapacityLv})`,
      );
    }
    this.effectiveBudget = levelInkBudget * (1 + inkCapacityLv * (economy.inkPerLevelPct / 100));
    this.remainingInk = this.effectiveBudget;
  }

  get remaining(): number {
    return this.remainingInk;
  }

  /** Raw world-meter consumption so far (star rating input, unscaled). */
  get consumed(): number {
    return this.effectiveBudget - this.remainingInk;
  }

  /** Remaining fraction of the effective budget, in [0, 1]. */
  get ratio(): number {
    return this.remainingInk / this.effectiveBudget;
  }

  /** Bar color zone — see class header for the boundary contract. */
  get zone(): InkZone {
    if (this.ratio > ink.warnYellowRatio) {
      return 'ok';
    }
    return this.ratio >= ink.warnRedRatio ? 'low' : 'critical';
  }

  get canDraw(): boolean {
    return this.remainingInk > 0;
  }

  /** Consume up to `length` meters; returns the amount actually consumed. */
  consume(length: number): number {
    this.assertAmount('consume', length);
    const applied = Math.min(length, this.remainingInk);
    this.remainingInk -= applied;
    return applied;
  }

  /** Refund up to `length` meters (clamped to consumed); returns the amount restored. */
  refund(length: number): number {
    this.assertAmount('refund', length);
    const applied = Math.min(length, this.consumed);
    this.remainingInk += applied;
    return applied;
  }

  private assertAmount(operation: string, length: number): void {
    if (!Number.isFinite(length) || length < 0) {
      throw new Error(`InkBudget.${operation}: length must be a finite number >= 0 (got ${length})`);
    }
  }
}

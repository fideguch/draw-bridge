/**
 * StarRating — ink-consumption star rating on clear (FR-007, data-model §1.6).
 *
 * Boundary contract (both INCLUSIVE — less ink = better):
 * - consumed <= star3          -> 3 stars (exactly star3 still earns 3)
 * - star3 < consumed <= star2  -> 2 stars (exactly star2 still earns 2)
 * - consumed > star2           -> 1 star  (ANY clear earns at least 1, FR-007)
 *
 * Thresholds come from level JSON (validated by LevelSchema: 0 < star3 <
 * star2 <= inkBudget) and compare RAW consumption — the ink-capacity upgrade
 * scales the budget, never the star maths (data-model §1.6).
 */

import type { StarThresholds } from '../level/LevelSchema';

export type StarCount = 1 | 2 | 3;

/** Rate a cleared attempt from its raw ink consumption (world meters). */
export function rateStars(inkConsumed: number, thresholds: StarThresholds): StarCount {
  if (!Number.isFinite(inkConsumed) || inkConsumed < 0) {
    throw new Error(`rateStars: inkConsumed must be a finite number >= 0 (got ${inkConsumed})`);
  }
  if (inkConsumed <= thresholds.star3) {
    return 3;
  }
  return inkConsumed <= thresholds.star2 ? 2 : 1;
}

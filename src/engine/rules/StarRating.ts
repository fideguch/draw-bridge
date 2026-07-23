/**
 * StarRating — star rating on clear (FR-007, data-model §1.6). Engine-pure.
 *
 * V1 (rateStars) — ink-consumption only (round-7). Boundary contract (both
 * INCLUSIVE — less ink = better):
 * - consumed <= star3          -> 3 stars (exactly star3 still earns 3)
 * - star3 < consumed <= star2  -> 2 stars (exactly star2 still earns 2)
 * - consumed > star2           -> 1 star  (ANY clear earns at least 1, FR-007)
 * Thresholds come from level JSON (validated: 0 < star3 < star2 <= inkBudget) and
 * compare RAW consumption — the ink-capacity upgrade scales the budget, never the
 * star maths (data-model §1.6).
 *
 * V2 (rateStarsV2) — OBJECTIVE-based (round-9 BR-014). ★1 = clear; ★2 = clear +
 * objective met (coins collected / no breaks — computed by the caller); ★3 = ★2 +
 * inkUsed <= star3. star2 is no longer part of the maths (see StarThresholds).
 */

import type { StarThresholds } from '../level/LevelSchema';

export type StarCount = 1 | 2 | 3;

function assertFiniteInk(inkConsumed: number, fn: string): void {
  if (!Number.isFinite(inkConsumed) || inkConsumed < 0) {
    throw new Error(`${fn}: inkConsumed must be a finite number >= 0 (got ${inkConsumed})`);
  }
}

/** V1: rate a cleared attempt from its raw ink consumption (world meters). */
export function rateStars(inkConsumed: number, thresholds: StarThresholds): StarCount {
  assertFiniteInk(inkConsumed, 'rateStars');
  if (inkConsumed <= thresholds.star3) {
    return 3;
  }
  return inkConsumed <= thresholds.star2 ? 2 : 1;
}

/**
 * V2 (BR-014): rate a cleared attempt from its objective + ink margin. Called
 * ONLY on a clear, so the floor is ★1. `objectiveMet` is the level objective
 * result (all coins collected, or zero breaks); `star3` is the ★3 ink margin.
 */
export function rateStarsV2(objectiveMet: boolean, inkConsumed: number, star3: number): StarCount {
  assertFiniteInk(inkConsumed, 'rateStarsV2');
  if (!objectiveMet) {
    return 1; // cleared, but the ★2 objective was not met
  }
  return inkConsumed <= star3 ? 3 : 2;
}

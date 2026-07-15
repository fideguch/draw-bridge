/**
 * CoinTracker — per-attempt coin pickup detection (FR-009).
 *
 * COLLECTION RULE (documented decision): a coin is collected the first tick
 * the VehicleReferencePoint comes within coin.collectRadiusM (INCLUSIVE) of
 * the coin center. The reference point is used instead of a chassis-AABB
 * overlap because it is the UL's single judgement point (data-model §1.4),
 * fully deterministic, and requires no Box2D sensor/contact plumbing. Each
 * coin collects at most once per attempt; restart rebuilds the tracker
 * (fail/restart restores placements per game_design §2).
 *
 * Crediting is NOT this module's job: collected coins only convert to
 * currency on clear (BR-003, meta layer).
 */

import type { Point } from '../level/LevelSchema';
import { coin } from '@tuning/TuningConstants';

export class CoinTracker {
  private readonly coins: readonly Point[];
  private readonly collected: boolean[];
  private collectedTotal = 0;

  constructor(coins: readonly Point[]) {
    for (const [index, position] of coins.entries()) {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error(`CoinTracker: coin ${index} position must be finite`);
      }
    }
    this.coins = coins.map((position) => ({ x: position.x, y: position.y }));
    this.collected = coins.map(() => false);
  }

  /** Total coins in the level (collected or not). */
  get total(): number {
    return this.coins.length;
  }

  get collectedCount(): number {
    return this.collectedTotal;
  }

  isCollected(index: number): boolean {
    return this.collected[index] ?? false;
  }

  /**
   * Check the reference point against all uncollected coins.
   * Returns the indices newly collected by THIS update (ascending).
   */
  update(referencePoint: Point): readonly number[] {
    const newlyCollected: number[] = [];
    for (let index = 0; index < this.coins.length; index++) {
      if (this.collected[index] === true) {
        continue;
      }
      const position = this.coins[index] as Point;
      const distance = Math.hypot(referencePoint.x - position.x, referencePoint.y - position.y);
      if (distance <= coin.collectRadiusM) {
        this.collected[index] = true;
        this.collectedTotal++;
        newlyCollected.push(index);
      }
    }
    return newlyCollected;
  }
}

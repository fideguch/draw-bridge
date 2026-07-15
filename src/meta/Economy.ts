import { economy } from '@tuning/TuningConstants';
import type { ProgressMap, UpgradeLevelsData } from './SaveData';
import type { SaveManager } from './SaveManager';
import { isMaxLevel, upgradePrice } from './UpgradeState';
import type { UpgradeAxis } from './UpgradeState';

/**
 * Economy rules on top of SaveManager (FR-018, FR-019, BR-003, BR-005).
 * Owns coin crediting, upgrade purchase + pricing, and exposes the upgrade
 * levels the engine consumes as real multipliers. All mutating operations
 * persist through the SaveManager save triggers.
 */

export type PurchaseResult =
  | { ok: true; axis: UpgradeAxis; newLevel: number; price: number; newBalance: number }
  | { ok: false; reason: 'insufficientFunds'; shortfall: number; price: number; balance: number }
  | { ok: false; reason: 'maxLevel'; balance: number };

export interface LevelResultInput {
  levelId: string;
  outcome: 'clear' | 'fail';
  /** Required on clear. */
  starRating?: 1 | 2 | 3;
  /** Coins picked up during the run (credited on first clear only — BR-003). */
  collectedCoins: number;
  /** Present for bonus levels (level JSON `bonusMultiplier`, 5–10). */
  bonusMultiplier?: number;
}

export interface LevelResultCredit {
  clearReward: number;
  collectedCredited: number;
  bonusApplied: number;
  totalCredited: number;
  newBalance: number;
  firstClear: boolean;
}

export class Economy {
  constructor(private readonly save: SaveManager) {}

  get balance(): number {
    return this.save.getData().coins;
  }

  /** Upgrade levels the engine consumes directly (BR-005). */
  getUpgrades(): UpgradeLevelsData {
    const { inkCapacityLv, engineSpeedLv } = this.save.getData().upgrades;
    return { inkCapacityLv, engineSpeedLv };
  }

  /** Base clear reward (FR-018), optionally scaled by a bonus-level multiplier. */
  clearReward(bonusMultiplier = 1): number {
    return economy.clearReward * bonusMultiplier;
  }

  /** Price to buy the next level of an axis, or null when already at the cap. */
  priceFor(axis: UpgradeAxis): number | null {
    const currentLevel = this.levelOf(axis);
    return isMaxLevel(currentLevel) ? null : upgradePrice(currentLevel);
  }

  /**
   * Buy one level of an upgrade axis (FR-019). The balance check + state
   * mutation are fully synchronous (no await between read and write), so rapid
   * double-taps apply exactly once (V9); only the durable write is awaited.
   */
  async purchase(axis: UpgradeAxis): Promise<PurchaseResult> {
    const data = this.save.getData();
    const currentLevel = this.levelOf(axis);

    if (isMaxLevel(currentLevel)) {
      return { ok: false, reason: 'maxLevel', balance: data.coins };
    }
    const price = upgradePrice(currentLevel);
    if (data.coins < price) {
      return {
        ok: false,
        reason: 'insufficientFunds',
        shortfall: price - data.coins,
        price,
        balance: data.coins,
      };
    }

    const newLevel = currentLevel + 1;
    this.save.mutate((prev) => ({
      ...prev,
      coins: prev.coins - price,
      upgrades:
        axis === 'inkCapacity'
          ? { ...prev.upgrades, inkCapacityLv: newLevel }
          : { ...prev.upgrades, engineSpeedLv: newLevel },
    }));
    await this.save.saveOnPurchase();

    return { ok: true, axis, newLevel, price, newBalance: this.save.getData().coins };
  }

  /**
   * Credit a level result and persist at the level-end trigger (BR-003, BR-010).
   * Clear: reward every clear, collected coins on the first clear only, bonus
   * levels multiply the clear reward. Fail: nothing credited (coins discarded),
   * but the level-end save still fires. bestStars is monotonic (V10).
   */
  async creditLevelResult(input: LevelResultInput): Promise<LevelResultCredit> {
    const prev = this.save.getData();
    const hasClearedBefore = prev.progress[input.levelId]?.cleared ?? false;

    if (input.outcome === 'fail') {
      await this.save.saveOnLevelEnd();
      return {
        clearReward: 0,
        collectedCredited: 0,
        bonusApplied: 1,
        totalCredited: 0,
        newBalance: prev.coins,
        firstClear: false,
      };
    }

    const bonusApplied = input.bonusMultiplier ?? 1;
    const clearReward = this.clearReward(bonusApplied);
    const isFirstClear = !hasClearedBefore;
    const collectedCredited = isFirstClear ? input.collectedCoins : 0;
    const totalCredited = clearReward + collectedCredited;
    const stars = input.starRating ?? 1;

    this.save.mutate((current) => {
      const prevBest = current.progress[input.levelId]?.bestStars ?? 0;
      const progress: ProgressMap = {
        ...current.progress,
        [input.levelId]: { bestStars: Math.max(prevBest, stars), cleared: true },
      };
      return { ...current, coins: current.coins + totalCredited, progress };
    });
    await this.save.saveOnLevelEnd();

    return {
      clearReward,
      collectedCredited,
      bonusApplied,
      totalCredited,
      newBalance: this.save.getData().coins,
      firstClear: isFirstClear,
    };
  }

  private levelOf(axis: UpgradeAxis): number {
    const { inkCapacityLv, engineSpeedLv } = this.save.getData().upgrades;
    return axis === 'inkCapacity' ? inkCapacityLv : engineSpeedLv;
  }
}

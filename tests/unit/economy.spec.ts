import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@platform/noop';
import { SaveManager } from '@meta/SaveManager';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY_MAIN } from '@meta/SaveData';
import { Economy } from '@meta/Economy';
import {
  engineSpeedMultiplier,
  inkCapacityMultiplier,
  upgradePrice,
  upgradePriceLadder,
} from '@meta/UpgradeState';
import { economy as tuning } from '@tuning/TuningConstants';
import type { UpgradeLevels } from '@engine/GameSimulation';

async function economyWith(
  coins: number,
  upgrades: { inkCapacityLv: number; engineSpeedLv: number } = { inkCapacityLv: 0, engineSpeedLv: 0 },
): Promise<{ eco: Economy; manager: SaveManager; storage: MemoryStorage }> {
  const storage = new MemoryStorage();
  await storage.set(
    STORAGE_KEY_MAIN,
    JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      coins,
      upgrades,
      progress: {},
      settings: { sound: true, haptics: true },
    }),
  );
  const manager = new SaveManager(storage);
  await manager.load();
  return { eco: new Economy(manager), manager, storage };
}

describe('Economy — clear reward from TuningConstants (FR-018)', () => {
  it('base clear reward is the tuning value within the 20-30 band', async () => {
    const { eco } = await economyWith(0);
    expect(eco.clearReward()).toBe(tuning.clearReward);
    expect(tuning.clearReward).toBeGreaterThanOrEqual(20);
    expect(tuning.clearReward).toBeLessThanOrEqual(30);
  });

  it('bonus multiplier scales the clear reward (5-10x)', async () => {
    const { eco } = await economyWith(0);
    expect(eco.clearReward(6)).toBe(tuning.clearReward * 6);
  });
});

describe('UpgradeState — price curve (FR-019, game_design §7.2)', () => {
  it('ladder is 75/90/110/130/155 with a Lv5 cap on both axes', () => {
    expect([0, 1, 2, 3, 4].map(upgradePrice)).toEqual([75, 90, 110, 130, 155]);
    expect(upgradePriceLadder()).toEqual([75, 90, 110, 130, 155]);
  });

  it('base sits in 50-100 and growth in 1.15-1.25', () => {
    expect(tuning.upgradePriceBase).toBeGreaterThanOrEqual(50);
    expect(tuning.upgradePriceBase).toBeLessThanOrEqual(100);
    expect(tuning.upgradePriceGrowth).toBeGreaterThanOrEqual(1.15);
    expect(tuning.upgradePriceGrowth).toBeLessThanOrEqual(1.25);
  });

  it('exposes real effect multipliers (BR-005) for shop display', () => {
    expect(inkCapacityMultiplier(0)).toBe(1);
    expect(inkCapacityMultiplier(2)).toBeCloseTo(1.2, 9);
    expect(engineSpeedMultiplier(3)).toBeCloseTo(1.15, 9);
  });
});

describe('Economy — purchase (FR-019, V9)', () => {
  it('sufficient balance deducts, levels up, and persists via SaveManager', async () => {
    const { eco, storage } = await economyWith(100);
    const result = await eco.purchase('inkCapacity');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.price).toBe(75);
    expect(result.newLevel).toBe(1);
    expect(result.newBalance).toBe(25);
    expect(eco.getUpgrades().inkCapacityLv).toBe(1);

    const persisted = JSON.parse((await storage.get(STORAGE_KEY_MAIN)) as string);
    expect(persisted.coins).toBe(25);
    expect(persisted.upgrades.inkCapacityLv).toBe(1);
  });

  it('insufficient balance is rejected with a typed shortfall and no state change', async () => {
    const { eco } = await economyWith(50);
    const result = await eco.purchase('inkCapacity'); // price 75

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'insufficientFunds') {
      throw new Error('expected an insufficientFunds rejection');
    }
    expect(result.shortfall).toBe(25);
    expect(eco.balance).toBe(50);
    expect(eco.getUpgrades().inkCapacityLv).toBe(0);
  });

  it('rejects a purchase at the max upgrade level', async () => {
    const { eco } = await economyWith(100000, { inkCapacityLv: 5, engineSpeedLv: 0 });
    const result = await eco.purchase('inkCapacity');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('maxLevel');
    expect(eco.priceFor('inkCapacity')).toBeNull();
  });

  it('applies exactly once under rapid double-tap (V9)', async () => {
    const { eco } = await economyWith(100); // enough for one (75), not two (75 + 90)
    const [a, b] = await Promise.all([eco.purchase('inkCapacity'), eco.purchase('inkCapacity')]);

    const successes = [a, b].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
    expect(eco.getUpgrades().inkCapacityLv).toBe(1);
    expect(eco.balance).toBe(25);
  });
});

describe('Economy — level result crediting (BR-003)', () => {
  it('credits clear reward every clear but collected coins only on the first clear', async () => {
    const { eco, manager } = await economyWith(0);

    const first = await eco.creditLevelResult({
      levelId: 'ch1-l01',
      outcome: 'clear',
      starRating: 2,
      collectedCoins: 7,
    });
    expect(first.firstClear).toBe(true);
    expect(first.clearReward).toBe(tuning.clearReward);
    expect(first.collectedCredited).toBe(7);
    expect(first.totalCredited).toBe(tuning.clearReward + 7);
    expect(eco.balance).toBe(tuning.clearReward + 7);
    expect(manager.getData().progress['ch1-l01']).toEqual({ bestStars: 2, cleared: true });

    const replay = await eco.creditLevelResult({
      levelId: 'ch1-l01',
      outcome: 'clear',
      starRating: 3,
      collectedCoins: 5,
    });
    expect(replay.firstClear).toBe(false);
    expect(replay.collectedCredited).toBe(0); // BR-003: collected coins first clear only
    expect(replay.clearReward).toBe(tuning.clearReward); // reward credits every clear
    expect(eco.balance).toBe(tuning.clearReward * 2 + 7);
    expect(manager.getData().progress['ch1-l01']?.bestStars).toBe(3); // monotonic (V10)
  });

  it('a fail credits nothing and discards collected coins', async () => {
    const { eco } = await economyWith(10);
    const result = await eco.creditLevelResult({
      levelId: 'ch1-l02',
      outcome: 'fail',
      collectedCoins: 9,
    });
    expect(result.totalCredited).toBe(0);
    expect(eco.balance).toBe(10);
  });

  it('bestStars never decreases on a weaker replay (V10)', async () => {
    const { eco, manager } = await economyWith(0);
    await eco.creditLevelResult({ levelId: 'ch1-l03', outcome: 'clear', starRating: 3, collectedCoins: 0 });
    await eco.creditLevelResult({ levelId: 'ch1-l03', outcome: 'clear', starRating: 1, collectedCoins: 0 });
    expect(manager.getData().progress['ch1-l03']?.bestStars).toBe(3);
  });

  it('a bonus level multiplies the clear reward', async () => {
    const { eco } = await economyWith(0);
    const result = await eco.creditLevelResult({
      levelId: 'ch1-b1',
      outcome: 'clear',
      starRating: 1,
      collectedCoins: 0,
      bonusMultiplier: 6,
    });
    expect(result.clearReward).toBe(tuning.clearReward * 6);
    expect(result.totalCredited).toBe(tuning.clearReward * 6);
  });

  it('persists the level-end credit atomically', async () => {
    const { eco, storage } = await economyWith(0);
    await eco.creditLevelResult({ levelId: 'ch1-l01', outcome: 'clear', starRating: 1, collectedCoins: 0 });
    const persisted = JSON.parse((await storage.get(STORAGE_KEY_MAIN)) as string);
    expect(persisted.coins).toBe(tuning.clearReward);
    expect(persisted.progress['ch1-l01']).toEqual({ bestStars: 1, cleared: true });
  });
});

describe('Economy — upgrade levels feed the engine (BR-005)', () => {
  it('getUpgrades returns the engine-consumed multiplier levels', async () => {
    const { eco } = await economyWith(0, { inkCapacityLv: 2, engineSpeedLv: 3 });
    const upgrades: UpgradeLevels = eco.getUpgrades(); // compile-time: assignable to engine input
    expect(upgrades).toEqual({ inkCapacityLv: 2, engineSpeedLv: 3 });
  });
});

import { economy } from '@tuning/TuningConstants';

/**
 * Upgrade axes, price curve, and effect multipliers (FR-019, game_design §7.2,
 * data-model.md §1.8 economy group). Effects are REAL physics multipliers
 * (BR-005) — the engine consumes the levels directly; these helpers exist for
 * shop display + purchase pricing.
 */

export type UpgradeAxis = 'inkCapacity' | 'engineSpeed';

export const UPGRADE_AXES: readonly UpgradeAxis[] = ['inkCapacity', 'engineSpeed'];

/** Maps a purchase axis to its persisted level key in SaveData.upgrades. */
export const UPGRADE_AXIS_TO_KEY = {
  inkCapacity: 'inkCapacityLv',
  engineSpeed: 'engineSpeedLv',
} as const satisfies Record<UpgradeAxis, 'inkCapacityLv' | 'engineSpeedLv'>;

/** True when an axis is already at the cap (no further purchase). */
export function isMaxLevel(currentLevel: number): boolean {
  return currentLevel >= economy.maxUpgradeLevel;
}

/**
 * Coin price to advance FROM `currentLevel` TO `currentLevel + 1`:
 * `base × growth^currentLevel`, rounded to the nearest 5 (game_design §7.2).
 * Ladder Lv1–5: 75 / 90 / 110 / 130 / 155.
 */
export function upgradePrice(currentLevel: number): number {
  const raw = economy.upgradePriceBase * economy.upgradePriceGrowth ** currentLevel;
  return Math.round(raw / 5) * 5;
}

/** Full price ladder for one axis (index i = price from Lv i to Lv i+1). */
export function upgradePriceLadder(): number[] {
  const ladder: number[] = [];
  for (let level = 0; level < economy.maxUpgradeLevel; level += 1) {
    ladder.push(upgradePrice(level));
  }
  return ladder;
}

/** Ink budget multiplier at a given ink-capacity level (BR-005, FR-019). */
export function inkCapacityMultiplier(level: number): number {
  return 1 + level * (economy.inkPerLevelPct / 100);
}

/** Motor-speed multiplier at a given engine-speed level (BR-005, FR-019). */
export function engineSpeedMultiplier(level: number): number {
  return 1 + level * (economy.speedPerLevelPct / 100);
}

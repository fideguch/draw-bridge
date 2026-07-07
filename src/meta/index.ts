export { SaveManager } from './SaveManager';
export type { LoadResult, LoadSource, SaveManagerOptions, SaveReason, SaveResult } from './SaveManager';
export {
  CURRENT_SCHEMA_VERSION,
  initialSaveData,
  STORAGE_KEY_MAIN,
  STORAGE_KEY_TMP,
} from './SaveData';
export type {
  CorruptionReport,
  LevelProgress,
  ProgressMap,
  SaveData,
  SaveSettings,
  UpgradeLevelsData,
} from './SaveData';
export { Economy } from './Economy';
export type { LevelResultCredit, LevelResultInput, PurchaseResult } from './Economy';
export {
  engineSpeedMultiplier,
  inkCapacityMultiplier,
  isMaxLevel,
  UPGRADE_AXES,
  UPGRADE_AXIS_TO_KEY,
  upgradePrice,
  upgradePriceLadder,
} from './UpgradeState';
export type { UpgradeAxis } from './UpgradeState';

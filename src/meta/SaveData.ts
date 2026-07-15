import { economy } from '@tuning/TuningConstants';

/**
 * SaveData model, storage keys, validation, and the fresh-state factory
 * (contracts/save-data.md §1, data-model.md §1.7). Persisted by SaveManager
 * over a StorageInterface.
 */

/** Current schema version — attached on every write (save-data.md §1). */
export const CURRENT_SCHEMA_VERSION = 1;

/** Storage keys (save-data.md §2). */
export const STORAGE_KEY_MAIN = 'inkbridge.save';
export const STORAGE_KEY_TMP = 'inkbridge.save.tmp';

/** Star ceiling per level. */
export const MAX_STARS = 3;

export interface UpgradeLevelsData {
  inkCapacityLv: number;
  engineSpeedLv: number;
}

export interface LevelProgress {
  /** 0–3, monotonic non-decreasing; `> 0` implies `cleared`. */
  bestStars: number;
  cleared: boolean;
}

export type ProgressMap = Record<string, LevelProgress>;

export interface SaveSettings {
  sound: boolean;
  haptics: boolean;
}

export interface SaveData {
  schemaVersion: number;
  /** `>= 0` invariant (save-data.md §1). */
  coins: number;
  upgrades: UpgradeLevelsData;
  progress: ProgressMap;
  settings: SaveSettings;
  /** Unknown fields (future versions) are preserved verbatim across load→save. */
  [extra: string]: unknown;
}

/** Corruption partial-restore report (save-data.md §4). */
export interface CorruptionReport {
  salvaged: { upgrades: boolean; coins: boolean; progress: boolean; settings: boolean };
  /** True when the progress subtree was not fully readable (some/all reset). */
  progressReset: boolean;
  /** True when nothing at all was salvageable (fresh reset). */
  fullReset: boolean;
  /** True when the user MUST be told progress could not be restored (§4.2). */
  needsUserNotification: boolean;
}

/** Fresh state (fresh install / post-reset). `settings` may be retained (FR-020). */
export function initialSaveData(settings?: SaveSettings): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    coins: 0,
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
    progress: {},
    settings: settings ? { ...settings } : { sound: true, haptics: true },
  };
}

// ── validators (each subtree validated independently for partial restore) ────

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidCoins(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidUpgradeLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= economy.maxUpgradeLevel
  );
}

export function isValidUpgrades(value: unknown): value is UpgradeLevelsData {
  if (!isPlainObject(value)) return false;
  return isValidUpgradeLevel(value.inkCapacityLv) && isValidUpgradeLevel(value.engineSpeedLv);
}

export function isValidProgressEntry(value: unknown): value is LevelProgress {
  if (!isPlainObject(value)) return false;
  const { bestStars, cleared } = value;
  if (typeof bestStars !== 'number' || !Number.isInteger(bestStars)) return false;
  if (bestStars < 0 || bestStars > MAX_STARS) return false;
  if (typeof cleared !== 'boolean') return false;
  if (bestStars > 0 && !cleared) return false; // bestStars > 0 ⇒ cleared
  return true;
}

export function isValidSettings(value: unknown): value is SaveSettings {
  if (!isPlainObject(value)) return false;
  return typeof value.sound === 'boolean' && typeof value.haptics === 'boolean';
}

/** Whole-document validity at the CURRENT schema version (post-migration). */
export function isValidSaveData(value: unknown): value is SaveData {
  if (!isPlainObject(value)) return false;
  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) return false;
  if (!isValidCoins(value.coins)) return false;
  if (!isValidUpgrades(value.upgrades)) return false;
  if (!isPlainObject(value.progress)) return false;
  for (const entry of Object.values(value.progress)) {
    if (!isValidProgressEntry(entry)) return false;
  }
  if (!isValidSettings(value.settings)) return false;
  return true;
}

/**
 * Guard against writing an invariant-violating document (save-data.md §1:
 * "violating writes are a programming error — rejected before save"). Throws.
 */
export function assertSaveInvariants(data: SaveData): void {
  if (!isValidCoins(data.coins)) {
    throw new Error(`SaveData invariant: coins must be an integer >= 0 (got ${String(data.coins)})`);
  }
  if (!isValidUpgrades(data.upgrades)) {
    throw new Error('SaveData invariant: upgrade levels must be integers in 0..maxUpgradeLevel');
  }
}

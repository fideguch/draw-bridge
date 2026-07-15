import type { StorageInterface } from '@platform/interfaces';
import {
  assertSaveInvariants,
  CURRENT_SCHEMA_VERSION,
  initialSaveData,
  isPlainObject,
  isValidCoins,
  isValidProgressEntry,
  isValidSaveData,
  isValidSettings,
  isValidUpgrades,
  STORAGE_KEY_MAIN,
  STORAGE_KEY_TMP,
} from './SaveData';
import type { CorruptionReport, ProgressMap, SaveData } from './SaveData';
import { migrate } from './migrations';

/** Automatic save triggers (save-data.md §5, BR-010). */
export type SaveReason = 'levelEnd' | 'purchase' | 'settingsChange' | 'reset';

export interface SaveResult {
  reason: SaveReason;
  /** True once the atomic write completed; false ⇒ retry at next trigger (FR-021). */
  persisted: boolean;
}

export type LoadSource = 'main' | 'tmp' | 'fresh' | 'partial';

export interface LoadResult {
  source: LoadSource;
  corruption: CorruptionReport | null;
}

export interface SaveManagerOptions {
  /** Notified when a corrupt payload triggers partial/full restore (FR-021). */
  onCorruption?: (report: CorruptionReport) => void;
  /** Dev diagnostic for swallowed storage-write failures. */
  onError?: (error: unknown) => void;
}

/**
 * Owns the authoritative in-memory SaveData and its durable persistence
 * (contracts/save-data.md). Writes are atomic via a temp-key-then-swap protocol
 * over a StorageInterface; load performs migration, crash-window recovery, and
 * corruption partial-restore. Economy composes this for coin/upgrade mutations;
 * progress/settings callers use `mutate` + a save trigger.
 */
export class SaveManager {
  private data: SaveData = initialSaveData();
  private pendingRetry = false;

  constructor(
    private readonly storage: StorageInterface,
    private readonly options: SaveManagerOptions = {},
  ) {}

  /** Current authoritative state. Treat as read-only — mutate via `mutate`. */
  getData(): SaveData {
    return this.data;
  }

  /** True when the last write failed and a retry is owed at the next trigger. */
  get hasPendingWrite(): boolean {
    return this.pendingRetry;
  }

  /** Replace the in-memory state immutably (no persist — call a save trigger after). */
  mutate(update: (prev: SaveData) => SaveData): void {
    this.data = update(this.data);
  }

  /** Progress reset (FR-020): fresh state, current settings retained. */
  resetProgress(): void {
    this.data = initialSaveData(this.data.settings);
  }

  // ── save triggers (save-data.md §5) ───────────────────────────────────────

  async save(reason: SaveReason): Promise<SaveResult> {
    return { reason, persisted: await this.commit() };
  }

  saveOnLevelEnd(): Promise<SaveResult> {
    return this.save('levelEnd');
  }

  saveOnPurchase(): Promise<SaveResult> {
    return this.save('purchase');
  }

  saveOnSettingsChange(): Promise<SaveResult> {
    return this.save('settingsChange');
  }

  // ── load (save-data.md §2 load sequence + §4 corruption) ──────────────────

  async load(): Promise<LoadResult> {
    const mainRaw = await this.storage.get(STORAGE_KEY_MAIN);
    const mainState = this.tryFullLoad(mainRaw);
    if (mainState) {
      this.data = mainState;
      // A leftover tmp is harmless (next save overwrites/removes it); we avoid a
      // write-on-boot here to honor "re-save at next trigger" (§3).
      return { source: 'main', corruption: null };
    }

    const tmpRaw = await this.storage.get(STORAGE_KEY_TMP);
    const tmpState = this.tryFullLoad(tmpRaw);
    if (tmpState) {
      // Crash window: main missing/corrupt but tmp holds a verified write.
      this.data = tmpState;
      await this.commit(); // promote tmp → main, remove tmp
      return { source: 'tmp', corruption: null };
    }

    // Neither key present at all ⇒ fresh install (not corruption).
    if (mainRaw === null && tmpRaw === null) {
      this.data = initialSaveData();
      return { source: 'fresh', corruption: null };
    }

    // At least one key present but unusable ⇒ corruption partial restore (§4).
    const { data, report } = partialRestore(mainRaw, tmpRaw);
    this.data = data;
    await this.commit(); // §4.3: commit salvaged/initialized state
    this.options.onCorruption?.(report);
    return { source: report.fullReset ? 'fresh' : 'partial', corruption: report };
  }

  private tryFullLoad(raw: string | null): SaveData | null {
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isPlainObject(parsed)) return null;
      const migrated = migrate(parsed);
      if (!isValidSaveData(migrated)) return null;
      return migrated as SaveData;
    } catch {
      return null;
    }
  }

  // ── atomic write (save-data.md §2) ────────────────────────────────────────

  private async commit(): Promise<boolean> {
    // Programming-error invariant — surfaces (throws) rather than being swallowed.
    assertSaveInvariants(this.data);
    const json = JSON.stringify(this.data);
    try {
      await this.storage.set(STORAGE_KEY_TMP, json);
      const verify = await this.storage.get(STORAGE_KEY_TMP);
      if (verify !== json) {
        throw new Error('SaveManager: tmp verification mismatch');
      }
      await this.storage.set(STORAGE_KEY_MAIN, json);
      await this.storage.remove(STORAGE_KEY_TMP);
      this.pendingRetry = false;
      return true;
    } catch (error) {
      // FR-021: last good `main` is intact; retain in-memory state and retry at
      // the next trigger. No user interruption, no retry loop.
      this.pendingRetry = true;
      this.options.onError?.(error);
      return false;
    }
  }
}

// ── corruption partial restore (save-data.md §4) ────────────────────────────

function firstParseableObject(raws: readonly (string | null)[]): Record<string, unknown> | null {
  for (const raw of raws) {
    if (raw === null) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPlainObject(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function partialRestore(
  mainRaw: string | null,
  tmpRaw: string | null,
): { data: SaveData; report: CorruptionReport } {
  const candidate = firstParseableObject([mainRaw, tmpRaw]);
  const fresh = initialSaveData();

  if (!candidate) {
    return {
      data: fresh,
      report: {
        salvaged: { upgrades: false, coins: false, progress: false, settings: false },
        progressReset: true,
        fullReset: true,
        needsUserNotification: true,
      },
    };
  }

  // Priority 1: upgrades + coins (paid-for value). Guards are called inline so
  // TS narrows the salvaged branch (a stored boolean would not narrow).
  const hasSalvagedUpgrades = isValidUpgrades(candidate.upgrades);
  const upgrades = isValidUpgrades(candidate.upgrades) ? candidate.upgrades : fresh.upgrades;
  const hasSalvagedCoins = isValidCoins(candidate.coins);
  const coins = isValidCoins(candidate.coins) ? candidate.coins : fresh.coins;

  // Priority 2: progress (keep valid entries, drop malformed ones).
  const progress: ProgressMap = {};
  let isProgressFullyValid = false;
  if (isPlainObject(candidate.progress)) {
    let isEveryEntryValid = true;
    for (const [levelId, entry] of Object.entries(candidate.progress)) {
      if (isValidProgressEntry(entry)) {
        progress[levelId] = entry;
      } else {
        isEveryEntryValid = false;
      }
    }
    isProgressFullyValid = isEveryEntryValid;
  }
  const hasSalvagedSomeProgress = Object.keys(progress).length > 0;

  // Priority 3: settings.
  const hasSalvagedSettings = isValidSettings(candidate.settings);
  const settings = isValidSettings(candidate.settings) ? candidate.settings : fresh.settings;

  const hasAnySalvaged =
    hasSalvagedUpgrades || hasSalvagedCoins || hasSalvagedSomeProgress || hasSalvagedSettings;

  const data: SaveData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    coins,
    upgrades,
    progress,
    settings,
  };

  return {
    data,
    report: {
      salvaged: {
        upgrades: hasSalvagedUpgrades,
        coins: hasSalvagedCoins,
        progress: isProgressFullyValid,
        settings: hasSalvagedSettings,
      },
      progressReset: !isProgressFullyValid,
      fullReset: !hasAnySalvaged,
      // Silent resets are forbidden (§4.2): notify on full reset OR lost progress.
      needsUserNotification: !hasAnySalvaged || !isProgressFullyValid,
    },
  };
}

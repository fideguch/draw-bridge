import { CURRENT_SCHEMA_VERSION, isPlainObject } from './SaveData';

/**
 * Forward-only schema migration chain (save-data.md §3).
 *
 * `MIGRATIONS[n]` migrates a version-`n` document to version `n+1`. Migration
 * runs from the document's version up to CURRENT_SCHEMA_VERSION. Each step maps
 * known fields and spreads unknown fields through untouched (forward compat).
 *
 * A save with no `schemaVersion` (or `0`) is treated as legacy version 0;
 * `migrate0to1` normalizes it to the current shape. The `migrate1to2`… chain
 * described in the contract continues from here for future version bumps.
 */
type MigrationFn = (old: Record<string, unknown>) => Record<string, unknown>;

function migrate0to1(old: Record<string, unknown>): Record<string, unknown> {
  const upgrades = isPlainObject(old.upgrades) ? old.upgrades : {};
  const settings = isPlainObject(old.settings) ? old.settings : {};
  return {
    ...old, // preserve unknown top-level fields verbatim
    schemaVersion: 1,
    coins: typeof old.coins === 'number' ? old.coins : 0,
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0, ...upgrades },
    progress: isPlainObject(old.progress) ? old.progress : {},
    settings: { sound: true, haptics: true, ...settings },
  };
}

const MIGRATIONS: Record<number, MigrationFn> = {
  0: migrate0to1,
};

/** Thrown when a document is a version the app cannot migrate (corruption path). */
export class UnmigratableError extends Error {}

/**
 * Migrate a parsed document to CURRENT_SCHEMA_VERSION. Absent/`0` version ⇒ 0.
 * Versions newer than the app throw (older app never guesses newer data —
 * save-data.md §3). A missing intermediate migration also throws.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnmigratableError(`save version ${version} is newer than app ${CURRENT_SCHEMA_VERSION}`);
  }
  let doc = raw;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new UnmigratableError(`no migration registered for version ${version}`);
    }
    doc = step(doc);
    version += 1;
  }
  return doc;
}

/**
 * LevelLoader — JSON text -> parse -> forward-migrate -> validate -> typed Level.
 *
 * Shared by the game (level select / PlayScene) and Gate 0. Never throws:
 * parse failures and validation failures both surface as `{ ok: false, errors }`.
 */

import type { LevelValidation, ValidateLevelOptions } from './LevelSchema';
import { validateLevel } from './LevelSchema';

/**
 * Forward-migration hook (contracts/level-schema.md §4).
 *
 * schemaVersion 1 is the first shipped version, so this is currently an
 * identity pass. When schemaVersion 2 lands: validate against the version
 * declared in the file, apply the 1->2 step here, then re-validate against
 * current (Gate 2 ghosts must be re-verified after any migration).
 */
function migrateLevelJson(data: unknown): unknown {
  return data;
}

/** Parse and validate level JSON text into a typed, immutable Level. */
export function loadLevel(jsonText: string, options?: ValidateLevelOptions): LevelValidation {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`level JSON parse failed: ${message}`] };
  }
  return validateLevel(migrateLevelJson(data), options);
}

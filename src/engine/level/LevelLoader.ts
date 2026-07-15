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
 * Round-9: validateLevel now accepts BOTH schemaVersion 1 and 2 directly, with
 * version-gated semantics (LevelSchema header) — v1 keeps round-7 rules, v2 adds
 * persons/objective and narrows danger styles. A v1 level is therefore still
 * loaded and played as v1 (no in-place rewrite to v2); this stays an identity
 * pass. Add a real 1->2 transform here only if v1 levels must be up-converted on
 * load (Gate 2 ghosts would then need re-verification).
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

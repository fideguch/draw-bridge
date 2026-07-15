/**
 * levelCatalog.ts — the SC-002 tile catalog + sequential-unlock logic.
 *
 * The ORDER, labels, bonus flags, and unlock chain all come from the ONE ordered
 * slate in scripts/levels/manifest.ts (round-7 I2a). This module is the render
 * projection of that slate: it filters the declared 28-slot slate down to the
 * levels whose JSON actually ships, and keeps the Phaser-free unlock helpers the
 * Hub / PlayScene / Editor depend on.
 *
 * WHY FILTER: the slate declares all 28 chapter slots, but level CONTENT lands
 * incrementally (levels/<id>.json). The Hub grid, the continue-CTA, and the
 * clear→Next chain must only ever surface a level that can actually load, so the
 * grid is `CHAPTER1_MANIFEST ∩ (JSON that exists)`. Today that is the first 18
 * slots (L1-L15 + B1-B3); the same code renders all 28 the moment the remaining
 * JSON lands (I2b) — no edit here.
 *
 * The unlock chain is decoupled from display order via `unlockAfter` so a bonus
 * level never gates main progression: L5 unlocks from L4 (the numbered spine),
 * while B1 (placed after L4) also unlocks from L4.
 */

import {
  CHAPTER1_MANIFEST,
  CHAPTER1_TITLE,
  manifestForAuthored,
  type LevelManifestEntry,
} from '../../../scripts/levels/manifest';

/** A render tile === a manifest slot (id + presentation + unlock predecessor). */
export type LevelTile = LevelManifestEntry;

export { CHAPTER1_TITLE };
/** The full declared 28-slot slate (campaign order), independent of what ships. */
export { CHAPTER1_MANIFEST };

/**
 * Ids of levels whose JSON is bundled. `import.meta.glob` is resolved at build
 * time by Vite (and vitest), so this is a static set derived from the levels/
 * directory — it grows automatically as level JSON is authored.
 */
const AUTHORED_LEVEL_IDS: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob('/levels/*.json')).map((path) => {
    const stem = path.slice(path.lastIndexOf('/') + 1);
    return stem.replace(/\.json$/, '');
  }),
);

/**
 * The Chapter 1 tiles in display order — the declared slate filtered to the
 * levels that actually ship (18 today: 15 main + 3 bonus; auto-scales to 28).
 */
export const CHAPTER1_TILES: readonly LevelTile[] = manifestForAuthored(AUTHORED_LEVEL_IDS);

/** A tile is unlocked when its predecessor level is cleared (or it has none). */
export function isLevelUnlocked(tile: LevelTile, isCleared: (levelId: string) => boolean): boolean {
  return tile.unlockAfter === null || isCleared(tile.unlockAfter);
}

/**
 * The level to highlight (脈動) — the earliest unlocked-but-uncleared MAIN level
 * (bonus tiles are optional), or null when everything is cleared.
 */
export function findNextLevelId(
  tiles: readonly LevelTile[],
  isCleared: (levelId: string) => boolean,
): string | null {
  for (const tile of tiles) {
    if (!tile.isBonus && isLevelUnlocked(tile, isCleared) && !isCleared(tile.id)) {
      return tile.id;
    }
  }
  return null;
}

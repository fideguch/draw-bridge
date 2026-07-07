/**
 * levelCatalog.ts — the SC-002 tile catalog + sequential-unlock logic.
 *
 * Ch1 ships 15 main levels + 3 bonus levels placed after L5/L10/L15
 * (ui_design_brief §6.2, game_design §6/§7.4). Display order interleaves the
 * bonus tiles; the unlock chain is decoupled from display order via
 * `unlockAfter` so a bonus level never gates main progression: L6 unlocks from
 * L5 (not B1), while B1 unlocks from L5.
 *
 * PlayScene is a stub in this phase, so the catalog carries no level content —
 * only the ids + presentation. Phase 5 loads the matching level JSON.
 */

export interface LevelTile {
  readonly id: string;
  /** User-facing tile label (日本語 UI): '1'..'15' or 'B1'..'B3'. */
  readonly label: string;
  readonly isBonus: boolean;
  /** Level id that must be cleared to unlock this tile; null = always unlocked. */
  readonly unlockAfter: string | null;
}

export const CHAPTER1_TITLE = 'Chapter 1';
const MAIN_LEVEL_COUNT = 15;
const BONUS_INTERVAL = 5;

function mainId(index: number): string {
  return `ch1-l${String(index).padStart(2, '0')}`;
}

function buildChapter1Tiles(): readonly LevelTile[] {
  const tiles: LevelTile[] = [];
  let bonusIndex = 0;
  for (let level = 1; level <= MAIN_LEVEL_COUNT; level += 1) {
    tiles.push({
      id: mainId(level),
      label: String(level),
      isBonus: false,
      unlockAfter: level === 1 ? null : mainId(level - 1),
    });
    if (level % BONUS_INTERVAL === 0) {
      bonusIndex += 1;
      tiles.push({
        id: `ch1-b${bonusIndex}`,
        label: `B${bonusIndex}`,
        isBonus: true,
        unlockAfter: mainId(level),
      });
    }
  }
  return tiles;
}

/** The Chapter 1 tiles in display order (18 tiles: 15 main + 3 bonus). */
export const CHAPTER1_TILES: readonly LevelTile[] = buildChapter1Tiles();

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

import { describe, expect, it } from 'vitest';
import { formatCoins } from '@render/ui/format';
import {
  RESET_CONFIRM_WORD,
  appendConfirmChar,
  isConfirmComplete,
} from '@render/ui/resetConfirm';
import {
  CHAPTER1_TILES,
  findNextLevelId,
  isLevelUnlocked,
} from '@render/ui/levelCatalog';
import type { LevelTile } from '@render/ui/levelCatalog';

/**
 * Contract tests for the Phaser-free logic behind the meta screens (T069-T072).
 * These modules are deliberately Phaser-free so they run in the node vitest env
 * and lock in the rules the scenes depend on.
 */

describe('formatCoins (P1 consistent coin display)', () => {
  it('groups thousands and floors to an integer', () => {
    expect(formatCoins(0)).toBe('0');
    expect(formatCoins(1250)).toBe('1,250');
    expect(formatCoins(1500)).toBe('1,500');
    expect(formatCoins(1000000)).toBe('1,000,000');
  });
});

describe('reset type-to-confirm (FR-020, P5 friction)', () => {
  const target = RESET_CONFIRM_WORD;

  it('builds the exact string in order', () => {
    let seq = '';
    for (const char of ['リ', 'セ', 'ッ', 'ト']) {
      seq = appendConfirmChar(seq, char, target);
    }
    expect(seq).toBe('リセット');
    expect(isConfirmComplete(seq, target)).toBe(true);
  });

  it('resets the sequence on any out-of-order tap', () => {
    let seq = appendConfirmChar('', 'リ', target);
    expect(seq).toBe('リ');
    seq = appendConfirmChar(seq, 'ト', target); // wrong next char
    expect(seq).toBe('');
    expect(isConfirmComplete(seq, target)).toBe(false);
  });

  it('is incomplete for any prefix', () => {
    expect(isConfirmComplete('リセ', target)).toBe(false);
    expect(isConfirmComplete('', target)).toBe(false);
  });
});

describe('Chapter 1 catalog + sequential unlock (SC-002, FR-016)', () => {
  const cleared = (ids: readonly string[]): ((id: string) => boolean) => (id) => ids.includes(id);
  const tileById = (id: string): LevelTile => {
    const tile = CHAPTER1_TILES.find((candidate) => candidate.id === id);
    if (tile === undefined) {
      throw new Error(`missing tile ${id}`);
    }
    return tile;
  };

  // The catalog is the v5 28-slot slate (scripts/levels/manifest.ts §5) filtered
  // to the levels whose JSON currently ships (18: L1-L15 + B1-B3 = the first 18
  // slots). Bonuses sit AFTER L4/L7/L11 in that order (B4/B5 land with I2b).
  it('has 18 shipped tiles (15 main + 3 bonus) in v5 slate order (bonus after L4/L7/L11)', () => {
    expect(CHAPTER1_TILES).toHaveLength(18);
    expect(CHAPTER1_TILES.filter((tile) => tile.isBonus)).toHaveLength(3);
    expect(CHAPTER1_TILES.map((tile) => tile.id).slice(0, 7)).toEqual([
      'ch1-l01',
      'ch1-l02',
      'ch1-l03',
      'ch1-l04',
      'ch1-b1',
      'ch1-l05',
      'ch1-l06',
    ]);
  });

  it('unlocks only L1 on a fresh save', () => {
    const fresh = cleared([]);
    expect(isLevelUnlocked(tileById('ch1-l01'), fresh)).toBe(true);
    expect(isLevelUnlocked(tileById('ch1-l02'), fresh)).toBe(false);
    expect(isLevelUnlocked(tileById('ch1-b1'), fresh)).toBe(false);
  });

  it('unlocks bonus B1 and main L5 from clearing L4 (bonus does not gate progression)', () => {
    const afterL4 = cleared(['ch1-l01', 'ch1-l02', 'ch1-l03', 'ch1-l04']);
    // B1 is placed after L4 and unlocks WITH L4 (its preceding numbered level).
    expect(isLevelUnlocked(tileById('ch1-b1'), afterL4)).toBe(true);
    // L5 unlocks from L4 directly — the numbered spine skips over the bonus.
    expect(isLevelUnlocked(tileById('ch1-l05'), afterL4)).toBe(true);
  });

  it('finds the earliest unlocked, uncleared main level to highlight', () => {
    expect(findNextLevelId(CHAPTER1_TILES, cleared([]))).toBe('ch1-l01');
    expect(findNextLevelId(CHAPTER1_TILES, cleared(['ch1-l01', 'ch1-l02']))).toBe('ch1-l03');
  });
});

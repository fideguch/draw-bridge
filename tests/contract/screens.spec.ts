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

  // The catalog is the v5 28-slot slate (scripts/levels/manifest.ts §5) filtered to the
  // levels whose JSON currently ships. WAVE 2 (hazard-free) ships 7 tiles: L1-L3 + B1-B4
  // (the hazard-free subset). The bonuses sit at their sawtooth valleys, so the shipped set
  // is a SUBSET of the slate, not a contiguous prefix; manifestForAuthored keeps it in
  // campaign order. The hazard waves (l04-l15, l16-l23, b5) land later.
  it('has 7 shipped tiles (3 main + 4 bonus) in v5 slate campaign order', () => {
    expect(CHAPTER1_TILES).toHaveLength(7);
    expect(CHAPTER1_TILES.filter((tile) => tile.isBonus)).toHaveLength(4);
    expect(CHAPTER1_TILES.map((tile) => tile.id)).toEqual([
      'ch1-l01',
      'ch1-l02',
      'ch1-l03',
      'ch1-b1',
      'ch1-b2',
      'ch1-b3',
      'ch1-b4',
    ]);
  });

  it('unlocks only L1 on a fresh save', () => {
    const fresh = cleared([]);
    expect(isLevelUnlocked(tileById('ch1-l01'), fresh)).toBe(true);
    expect(isLevelUnlocked(tileById('ch1-l02'), fresh)).toBe(false);
    expect(isLevelUnlocked(tileById('ch1-b1'), fresh)).toBe(false);
  });

  it('a bonus unlocks WITH its preceding numbered level (unlock predicate, not shipped-gated)', () => {
    // B1 sits after L4 and unlocks WITH L4 (game_plan_v5 §5.1). In WAVE 2 the numbered
    // predecessors (L4/L7/L11/L15) are not yet shipped, but the unlock predicate is the
    // same; the campaign reaches the shipped bonuses via the clear→Next chain
    // (PlayScene.nextLevelId, unconditional), so an unshipped predecessor never blocks it.
    expect(tileById('ch1-b1').unlockAfter).toBe('ch1-l04');
    expect(isLevelUnlocked(tileById('ch1-b1'), cleared(['ch1-l04']))).toBe(true);
    expect(isLevelUnlocked(tileById('ch1-b1'), cleared([]))).toBe(false);
  });

  it('finds the earliest unlocked, uncleared main level to highlight', () => {
    expect(findNextLevelId(CHAPTER1_TILES, cleared([]))).toBe('ch1-l01');
    expect(findNextLevelId(CHAPTER1_TILES, cleared(['ch1-l01', 'ch1-l02']))).toBe('ch1-l03');
  });
});

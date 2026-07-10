import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHAPTER1_MANIFEST,
  CHAPTER1_MANIFEST_IDS,
  CHAPTER1_NUMBERED_COUNT,
  bonusLevelId,
  isManifestLevel,
  manifestForAuthored,
  manifestOrderIndex,
  numberedLevelId,
} from '../../scripts/levels/manifest';

/**
 * Locks the ONE Chapter-1 slate (game_plan_v5 §5 — 28 slots: 23 numbered +
 * 5 bonus) that the Hub grid, unlock chain, campaign E2E, atlas, and authoring
 * all derive from. If any of those goes out of sync, it is this data that moved.
 */
describe('Chapter 1 level manifest (game_plan_v5 §5 — 28-slot slate)', () => {
  it('declares 28 slots: 23 numbered (L1-L23) + 5 bonus (B1-B5)', () => {
    expect(CHAPTER1_NUMBERED_COUNT).toBe(23);
    expect(CHAPTER1_MANIFEST).toHaveLength(28);
    expect(CHAPTER1_MANIFEST.filter((e) => e.isBonus)).toHaveLength(5);
    expect(CHAPTER1_MANIFEST.filter((e) => !e.isBonus)).toHaveLength(23);
  });

  it('interleaves bonuses AFTER L4/L7/L11/L15/L23 in campaign order', () => {
    // The full 28-slot campaign order (§5.2 table / §5.3 sawtooth).
    expect(CHAPTER1_MANIFEST_IDS).toEqual([
      'ch1-l01', 'ch1-l02', 'ch1-l03', 'ch1-l04', 'ch1-b1',
      'ch1-l05', 'ch1-l06', 'ch1-l07', 'ch1-b2',
      'ch1-l08', 'ch1-l09', 'ch1-l10', 'ch1-l11', 'ch1-b3',
      'ch1-l12', 'ch1-l13', 'ch1-l14', 'ch1-l15', 'ch1-b4',
      'ch1-l16', 'ch1-l17', 'ch1-l18', 'ch1-l19', 'ch1-l20', 'ch1-l21', 'ch1-l22', 'ch1-l23',
      'ch1-b5',
    ]);
  });

  it('labels numbered tiles 1-23 and bonus tiles B1-B5', () => {
    const numbered = CHAPTER1_MANIFEST.filter((e) => !e.isBonus).map((e) => e.label);
    expect(numbered).toEqual(Array.from({ length: 23 }, (_v, i) => String(i + 1)));
    const bonus = CHAPTER1_MANIFEST.filter((e) => e.isBonus).map((e) => e.label);
    expect(bonus).toEqual(['B1', 'B2', 'B3', 'B4', 'B5']);
  });

  it('unlocks the numbered spine strictly sequentially (L1 open, LN after L(N-1))', () => {
    for (let level = 1; level <= CHAPTER1_NUMBERED_COUNT; level += 1) {
      const entry = CHAPTER1_MANIFEST.find((e) => e.id === numberedLevelId(level));
      expect(entry, `${numberedLevelId(level)} present`).toBeDefined();
      expect(entry?.unlockAfter).toBe(level === 1 ? null : numberedLevelId(level - 1));
    }
  });

  it('unlocks each bonus WITH its preceding numbered level (never gates the spine)', () => {
    const bonusPredecessor: Record<string, string> = {
      'ch1-b1': 'ch1-l04',
      'ch1-b2': 'ch1-l07',
      'ch1-b3': 'ch1-l11',
      'ch1-b4': 'ch1-l15',
      'ch1-b5': 'ch1-l23',
    };
    for (const [bonus, predecessor] of Object.entries(bonusPredecessor)) {
      const entry = CHAPTER1_MANIFEST.find((e) => e.id === bonus);
      expect(entry?.isBonus).toBe(true);
      expect(entry?.unlockAfter).toBe(predecessor);
    }
    for (let index = 1; index <= 5; index += 1) {
      expect(bonusLevelId(index)).toBe(`ch1-b${index}`);
    }
  });

  it('has unique ids and consistent lookup helpers', () => {
    expect(new Set(CHAPTER1_MANIFEST_IDS).size).toBe(CHAPTER1_MANIFEST.length);
    expect(manifestOrderIndex('ch1-l01')).toBe(0);
    expect(manifestOrderIndex('ch1-b1')).toBe(4);
    expect(manifestOrderIndex('ch1-l05')).toBe(5);
    expect(manifestOrderIndex('nope')).toBe(-1);
    expect(isManifestLevel('ch1-l23')).toBe(true);
    expect(isManifestLevel('ch1-l24')).toBe(false);
  });

  it('filters to authored ids preserving campaign order', () => {
    const authored = new Set(['ch1-l05', 'ch1-l01', 'ch1-b1']);
    expect(manifestForAuthored(authored).map((e) => e.id)).toEqual(['ch1-l01', 'ch1-b1', 'ch1-l05']);
  });

  // The "pure refactor today" invariant: every shipped level JSON is a declared
  // slot, and the shipped set is exactly the first N slots of the slate (a
  // contiguous prefix). This is what keeps the Hub/campaign green while the tail
  // slots wait for their content (I2b).
  it('every shipped level JSON is a slate slot forming a contiguous prefix', () => {
    const shippedIds = readdirSync(join(process.cwd(), 'levels'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''));

    for (const id of shippedIds) {
      expect(isManifestLevel(id), `${id} must be declared in the slate`).toBe(true);
    }

    const shippedInOrder = CHAPTER1_MANIFEST_IDS.filter((id) => shippedIds.includes(id));
    const prefix = CHAPTER1_MANIFEST_IDS.slice(0, shippedInOrder.length);
    expect(shippedInOrder, 'shipped levels are the leading slots of the slate').toEqual(prefix);
  });
});

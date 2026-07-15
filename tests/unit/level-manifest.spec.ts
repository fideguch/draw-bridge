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
 * Locks the ONE Chapter-1 slate (round-9 designs/levels_round9.md — 45 slots:
 * 40 numbered + 5 bonus) that the Hub grid, unlock chain, campaign E2E, and
 * authoring all derive from. If any of those goes out of sync, it is this data
 * that moved. (Level CONTENT ships incrementally; the slate is the full target —
 * consumers filter it to the ids whose JSON exists.)
 */
describe('Chapter 1 level manifest (round-9 — 45-slot slate)', () => {
  it('declares 45 slots: 40 numbered (L1-L40) + 5 bonus (B1-B5)', () => {
    expect(CHAPTER1_NUMBERED_COUNT).toBe(40);
    expect(CHAPTER1_MANIFEST).toHaveLength(45);
    expect(CHAPTER1_MANIFEST.filter((e) => e.isBonus)).toHaveLength(5);
    expect(CHAPTER1_MANIFEST.filter((e) => !e.isBonus)).toHaveLength(40);
  });

  it('interleaves bonuses AFTER L4/L7/L11/L15/L23, then trails l24-l40', () => {
    // Bonus insertion points are UNCHANGED so all five stay reachable with the
    // shipped 23 numbered levels; l24-l40 are declared trailing slots (CS-4b/4c).
    const trailing = Array.from({ length: 17 }, (_v, i) => `ch1-l${String(i + 24).padStart(2, '0')}`);
    expect(CHAPTER1_MANIFEST_IDS).toEqual([
      'ch1-l01', 'ch1-l02', 'ch1-l03', 'ch1-l04', 'ch1-b1',
      'ch1-l05', 'ch1-l06', 'ch1-l07', 'ch1-b2',
      'ch1-l08', 'ch1-l09', 'ch1-l10', 'ch1-l11', 'ch1-b3',
      'ch1-l12', 'ch1-l13', 'ch1-l14', 'ch1-l15', 'ch1-b4',
      'ch1-l16', 'ch1-l17', 'ch1-l18', 'ch1-l19', 'ch1-l20', 'ch1-l21', 'ch1-l22', 'ch1-l23',
      'ch1-b5',
      ...trailing,
    ]);
  });

  it('labels numbered tiles 1-40 and bonus tiles B1-B5', () => {
    const numbered = CHAPTER1_MANIFEST.filter((e) => !e.isBonus).map((e) => e.label);
    expect(numbered).toEqual(Array.from({ length: 40 }, (_v, i) => String(i + 1)));
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
    expect(isManifestLevel('ch1-l40')).toBe(true);
    expect(isManifestLevel('ch1-l41')).toBe(false);
  });

  it('filters to authored ids preserving campaign order', () => {
    const authored = new Set(['ch1-l05', 'ch1-l01', 'ch1-b1']);
    expect(manifestForAuthored(authored).map((e) => e.id)).toEqual(['ch1-l01', 'ch1-b1', 'ch1-l05']);
  });

  // WAVE-BASED invariant (round-7 I2, hazard-free wave 2): every shipped level JSON is a
  // declared slot, and manifestForAuthored orders the shipped set by campaign order. The
  // shipped set is a SUBSET of the slate, NOT necessarily a contiguous prefix — the
  // hazard-free wave ships l01-l03 + b1-b4 (the bonuses sit at their sawtooth valleys), so
  // there are gaps (l04-l15) waiting for the hazard waves. The clear→Next chain walks the
  // authored tiles in display order unconditionally, so a gap never blocks progression.
  it('every shipped level JSON is a declared slate slot, ordered by campaign order', () => {
    const shippedIds = readdirSync(join(process.cwd(), 'levels'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''));
    expect(shippedIds.length).toBeGreaterThan(0);

    for (const id of shippedIds) {
      expect(isManifestLevel(id), `${id} must be declared in the slate`).toBe(true);
    }

    // manifestForAuthored yields exactly the shipped ids, in campaign (slate) order.
    const authoredInOrder = manifestForAuthored(new Set(shippedIds)).map((e) => e.id);
    expect(new Set(authoredInOrder)).toEqual(new Set(shippedIds));
    expect(authoredInOrder, 'authored tiles are a subsequence of the slate order').toEqual(
      CHAPTER1_MANIFEST_IDS.filter((id) => shippedIds.includes(id)),
    );
  });
});

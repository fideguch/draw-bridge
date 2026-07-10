/**
 * manifest.ts — the ONE ordered Chapter-1 level slate (round-7 I2a).
 *
 * Single source of truth for level ORDER, display labels, bonus flags, and the
 * unlock chain. Consumed by the Hub grid + PlayScene Next chain
 * (src/render/ui/levelCatalog.ts), the campaign E2E (tests/e2e/campaign.spec.ts),
 * the route atlas (scripts/atlas/atlas.ts), and the authoring pipeline
 * (scripts/levels/authoring.ts). Before this module the order lived in three
 * unsynchronised places (levelCatalog interval math, campaign LEVEL_ORDER array,
 * atlas CH1_SOURCES declaration order); they are now all DERIVED from here.
 *
 * SLATE (designs/game_plan_v5.md §5 — F4 28面スレート): 23 numbered levels
 * (L1-L23) + 5 bonus levels (B1-B5). Bonuses sit at the sawtooth "valleys",
 * inserted AFTER a numbered level: L4→B1 / L7→B2 / L11→B3 / L15→B4 / L23→B5
 * (§5.1). Campaign order therefore interleaves them:
 *   l01 l02 l03 l04 B1 l05 l06 l07 B2 l08 l09 l10 l11 B3 l12 l13 l14 l15 B4
 *   l16 l17 l18 l19 l20 l21 l22 l23 B5   (28 slots)
 *
 * UNLOCK CHAIN (game_plan_v5 §5.1 / SC-002): the NUMBERED spine is strictly
 * sequential — level N unlocks when N-1 is cleared — and each bonus unlocks with
 * (i.e. right after) its preceding numbered level, so a bonus never gates main
 * progression (a skipped bonus does not block the spine).
 *
 * 28-SLOT READY, not 28 levels YET: this slate declares all 28 slots, but the
 * level CONTENT (levels/<id>.json + scripts/levels/ch1.ts sources) is authored
 * incrementally. Consumers that render/play real levels filter this slate down to
 * the ids whose JSON exists, so today's shipped set (18: L1-L15 + B1-B3, which is
 * exactly the first 18 slots of this order) stays green while the same code
 * auto-scales to 28 the moment the remaining JSON lands (I2b) — no code change.
 *
 * Pure data: this module imports nothing (no fs, no glob, no Phaser) so every
 * environment (browser via Vite, Node via vite-node, vitest, Playwright) can
 * consume it identically.
 */

/** Total numbered levels in the Chapter-1 slate (L1-L23). */
export const CHAPTER1_NUMBERED_COUNT = 23;

/**
 * Bonus insertion points: `numberedLevel → bonusIndex`. A bonus tile is placed
 * in campaign order immediately AFTER the numbered level keyed here (§5.1).
 */
const BONUS_AFTER_LEVEL: Readonly<Record<number, number>> = {
  4: 1,
  7: 2,
  11: 3,
  15: 4,
  23: 5,
};

/** Human-facing chapter title (Hub header). */
export const CHAPTER1_TITLE = 'Chapter 1';

/** One slot in the ordered chapter slate. Array index === campaign order. */
export interface LevelManifestEntry {
  /** Level id === levels/<id>.json filename stem (e.g. 'ch1-l01', 'ch1-b1'). */
  readonly id: string;
  /** User-facing tile label: '1'..'23' for numbered, 'B1'..'B5' for bonus. */
  readonly label: string;
  /** True for the 5 bonus levels (optional, never gate the numbered spine). */
  readonly isBonus: boolean;
  /** Level id that must be cleared to unlock this slot; null = always open (L1). */
  readonly unlockAfter: string | null;
}

/** `ch1-l01`.. id for a numbered level. */
export function numberedLevelId(level: number): string {
  return `ch1-l${String(level).padStart(2, '0')}`;
}

/** `ch1-b1`.. id for a bonus level. */
export function bonusLevelId(bonusIndex: number): string {
  return `ch1-b${bonusIndex}`;
}

/** Build the 28-slot ordered slate from the numbered spine + bonus insertions. */
function buildChapter1Manifest(): readonly LevelManifestEntry[] {
  const entries: LevelManifestEntry[] = [];
  for (let level = 1; level <= CHAPTER1_NUMBERED_COUNT; level += 1) {
    entries.push({
      id: numberedLevelId(level),
      label: String(level),
      isBonus: false,
      unlockAfter: level === 1 ? null : numberedLevelId(level - 1),
    });
    const bonusIndex = BONUS_AFTER_LEVEL[level];
    if (bonusIndex !== undefined) {
      entries.push({
        id: bonusLevelId(bonusIndex),
        label: `B${bonusIndex}`,
        isBonus: true,
        unlockAfter: numberedLevelId(level),
      });
    }
  }
  return entries;
}

/** The full Chapter-1 slate in campaign order (28 slots: 23 numbered + 5 bonus). */
export const CHAPTER1_MANIFEST: readonly LevelManifestEntry[] = buildChapter1Manifest();

/** Every level id in the slate, in campaign order. */
export const CHAPTER1_MANIFEST_IDS: readonly string[] = CHAPTER1_MANIFEST.map((entry) => entry.id);

/** Campaign-order index of a level id, or -1 when it is not in the slate. */
export function manifestOrderIndex(levelId: string): number {
  return CHAPTER1_MANIFEST.findIndex((entry) => entry.id === levelId);
}

/** True when a level id is part of the declared slate. */
export function isManifestLevel(levelId: string): boolean {
  return manifestOrderIndex(levelId) !== -1;
}

/**
 * The slate filtered to the ids that are actually authored, preserving campaign
 * order. `authoredIds` is whatever set a consumer can observe in its environment
 * (browser: `import.meta.glob` keys; Node: the levels/ directory listing).
 */
export function manifestForAuthored(authoredIds: ReadonlySet<string>): readonly LevelManifestEntry[] {
  return CHAPTER1_MANIFEST.filter((entry) => authoredIds.has(entry.id));
}

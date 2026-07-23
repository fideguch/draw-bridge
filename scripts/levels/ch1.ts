/**
 * Chapter 1 declarative level sources.
 *
 * ROUND-9 (CS-4a/4b/4c): the numbered levels ch1-l01 .. ch1-l40 were authored as
 * schemaVersion 2 in dedicated modules (ch1-levels-01-12 / -13-28 / -29-40, all
 * spread into CH1_SOURCES below). THIS FILE now holds only the 5 bonus SOURCES
 * (b1-b5) — regenerated as schemaVersion 2 in CS-4c, so ZERO v1 levels remain in
 * the slate. (Ghost SAMPLES drift sub-mm when the RECORD sequence changes — a
 * consequence of the shared recycled-world replay — but the geometry is unchanged
 * and every gate stays green.)
 *
 * Pure DATA consumed by scripts/levels/authoring.ts, which runs each candidate
 * stroke through the real engine at Lv0, derives the ink economy, records ghosts,
 * auto-places coins on the driven CAR route, and emits levels/<id>.json. Rerun
 * authoring after a TuningConstants change (no --only, so Gate-2 order is stable).
 *
 * REALIZATION RULES (measured): UP-BOW spans as a slight arch (a drawn flat/scoop
 * collapses); SPLIT long climbs/descents over a terrain MID-LEDGE (a single wide
 * gap over-runs the ≤5.5 m unsupported-span limit); keep ridden spans short /
 * firmly bowed / terrain-backed so the car-path displacement stays ≤0.3 m.
 *
 * Coordinates: world meters, y-up. Terrain authored left→right (top solid).
 */

import type { DangerZone, GimmickTag, ObjectiveType, Point, Polyline, Rect, Rock, ShapeTag } from '../../src/engine/level/LevelSchema';
import {
  arch,
  coinArc,
  flag,
  p,
  pillar,
  spline,
  twoPlatforms,
  type Gap,
} from './patterns';
// ROUND-9 CS-4a: levels ch1-l01..ch1-l12 are authored as schemaVersion 2 in a
// dedicated module (keeps this file's v1 legacy blocks untouched + under the size
// cap). They are spread into CH1_SOURCES below. type-only import of LevelSource
// there breaks the runtime cycle.
import { CH1_V2_SOURCES } from './ch1-levels-01-12';
// ROUND-9 CS-4b: levels ch1-l13..ch1-l28 are authored as schemaVersion 2 in a
// dedicated module (l13-l23 REPLACE the round-8 v1 legacy blocks removed below;
// l24-l28 are NEW). Spread into CH1_SOURCES.
import { CH1_V2_SOURCES_13_28 } from './ch1-levels-13-28';
// ROUND-9 CS-4c: levels ch1-l29..ch1-l40 (the finale wave) are authored as
// schemaVersion 2 in a dedicated module. Spread into CH1_SOURCES.
import { CH1_V2_SOURCES_29_40 } from './ch1-levels-29-40';

/** Convert an explicit list of Points into a terrain Polyline ([x, y] pairs). */
function pl(...pts: readonly Point[]): [number, number][] {
  return pts.map((q) => [q.x, q.y]);
}

export interface StrokeSource {
  /** 'any' = recorded clear (rating free); '3star' = Gate 2 asserts 3 stars. */
  readonly kind: 'any' | '3star';
  /** Human label for the authoring report + failure messages. */
  readonly role: string;
  /** Raw stroke (world m). RDP-simplified at commit; the simplified form persists. */
  readonly points: readonly Point[];
}

/**
 * A DECLARED alternative solution (round-8, level JSON `solutions[]`). Unlike
 * StrokeSource it is NOT recorded by authoring — the raw points pass through to
 * the JSON verbatim and Gate 8 (multi-solution) PLAYS them live through the
 * player commit path, requiring a Lv0 clear + >= 2 distinct shapeTags per level.
 */
export interface SolutionSource {
  /** Shape family (LevelSchema SHAPE_TAGS vocabulary). */
  readonly shapeTag: ShapeTag;
  /** Raw solution stroke (world m). */
  readonly points: readonly Point[];
}

export interface LevelSource {
  readonly id: string;
  readonly design: string;
  /**
   * Schema version to EMIT (round-9 CS-4). Default 1 (round-8 legacy levels). v2
   * levels carry `objective` + `persons`, allow only 'zone' danger styles, and use
   * objective-based stars (star3 = ghost ink x ~1.35). Set to 2 for l01-l12.
   */
  readonly schemaVersion?: 1 | 2;
  /** ★2 objective (round-9 v2, BR-014). Absent ⇒ 'coins'. Emitted only on v2 levels. */
  readonly objective?: { readonly type: ObjectiveType };
  /**
   * Person NPC obstacle CENTRES (round-9 v2, BR-011). AABB dims from
   * TuningConstants (≈1.3×1.7 m); to stand on ground y0, author y = y0 +
   * person.halfHeight. Emitted only on v2 levels; the CAR touching one fails.
   */
  readonly persons?: readonly Point[];
  /** Drives inkBudget = feelFactor x tight-reference ink (research/11 §3.2). */
  readonly inkFeel: 'generous' | 'standard' | 'tight';
  readonly terrain: readonly Polyline[];
  readonly vehicleSpawn: Point;
  readonly goalFlag: Rect;
  readonly killY: number;
  readonly coins: readonly Point[];
  readonly gimmickTags: readonly GimmickTag[];
  readonly strokes: readonly StrokeSource[];
  readonly maxTicks?: number;
  readonly bonusMultiplier?: number;
  /** Explicit budget override — the >=1.8x "geometry can't fail a straight" hatch. */
  readonly inkBudget?: number;
  /** Explicit thresholds override. */
  readonly starThresholds?: { readonly star2: number; readonly star3: number };
  /** Rolling/falling rock hazards (level JSON `rocks[]`; absent == none). */
  readonly rocks?: readonly Rock[];
  /**
   * DangerZone hazard bands (level JSON `dangerZones[]`; absent == none). The CAR
   * overlapping a zone fails 'hazardContact'; the drawn line passes through. None of
   * WAVE 2's hazard-free levels use these — kept on the interface for later waves.
   */
  readonly dangerZones?: readonly DangerZone[];
  /**
   * Declared alternative solutions (round-8, level JSON `solutions[]`; absent ==
   * none). Passed through VERBATIM by authoring; Gate 8 verifies each clears and
   * that >= 2 distinct shapeTags exist (tutorial allowlist relaxed to 1).
   */
  readonly solutions?: readonly SolutionSource[];
}

/** N placeholder coins (authoring re-places them ON the driven route; only the COUNT persists). */
function coinCount(n: number): Point[] {
  return coinArc(0, 1.2, n, 0.5, 0.3);
}

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND-9 v2 (CS-4a): ch1-l01 .. ch1-l12 — see ./ch1-levels-01-12.ts.
  ...CH1_V2_SOURCES,
  // ROUND-9 v2 (CS-4b): ch1-l13 .. ch1-l28 — see ./ch1-levels-13-28.ts.
  ...CH1_V2_SOURCES_13_28,
  // ROUND-9 v2 (CS-4c): ch1-l29 .. ch1-l40 (finale wave) — see ./ch1-levels-29-40.ts.
  ...CH1_V2_SOURCES_29_40,

  // ═══════════════════════════════════════════════════════════════════════════
  // BONUS SLATE (CS-4c) — b1-b5 regenerated as schemaVersion 2. NO v1 levels remain.
  // ─────────────────────────────────────────────────────────────────────────────
  // B1 (v5 slate, after L4) — bonus multi-seal / tier / S. atlas card 5 (階段のコイン).
  // A raised central ISLAND the zigzag runs up-over-down; coin bonanza breather. The
  // island is a pillar (top solid); rim-to-rim gap is ≤4.6 m (a raised island reads as
  // "unsupported" to the span gate, so the rims bracket a ≤5.5 m run). Non-AD (息抜き).
  {
    id: 'ch1-b1',
    design: 'multi-seal/tier/S: 中央の高い島を越える段違いジグザグ床・コイン祭 — v5 #B1 (R08-lite Draw Line Bridge)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    bonusMultiplier: 6,
    terrain: [
      pl(p(-7, 0.4), p(-2.2, 0.4), p(-2.0, -4.2)),
      pillar(0.1, 1.5, -4.2, 0.6, 1.1), // raised central island
      pl(p(2.2, -4.2), p(2.4, 0.2), p(7.5, 0.2)),
    ],
    vehicleSpawn: p(-5.0, 0.75),
    goalFlag: flag(5.2, 0.2, 1, 2),
    killY: -4.5,
    coins: coinCount(10),
    gimmickTags: [],
    strokes: [
      {
        kind: 'any',
        role: 'tier-zigzag',
        points: spline([p(-2.8, 0.42), p(-1.3, 1.0), p(-0.5, 1.5), p(0.7, 1.5), p(1.6, 0.85), p(3.0, 0.22)]),
      },
    ],
    // round-8 W5: DECLARE the two ridge-tracing shapes the card promises (Gate 8).
    // The island top (1.5) already clips every lazy chord (Gate 7 passes); this
    // proves plurality: an up-over-down ANGLE that rakes the ridge coins, or a big
    // ARCH that leaps the whole island (bow 1.45 clears, low-speed breather).
    solutions: [
      { shapeTag: 'angle', points: spline([p(-2.8, 0.42), p(-1.3, 1.0), p(-0.5, 1.5), p(0.7, 1.5), p(1.6, 0.9), p(2.9, 0.22)]) },
      { shapeTag: 'arch', points: arch(-2.8, 0.42, 2.8, 0.22, 1.3) },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B2 (v5 slate, after L7) — bonus hook / S / S. atlas card 9 (くねり道).
  // A gentle S hooked over a central low PEG island; coin arc breather. rim-to-rim
  // ≤5.2 m (≤5.5), the peg physically supports the S dip. Non-AD (息抜き).
  {
    id: 'ch1-b2',
    design: 'hook/S/S: 中央ペグに引っ掛ける緩S字・コイン弧 — v5 #B2 (R09-lite Happy Glass 支柱)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: [
      pl(p(-7, 0.6), p(-2.6, 0.6), p(-2.4, -4.4)),
      pillar(0, 1.4, -4.4, 0.45, 0.9), // round-8 W5: PEG raised to head 1.4 (flat-top crown, not a 細針). With the 0.55 m surface-skin the peg must sit >0.55 m above the spawn-goal chord (y0.80) to CLIP it — 1.4 clears it by 0.60 m at commit. The hook rests on its head (within skin), the arch leaps it.
      pl(p(2.4, -4.4), p(2.6, 0.9), p(7.5, 0.9)),
    ],
    vehicleSpawn: p(-5.2, 0.95),
    goalFlag: flag(5.2, 0.9, 1, 2),
    killY: -4.7,
    coins: coinCount(6),
    gimmickTags: [],
    strokes: [
      {
        kind: 'any',
        role: 'hook-over-peg',
        points: spline([p(-3.2, 0.62), p(-1.7, 1.0), p(-0.6, 1.48), p(0.4, 1.48), p(1.5, 1.05), p(3.2, 0.92)]),
      },
    ],
    // round-8 W5: hook (rest on the peg head) vs arch (leap the peg) — Gate 8.
    solutions: [
      { shapeTag: 'hook', points: spline([p(-3.2, 0.62), p(-1.7, 1.0), p(-0.6, 1.48), p(0.4, 1.48), p(1.5, 1.05), p(3.2, 0.92)]) },
      { shapeTag: 'arch', points: arch(-3.2, 0.62, 3.2, 0.92, 1.2) },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B3 (v5 slate, after L11) — bonus catch / U / S. atlas card 14 (受け皿のコイン).
  // A wide, gentle receiving DISH the car rides across a shallow valley; coin-collect
  // breather, NO hazard (v5 slate makes B3 hazard-free). REALIZATION: an up-bow scoop
  // over a gap (the proven L1 road pattern) settles into the design's dish; the car
  // eases in and out (a drawn steep-walled bowl traps the car's front wheel). Non-AD.
  {
    id: 'ch1-b3',
    design: 'catch/U/S: 浅い受け皿をなぞる緩U字の橋・コイン集め — v5 #B3 (R12-lite Happy Glass funnel)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: [
      ...twoPlatforms({ leftFar: -7, leftRim: -2.6, leftY: 0.9, rightRim: 2.6, rightY: 0.9, rightFar: 7.5, chasmY: -4.4 }),
      pillar(0, 1.55, -4.4, 0.5, 1.0), // round-8 W5: central REEF (flat-top crown, top 1.55) — clips ALL six lazy chords (max sgHigh 1.46) at COMMIT across a 1.0 m flat top; the dish-arch / trapezoid-deck pass OVER it
    ],
    vehicleSpawn: p(-4.9, 1.25),
    goalFlag: flag(5.0, 0.9, 1, 2),
    killY: -5,
    coins: coinCount(7),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'catch-dish', points: arch(-3.3, 0.9, 3.3, 0.9, 0.8) }],
    // round-8 W5: receiving-dish arch (rake the coin bow) vs flat deck — Gate 8.
    solutions: [
      { shapeTag: 'arch', points: arch(-3.3, 0.9, 3.3, 0.9, 0.8) },
      { shapeTag: 'trapezoid', points: [p(-3.3, 0.9), ...spline([p(-2.6, 0.98), p(-1.3, 1.68), p(-0.7, 1.72), p(0.7, 1.72), p(1.3, 1.68), p(2.6, 0.98)]), p(3.3, 0.9)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B4 (v5 slate, after L15) — bonus road / descent / L. atlas card 19 (くだり街道).
  // High shelf → low goal, coin runner breather. REALIZATION: a single steep descent
  // both over-runs the span limit and reads as one long unsupported run (the flat
  // shelves diverge from the steep spawn→goal reference), so the descent is TWO ramps
  // over a terrain MID-LEDGE that splits the run and re-seats the car. Non-AD (息抜き).
  {
    id: 'ch1-b4',
    design: 'road/descent/L: 中棚を挟む二段の緩降下で高所から低ゴールへ・コイン流し取り — v5 #B4 (A12 Draw Climber 降下)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    bonusMultiplier: 5,
    terrain: [
      pl(p(-7.5, 2.6), p(-2.4, 2.6), p(-2.2, -5)),
      pl(p(1.5, -5), p(1.7, 1.0), p(3.1, 1.0), p(3.3, -5)), // round-8 W5: mid-ledge raised to a HILL (top 1.0) — the naive spawn→goal descent CLIPS the hill at commit and the un-supported right half drops into the pit; the two-stage ramp/angle ride the hill top
      pl(p(4.6, -5), p(4.8, -0.4), p(5.8, -0.4), p(6.0, -5)), // round-8 W5: second descent LEDGE — splits the long descent so the ridden shove stays <=0.3 m (Gate 6 F5); keeps the card's "二段の緩降下"
      pl(p(7.0, -5), p(7.2, -1.4), p(10, -1.4)),
    ],
    vehicleSpawn: p(-4.0, 2.95),
    goalFlag: flag(7.8, -1.4, 1, 2),
    killY: -5.4,
    coins: coinCount(7),
    gimmickTags: [],
    strokes: [
      {
        kind: 'any',
        role: 'two-span-descent',
        points: spline([p(-2.4, 2.6), p(-0.5, 1.7), p(1.7, 1.0), p(3.1, 1.0), p(4.8, -0.4), p(5.8, -0.4), p(7.8, -1.4)]),
      },
    ],
    // round-8 W5: gentle two-stage ramp vs angular two-stage — both rest on the hill + ledge (Gate 8).
    solutions: [
      { shapeTag: 'ramp', points: spline([p(-2.4, 2.6), p(-0.5, 1.7), p(1.7, 1.0), p(3.1, 1.0), p(4.8, -0.4), p(5.8, -0.4), p(7.8, -1.4)]) },
      { shapeTag: 'angle', points: spline([p(-2.4, 2.6), p(0.4, 1.05), p(1.7, 1.0), p(3.1, 1.0), p(4.8, -0.4), p(5.8, -0.4), p(7.8, -1.4)]) },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B5 (v5 slate, after L23) — bonus STEPPING PILLARS / M. REDESIGNED (CS-4c,
  // designs/levels_round9.md bonus slate): the old "spike-tip stepping stones" is
  // reborn as FLAT-TOP stepping pillars (NO spike shapes — the design doc mandate).
  // Three flat-crowned pillars stand in a deep valley; the drawn line steps down
  // onto their tops and back up to the far bank, raking a coin payout across the
  // hops. Breather (generous ink), no hazard — a pure precision-free reward beat.
  {
    id: 'ch1-b5',
    design: 'stepping-pillars/M: 深い谷に立つ三つの平頭ピラーの上を線でステップして渡りコインを流し取る（棘なし・平頭の飛び石に刷新）— v5 #B5 REDESIGNED (designs/levels_round9 bonus slate)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    bonusMultiplier: 5,
    gimmickTags: [],
    terrain: [
      pl(p(-9.0, 0.8), p(-2.8, 0.8), p(-3.0, -5.7)), // left bank y0.8
      pillar(-1.5, 0.1, -5.7, 0.5, 0.9), // stepping pillar 1 (flat top +0.1)
      pillar(0, 0.1, -5.7, 0.5, 0.9), // stepping pillar 2 (flat top +0.1)
      pillar(1.5, 0.1, -5.7, 0.5, 0.9), // stepping pillar 3 (flat top +0.1)
      pl(p(3.0, -5.7), p(2.8, 0.8), p(9.0, 0.8)), // right bank y0.8
    ],
    vehicleSpawn: p(-6.0, 1.15),
    goalFlag: flag(5.8, 0.8, 1, 2),
    killY: -5.7,
    coins: coinCount(8),
    strokes: [
      {
        kind: 'any',
        role: 'step-across-pillars',
        points: spline([p(-3.3, 0.82), p(-2.2, 0.2), p(-1.5, 0.12), p(0, 0.12), p(1.5, 0.12), p(2.2, 0.2), p(3.3, 0.82)]),
      },
    ],
    // Plurality (advisory, Gate 8): step across the pillar tops (angle) vs a broad
    // dome that leaps the whole pillar row (arch).
    solutions: [
      { shapeTag: 'angle', points: spline([p(-3.3, 0.82), p(-2.2, 0.2), p(-1.5, 0.12), p(0, 0.12), p(1.5, 0.12), p(2.2, 0.2), p(3.3, 0.82)]) },
      { shapeTag: 'arch', points: arch(-3.3, 0.82, 3.3, 0.82, 0.9) },
    ],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

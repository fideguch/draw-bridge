/**
 * Chapter 1 declarative level sources — ATLAS-FIRST DESIGN v5, WAVE 2 (hazard-free).
 *
 * The design is FROZEN: designs/atlas-design-v5.html (`LEVELS[]`) + designs/game_plan_v5.md
 * are the master. THIS FILE ships the HAZARD-FREE subset of the v5 slate — the levels
 * that clear WITHOUT any rock / spike / DangerZone (round-7 F1 made hazard CONTACT an
 * instant loss, so the 14 rock levels + 7 spike/zone levels land in a later wave). The
 * 7 shipped ids are the manifest slots whose mechanic needs no hazard body:
 *
 *   ch1-l01 road/flat/S · ch1-l02 road/climb/M · ch1-l03 multi-seal/U/M ·
 *   ch1-b1 multi-seal/tier/S · ch1-b2 hook/S/S · ch1-b3 catch/U/S · ch1-b4 road/descent/L
 *
 * They are NOT a contiguous prefix of the 28-slate (the bonuses sit at their sawtooth
 * valleys); manifestForAuthored() filters the slate to exactly this set so the Hub /
 * campaign / atlas stay consistent (the clear→Next chain walks the authored tiles in
 * display order, unconditionally, so a skipped numbered slot never blocks progression).
 *
 * Pure DATA consumed by scripts/levels/authoring.ts, which runs each candidate stroke
 * through the real engine at Lv0, derives the ink economy, records ghosts, auto-places
 * coins on the driven CAR route, and emits levels/<id>.json. Regenerate after a
 * TuningConstants change = rerun authoring (no --only, so Gate-2 ghost order is stable).
 *
 * REALIZATION RULES (measured this wave — the atlas draws the SETTLED shape, so a drawn
 * stroke must be shaped to SETTLE into it):
 *   - UP-BOW: draw spans as a slight arch (bow 0.12–0.20). The settled shape becomes the
 *     atlas's scoop/flat; a drawn flat/scoop collapses or over-displaces under the car.
 *   - SPLIT LONG CLIMBS/DESCENTS: a single ~43° ramp is undriveable and a single wide gap
 *     over-runs the unsupported-span limit, so long climbs (L2) and descents (B4) are two
 *     shorter ramps over a terrain MID-LEDGE; every unsupported span stays ≤5.5 m.
 *   - MULTI-SEAL rests the line on mid PILLARS (2 pillars = 3 short seams, L3); the tier
 *     islands (B1) and pegs (B2) are pillars (4-pt trapezoids, top solid), never bare
 *     2-pt tops (Gate 1 reads a 2-pt polyline as a ceiling).
 *   - DISPLACEMENT is car-path scoped (≤0.3 m for nodes the car rides): keep ridden spans
 *     short / firmly bowed / terrain-backed so the settled→driven shove stays in band.
 *
 * Coordinates: world meters, y-up. Terrain authored left→right (top solid).
 */

import type { DangerZone, GimmickTag, Point, Polyline, Rect, Rock } from '../../src/engine/level/LevelSchema';
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

export interface LevelSource {
  readonly id: string;
  readonly design: string;
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
}

/** N placeholder coins (authoring re-places them ON the driven route; only the COUNT persists). */
function coinCount(n: number): Point[] {
  return coinArc(0, 1.2, n, 0.5, 0.3);
}

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // L1 (v5 slate #1) — road / flat / S. atlas-design-v5 card 1 (はじめの一歩).
  // Shallow 1-hole valley, one firm up-bow bridge. Tutorial teaches "離す＝走る".
  // The atlas draws the SETTLED line as a downward scoop; a drawn scoop collapses,
  // so we draw a firm UP-bow (bow 0.12) that settles into the design's shape — the
  // car-path displacement measures 0.17 m (<=0.3, F5). Wide platforms keep spawn/goal
  // at ±5 (D_sg 10.0, S floor) over a 4.4 m span.
  {
    id: 'ch1-l01',
    design: 'road/flat/S: 浅い谷を1本橋で渡る — v5 #1 (研究09 A1)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -7, leftRim: -2.2, leftY: 0, rightRim: 2.2, rightY: 0, rightFar: 7, chasmY: -4.5 }),
    vehicleSpawn: p(-5, 0.35),
    goalFlag: flag(5, 0, 1, 2),
    killY: -4.5,
    coins: coinCount(5),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'road-bridge', points: arch(-2.9, 0.06, 2.9, 0.06, 0.12) }],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L2 (v5 slate #2) — road / climb / M. atlas-design-v5 card 2 (のぼり道).
  // Low-left → high-right shelf (+~5 m). REALIZATION: the atlas's single 43° ramp is
  // undriveable, so the climb is TWO ~32° ramps over a terrain MID-LEDGE mesa the car
  // regains footing on between climbs. Each drawn ramp span is ~4.2 m (≤5.5 m).
  {
    id: 'ch1-l02',
    design: 'road/climb/M: 中棚を挟む二段ランプで高い棚へ登る（急な一枚坂は走破不可）— v5 #2 (研究09 A2 / Draw Climber)',
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: [
      pl(p(-8, 0), p(-3.0, 0), p(-2.8, -4.6)),
      pl(p(-0.2, -4.6), p(0.0, 1.2), p(2.6, 1.2), p(2.8, -4.6)), // mid-ledge mesa (2.6 m runway)
      pl(p(5.4, -4.6), p(5.6, 2.4), p(9, 2.4)),
    ],
    vehicleSpawn: p(-5.3, 0.35),
    goalFlag: flag(6.2, 2.4, 1, 2),
    killY: -5,
    coins: coinCount(5),
    strokes: [
      {
        kind: 'any',
        role: 'two-span-climb',
        points: spline([p(-3.7, 0.06), p(-1.5, 0.78), p(0.0, 1.22), p(2.6, 1.22), p(4.1, 1.98), p(6.2, 2.42)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L3 (v5 slate #3) — multi-seal / U / M. atlas-design-v5 card 3 (みっつの切れ目).
  // 2 pillars split a 6.8 m crossing into 3 seams; one continuous line seals all
  // three (efficiency = 3★). NOT anti-dominant (a straight sagged onto the pillars
  // also clears — the pillars are the STAR path, not a Gate-3 straight-kill). UP-BOW:
  // the line rests on the rims (0) + pillar tops (-0.2); each seam ≤~1.9 m unsupported.
  {
    id: 'ch1-l03',
    design: 'multi-seal/U/M: 2柱・三連の切れ目を一本の連続床で塞ぐ — v5 #3 (R08 Draw Line Bridge)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      ...twoPlatforms({ leftFar: -9, leftRim: -3.4, leftY: 0, rightRim: 3.4, rightY: 0, rightFar: 9, chasmY: -5.5 }),
      pillar(-1.3, -0.12, -5.5, 0.6, 1.0),
      pillar(1.3, -0.12, -5.5, 0.6, 1.0),
    ],
    vehicleSpawn: p(-6.5, 0.35),
    goalFlag: flag(5.5, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(6),
    strokes: [
      {
        kind: '3star',
        role: 'multi-seal-U',
        points: spline([p(-4.0, 0.04), p(-2.5, -0.05), p(-1.3, -0.12), p(0, -0.05), p(1.3, -0.12), p(2.5, -0.05), p(4.0, 0.04)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B1 (v5 slate, after L4) — bonus multi-seal / tier / S. atlas card 5 (階段のコイン).
  // A raised central ISLAND the zigzag runs up-over-down; coin bonanza breather. The
  // island is a pillar (top solid); rim-to-rim gap is ≤4.6 m (a raised island reads as
  // "unsupported" to the span gate, so the rims bracket a ≤5.5 m run). Non-AD (息抜き).
  {
    id: 'ch1-b1',
    design: 'multi-seal/tier/S: 中央の高い島を越える段違いジグザグ床・コイン祭 — v5 #B1 (R08-lite Draw Line Bridge)',
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
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B2 (v5 slate, after L7) — bonus hook / S / S. atlas card 9 (くねり道).
  // A gentle S hooked over a central low PEG island; coin arc breather. rim-to-rim
  // ≤5.2 m (≤5.5), the peg physically supports the S dip. Non-AD (息抜き).
  {
    id: 'ch1-b2',
    design: 'hook/S/S: 中央ペグに引っ掛ける緩S字・コイン弧 — v5 #B2 (R09-lite Happy Glass 支柱)',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: [
      pl(p(-7, 0.6), p(-2.6, 0.6), p(-2.4, -4.4)),
      pillar(0, 0.3, -4.4, 0.8, 1.2), // central island (car crosses it; mid-support splits the span)
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
        role: 'hook-scurve',
        points: spline([p(-3.2, 0.62), p(-1.6, 0.36), p(-0.8, 0.32), p(0.8, 0.32), p(1.6, 0.6), p(3.2, 0.92)]),
      },
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
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: twoPlatforms({ leftFar: -7, leftRim: -2.6, leftY: 0.9, rightRim: 2.6, rightY: 0.9, rightFar: 7.5, chasmY: -4.4 }),
    vehicleSpawn: p(-4.9, 1.25),
    goalFlag: flag(5.0, 0.9, 1, 2),
    killY: -5,
    coins: coinCount(7),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'catch-dish', points: arch(-3.3, 0.96, 3.3, 0.96, 0.14) }],
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
    inkFeel: 'generous',
    bonusMultiplier: 5,
    terrain: [
      pl(p(-7.5, 2.6), p(-2.4, 2.6), p(-2.2, -5)),
      pl(p(1.5, -5), p(1.7, 0.6), p(3.1, 0.6), p(3.3, -5)), // mid-ledge mesa
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
        points: spline([p(-3.0, 2.62), p(-0.4, 1.6), p(1.7, 0.62), p(3.1, 0.62), p(5.2, -0.4), p(7.8, -1.38)]),
      },
    ],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

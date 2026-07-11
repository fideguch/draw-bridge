/**
 * Chapter 1 declarative level sources — ATLAS-FIRST DESIGN v5, WAVE 3 (spike/zone).
 *
 * The design is FROZEN: designs/atlas-design-v5.html (`LEVELS[]`) + designs/game_plan_v5.md
 * are the master. THIS FILE ships the 7 hazard-free wave-2 levels PLUS the 6 spike /
 * DangerZone levels of wave 3 (no rocks this wave — the 14 rock/composite levels land
 * later). 13 shipped ids (round-7 F1 made hazard CONTACT an instant loss):
 *
 *   ch1-l01 road/flat/S · ch1-l02 road/climb/M · ch1-l03 multi-seal/U/M · ch1-l04 spike-floor/M ·
 *   ch1-b1 multi-seal/tier/S · ch1-b2 hook/S/S · ch1-l08 zone/L · ch1-l09 spike-floor/M ·
 *   ch1-l10 sag/spike-floor/L · ch1-b3 catch/U/S · ch1-l12 zone/L · ch1-b4 road/descent/L ·
 *   ch1-l17 sag-cantilever/spike-floor/XL
 *
 * WAVE-3 ENGINE ADAPTATIONS (design cards call for mechanics this car/physics can't do;
 * the wave-2 practice of adapting-to-physics continues — every adaptation is noted per
 * level and DID pass the per-hazard relevance gate + all 7 STRICT gates):
 *   - CEILING SPIKES (spikeDown, L9): infeasible — ducking a 0.8 m car into a gap-valley
 *     bounces it back UP into the teeth, a gentle descent keeps its lead wheel too high,
 *     and the naive baselines never rise into a roof hazard. Realized as a spike-FLOOR hook.
 *   - BALLISTIC RAMP-JUMP (L4): a drawn launch ramp is a cantilever that SAGS (no clean
 *     kick), and a downhill drive-off naturally clears any ≤5.5 m gap. Realized as a
 *     multi-seal sag over a deep spike floor.
 *   - SHAFT DESCENT (L12) / MULTI-SEAL ZONE (L8): a drawn descent free-falls/overshoots and
 *     high terrain reads as one giant unsupported span; a high-road over a pit-zone also
 *     sags past the F5 displacement limit. Both are realized as a firm SAG on a central
 *     pillar over a DEEP floor DangerZone (idle falls in) — the same skeleton as L10's
 *     spike floor. L8/L10/L12 therefore share a family silhouette (zone vs spike style).
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

import type { DangerZone, GimmickTag, Point, Polyline, Rect, Rock, ShapeTag } from '../../src/engine/level/LevelSchema';
import {
  arch,
  ceiling,
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
    // Round-8 multi-solution DEMO (Gate 8 end-to-end proof on the tutorial): two
    // declared solutions of DIFFERENT shape families, both probed to CLEAR at Lv0
    // (probe 2026-07-11: line t=168 ink=5.80 / arch t=168 ink=5.93, both 3★).
    // Terrain / economy / strokes above are UNTOUCHED — solutions are additive.
    solutions: [
      { shapeTag: 'line', points: [p(-2.9, 0.05), p(0, 0.05), p(2.9, 0.05)] },
      { shapeTag: 'arch', points: arch(-2.9, 0.06, 2.9, 0.06, 0.55) },
    ],
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
    // Round-8 (W1): declare the card's SECOND solution — the folded ANGLE climb
    // (same mesa route, straight-segment folds instead of the smooth ramp spline).
    // Both probed to CLEAR at Lv0 (2026-07-11: ramp t=198, angle t=198, both 3★).
    // Terrain / ghost / economy UNCHANGED — solutions are additive.
    solutions: [
      { shapeTag: 'ramp', points: spline([p(-3.7, 0.06), p(-1.5, 0.78), p(0.0, 1.22), p(2.6, 1.22), p(4.1, 1.98), p(6.2, 2.42)]) },
      { shapeTag: 'angle', points: [p(-3.7, 0.06), p(-1.5, 0.78), p(0.0, 1.22), p(2.6, 1.22), p(4.1, 1.98), p(6.2, 2.42)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L3 (round-8 REDESIGN, fun_cards_v6 ch1-l03 みっつの切れ目) — 3-support drape.
  // A 6.4 m valley with 2 low pillars (top -0.1) flanking a CENTRAL WALL (top +0.65
  // = rim+0.65 = the geometric interceptor). "3 supports" is the theme; the WALL is
  // the straight-killer: every flat lazy chord (drawn near rim y0) is CLIPPED by the
  // wall (rim+0.65) and drops into a seam. The intended M-sag DRAPES over pillar tops
  // (-0.1) and the wall crown (+0.65); the arch bows over all three. spike-round8 S0:
  // a bare flat line self-supports 7.5 m, so the wall — not span/sag — does the kill.
  // Probed 2026-07-11: sag t=193 3★, arch t=182 3★; Gate7 all 6 defeated (wall clip).
  {
    id: 'ch1-l03',
    design: 'multi-seal/U/M: 谷6.4m・2柱＋中央壁塔（幾何インターセプタ）に載せ掛ける三支点の橋 — fun_cards_v6 ch1-l03 (round-8)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      ...twoPlatforms({ leftFar: -9, leftRim: -3.2, leftY: 0, rightRim: 3.2, rightY: 0, rightFar: 9, chasmY: -5.5 }),
      pillar(-1.9, -0.1, -5.5, 0.5, 0.9), // left support pillar (top -0.1)
      pillar(1.9, -0.1, -5.5, 0.5, 0.9), // right support pillar (top -0.1)
      pillar(0, 0.65, -5.5, 0.25, 0.45), // central WALL crown (rim+0.65) — clips flat chords
    ],
    vehicleSpawn: p(-6.5, 0.35),
    goalFlag: flag(5.5, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(6),
    strokes: [
      {
        kind: 'any',
        role: 'multi-seal-drape',
        points: spline([p(-3.2, 0.02), p(-1.9, -0.08), p(-0.9, 0.3), p(0, 0.72), p(0.9, 0.3), p(1.9, -0.08), p(3.2, 0.02)]),
      },
    ],
    solutions: [
      { shapeTag: 'sag', points: spline([p(-3.2, 0.02), p(-1.9, -0.08), p(-0.9, 0.3), p(0, 0.72), p(0.9, 0.3), p(1.9, -0.08), p(3.2, 0.02)]) },
      { shapeTag: 'arch', points: arch(-3.2, 0.04, 3.2, 0.04, 1.0) },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 3 — SPIKE / DANGER-ZONE levels (no rocks). Each carries dangerZones[]
  // (car overlap = instant 'hazardContact' loss; the drawn line + car ride over/
  // around it). Hazards are IN-PATH: a naive baseline (straight-overlap1 or the
  // idle no-line) dies by that hazard (Gate 2.6 per-hazard relevance enforces),
  // while the intended ghost CLEARS with ZERO hazard contact. Realization notes:
  //   - Spike FLOORS / ceiling spikeDown / wall zones are dangerZones (rects); a
  //     'spike'/'spikeDown'/'zone' style is render-only (physics-inert).
  //   - Solid mid-supports the LINE rests on are trapezoid PILLARS (thin nubs
  //     diverge Box2D); ceilings are 2-pt right→left polylines (underside solid).
  //   - Deep chasms give the vertical the size gate wants (pit view = rim−3 m).
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // L4 (round-8 REDESIGN, fun_cards_v6 ch1-l04 棘の塔を上で越える) — arch over a
  // spike gorge. A 5.4 m spike-floor pit split by a CENTRAL WALL crown (top +1.45 =
  // rim+0.67 = the interceptor). The intended ARCH (bow 0.8, apex ~1.58) rests firmly
  // on the wall crown (mid-support keeps the ridden shove ≤0.3 m, Gate6) and clears it;
  // the trapezoid deck is the second solution. Every flat lazy chord (drawn near rim
  // y0.78 < 1.45) is CLIPPED by the wall and drops onto the SPIKE FLOOR (dangerZone,
  // hazardContact = loss + the naive-fall attribution Gate2.6 needs). spike-round8:
  // the card's zone-tower + self-supporting 6.0 m arch is disp-infeasible (0.38 m > 0.3
  // unsupported, measured); a wall-supported arch is the robust realization. Probed
  // 2026-07-11: arch t=194 3★, trap t=193 3★; Gate7 all 6 defeated; disp 0.25 m.
  {
    id: 'ch1-l04',
    design: 'spike-arch/flat/M: 棘の谷に立つ中央壁塔を、壁に載せたアーチ/台形高架で越える（無線の平線は壁で切れ棘床へ落ちる）— fun_cards_v6 ch1-l04 (round-8)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.78), p(-2.7, 0.78), p(-2.9, -5.5)), // left rim y0.78
      pl(p(2.9, -5.5), p(2.7, 0.78), p(9, 0.78)), // right rim y0.78
      pillar(0, 1.45, -5.5, 0.38, 0.65), // central WALL crown (rim+0.67) — arch rests, flat chords clip
    ],
    vehicleSpawn: p(-6.3, 1.13),
    goalFlag: flag(5.5, 0.78, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -2.6, y: -3.6, width: 5.2, height: 0.9, style: 'spike' }], // spike floor (loss + naive fall)
    strokes: [
      {
        kind: 'any',
        role: 'spike-arch',
        points: [p(-3.5, 0.78), ...arch(-2.7, 0.78, 2.7, 0.78, 0.8), p(3.5, 0.78)],
      },
    ],
    solutions: [
      { shapeTag: 'arch', points: [p(-3.5, 0.78), ...arch(-2.7, 0.78, 2.7, 0.78, 0.8), p(3.5, 0.78)] },
      { shapeTag: 'trapezoid', points: [p(-3.5, 0.78), ...spline([p(-2.7, 0.8), p(-1.1, 1.6), p(1.1, 1.6), p(2.7, 0.8)]), p(3.5, 0.78)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L8 (round-8 REDESIGN, fun_cards_v6 ch1-l08 縁までせり上がる危険帯) — rising band.
  // A deep danger band that RISES to y1.0 = rim+0.1: a flat ground-level line is no longer
  // safe. Every low lazy chord (rim y0.9) dips into the band top (1.0) and dies; the naive
  // straight sags into it (hazardContact + attribution). The intended clears it OVERHEAD —
  // NO support pillars (a pillar tall enough to lift the deck also blocks the naive line
  // from reaching the band; W2-measured: pillars → naive divergence, band unattributed).
  // Both solutions self-support the 7.4 m span above the band: the arch (bow 1.3, ARCH_EXEMPT,
  // spike round8 S1) and a self-supporting flat-top trapezoid hump. Probed 2026-07-11:
  // arch clr 0.65 m, trap clr 0.57 m; Gate7 all 6 defeated (band contact).
  {
    id: 'ch1-l08',
    design: 'rising-band/flat/L: 谷底から縁上 y1.0 までせり上がる赤帯。地表すれすれの平線は帯に触れて即死。無支持のアーチ/台形床で帯を頭上に越す（無線の直進は帯へ沈む）— fun_cards_v6 ch1-l08 (round-8, W2)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0.9), p(-3.7, 0.9), p(-3.9, -5.8)), // left rim y0.9
      pl(p(3.9, -5.8), p(3.7, 0.9), p(9.5, 0.9)), // right rim y0.9
    ],
    vehicleSpawn: p(-6.4, 1.25),
    goalFlag: flag(6.6, 0.9, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -1.8, y: -4.6, width: 3.6, height: 5.6, style: 'zone' }], // band risen to top y1.0 (rim+0.1)
    strokes: [
      {
        kind: 'any',
        role: 'band-arch',
        points: [p(-3.9, 0.92), ...arch(-3.7, 0.92, 3.7, 0.92, 1.3), p(3.9, 0.92)],
      },
    ],
    solutions: [
      { shapeTag: 'arch', points: [p(-3.9, 0.92), ...arch(-3.7, 0.92, 3.7, 0.92, 1.3), p(3.9, 0.92)] },
      { shapeTag: 'trapezoid', points: [p(-3.9, 0.92), ...spline([p(-3.7, 0.92), p(-1.9, 1.75), p(1.9, 1.75), p(3.7, 0.92)]), p(3.9, 0.92)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L9 (round-8 REDESIGN, fun_cards_v6 ch1-l09 谷の塔を踏み台に) — stone tower.
  // A low-left shelf (0.9) → high-right shelf (1.4) with a central STONE TOWER (terrain,
  // top 1.75 — higher than both rims) over a spike floor. Every straight line is CLIPPED
  // by the tower and its free end droops, dropping the car onto the spike floor
  // (hazardContact + attribution). 1.75 is REQUIRED (spike round8 note): at 1.6 the
  // spawn-goal-high chord soft-lands on the tower crown (leak). The intended trapezoid
  // climbs onto the tower crown (踏み台) and eases down; the arch bows over it. Both REST
  // on the crown (no sag) so clearance is huge. Probed 2026-07-11: trap clr 5.6 m, arch
  // clr 5.6 m; Gate7 all 6 clipped→fall.
  {
    id: 'ch1-l09',
    design: 'stone-tower/tier/M: 低い左棚から高い右棚へ、両棚より高い石塔（頂1.75）を踏み台に登り渡る（無線はどれも塔で切れ棘床へ落ちる）— fun_cards_v6 ch1-l09 (round-8, W2)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.0, 0.9), p(-2.3, 0.9), p(-2.5, -5.0)), // low-left shelf y0.9
      pillar(0.0, 1.75, -5.0, 0.5, 0.72), // central stone tower crown (rim+, clips every straight)
      pl(p(2.3, -5.0), p(2.5, 1.4), p(9.0, 1.4)), // high-right shelf y1.4
    ],
    vehicleSpawn: p(-6.3, 1.25),
    goalFlag: flag(5.9, 1.4, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -2.1, y: -4.5, width: 4.6, height: 0.9, style: 'spike' }], // spike floor top -3.6
    strokes: [
      {
        kind: 'any',
        role: 'tower-trapezoid',
        points: [p(-2.4, 0.9), ...spline([p(-2.3, 0.92), p(-1.1, 1.65), p(-0.5, 1.8), p(0.5, 1.8), p(1.1, 1.68), p(2.3, 1.44)]), p(2.5, 1.4)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-2.4, 0.9), ...spline([p(-2.3, 0.92), p(-1.1, 1.65), p(-0.5, 1.8), p(0.5, 1.8), p(1.1, 1.68), p(2.3, 1.44)]), p(2.5, 1.4)] },
      { shapeTag: 'arch', points: [p(-2.4, 0.9), ...arch(-2.3, 0.95, 2.3, 1.45, 0.6), p(2.5, 1.4)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L10 (round-8 REDESIGN, fun_cards_v6 ch1-l10 尖塔を越える弓) — spike spire.
  // A deep spike canyon (rim 0.8) with a central spike SPIRE rising ABOVE the rim
  // (dangerZone, top 1.05 = rim+0.25). No mid-pillar (spike round8 S0: the 5.4 m span
  // self-supports, so span/sag can't kill a flat line — a geometric interceptor must).
  // Every rim-height line, taut or not, has its car run into the spire and die
  // (hazardContact + attribution). The intended ARCH bows over the spire tip; the folded
  // ANGLE tent peaks over it — the height-vs-ink trade the card wants. Probed 2026-07-11:
  // arch clr 0.66 m, angle clr 0.40 m; Gate7 all 6 defeated (spire contact).
  {
    id: 'ch1-l10',
    design: 'spike-spire/U/L: 谷底一面の棘と、リムより高く突き出す中央の棘尖塔（頂1.05）。リム高の線はどれも尖塔に串刺し。弓/テントで尖塔の上を越える — fun_cards_v6 ch1-l10 (round-8, W2)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-8, 0.8), p(-2.7, 0.8), p(-2.9, -5.2)), // left rim y0.8
      pl(p(2.9, -5.2), p(2.7, 0.8), p(8.5, 0.8)), // right rim y0.8
    ],
    vehicleSpawn: p(-5.8, 1.15),
    goalFlag: flag(5.6, 0.8, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -0.35, y: -4.4, width: 0.7, height: 5.45, style: 'spike' }], // central spire top 1.05 (rim+0.25)
    strokes: [
      {
        kind: 'any',
        role: 'spire-arch',
        points: [p(-3.4, 0.8), ...arch(-2.7, 0.8, 2.7, 0.8, 1.0), p(3.4, 0.8)],
      },
    ],
    solutions: [
      { shapeTag: 'arch', points: [p(-3.4, 0.8), ...arch(-2.7, 0.8, 2.7, 0.8, 1.0), p(3.4, 0.8)] },
      { shapeTag: 'angle', points: [p(-3.4, 0.8), p(-2.7, 0.8), p(0, 1.7), p(2.7, 0.8), p(3.4, 0.8)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L12 (round-8 REDESIGN, fun_cards_v6 ch1-l12 壁から突き出す赤帯) — descent ORDER.
  // A wide descent from a high-left rim (y1.6) to a low-right goal (y-0.6). A red
  // danger band juts RIGHTWARD from the left wall like a shelf (x-3.7..-1.35, up to
  // y1.55). The naive diagonal descent dives straight down-right and drives its car
  // THROUGH the protrusion → hazardContact (contact = instant loss); you must first
  // steer RIGHT along the top, clear the band's tip (x-1.35), and only THEN descend —
  // the "order of the descent" is the puzzle. Two descending pillars (top 0.5 / -0.25)
  // stand to the RIGHT of the band as the stepping stones. Solutions: a HOOK that
  // curls right over the tip then drops; a folded RAMP down the staggered pillars.
  // Probed 2026-07-11 (W3): hook + ramp clear Lv0; Gate7 all 6 defeated; band attributed.
  {
    id: 'ch1-l12',
    design: 'descent-order/tier/L: 高い左リムから低い右ゴールへ降りる谷。左壁から突き出す赤帯を貫く対角降下は即死。帯先端を右へ回り込んでから段違い柱を降りる（順序の谷）— fun_cards_v6 ch1-l12 (round-8, W3)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.8, 0.8), p(-2.4, 0.8), p(-2.6, -6.0), p(2.6, -6.0), p(2.4, 0.0), p(10.4, 0.0)), // high-left rim 0.8 → deep valley (4.8 m) → low-right goal 0.0 (mild descent)
      pillar(0, 1.35, -6.0, 0.8, 1.1), // central CROWN (rim+0.55) — clips every chord, anchors the deck
    ],
    vehicleSpawn: p(-6.6, 1.15),
    goalFlag: flag(6.2, 0.0, 1, 2),
    killY: -12,
    coins: coinCount(6),
    // CARD DEVIATION (W3): the card's low wall-protruding band cannot separate a naive
    // descent from a solution (both traverse the left near rim height — measured across
    // band heights 1.1→1.55, arc apexes 1.9→2.7, tower 2.05); and a free descent-arch over
    // a spike zone, while it clears headless, TIPS/GRAZES under the deep-pit's low px/m
    // pointer rounding (real-input e2e). Realized as a robust crown-clip DESCENT: a central
    // terrain CROWN (top 1.35) juts up where every straight diagonal descent CLIPS it and
    // drops onto the SPIKE FLOOR; the intended TRAPEZOID climbs ONTO the crown (mid-support,
    // no tip) and eases down to the low-right goal, the ARCH bows over it. Probed + e2e W3.
    dangerZones: [{ x: -2.4, y: -5.5, width: 4.8, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'crown-descent-trapezoid',
        points: [p(-3.0, 0.8), ...spline([p(-2.4, 0.82), p(-1.3, 1.15), p(-0.8, 1.35), p(0.8, 1.35), p(1.3, 0.9), p(2.4, 0.02)]), p(3.0, 0.0)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-3.0, 0.8), ...spline([p(-2.4, 0.82), p(-1.3, 1.15), p(-0.8, 1.35), p(0.8, 1.35), p(1.3, 0.9), p(2.4, 0.02)]), p(3.0, 0.0)] },
      { shapeTag: 'arch', points: [p(-3.0, 0.8), ...arch(-2.4, 0.82, 2.4, 0.02, 1.15), p(3.0, 0.0)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L17 (v5 slate #17, NEW id) — sag cantilever / S-curve / XL · spike floor.
  // atlas card 21 (棘上の張り出し). A wide, deep spike canyon split by a central
  // mid-PEG. REALIZATION: naive fall/over-sag hits the spike floor; the ghost
  // strings a gentle S from the high-left shelf, over the mid-peg (which supports
  // it within the tension limit — two ≤5.5 m spans), up to the right shelf. Deep
  // canyon (floor −6) supplies the XL vertical the size gate wants.
  {
    id: 'ch1-l17',
    design: 'sag-cantilever/S/XL: 棘のS字峡谷に中州ペグから張り出して二段で対岸へ渡す — v5 #17 (R03 + R09)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(p(-9.2, 2.4), p(-2.6, 2.4), p(-2.8, -7.5)),
      pillar(0.4, 1.55, -3.5, 0.8, 1.2),
      pl(p(3.4, -7.5), p(3.6, 1.8), p(10.4, 1.8)),
    ],
    vehicleSpawn: p(-6.9, 2.75),
    goalFlag: flag(7.5, 1.8, 1, 2),
    killY: -14,
    coins: coinCount(6),
    dangerZones: [{ x: -2.2, y: -3.6, width: 6.4, height: 0.8, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'sag-cantilever-S',
        points: spline([p(-2.6, 2.4), p(-1.2, 1.72), p(0.4, 1.55), p(2.0, 1.7), p(3.6, 1.8)]),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 4 — ROCK levels (boulder hazards). Each carries rocks[] (car↔rock CONTACT
  // = instant 'hazardContact' loss, round-7 §2.1). IN-PATH: a naive baseline (the
  // idle no-line car) crosses the deep pit, falls off the far rim, and lands on the
  // BOULDER resting on a mid-depth ledge → hazardContact (Gate 2.6 per-hazard
  // relevance enforces); the intended ghost rides a FIRM sag seated on a mid-pillar
  // OVER the pit with ZERO contact (the boulder is metres below it).
  //
  // WAVE-4 ENGINE ADAPTATION (the atlas cards call for a floating tilted roof/chute/
  // wall that DEFLECTS a falling rock aside; that shape is INFEASIBLE — a drawn chain
  // has NO terrain weld (BridgeChainBuilder is a free capsule chain), so an elevated
  // roof over the lane collapses onto the car, and a car riding a tall deflecting arch
  // busts the 0.3 m displacement gate. Measured across ~200 configs. Realized instead,
  // per the wave-2/3 adapt-to-physics practice, as a DEEP pit crossed by a firm
  // mid-pillar sag (disp ≈ 0.08 m, well under the 0.3 m gate — the deep pit + short
  // pillar-split spans keep the ridden line taut) with the BOULDER on a ledge in the
  // far half of the pit where the naive car falls. Distinct silhouettes: flat / climb /
  // descent / two-step tier / far-goal tier / twin-pit M, plus L11's spike-gorge seal.

  // ─────────────────────────────────────────────────────────────────────────────
  // L5 (round-8 REDESIGN, fun_cards_v6 ch1-l05 深く噛ませる) — flat-top/tent over a
  // wall. A 5.2 m spike-floor pit split by a TALL CENTRAL WALL crown (top +1.1 =
  // rim+0.7 = the interceptor). The intended TRAPEZOID deck (flat top 1.4) rests on
  // the wall crown and clears it; the folded ANGLE tent (apex 1.5) is the second
  // solution. Flat lazy chords (near rim y0.4 < 1.1) are CLIPPED by the wall and drop
  // onto the SPIKE FLOOR (dangerZone; loss + Gate2.6 naive-fall attribution).
  // spike-round8 DEVIATION NOTE: the card's "duck under 垂れ棘 (spikeDown overhead)"
  // is physically infeasible — measured, the deep-V solution's steep descent TILTS the
  // car so its AABB-top rises INTO any central overhead band while the deep-sagging
  // lazy rim-exact rides LOWER (no clean separation, 4+ configs). Per spike-round8's
  // explicit "l05 needs a central interceptor" verdict, realized as a wall-clip level
  // (keeps the deep pit + spike theme + the card's "the flat line dies, you go over"
  // discovery). Probed 2026-07-11: trap t=193 3★, angle t=189 3★; Gate7 all 6 defeated.
  {
    id: 'ch1-l05',
    design: 'spike-trap/flat/M: 棘の谷の中央壁塔を、壁に載せた台形/テントの床で越える（無線の平線は壁で切れ棘床へ落ちる）— fun_cards_v6 ch1-l05 (round-8, spike-mandated central-interceptor)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.6, 0.4), p(-2.8, -5.2)), // left rim y0.4
      pl(p(2.8, -5.2), p(2.6, 0.4), p(7, 0.4)), // right rim y0.4
      pillar(0, 1.1, -5.2, 0.3, 0.55), // central WALL crown (rim+0.7) — deck rests, flat chords clip
    ],
    vehicleSpawn: p(-6.3, 0.75),
    goalFlag: flag(5.0, 0.4, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -2.5, y: -3.6, width: 5.0, height: 0.9, style: 'spike' }], // spike floor (loss + naive fall)
    strokes: [
      {
        kind: 'any',
        role: 'spike-trap-over-wall',
        points: [p(-3.3, 0.4), ...spline([p(-2.6, 0.4), p(-1.0, 1.4), p(1.0, 1.4), p(2.6, 0.4)]), p(3.3, 0.4)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-3.3, 0.4), ...spline([p(-2.6, 0.4), p(-1.0, 1.4), p(1.0, 1.4), p(2.6, 0.4)]), p(3.3, 0.4)] },
      { shapeTag: 'angle', points: [p(-3.3, 0.4), p(-2.6, 0.4), p(0, 1.5), p(2.6, 0.4), p(3.3, 0.4)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L6 (round-8 REDESIGN, fun_cards_v6 ch1-l06 頭上の岩、先に抜ける) — stone-crown climb
  // over a spike gorge. W2-DEVIATION (measured): the card's overhead drop+trigger rock is
  // KNIFE-EDGE — the "naive dies / intended lives" split depends on sub-mm recycled-world
  // float drift (spike round8 l23 finding; W2 probe: the same stroke flips clear↔die
  // between world states). A dynamic boulder placed AS the interceptor is equally unstable
  // (it rolls under the bridge). Realized instead as a TERRAIN stone-crown (top 1.3 =
  // rim+0.7, the geometric interceptor) over a deep spike floor: every low lazy chord
  // (drawn near rim y0.6) CLIPS the crown and drops onto the SPIKE FLOOR (dangerZone,
  // hazardContact = loss + naive-fall attribution). The intended ARCH rests firmly on the
  // crown (no sag) and eases down to the +0.9 shelf; the trapezoid is the second solution.
  // Probed 2026-07-11: arch clr 4.9 m, trap clr 4.9 m; Gate7 all 6 clipped→fall.
  {
    id: 'ch1-l06',
    design: 'stone-crown/climb/M: 棘の谷に立つ中央石塔（幾何インターセプタ）を、塔に載せたアーチ/台形で越え右棚へ登る（無線の低い平線は塔で切れ棘床へ落ちる）— fun_cards_v6 ch1-l06 (round-8, W2)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.6), p(-2.3, 0.6), p(-2.5, -5.2)), // low-left rim y0.6
      pillar(0, 1.3, -5.2, 0.5, 0.72), // central stone crown (rim+0.7) — chords clip, intended rests on its flat top
      pl(p(2.3, -5.2), p(2.5, 0.9), p(9, 0.9)), // right shelf y0.9
    ],
    vehicleSpawn: p(-6.3, 0.95),
    goalFlag: flag(5.9, 0.9, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -2.1, y: -4.5, width: 4.6, height: 0.9, style: 'spike' }], // spike floor (loss + naive fall)
    // Ghost = the trapezoid: it RESTS on the crown (deck 1.3 = crown top) so the ridden
    // span is split into two short seams (Gate 5/6 pass). The arch bows OVER the crown
    // (a valid alternative solution — Gate 8 verifies its clear; its higher unsupported
    // span is not the recorded ghost, so it does not drive the displacement gate).
    strokes: [
      {
        kind: 'any',
        role: 'crown-trapezoid-climb',
        points: [p(-2.4, 0.6), ...spline([p(-2.3, 0.62), p(-1.1, 1.15), p(-0.5, 1.35), p(0.5, 1.35), p(1.1, 1.18), p(2.3, 0.94)]), p(2.5, 0.9)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-2.4, 0.6), ...spline([p(-2.3, 0.62), p(-1.1, 1.15), p(-0.5, 1.35), p(0.5, 1.35), p(1.1, 1.18), p(2.3, 0.94)]), p(2.5, 0.9)] },
      { shapeTag: 'arch', points: [p(-2.4, 0.6), ...arch(-2.3, 0.62, 2.3, 0.94, 0.55), p(2.5, 0.9)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L7 (round-8 REDESIGN, fun_cards_v6 ch1-l07 くだり街道の近道) — spire descent.
  // A tight-ink descent from a high-left rim (1.4) to a low-right shelf (0.2). W2-DEVIATION
  // (measured): the card's PURE ink-ration kill can't stop the SHORT rim-gap chord (spike
  // round8 S0: a flat/descending line self-supports the 4.2 m gap and clears; the intended
  // IS a short descending line, so ink + height alone can't separate them). Realized with a
  // central SPIRE (dangerZone, top 0.9): every low lazy chord (~0.8 at x0) rides through
  // the spire's kill height and dies; the full spawn→goal straight is also ink-unaffordable.
  // The answer stays HIGH+FLAT across the spire (car > 0.9) then eases down to the low shelf
  // only AFTER the spire — the "draw the clever short crossing, not the long straight"
  // discovery. Probed 2026-07-11: trap clr 0.8 m, arch clr 0.9 m; Gate7 all 6 defeated.
  {
    id: 'ch1-l07',
    design: 'spire-descent/L: 高い左から低い右へ降りる街道の中央に棘の尖塔（幾何インターセプタ）。低い直線は尖塔で即死、full straight はインク切れ。尖塔の上を高く越え短く渡す — fun_cards_v6 ch1-l07 (round-8, W2)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(p(-8, 1.4), p(-2.1, 1.4), p(-2.3, -8.5)), // high-left rim y1.4 over a DEEP shaft
      pl(p(2.3, -8.5), p(2.1, 0.2), p(8, 0.2)), // low-right shelf y0.2
    ],
    vehicleSpawn: p(-6.4, 1.75),
    goalFlag: flag(5.6, 0.2, 1, 2),
    killY: -15,
    coins: coinCount(6),
    dangerZones: [{ x: -0.35, y: -8.5, width: 0.7, height: 9.4, style: 'spike' }], // central spire top 0.9, deep shaft below
    strokes: [
      {
        kind: 'any',
        role: 'spire-arch-descent',
        points: [p(-2.4, 1.4), ...spline([p(-2.1, 1.4), p(-0.9, 1.72), p(0, 1.8), p(0.9, 1.72), p(1.7, 0.65), p(2.1, 0.2)]), p(2.5, 0.2)],
      },
    ],
    solutions: [
      { shapeTag: 'arch', points: [p(-2.4, 1.4), ...spline([p(-2.1, 1.4), p(-0.9, 1.72), p(0, 1.8), p(0.9, 1.72), p(1.7, 0.65), p(2.1, 0.2)]), p(2.5, 0.2)] },
      { shapeTag: 'trapezoid', points: [p(-2.4, 1.4), ...spline([p(-2.1, 1.4), p(-0.8, 1.7), p(0.8, 1.68), p(1.7, 0.65), p(2.1, 0.2)]), p(2.5, 0.2)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L11 (round-8 REDESIGN, fun_cards_v6 ch1-l11 天井と棘の回廊) — the dual-bound
  // CORRIDOR (the only level with BOTH an upper and lower bound). A spike gorge
  // (rims y0.6, floor -5.4) with a central TERRAIN pillar (top 1.2) flanked by twin
  // spike FANGS (top 0.95 = rim+0.35). Below: the fangs impale every low rim /
  // spawn-goal chord's car (y0.6 body → 0.95), and the pillar CLIPS every high chord
  // (rim+0.5 = 1.1 < 1.2 → the buried middle is removed and the car falls onto the
  // spike floor — 1.2 is REQUIRED: at 1.1 the high chord soft-lands on the crown and
  // leaks). Above: a terrain CEILING (underside 2.3) closes the "just bow higher"
  // escape (a bow apex ≥1.35 lifts the car top into it). The drivable band is the
  // corridor ≈1.0-1.3: the TRAPEZOID rests its flat top on the pillar crown (1.22),
  // the ANGLE tent peaks over it (1.25) — both thread over the fangs (+0.15) and
  // under the ceiling. Probed 2026-07-11 (W3): trap + angle clear Lv0; Gate7 all 6
  // defeated; fang + spike-floor zones both attributed.
  {
    id: 'ch1-l11',
    design: 'corridor/tier/L: 棘の谷に立つ中央柱（頂1.2）と柱脇の双牙（頂0.95）＋頭上の天井棘（2.3）。低い線は牙に刺さり高い弓は柱で切れ/天井に触れる。回廊(≈1.0-1.3)を台形/テントで通す — fun_cards_v6 ch1-l11 (round-8, W3)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.6), p(-2.3, 0.6), p(-2.5, -5.4), p(2.5, -5.4), p(2.3, 0.6), p(8.1, 0.6)),
      pillar(0, 1.2, -5.4, 0.7, 1.05), // central crown (rim+0.6) — clips every high chord; wide top shortens the ridden span
      ceiling(-2.0, 2.0, 2.6, 2.6), // terrain ceiling underside 2.6 (teeth to 2.3 render) — caps the high-bow escape
    ],
    vehicleSpawn: p(-6.3, 0.95),
    goalFlag: flag(5.6, 0.6, 1, 2),
    killY: -12,
    coins: coinCount(5),
    // Twin FANGS = one spike band flanking the pillar (top 0.95): its car-contact
    // kills every low chord AND the idle projectile. (A separate spike floor cannot
    // ALSO be attributed — a naive baseline dies at the FIRST hazard it meets, the
    // fang, never reaching the floor; Gate 2.6 is per-hazard, so the deep gorge +
    // killY carries the loss for the high chords that clip the pillar and fall.)
    dangerZones: [{ x: -0.85, y: -0.5, width: 1.7, height: 1.45, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'corridor-trapezoid',
        points: [p(-2.9, 0.62), ...spline([p(-2.3, 0.62), p(-1.3, 1.02), p(-0.7, 1.22), p(0.7, 1.22), p(1.3, 1.02), p(2.3, 0.62)]), p(2.9, 0.62)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-2.9, 0.62), ...spline([p(-2.3, 0.62), p(-1.3, 1.02), p(-0.7, 1.22), p(0.7, 1.22), p(1.3, 1.02), p(2.3, 0.62)]), p(2.9, 0.62)] },
      { shapeTag: 'angle', points: [p(-2.9, 0.62), p(-2.3, 0.62), p(0, 1.28), p(2.3, 0.62), p(2.9, 0.62)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L13 (round-8 REDESIGN, fun_cards_v6 ch1-l13 谷渡りと落ちる石) — boulder-crown climb.
  // CARD DEVIATION (W3, measured 18+ configs): the card's drop+trigger boulder is
  // INFEASIBLE under Gate 2.6 — an overhead drop past a pit can only be timed at the far
  // rim (where the taut sag out-runs it), but there NO naive baseline can reach it (the
  // idle car falls into the pit before the trigger; the rim baseline buries or dies to
  // fall, never the rock), so the drop is unattributable. Per the wave-2 sanctioned
  // fallback (l06 route), realized as a STATIC boulder-crown: a central stone crown
  // (top 1.0 = rim+0.6) CLIPS every low lazy chord and the car drops onto the BOULDER on
  // a mid-pit ledge (hazardContact); the intended TRAPEZOID / ARCH climb ONTO the crown,
  // cross, and drive the two-step terrain climb to the high goal. Probed 2026-07-11 (W3).
  {
    id: 'ch1-l13',
    design: 'boulder-crown/climb/L: 岩の谷の中央石塔（頂1.0）を越え、二段の棚を登って高台へ（無線は塔で切れ谷底の岩に落ちる）— fun_cards_v6 ch1-l13 (round-8, W3)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.6), p(2.9, -5.6), p(2.7, 0.4),
        p(3.8, 0.4), p(4.7, 0.9), p(5.5, 0.9), p(6.4, 1.4), p(9.5, 1.4),
      ),
      pillar(0, 1.55, -5.6, 0.45, 0.8), // central stone crown (rim+1.15) — clips every chord, no climb-over
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(7.0, 1.4, 1, 2),
    killY: -11,
    coins: coinCount(6),
    dangerZones: [{ x: -2.6, y: -5.0, width: 5.2, height: 0.9, style: 'spike' }], // spike floor (idle + every clip-fall)
    strokes: [
      {
        kind: 'any',
        role: 'crown-trapezoid-climb',
        points: [p(-3.2, 0.4), ...spline([p(-2.7, 0.42), p(-1.2, 1.35), p(-0.5, 1.55), p(0.5, 1.55), p(1.2, 1.35), p(2.7, 0.42)]), p(3.2, 0.4)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-3.2, 0.4), ...spline([p(-2.7, 0.42), p(-1.2, 1.35), p(-0.5, 1.55), p(0.5, 1.55), p(1.2, 1.35), p(2.7, 0.42)]), p(3.2, 0.4)] },
      { shapeTag: 'arch', points: [p(-3.2, 0.4), ...arch(-2.7, 0.42, 2.7, 0.42, 1.12), p(3.2, 0.4)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L14 (round-8 REDESIGN, fun_cards_v6 ch1-l14 来るぞ、頭上から) — spire-crown far run.
  // CARD DEVIATION (W3, same measured verdict as L13): the card's timed overhead DROP is
  // infeasible under Gate 2.6 (a drop past a pit is unattributable — every naive baseline
  // falls into the pit or buries before the trigger; measured across 18+ trigger/dropX/
  // dropY configs). Per the wave-2 sanctioned fallback, realized as a central SPIRE crown
  // (top 1.55) over a spike gorge: every straight chord CLIPS the spire and drops onto the
  // SPIKE FLOOR; the intended TRAPEZOID / ANGLE tent climb over it, then run the LONG far
  // tier to the distant raised goal (+0.5 m, x6.4). Distinct from L13 (a two-step ascent):
  // L14 is a single long far-goal run. Probed 2026-07-11 (W3).
  {
    id: 'ch1-l14',
    design: 'spire-crown/tier/L: 棘谷の中央尖塔（頂1.55）を越え、上段を長く走って遠い高ゴールへ（無線は塔で切れ棘床へ落ちる）— fun_cards_v6 ch1-l14 (round-8, W3)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.8), p(2.9, -5.8), p(2.7, 0.4), p(3.6, 0.4), p(4.2, 0.9), p(9, 0.9)), // deep pit → long rising far tier
      pillar(0, 1.55, -5.8, 0.45, 0.8), // central spire crown (rim+1.15) — clips every chord
    ],
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.4, 0.9, 1, 2),
    killY: -12,
    coins: coinCount(6),
    dangerZones: [{ x: -2.6, y: -5.2, width: 5.2, height: 0.9, style: 'spike' }], // spike floor (idle + every clip-fall)
    strokes: [
      {
        kind: 'any',
        role: 'spire-trapezoid-run',
        points: [p(-3.2, 0.4), ...spline([p(-2.7, 0.42), p(-1.2, 1.35), p(-0.5, 1.55), p(0.5, 1.55), p(1.2, 1.35), p(2.7, 0.42)]), p(3.2, 0.4)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-3.2, 0.4), ...spline([p(-2.7, 0.42), p(-1.2, 1.35), p(-0.5, 1.55), p(0.5, 1.55), p(1.2, 1.35), p(2.7, 0.42)]), p(3.2, 0.4)] },
      { shapeTag: 'angle', points: [p(-3.2, 0.4), p(-2.7, 0.42), p(0, 1.7), p(2.7, 0.42), p(3.2, 0.4)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L15 (round-8 REDESIGN, fun_cards_v6 ch1-l15 双子谷の中央尖峰) — twin-valley peak.
  // A wide deep valley (rims y0.4, floor -5.2) split by a central PEAK: a narrow
  // SPIKE zone at rim height (top 0.6 = rim+0.2, L10-scaled). Every flat rim /
  // spawn-goal chord drives its car (y0.4) into the crown and dies; the idle car
  // coasts off the rim and impales on the same spike (S0: a flat line self-supports
  // the 6 m gap, so the geometric spike — not sag — does the kill). Two low support
  // pillars (top 0.05) sit near the valley floor at x±1.9. The intended rounded
  // M-SAG drapes on the pillars and crosses the spike overhead at crest 1.3; the
  // up-bow ARCH (bow1.0) bows over it. Both keep the tilted car's nose above 0.6
  // (W3-measured: the nose dips to ~0.7 near the apex — a 1.0 crown / terrain nub
  // both tipped or grazed the car, so the crown sits low). CARD DEVIATION (W3): the
  // card's separate LEFT-valley boulder is FOLDED INTO this central spike — the idle
  // car is a projectile that flies ~3 m over the pit and impales on the spike before
  // any boulder in the pit floor could catch it (measured), so a boulder would be a
  // decorative hazard (Gate 2.6 per-hazard: every hazard must kill a naive baseline).
  // Probed 2026-07-11 (W3): sag + arch clear Lv0; Gate7 all 6 defeated; zone attributed.
  {
    id: 'ch1-l15',
    design: 'twin-peak/U/L: 載れない中央尖峰（棘頂0.6>リム0.4弦）で分断される深い谷。左右の低柱に垂らすM字か峰ごと跨ぐ高弓か（無線の平線・遊休車は峰の棘に刺さる）— fun_cards_v6 ch1-l15 (round-8, W3)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10.5, 0.4), p(-2.4, 0.4), p(-2.6, -6.5), p(2.6, -6.5), p(2.4, 0.4), p(9, 0.4)), // deep valley (4.8 m gap, floor -6.5); wide platforms meet L-tier W_win
      pillar(0, 1.35, -6.5, 0.8, 1.15), // central PEAK crown (rim+0.95) — clips every chord; wide top shortens the ridden span
    ],
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(5.9, 0.4, 1, 2),
    killY: -12.5,
    coins: coinCount(6),
    // Central PEAK (terrain crown, top 1.4) over a deep spike gorge: every flat rim /
    // spawn-goal chord CLIPS it and the car drops onto the SPIKE FLOOR; the intended
    // TRAPEZOID climbs ONTO the crown (mid-support → shove < 0.3, span < 5.5) and the ARCH
    // bows over it. W3 DEVIATION: the card's free M-SAG / 6 m arch either TIP the car or
    // over-shove (0.32-0.37 m) as the recorded ghost under the recycled-world sequence
    // (measured), so l15 adopts the robust crown-rest — the "peak divides, you go over it"
    // discovery survives. Idle + every clip-fall land on the spike floor (attribution).
    dangerZones: [{ x: -2.3, y: -6.0, width: 4.6, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'peak-trapezoid',
        points: [p(-3.0, 0.42), ...spline([p(-2.4, 0.42), p(-1.3, 1.1), p(-0.8, 1.35), p(0.8, 1.35), p(1.3, 1.1), p(2.4, 0.42)]), p(3.0, 0.42)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-3.0, 0.42), ...spline([p(-2.4, 0.42), p(-1.3, 1.1), p(-0.8, 1.35), p(0.8, 1.35), p(1.3, 1.1), p(2.4, 0.42)]), p(3.0, 0.42)] },
      { shapeTag: 'arch', points: [p(-3.0, 0.42), ...arch(-2.4, 0.42, 2.4, 0.42, 1.28), p(3.0, 0.42)] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 5 — XL tier + BOSS (the FINAL 8). This wave DELIBERATELY BREAKS from the
  // wave-4 deep-pit-sag core (l05/l06/l13/l14 shared it) so the 28-card atlas reads
  // as 28 distinct thumbnails. The NEW core for the dome-dual levels (l16/l21/l23/b5)
  // is the car RIDING A DRAWN UP-BOW ARCH: the bridge's angle-limited spring joints
  // (jointHertz 9, totalFlexBudget ~0.5-0.7 rad — TuningConstants) hold a drawn bow
  // as "a firm plank", so a compression arch settles ~0.1-0.2 m (car-path displacement
  // <0.3 m, F5-legal) instead of collapsing into a rope catenary. The falling/rolling
  // rock is a VALLEY hazard the arch's HEIGHT clears: the naive idle car drives off the
  // near rim INTO the valley and lands on the boulder (hazardContact); the ghost's arch
  // carries the car metres ABOVE it. L16/L21 are ARCH_EXEMPT (compression span >5.5 m,
  // verified non-breaking by the ghost clear + displacement, not the tension-span gate).
  //
  // The XL non-dome levels (l18/l19/l20/l22) are long MULTI-FEATURE JOURNEYS built from
  // already-shipped role skeletons (sag / catch / shield), NOT the deep-pit-sag: l19 is
  // a genuine SHAFT (縦>横, L_path ≥18 m via a deep switchback well), l20 a two-shelf S
  // over a valley island, l18/l22 descents/tiers with spike+rock compounds. Distinct
  // silhouettes: dome (∩ over valley), shaft (│ deep well), two-shelf S, tiered descent.
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // L16 (v5 slate #16, NEW id) — dome-dual / U / L · falling rock. atlas card 20
  // (守る屋根＝走る道). The dome-dual INTRODUCTION (★3, right after B4 — the sawtooth
  // valley). A firm wide UP-BOW ARCH is BOTH the road AND the roof: the car rides over
  // the deep valley while the boulder resting on the valley floor is cleared overhead.
  // ARCH_EXEMPT (compression span ~5.9 m > 5.5 m tension limit) — the ghost clear +
  // <0.3 m car-path displacement prove the arch holds, not the tension-span gate. The
  // naive idle car drives off the near rim, drops into the valley, and lands on the
  // boulder (hazardContact). Silhouette: a single tall ∩ over a U — unlike any sag.
  {
    id: 'ch1-l16',
    design: 'dome-dual/U/L: 深い谷に張った高いアーチが「屋根＝道」— 車は上を渡り谷底の岩を頭上に越える（無線は谷へ落ち岩に当たる）— v5 #16 (R14 dome)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [pl(p(-9.2, 1.0), p(-3.0, 1.0), p(-3.2, -5.6), p(3.2, -5.6), p(3.0, 1.0), p(9.2, 1.0))],
    vehicleSpawn: p(-6.2, 1.4),
    goalFlag: flag(5.6, 1.0, 1, 2),
    killY: -5,
    coins: coinCount(6),
    rocks: [{ x: 1.0, y: -5.15, radius: 0.5, density: 5 }],
    strokes: [{ kind: 'any', role: 'roof-road-dome', points: arch(-3.7, 1.02, 3.7, 1.02, 1.35) }],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L18 (v5 slate #18, NEW id) — shield-static / descent / XL · composite (spike+rock).
  // atlas card 22 (くだり覆い). A DESCENDING journey: from a high-left shelf the car ramps
  // down to a deep spike GORGE holding a boulder, crosses it on a firm covering seal, and
  // drops to a low-right goal. Compound hazard (spike-floor zone + rock). Distinct
  // descending silhouette (high→low, unlike the level domes / flat gorges).
  {
    id: 'ch1-l18',
    design: 'shield-static/descent/XL: 高い左棚から降り、岩の深い谷を覆い床で渡って低いゴールへ（無線は谷底の岩へ落ちる）— v5 #18 (R07+R04)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.8, 2.8), p(-5.2, 2.8), p(-4.0, 1.4), p(-2.7, 1.4), p(-2.9, -8.0),
        p(2.9, -8.0), p(2.7, 0.2), p(8.6, 0.2),
      ),
      pillar(0.0, 0.66, -8.0, 0.5, 0.9), // mid support splits the descending cover
    ],
    vehicleSpawn: p(-7.3, 3.15),
    goalFlag: flag(6.6, 0.2, 1, 2),
    killY: -6,
    coins: coinCount(6),
    rocks: [{ x: -1.7, y: -7.55, radius: 0.45, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'descent-cover',
        points: spline([p(-2.7, 1.42), p(-1.35, 0.94), p(0, 0.68), p(1.35, 0.46), p(2.7, 0.22)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L19 (v5 slate #19, NEW id) — sag / shaft / XL · composite (spike+rock). atlas card
  // 23 (深井戸の綱). THE vertical headline: a deep WELL (縦>横). The car descends a
  // switchback stair into the shaft, crosses the bottom on a firm V-sag hung over a
  // central island (clearing the spike floor + boulder below), and climbs the far wall
  // out to the goal. The LONGEST course (L_path ≥18 m per plan) — distinct │ shaft
  // silhouette, unlike every flat/valley crossing.
  {
    id: 'ch1-l19',
    design: 'sag/shaft/XL: 深い井戸へ坂を降り、中州に載せた張り綱で底の岩を浅く渡り、対岸の坂を登って出る（無線は井戸底の岩へ落ちる）— v5 #19 (R03-deep 竪穴)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-10.4, 3.2), p(-7.4, 3.2),
        p(-2.7, 0.2), p(-2.9, -7.4),
        p(2.9, -7.4), p(2.7, 0.2),
        p(7.4, 3.2), p(10.4, 3.2),
      ),
      pillar(0.0, -0.35, -7.4, 0.9, 1.15), // firm central island the crossing rests on (idle still falls past)
    ],
    vehicleSpawn: p(-8.2, 3.55),
    goalFlag: flag(8.0, 3.2, 1, 2),
    killY: -6,
    coins: coinCount(7),
    rocks: [{ x: -2.0, y: -7.0, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'shaft-crossing',
        points: spline([p(-2.7, 0.2), p(-1.35, -0.3), p(0, -0.35), p(1.35, -0.3), p(2.7, 0.2)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L20 (v5 slate #20, NEW id) — catch-redirect / S / XL · rolling rock. atlas card 24
  // (併走の抜け道). A two-shelf S: the car dips down into a valley on a scoop, crosses
  // the bottom past a boulder (deep enough to time it out of the rolling rock's lane),
  // and re-ascends the far shelf — an S-glide. Distinct sweeping-S silhouette.
  {
    id: 'ch1-l20',
    design: 'catch-redirect/U/XL: 深い谷を受け皿U弧で渡り、谷底の岩をやり過ごして対岸へ（無線は谷底の岩へ落ちる）— v5 #20 (R13 受け流し)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-10.0, 2.2), p(-3.4, 2.2), p(-3.6, -6.8), p(3.6, -6.8), p(3.4, 2.2), p(10.0, 2.2),
      ),
      pillar(0.0, 1.05, -6.8, 0.6, 1.0), // high central island — a SHALLOW firm catch (l10-scaled)
    ],
    vehicleSpawn: p(-7.2, 2.55),
    goalFlag: flag(6.4, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(7),
    rocks: [{ x: 1.7, y: -6.35, radius: 0.45, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'u-catch-island',
        points: spline([p(-3.4, 2.2), p(-1.8, 1.35), p(0, 1.05), p(1.8, 1.35), p(3.4, 2.2)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L21 (v5 slate #21, NEW id) — dome-dual / climb / XL · falling rock. atlas card 25
  // (そびえるアーチ). A TOWERING asymmetric arch that BOTH shields the boulder AND
  // climbs from the low-left shelf to a high-right goal (+1.8 m). ARCH_EXEMPT
  // (compression span ~6.0 m). The car rides the rising arch; the naive car drops into
  // the wide valley onto the boulder. Silhouette: an ascending ∩ (vs L16's level ∩).
  {
    id: 'ch1-l21',
    design: 'dome-dual/climb/XL: 谷にそびえる高いアーチ＝屋根＝道を渡り、右の坂を登って高台ゴールへ、谷底の岩を頭上に越える（無線は谷へ落ち岩に当たる）— v5 #21 (R01 arch)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.4, 0.9), p(-3.1, 0.9), p(-3.3, -7.2), p(3.3, -7.2), p(3.1, 0.9),
        p(4.2, 0.9), p(5.2, 1.5), p(6.3, 1.5), p(7.3, 2.1), p(10.0, 2.1),
      ),
    ],
    vehicleSpawn: p(-6.5, 1.25),
    goalFlag: flag(7.7, 2.1, 1, 2),
    killY: -6,
    coins: coinCount(6),
    rocks: [{ x: 0.9, y: -6.75, radius: 0.5, density: 5 }],
    strokes: [{ kind: 'any', role: 'tower-arch', points: arch(-3.7, 0.92, 3.7, 0.92, 1.3) }],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L22 (v5 slate #22, NEW id) — catch-redirect / tier / XL · composite (spike+rock).
  // atlas card 26 (段の受け流し). Cross a deep spike-GORGE holding a boulder on a firm
  // covering arch, THEN climb terrain tiers to a high goal. Compound: the naive straight
  // sags into the spike floor while the idle car drops onto the boulder. Distinct tiered
  // ascent silhouette (arch-cross then stair-climb).
  {
    id: 'ch1-l22',
    design: 'catch-redirect/tier/XL: 棘の深い谷を覆いアーチで受け流し、段々を登って高台ゴールへ（無線は谷の棘へ沈む）— v5 #22 (R12+R13)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.8, 0.8), p(-2.7, 0.8), p(-2.9, -6.8),
        p(2.9, -6.8), p(2.7, 0.8),
        p(3.7, 0.8), p(4.7, 1.5), p(5.9, 1.5), p(6.9, 2.2), p(10.4, 2.2),
      ),
    ],
    vehicleSpawn: p(-6.3, 1.15),
    goalFlag: flag(7.6, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(6),
    dangerZones: [{ x: -2.6, y: -6.3, width: 5.2, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'gorge-cover-arch',
        points: arch(-3.1, 0.82, 3.1, 0.82, 0.62),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L23 (v5 slate #23, BOSS, NEW id) — dome-dual / S / XL · TWO rocks (compound). atlas
  // card 27 (章ボス：試練の連なり). The chapter's hardest: a wide deep spike-GORGE holding
  // TWO boulders side by side, crossed by a firm MEANDER (M) that rides two humps over a
  // central island — the drawn line is BOTH the road AND the shield for both rocks. The
  // naive idle car drops into the gorge onto BOTH boulders (per-hazard: each rock is
  // independently attributed on the fail tick); the straight sags into the spike floor.
  // Tight ink, multi-point support (max free span ≤3 m). The convergence of every wave-5
  // mechanic: cover + dome shed + spike + climb-out.
  {
    id: 'ch1-l23',
    design: 'BOSS dome-dual/S/XL: 二つの岩を抱えた広い深谷を、そびえるアーチ＝屋根＝道で受け流して渡り、段々を登り切る — 試練の連なり（無線は谷底の二岩へ落ちる）— v5 #23 (R15=R07+R14+R05)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.8, 0.8), p(-2.7, 0.8), p(-2.9, -6.8),
        p(2.9, -6.8), p(2.7, 0.8),
        p(3.7, 0.8), p(4.7, 1.5), p(5.9, 1.5), p(6.9, 2.2), p(10.4, 2.2),
      ),
    ],
    vehicleSpawn: p(-6.3, 1.15),
    goalFlag: flag(7.6, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(7),
    rocks: [
      { x: 0.7, y: -6.42, radius: 0.35, density: 5 },
      { x: 1.4, y: -6.42, radius: 0.35, density: 5 },
    ],
    strokes: [
      {
        kind: 'any',
        role: 'boss-tower-arch',
        points: arch(-3.1, 0.82, 3.1, 0.82, 0.62),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // B5 (v5 slate, after L23) — bonus dome-dual / M / rolling rock. atlas card 28
  // (ゆるいドーム). The dome-dual PILOT: a gentle wide UP-BOW arch the car rides over a
  // deep valley; a boulder rests in the left valley where the naive car falls. Breather
  // (★2): generous ink, a broad forgiving arch. Non-AD.
  {
    id: 'ch1-b5',
    design: 'dome-dual/M/rolling: 高い左から低い右へ降りる緩ドームで谷の転石を頭上に越える（無線は谷へ落ち石に当たる）— v5 #B5 (R01-lite Draw Line arch)',
    inkFeel: 'generous',
    bonusMultiplier: 5,
    gimmickTags: [],
    terrain: [pl(p(-9.0, 1.3), p(-2.3, 1.3), p(-2.5, -5.7), p(2.5, -5.7), p(2.3, 0.3), p(9.0, 0.3))],
    vehicleSpawn: p(-5.9, 1.65),
    goalFlag: flag(5.5, 0.3, 1, 2),
    killY: -5,
    coins: coinCount(7),
    rocks: [{ x: 0.9, y: -5.25, radius: 0.45, density: 5 }],
    strokes: [{ kind: 'any', role: 'descent-dome', points: arch(-3.0, 1.32, 3.0, 0.32, 1.0) }],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

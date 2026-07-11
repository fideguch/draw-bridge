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
  // L4 (v5 slate #4) — viaduct / flat / M · WIDE spike gorge (ENGINE ADAPTATION of the
  // atlas "ramp-jump" card 4). The card wants a BALLISTIC launch off a drawn ramp; that
  // is NOT robustly feasible in this chain engine — a drawn launch ramp over the pit is
  // a cantilever that sags away (the car never engages it), and even a nub-supported
  // ramp only launches the car ~3.5 m and lands it chaotically (tipOver / bounce-into-
  // spikes), far below the fuzz-robustness bar (measured across ~15 configs, wave-3.5).
  // Realized instead as a WIDE 3-PILLAR VIADUCT over a deep spike gorge (7.8 m): the
  // naive no-line car drives off the rim and FALLS into the spikes, while a rippled
  // multi-arch deck strung across the THREE pillars carries the car over the teeth in
  // four short ≤2.2 m spans. A distinct "many-legged viaduct" silhouette — set apart
  // from L10's single sag, L8's twin-seal W, and L12's descending staircase.
  {
    id: 'ch1-l04',
    design: 'viaduct/flat/M: 深く広い棘の谷を、三本柱で四分割した波形高架でまとめて渡る（無線の直進は棘へ落ちる）— v5 #4 (R10→multi-pillar viaduct 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.0, 0.8), p(-4.0, 0.8), p(-4.2, -5.5)), // left rim y0.8
      pillar(-2.2, 0.55, -5.5, 0.4, 0.75), // viaduct pillar 1
      pillar(0.0, 0.55, -5.5, 0.4, 0.75), // viaduct pillar 2
      pillar(2.2, 0.55, -5.5, 0.4, 0.75), // viaduct pillar 3
      pl(p(4.2, -5.5), p(4.0, 0.8), p(9.0, 0.8)), // right rim y0.8
    ],
    vehicleSpawn: p(-6.2, 1.15),
    goalFlag: flag(6.0, 0.8, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -3.9, y: -3.2, width: 7.8, height: 0.9, style: 'spike' }], // wide deep spike gorge
    strokes: [
      {
        kind: 'any',
        role: 'spike-viaduct',
        points: spline([p(-4.0, 0.78), p(-2.2, 0.5), p(0.0, 0.5), p(2.2, 0.5), p(4.0, 0.78)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L8 (v5 slate #8) — double-seal / flat / L · danger zone. atlas card 10 (危険帯を跨ぐ床).
  // A WIDE deep zone band crossed by a TWO-pillar seal — a gentle double-dip deck (two
  // support pillars → three seams). Distinct from L10's SINGLE-pillar sag (one dip) and
  // L4's THREE-pillar spike viaduct: the wave-3.5 fix spreads L8/L10/L12 across pillar
  // counts + hazard styles instead of one shared sag. A W-deck that CLIMBS a mid-platform
  // was tried first but is fuzz-fragile (the car tips on the climb, 2-6/24); this gentle
  // 2-pillar seal is robust (20/24). The idle no-line car drops off the rim into the deep
  // zone; the seal rests on both pillars and carries the car across with zero contact.
  {
    id: 'ch1-l08',
    design: 'double-seal/flat/L: 広く深い赤帯の谷を、二本柱に載せた緩い二段の床で塞いで渡る（無線の直進は帯へ落ちる）— v5 #8 (R08 two-pillar seal)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0.9), p(-3.7, 0.9), p(-3.9, -5.8)), // left rim y0.9
      pillar(-1.9, 0.68, -5.8, 0.55, 0.9), // seal pillar 1 (spread wide, out of the naive fall path)
      pillar(1.9, 0.68, -5.8, 0.55, 0.9), // seal pillar 2
      pl(p(3.9, -5.8), p(3.7, 0.9), p(9.5, 0.9)), // right rim y0.9
    ],
    vehicleSpawn: p(-6.4, 1.25),
    goalFlag: flag(6.6, 0.9, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -3.6, y: -4.6, width: 7.2, height: 0.9, style: 'zone' }], // wide deep zone band
    strokes: [
      {
        kind: 'any',
        role: 'double-seal',
        points: spline([p(-3.7, 0.9), p(-2.6, 0.66), p(-1.9, 0.62), p(0.0, 0.72), p(1.9, 0.62), p(2.6, 0.66), p(3.7, 0.9)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L9 (v5 slate #9) — hook / tier / M · spike floor (ENGINE ADAPTATION of the atlas
  // "ceiling spike" card 11). The design wants the car to DUCK under ceiling
  // stalactites over a gap. That is physically infeasible with this engine's car:
  // to duck low enough the car must drop into a gap-valley, and the drop bounces the
  // 0.8 m-tall chassis straight back UP into the ceiling teeth; a gentle descent
  // keeps the car high (its 0.9 m-lead front wheel reaches the teeth before it sinks)
  // and the naive rim-to-rim straight always bridges at LOW gap-rim height, so no
  // baseline can attribute a ceiling hazard (the idle car FALLS, away from the roof).
  // Realized instead as a hook/tier over a SPIKE FLOOR: the naive no-line car drives
  // off the low-left rim and FALLS into the spikes (hazard-relevant); the ghost hooks
  // a firm rising bridge from the low-left shelf up to the high-right, held above the
  // deep spike floor across a ≤5.5 m span.
  {
    id: 'ch1-l09',
    design: 'hook/tier/M: 低い左棚から高い右棚へ、棘の谷を一本のフック橋で跨いで登る — v5 #9 (R16 hook, spike-floor 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.0, 0.9), p(-2.3, 0.9), p(-2.5, -5.0)),
      pillar(0.0, 0.95, -5.0, 0.9, 1.3),
      pl(p(2.3, -5.0), p(2.5, 1.4), p(9.0, 1.4)),
    ],
    vehicleSpawn: p(-6.3, 1.25),
    goalFlag: flag(5.9, 1.4, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -2.1, y: -4.5, width: 4.6, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'hook-climb',
        points: spline([p(-2.3, 0.9), p(-1.1, 0.92), p(0.0, 0.95), p(1.1, 1.12), p(2.3, 1.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L10 (v5 slate #10) — sag / U / L · spike floor. atlas card 12 (棘谷の綱渡り).
  // A deep canyon with a spike FLOOR at the bottom. REALIZATION: the naive no-line
  // car drives off the rim and FALLS into the spikes; an over-sagged low line dips
  // toward them too. The ghost strings a firm up-bow TAUT across the 5.4 m gap
  // (≤5.5) so the settled line holds high above the spikes and the car crosses.
  {
    id: 'ch1-l10',
    design: 'sag/U/L: 棘の底と中央尖塔をもつ深峡谷に、中州で二分割した張り線を渡す — v5 #10 (R03 sag-rope-over-hazard)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-8, 0.8), p(-2.7, 0.8), p(-2.9, -5.2)),
      pillar(0.0, 0.45, -5.2, 0.5, 0.9),
      pl(p(2.5, -5.2), p(2.7, 0.8), p(8.5, 0.8)),
    ],
    vehicleSpawn: p(-5.8, 1.15),
    goalFlag: flag(5.6, 0.8, 1, 2),
    killY: -11,
    coins: coinCount(5),
    dangerZones: [{ x: -2.5, y: -4.4, width: 5.0, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'sag-over-spikes',
        points: spline([p(-2.7, 0.8), p(-1.35, 0.5), p(0.0, 0.45), p(1.35, 0.5), p(2.7, 0.8)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L12 (v5 slate #12) — descent / tier / L · danger zone. atlas card 15 (降下シャフト).
  // A DESCENDING wide zone-valley: the left rim (y+1.6) steps down across two descending
  // pillars (y+0.7 → y-0.1) to a low-right goal (y-0.6). The drawn deck STEPS DOWN
  // left-to-right — a diagonal descent silhouette distinct from L10's flat single sag
  // and L8's level double-seal. NOW LEGAL under the wave-3.5 gate fix: the high-left rim
  // rising above the spawn→goal chord no longer reads as one giant unsupported span —
  // the metric measures the drawn line's free spans (short pillar-to-pillar steps), and
  // the terrain tier is irrelevant except where the deck rests on it. A true stepped
  // descent (a drawn shaft free-falls; the naive car on a modest descent just rolls
  // through) is realized as a WIDE deep-zone valley: the idle car drops off the rim into
  // the deep band (it cannot cross the wide gap), while the descending deck carries the
  // car down over it (fuzz 23/24, ridden shove 0.23 m ≤ 0.3 m).
  {
    id: 'ch1-l12',
    design: 'descent/tier/L: 高い左リムから低い右ゴールへ、深い赤帯の広谷を降りる二段の階段床（無線は谷底の帯へ落ちる）— v5 #12 (R02 descending seal)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.8, 1.6), p(-3.7, 1.6), p(-3.9, -6.0)), // high-left rim y1.6 (descent start)
      pillar(-1.9, 0.7, -6.0, 0.45, 0.8), // descending pillar 1 (higher)
      pillar(1.9, -0.1, -6.0, 0.45, 0.8), // descending pillar 2 (lower)
      pl(p(3.9, -6.0), p(3.7, -0.6), p(10.4, -0.6)), // low-right goal platform y-0.6
    ],
    vehicleSpawn: p(-6.6, 1.95),
    goalFlag: flag(6.0, -0.6, 1, 2),
    killY: -12,
    coins: coinCount(6),
    dangerZones: [{ x: -3.6, y: -4.6, width: 7.2, height: 0.9, style: 'zone' }], // wide deep valley band
    strokes: [
      {
        kind: 'any',
        role: 'descending-seal',
        points: spline([
          p(-3.7, 1.6), p(-2.7, 1.15), p(-1.9, 0.7), p(0.0, 0.35), p(1.9, -0.1), p(2.7, -0.35), p(3.7, -0.6),
        ]),
      },
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
  // L5 (v5 slate #5) — shield-static / flat / M · falling rock. atlas card 6
  // (落石よけの屋根). Flat deep pit, mid-pillar sag; the idle car crosses and drops off
  // the far rim onto the boulder on the ledge. The ghost's firm sag carries the car
  // over. Flat silhouette.
  {
    id: 'ch1-l05',
    design: 'shield-static/flat/M: 深い谷を中州柱の張り床で渡り、谷の岩を頭上に越える（無線は谷へ落ち岩に当たる）— v5 #5 (R04 落石よけ→ deep-pit rock-ledge 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.2), p(2.9, -5.2), p(2.7, 0.4), p(6.8, 0.4)),
      pillar(0, 0.1, -5.2, 0.5, 0.9),
      pl(p(1.5, -5.2), p(1.6, -2.4), p(2.6, -2.4), p(2.7, -5.2)),
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(4.2, 0.4, 1, 2),
    killY: -11,
    coins: coinCount(5),
    rocks: [{ x: 2.2, y: -1.95, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'pit-sag-flat',
        points: spline([p(-2.7, 0.4), p(-1.35, 0.14), p(0, 0.08), p(1.35, 0.14), p(2.7, 0.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L6 (v5 slate #6) — shield-dynamic / climb / M · rolling rock. atlas card 7
  // (転がり石の壁). Same deep-pit sag but the far platform RAMPS UP to a raised goal
  // (+1.0 m): the idle car crosses, drops onto the boulder; the ghost crosses and
  // climbs the terrain ramp to the high goal. Ascending silhouette (vs L5 flat).
  {
    id: 'ch1-l06',
    design: 'shield-dynamic/climb/M: 深い谷を渡り高い右棚へ登る、谷の岩を頭上に越える（無線は谷へ落ち岩に当たる）— v5 #6 (R05 転石の壁→ deep-pit + climb 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.2), p(2.9, -5.2), p(2.7, 0.4), p(4.4, 0.4), p(5.4, 1.0), p(9, 1.0)),
      pillar(0, 0.1, -5.2, 0.5, 0.9),
      pl(p(1.5, -5.2), p(1.6, -2.4), p(2.6, -2.4), p(2.7, -5.2)),
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(6.2, 1.0, 1, 2),
    killY: -11,
    coins: coinCount(5),
    rocks: [{ x: 2.2, y: -1.95, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'pit-sag-climb',
        points: spline([p(-2.7, 0.4), p(-1.35, 0.14), p(0, 0.08), p(1.35, 0.14), p(2.7, 0.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L7 (v5 slate #7) — catch-redirect / descent / L · rolling rock. atlas card 8
  // (そらしランプ). Spawn on a HIGH-left shelf (+1.4 m), a terrain down-ramp to the
  // deep pit, the boulder on the ledge, then across to the low goal. The idle car
  // rolls down and drops onto the boulder; the ghost's sag carries it over.
  // Descending silhouette. L size (long course, tall drop).
  {
    id: 'ch1-l07',
    design: 'catch-redirect/descent/L: 高い左棚から降りて深い谷を渡り、谷の岩を頭上に越える（無線は谷へ落ち岩に当たる）— v5 #7 (R06 逸らし→ deep-pit + descent 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 1.1), p(-5.4, 1.1), p(-3.7, 0.4), p(-2.7, 0.4), p(-2.9, -5.2), p(2.9, -5.2), p(2.7, 0.4), p(7.4, 0.4)),
      pillar(0, 0.1, -5.2, 0.5, 0.9),
      pl(p(1.5, -5.2), p(1.6, -2.4), p(2.6, -2.4), p(2.7, -5.2)),
    ],
    vehicleSpawn: p(-6.8, 1.45),
    goalFlag: flag(5.0, 0.4, 1, 2),
    killY: -11,
    coins: coinCount(6),
    rocks: [{ x: 2.2, y: -1.95, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'pit-sag-descent',
        points: spline([p(-2.7, 0.4), p(-1.35, 0.14), p(0, 0.08), p(1.35, 0.14), p(2.7, 0.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L11 (v5 slate #11, NEW id) — shield-static / tier / L · ceiling spike. atlas card
  // 13 (天井覆いの橋). Ceiling stalactites cannot be ATTRIBUTED to a naive baseline
  // (the shipped L9 hit the same wall → spike floor). Realized as a WIDE deep spike
  // GORGE crossed by a firm covering DECK on a central pillar: the idle car drops off
  // the rim into the spikes (hazardContact zone); the ghost's flat seal covers the
  // gorge in two ≤3 m spans. Distinct from L10's narrow taut sag (mid-pillar seal,
  // wider gorge). NO rock — the composite's spike half.
  {
    id: 'ch1-l11',
    design: 'shield-static/tier/L: 広く深い棘の谷を、中州柱に載せた覆い床でまとめて跨ぐ（無線は棘へ落ちる）— v5 #11 (R07 天井覆い→ wide spike-gorge seal 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.6), p(-2.6, 0.6), p(-2.8, -5.4), p(2.8, -5.4), p(2.6, 0.6), p(8.1, 0.6)),
      pillar(0, 0.42, -5.4, 0.7, 1.2),
    ],
    vehicleSpawn: p(-6.3, 0.95),
    goalFlag: flag(5.6, 0.6, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -2.6, y: -4.9, width: 5.2, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'spike-gorge-seal',
        points: spline([p(-2.6, 0.6), p(-1.3, 0.48), p(0, 0.44), p(1.3, 0.48), p(2.6, 0.6)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L13 (v5 slate #13) — ramp-jump / climb / L · composite (spike+rock). atlas card
  // 16 (連続ジャンプ台). The ballistic double-jump is infeasible (wave-3.5 finding);
  // realized as its non-ballistic alternative — the deep-pit rock cross, then a
  // TWO-STEP terrain climb to a high goal (+1.8 m). The idle car drops onto the
  // boulder; the ghost crosses and climbs the two tiers. Distinct stepped-ascent.
  {
    id: 'ch1-l13',
    design: 'ramp-jump/climb/L: 岩の谷を渡り、二段の棚を登って高台へ（無線は谷へ落ち岩に当たる／跳躍不可の非弾道化）— v5 #13 (R10 連続ジャンプ→ deep-pit + two-step 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.6), p(2.9, -5.6), p(2.7, 0.4),
        p(3.8, 0.4), p(4.7, 0.9), p(5.5, 0.9), p(6.4, 1.4), p(9.5, 1.4),
      ),
      pillar(0, 0.1, -5.6, 0.5, 0.9),
      pl(p(1.5, -5.6), p(1.6, -2.4), p(2.6, -2.4), p(2.7, -5.6)),
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(7.0, 1.4, 1, 2),
    killY: -11,
    coins: coinCount(6),
    rocks: [{ x: 2.2, y: -1.95, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'pit-sag-two-step',
        points: spline([p(-2.7, 0.4), p(-1.35, 0.14), p(0, 0.08), p(1.35, 0.14), p(2.7, 0.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L14 (v5 slate #14) — shield-dynamic timed / tier / L · rolling rock. atlas card
  // 17 (時限：来るぞ). The deep-pit rock cross near spawn, then a LONG upper-tier run
  // to a RAISED far goal (+0.6 m, x6.6). The idle car drops onto the boulder; the
  // ghost crosses and runs the tier to the distant goal. Far-goal tier silhouette.
  {
    id: 'ch1-l14',
    design: 'shield-dynamic/tier/L: 手前の深い谷の岩を越え、上段を長く走って遠い高ゴールへ（無線は谷へ落ち岩に当たる）— v5 #14 (R11 時限盾→ deep-pit + far-goal tier 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.7, 0.4), p(-2.9, -5.8), p(2.9, -5.8), p(2.7, 0.4), p(3.6, 0.4), p(4.2, 0.9), p(9, 0.9)),
      pillar(0, 0.1, -5.8, 0.5, 0.9),
      pl(p(1.5, -5.8), p(1.6, -2.4), p(2.6, -2.4), p(2.7, -5.8)),
    ],
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.6, 0.9, 1, 2),
    killY: -12,
    coins: coinCount(6),
    rocks: [{ x: 2.2, y: -1.95, radius: 0.5, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'pit-sag-far-tier',
        points: spline([p(-2.7, 0.4), p(-1.35, 0.14), p(0, 0.08), p(1.35, 0.14), p(2.7, 0.4)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L15 (v5 slate #15) — catch+seal composite / U / L · composite. atlas card 18
  // (受けて塞ぐ谷). TWIN deep pits split by a central island; the boulder rests on a
  // ledge in the LEFT pit. The idle car crosses the first pillar and drops onto the
  // boulder; the ghost's continuous M-seal spans BOTH pits (resting on the two
  // pillars + island → firm) over the boulder. Distinct twin-pit M silhouette.
  {
    id: 'ch1-l15',
    design: 'catch+seal/U/L: 二つの深い谷をM字の連続床で渡り、左谷の岩を頭上に越える（無線は左谷へ落ち岩に当たる）— v5 #15 (R12+R08 受けて塞ぐ→ twin deep-pit M-seal 化)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9, 0.4), p(-3.6, 0.4), p(-3.8, -5.2), p(-0.4, -5.2), p(-0.2, 0.4), p(0.2, 0.4),
        p(0.4, -5.2), p(3.8, -5.2), p(3.6, 0.4), p(7, 0.4),
      ),
      pillar(-2.0, 0.1, -5.2, 0.45, 0.8),
      pillar(2.0, 0.1, -5.2, 0.45, 0.8),
      pl(p(-1.3, -5.2), p(-1.2, -2.4), p(-0.5, -2.4), p(-0.4, -5.2)),
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(4.6, 0.4, 1, 2),
    killY: -11,
    coins: coinCount(6),
    rocks: [{ x: -0.8, y: -1.95, radius: 0.48, density: 5 }],
    strokes: [
      {
        kind: 'any',
        role: 'twin-pit-m-seal',
        points: spline([
          p(-3.6, 0.4), p(-2.7, 0.14), p(-2.0, 0.08), p(-1.0, 0.24), p(0, 0.3), p(1.0, 0.24), p(2.0, 0.08), p(2.7, 0.14), p(3.6, 0.4),
        ]),
      },
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

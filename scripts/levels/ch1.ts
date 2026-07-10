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

import type { DangerZone, GimmickTag, Point, Polyline, Rect, Rock } from '../../src/engine/level/LevelSchema';
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
  // L4 (v5 slate #4) — ramp-jump / M · spike ridge (ENGINE ADAPTATION of the atlas
  // "spike floor jump" card 4). A drawn launch RAMP is a cantilever: it sags under the
  // car instead of kicking it, so a true ballistic jump won't commit; and a downhill
  // drive-off naturally arcs onto the far platform ABOVE any pit spikes (they never
  // bite). Realized instead as an ARC OVER a spike RIDGE that pokes up between two
  // rims: a naive flat road drives the car straight into the ridge (hazard-relevant),
  // while a firm drawn HUMP carries the car up and over the teeth. 3.6 m span holds
  // as a compression arch (no mid-support), the deep chasm supplies the M vertical.
  {
    id: 'ch1-l04',
    design: 'ramp-jump/M: 深い棘の谷に、二柱で三分割した張り線を渡して越える（平線は塞げず棘へ落ちる）— v5 #4 (R10, multi-seal-over-spikes 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-8.0, 0.6), p(-2.7, 0.6), p(-2.9, -5.5)),
      pillar(-1.1, 0.42, -5.5, 0.45, 0.8),
      pillar(1.1, 0.42, -5.5, 0.45, 0.8),
      pl(p(2.5, -5.5), p(2.7, 0.6), p(8.0, 0.6)),
    ],
    vehicleSpawn: p(-5.8, 0.95),
    goalFlag: flag(5.4, 0.6, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -2.5, y: -4.6, width: 5.0, height: 0.9, style: 'spike' }],
    strokes: [
      {
        kind: 'any',
        role: 'multi-seal-over-spikes',
        points: spline([p(-2.7, 0.6), p(-1.9, 0.4), p(-1.1, 0.42), p(0.0, 0.32), p(1.1, 0.42), p(1.9, 0.4), p(2.7, 0.6)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L8 (v5 slate #8) — seal / flat / L · danger zone (deep-floor band). atlas card 10.
  // REALIZATION (robust convergence with L10): a high-road over a mid-valley zone can't
  // be attributed (the naive straight snaps before the middle) and its unsupported ridden
  // spans over the pit both SAG >0.3 m (line-displacement F5) and are jitter-fragile. So
  // the DangerZone is a DEEP floor band (like L10's spike floor), attributed by the idle
  // no-line car falling straight into it; the ghost is a firm sag resting on a central
  // pillar (two ≤2.7 m sub-spans — anchored, low-shove, fuzz-robust). L8/L10/L12 share
  // this "sag on a mid-pillar over a deep floor hazard" skeleton (zone vs spike style).
  {
    id: 'ch1-l08',
    design: 'seal/flat/L: 深い床の危険帯を、中央支柱に張った線でまたいで渡る（無線の直進は帯へ落ちる）— v5 #8 (R08 + DangerZone, deep-floor 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0.8), p(-2.7, 0.8), p(-2.9, -5.5)),
      pillar(0.0, 0.5, -5.5, 0.5, 0.9),
      pl(p(2.7, -5.5), p(2.9, 0.8), p(9.5, 0.8)),
    ],
    vehicleSpawn: p(-6.4, 1.15),
    goalFlag: flag(6.2, 0.8, 1, 2),
    killY: -12,
    coins: coinCount(5),
    dangerZones: [{ x: -2.5, y: -4.4, width: 5.0, height: 0.9, style: 'zone' }],
    strokes: [
      {
        kind: 'any',
        role: 'seal-over-zone',
        points: spline([p(-2.7, 0.8), p(-1.35, 0.52), p(0.0, 0.46), p(1.35, 0.52), p(2.7, 0.8)]),
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
  // L12 (v5 slate #12) — hook / shaft / L · danger zone (deep-floor band). atlas card 15.
  // REALIZATION: a drawn vertical-shaft descent is undriveable (the car free-falls /
  // overshoots) AND the unsupported-span metric flags every stepped descent as one giant
  // span (high terrain reads as above the straight spawn→goal line). A high-road over a
  // pit-zone also sags past the F5 displacement limit. So — like L8/L10 — the DangerZone
  // is a DEEP floor band the idle no-line car falls straight into, and the ghost is a
  // firm sag on a central pillar (two ≤2.7 m anchored sub-spans; low-shove, fuzz-robust).
  {
    id: 'ch1-l12',
    design: 'hook/shaft/L: 深い床の赤帯を、中央支柱に張った線でまたいで渡る（無線の直進は帯へ落ちる）— v5 #12 (R02, deep-floor 化)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0.8), p(-2.7, 0.8), p(-2.9, -5.5)),
      pillar(0.0, 0.45, -5.5, 0.5, 0.9),
      pl(p(2.7, -5.5), p(2.9, 0.8), p(9.5, 0.8)),
    ],
    vehicleSpawn: p(-5.9, 1.15),
    goalFlag: flag(5.8, 0.8, 1, 2),
    killY: -12,
    coins: coinCount(6),
    dangerZones: [{ x: -2.5, y: -4.4, width: 5.0, height: 0.9, style: 'zone' }],
    strokes: [
      {
        kind: 'any',
        role: 'wall-zone-sag',
        points: spline([p(-2.7, 0.8), p(-1.35, 0.5), p(0.0, 0.45), p(1.35, 0.5), p(2.7, 0.8)]),
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
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

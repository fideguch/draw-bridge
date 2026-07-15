/**
 * Chapter 1 declarative level sources.
 *
 * ROUND-9 (CS-4a): levels ch1-l01 .. ch1-l12 were rewritten as schemaVersion 2
 * and moved to ./ch1-levels-01-12.ts (spread into CH1_SOURCES below). THIS FILE
 * now holds only the v1 LEGACY blocks — the 5 bonuses (b1-b5) and l13-l23 (round-8
 * designs kept loadable this wave, rewritten in CS-4b/4c). Do not redesign the
 * legacy blocks: they regenerate to their committed JSON. (l14-l23 ghost SAMPLES
 * drift sub-mm when l01-l12 change — a consequence of the shared recycled-world
 * RECORD sequence — but the geometry is unchanged and every gate stays green.)
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
  ceiling,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // v1 LEGACY (round-8 designs; kept loadable this wave, rewritten in CS-4b/4c).
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

  // L17 (v5 slate #17, NEW id) — spire-over canyon / S / XL · spike floor. atlas card 21.
  // W4 DEVIATION (measured): the card's 鍾乳幕 (spikeDown membrane) is the l05 failure mode —
  // the tall car dipping to a peg (1.3) still reaches car-top ~2.9 at the membrane's entrance,
  // IDENTICAL to the flat naive there, so no membrane bottom separates them (they diverge only
  // AFTER the dip; measured ~0.15-0.20 m car-top gap < the card's 0.25 target). No spike (clips
  // both) or ceiling (blocks the tall car) can separate a line that dips BELOW the flat.
  // Per the card's own fallback, realized as a spire-OVER: a central rock SPIRE (tip 2.7, above
  // even the sloped spawn-goal ~2.1) clips every flat chord into the spike floor; the arch/
  // trapezoid (solutions[]) pass over. ARCH_EXEMPT (~6.4 m). Deep canyon supplies the XL vertical.
  {
    id: 'ch1-l17',
    design: 'spire-canyon/S/XL: 棘の深い峡谷の中央にそびえる岩尖塔(頂2.7)を、高い左棚から低い右棚へ弓/台形で頭上に越えて渡る。素直な平線は尖塔で切れ棘床へ落ちる — fun_cards_v6 ch1-l17 (round-8, W4 — 鍾乳幕はl05型で車頂分離不成立, 尖塔越えへ)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(p(-9.2, 2.4), p(-2.6, 2.4), p(-2.8, -7.5)),
      pl(p(0.4 - 1.7, -7.5), p(0.4, 2.7), p(0.4 + 1.7, -7.5)), // central rock SPIRE (was spike(0.4,2.7,-7.5,1.7); inlined round-9 after AC-4 spike-helper removal — arithmetic form reproduces the exact floats; v1 level unchanged, rewritten in CS-4b/4c)
      pl(p(3.4, -7.5), p(3.6, 1.8), p(10.4, 1.8)),
    ],
    vehicleSpawn: p(-6.9, 2.75),
    goalFlag: flag(7.5, 1.8, 1, 2),
    killY: -14,
    coins: coinCount(6),
    dangerZones: [{ x: -2.2, y: -3.6, width: 6.4, height: 0.8, style: 'spike' }], // spike floor (idle + every clip-fall)
    strokes: [
      {
        kind: 'any',
        role: 'spire-arch',
        points: [p(-3.0, 2.4), ...arch(-2.6, 2.42, 3.6, 1.82, 1.5), p(4.0, 1.8)],
      },
    ],
    solutions: [
      { shapeTag: 'arch', points: [p(-3.0, 2.4), ...arch(-2.6, 2.42, 3.6, 1.82, 1.5), p(4.0, 1.8)] },
      { shapeTag: 'trapezoid', points: [p(-3.0, 2.4), ...spline([p(-2.6, 2.42), p(-1.3, 3.05), p(-0.5, 3.1), p(1.3, 3.1), p(2.2, 2.7), p(3.6, 1.82)]), p(4.0, 1.8)] },
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
  // a genuine SHAFT (縦>横, L_path ≥18 m via a deep switchback well), l20 a crown-rest
  // TABLE over a deep valley, l18/l22 descents/tiers with spike+rock compounds. Distinct
  // silhouettes: dome (∩ over valley), shaft (│ deep well), tabletop crown, tiered descent.
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // L16 (v5 slate #16, NEW id) — dome-dual / U / L · falling rock. atlas card 20
  // (守る屋根＝走る道). The dome-dual INTRODUCTION (★3, right after B4). A central rock
  // SPIRE (terrain spike, tip rim+0.5) now CLIPS every low flat chord (round-8 W4: the flat
  // line self-supports the gap, so a geometric interceptor — not span — kills the lazy line);
  // the firm wide UP-BOW ARCH (or the trapezoid table, solutions[]) passes OVER the point and
  // is BOTH road AND roof. ARCH_EXEMPT (compression span ~6 m). The naive idle car is split
  // by the spire into the LEFT pit and lands on the boulder (hazardContact). Silhouette: a
  // tall ∩ crowning a central spire over a U.
  {
    id: 'ch1-l16',
    design: 'dome-dual/U/L: 深い谷の中央にそびえる岩尖塔（頂1.5）を、屋根＝道の高いアーチ/台形で頭上に越えて渡る（無線の平線は尖塔で切れ谷底の岩へ落ちる）— fun_cards_v6 ch1-l16 (round-8, W4)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.2, 1.0), p(-3.0, 1.0), p(-3.2, -5.6), p(3.2, -5.6), p(3.0, 1.0), p(9.2, 1.0)),
      pl(p(-1.2, -5.6), p(0, 1.5), p(1.2, -5.6)), // central rock SPIRE (was spike(0,1.5,-5.6,1.2); inlined round-9 after AC-4 spike-helper removal — v1 level unchanged, rewritten in CS-4b/4c)
    ],
    vehicleSpawn: p(-6.2, 1.4),
    goalFlag: flag(5.6, 1.0, 1, 2),
    killY: -5,
    coins: coinCount(6),
    rocks: [{ x: -2.0, y: -5.15, radius: 0.5, density: 5 }], // left-pit floor where the idle car (split by the spire) lands
    strokes: [{ kind: 'any', role: 'roof-road-dome', points: arch(-3.7, 1.02, 3.7, 1.02, 1.35) }],
    solutions: [
      { shapeTag: 'arch', points: arch(-3.7, 1.02, 3.7, 1.02, 1.35) },
      { shapeTag: 'trapezoid', points: [p(-3.9, 1.0), ...spline([p(-3.4, 1.02), p(-2.1, 1.72), p(-1.5, 1.72), p(1.5, 1.72), p(2.1, 1.72), p(3.4, 1.02)]), p(3.9, 1.0)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L18 (v5 slate #18, NEW id) — ink-kill descent / XL · boulder. atlas card 22 (くだり覆い).
  // round-8 W4: the COURSE is extended (spawn x-10.2, goal x7.6) so the lazy spawn→goal raw
  // (~18.5 m) exceeds budget×1.5 (16.6 m) — every lazy line is rejected insufficientInk at ALL
  // ink levels (spike-round8 S4 ink-kill, l07 sibling). Only the 5.4 m pit needs a line; the
  // terrain carries the rest. A high-left shelf ramps down to a deep pit (floor −10.5, deepened
  // for the XL H/W ratio), crossed by a firm covering seal (sag / stepped trapezoid, solutions[])
  // seated on a mid pillar, to a low-right goal. Idle car (deflected right by the pillar) lands
  // on the boulder in the pit.
  {
    id: 'ch1-l18',
    design: 'shield-static/descent/XL: 長い街道を走り、岩の深い谷をたった5.4mの覆い床で渡って低いゴールへ — 全長をなぞる保険の線はインクが尽きる（無線は谷底の岩へ落ちる）— fun_cards_v6 ch1-l18 (round-8, W4 course延長ink-kill)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-13.4, 2.8), p(-5.2, 2.8), p(-4.0, 1.4), p(-2.7, 1.4), p(-2.9, -10.5),
        p(2.9, -10.5), p(2.7, 0.2), p(10.4, 0.2),
      ),
      pillar(0.0, 0.66, -10.5, 0.5, 0.9), // mid support splits the descending cover (deep pit raises the XL H/W ratio)
    ],
    vehicleSpawn: p(-10.2, 3.15),
    goalFlag: flag(7.6, 0.2, 1, 2),
    killY: -6,
    coins: coinCount(6),
    rocks: [{ x: 1.9, y: -10.0, radius: 0.45, density: 5 }], // deep pit floor where the idle car (deflected right by the mid pillar) lands
    strokes: [
      {
        kind: 'any',
        role: 'descent-cover',
        points: spline([p(-2.7, 1.42), p(-1.35, 0.92), p(0, 0.64), p(1.35, 0.44), p(2.7, 0.22)]),
      },
    ],
    // Only the 5.4 m pit needs a line; the terrain carries the rest. Two distinct covers
    // seated on the mid pillar (spike-round8 S4: spawn-goal raw > budget×1.5 → ink-kill).
    solutions: [
      { shapeTag: 'sag', points: spline([p(-2.7, 1.42), p(-1.35, 0.92), p(0, 0.64), p(1.35, 0.44), p(2.7, 0.22)]) },
      { shapeTag: 'trapezoid', points: spline([p(-2.7, 1.42), p(-0.8, 0.68), p(0.8, 0.66), p(2.7, 0.22)]) },
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
    // Two distinct well-bottom crossings on the central island (S1/spike-round8 §l19 note:
    // 16 m rim-to-rim is un-inkable, so the shaft's puzzle is the SHAPE of the bottom deck).
    solutions: [
      { shapeTag: 'sag', points: spline([p(-2.7, 0.2), p(-1.35, -0.3), p(0, -0.35), p(1.35, -0.3), p(2.7, 0.2)]) },
      { shapeTag: 'trapezoid', points: spline([p(-2.7, 0.2), p(-1.6, -0.12), p(-0.85, -0.33), p(0.85, -0.33), p(1.6, -0.12), p(2.7, 0.2)]) },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L20 (v5 slate #20, NEW id) — tabletop crown-rest / XL · boulder. atlas card 24.
  // W4 DEVIATION (measured, spike-round8 S2b + own 2-D sweep): the card's overhead
  // drop+trigger is a KNIFE-EDGE on this terrain — over the island the rock RESTS in the
  // dip solution's path (kills it), over the open pit it falls THROUGH (kills no one), and
  // the U-dish shares the naive's spatiotemporal lane (no robust "naive dies / dip lives"
  // window at any x/trigger). The "duck-to-island" fallbacks (over-span 9 m self-supports;
  // a 0.4 m car-top overhang gap) are equally knife-edge. Per wave-notes #1 realized as the
  // ROBUST crown-rest (l13-l15 family): a central rock TABLE (top rim+0.9) every flat chord
  // clips, crossed by a deck resting on it OR a high arch bowing over. Drop + dip themes lost.
  {
    id: 'ch1-l20',
    design: 'catch-redirect/tabletop/XL: 深い谷の中央にそびえる岩卓(天3.1)へ台形の床を載せて渡るか、高い弓で越えるか。地表の平線は卓の壁で切れ谷底の岩へ落ちる — fun_cards_v6 ch1-l20 (round-8, W4 — drop/潜り皿はknife-edgeで喪失, 頑健なcrown-restへ)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-10.0, 2.2), p(-3.5, 2.2), p(-3.7, -6.8), p(3.7, -6.8), p(3.5, 2.2), p(10.0, 2.2),
      ),
      pillar(0.0, 3.1, -6.8, 0.75, 1.3), // central rock TABLE crown (rim+0.9) — every flat chord clips its wall and drops; the deck rests on top
    ],
    vehicleSpawn: p(-7.2, 2.55),
    goalFlag: flag(6.4, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(7),
    rocks: [{ x: -2.0, y: -6.35, radius: 0.45, density: 5 }], // left-pit floor where the clipped / idle car falls
    strokes: [
      {
        kind: 'any',
        role: 'tabletop-deck',
        points: [p(-4.0, 2.2), ...spline([p(-3.5, 2.22), p(-1.7, 3.1), p(-0.7, 3.15), p(0.7, 3.15), p(1.7, 3.1), p(3.5, 2.22)]), p(4.0, 2.2)],
      },
    ],
    solutions: [
      { shapeTag: 'trapezoid', points: [p(-4.0, 2.2), ...spline([p(-3.5, 2.22), p(-1.7, 3.1), p(-0.7, 3.15), p(0.7, 3.15), p(1.7, 3.1), p(3.5, 2.22)]), p(4.0, 2.2)] },
      { shapeTag: 'arch', points: [p(-4.0, 2.2), ...arch(-3.5, 2.22, 3.5, 2.22, 1.35), p(4.0, 2.2)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L21 (v5 slate #21, NEW id) — dome-dual / climb / XL · falling rock. atlas card 25
  // (そびえるアーチ). A TOWERING asymmetric arch/hook (solutions[]) over a central rock
  // SPIRE (round-8 W4: tip rim+0.8, WIDE enough that even the SLOPED spawn-goal — riding
  // high toward the +1.8 m goal — clips it, where a slim spike could not). The car rides the
  // rising arch and climbs from the low-left shelf to a high-right goal. ARCH_EXEMPT
  // (compression span ~6.4 m). The naive car is split into the left pit onto the boulder.
  // Silhouette: an ascending ∩ over a spire (vs L16's level ∩).
  {
    id: 'ch1-l21',
    design: 'dome-dual/climb/XL: 谷にそびえる岩尖塔（頂1.5）を非対称の登りアーチ/鉤で頭上に越え、右の坂を登って高台ゴールへ（無線の平線は尖塔で切れ谷底の岩へ落ちる）— fun_cards_v6 ch1-l21 (round-8, W4)',
    inkFeel: 'tight',
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.4, 0.9), p(-3.1, 0.9), p(-3.3, -7.2), p(3.3, -7.2), p(3.1, 0.9),
        p(4.2, 0.9), p(5.2, 1.5), p(6.3, 1.5), p(7.3, 2.1), p(10.0, 2.1),
      ),
      pillar(0, 2.1, -7.2, 0.5, 1.5), // round-8 W5 FIX: central rock crown (flat top 2.1, was a bare spike). Two bugs: (1) a needle spike clips the sloped rim-exact chord in only a ~0.07 m window the resampler steps over (committed CLEAN -> knife-edge clear @inkLv3 in the full run); (2) the engine SURFACE_SKIN is 0.55 m, so even a 1.7 flat top could not clip the y1.48 chords. 2.1 clears the skin over rim-exact/rim-overlap/spawn-goal (1.48-1.49 -> 0.61 m) and CLIPS them at commit; the arch/hook rest on its flat top.
    ],
    vehicleSpawn: p(-6.5, 1.25),
    goalFlag: flag(7.7, 2.1, 1, 2),
    killY: -6,
    coins: coinCount(6),
    rocks: [{ x: -2.0, y: -6.75, radius: 0.5, density: 5 }], // left-pit floor where the split idle car lands
    strokes: [{ kind: 'any', role: 'tower-arch', points: arch(-3.7, 0.92, 3.7, 0.92, 1.3) }],
    solutions: [
      { shapeTag: 'arch', points: arch(-3.7, 0.92, 3.7, 0.92, 1.3) },
      { shapeTag: 'hook', points: [p(-3.6, 0.9), ...spline([p(-3.1, 0.92), p(-1.3, 1.9), p(0.2, 2.3), p(1.7, 2.12), p(3.1, 1.0)]), p(3.6, 0.92)] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L22 (v5 slate #22, NEW id) — catch-redirect / tier / XL · composite (spike+rock).
  // atlas card 26 (段の受け流し). Cross a deep spike-GORGE holding a boulder on a firm
  // covering arch, THEN climb terrain tiers to a high goal. Compound: the naive straight
  // sags into the spike floor while the idle car drops onto the boulder. Distinct tiered
  // ascent silhouette (arch-cross then stair-climb).
  {
    id: 'ch1-l22',
    design: 'catch-redirect/tier/XL: 棘谷の岩塔を弓で頭上に越え、段々を登って高台ゴールへ — 全長をなぞる保険の線はインクが尽きる（無線の平線は谷底の棘へ落ちる）— fun_cards_v6 ch1-l22 (round-8, W5 ink-kill + spire)',
    inkFeel: 'tight',
    inkBudget: 9.8, // round-8 W5: INK-KILL (drift-insensitive — the lazy lines are rejected at COMMIT, no physics). MEASURED: every lazy raw (spawn-goal 15.87 ... rim-exact 20.25) exceeds budget*1.5 (14.7) even at max ink -> all rejected insufficientInk (spike-round8 S4, l18 sibling). A crown-supported dome is the intended cover; a tall unsupported clip-dome flipped clear<->fall under recycled-world drift, so ink is the robust straight-killer here.
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.8, 0.8), p(-2.7, 0.8), p(-2.9, -6.8),
        p(2.9, -6.8), p(2.7, 0.8),
        p(3.7, 0.8), p(4.7, 1.5), p(5.9, 1.5), p(6.9, 2.2), p(10.4, 2.2),
      ),
      pillar(0, 1.35, -6.8, 0.5, 0.85), // central rock spire (visual + MID-SUPPORT): the low dome sags onto it -> firm, low ridden shove (Gate 6). Narrow base leaves 1.85 m side-pits so the idle car still falls onto the spike floor.
    ],
    vehicleSpawn: p(-6.3, 1.15),
    goalFlag: flag(7.6, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(6),
    dangerZones: [{ x: -2.6, y: -6.3, width: 5.2, height: 3.2, style: 'spike' }], // round-8 W5: TALL band (top -3.1) — the idle car, split off the spire into the deep pit, overlaps it EARLY in the fall so it registers hazardContact before it can tumble to tipOver (drift-robust). The intended cover rides y>=0.82, never entering it.
    strokes: [
      {
        kind: 'any',
        role: 'spire-cover-arch',
        points: arch(-3.1, 0.82, 3.1, 0.82, 0.78),
      },
    ],
    // round-8 W5: the covering dome (rests on the spire) vs a flat table-deck — Gate 8.
    solutions: [
      { shapeTag: 'arch', points: arch(-3.1, 0.82, 3.1, 0.82, 0.78) },
      { shapeTag: 'trapezoid', points: [p(-3.3, 0.8), ...spline([p(-3.1, 0.82), p(-1.6, 1.2), p(-0.8, 1.5), p(0.8, 1.5), p(1.6, 1.2), p(3.1, 0.82)]), p(3.3, 0.8)] },
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
    design: 'BOSS shield/S/XL: 棘谷にそびえる章一番の高い岩塔を、一枚のドームで頭上に越えるか卓状の平天板で渡るか — 全長をなぞる保険の線はインクが尽きる（無線の平線は谷底の棘へ落ちる）— fun_cards_v6 ch1-l23 (round-8, W5 BOSS ink-kill + spire)',
    inkFeel: 'tight',
    inkBudget: 9.8, // round-8 W5 BOSS: INK-KILL (drift-insensitive). MEASURED: every lazy raw (spawn-goal 15.87 ... rim-exact 20.25) exceeds budget*1.5 (14.7) at max ink -> all rejected insufficientInk. The tall clip-dome flipped under recycled-world drift; ink is the robust straight-killer.
    gimmickTags: [],
    terrain: [
      pl(
        p(-9.8, 0.8), p(-2.7, 0.8), p(-2.9, -6.8),
        p(2.9, -6.8), p(2.7, 0.8),
        p(3.7, 0.8), p(4.7, 1.5), p(5.9, 1.5), p(6.9, 2.2), p(10.4, 2.2),
      ),
      pillar(0, 1.5, -6.8, 0.55, 0.9), // the chapter's TALLEST spire (visual + MID-SUPPORT): the low dome sags onto it -> firm, low ridden shove (Gate 6). Narrow base leaves 1.8 m side-pits so the idle car still falls onto the spike floor.
    ],
    vehicleSpawn: p(-6.3, 1.15),
    goalFlag: flag(7.6, 2.2, 1, 2),
    killY: -6,
    coins: coinCount(7),
    dangerZones: [{ x: -2.6, y: -6.3, width: 5.2, height: 3.2, style: 'spike' }], // round-8 W5 BOSS: TALL valley spike-band (top -3.1; the "谷底二岩" as a floor band — discrete rocks can't co-locate with the spire for reliable dual attribution). The split car overlaps it EARLY in the fall -> hazardContact before tipOver (drift-robust).
    strokes: [
      {
        kind: 'any',
        role: 'boss-cover-arch',
        points: arch(-3.1, 0.82, 3.1, 0.82, 0.9),
      },
    ],
    // round-8 W5 BOSS: the covering dome (rests on the tallest spire) vs a flat table-deck — Gate 8.
    solutions: [
      { shapeTag: 'arch', points: arch(-3.1, 0.82, 3.1, 0.82, 0.9) },
      { shapeTag: 'trapezoid', points: [p(-3.3, 0.8), ...spline([p(-3.1, 0.82), p(-1.7, 1.35), p(-0.85, 1.65), p(0.85, 1.65), p(1.7, 1.35), p(3.1, 0.82)]), p(3.3, 0.8)] },
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
    terrain: [
      pl(p(-9.0, 1.3), p(-2.3, 1.3), p(-2.5, -5.7), p(2.5, -5.7), p(2.3, 0.3), p(9.0, 0.3)),
      pillar(0, 1.45, -5.7, 0.4, 1.1), // round-8 W5: PEDESTAL crown (top 1.45, flat) lifting the valley rock to head height. With the 0.55 m surface-skin it must sit >0.55 m above the low/spawn-goal descent chords (y0.30-0.86) to CLIP them — 1.45 clears spawn-goal (0.86) by 0.59 m at commit; the descent-dome passes over its head.
    ],
    vehicleSpawn: p(-5.9, 1.65),
    goalFlag: flag(5.5, 0.3, 1, 2),
    killY: -5,
    coins: coinCount(7),
    dangerZones: [{ x: -2.3, y: -5.6, width: 4.6, height: 0.9, style: 'spike' }], // round-8 W5: valley floor hazard (the "台座岩" realized as a crown + floor band — a dynamic rock rolled off the pedestal and the split car did not reliably contact a floor rock; the spike-floor gives robust attribution). Any car split off the crown drops onto it.
    strokes: [{ kind: 'any', role: 'descent-dome', points: arch(-3.0, 1.32, 3.0, 0.32, 1.0) }],
    // round-8 W5: descent dome (over the head) vs stepped deck down — Gate 8.
    solutions: [
      { shapeTag: 'arch', points: arch(-3.0, 1.32, 3.0, 0.32, 1.0) },
      { shapeTag: 'trapezoid', points: [p(-3.0, 1.32), ...spline([p(-2.6, 1.4), p(-1.5, 1.62), p(-0.5, 1.62), p(0.7, 1.5), p(1.8, 1.0), p(2.6, 0.5)]), p(3.0, 0.32)] },
    ],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

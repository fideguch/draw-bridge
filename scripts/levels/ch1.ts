/**
 * Chapter 1 declarative level sources — ATLAS-FIRST DESIGN v4 (round-6 phase C).
 *
 * The design is FROZEN: designs/atlas-design.html (`LEVELS[]`) + designs/level_design_v4.md
 * are the master. THIS FILE implements those 18 cards 1:1 — terrain silhouette,
 * DangerZone rects, rock spawn/velocity per the ETA math, spawn/goal, ink policy,
 * and ghost strokes that follow each level's ANCHORING SCHEME (both ends on
 * rims/shelves/pegs — no free-floating lines). The atlas draws the SETTLED stroke;
 * these drawn strokes are shaped (arch/spline) so the engine settles them into the
 * design's drawn shape and CLEARS with every hazard live.
 *
 * Pure DATA consumed by scripts/levels/authoring.ts, which runs each candidate
 * stroke through the real engine at Lv0 (WITH rocks + dangerZones live), derives
 * the ink economy, records ghosts, auto-places coins on the driven CAR route, and
 * emits levels/<id>.json. Regeneration after a TuningConstants change = rerun authoring.
 *
 * NEW round-6 HAZARD VOCABULARY (conventions.md / UL: DangerZone / Spike):
 *   - DangerZone `dangerZones[]` = axis-aligned rect; the CAR overlapping it fails
 *     with FailCause 'hazard' (Judge). The drawn BridgeChain and rocks pass THROUGH
 *     zones freely — a zone only kills the car. kinds: zone / spike / spikeDown are
 *     a VISUAL distinction in the atlas (teeth); the engine collides the base rect.
 *   - Spikes are therefore DangerZones (not solid terrain) — the anti-dominant
 *     straight-kill is carried by PIT/BANK geometry, and the zone makes a naive
 *     straight/idle car that falls into the pit die BY the hazard (欠陥4 relevance).
 *
 * GIMMICK / GATE-3 NOTE: only GAP-CROSSING levels (a straight the car would bridge)
 * carry `anti-dominant` (Gate 3 needs gap rims). Continuous-floor SHIELD levels
 * (L4/L7/L8/L13 — line is a roof/wall, road is the floor) are NOT anti-dominant;
 * their challenge is the ROCK (hazard-relevance). Sag-rope L11 uses same-height rims
 * (a taut straight IS the intended line), so it is a precision level, not AD.
 *
 * PHYSICS DISCIPLINE (measured; car occupied AABB x±0.9, top center+0.33, bottom
 * center−0.55; resting the reference-point sits ~0.55 above the surface, car top
 * ~0.88 above): duck-under danger bands (L9 stalactite, L12 wrap-zone) are placed /
 * shaped so the ghost car's 0.88 m body clears while a naive straight impales; the
 * hand-drawn atlas assumed a smaller car, so those bands sit higher than the atlas
 * card's illustrative teeth-tip (mechanic preserved, height realised for the car).
 *
 * Coordinates: world meters, y-up. Terrain authored left→right (top solid);
 * ceilings authored right→left (underside solid, Terrain.ts reverses for Box2D).
 */

import type { DangerZone, GimmickTag, Point, Polyline, Rect, Rock } from '../../src/engine/level/LevelSchema';
import {
  arch,
  ceiling,
  coinArc,
  flag,
  p,
  pillar,
  rampStroke,
  spline,
  twoPlatforms,
  type Gap,
} from './patterns';

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
   * overlapping a zone fails 'hazard'; the drawn line + rocks pass through. Present
   * in the authoring MEASURE/RECORD passes so every ghost is proven to clear
   * WITHOUT the car touching a zone (round-6 atlas-first).
   */
  readonly dangerZones?: readonly DangerZone[];
}

/** anti-dominant tag shorthand. */
const AD: readonly GimmickTag[] = ['anti-dominant'];

/** N placeholder coins (authoring re-places them ON the driven route; only the COUNT persists). */
function coinCount(n: number): Point[] {
  return coinArc(0, 1.2, n, 0.5, 0.3);
}

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // L1 (v5 slate #1) — road / flat / S. atlas-design-v5 card 1 (はじめの一歩).
  // Shallow 1-hole valley, one firm up-bow bridge. Tutorial teaches "離す＝走る".
  // REALIZATION: the atlas draws the SETTLED line as a downward scoop, but a drawn
  // scoop collapses (measured: falls); the engine settles a firm UP-bow into the
  // design's shape. arch bow 0.12 keeps car-path displacement 0.17m (<=0.3, F5).
  // Wide platforms keep spawn/goal at ±5 (D_sg 10.0, S floor) with a 4.4m span.
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

  // L2 — road / climb. Low-left → high-right shelf ramp (+2.6m up). Straight ramp
  // is the answer (learn走破 by angle). atlas: 枠13×10, 縦/横0.77.
  {
    id: 'ch1-l02',
    design: '道(road): のぼり坂を上る — 既存 tutorial / Draw Climber 上り',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -6, leftRim: -1.4, leftY: 0, rightRim: 2.4, rightY: 2.6, rightFar: 7, chasmY: -4.6 }),
    vehicleSpawn: p(-4, 0.35),
    goalFlag: flag(3.6, 2.6, 1, 2),
    killY: -5,
    coins: coinCount(5),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'climb-ramp', points: rampStroke(-1.55, 0.05, 2.55, 2.62, 0.2) }],
  },

  // L3 — road + mid-support (B01 Mid Pillar). Central island splits a 6m gap; the
  // W rests on the pillar top (efficiency = 3★). NOT anti-dominant: a straight that
  // sags onto the same central pillar also clears (measured), so like the shipped
  // L3 the pillar is the STAR path, not a Gate-3 straight-kill (design's "(幾何)"
  // label is thematic — a central support physically cannot defeat a straight).
  {
    id: 'ch1-l03',
    design: '道(road): 中間支点に載せて渡る — B01 Mid Pillar (Draw Bridge 中州)',
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      ...twoPlatforms({ leftFar: -7, leftRim: -3, leftY: 0, rightRim: 3, rightY: 0, rightFar: 7, chasmY: -4.6 }),
      pillar(0, 0.3, -4.6, 0.5, 0.95),
    ],
    vehicleSpawn: p(-5, 0.35),
    goalFlag: flag(4, 0, 1, 2),
    killY: -5,
    coins: coinCount(5),
    strokes: [
      {
        kind: '3star',
        role: 'rest-on-pillar-W',
        points: spline([p(-3.1, 0.06), p(-1.6, -0.05), p(0, 0.32), p(1.6, -0.05), p(3.1, 0.06)]),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L4 — R04 shield-static (盾). SOURCE: Stickman Rescue (傾け屋根) / Happy Glass L20+.
  // The DESIGN's 落石シャフト/側溝 is realised: a PIT sits under the rock-drop zone
  // (the design-atlas card's shaft/gutter — phase C wrongly flattened it). The line
  // is a ROOF above the lane that sheds the falling rock OFF to the right so the car
  // rolls over the (empty) pit; with NO roof the rock drops into the pit and the car
  // falls in with it (hazard-relevance HARD). The wide car spans the 1.6 m pit only
  // when it is empty — the falling rock is what makes the pit lethal. NOT anti-dominant.
  // round-6 geometry-fix: hazard-relevance is now HARD-ENFORCED (was advisory).
  {
    id: 'ch1-l04',
    design: '盾(shield-static): 落石を屋根で受け流す、空の側溝を渡る — R04 Stickman Rescue / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      // continuous approach → PIT (落石シャフト/側溝, x -0.5..1.1) → goal-side landing.
      [p(-6.5, 0), p(-0.5, 0), p(-0.3, -5)].map((q): [number, number] => [q.x, q.y]),
      [p(0.9, -5), p(1.1, 0), p(3.0, 0)].map((q): [number, number] => [q.x, q.y]),
      ceiling(-2.4, -1.8, 2.8),
    ],
    vehicleSpawn: p(-4.5, 0.35),
    goalFlag: flag(1.6, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    // TRIGGERED spawn: the rock falls the instant the car launches so it drops into the
    // pit as the car arrives. Design ETA preserved (h≈6.6 m fall ≈ car reaching the pit).
    // Roofed → the roof sheds it right onto the landing; un-roofed → it lands in the pit
    // and the crossing car falls in (measured: naive fall within the relevance window).
    rocks: [{ x: 0.3, y: 7, radius: 0.4, density: 5, triggerCarX: -4.3 }],
    strokes: [{ kind: 'any', role: 'roof-vault', points: spline([p(-2.2, 2.78), p(0.2, 2.5), p(2.4, 2.15)]) }],
  },

  // L5 — R08 multi-seal (一本書きで複数の穴を塞ぐ). SOURCE: Draw Line Bridge / Happy
  // Glass 少描画. Two low island nubs split the 6.8m crossing into 3 holes; one M
  // rests on BOTH nubs, sealing every hole (efficiency = 3★). NOT anti-dominant: a
  // straight sags onto the two nubs and clears (measured) — the island supports are
  // the multi-seal identity, not a Gate-3 straight-kill.
  {
    id: 'ch1-l05',
    design: '穴塞ぎ(multi-seal): 一本で三つの穴を塞ぐ — R08 Draw Line Bridge / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -7, leftRim: -3.4, leftY: 0, rightRim: 3.4, rightY: 0, rightFar: 7, chasmY: -5.6 }),
      pillar(-1.6, -0.1, -5.6, 0.35, 0.7),
      pillar(0.9, -0.1, -5.6, 0.35, 0.7),
    ],
    vehicleSpawn: p(-5, 0.35),
    goalFlag: flag(4.2, 0, 1, 2),
    killY: -5.8,
    coins: coinCount(5),
    strokes: [
      {
        kind: '3star',
        role: 'multi-seal-M',
        points: spline([p(-3.5, 0.1), p(-2.5, -0.28), p(-1.6, -0.08), p(-0.35, -0.4), p(0.9, -0.08), p(2.15, -0.3), p(3.5, 0.1)]),
      },
    ],
  },

  // B1 — R08-lite multi-seal breather. SOURCE: Draw Line Bridge (coin大). One short
  // 2-hole seal on a central island, coin bonanza. Non-AD (息抜き).
  {
    id: 'ch1-b1',
    design: '穴塞ぎ(multi-seal 易): 浅い2連くぼみを一本で — R08-lite Draw Line Bridge',
    inkFeel: 'generous',
    bonusMultiplier: 6,
    terrain: [
      ...twoPlatforms({ leftFar: -6.5, leftRim: -2.6, leftY: 0, rightRim: 2.6, rightY: 0, rightFar: 6.5, chasmY: -4.2 }),
      pillar(0, -0.05, -4.2, 0.6, 1.0),
    ],
    vehicleSpawn: p(-4.5, 0.35),
    goalFlag: flag(4, 0, 1, 2),
    killY: -4.5,
    coins: coinCount(10),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'twin-seal', points: spline([p(-2.7, 0.08), p(-1.6, -0.28), p(-0.6, -0.05), p(0, 0.0), p(0.6, -0.05), p(1.6, -0.28), p(2.7, 0.08)]) }],
  },

  // L6 — R10 ramp-vault over a spike pit (棘谷を越える). SOURCE: Draw Climber / Draw
  // the Hill. A firm bowed ARCH vaults the car OVER a spike-DangerZone valley — the
  // car rides high above the deep spikes; a low/saggy/idle line dips the car into the
  // spike floor (hazard-relevant). NOT anti-dominant: an overlapped straight holds
  // the 5m span (measured) and rides above the deep spikes, so the challenge is
  // SHAPING a firm high vault, not defeating a straight. (A literal 5.5m ballistic
  // jump is impossible for the ~4.5 m/s car — the vault realises the intent.)
  {
    id: 'ch1-l06',
    design: '跳躍(ramp-vault): ランプで棘谷を越える — R10 Draw Climber / Draw the Hill',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -7, leftRim: -2.5, leftY: 0.6, rightRim: 2.5, rightY: 0.6, rightFar: 7, chasmY: -4.4 }),
    dangerZones: [{ x: -2.4, y: -4.0, width: 4.8, height: 0.9, style: 'spike' }],
    vehicleSpawn: p(-4.6, 0.95),
    goalFlag: flag(4.0, 0.6, 1, 2),
    killY: -4.8,
    coins: coinCount(6),
    strokes: [{ kind: '3star', role: 'ramp-vault', points: arch(-2.7, 0.6, 2.7, 0.6, 1.1) }],
  },

  // L7 — R05 shield-dynamic-block (盾: 上段からの岩を止める). SOURCE: Stickman Rescue
  // (矢=壁) / Draw Bridge cover. Two-tier: an upper MESA (right) is the rock's tier,
  // the car runs the lower lane. The DESIGN's lower-lane PIT under the drop zone is
  // restored (phase C flattened it). ENGINE NOTE (learnings T1): this port's rocks
  // barely ROLL (~1 m/s), so a mesa-rolled rock can never sync with the ~4.5 m/s car;
  // the rock is realised as an AIRBORNE drop off the mesa side into the pit, and the
  // drawn line is a high SHIELD (anchored on a ceiling bracket) that catches it and
  // sheds it clear so the car crosses the empty pit. No shield → the rock drops in and
  // the car falls with it (hazard-relevance HARD). NOT AD. hazard-relevance HARD-ENFORCED.
  {
    id: 'ch1-l07',
    design: '盾(shield-dynamic): 上段メサからの落石を庇で受け、空の側溝を渡る — R05 Stickman Rescue / Draw Bridge',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      // lower lane: approach → PIT (x -0.3..1.3) → goal-side landing; upper MESA (right).
      [p(-6.5, 0), p(-0.3, 0), p(-0.1, -5)].map((q): [number, number] => [q.x, q.y]),
      [p(1.1, -5), p(1.3, 0), p(6.5, 0), p(6.5, -3)].map((q): [number, number] => [q.x, q.y]),
      [p(2.8, 2.5), p(6, 4.6), p(6.4, 4.6)].map((q): [number, number] => [q.x, q.y]),
      ceiling(-2.2, -1.6, 2.8),
    ],
    vehicleSpawn: p(-5, 0.35),
    goalFlag: flag(1.8, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    // TRIGGERED airborne drop, timed so the rock reaches the pit as the car crosses.
    rocks: [{ x: 0.5, y: 7, radius: 0.4, density: 5, triggerCarX: -4.6 }],
    strokes: [{ kind: 'any', role: 'stop-shield', points: spline([p(-2.0, 2.78), p(0.4, 2.5), p(2.6, 2.15)]) }],
  },

  // L8 — R06 catch-redirect (岩を止めるでなく逸らす). SOURCE: Draw Physics Line / Brain
  // Dots (redirect). A rock arcs in from the upper-left; the drawn steep CHUTE catches
  // it and slides it down-RIGHT past the goal, so the car crosses the (empty) pit under
  // the chute. The DESIGN's lane PIT under the rock's landing zone is restored (phase C
  // flattened it): with NO chute the rock arcs straight into the pit and the crossing
  // car falls in with it (hazard-relevance HARD). NOT AD. hazard-relevance HARD-ENFORCED.
  {
    id: 'ch1-l08',
    design: '逸らし(catch-redirect): 岩を急斜シュートで逸らし、空の側溝を渡る — R06 Draw Physics Line / Brain Dots',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      // approach → PIT (rock landing zone, x 0.4..2.0) → goal-side landing.
      [p(-6.5, 0), p(0.4, 0), p(0.6, -5)].map((q): [number, number] => [q.x, q.y]),
      [p(1.8, -5), p(2.0, 0), p(3.6, 0)].map((q): [number, number] => [q.x, q.y]),
      ceiling(-0.9, -0.3, 3.4),
    ],
    vehicleSpawn: p(-4.3, 0.35),
    goalFlag: flag(2.6, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    // TRIGGERED spawn: the rock is thrown from upper-left when the car nears, timed to
    // arc into the pit as the car crosses. Chuted → slides right past the goal; un-chuted
    // → lands in the pit and the car falls in (measured: naive fall in the relevance window).
    rocks: [{ x: -2.5, y: 5.6, radius: 0.38, density: 3, initialVelocity: { x: 3.5, y: 0 }, triggerCarX: -3.8 }],
    strokes: [{ kind: 'any', role: 'deflect-chute', points: spline([p(-0.5, 3.35), p(1.2, 1.8), p(3.0, 0.3)]) }],
  },

  // L9 — R16 hook-cantilever / wrap-guard (庇の下をくぐる). SOURCE: Draw Bridge L210 /
  // Draw Save!. A SOLID overhang lip forbids the high line; the ghost HUGS LOW under
  // it then sweeps up to a +1.6m shelf — an open S that wraps under the overhang.
  // AD: a lifted straight clips the lip, a rim-height straight sags into the deep pit
  // (both fail). NOTE: a body-height spikeDown DangerZone can't be ducked *through*
  // by the 1.8m-wide car (it clips it), so the SOLID overhang carries the wrap-under
  // (the shipped-L9 mechanic); the danger is the physical lip, not a red band.
  {
    id: 'ch1-l09',
    design: '回り込み(hook): 庇の下を潜り護り道に — R16 Draw Bridge L210 / Draw Save!',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -6, leftRim: -2.5, leftY: 0.2, rightRim: 2.5, rightY: 1.6, rightFar: 6, chasmY: -6 }),
      ceiling(-2.2, -0.4, 1.5, 1.3),
    ],
    vehicleSpawn: p(-4.6, 0.55),
    goalFlag: flag(4.2, 1.6, 1, 2),
    killY: -6.5,
    coins: coinCount(5),
    strokes: [
      {
        kind: '3star',
        role: 'wrap-under-S',
        points: spline([p(-3.0, 0.2), p(-1.9, 0.28), p(-0.7, 0.34), p(0.4, 0.7), p(1.5, 1.25), p(2.6, 1.62)]),
      },
    ],
  },

  // L10 — R14 dome-dual lite (盾＋道の兼任 / MID-CLIMAX). SOURCE: Draw Bridge L69-74
  // (証拠12). A single arch over a deep pit is BOTH the roof (a rock drops on the
  // apex) and the road. NOT anti-dominant: an overlapped straight holds the 4.8m
  // pit (measured), so the challenge is the ROCK — a flat straight is crushed by
  // the falling rock (hazard-relevant) while the firm dome sheds it. atlas: 枠12×12.
  {
    id: 'ch1-l10',
    design: 'ドーム(dome-dual 入口): 守る屋根かつ走る道 — R14 Draw Bridge L69-74',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -6, leftRim: -2.4, leftY: 0, rightRim: 2.4, rightY: 0, rightFar: 6, chasmY: -5 }),
    vehicleSpawn: p(-4.5, 0.35),
    goalFlag: flag(4, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(6),
    rocks: [{ x: 0.55, y: 6, radius: 0.34, density: 3 }],
    strokes: [{ kind: '3star', role: 'dome-roof-road', points: arch(-2.5, 0.06, 2.5, 0.06, 1.6) }],
  },

  // B2 — R03-lite sag-rope breather (棘の上に張り渡す). SOURCE: Draw Line Bridge
  // (sag-rope). A shallow taut span over a single spike DangerZone + coin arc.
  // Non-AD (息抜き). The spike makes an idle/naive car that falls die BY the spike.
  {
    id: 'ch1-b2',
    design: '張り渡し(sag-rope 易): 棘の上に弛ませず渡す — R03-lite Draw Line Bridge',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: twoPlatforms({ leftFar: -6, leftRim: -2.4, leftY: 0.4, rightRim: 2.4, rightY: 0.4, rightFar: 6.5, chasmY: -3.6 }),
    dangerZones: [{ x: -0.5, y: -2.7, width: 1.0, height: 0.85, style: 'spike' }],
    vehicleSpawn: p(-4.3, 0.75),
    goalFlag: flag(3.8, 0.4, 1, 2),
    killY: -4.2,
    coins: coinCount(8),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'taut-span', points: arch(-2.75, 0.42, 2.75, 0.42, 0.08) }],
  },

  // L11 — R03 sag-rope over pit spikes (棘の谷を張り渡す). SOURCE: Draw Line Bridge
  // (証拠11上). A deep canyon with a spike floor (DangerZone) + a central terrain
  // spire; a near-taut span crosses. Same-height rims (a taut straight IS the
  // intended line) → NOT AD; it is a PRECISION level. The pit spikes make a
  // saggy/idle car die BY the hazard.
  {
    id: 'ch1-l11',
    design: '張り渡し(sag-rope): 棘の谷を張力を保って渡す — R03 Draw Line Bridge (証拠11)',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -6, leftRim: -2.6, leftY: 0.6, rightRim: 2.6, rightY: 0.6, rightFar: 6, chasmY: -6 }),
      [p(-0.5, -6), p(-0.35, -0.6), p(0.35, -0.6), p(0.5, -6)].map((q): [number, number] => [q.x, q.y]),
    ],
    dangerZones: [{ x: -2.6, y: -3.4, width: 5.2, height: 0.9, style: 'spike' }],
    vehicleSpawn: p(-4.4, 0.95),
    goalFlag: flag(4, 0.6, 1, 2),
    killY: -6.5,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'taut-over-spikes', points: arch(-2.7, 0.62, 2.7, 0.62, -0.32) }],
  },

  // L12 — R02 hook / descent (危険帯を越えて降りる). SOURCE: Draw Bridge L210 (証拠10).
  // The car descends a drawn RAMP from a high ledge to a low shelf, crossing OVER a
  // DangerZone pit. NOT anti-dominant: the car cannot "drive" a near-vertical shaft
  // (it dangles), so the descent is a drivable diagonal ramp; the zone pit makes a
  // naive/idle car that drops off the ledge die BY the hazard (relevance). The most
  // vertical board (a high→low descent) — the drawn line is a descending ramp.
  {
    id: 'ch1-l12',
    design: '降下(descent): 棘谷を越えて低い岸へ降りる — R02 Draw Bridge L210 (証拠10)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      [p(-6, 1.5), p(-2.4, 1.5), p(-2.2, -5)].map((q): [number, number] => [q.x, q.y]),
      [p(2.4, -1.0), p(6, -1.0), p(6, -5)].map((q): [number, number] => [q.x, q.y]),
    ],
    dangerZones: [{ x: -2.2, y: -3.7, width: 4.6, height: 1.1, style: 'spike' }],
    vehicleSpawn: p(-4.4, 1.85),
    goalFlag: flag(3.4, -1.0, 1, 2),
    killY: -5.5,
    coins: coinCount(6),
    strokes: [{ kind: '3star', role: 'descent-cross', points: arch(-2.5, 1.5, 2.5, -1.0, 0.65) }],
  },

  // L13 — R11 shield-timed (時限盾). SOURCE: Stickman Rescue (観察) / Happy Glass.
  // The "時限/来るぞ" beat: after a long traverse the rock drops (triggered, timed to the
  // car nearing the goal) into a GOAL-SIDE pit — the design's drop-point pit, restored
  // (phase C flattened it). Distinct from L7 (short level, mid pit): L13 is a LONG level
  // whose hazard is at the goal. The drawn high SHIELD (anchored on a bracket) catches the
  // dropping rock and sheds it clear past the goal so the car crosses the empty pit; no
  // shield → the rock lands in the pit and the car falls in (hazard-relevance HARD). Upper
  // RACE (right) = the rock's tier. Airborne drop (engine rocks don't roll — learnings T1).
  // NOT AD. hazard-relevance HARD-ENFORCED.
  {
    id: 'ch1-l13',
    design: '時限盾(shield-timed): ゴール手前の落石を庇で受け、空の側溝を渡る — R11 Stickman Rescue / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      // long lower lane: approach → GOAL-SIDE PIT (x 2.5..4.1) → landing; upper RACE (right).
      [p(-6, 0), p(2.5, 0), p(2.7, -5)].map((q): [number, number] => [q.x, q.y]),
      [p(3.9, -5), p(4.1, 0), p(6.5, 0), p(6.5, -3)].map((q): [number, number] => [q.x, q.y]),
      [p(5.4, 2.6), p(7, 3.9), p(7, 2.6)].map((q): [number, number] => [q.x, q.y]),
      ceiling(0.6, 1.2, 2.8),
    ],
    vehicleSpawn: p(-4.5, 0.35),
    goalFlag: flag(4.4, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    // TRIGGERED late (timed): the rock drops as the car nears the goal-side pit.
    rocks: [{ x: 3.1, y: 7, radius: 0.4, density: 5, triggerCarX: -0.5 }],
    strokes: [{ kind: 'any', role: 'timed-shield', points: spline([p(0.8, 2.78), p(3.0, 2.5), p(5.2, 2.15)]) }],
  },

  // L14 — R12+R08 catch-redirect + multi-seal FUSION (受けて塞ぐ). SOURCE: Happy Glass
  // funnel / Draw Line Bridge. TWO holes (multi-seal) AND a rock the central funnel
  // shoulder sheds — two roles in one M stroke, resting on the central pillar. NOT
  // anti-dominant (a straight rests on the central pillar too, measured); the tight
  // ink + the rock + the fused two-role shaping are the pre-boss challenge.
  {
    id: 'ch1-l14',
    design: '複合(catch+seal): 受け皿で逸らし＋二穴を塞ぐ — R12+R08 Happy Glass / Draw Line Bridge',
    inkFeel: 'tight',
    gimmickTags: [],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -6.5, leftRim: -3.4, leftY: 0, rightRim: 3.4, rightY: 0, rightFar: 6.5, chasmY: -5 }),
      pillar(0, 0.15, -5, 0.7, 1.1),
    ],
    vehicleSpawn: p(-4.7, 0.35),
    goalFlag: flag(5, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    // TRIGGERED spawn (round-6, GENUINELY relevant): the rock drops over the LEFT pit the
    // instant the car launches, timed so a naive/idle car (which drives off the left rim
    // into the pit) is struck as it falls — the M-stroke seal instead sheds it into the pit
    // and the car clears. Machine-verified by the hazard-relevance gate (NOT on the advisory).
    rocks: [{ x: -2.0, y: 5.5, radius: 0.45, density: 2, triggerCarX: -4.0 }],
    strokes: [
      {
        kind: '3star',
        role: 'funnel-seal-M',
        points: spline([p(-3.5, 0.06), p(-1.7, -0.1), p(0, 0.22), p(1.7, -0.1), p(3.5, 0.06)]),
      },
    ],
  },

  // L15 — R15 composite BOSS (章ボス). SOURCE: Draw Bridge 後半 / Stickman 多段. The
  // chapter's total trial: a tall central WALL over the widest, deepest spike PIT
  // (DangerZone), on the tightest ink. The one line must VAULT the wall (resting on
  // its crown so the span holds) AND clear the spikes. AD(全機序): a straight is
  // blocked by the wall (clipped) and a low/idle line falls onto the spike floor
  // (hazard). Fuses the wall-vault + spike-pit trials the chapter taught.
  {
    id: 'ch1-l15',
    design: 'ボス: 壁を乗り越え棘谷を渡る — R15 Draw Bridge / Stickman 多段',
    inkFeel: 'tight',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -6, leftRim: -2.8, leftY: 0, rightRim: 2.8, rightY: 0, rightFar: 6, chasmY: -5 }),
      pillar(0, 1.05, -5, 0.5, 0.9),
    ],
    dangerZones: [{ x: -2.8, y: -3.2, width: 5.6, height: 0.9, style: 'spike' }],
    vehicleSpawn: p(-4.6, 0.35),
    goalFlag: flag(3.1, 0, 1, 2),
    killY: -5.5,
    coins: coinCount(7),
    strokes: [
      {
        kind: '3star',
        role: 'boss-wall-vault',
        points: spline([p(-2.9, 0.06), p(-1.5, 0.55), p(0, 1.12), p(1.5, 0.55), p(2.9, 0.06)]),
      },
    ],
  },

  // B3 — R01-lite dome-dual easy (章完走＋守る道の再確認, coin祭). SOURCE: Draw Bridge
  // L69-74 (証拠12). A gentle dome over a modest gap bears a slow falling rock, with
  // a coin bonanza — a victory-lap reprise of the dome role. Non-AD.
  {
    id: 'ch1-b3',
    design: 'ドーム(dome-dual 易): 守る道の再確認＋コイン祭 — R01-lite Draw Bridge L69-74',
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: [
      ...twoPlatforms({ leftFar: -6.5, leftRim: -2.6, leftY: 0, rightRim: 2.6, rightY: 0, rightFar: 7, chasmY: -4.2 }),
      pillar(0, 0.4, -4.2, 0.5, 0.95),
    ],
    vehicleSpawn: p(-4.6, 0.35),
    goalFlag: flag(4.6, 0, 1, 2),
    killY: -4.5,
    coins: coinCount(9),
    gimmickTags: [],
    // TRIGGERED spawn (round-6, GENUINELY relevant): the slow rock drops just left of the
    // dome apex as the car launches, timed so a naive straight (which sags into the pit) is
    // struck as it falls; the firm dome sheds it clear. Machine-verified (NOT on the advisory).
    rocks: [{ x: -0.5, y: 4, radius: 0.3, density: 2, triggerCarX: -3.2 }],
    strokes: [{ kind: 'any', role: 'dome-reprise', points: arch(-2.7, 0.06, 2.7, 0.06, 1.05) }],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

/**
 * Chapter 1 declarative level sources — SPATIAL-PUZZLE OVERHAUL v3
 * (2026-07-08, research/11_spatial_patterns.md).
 *
 * Pure DATA consumed by scripts/levels/authoring.ts, which runs each candidate
 * stroke through the real engine at Lv0, derives the ink economy from measured
 * consumption (research/11 §3 v3: generous 3.0 / standard 2.5 / tight 2.0 x the
 * minimal solution — NO anti-dominant ink starvation), records ghosts, auto-places
 * coins on the driven route, and emits levels/<id>.json. Regeneration after a
 * TuningConstants change = rerun the authoring script — no hand-edited JSON.
 *
 * OVERHAUL INTENT (device mandate: "車と旗が近すぎ / 線1本で工夫の余地なし / 初期インクが
 * 少なくステージが単純 / 地形パターン+30で空間を意識させる脳トレ / 難易度インフレを作れ"):
 *   1. GENEROUS INK: every board now lets the player draw 2-3x the minimal
 *      solution (authoring FEEL_FACTOR). Difficulty comes from GEOMETRY, not ink
 *      starvation — answering "初期インクが少なすぎてステージが単純".
 *   2. STRAIGHT-KILL BY GEOMETRY: every anti-dominant board carries a real
 *      obstacle — a mid-gap SPIKE, a WALL, a low CEILING, a narrow FULCRUM in a
 *      wide chasm, or a deep pit — so a straight rim-to-rim line (even lifted +
 *      overlapped, the Gate 3 bot's dominant approximation) PHYSICALLY fails
 *      (collides / sags / tips / falls). Gate 3 machine-verifies all 9 straight
 *      candidates fail on each; the negative control (a flat gap tagged
 *      anti-dominant) still lets straights clear (tests/contract/gate3.spec.ts).
 *   3. MULTI-BEND ESCALATION: L1-L8 teach one mechanic (line -> hump/ramp over
 *      one obstacle); L9-L15 compound them and REQUIRE a multi-bend stroke
 *      (S / W / U / M) — a single lazy arch clears nothing past L8. Stroke length
 *      4.5m -> ~10m, bends 0 -> 3, vertical span 0.5m -> ~3m (portrait height).
 *   4. 3-STAR EFFICIENCY GHOST: every AD board carries a kind:'3star' reference
 *      ghost so Gate 2 asserts the gold target (min x 1.10); the efficiency axis
 *      (draw less -> more stars) is now live on all 18 boards.
 *   5. SAWTOOTH: new mechanic -> breather (B1/L6/B2 after the L5/L10 peaks),
 *      difficulty L1(★1) -> L15(★5 boss).
 *
 * Physics authoring constraints (research/09 §1 + research/11 §1, re-measured
 * 2026-07-08): 1 stroke/attempt (fixed); unsupported spans <= ~5.5 m with rim
 * overlap (wider -> sag/break, a straight-kill lever); a stroke may no longer lie
 * INSIDE a solid (StrokeClipper, 0.55 m skin) so ghosts ride ON/ABOVE surfaces
 * and arc OVER spikes/walls; sharp corners catapult the car (~1.4 m) so every
 * multi-bend ghost is splined. N<=32 worlds/process (recycled).
 *
 * Coordinates: world meters, y-up. Terrain authored left->right (top solid);
 * ceilings authored right->left (underside solid, Terrain.ts reverses for Box2D).
 */

import type { GimmickTag, Point, Polyline, Rect } from '../../src/engine/level/LevelSchema';
import {
  arch,
  ceiling,
  coinArc,
  coinLine,
  flag,
  line,
  p,
  pillar,
  spike,
  spline,
  twoPlatforms,
  wobble,
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
}

/** anti-dominant tag shorthand. */
const AD: readonly GimmickTag[] = ['anti-dominant'];

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // L1 — tiny flat gap, generous ink, any sloppy line works (FTUE <=10 s).
  // Kept FLAT + same-height (the Gate 3 contract fixture derives from this: a
  // flat gap tagged anti-dominant MUST let overlapped straights clear).
  {
    id: 'ch1-l01',
    design: 'A01 Flat Bridge · 1.8m gap · any-line-works (tutorial)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -9, leftRim: -0.9, leftY: 0, rightRim: 0.9, rightY: 0, rightFar: 12, chasmY: -5 }),
    vehicleSpawn: p(-3.2, 0.6),
    goalFlag: flag(2.6, 0, 1.5, 2.5),
    killY: -6,
    coins: coinArc(0, 0.9, 5, 0.5, 0.35),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'wobbly', points: wobble(-2, 0.15, 2, 0.15, 0.18) }],
  },

  // L2 — slightly wider + slight step; teach ink meter/stars (straight -> 3 stars).
  {
    id: 'ch1-l02',
    design: 'A01+ 2.5m gap · slight step · straight=3★ (teach ink/stars)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -10, leftRim: -1.25, leftY: 0, rightRim: 1.25, rightY: 0.3, rightFar: 13, chasmY: -5 }),
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(3.0, 0.3, 1.4, 2.4),
    killY: -6,
    coins: coinArc(0, 1.1, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'tight-straight', points: line(-2.6, 0.15, 2.6, 0.5) },
      { kind: 'any', role: 'loose-arch', points: arch(-3, 0.2, 3, 0.55, 0.5) },
    ],
  },

  // L3 — MID FULCRUM discovery (B01): resting on the central pillar is cheaper.
  // Non-AD (a straight still clears the modest 4m gap; the pillar is the star
  // path). KEEP the pillar — terrain-winding.spec.ts negative control needs it.
  {
    id: 'ch1-l03',
    design: 'B01 Mid Pillar · 4m gap + central 中間支点 (rest-on-pillar = star)',
    inkFeel: 'standard',
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 14, chasmY: -5 }),
      pillar(0, -0.3, -5),
    ],
    vehicleSpawn: p(-4.3, 0.6),
    goalFlag: flag(3.6, 0, 1.3, 2.3),
    killY: -6,
    coins: coinArc(0, 0.9, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'rests-on-pillar', points: arch(-2.8, 0.1, 2.8, 0.1, -0.12) },
      { kind: 'any', role: 'sag-wide', points: arch(-3.2, 0.15, 3.2, 0.15, -0.1) },
    ],
  },

  // L4 — FIRST SPIKE + climb (G01+C01): a rock spike (tip 2.0) rises mid-gap and
  // climbs to a +1.6m bank. Every straight — even lifted/overlapped — passes below
  // the tip and dies on the spike faces; the HUMP arc vaults the tip and settles
  // on the bank. Teaches "an obstacle in the middle -> go over it".
  {
    id: 'ch1-l04',
    design: 'G01+C01 SPIKE + climb · vault tip 2.0 to +1.6m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -1.9, leftY: 0, rightRim: 1.9, rightY: 1.6, rightFar: 14, chasmY: -6 }),
      spike(-0.1, 2.0, -6, 0.85),
    ],
    vehicleSpawn: p(-4.2, 0.6),
    goalFlag: flag(3.5, 1.6, 1.2, 2.2),
    killY: -8,
    coins: coinArc(-0.1, 2.4, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'vault-spike', points: arch(-2.7, 0.15, 2.5, 1.75, 1.5) }],
  },

  // L5 — WALL over-arch + climb (F01+C01): a tall central WALL (flat top +1.9m)
  // spans a 4.6m gap and blocks every straight (they collide with the wall face);
  // the ∧ vaults it and settles on a +1.4m bank. Distinct from L4's SPIKE (a broad
  // flat top vs a point) and a step up in vault height.
  {
    id: 'ch1-l05',
    design: 'F01+C01 WALL over-arch · ∧ over +1.9m wall to +1.4m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0, rightRim: 2.3, rightY: 1.4, rightFar: 15, chasmY: -5.5 }),
      pillar(-0.1, 1.2, -5.5, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.6, 0.6),
    goalFlag: flag(3.9, 1.4, 1.2, 2.3),
    killY: -6.5,
    coins: coinArc(-0.1, 2.5, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'over-wall', points: arch(-2.8, 0.15, 2.6, 1.55, 1.4) }],
  },

  // B1 — bonus after L5: flat long run + coin arch (playful reward, breather).
  {
    id: 'ch1-b1',
    design: 'A12 bonus · flat long run · coin arch (breather)',
    inkFeel: 'generous',
    bonusMultiplier: 6,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.0, leftY: 0, rightRim: 1.0, rightY: 0, rightFar: 20, chasmY: -5 }),
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(5.4, 0, 1.5, 2.5),
    killY: -6,
    coins: [...coinArc(0.3, 1.0, 5, 0.5, 0.35), ...coinArc(2.8, 1.2, 6, 0.45, 0.55), ...coinArc(4.6, 1.1, 5, 0.4, 0.45)],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'straight', points: line(-2.2, 0.15, 2.2, 0.15) }],
  },

  // L6 — BREATHER + FIRST DESCENT: goal sits 3.0m BELOW the spawn. Descend a ramp
  // from a high start platform to a low far bank. Uses portrait height downward.
  {
    id: 'ch1-l06',
    design: 'D01 breather · DESCENT · goal 3.0m BELOW start · varied start/goal',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -11, leftRim: -1.5, leftY: 3.0, rightRim: 1.5, rightY: 0, rightFar: 14, chasmY: -5 }),
    vehicleSpawn: p(-4.0, 3.6),
    goalFlag: flag(3.4, 0, 1.4, 2.4),
    killY: -6,
    coins: coinLine(-1.4, 3.0, 2.2, 0.7, 6),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'descent-ramp', points: arch(-2.0, 3.15, 2.0, 0.15, 0.28) }],
  },

  // L7 — WALL over-arch + climb (F01+C01): a central WALL (flat top +1.75m) blocks
  // every straight (a flat top catches even the lifted/overlapped straights that a
  // thin spike would let slip over); the ∧ vaults it to a +1.8m bank. A step up
  // from L5's wall (higher bank, wider gap).
  {
    id: 'ch1-l07',
    design: 'F01+C01 WALL over-arch · ∧ over +1.75m wall to +1.8m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.1, leftY: 0, rightRim: 2.1, rightY: 1.8, rightFar: 15, chasmY: -6 }),
      pillar(-0.1, 1.75, -6, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.6, 0.6),
    goalFlag: flag(3.8, 1.8, 1.2, 2.3),
    killY: -8,
    coins: coinArc(-0.1, 2.55, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'over-wall', points: arch(-2.9, 0.15, 2.6, 1.95, 1.45) }],
  },

  // L8 — WALL over-arch + climb (F01+C01): a central WALL (flat top +1.6m, narrow)
  // blocks every straight (they collide with the wall face); the ∧ vaults it and
  // settles on a +1.9m bank. Gate 3 contract fixture (all 9 straights fail).
  {
    id: 'ch1-l08',
    design: 'F01+C01 WALL over-arch · ∧ over +1.6m wall to +1.9m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0, rightRim: 2.3, rightY: 1.9, rightFar: 15, chasmY: -6 }),
      pillar(-0.1, 1.6, -6, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.9, 0.6),
    goalFlag: flag(4.1, 1.9, 1.2, 2.2),
    killY: -8,
    coins: coinArc(-0.1, 2.7, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'over-wall', points: arch(-3.0, 0.15, 2.8, 2.05, 1.4) }],
  },

  // L9 — OVERHANG DUCK-UNDER intro (E02+C01, first COMPOUND): a rock lip protrudes
  // from the left rim over the gorge (underside 1.4->1.2m). The natural climb arch
  // to the +1.4m bank collides with the lip; the line must HUG LOW under it, then
  // sweep up — an S with 2 bends. Straights die on the raised-goal/deep-pit
  // mechanism (offset-0 sags, lifted hit the lip). Introduces the duck-under L12
  // compounds. KEEP the ceiling (terrain-winding.spec.ts negative control needs it).
  {
    id: 'ch1-l09',
    design: 'E02+C01 OVERHANG duck-under intro · low hug then climb +1.4m (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 1.4, rightFar: 14, chasmY: -6.5 }),
      ceiling(-2.2, -0.5, 1.4, 1.2),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.3, 1.4, 1.2, 2.2),
    killY: -8,
    coins: [...coinLine(-1.9, 0.46, -0.7, 0.5, 4), ...coinLine(0.4, 0.9, 2.6, 1.55, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'duck-under-S',
        points: spline([p(-3.1, 0.2), p(-1.9, 0.3), p(-0.7, 0.36), p(0.3, 0.66), p(1.3, 1.12), p(2.3, 1.5), p(3.1, 1.65)]),
      },
    ],
  },

  // L10 — MID CLIMAX: WALL LEAP-DOWN (F01+D01, compound). A tall central wall
  // (top +1.0m) blocks every straight over a 5.2m gorge, and the goal sits 0.8m
  // BELOW the start. The line must HUMP up-and-over the wall, then LEAP DOWN onto
  // the lower far bank — a ∧-then-descent (2 slope changes). A straight collides
  // with the wall; a lifted straight floats unboardable / hits the wall. The
  // leap-DOWN shape is distinct from the raised-bank vaults (Gate 3: all 9 fail).
  {
    id: 'ch1-l10',
    design: 'F01+D01 CLIMAX · WALL leap-DOWN · ∧ over +1.0m wall to a bank 0.8m BELOW (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -2.6, leftY: 0, rightRim: 2.6, rightY: -0.8, rightFar: 16, chasmY: -5.0 }),
      pillar(-0.1, 1.0, -5.0, 0.5, 0.95),
    ],
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.4, -0.8, 1.0, 2.2),
    killY: -6.0,
    coins: [...coinArc(-0.1, 1.7, 4, 0.5, 0.25), ...coinLine(1.2, 0.2, 2.8, -0.5, 4)],
    strokes: [{ kind: '3star', role: 'wall-leap-down', points: arch(-2.9, 0.15, 2.9, -0.65, 1.55) }],
  },

  // B2 — bonus after L10: DESCENT + triple coin arch (goal below the high start).
  // Adopts L6's proven descent recipe and extends the far bank for the bonus run.
  {
    id: 'ch1-b2',
    design: 'A12 bonus · DESCENT run · goal 3.0m below start · long coin run',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.5, leftY: 3.0, rightRim: 1.5, rightY: 0, rightFar: 20, chasmY: -5 }),
    vehicleSpawn: p(-4.0, 3.6),
    goalFlag: flag(5.2, 0, 1.5, 2.5),
    killY: -6,
    coins: [...coinArc(0.2, 1.6, 5, 0.5, 0.4), ...coinArc(2.6, 1.0, 6, 0.45, 0.45), ...coinArc(4.4, 0.85, 5, 0.4, 0.4)],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'descent-arch', points: arch(-2.0, 3.15, 2.0, 0.15, 0.28) }],
  },

  // L11 — SAWTOOTH TROUGH: SPIKE + climb (G01+C01) after the climax. Spike (tip
  // 1.9), modest +1.4m bank. Same "vault the tip" mechanic as L4, a deliberate
  // breather before the L12-L15 escalation.
  {
    id: 'ch1-l11',
    design: 'G01+C01 SPIKE + climb · vault tip 1.9 to +1.4m (sawtooth trough) (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2.0, leftY: 0, rightRim: 2.0, rightY: 1.4, rightFar: 14, chasmY: -5.5 }),
      spike(-0.1, 1.9, -5.5, 0.8),
    ],
    vehicleSpawn: p(-4.3, 0.6),
    goalFlag: flag(3.6, 1.4, 1.3, 2.3),
    killY: -6.5,
    coins: coinArc(-0.1, 2.2, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'vault-spike', points: arch(-2.6, 0.15, 2.5, 1.55, 1.5) }],
  },

  // L12 — OVERHANG DUCK-UNDER (E02+F01, compound): a rock lip protrudes from the
  // left rim over the gorge at 1.5->1.25m. The natural climb arch collides with the
  // lip; the line must HUG LOW under it then sweep up to a +2.0m ledge — a smooth S
  // with 2 bends. Straights die on the raised-goal/deep-pit mechanism.
  {
    id: 'ch1-l12',
    design: 'E02+F01 OVERHANG duck-under · 5m gorge · low hug then climb +2.0m (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.0, rightFar: 15, chasmY: -6.5 }),
      ceiling(-2.25, -0.55, 1.5, 1.25),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.0, 1.0, 2.2),
    killY: -8,
    coins: [...coinLine(-1.9, 0.44, -0.7, 0.48, 4), ...coinLine(0.4, 1.25, 2.6, 2.1, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'duck-under-S',
        points: spline([p(-3.2, 0.2), p(-1.9, 0.3), p(-0.6, 0.34), p(0.3, 0.66), p(1.2, 1.15), p(2.1, 1.65), p(3.0, 2.02), p(3.8, 2.2)]),
      },
    ],
  },

  // L13 — WALL over-arch to a raised bank (F01, compound with the deep pit): a tall
  // central wall (top +1.2m) blocks any straight (collision); the stroke must ∧
  // up-and-over, then settle onto a +1.5m bank. The most "how do I draw this" board.
  {
    id: 'ch1-l13',
    design: 'F01 WALL over-arch · ∧ over +1.2m wall to +1.5m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0, rightRim: 2.3, rightY: 1.5, rightFar: 15, chasmY: -6 }),
      pillar(0, 1.2, -6, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.7, 0.6),
    goalFlag: flag(4.0, 1.5, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 2.3, 6, 0.5, 0.4),
    strokes: [{ kind: '3star', role: 'over-arch', points: arch(-2.8, 0.15, 2.7, 1.65, 1.4) }],
  },

  // L14 — SWITCHBACK DESCENT + SPIKE (D04+G01, 3+ compound): the goal sits 2.6m
  // BELOW the start. A two-terrace stair is carved into the LEFT platform (behind
  // the gap rim — unreachable by rim-to-rim straights), then a rock spike (tip
  // -0.7) rises just past the stair exit: every straight chord crosses well below
  // the tip and dies. The line is a gentle W: descend the stair, a wide shallow
  // hump OVER the spike tip, long descent to the low bank.
  {
    id: 'ch1-l14',
    design: 'D04+G01 SWITCHBACK · stair down 2 terraces + spike hump · goal 2.6m BELOW (AD)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      [
        [-11, 0],
        [-4.6, 0],
        [-4.65, -0.9],
        [-3.4, -0.9],
        [-3.45, -1.8],
        [-2.2, -1.8],
        [-2.4, -7.0],
      ],
      [
        [3.6, -7.0],
        [3.4, -2.6],
        [15, -2.6],
      ],
      spike(-0.4, -0.7, -7.0, 1.0),
    ],
    vehicleSpawn: p(-5.9, 0.6),
    goalFlag: flag(3.9, -2.6, 1.1, 2.2),
    killY: -8.5,
    coins: [...coinLine(-4.2, -0.6, -2.6, -1.2, 4), ...coinLine(-1.0, -0.85, 0.6, -0.85, 4), ...coinLine(1.6, -1.5, 3.2, -2.35, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'switchback-W',
        points: spline([
          p(-5.3, 0.12),
          p(-4.6, -0.45),
          p(-3.8, -0.88),
          p(-2.9, -1.15),
          p(-1.9, -1.2),
          p(-1.0, -0.9),
          p(-0.4, -0.52),
          p(0.2, -0.68),
          p(1.0, -1.15),
          p(2.0, -1.75),
          p(3.0, -2.25),
          p(3.8, -2.55),
        ]),
      },
    ],
  },

  // L15 — CHAPTER BOSS (E02+C02 compound): the deepest, widest board — a 6.6m
  // chasm, an approach overhang lip that forbids the high entry, and the highest
  // +2.4m summit, on a TIGHT ink budget. The line is a long (~9m) S: duck deep under
  // the lip, then a sustained climb to the summit — ~2.4m vertical span, the whole
  // portrait height. A lifted straight rises into the lip; a rim-height straight
  // sags into the deep pit (all 9 fail). The chapter's stiffest climb.
  {
    id: 'ch1-l15',
    design: 'E02+C02 BOSS · deep 6.6m chasm · lip + climb +2.4m · tight ink (AD)',
    inkFeel: 'tight',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -3.3, leftY: 0, rightRim: 3.3, rightY: 2.4, rightFar: 18, chasmY: -6.5 }),
      ceiling(-3.0, -1.1, 1.7, 1.4),
    ],
    vehicleSpawn: p(-6.0, 0.6),
    goalFlag: flag(4.8, 2.4, 1.0, 2.2),
    killY: -8.5,
    coins: [...coinLine(-2.6, 0.5, -0.6, 0.95, 4), ...coinLine(0.6, 1.5, 3.0, 2.55, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'boss-climb-S',
        points: spline([
          p(-4.0, 0.18),
          p(-2.7, 0.34),
          p(-1.4, 0.5),
          p(-0.2, 1.0),
          p(0.9, 1.55),
          p(1.9, 2.05),
          p(2.9, 2.4),
          p(3.6, 2.55),
        ]),
      },
    ],
  },

  // B3 — bonus after L15: flat long run + coin bonanza (chapter-complete reward).
  {
    id: 'ch1-b3',
    design: 'A12 bonus · flat long run · coin bonanza',
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.0, leftY: 0, rightRim: 1.0, rightY: 0, rightFar: 24, chasmY: -5 }),
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(5.6, 0, 1.6, 2.6),
    killY: -6,
    coins: [
      ...coinArc(0.2, 1.0, 5, 0.45, 0.35),
      ...coinArc(2.2, 1.2, 5, 0.4, 0.5),
      ...coinArc(3.8, 1.2, 5, 0.4, 0.5),
      ...coinArc(5.0, 1.1, 4, 0.35, 0.4),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'straight', points: line(-2.2, 0.15, 2.2, 0.15) }],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

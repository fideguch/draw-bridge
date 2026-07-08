/**
 * Chapter 1 declarative level sources (T086-T088) — LEVEL PROGRESSION OVERHAUL
 * (2026-07-08, research/09_level_progression.md).
 *
 * Pure DATA + geometry helpers consumed by scripts/levels/authoring.ts, which
 * runs each candidate stroke through the real engine at Lv0, derives the ink
 * economy from measured consumption, records ghosts, and emits levels/<id>.json.
 * When TuningConstants change (device juice/firmness tuning), regeneration =
 * rerun the authoring script against these sources — no hand-edited JSON.
 *
 * OVERHAUL INTENT (harsh real-device feedback: "どのステージも横に1本の線でクリア
 * できて退屈。より複雑な線をより長く。スマホ画面全体（縦）を使え。スタート/ゴール
 * 固定で道が少し変わるだけではつまらない。どう線を引くか考えさせろ"):
 *   1. VERTICAL: every mid/late level uses the portrait height — the STROKE
 *      climbs to raised goals (+2.0..+3.2 m) or descends to goals BELOW the
 *      spawn, so span_y rises 0.5m -> ~3.6m (vs the shipped <=2.3m).
 *   2. VARIED START/GOAL: goal is no longer always a same-height far bank —
 *      it sits high on a raised ledge (climbs), low below the spawn (descents
 *      L6/B2), across a wall via an ∧ over-arch (L13), or on a mid-supported
 *      span (L3). Spawn heights vary too.
 *   3. ANTI-DOMINANT x11 (L4,L5,L7,L8,L9,L10,L11,L12,L13,L14,L15): a straight
 *      rim-to-rim line PHYSICALLY fails on every one — a raised far bank makes
 *      the straight ramp sag into the gap (car falls); L13's central wall makes
 *      it collide. The thoughtful arch/over-arch clears. Gate 3 asserts this
 *      with the straight-line bot; the negative control (a flat gap tagged
 *      anti-dominant) still lets straights clear (tests/contract/gate3.spec.ts).
 *   4. SAWTOOTH: new mechanic -> breather (B1/L6/B2 after the L5/L10 peaks),
 *      difficulty L1(★1) -> L15(★5 boss), stroke length 4m -> ~8m, bends 0->2-3.
 *
 * Physics authoring constraints (research/09 §1 + specs research.md §R10; all
 * re-measured 2026-07-08 with the FIRMER bridge totalFlexBudgetRad 0.22 /
 * jointHertz 10): the unanchored chain needs rim overlap to bear load; a
 * straight ramp to a raised bank FALLS at overlap {0,1,2} while a bowed climb
 * arch clears to +3.2 m; a DEEP dip-into-raised-goal U-stroke loses the car
 * (avoided — dips stay shallow / above the rim). Unsupported spans <= ~5.5 m
 * with rim overlap; N<=32.
 *
 * PLAYABLE-WINDOW COMPACTION: framing (src/render/scenes/play/levelFraming.ts)
 * fits spawn<->flag + 2 m pad; climb/descent levels are VERTICALLY framed (the
 * rise/pit is the tall dimension), so their horizontal footprint stays compact
 * while the height fills the screen. Spawn sits ~2.3 m before the near rim and
 * the flag ~1.8 m past the far rim.
 *
 * Coordinates: world meters, y-up. Terrain polylines authored left->right with
 * top-side winding (Terrain.ts reverses internally). Chasm bottoms drop slightly
 * outward from each rim.
 */

import type { GimmickTag, Point, Polyline, Rect } from '../../src/engine/level/LevelSchema';

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
  /** Drives inkBudget = feelFactor x tight-reference ink (game_design §6 legend). */
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
  /** Explicit budget override (anti-dominant budget tuning). */
  readonly inkBudget?: number;
  /** Explicit thresholds override. */
  readonly starThresholds?: { readonly star2: number; readonly star3: number };
}

// -- geometry helpers ------------------------------------------------------------

const p = (x: number, y: number): Point => ({ x, y });

/** Straight two-point stroke a->b. */
function line(ax: number, ay: number, bx: number, by: number): StrokeSource['points'] {
  return [p(ax, ay), p(bx, by)];
}

/**
 * Parabolic arch from (lx,ly) to (rx,ry) with an upward bow of `bow` m at the
 * center. Ends are hit exactly (bow term vanishes at the endpoints). `ly`/`ry`
 * already include the small rest offset above the platform surface. Ends at
 * DIFFERENT y draw a climbing (ry>ly) or descending (ry<ly) ramp-arch.
 */
function arch(lx: number, ly: number, rx: number, ry: number, bow: number, count = 21): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1
    const s = 2 * t - 1; // -1..1
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + bow * (1 - s * s)));
  }
  return points;
}

/** Deliberately wobbly line (FTUE L1 "any sloppy line works"). Deterministic. */
function wobble(lx: number, ly: number, rx: number, ry: number, amp: number, count = 17): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const s = 2 * t - 1;
    const jitter = amp * Math.sin(i * 1.9) * (1 - s * s); // fades to 0 at the ends
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + 0.25 * (1 - s * s) + jitter));
  }
  return points;
}

/** Two-platform gap (left surface leftY, right surface rightY). */
interface Gap {
  readonly leftFar: number;
  readonly leftRim: number;
  readonly leftY: number;
  readonly rightRim: number;
  readonly rightY: number;
  readonly rightFar: number;
  readonly chasmY: number;
}
function twoPlatforms(g: Gap): Polyline[] {
  return [
    [
      [g.leftFar, g.leftY],
      [g.leftRim, g.leftY],
      [g.leftRim - 0.2, g.chasmY],
    ],
    [
      [g.rightRim + 0.2, g.chasmY],
      [g.rightRim, g.rightY],
      [g.rightFar, g.rightY],
    ],
  ];
}

/**
 * Flat-topped mesa rising from the chasm floor (base wider than top). Low topY
 * (~-0.3) = a mid support 中間支点; high topY (~+1.2) = a WALL the stroke must
 * over-arch (∧) to clear (L13). Winding left->right keeps the top solid.
 */
function pillar(cx: number, topY: number, chasmY: number, halfTop = 0.7, halfBase = 1.1): Polyline {
  return [
    [cx - halfBase, chasmY],
    [cx - halfTop, topY],
    [cx + halfTop, topY],
    [cx + halfBase, chasmY],
  ];
}

/** Goal flag rect anchored on the platform surface. */
function flag(x: number, surfaceY: number, width = 1.2, height = 2.2): Rect {
  return { x, y: surfaceY, width, height };
}

/** A rhythm group of coins along an arch drive line. */
function coinArc(cx: number, cy: number, count: number, spacing: number, rise: number): Point[] {
  const coins: Point[] = [];
  const start = cx - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const s = (2 * i) / (count - 1) - 1; // -1..1
    coins.push(p(start + i * spacing, cy + rise * (1 - s * s)));
  }
  return coins;
}

/** Coins strung along a straight A->B line (rewards following a climb/descent). */
function coinLine(ax: number, ay: number, bx: number, by: number, count: number): Point[] {
  const coins: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    coins.push(p(ax + (bx - ax) * t, ay + (by - ay) * t));
  }
  return coins;
}

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // L1 — tiny gap, generous ink, any sloppy line works (FTUE first success <=10 s).
  // Gap centered on x=0 with a ~3.2m playable window; QG-6's drawn arc (x -1.6..1.6)
  // lands on this geometry.
  {
    id: 'ch1-l01',
    design: 'A1 flat · 1.8m gap · any-line-works (tutorial)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -9, leftRim: -0.9, leftY: 0, rightRim: 0.9, rightY: 0, rightFar: 12, chasmY: -5 }),
    vehicleSpawn: p(-3.2, 0.6),
    goalFlag: flag(2.6, 0, 1.5, 2.5),
    killY: -6,
    coins: coinArc(0, 0.9, 5, 0.5, 0.35),
    gimmickTags: [],
    // A visibly sloppy line still makes a firm bridge the brisk car clears.
    strokes: [{ kind: 'any', role: 'wobbly', points: wobble(-2, 0.15, 2, 0.15, 0.18) }],
  },

  // L2 — slightly wider + slight step; teach ink meter/stars (straight -> 3 stars).
  {
    id: 'ch1-l02',
    design: 'A1+ 2.5m gap · slight step · straight=3★ (teach ink/stars)',
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

  // L3 — mid support discovery (resting on the central pillar is cheaper). Non-AD.
  {
    id: 'ch1-l03',
    design: 'A3 4m gap + central pillar 中間支点 (rest-on-pillar is cheaper)',
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

  // L4 — FIRST CLIMB: bridge up to a +2m raised bank (anti-dominant). A straight
  // ramp sags into the gap; the bowed climb arch holds.
  {
    id: 'ch1-l04',
    design: 'A7 3.8m gap · climb to +2.2m raised goal · deep pit · straight sags (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    // Deep pit (-6): a straight ramp — even lifted +1 m — sags into the pit and
    // the car falls; only the bowed climb arch holds (probed: all 9 Gate-3
    // straight candidates fail here, the ghost clears).
    terrain: twoPlatforms({ leftFar: -11, leftRim: -1.9, leftY: 0, rightRim: 1.9, rightY: 2.2, rightFar: 14, chasmY: -6 }),
    vehicleSpawn: p(-4.2, 0.6),
    goalFlag: flag(3.5, 2.2, 1.2, 2.2),
    killY: -8,
    coins: coinLine(-1.5, 0.9, 2.3, 2.5, 6),
    strokes: [{ kind: 'any', role: 'climb-arch', points: arch(-2.4, 0.15, 2.3, 2.35, 0.32) }],
  },

  // L5 — WIDE SAG GAP + low-ish climb: teaches deflection/deep bow over a wide span.
  {
    id: 'ch1-l05',
    design: 'A2 4.4m wide gap · climb to +1.8m · deep bow needed (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.2, leftY: 0, rightRim: 2.2, rightY: 1.8, rightFar: 15, chasmY: -5.5 }),
    vehicleSpawn: p(-4.5, 0.6),
    goalFlag: flag(3.8, 1.8, 1.2, 2.3),
    killY: -6.5,
    coins: coinArc(0, 1.5, 7, 0.5, 0.4),
    strokes: [{ kind: 'any', role: 'deep-arch', points: arch(-2.7, 0.15, 2.6, 1.95, 0.4) }],
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
    coins: [
      ...coinArc(0.3, 1.0, 5, 0.5, 0.35),
      ...coinArc(2.8, 1.2, 6, 0.45, 0.55),
      ...coinArc(4.6, 1.1, 5, 0.4, 0.45),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'straight', points: line(-2.2, 0.15, 2.2, 0.15) }],
  },

  // L6 — BREATHER + FIRST DESCENT: goal sits BELOW the spawn. High start platform,
  // descend a ramp to a low far bank. Uses the portrait height downward. Non-AD.
  {
    id: 'ch1-l06',
    design: 'A8 breather · DESCENT · goal 3.0m BELOW start · varied start/goal',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -11, leftRim: -1.5, leftY: 3.0, rightRim: 1.5, rightY: 0, rightFar: 14, chasmY: -5 }),
    vehicleSpawn: p(-4.0, 3.6),
    goalFlag: flag(3.4, 0, 1.4, 2.4),
    killY: -6,
    coins: coinLine(-1.4, 3.0, 2.2, 0.7, 6),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'descent-ramp', points: arch(-2.0, 3.15, 2.0, 0.15, 0.28) }],
  },

  // L7 — steeper CLIMB (+2.4m) over a 4m gap (anti-dominant).
  {
    id: 'ch1-l07',
    design: 'A7 4.2m gap · climb to +2.6m raised goal · deep pit (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    // Deeper pit (-6) + higher climb (+2.6): defeats the lifted straight ramp
    // (probed all 9 Gate-3 straights fail; ghost clears).
    terrain: twoPlatforms({ leftFar: -11, leftRim: -2.1, leftY: 0, rightRim: 2.1, rightY: 2.6, rightFar: 15, chasmY: -6 }),
    vehicleSpawn: p(-4.4, 0.6),
    goalFlag: flag(3.7, 2.6, 1.2, 2.3),
    killY: -8,
    coins: coinLine(-1.6, 0.9, 2.6, 2.9, 6),
    strokes: [{ kind: 'any', role: 'climb-arch', points: arch(-2.6, 0.15, 2.5, 2.75, 0.34) }],
  },

  // L8 — wide 4.8m gap, climb to +2.5m (anti-dominant, gate3 contract fixture).
  {
    id: 'ch1-l08',
    design: 'A2+A7 4.8m gap · climb to +2.5m raised goal · deep pit (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.4, leftY: 0, rightRim: 2.4, rightY: 2.5, rightFar: 15, chasmY: -6 }),
    vehicleSpawn: p(-4.9, 0.6),
    goalFlag: flag(4.2, 2.5, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 1.9, 6, 0.55, 0.4),
    strokes: [{ kind: 'any', role: 'climb-arch', points: arch(-2.9, 0.15, 2.8, 2.65, 0.34) }],
  },

  // L9 — tight-budget CLIMB (+2.0m) over a 4.4m gap; precise efficient arch. AD.
  {
    id: 'ch1-l09',
    design: 'A7 4.4m gap · climb to +2.0m · TIGHT budget (efficient arch) (AD)',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -11, leftRim: -2.2, leftY: 0, rightRim: 2.2, rightY: 2.0, rightFar: 14, chasmY: -5.5 }),
    vehicleSpawn: p(-4.6, 0.6),
    goalFlag: flag(3.9, 2.0, 1.1, 2.2),
    killY: -6.5,
    coins: coinLine(-1.5, 0.8, 2.5, 2.2, 6),
    strokes: [{ kind: 'any', role: 'efficient-climb', points: arch(-2.7, 0.15, 2.6, 2.15, 0.3) }],
  },

  // L10 — MID CLIMAX: widest+highest so far, 5m gap climb to +2.6m over a deep pit.
  {
    id: 'ch1-l10',
    design: 'A9 CLIMAX · 5m gap · climb to +2.6m · deep pit (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -13, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.6, rightFar: 16, chasmY: -6 }),
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.6, 1.0, 2.2),
    killY: -8,
    coins: coinArc(-0.1, 1.8, 7, 0.55, 0.45),
    strokes: [{ kind: 'any', role: 'climax-arch', points: arch(-3.0, 0.15, 2.9, 2.75, 0.36) }],
  },

  // B2 — bonus after L10: DESCENT + triple coin arch (goal below the high start).
  {
    id: 'ch1-b2',
    design: 'A12 bonus · DESCENT run · goal 2.6m below start · coin arches',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    // Wider rims (±1.5, matching L6's proven descent recipe) keep the landing
    // stable — the narrower ±1.2 gap pitched the car over on the fast descent.
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.5, leftY: 2.6, rightRim: 1.5, rightY: 0, rightFar: 20, chasmY: -5 }),
    vehicleSpawn: p(-4.0, 3.2),
    goalFlag: flag(5.2, 0, 1.5, 2.5),
    killY: -6,
    coins: [
      ...coinArc(0.2, 1.6, 5, 0.5, 0.4),
      ...coinArc(2.6, 1.1, 6, 0.45, 0.5),
      ...coinArc(4.4, 0.9, 5, 0.4, 0.45),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'descent-arch', points: arch(-2.0, 2.75, 2.0, 0.15, 0.28) }],
  },

  // L11 — breather-ish CLIMB (+1.8m) after the climax; gentler slope. AD.
  {
    id: 'ch1-l11',
    design: 'A7 4m gap · climb to +1.8m (sawtooth trough after climax) (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -11, leftRim: -2, leftY: 0, rightRim: 2, rightY: 1.8, rightFar: 14, chasmY: -5 }),
    vehicleSpawn: p(-4.3, 0.6),
    goalFlag: flag(3.6, 1.8, 1.3, 2.3),
    killY: -6,
    coins: coinLine(-1.5, 0.8, 2.6, 2.0, 6),
    strokes: [{ kind: 'any', role: 'gentle-climb', points: arch(-2.5, 0.15, 2.4, 1.95, 0.32) }],
  },

  // L12 — deep GORGE, climb to +2.4m raised ledge (anti-dominant).
  {
    id: 'ch1-l12',
    design: 'A7 5m deep gorge · climb to +2.4m raised ledge (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.4, rightFar: 15, chasmY: -6.5 }),
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.4, 1.0, 2.2),
    killY: -8,
    coins: coinArc(-0.1, 1.7, 6, 0.55, 0.45),
    strokes: [{ kind: 'any', role: 'gorge-climb', points: arch(-3.0, 0.15, 2.9, 2.55, 0.34) }],
  },

  // L13 — WALL OVER-ARCH: a tall central wall (top +1.2m) blocks any straight
  // (it collides with the wall); the stroke must ∧ up-and-over, then settle onto
  // a +1.5m raised bank. The most "how do I draw this" level (anti-dominant).
  {
    id: 'ch1-l13',
    design: 'A6 WALL over-arch · ∧ over +1.2m wall to +1.5m bank (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0, rightRim: 2.3, rightY: 1.5, rightFar: 15, chasmY: -6 }),
      pillar(0, 1.2, -6, 0.5, 0.9), // tall central WALL — straights collide
    ],
    vehicleSpawn: p(-4.7, 0.6),
    goalFlag: flag(4.0, 1.5, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 2.3, 6, 0.5, 0.4),
    strokes: [{ kind: 'any', role: 'over-arch', points: arch(-2.8, 0.15, 2.7, 1.65, 1.4) }],
  },

  // L14 — PRECISION: raised +2.4m goal, narrow flag, tight budget (anti-dominant).
  {
    id: 'ch1-l14',
    design: 'A7 5m gap · climb to +2.4m · NARROW flag · tight (AD)',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.4, rightFar: 15, chasmY: -6 }),
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.4, 1.0, 1.9),
    killY: -8,
    coins: coinArc(-0.1, 1.7, 5, 0.5, 0.4),
    strokes: [{ kind: 'any', role: 'precise-climb', points: arch(-3.0, 0.15, 2.9, 2.55, 0.32) }],
  },

  // L15 — CHAPTER BOSS: longest span + highest climb (+3.2m), deepest pit, tight.
  {
    id: 'ch1-l15',
    design: 'A13 BOSS · 5.4m span · HIGHEST climb to +3.2m · deep pit · tight (AD)',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -13, leftRim: -2.7, leftY: 0, rightRim: 2.7, rightY: 3.2, rightFar: 18, chasmY: -6.5 }),
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.6, 3.2, 1.0, 2.2),
    killY: -8.5,
    coins: coinArc(-0.1, 2.2, 7, 0.55, 0.5),
    strokes: [{ kind: 'any', role: 'boss-climb', points: arch(-3.2, 0.15, 3.1, 3.35, 0.42) }],
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

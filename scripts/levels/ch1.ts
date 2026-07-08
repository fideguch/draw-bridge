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

/**
 * One-sided CEILING/overhang segment: authored right->left so the UNDERSIDE is
 * the solid face (Terrain PORT-CONVENTION: left->right = top solid; overhangs
 * work by authoring the opposite direction). `ya` is the underside y at x1,
 * `yb` at x2 (defaults flat). Blocks strokes/cars approaching from BELOW only.
 */
function ceiling(x1: number, x2: number, ya: number, yb = ya): Polyline {
  return [
    [Math.max(x1, x2), yb],
    [Math.min(x1, x2), ya],
  ];
}

/**
 * Narrow rock SPIKE rising from the chasm floor. Unlike a flat-topped pillar,
 * nothing rests stably on the point: a straight line crossing below the tip
 * collides with the faces and dies, while an authored line can arc over (or
 * rest its apex exactly on) the tip. This is the anti-dominant obstacle that
 * does NOT accidentally support enemy straights — the diversification-pass
 * probes showed flat-topped walls/ledges turn falling straight lines into
 * usable ramps (bot candidates CLEARED off them), spikes never do.
 */
function spike(cx: number, topY: number, chasmY: number, halfBase: number): Polyline {
  return [
    [cx - halfBase, chasmY],
    [cx, topY],
    [cx + halfBase, chasmY],
  ];
}

/**
 * Catmull-Rom spline through control points (`seg` samples per span) — smooth
 * multi-bend ghost strokes (S / U / W shapes). Sharp polyline corners catapult
 * the car at speed (measured: a flat->climb kink launched the car ~1.4m into
 * the air); splined joins keep the drive surface continuous.
 */
function spline(ctrl: readonly Point[], seg = 7): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)] as Point;
    const p1 = ctrl[i] as Point;
    const p2 = ctrl[i + 1] as Point;
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)] as Point;
    for (let j = 0; j < seg; j++) {
      const t = j / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        p(
          0.5 *
            (2 * p1.x +
              (-p0.x + p2.x) * t +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 *
            (2 * p1.y +
              (-p0.y + p2.y) * t +
              (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
              (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        ),
      );
    }
  }
  out.push(ctrl[ctrl.length - 1] as Point);
  return out;
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

  // L9 — LOW-CEILING CORRIDOR (A4 ceiling squeeze): a rock ceiling at +1.35m
  // spans the 5.6m gap. High arches bump the ceiling (probed: a bow-0.9 lazy
  // arch stalls/fails); the solution is a FLAT ink-efficient hug line with
  // modest overlap — teaches restraint. AD: the exact rim-to-rim straight
  // slides in (fall) at this width and the overlapped straights exceed the
  // tight derived budget (infeasible) — probed all 9 candidates fail.
  {
    id: 'ch1-l09',
    design: 'A4 CEILING corridor · 5.6m gap · flat hug line only · restraint (AD)',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2.8, leftY: 0, rightRim: 2.8, rightY: 0, rightFar: 14, chasmY: -6 }),
      ceiling(-1.9, 1.9, 1.35),
    ],
    vehicleSpawn: p(-5.1, 0.6),
    goalFlag: flag(4.4, 0, 1.2, 2.2),
    killY: -7.5,
    coins: coinArc(0, 0.75, 7, 0.5, 0.2),
    strokes: [{ kind: 'any', role: 'flat-hug', points: arch(-3.5, 0.15, 3.45, 0.15, 0.18) }],
  },

  // L10 — MID CLIMAX: TWO-TIER U (A9). Goal across AND 1.5m BELOW the start;
  // the widest chasm yet (7m) with a deep central shelf. The stroke descends
  // into the basin, glides across the shelf, and rises out to the lower far
  // bank (2 bends, span_y ~2.6m of DOWNWARD portrait usage). AD: no straight
  // survives — 7m rim-to-rim chords fall or tip on the violent deep-shelf
  // catch, overlapped ones tip over (probed all 9 fail).
  {
    id: 'ch1-l10',
    design: 'A9 CLIMAX · two-tier U · 7m chasm · goal 1.5m BELOW start (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -3.5, leftY: 0, rightRim: 3.5, rightY: -1.5, rightFar: 16, chasmY: -6.8 }),
      // Deep NARROW shelf: the chain sags onto it mid-U (support) but a falling
      // straight lands violently and teeters off (halfTop 0.6 — probed: wider
      // 1.0 tops let one floating straight settle into a rideable ramp).
      pillar(0, -2.4, -6.8, 0.6, 1.2),
    ],
    vehicleSpawn: p(-5.8, 0.6),
    goalFlag: flag(5.1, -1.5, 1.0, 2.2),
    killY: -8.2,
    coins: [...coinLine(-2.6, -0.6, -1.0, -1.4, 4), ...coinLine(0.9, -1.4, 2.6, -1.0, 4)],
    strokes: [
      {
        kind: 'any',
        role: 'u-glide',
        // Probed 4x on a recycled world: clears every run (t 250-254); all 9
        // bot candidates fail 3/3 runs each.
        points: spline([
          p(-3.9, 0.12),
          p(-2.7, -0.9),
          p(-1.5, -1.65),
          p(-0.4, -1.92),
          p(0.7, -1.88),
          p(1.8, -1.68),
          p(3.9, -1.36),
        ]),
      },
    ],
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

  // L12 — OVERHANG DUCK-UNDER (A5): a rock lip (winding-reversed, underside
  // solid) protrudes from the left rim over the gorge at 1.5->1.25m. The
  // natural climb arch to the +2.4m ledge collides with the lip (probed: the
  // arch is at ~1.48m under the lip tip); the line must HUG LOW under the lip,
  // then sweep up — a smooth S with 2 bends. Straights still die on the
  // raised-goal/deep-pit mechanism (probed all 9 fail; ov2 infeasible).
  {
    id: 'ch1-l12',
    design: 'A5 OVERHANG duck-under · 5m gorge · low hug then climb +2.4m (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.4, rightFar: 15, chasmY: -6.5 }),
      ceiling(-2.25, -0.55, 1.5, 1.25), // rock lip over the left half of the gorge
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.4, 1.0, 2.2),
    killY: -8,
    coins: [...coinLine(-1.9, 0.62, -0.7, 0.66, 4), ...coinLine(0.4, 1.5, 2.6, 2.8, 4)],
    strokes: [
      {
        kind: 'any',
        role: 'duck-under-S',
        points: spline([
          p(-3.0, 0.16),
          p(-1.8, 0.1),
          p(-0.6, 0.14),
          p(0.3, 0.62),
          p(1.2, 1.35),
          p(2.1, 2.0),
          p(3.0, 2.42),
          p(3.6, 2.6),
        ]),
      },
    ],
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

  // L14 — SWITCHBACK DESCENT (A10): the goal sits 2.6m BELOW the start. A
  // two-terrace stair is carved into the LEFT platform (BEHIND the gap rim —
  // physically unreachable by rim-to-rim straights), then a rock spike rises
  // from the chasm to -0.65m just past the stair exit: every straight chord
  // crosses well BELOW the tip and dies on its faces (probed: all 9 fail —
  // divergence/timeout/fall chewed up by the spike). The intended line is a
  // W: zig-zag down the stair (2 bends), hump up OVER the spike tip using the
  // stair momentum (3rd bend), long descent to the low bank (4th) — the
  // longest stroke in the chapter (~10.5m), ~2.7m of downward portrait span.
  // Ghost re-probed 4x on a recycled world: clears every run (t 308-329).
  {
    id: 'ch1-l14',
    design: 'A10 SWITCHBACK · stair down 2 terraces + spike hump · goal 2.6m BELOW (AD)',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      // Left platform with the carved two-step stair ending at the gap rim.
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
      spike(-0.4, -0.65, -7.0, 1.0), // spike just past the stair — straight-line killer
    ],
    vehicleSpawn: p(-5.9, 0.6),
    goalFlag: flag(3.9, -2.6, 1.1, 2.2),
    killY: -8.5,
    coins: [...coinLine(-4.4, -0.3, -2.9, -1.2, 4), ...coinArc(-0.4, 0.0, 5, 0.55, 0.25), ...coinLine(1.6, -0.9, 3.0, -1.8, 4)],
    strokes: [
      {
        kind: 'any',
        role: 'switchback-W',
        points: spline([
          p(-5.3, 0.12),
          p(-4.7, -0.35),
          p(-4.2, -0.78),
          p(-3.6, -0.8),
          p(-3.2, -1.35),
          p(-2.75, -1.62),
          p(-1.9, -1.2),
          p(-1.1, -0.72),
          p(-0.4, -0.5),
          p(0.4, -0.75),
          p(1.4, -1.25),
          p(2.6, -1.9),
          p(3.8, -2.45),
        ]),
      },
    ],
  },

  // L15 — CHAPTER BOSS (A13 compound): 7m chasm + climb to a +3.2m summit +
  // a 1.6m rock spike mid-gap + a ceiling shelf over the approach. The line
  // is a long (~8.7m) convex climb anchored on the platform, threading under
  // the ceiling, over the spike, easing across the shoulder, and re-rising to
  // the summit bank — 3 slope changes, ~3.3m of vertical span. AD: rim-to-rim
  // straights fall (7m to +3.2 is unholdable), overlapped straights exceed
  // the derived budget (probed all 9 fail).
  {
    id: 'ch1-l15',
    design: 'A13 BOSS compound · 7m chasm + spike + ceiling · climb +3.2m (AD)',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -3.5, leftY: 0, rightRim: 3.5, rightY: 3.2, rightFar: 18, chasmY: -6.5 }),
      spike(-0.4, 1.6, -6.5, 0.8), // mid-gap spike — blocks low/lazy lines
      ceiling(-3.1, -2.0, 2.75), // approach shelf — blocks high lazy entries
    ],
    vehicleSpawn: p(-5.9, 0.6),
    goalFlag: flag(5.0, 3.2, 1.0, 2.2),
    killY: -8.5,
    coins: [...coinLine(-2.9, 1.5, -0.6, 2.7, 5), ...coinArc(2.6, 3.5, 4, 0.5, 0.3)],
    strokes: [
      {
        kind: 'any',
        role: 'boss-compound',
        points: spline([
          p(-4.0, 0.15),
          p(-3.0, 0.95),
          p(-2.0, 1.6),
          p(-1.0, 2.05),
          p(0.0, 2.3),
          p(1.0, 2.45),
          p(2.0, 2.7),
          p(3.0, 3.05),
          p(3.9, 3.38),
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

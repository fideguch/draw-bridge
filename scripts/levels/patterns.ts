/**
 * Spatial-pattern catalog + geometry helpers (round-4 spatial-puzzle overhaul,
 * research/11_spatial_patterns.md). This is the single grep-able LIBRARY the
 * mandate asks for ("地形パターン +30 以上"): every catalog entry is an exported
 * `function` so `grep -o 'export function [a-zA-Z]*' patterns.ts` enumerates the
 * whole set. ch1.ts imports the ones Chapter 1 uses; the rest are correct,
 * parameterized STOCK for Ch2+ (research §4.3 lists 24 unused patterns to keep
 * the mechanic pipeline from running dry when chapters are added).
 *
 * Two kinds of builders:
 *   1. TERRAIN builders return Polyline fragments (spread into a level's
 *      `terrain`). Winding convention (Terrain.ts / TerrainSolids.ts): authored
 *      left->right = TOP solid (ground/plateau/pillar); authored right->left =
 *      UNDERSIDE solid (ceiling/overhang). ROUND-9 (AC-4, designer ban): all
 *      SPIKE / needle terrain builders are REMOVED (spike / steppingStones /
 *      spikePit / spikeField). New content clips a lazy line with plain WALL /
 *      pillar crowns (a narrow flat-top pillar is kept NARROW so a falling
 *      straight cannot settle into a rideable ramp).
 *   2. STROKE-SHAPE builders return the ink polyline (Point[]) the ghost draws:
 *      Line / Hump∧ / Scoop⌣ / Ramp / S / W / M / Flat-hug. Multi-bend shapes go
 *      through a Catmull-Rom spline so sharp corners never catapult the car
 *      (measured ~1.4 m launch off a flat->climb kink, ch1.ts note).
 *
 * Pure geometry: no Box2D, y-up world meters, inputs never mutated.
 */

import type { Point, Polyline, PolylinePoint, Rect } from '../../src/engine/level/LevelSchema';

/** Point constructor (ink strokes, coins). */
export const p = (x: number, y: number): Point => ({ x, y });
/** Terrain vertex constructor. */
const v = (x: number, y: number): PolylinePoint => [x, y];

// =================================================================================
// STROKE-SHAPE BUILDERS (the ink line the ghost draws)
// =================================================================================

/** Straight two-point stroke a->b (Line). */
export function line(ax: number, ay: number, bx: number, by: number): Point[] {
  return [p(ax, ay), p(bx, by)];
}

/**
 * Parabolic bow from (lx,ly) to (rx,ry), `bow` m of vertical offset at center
 * (+ up = Hump∧, - down = Scoop⌣). Ends hit exactly (bow vanishes at endpoints);
 * different end y draws a climbing/descending ramp-arch.
 */
export function arch(lx: number, ly: number, rx: number, ry: number, bow: number, count = 21): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const s = 2 * t - 1;
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + bow * (1 - s * s)));
  }
  return points;
}

/** Upward Hump∧ (arch with positive bow) — clears a wall/spike between anchors. */
export function hump(lx: number, ly: number, rx: number, ry: number, bow = 0.8, count = 21): Point[] {
  return arch(lx, ly, rx, ry, Math.abs(bow), count);
}

/** Downward Scoop⌣ (arch with negative bow) — dips through a valley / onto a fulcrum. */
export function scoop(lx: number, ly: number, rx: number, ry: number, dip = 0.4, count = 21): Point[] {
  return arch(lx, ly, rx, ry, -Math.abs(dip), count);
}

/** Monotonic climb/descent Ramp (a near-straight line with a hair of bow for firmness). */
export function rampStroke(lx: number, ly: number, rx: number, ry: number, bow = 0.12, count = 17): Point[] {
  return arch(lx, ly, rx, ry, bow, count);
}

/** Near-flat hug line (E01/E03: stay LOW under a ceiling, slight bow for firmness). */
export function flatHug(lx: number, ly: number, rx: number, ry: number, bow = 0.18, count = 21): Point[] {
  return arch(lx, ly, rx, ry, bow, count);
}

/** Deliberately wobbly line (FTUE "any sloppy line works"). Deterministic. */
export function wobble(lx: number, ly: number, rx: number, ry: number, amp: number, count = 17): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const s = 2 * t - 1;
    const jitter = amp * Math.sin(i * 1.9) * (1 - s * s);
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + 0.25 * (1 - s * s) + jitter));
  }
  return points;
}

/**
 * Catmull-Rom spline through control points (`seg` samples/span) — smooth S / U /
 * W / M multi-bend strokes. Sharp polyline corners catapult the car at speed;
 * splined joins keep the drive surface continuous.
 */
export function spline(ctrl: readonly Point[], seg = 7): Point[] {
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
          0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        ),
      );
    }
  }
  out.push(ctrl[ctrl.length - 1] as Point);
  return out;
}

/** S-bend (1 inflection) through control points — a splined convenience alias. */
export function sBend(ctrl: readonly Point[], seg = 7): Point[] {
  return spline(ctrl, seg);
}
/** W-bend (2+ inflections, zig-zag) — a splined convenience alias. */
export function wBend(ctrl: readonly Point[], seg = 7): Point[] {
  return spline(ctrl, seg);
}
/** M-bend (two humps over two walls) — a splined convenience alias. */
export function mBend(ctrl: readonly Point[], seg = 7): Point[] {
  return spline(ctrl, seg);
}

// =================================================================================
// COIN RHYTHM BUILDERS (auto-placement re-derives from the ghost route; these are
// the AUTHORED count/rhythm the pipeline preserves)
// =================================================================================

/** Coins along an arch drive line. */
export function coinArc(cx: number, cy: number, count: number, spacing: number, rise: number): Point[] {
  const coins: Point[] = [];
  const start = cx - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const s = (2 * i) / (count - 1) - 1;
    coins.push(p(start + i * spacing, cy + rise * (1 - s * s)));
  }
  return coins;
}

/** Coins strung along a straight A->B line. */
export function coinLine(ax: number, ay: number, bx: number, by: number, count: number): Point[] {
  const coins: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    coins.push(p(ax + (bx - ax) * t, ay + (by - ay) * t));
  }
  return coins;
}

// =================================================================================
// TERRAIN PRIMITIVES
// =================================================================================

/** Goal flag rect anchored on a platform surface. */
export function flag(x: number, surfaceY: number, width = 1.2, height = 2.2): Rect {
  return { x, y: surfaceY, width, height };
}

/** Two-platform gap (left surface leftY, right surface rightY, chasm floor chasmY). */
export interface Gap {
  readonly leftFar: number;
  readonly leftRim: number;
  readonly leftY: number;
  readonly rightRim: number;
  readonly rightY: number;
  readonly rightFar: number;
  readonly chasmY: number;
}
export function twoPlatforms(g: Gap): Polyline[] {
  return [
    [v(g.leftFar, g.leftY), v(g.leftRim, g.leftY), v(g.leftRim - 0.2, g.chasmY)],
    [v(g.rightRim + 0.2, g.chasmY), v(g.rightRim, g.rightY), v(g.rightFar, g.rightY)],
  ];
}

/**
 * Flat-topped mesa rising from the chasm floor (base wider than top). Low topY =
 * a mid support 中間支点; high topY = a WALL the stroke must over-arch. Narrow
 * halfTop keeps a falling straight from settling into a rideable ramp (research
 * §2: wide flat tops break anti-dominance). Winding left->right keeps top solid.
 */
export function pillar(cx: number, topY: number, chasmY: number, halfTop = 0.7, halfBase = 1.1): Polyline {
  return [v(cx - halfBase, chasmY), v(cx - halfTop, topY), v(cx + halfTop, topY), v(cx + halfBase, chasmY)];
}

/**
 * One-sided CEILING/overhang: authored right->left so the UNDERSIDE is solid
 * (Terrain PORT-CONVENTION). `ya` = underside y at x1, `yb` at x2 (default flat).
 * Blocks strokes/cars approaching from BELOW only. Must stay a 2-point polyline
 * so the atlas renders it as a rock lip.
 */
export function ceiling(x1: number, x2: number, ya: number, yb = ya): Polyline {
  return [v(Math.max(x1, x2), yb), v(Math.min(x1, x2), ya)];
}

// =================================================================================
// PATTERN CATALOG — Family A: GAP crossing
// =================================================================================

/** A01 Flat Bridge — a plain same-height gap (tutorial). Alias of twoPlatforms. */
export function flatBridge(g: Gap): Polyline[] {
  return twoPlatforms(g);
}

/** A03 Twin Gap — a central mesa island splits the crossing into two short spans. */
export function twinGap(g: Gap, mesaX: number, mesaTopY: number, halfTop = 0.9): Polyline[] {
  return [...twoPlatforms(g), pillar(mesaX, mesaTopY, g.chasmY, halfTop, halfTop + 0.5)];
}

/** A04 Cantilever — a single anchored ledge reaching toward a far rim (stock). */
export function cantilever(x0: number, x1: number, y: number, chasmY: number): Polyline {
  return [v(x0, y), v(x1, y), v(x1 + 0.2, chasmY)];
}

/** A05 Long Traverse — a row of low support pillars across a wide chasm. */
export function longTraverse(xs: readonly number[], topY: number, chasmY: number): Polyline[] {
  return xs.map((x) => pillar(x, topY, chasmY, 0.5, 0.9));
}

// =================================================================================
// PATTERN CATALOG — Family B: FULCRUM
// =================================================================================

/** B01 Mid Pillar — one narrow central fulcrum (rest-on-pillar = two short spans). */
export function midPillar(g: Gap, topY = -0.3, halfTop = 0.7): Polyline {
  return pillar(0, topY, g.chasmY, halfTop, halfTop + 0.4);
}

/** B02 Off-Center Pillar — a fulcrum shifted off center (asymmetric two-span). */
export function offCenterPillar(g: Gap, cx: number, topY = -0.3): Polyline {
  return pillar(cx, topY, g.chasmY, 0.6, 1.0);
}

/** B04 Pillar Forest — a dense row of short fulcrums (small-amplitude W to touch all). */
export function pillarForest(xs: readonly number[], topY: number, chasmY: number): Polyline[] {
  return xs.map((x) => pillar(x, topY, chasmY, 0.35, 0.55));
}

// B05 Stepping Stones (spike-tip row) REMOVED round-9 (AC-4 spike ban). Flat-top
// stepping pillars are the replacement; use `pillar()` / `longTraverse()`.

// =================================================================================
// PATTERN CATALOG — Family C: CLIMB / Family D: DESCENT (stairs & ramps)
// =================================================================================

/**
 * A carved staircase from (x0,y0) rising/falling by `stepDy` over `stepDx` for
 * `stepCount` steps, then dropping to a chasm floor. Ascending (stepDy>0) =
 * C03 Terraced Ascent; descending (stepDy<0) = D04 Switchback base. Authored
 * left->right so every tread is top-solid.
 */
export function steps(
  x0: number,
  y0: number,
  stepDx: number,
  stepDy: number,
  stepCount: number,
  chasmY: number,
): Polyline {
  const poly: PolylinePoint[] = [v(x0 - 2, y0)];
  let x = x0;
  let y = y0;
  for (let i = 0; i < stepCount; i++) {
    poly.push(v(x, y));
    x += stepDx;
    poly.push(v(x, y));
    y += stepDy;
    poly.push(v(x, y));
  }
  poly.push(v(x + 0.05, chasmY));
  return poly;
}

/** C03 Terraced Ascent — a rising staircase into a raised bank. */
export function terracedAscent(x0: number, y0: number, stepDx: number, stepDy: number, stepCount: number, chasmY: number): Polyline {
  return steps(x0, y0, stepDx, Math.abs(stepDy), stepCount, chasmY);
}

/** D04 Switchback Stair — a descending staircase off the near rim (used by L14). */
export function switchbackStair(x0: number, y0: number, stepDx: number, stepDy: number, stepCount: number, chasmY: number): Polyline {
  return steps(x0, y0, stepDx, -Math.abs(stepDy), stepCount, chasmY);
}

/** C04 Notched Plateau / Battlement — a wall with a U notch to land inside (stock). */
export function notchedPlateau(cx: number, topY: number, notchHalf: number, chasmY: number, halfBase = 1.4): Polyline {
  return [
    v(cx - halfBase, chasmY),
    v(cx - halfBase + 0.3, topY),
    v(cx - notchHalf, topY),
    v(cx - notchHalf, topY - 0.8),
    v(cx + notchHalf, topY - 0.8),
    v(cx + notchHalf, topY),
    v(cx + halfBase - 0.3, topY),
    v(cx + halfBase, chasmY),
  ];
}

/** D02/H04 Bowl — a deep U basin the car drops into and rolls across (single polyline). */
export function bowl(x0: number, x1: number, rimY: number, bottomY: number, chasmY: number): Polyline {
  const cx = (x0 + x1) / 2;
  return [
    v(x0 - 1.5, rimY),
    v(x0, rimY),
    v(cx, bottomY),
    v(x1, rimY),
    v(x1 + 1.5, rimY),
    v(x1 + 1.5, chasmY),
  ];
}

/** G04 Canted Platform — a fixed tilted landing pad (static pseudo-seesaw, stock). */
export function cantedPlatform(x0: number, x1: number, y0: number, y1: number, chasmY: number): Polyline {
  return [v(x0 - 0.2, chasmY), v(x0, y0), v(x1, y1), v(x1 + 0.2, chasmY)];
}

// =================================================================================
// PATTERN CATALOG — Family E: CEILING obstacles
// =================================================================================

/** E02 Overhang Lip — a short downward rock lip from a rim (alias of ceiling). */
export function overhangLip(x1: number, x2: number, ya: number, yb = ya): Polyline {
  return ceiling(x1, x2, ya, yb);
}

/** E03 Tunnel / Pipe — a floor + a parallel ceiling forming a low corridor (stock). */
export function tunnel(x0: number, x1: number, floorY: number, ceilY: number, chasmY: number): Polyline[] {
  return [
    [v(x0 - 1, floorY), v(x0, floorY), v(x1, floorY), v(x1 + 1, floorY), v(x1 + 1, chasmY)],
    ceiling(x0, x1, ceilY),
  ];
}

/** E04 Ceiling Teeth — a row of short downward stalactites to weave under (stock). */
export function ceilingTeeth(xs: readonly number[], baseY: number, toothY: number): Polyline[] {
  return xs.map((x) => ceiling(x - 0.25, x + 0.25, baseY, toothY));
}

/** E05 Low Lintel Gate — two ceilings leaving a narrow central slot to thread (stock). */
export function lintelGate(x0: number, x1: number, slotHalf: number, ceilY: number): Polyline[] {
  const cx = (x0 + x1) / 2;
  return [ceiling(x0, cx - slotHalf, ceilY), ceiling(cx + slotHalf, x1, ceilY)];
}

// =================================================================================
// PATTERN CATALOG — Family F: WALL obstacles
// =================================================================================

/** F01 Wall — a tall central wall the stroke must over-arch (∧). Narrow top. */
export function wall(cx: number, topY: number, chasmY: number, halfTop = 0.5, halfBase = 0.9): Polyline {
  return pillar(cx, topY, chasmY, halfTop, halfBase);
}

/** F03 Double Wall — two tall walls demanding an M-shaped over-and-over (stock). */
export function doubleWall(cxA: number, cxB: number, topY: number, chasmY: number): Polyline[] {
  return [wall(cxA, topY, chasmY), wall(cxB, topY, chasmY)];
}

/** F04 Hourglass Neck — walls converging from above and below into a narrow neck (stock). */
export function funnel(cx: number, neckHalf: number, topY: number, chasmY: number): Polyline[] {
  return [
    [v(cx - 2, chasmY), v(cx - neckHalf, topY - 0.6), v(cx - neckHalf, chasmY)],
    ceiling(cx - neckHalf, cx + neckHalf, topY + 0.9),
  ];
}

// =================================================================================
// PATTERN CATALOG — Family G: TRAP geometry
// =================================================================================

// G01 Spike Pit + G02 Spike Corridor REMOVED round-9 (AC-4 spike ban). A central
// WALL crown (`wall()`) is the diversification-safe straight-killer replacement.

/** D03 Chimney / Drop Shaft — two facing vertical walls forming a descent shaft (stock). */
export function chimney(cx: number, half: number, topY: number, chasmY: number): Polyline[] {
  return [
    [v(cx - half - 0.6, chasmY), v(cx - half, topY), v(cx - half, chasmY)],
    [v(cx + half, chasmY), v(cx + half, topY), v(cx + half + 0.6, chasmY)],
  ];
}

// =================================================================================
// PATTERN CATALOG — Family H: COMPOUND corridors
// =================================================================================

/** H01 S-Corridor — an overhang above + a wall below, offset, to weave an S (stock). */
export function sCorridor(g: Gap, wallX: number, wallTopY: number, lipX0: number, lipX1: number, lipY: number): Polyline[] {
  return [...twoPlatforms(g), wall(wallX, wallTopY, g.chasmY), ceiling(lipX0, lipX1, lipY)];
}

/** H05 Two-Tier Valley — a narrow mid shelf inside a deep chasm (U-glide support). */
export function twoTierValley(g: Gap, shelfY: number, halfTop = 0.6): Polyline[] {
  return [...twoPlatforms(g), pillar(0, shelfY, g.chasmY, halfTop, halfTop + 0.6)];
}

/**
 * strokeMath — pure geometry for live stroke input + rendering (T046, FR-001).
 *
 * Two responsibilities, both Phaser-free and unit-tested (render-logic.spec.ts):
 *
 * 1. Vertex thinning (game_design §4.1 1-2): a new vertex is only appended once
 *    the pointer has moved >= draw.minPointDistPx from the last kept vertex.
 *    This is a SCREEN-space test — StrokeInput feeds it raw pointer pixels.
 *
 * 2. Past-only smoothing (game_design §4.1 1-1, THE zero-latency rule): the live
 *    tip must render at the raw touch coordinate, so buildStrokePath smooths
 *    every point EXCEPT the last two, which it appends verbatim. The output's
 *    final two entries are therefore always reference-equal to the input's — the
 *    tip never lags a frame behind the finger.
 *
 * Catmull-Rom is the uniform (centripetal-free) spline; endpoints clamp their
 * missing neighbour to themselves.
 */

import type { Point } from '@engine/level/LevelSchema';

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Should `candidate` be appended given the last kept vertex? True once the
 * pointer has travelled at least `minDist` (the min-vertex-distance gate).
 */
export function shouldAppendPoint(lastKept: Point, candidate: Point, minDist: number): boolean {
  return distance(lastKept, candidate) >= minDist;
}

/**
 * Greedy min-distance thinning of a raw point sequence: keep the first point,
 * then keep each subsequent point only once it is >= minDist from the last kept
 * one. Models the vertex-add gate over a whole captured path (pure, for tests).
 */
export function thinByMinDistance(points: readonly Point[], minDist: number): Point[] {
  if (points.length === 0) {
    return [];
  }
  const kept: Point[] = [points[0] as Point];
  for (let i = 1; i < points.length; i++) {
    const candidate = points[i] as Point;
    const last = kept[kept.length - 1] as Point;
    if (shouldAppendPoint(last, candidate, minDist)) {
      kept.push(candidate);
    }
  }
  return kept;
}

/** Uniform Catmull-Rom interpolation between p1 and p2 (p0/p3 are tangents). */
export function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (v0: number, v1: number, v2: number, v3: number): number =>
    0.5 * (2 * v1 + (v2 - v0) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (3 * v1 - 3 * v2 + v3 - v0) * t3);
  return { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * Build the render path from captured stroke points: Catmull-Rom smooth every
 * point except the last two, then append the last two RAW so the tip stays on
 * the finger (game_design §4.1 1-1). `subdivisions` sets spline resolution.
 *
 * <= 3 points is returned unchanged (too short to smooth without moving the
 * tip); this trivially satisfies "last two are raw" as well.
 */
export function buildStrokePath(points: readonly Point[], subdivisions = 6): Point[] {
  const n = points.length;
  if (n <= 3) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }
  const at = (i: number): Point => points[Math.min(Math.max(i, 0), n - 1)] as Point;
  const result: Point[] = [at(0)];
  // Smooth spans between anchors 0 .. n-3; anchors n-2 and n-1 stay raw.
  const lastSmoothAnchor = n - 3;
  for (let i = 0; i < lastSmoothAnchor; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 1; s <= subdivisions; s++) {
      result.push(catmullRom(p0, p1, p2, p3, s / subdivisions));
    }
  }
  // Append the last two points verbatim (raw tip segment).
  result.push(points[n - 2] as Point);
  result.push(points[n - 1] as Point);
  return result;
}

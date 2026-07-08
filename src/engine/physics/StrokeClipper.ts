/**
 * StrokeClipper — clip a raw stroke polyline against terrain solids so no part
 * of a committed line can exist INSIDE solid ground (round-4 bug: "線が引けない
 * 土台があります" + a line draped diagonally THROUGH a plateau corner).
 *
 * Competitor standard: the line simply cannot live inside a solid. This splits
 * the polyline into maximal OUTSIDE runs, cutting FLUSH at the terrain surface
 * (interpolated boundary crossings) so a kept run ends exactly on the surface
 * and reads as an anchor resting on it. GameSimulation.commitStroke keeps the
 * LONGEST run (by arc length); if that is below the pipeline minimum it falls
 * through the existing rejection path (deny feedback).
 *
 * Determinism / no-op guarantee: a stroke that never enters or crosses a solid
 * is returned UNCHANGED (the same array reference), so open-air strokes — every
 * recorded ghost, the determinism probe — commit byte-identically to before.
 *
 * Pure geometry: no Box2D, input never mutated.
 */

import type { Point } from '../level/LevelSchema';
import type { TerrainSolids } from './TerrainSolids';
import { isPointInSolids } from './TerrainSolids';

export interface StrokeClipResult {
  /** True when clipping removed or split any part of the polyline. */
  readonly clipped: boolean;
  /** Longest OUTSIDE run by arc length; the committed stroke. Empty when none. */
  readonly longestRun: readonly Point[];
  /** Every OUTSIDE run in draw order, each flush at the solids it borders. */
  readonly runs: readonly (readonly Point[])[];
}

/** Below this the two params of a crossing coincide with a segment endpoint. */
const T_EPS = 1e-9;
/** Segments more parallel than this are treated as non-crossing (no unique t). */
const DENOM_EPS = 1e-12;

/**
 * Parameter t ∈ (0,1) along A→B where it transversally crosses edge C→D, or
 * null. Endpoints of the polygon edge (u ∈ [0,1]) count; grazing at the very
 * ends of A→B (t at 0/1) does not.
 */
function crossParam(a: Point, b: Point, c: Point, d: Point): number | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < DENOM_EPS) {
    return null; // parallel / collinear — no single crossing
  }
  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t > T_EPS && t < 1 - T_EPS && u >= -T_EPS && u <= 1 + T_EPS) {
    return t;
  }
  return null;
}

/** All crossing t's of segment A→B against every solid edge, sorted + deduped. */
function crossingTs(a: Point, b: Point, solids: TerrainSolids): number[] {
  const ts: number[] = [];
  for (const polygon of solids.polygons) {
    const verts = polygon.vertices;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i, i++) {
      const t = crossParam(a, b, verts[j] as Point, verts[i] as Point);
      if (t !== null) {
        ts.push(t);
      }
    }
  }
  ts.sort((x, y) => x - y);
  const unique: number[] = [];
  for (const t of ts) {
    const prev = unique[unique.length - 1];
    if (prev === undefined || t - prev > T_EPS) {
      unique.push(t);
    }
  }
  return unique;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function arcLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const q = points[i + 1] as Point;
    total += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return total;
}

/**
 * Clip `points` to the parts OUTSIDE `solids`. Returns the input unchanged when
 * nothing intersects a solid (byte-identical no-op — see module header).
 */
export function clipStrokeToSolids(points: readonly Point[], solids: TerrainSolids): StrokeClipResult {
  if (solids.polygons.length === 0 || points.length < 2) {
    return { clipped: false, longestRun: points, runs: [points] };
  }

  // Cheap no-op scan: no vertex inside and no segment crossing ⇒ passthrough.
  let hasSolidContact = points.some((p) => isPointInSolids(p, solids));
  if (!hasSolidContact) {
    for (let i = 0; i < points.length - 1 && !hasSolidContact; i++) {
      if (crossingTs(points[i] as Point, points[i + 1] as Point, solids).length > 0) {
        hasSolidContact = true;
      }
    }
  }
  if (!hasSolidContact) {
    return { clipped: false, longestRun: points, runs: [points] };
  }

  const runs: Point[][] = [];
  let current: Point[] = [];
  const appendPoint = (run: Point[], p: Point): void => {
    const last = run[run.length - 1];
    if (last === undefined || last.x !== p.x || last.y !== p.y) {
      run.push(p);
    }
  };
  const flush = (): void => {
    if (current.length >= 2) {
      runs.push(current);
    }
    current = [];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const breakpoints = [0, ...crossingTs(a, b, solids), 1];
    for (let k = 0; k < breakpoints.length - 1; k++) {
      const ta = breakpoints[k] as number;
      const tb = breakpoints[k + 1] as number;
      if (tb - ta <= T_EPS) {
        continue;
      }
      const isMidInside = isPointInSolids(lerp(a, b, (ta + tb) / 2), solids);
      if (isMidInside) {
        flush();
      } else {
        appendPoint(current, ta === 0 ? a : lerp(a, b, ta));
        appendPoint(current, tb === 1 ? b : lerp(a, b, tb));
      }
    }
  }
  flush();

  let longestRun: readonly Point[] = [];
  let bestLength = -1;
  for (const run of runs) {
    const length = arcLength(run);
    if (length > bestLength) {
      bestLength = length;
      longestRun = run;
    }
  }
  return { clipped: true, longestRun, runs };
}

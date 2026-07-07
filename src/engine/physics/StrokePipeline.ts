/**
 * StrokePipeline — committed stroke geometry processing (FR-001, FR-003).
 *
 * rawPoints (world meters) -> RDP simplify (draw.rdpEpsilon)
 *   -> equal-interval resample at physics.segmentLength
 *   -> capsule segment endpoint pairs for BridgeChainBuilder.
 *
 * Pure geometry: no Box2D dependency, deterministic, input never mutated.
 * Stage names follow the UL: raw -> simplified -> resampled (data-model §1.2).
 *
 * Min-length rule: a stroke with < 2 points, zero length, or shorter than one
 * segment length is discarded — the ink refund itself is the caller's job
 * (FR-003; refund equals the raw stroke's decremented ink).
 *
 * Segment count: N = round(totalLength / segmentLength), clamped to
 * [SEGMENT_COUNT_MIN, physics.segmentCountMax]. The floor of 2 guarantees at
 * least one revolute joint exists (a 1-segment "chain" has zero joints, so no
 * sag/creak/break physics — V12 contract intent). Natural bridge strokes
 * resample to 8+ segments; the floor only ever bites the shortest kept strokes
 * (down to one segmentLength). Strokes longer than cap x segmentLength are
 * clamped by increasing the EFFECTIVE segment length (totalLength / N) rather
 * than truncating the stroke.
 */

import type { Point } from '../level/LevelSchema';
import { draw, physics } from '@tuning/TuningConstants';

/** Capsule endpoints for one bridge segment (input to BridgeChainBuilder). */
export interface StrokeSegment {
  readonly a: Point;
  readonly b: Point;
}

export type StrokeDiscardReason = 'tooFewPoints' | 'tooShort';

/**
 * Minimum capsule segment count of a built bridge (V12: [2, segmentCountMax]).
 * Floor of 2 keeps >= 1 revolute joint so chain sag/creak/break physics exist.
 */
export const SEGMENT_COUNT_MIN = 2;

export type StrokePipelineResult =
  | { readonly discarded: true; readonly reason: StrokeDiscardReason }
  | {
      readonly discarded: false;
      /** RDP-simplified polyline (the stage persisted into GhostSolution.stroke). */
      readonly simplified: readonly Point[];
      /** Equal-interval resampled polyline (N + 1 points). */
      readonly resampled: readonly Point[];
      /** N capsule endpoint pairs; segments[i].b === segments[i+1].a. */
      readonly segments: readonly StrokeSegment[];
      /** Arc length of the simplified polyline in meters (= ink consumed). */
      readonly totalLength: number;
    };

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Perpendicular distance from `p` to segment `a`-`b` (degenerate-safe). */
function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return distance(p, a);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }
  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;

  let maxDistance = -1;
  let maxIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i] as Point, first, last);
    if (d > maxDistance) {
      maxDistance = d;
      maxIndex = i;
    }
  }

  if (maxDistance <= epsilon) {
    return [
      { x: first.x, y: first.y },
      { x: last.x, y: last.y },
    ];
  }
  const left = rdp(points.slice(0, maxIndex + 1), epsilon);
  const right = rdp(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** RDP simplification with epsilon from TuningConstants (draw.rdpEpsilon). */
export function simplifyStroke(rawPoints: readonly Point[]): readonly Point[] {
  return rdp(rawPoints, draw.rdpEpsilon);
}

function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += distance(points[i] as Point, points[i + 1] as Point);
  }
  return total;
}

/**
 * Resample `points` into `count + 1` vertices equally spaced by arc length.
 * Endpoints are preserved exactly (last point set explicitly, no drift).
 */
export function resampleStroke(points: readonly Point[], count: number): readonly Point[] {
  const totalLength = polylineLength(points);
  const step = totalLength / count;
  const first = points[0] as Point;
  const resampled: Point[] = [{ x: first.x, y: first.y }];

  let sourceIndex = 0;
  let walked = 0; // arc length consumed up to points[sourceIndex]
  for (let k = 1; k < count; k++) {
    const targetArc = k * step;
    while (sourceIndex < points.length - 2) {
      const segLength = distance(points[sourceIndex] as Point, points[sourceIndex + 1] as Point);
      if (walked + segLength >= targetArc) {
        break;
      }
      walked += segLength;
      sourceIndex++;
    }
    const a = points[sourceIndex] as Point;
    const b = points[sourceIndex + 1] as Point;
    const segLength = distance(a, b);
    const t = segLength === 0 ? 0 : (targetArc - walked) / segLength;
    resampled.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  }

  const last = points[points.length - 1] as Point;
  resampled.push({ x: last.x, y: last.y });
  return resampled;
}

/**
 * Full pipeline: raw -> simplified -> resampled -> capsule segment pairs.
 * Returns `{ discarded: true }` for strokes below the minimum (caller refunds ink).
 */
export function processStroke(rawPoints: readonly Point[]): StrokePipelineResult {
  if (rawPoints.length < 2) {
    return { discarded: true, reason: 'tooFewPoints' };
  }

  const simplified = simplifyStroke(rawPoints);
  const totalLength = polylineLength(simplified);
  if (totalLength < physics.segmentLength) {
    return { discarded: true, reason: 'tooShort' };
  }

  const segmentCount = Math.min(
    physics.segmentCountMax,
    Math.max(SEGMENT_COUNT_MIN, Math.round(totalLength / physics.segmentLength)),
  );
  const resampled = resampleStroke(simplified, segmentCount);

  const segments: StrokeSegment[] = [];
  for (let i = 0; i < resampled.length - 1; i++) {
    segments.push({ a: resampled[i] as Point, b: resampled[i + 1] as Point });
  }

  return { discarded: false, simplified, resampled, segments, totalLength };
}

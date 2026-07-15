/**
 * StrokeCommit — pure geometry for the player commit path (extracted from
 * GameSimulation round-9 for the 800-line bound).
 *
 * Two concerns, both pure (no Box2D, input never mutated, no engine state):
 * 1. DANGER-ZONE draw-block (v2, BR-012): does a stroke ENTER a no-draw rect?
 * 2. TERRAIN-CLIP resolution: turn a raw stroke + terrain solids into the
 *    committed line, version-gated — v1 keeps the longest run with a buried
 *    fallback; v2 is WYSIWYG (a split stroke is rejected).
 */

import type { DangerZone, Point, Rect } from '../level/LevelSchema';
import type { StrokeDiscardReason, StrokePipelineResult } from './StrokePipeline';
import type { TerrainSolids } from './TerrainSolids';
import { processStroke } from './StrokePipeline';
import { clipStrokeToSolids } from './StrokeClipper';

/**
 * Best-effort clip fallback bound (review F1, v1 only). When the clipped LONGEST
 * outside run is below the pipeline minimum, resolveCommittedStroke may fall back
 * to the UNCLIPPED line ONLY if at least this fraction of the raw stroke lay
 * outside solids — a line hugging concave/staircase terrain that merely fragmented
 * into short runs. A stroke below the bound is predominantly BURIED and DENIED.
 *
 * Measured (probe over all shipped levels + the clip fixture, 2026-07-08): a
 * fully-buried stroke has outsideFraction 0 (rejected); all shipped ghosts are
 * clip NO-OPS (fraction 1); a deep-hug of the ch1-l14 staircase measures 0.9065 at
 * a realistic 0.6 m over-draw and 0.7188 at an implausible 1.2 m. 0.6 sits below
 * that genuine-hug floor yet far above a buried stroke — a wide separation, so the
 * exact value is not sensitive. Structural constant (like SURFACE_SKIN_M).
 */
export const FALLBACK_MIN_OUTSIDE_FRACTION = 0.6;

/** The successfully-processed (non-discarded) StrokePipeline result. */
export type CommittedStroke = Extract<StrokePipelineResult, { readonly discarded: false }>;

/** resolveCommittedStroke result: a pre-launch rejection, or the committed line. */
export type CommitResolution =
  | { readonly rejected: StrokeDiscardReason | 'splitByTerrain' }
  | { readonly stroke: CommittedStroke; readonly clipApplied: boolean; readonly usedFallback: boolean };

/** Inclusive point-in-rect (bottom-left anchored). */
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  );
}

/**
 * True when segment a->b intersects the closed axis-aligned rect (Liang-Barsky
 * slab clip). Subsumes the endpoint-inside case, so a stroke that enters, exits,
 * or merely grazes a dangerZone is caught.
 */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    const pi = p[i] as number;
    const qi = q[i] as number;
    if (pi === 0) {
      if (qi < 0) {
        return false; // parallel to this slab and outside it
      }
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

/**
 * v2 draw-block test (BR-012): true when any vertex of `points` lies inside, or
 * any segment intersects, ANY zone rect. Zones are NOT clipped like terrain — they
 * FORBID: a stroke entering one is rejected pre-launch.
 */
export function strokeEntersDangerZone(points: readonly Point[], zones: readonly DangerZone[]): boolean {
  if (zones.length === 0) {
    return false;
  }
  for (const zone of zones) {
    for (const point of points) {
      if (pointInRect(point, zone)) {
        return true;
      }
    }
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentIntersectsRect(points[i] as Point, points[i + 1] as Point, zone)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve the committed line from terrain clipping. Version-gated (round-9):
 * - v2 (WYSIWYG, BR-013): a stroke clipped into >1 run (or fully buried) is
 *   REJECTED 'splitByTerrain' — the committed line must equal the live preview
 *   (the single outside run). No longest-run auto-pick, no buried fallback.
 * - v1 (round-7, UNCHANGED): keep the LONGEST outside run; fall back to the
 *   UNCLIPPED line only when the stroke was PREDOMINANTLY outside solids (review
 *   F1). This preserves the byte-identical no-op path (determinism / v1 ghosts).
 */
export function resolveCommittedStroke(
  rawPoints: readonly Point[],
  solids: TerrainSolids,
  isV2: boolean,
): CommitResolution {
  const clip = clipStrokeToSolids(rawPoints, solids);
  if (isV2) {
    if (clip.clipped && clip.runs.length !== 1) {
      return { rejected: 'splitByTerrain' };
    }
    const processed = processStroke(clip.longestRun);
    if (processed.discarded) {
      return { rejected: processed.reason };
    }
    return { stroke: processed, clipApplied: clip.clipped, usedFallback: false };
  }
  let processed = processStroke(clip.longestRun);
  let hasUsedFallback = false;
  if (processed.discarded && clip.clipped && clip.outsideFraction >= FALLBACK_MIN_OUTSIDE_FRACTION) {
    processed = processStroke(rawPoints);
    hasUsedFallback = !processed.discarded;
  }
  if (processed.discarded) {
    return { rejected: processed.reason };
  }
  return { stroke: processed, clipApplied: clip.clipped, usedFallback: hasUsedFallback };
}

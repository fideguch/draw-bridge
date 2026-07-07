/**
 * GhostRecorder — VehicleReferencePoint sampling into a GhostSolution
 * (FR-015, FR-024 editor testplay, FR-026 Gate 2 substrate).
 *
 * Drive it once per fixed tick: sample(tick, referencePoint). Only every
 * sampleEveryTicks-th tick is kept (position-sample playback data, NEVER
 * input replay — data-model §1.1). toGhostSolution() pins the final sample
 * to the outcome tick/position so the schema invariant "last sample ==
 * result.ticks/finalPos" (LevelSchema) holds even off the sample grid.
 *
 * The stroke persisted into the ghost is the COMMITTED simplified polyline
 * (post-RDP, pre-resample) in world meters — replay feeds it back through the
 * same StrokePipeline; RDP is idempotent on its own output, so the rebuilt
 * bridge is identical (GhostPlayer determinism note).
 */

import type { GhostKind, GhostSample, GhostSolution, Point, PolylinePoint } from '../level/LevelSchema';

/** Authoring default sample density (data-model §1.1 — non-physics value). */
export const DEFAULT_SAMPLE_EVERY_TICKS = 10;

export interface GhostRecorderOptions {
  /** Keep one sample every N ticks (integer >= 1). Default 10. */
  readonly sampleEveryTicks?: number;
  /** Ghost kind persisted into the solution. Default 'any'. */
  readonly kind?: GhostKind;
}

export interface GhostRecorderResult {
  /** Committed simplified stroke polyline (world meters, >= 2 points). */
  readonly stroke: readonly Point[];
  /** Outcome tick of the recorded clear (integer >= 1). */
  readonly ticks: number;
  /** VehicleReferencePoint at the clear tick. */
  readonly finalPos: Point;
  /** Raw ink consumption of the committed stroke (> 0). */
  readonly inkConsumed: number;
  readonly starRating: 1 | 2 | 3;
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export class GhostRecorder {
  readonly sampleEveryTicks: number;
  readonly kind: GhostKind;

  private readonly samples: GhostSample[] = [];
  private lastTick = -1;

  constructor(options?: GhostRecorderOptions) {
    const sampleEveryTicks = options?.sampleEveryTicks ?? DEFAULT_SAMPLE_EVERY_TICKS;
    if (!Number.isInteger(sampleEveryTicks) || sampleEveryTicks < 1) {
      throw new Error(`GhostRecorder: sampleEveryTicks must be an integer >= 1 (got ${sampleEveryTicks})`);
    }
    this.sampleEveryTicks = sampleEveryTicks;
    this.kind = options?.kind ?? 'any';
  }

  /** Call once per fixed tick; keeps the sample when tick is on the grid. */
  sample(tick: number, position: Point): void {
    if (!Number.isInteger(tick) || tick < 0) {
      throw new Error(`GhostRecorder.sample: tick must be an integer >= 0 (got ${tick})`);
    }
    if (tick <= this.lastTick) {
      throw new Error(`GhostRecorder.sample: ticks must strictly increase (got ${tick} after ${this.lastTick})`);
    }
    if (!isFinitePoint(position)) {
      throw new Error(`GhostRecorder.sample: position must be finite (got ${position.x}, ${position.y})`);
    }
    this.lastTick = tick;
    if (tick % this.sampleEveryTicks === 0) {
      this.samples.push({ t: tick, x: position.x, y: position.y });
    }
  }

  /**
   * Build the schema-shaped GhostSolution for a recorded CLEAR.
   * Ghosts are recorded clears by contract (LevelSchema result.outcome).
   */
  toGhostSolution(result: GhostRecorderResult): GhostSolution {
    const { stroke, ticks, finalPos, inkConsumed, starRating } = result;
    if (stroke.length < 2 || !stroke.every(isFinitePoint)) {
      throw new Error('GhostRecorder.toGhostSolution: stroke needs >= 2 finite points');
    }
    if (!Number.isInteger(ticks) || ticks < 1) {
      throw new Error(`GhostRecorder.toGhostSolution: ticks must be an integer >= 1 (got ${ticks})`);
    }
    if (!isFinitePoint(finalPos)) {
      throw new Error('GhostRecorder.toGhostSolution: finalPos must be finite');
    }
    if (!Number.isFinite(inkConsumed) || inkConsumed <= 0) {
      throw new Error(`GhostRecorder.toGhostSolution: inkConsumed must be > 0 (got ${inkConsumed})`);
    }

    // Pin the final sample to the exact outcome tick/position (schema invariant).
    const finalSample: GhostSample = { t: ticks, x: finalPos.x, y: finalPos.y };
    const gridSamples = this.samples.filter((sample) => sample.t < ticks);
    const strokePolyline: PolylinePoint[] = stroke.map((point) => [point.x, point.y]);

    return {
      kind: this.kind,
      stroke: strokePolyline,
      sampleEveryTicks: this.sampleEveryTicks,
      samples: [...gridSamples, finalSample],
      result: { outcome: 'clear', ticks, finalPos: { x: finalPos.x, y: finalPos.y }, inkConsumed, starRating },
    };
  }
}

import { describe, expect, it } from 'vitest';
import type { Point } from '@engine/level/LevelSchema';
import type { StrokePipelineResult } from '@engine/physics/StrokePipeline';
import { SEGMENT_COUNT_MIN, processStroke, simplifyStroke } from '@engine/physics/StrokePipeline';
import { physics } from '@tuning/TuningConstants';

/**
 * T012 — stroke pipeline: rawPoints -> RDP simplify -> equal-interval resample
 * -> capsule segment endpoint pairs (FR-001, FR-003). Pure geometry, no Box2D.
 */

function straightLine(length: number, pointCount: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({ x: (length * i) / (pointCount - 1), y: 0 });
  }
  return points;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function expectKept(result: StrokePipelineResult): Exclude<StrokePipelineResult, { discarded: true }> {
  if (result.discarded) {
    expect.fail(`expected stroke to be kept but it was discarded (${result.reason})`);
  }
  return result;
}

describe('processStroke — discard rules (FR-003, ink refund handled by caller)', () => {
  it('discards an empty point list', () => {
    const result = processStroke([]);
    expect(result.discarded).toBe(true);
    if (result.discarded) {
      expect(result.reason).toBe('tooFewPoints');
    }
  });

  it('discards a single point', () => {
    const result = processStroke([{ x: 1, y: 1 }]);
    expect(result.discarded).toBe(true);
  });

  it('discards a zero-length stroke (duplicate points)', () => {
    const result = processStroke([
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(result.discarded).toBe(true);
    if (result.discarded) {
      expect(result.reason).toBe('tooShort');
    }
  });

  it('discards a stroke shorter than one segment length', () => {
    const result = processStroke([
      { x: 0, y: 0 },
      { x: physics.segmentLength * 0.5, y: 0 },
    ]);
    expect(result.discarded).toBe(true);
    if (result.discarded) {
      expect(result.reason).toBe('tooShort');
    }
  });

  it('keeps a stroke of exactly one segment length but clamps up to the floor (N in [6, 32])', () => {
    // one segmentLength rounds to N=1, which the pipeline floors to
    // SEGMENT_COUNT_MIN (shape-fidelity floor) so a short stroke still carries
    // enough control points to preserve its drawn shape.
    const result = expectKept(
      processStroke([
        { x: 0, y: 0 },
        { x: physics.segmentLength, y: 0 },
      ]),
    );
    expect(SEGMENT_COUNT_MIN).toBe(6);
    expect(result.segments).toHaveLength(SEGMENT_COUNT_MIN);
  });

  it('never produces fewer than SEGMENT_COUNT_MIN segments (>= 1 joint guaranteed)', () => {
    // any kept stroke, from one segmentLength up to ~1.4x, would round to N=1
    for (const factor of [1, 1.1, 1.25, 1.4]) {
      const result = expectKept(
        processStroke([
          { x: 0, y: 0 },
          { x: physics.segmentLength * factor, y: 0 },
        ]),
      );
      expect(result.segments.length).toBeGreaterThanOrEqual(SEGMENT_COUNT_MIN);
      // segments[i].b === segments[i+1].a chaining still holds at the floor
      expect(result.resampled).toHaveLength(result.segments.length + 1);
    }
  });
});

describe('simplifyStroke — RDP with epsilon from TuningConstants', () => {
  it('collapses collinear noise (jitter below epsilon) to the two endpoints', () => {
    const noisy: Point[] = straightLine(10, 101).map((p, i) => ({
      x: p.x,
      y: i % 2 === 0 ? 0.01 : -0.01, // well below draw.rdpEpsilon (0.08)
    }));
    const simplified = simplifyStroke(noisy);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual(noisy[0]);
    expect(simplified[simplified.length - 1]).toEqual(noisy[noisy.length - 1]);
  });

  it('keeps a genuine corner (L-shape)', () => {
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ];
    const simplified = simplifyStroke(lShape);
    expect(simplified).toHaveLength(3);
    expect(simplified[1]).toEqual({ x: 2, y: 0 });
  });
});

describe('processStroke — equal-interval resample', () => {
  it('resamples a 10 m straight stroke into round(10 / segmentLength) segments', () => {
    const result = expectKept(processStroke(straightLine(10, 200)));
    const expectedCount = Math.round(10 / physics.segmentLength);
    expect(result.segments).toHaveLength(expectedCount);
    expect(result.totalLength).toBeCloseTo(10, 6);

    const target = result.totalLength / result.segments.length;
    for (const segment of result.segments) {
      const length = distance(segment.a, segment.b);
      expect(length).toBeGreaterThanOrEqual(target * 0.9);
      expect(length).toBeLessThanOrEqual(target * 1.1);
      // configured segment length is honored for uncapped strokes
      expect(length).toBeGreaterThanOrEqual(physics.segmentLength * 0.9);
      expect(length).toBeLessThanOrEqual(physics.segmentLength * 1.1);
    }
  });

  it('preserves stroke endpoints through the pipeline', () => {
    const points = straightLine(10, 50);
    const result = expectKept(processStroke(points));
    const first = result.resampled[0];
    const last = result.resampled[result.resampled.length - 1];
    expect(first).toEqual(points[0]);
    expect(last?.x).toBeCloseTo(10, 9);
    expect(last?.y).toBeCloseTo(0, 9);
  });

  it('chains segments continuously (segment[i].b === segment[i+1].a)', () => {
    const result = expectKept(processStroke(straightLine(6, 40)));
    for (let i = 0; i < result.segments.length - 1; i++) {
      expect(result.segments[i]?.b).toEqual(result.segments[i + 1]?.a);
    }
  });

  it('clamps to the hard cap by increasing effective segment length', () => {
    const longLength = physics.segmentLength * physics.segmentCountMax * 2; // 2x over cap
    const result = expectKept(processStroke(straightLine(longLength, 500)));
    expect(result.segments).toHaveLength(physics.segmentCountMax);
    const effective = result.totalLength / physics.segmentCountMax;
    for (const segment of result.segments) {
      const length = distance(segment.a, segment.b);
      expect(length).toBeGreaterThanOrEqual(effective * 0.9);
      expect(length).toBeLessThanOrEqual(effective * 1.1);
    }
  });

  it('does not mutate the input points', () => {
    const points = straightLine(5, 30);
    const snapshot = structuredClone(points);
    processStroke(points);
    expect(points).toEqual(snapshot);
  });
});

describe('processStroke — property-style checks', () => {
  const strokes: Record<string, Point[]> = {
    'straight 5 m': straightLine(5, 60),
    'gentle sine 8 m': Array.from({ length: 161 }, (_, i) => ({
      x: i * 0.05,
      y: 0.5 * Math.sin(i * 0.05),
    })),
    'long straight 30 m': straightLine(30, 400),
    'diagonal 3 m': Array.from({ length: 31 }, (_, i) => ({
      x: i * 0.1 * Math.SQRT1_2 * 3 * (1 / 3),
      y: i * 0.1 * Math.SQRT1_2 * 3 * (1 / 3),
    })),
  };

  it.each(Object.entries(strokes))('%s: N <= cap, chords within ±10% of target', (_name, points) => {
    const result = expectKept(processStroke(points));
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    expect(result.segments.length).toBeLessThanOrEqual(physics.segmentCountMax);
    expect(result.totalLength).toBeGreaterThan(0);

    const target = result.totalLength / result.segments.length;
    for (const segment of result.segments) {
      const length = distance(segment.a, segment.b);
      expect(length).toBeGreaterThanOrEqual(target * 0.9);
      expect(length).toBeLessThanOrEqual(target * 1.1);
    }
  });
});

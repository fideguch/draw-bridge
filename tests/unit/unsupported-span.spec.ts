import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Level, Polyline } from '@engine/level/LevelSchema';
import {
  ARCH_EXEMPT_IDS,
  MAX_UNSUPPORTED_SPAN_M,
  maxUnsupportedSpan,
  unsupportedSpanCheck,
} from '../../scripts/gates/unsupportedSpan';

/**
 * Gate 5 — unsupported span (round-7, game_plan_v5 §8.2). A tension line can only
 * bridge ~5.5 m of unsupported gap; the gate measures the widest such gap and fails
 * a level that exceeds it (a mid-pillar splits the gap into shorter sub-spans).
 * Tests: the metric on synthetic gaps (with + without a pillar), the arch exemption,
 * and the check on real levels (a wide one fails, a compact one passes).
 */

function loadLevel(id: string): { json: unknown } {
  return { json: JSON.parse(readFileSync(join(process.cwd(), 'levels', `${id}.json`), 'utf-8')) };
}

/** Minimal typed Level for maxUnsupportedSpan (reads terrain / spawn / goal only). */
function mkLevel(terrain: Polyline[], spawnX: number, goalX: number): Level {
  return {
    schemaVersion: 1,
    id: 'ch1-l01',
    terrain,
    vehicleSpawn: { x: spawnX, y: 0.5 },
    goalFlag: { x: goalX, y: 0, width: 1, height: 2 },
    killY: -20,
    inkBudget: 30,
    starThresholds: { star2: 20, star3: 15 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [
      {
        kind: 'any',
        stroke: [[0, 1], [1, 1]],
        sampleEveryTicks: 10,
        samples: [{ t: 100, x: goalX, y: 0.5 }],
        result: { outcome: 'clear', ticks: 100, finalPos: { x: goalX, y: 0.5 }, inkConsumed: 5, starRating: 3 },
      },
    ],
  };
}

describe('maxUnsupportedSpan', () => {
  it('a 4 m gap between two rims measures ~4 m (within the 5.5 m limit)', () => {
    // left rim ends at x=-2, right rim starts at x=2 → 4 m open gap, floor deep below.
    const terrain: Polyline[] = [
      [[-8, 0], [-2, 0]],
      [[2, 0], [8, 0]],
    ];
    const span = maxUnsupportedSpan(mkLevel(terrain, -6, 6));
    expect(span).toBeGreaterThan(3.5);
    expect(span).toBeLessThanOrEqual(MAX_UNSUPPORTED_SPAN_M);
  });

  it('NEGATIVE CONTROL: a 7 m gap EXCEEDS the limit', () => {
    const terrain: Polyline[] = [
      [[-10, 0], [-3.5, 0]],
      [[3.5, 0], [10, 0]],
    ];
    const span = maxUnsupportedSpan(mkLevel(terrain, -8, 8));
    expect(span).toBeGreaterThan(MAX_UNSUPPORTED_SPAN_M);
  });

  it('a MID-PILLAR splits a wide gap into shorter supported sub-spans', () => {
    // an 8 m gap (-4..4) with a pillar top at rim level near x=0 → two ~4 m spans.
    const terrain: Polyline[] = [
      [[-10, 0], [-4, 0]],
      [[-0.3, 0], [0.3, 0]], // mid-pillar top at the rim height
      [[4, 0], [10, 0]],
    ];
    const span = maxUnsupportedSpan(mkLevel(terrain, -8, 8));
    expect(span).toBeLessThanOrEqual(MAX_UNSUPPORTED_SPAN_M);
  });
});

describe('unsupportedSpanCheck', () => {
  it('the compression-arch exemption set names L16 and L21 (§8.2)', () => {
    expect(ARCH_EXEMPT_IDS.has('ch1-l16')).toBe(true);
    expect(ARCH_EXEMPT_IDS.has('ch1-l21')).toBe(true);
  });

  it('NEGATIVE CONTROL: a synthetic wide-gap (7 m) level FAILS the span limit', () => {
    // Synthetic (the hazard-free wave ships no >5.5 m unsupported span): a 7 m rim-to-rim
    // gap with no mid support must trip the limit. mkLevel builds a schema-valid level so
    // the check reaches the span metric (not a gate0 rejection).
    const wide = mkLevel(
      [
        [[-10, 0], [-3.5, 0]],
        [[3.5, 0], [10, 0]],
      ],
      -8,
      8,
    );
    const result = unsupportedSpanCheck({ json: wide });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('unsupported-span');
  });

  it('a compact real level (ch1-l01) PASSES with the span reported as a warning', () => {
    const result = unsupportedSpanCheck(loadLevel('ch1-l01'));
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).join(' ')).toContain('unsupported-span');
  });
});

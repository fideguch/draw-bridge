import { describe, expect, it } from 'vitest';
import type { Level, Polyline } from '@engine/level/LevelSchema';
import {
  SIZE_CLASS_BY_ID,
  TIER_FLOORS,
  computeSizeMetrics,
  sizeStandardsCheck,
} from '../../scripts/gates/sizeStandards';

/**
 * Gate 4 — stage size standards (round-7 F2, game_plan_v5 §3). The gate MACHINE-
 * enforces per-tier floors on W_win / L_path / D_sg / span_y / ratio so the boards
 * can never be re-shrunk. Tests: the metric math on synthetic levels, the tier
 * floors, and the check on a synthetic undersized level as the negative control
 * (kept independent of the shipped slate, which the v5 resize lifts above floors).
 */

/** A full, typed Level for the pure-metric functions (no validation needed). */
function mkLevel(over: {
  terrain: Polyline[];
  spawn: { x: number; y: number };
  goal: { x: number; y: number; width: number; height: number };
  samples: { t: number; x: number; y: number }[];
}): Level {
  const last = over.samples[over.samples.length - 1]!;
  return {
    schemaVersion: 1,
    id: 'ch1-l01',
    terrain: over.terrain,
    vehicleSpawn: over.spawn,
    goalFlag: over.goal,
    killY: -20,
    inkBudget: 30,
    starThresholds: { star2: 20, star3: 15 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [
      {
        kind: 'any',
        stroke: [
          [0, 1],
          [1, 1],
        ],
        sampleEveryTicks: 10,
        samples: over.samples,
        result: { outcome: 'clear', ticks: last.t, finalPos: { x: last.x, y: last.y }, inkConsumed: 5, starRating: 3 },
      },
    ],
  };
}

describe('computeSizeMetrics', () => {
  it('D_sg is the straight spawn→goal-center distance', () => {
    const level = mkLevel({
      terrain: [[[-20, 0], [20, 0]]],
      spawn: { x: 0, y: 0 },
      goal: { x: 10, y: 0, width: 2, height: 2 }, // center (11, 1)
      samples: [{ t: 0, x: 0, y: 0 }, { t: 100, x: 11, y: 1 }],
    });
    expect(computeSizeMetrics(level).dSg).toBeCloseTo(Math.hypot(11, 1), 3);
  });

  it('L_path is the arc length of the ghost sample path (the driven distance)', () => {
    const level = mkLevel({
      terrain: [[[-20, 0], [20, 0]]],
      spawn: { x: 0, y: 0 },
      goal: { x: 10, y: 0, width: 1, height: 2 },
      // a 3-4-5 path then a straight 6 → total 5 + 6 = 11
      samples: [{ t: 0, x: 0, y: 0 }, { t: 50, x: 3, y: 4 }, { t: 100, x: 9, y: 4 }],
    });
    expect(computeSizeMetrics(level).lPath).toBeCloseTo(11, 3);
  });

  it('a small, flat, close level lands BELOW the S floor; a big tall far one CLEARS the XL floor', () => {
    const small = mkLevel({
      terrain: [[[-4, 0], [6, 0]]],
      spawn: { x: 0, y: 0 },
      goal: { x: 3, y: 0, width: 1, height: 1.5 },
      samples: [{ t: 0, x: 0, y: 0 }, { t: 60, x: 3.5, y: 0.5 }],
    });
    const ms = computeSizeMetrics(small);
    expect(ms.dSg).toBeLessThan(TIER_FLOORS.S.dSg);
    expect(ms.lPath).toBeLessThan(TIER_FLOORS.S.lPath);

    const big = mkLevel({
      terrain: [[[-13, 8], [-6, 0], [6, 0], [13, 8]]], // wide + tall walls
      spawn: { x: -10, y: 6 },
      goal: { x: 9, y: 6, width: 1.5, height: 2 },
      samples: [
        { t: 0, x: -10, y: 6 },
        { t: 60, x: -4, y: 0.5 },
        { t: 120, x: 4, y: 0.5 },
        { t: 200, x: 9.7, y: 6.5 },
      ],
    });
    const mb = computeSizeMetrics(big);
    expect(mb.wWin).toBeGreaterThanOrEqual(TIER_FLOORS.XL.wWin);
    expect(mb.lPath).toBeGreaterThanOrEqual(TIER_FLOORS.XL.lPath);
    expect(mb.dSg).toBeGreaterThanOrEqual(TIER_FLOORS.XL.dSg);
    expect(mb.spanY).toBeGreaterThanOrEqual(TIER_FLOORS.XL.spanY);
  });
});

describe('sizeStandardsCheck — tier map + floor enforcement', () => {
  it('maps every current level id to a tier (18 shipped + forward-looking 28-slate)', () => {
    for (const id of ['ch1-l01', 'ch1-l09', 'ch1-l15', 'ch1-b1', 'ch1-b3']) {
      expect(SIZE_CLASS_BY_ID[id]).toBeDefined();
    }
    // forward-looking (I2's 28-slate) entries are present too
    expect(SIZE_CLASS_BY_ID['ch1-l23']).toBe('XL');
    expect(SIZE_CLASS_BY_ID['ch1-b5']).toBe('M');
  });

  it('NEGATIVE CONTROL: a synthetic undersized S level FAILS the S floor', () => {
    // Synthetic (not a shipped level, which the v5 slate resizes above the floor):
    // a small, close, flat board mapped to the S tier must trip the S floor.
    const undersized = mkLevel({
      terrain: [[[-4, 0], [6, 0]]],
      spawn: { x: 0, y: 0 },
      goal: { x: 3, y: 0, width: 1, height: 1.5 },
      samples: [{ t: 0, x: 0, y: 0 }, { t: 60, x: 3.5, y: 0.5 }],
    });
    const result = sizeStandardsCheck({ json: undersized });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('size-standards[S]');
  });

  it('surfaces the measured metrics as a warning line even when it passes/fails', () => {
    const passing = mkLevel({
      terrain: [[[-13, 8], [-6, 0], [6, 0], [13, 8]]],
      spawn: { x: -10, y: 6 },
      goal: { x: 9, y: 6, width: 1.5, height: 2 },
      samples: [
        { t: 0, x: -10, y: 6 },
        { t: 60, x: -4, y: 0.5 },
        { t: 120, x: 4, y: 0.5 },
        { t: 200, x: 9.7, y: 6.5 },
      ],
    });
    const result = sizeStandardsCheck({ json: passing });
    expect((result.warnings ?? []).join(' ')).toMatch(/W_win=.*L_path=.*D_sg=/);
  });
});

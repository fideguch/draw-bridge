import { describe, expect, it } from 'vitest';
import { SPIKE_WORLD_BUDGET, runDeterminismProbe } from '../../src/debug/SpikeScenario';
import type { DeterminismProbeResult } from '../../src/debug/SpikeScenario';

/**
 * T036 — S3 determinism CI gate (research.md §R10).
 *
 * Same level + stroke, repeated full runs (settle -> commit -> outcome) must
 * produce ONE identical world stateHash — exact float64 bits over every
 * body's position/rotation/velocity (World.stateHash, no quantization), so a
 * single-ulp drift fails this suite.
 *
 * RUN COUNT — why 25 and not 200/1000 (LIB-QUIRK, World.ts header):
 * phaser-box2d@1.1.0 never frees world slots; a process hard-crashes at the
 * 33rd World. One probe consumes one slot, so an in-process batch is capped
 * at SPIKE_WORLD_BUDGET (30). This CI gate runs 25; the full S3 protocol
 * (1000 runs, batched across child processes, cross-process hash equality)
 * lives in scripts/spike/determinism.ts — `npm run spike:determinism`.
 * Result recorded in research.md §R10: 1000/1000 identical on Node 20.
 */

const RUNS = 25;

describe('S3 determinism — repeated identical runs (CI gate)', () => {
  it(`${RUNS} full runs produce one identical stateHash, tick count, and final position`, () => {
    expect(RUNS).toBeLessThanOrEqual(SPIKE_WORLD_BUDGET);

    const results: DeterminismProbeResult[] = [];
    for (let i = 0; i < RUNS; i++) {
      results.push(runDeterminismProbe());
    }
    const first = results[0] as DeterminismProbeResult;

    // spike-calibrated tuning guarantee: the short scenario is a clear
    expect(first.outcome).toBe('clear');
    expect(first.ticks).toBeGreaterThan(0);

    expect(new Set(results.map((r) => r.stateHash)).size).toBe(1);
    expect(new Set(results.map((r) => r.ticks)).size).toBe(1);
    // exact float equality, not toBeCloseTo — bit-reproducibility is the contract
    expect(new Set(results.map((r) => r.finalPosX)).size).toBe(1);
    expect(new Set(results.map((r) => r.finalPosY)).size).toBe(1);
    expect(new Set(results.map((r) => r.outcome)).size).toBe(1);
  });
});

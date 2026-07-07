/**
 * Spike S1 bench — headless step-timing matrix + breakForce calibration
 * (T035/T037, research.md §R10).
 *
 * Run:
 *   npm run spike:bench                 # S1 matrix: chain|compound x N=8/16/24/32 x gap 2/4/6m
 *   npm run spike:bench -- --json       # NDJSON output instead of the human table
 *   npm run spike:bench -- --calibrate  # breakForceFactor x car-density sweep on 4m/6m gaps
 *
 * Runner: vite-node (NOT plain node/tsx) — it reuses vite.config.ts aliases,
 * so 'phaser-box2d' (broken package "main") and @engine/@tuning resolve exactly
 * like they do under vitest. One process stays within the 32-world LIB-QUIRK
 * budget (SPIKE_WORLD_BUDGET guard below).
 */

import {
  SPIKE_GAPS_M,
  SPIKE_METHODS,
  SPIKE_SEGMENT_COUNTS,
  SPIKE_WORLD_BUDGET,
  arcStroke,
  buildSpikeLevel,
  runSpikeAttempt,
  summarizeStepDurations,
} from '../../src/debug/SpikeScenario';
import type { SpikeRunResult, SpikeTuningOverrides } from '../../src/debug/SpikeScenario';
import type { PhysicsMethod } from '../../src/engine/physics/BridgeChainBuilder';
import { bridge, car } from '../../src/tuning/TuningConstants';

interface CliOptions {
  readonly isJson: boolean;
  readonly isCalibrate: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  return {
    isJson: argv.includes('--json'),
    isCalibrate: argv.includes('--calibrate'),
  };
}

let worldsUsed = 0;

function guardedRun(...args: Parameters<typeof runSpikeAttempt>): SpikeRunResult {
  if (worldsUsed >= SPIKE_WORLD_BUDGET) {
    throw new Error(
      `world budget exhausted (${SPIKE_WORLD_BUDGET}/process, phaser-box2d slot leak) — split the sweep across invocations`,
    );
  }
  worldsUsed++;
  return runSpikeAttempt(...args);
}

/** One warm-up attempt so JIT/GC noise does not land in the first scenario row. */
function warmUp(): void {
  guardedRun(buildSpikeLevel(4), arcStroke(4), { method: 'chain', forceSegmentCount: 16 });
}

// -- S1 matrix -------------------------------------------------------------------

interface BenchRow {
  readonly method: PhysicsMethod;
  readonly segments: number;
  readonly gapM: number;
  readonly result: SpikeRunResult;
}

function runMatrix(): BenchRow[] {
  const rows: BenchRow[] = [];
  for (const method of SPIKE_METHODS) {
    for (const segments of SPIKE_SEGMENT_COUNTS) {
      for (const gapM of SPIKE_GAPS_M) {
        const result = guardedRun(buildSpikeLevel(gapM), arcStroke(gapM), {
          method,
          forceSegmentCount: segments,
        });
        rows.push({ method, segments, gapM, result });
      }
    }
  }
  return rows;
}

function printMatrixTable(rows: readonly BenchRow[]): void {
  console.log('S1 bench — per-step wall time (headless Node, full attempt via GameSimulation, Lv0)');
  console.log(
    `tuning: breakForceFactor=${bridge.breakForceFactor} chassisDensity=${car.chassisDensity} wheelDensity=${car.wheelDensity}`,
  );
  console.log('');
  const header = ['method', 'N', 'gap', 'outcome', 'ticks', 'p50ms', 'p95ms', 'maxms', 'sag(m)', 'maxStress', 'breaks'];
  const lines = rows.map((row) => {
    const timing = summarizeStepDurations(row.result.stepDurationsMs);
    return [
      row.method,
      String(row.segments),
      `${row.gapM}m`,
      row.result.outcome,
      String(row.result.ticks),
      timing.p50Ms.toFixed(3),
      timing.p95Ms.toFixed(3),
      timing.maxMs.toFixed(3),
      row.result.sagDepthM.toFixed(3),
      row.result.maxStress.toFixed(2),
      String(row.result.breakCount),
    ];
  });
  printAligned([header, ...lines]);
}

function printMatrixJson(rows: readonly BenchRow[]): void {
  for (const row of rows) {
    const timing = summarizeStepDurations(row.result.stepDurationsMs);
    console.log(
      JSON.stringify({
        mode: 'bench',
        method: row.method,
        segments: row.segments,
        gapM: row.gapM,
        outcome: row.result.outcome,
        ticks: row.result.ticks,
        p50Ms: timing.p50Ms,
        p95Ms: timing.p95Ms,
        maxMs: timing.maxMs,
        sagDepthM: row.result.sagDepthM,
        maxStress: row.result.maxStress,
        breakCount: row.result.breakCount,
        stateHash: row.result.stateHash,
      }),
    );
  }
}

// -- calibration ---------------------------------------------------------------------

const CALIBRATE_MULTIPLIERS = [1, 2, 3, 5] as const;
const CALIBRATE_DENSITY_SCALES = [0.5, 1, 2] as const;
const CALIBRATE_GAPS_M = [4, 6] as const;

interface CalibrationCell {
  readonly multiplier: number;
  readonly densityScale: number;
  readonly breakForceFactor: number;
  readonly runs: readonly { gapM: number; result: SpikeRunResult }[];
  readonly isSuccess: boolean;
}

function runCalibration(): CalibrationCell[] {
  const baseFactor = bridge.breakForceFactor;
  const cells: CalibrationCell[] = [];
  for (const multiplier of CALIBRATE_MULTIPLIERS) {
    for (const densityScale of CALIBRATE_DENSITY_SCALES) {
      const tuning: SpikeTuningOverrides = {
        breakForceFactor: baseFactor * multiplier,
        carDensityScale: densityScale,
      };
      const runs = CALIBRATE_GAPS_M.map((gapM) => ({
        gapM,
        result: guardedRun(buildSpikeLevel(gapM), arcStroke(gapM), { method: 'chain', tuning }),
      }));
      cells.push({
        multiplier,
        densityScale,
        breakForceFactor: baseFactor * multiplier,
        runs,
        isSuccess: runs.every((run) => run.result.outcome === 'clear'),
      });
    }
  }
  return cells;
}

function printCalibrationTable(cells: readonly CalibrationCell[]): void {
  console.log('breakForce calibration — method chain, natural N (segmentLength unchanged), gaps 4m + 6m');
  console.log(`base breakForceFactor=${bridge.breakForceFactor} (multiplier x base)`);
  console.log('');
  const header = ['xfactor', 'factor', 'density', 'gap4m', 'N4', 'stress4', 'gap6m', 'N6', 'stress6', 'BOTH CLEAR'];
  const lines = cells.map((cell) => {
    const [gap4, gap6] = cell.runs;
    return [
      `x${cell.multiplier}`,
      cell.breakForceFactor.toFixed(2),
      `x${cell.densityScale}`,
      gap4?.result.outcome ?? '-',
      String(gap4?.result.segments ?? '-'),
      gap4?.result.maxStress.toFixed(2) ?? '-',
      gap6?.result.outcome ?? '-',
      String(gap6?.result.segments ?? '-'),
      gap6?.result.maxStress.toFixed(2) ?? '-',
      cell.isSuccess ? 'YES' : 'no',
    ];
  });
  printAligned([header, ...lines]);
  console.log('');
  printRecommendation(cells);
}

function printCalibrationJson(cells: readonly CalibrationCell[]): void {
  for (const cell of cells) {
    for (const run of cell.runs) {
      console.log(
        JSON.stringify({
          mode: 'calibrate',
          multiplier: cell.multiplier,
          breakForceFactor: cell.breakForceFactor,
          densityScale: cell.densityScale,
          gapM: run.gapM,
          segments: run.result.segments,
          outcome: run.result.outcome,
          ticks: run.result.ticks,
          sagDepthM: run.result.sagDepthM,
          maxStress: run.result.maxStress,
          breakCount: run.result.breakCount,
        }),
      );
    }
  }
  printRecommendation(cells);
}

/**
 * Recommendation policy: among cells where BOTH gaps clear, prefer density
 * scale 1.0 (leave car mass alone), then the smallest multiplier whose worst
 * observed stress still leaves the creak band reachable but not saturated
 * (maxStress in ~[0.5, 0.9] is ideal: creaks happen, breaks don't).
 */
function printRecommendation(cells: readonly CalibrationCell[]): void {
  const successes = cells.filter((cell) => cell.isSuccess);
  if (successes.length === 0) {
    console.log('RECOMMENDATION: no sweep cell cleared both gaps — widen the sweep (higher multipliers/densities).');
    return;
  }
  const ranked = [...successes].sort((a, b) => {
    const aDensityBias = Math.abs(Math.log(a.densityScale));
    const bDensityBias = Math.abs(Math.log(b.densityScale));
    if (aDensityBias !== bDensityBias) {
      return aDensityBias - bDensityBias;
    }
    const stressOf = (cell: CalibrationCell): number =>
      Math.max(...cell.runs.map((run) => run.result.maxStress));
    const aScore = Math.abs(stressOf(a) - 0.7);
    const bScore = Math.abs(stressOf(b) - 0.7);
    return aScore - bScore;
  });
  const best = ranked[0] as CalibrationCell;
  const worstStress = Math.max(...best.runs.map((run) => run.result.maxStress));
  console.log(
    `RECOMMENDATION: bridge.breakForceFactor=${best.breakForceFactor.toFixed(2)} (x${best.multiplier}), ` +
      `car density scale x${best.densityScale} ` +
      `(chassisDensity=${(car.chassisDensity * best.densityScale).toFixed(2)}, ` +
      `wheelDensity=${(car.wheelDensity * best.densityScale).toFixed(2)}); ` +
      `worst maxStress=${worstStress.toFixed(2)} across 4m/6m clears`,
  );
}

// -- output helpers -------------------------------------------------------------------------

function printAligned(rows: readonly (readonly string[])[]): void {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i] as number)).join('  '));
  }
}

// -- main ------------------------------------------------------------------------------------

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  warmUp();
  if (options.isCalibrate) {
    const cells = runCalibration();
    if (options.isJson) {
      printCalibrationJson(cells);
    } else {
      printCalibrationTable(cells);
    }
    return;
  }
  const rows = runMatrix();
  if (options.isJson) {
    printMatrixJson(rows);
  } else {
    printMatrixTable(rows);
  }
}

main();

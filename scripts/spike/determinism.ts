/**
 * Spike S3 — full 1000-run determinism proof (T036/T037, research.md §R10).
 *
 * Run:
 *   npm run spike:determinism              # 1000 runs
 *   npm run spike:determinism -- --runs 200
 *
 * Protocol: the SAME short scenario as tests/unit/determinism.spec.ts
 * (runDeterminismProbe), repeated N times, every run's exact-float-bits world
 * stateHash must be identical.
 *
 * CHILD BATCHING (LIB-QUIRK, World.ts header): phaser-box2d@1.1.0 never frees
 * world slots — a process crashes at the 33rd World. This script therefore
 * re-spawns ITSELF via vite-node in batches of 25 runs (DETERMINISM_CHILD=1)
 * and aggregates the NDJSON lines. Hash equality must hold both WITHIN and
 * ACROSS processes — the cross-process part additionally proves the result
 * does not depend on process-lifetime state.
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { runDeterminismProbe } from '../../src/debug/SpikeScenario';
import type { DeterminismProbeResult } from '../../src/debug/SpikeScenario';

const BATCH_RUNS = 25;

function childMain(runs: number): void {
  for (let i = 0; i < runs; i++) {
    console.log(JSON.stringify(runDeterminismProbe()));
  }
}

function parseRuns(argv: readonly string[]): number {
  const index = argv.indexOf('--runs');
  if (index === -1) {
    return 1000;
  }
  const runs = Number(argv[index + 1]);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs expects a positive integer (got ${argv[index + 1] ?? 'nothing'})`);
  }
  return runs;
}

function spawnBatch(runs: number): DeterminismProbeResult[] {
  const viteNodeBin = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const env = { ...process.env };
  env['DETERMINISM_CHILD'] = '1';
  env['DETERMINISM_CHILD_RUNS'] = String(runs);
  const child = spawnSync(viteNodeBin, ['scripts/spike/determinism.ts'], {
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`child batch failed (exit ${child.status}):\n${child.stderr}`);
  }
  return child.stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as DeterminismProbeResult);
}

function parentMain(): void {
  const totalRuns = parseRuns(process.argv.slice(2));
  const startedAt = performance.now();
  const results: DeterminismProbeResult[] = [];
  let batchIndex = 0;
  while (results.length < totalRuns) {
    const runs = Math.min(BATCH_RUNS, totalRuns - results.length);
    const batch = spawnBatch(runs);
    if (batch.length !== runs) {
      throw new Error(`batch ${batchIndex} returned ${batch.length}/${runs} results`);
    }
    results.push(...batch);
    batchIndex++;
    process.stderr.write(`\rbatch ${batchIndex}: ${results.length}/${totalRuns} runs`);
  }
  process.stderr.write('\n');

  const hashes = new Set(results.map((r) => r.stateHash));
  const ticks = new Set(results.map((r) => r.ticks));
  const outcomes = new Set(results.map((r) => r.outcome));
  const first = results[0] as DeterminismProbeResult;
  const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);
  const isPass = hashes.size === 1 && ticks.size === 1 && outcomes.size === 1;

  console.log(
    JSON.stringify(
      {
        mode: 'determinism',
        node: process.version,
        runs: results.length,
        childProcesses: batchIndex,
        scenario: 'gap 2m, arc stroke, method chain, Lv0 (runDeterminismProbe)',
        distinctHashes: hashes.size,
        distinctTicks: ticks.size,
        distinctOutcomes: outcomes.size,
        stateHash: first.stateHash,
        outcome: first.outcome,
        ticks: first.ticks,
        elapsedSec: Number(elapsedSec),
        pass: isPass,
      },
      null,
      2,
    ),
  );
  if (!isPass) {
    console.error(`FAIL: ${hashes.size} distinct hashes observed: ${[...hashes].join(', ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${results.length}/${results.length} runs identical (hash ${first.stateHash}) in ${elapsedSec}s`);
}

if (process.env['DETERMINISM_CHILD'] === '1') {
  childMain(Number(process.env['DETERMINISM_CHILD_RUNS'] ?? BATCH_RUNS));
} else {
  parentMain();
}

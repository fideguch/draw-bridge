/**
 * Gate 2 — headless ghost replay at Lv0 within the tolerance band.
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §1, §3, §4.
 * Per ghost: simulate twice in-process; run 1 must sit inside the tolerance
 * band vs the recorded result (BR-004: proves clearability unupgraded), runs
 * 1 and 2 must match exactly (in-process determinism regression check).
 * `kind:"3star"` ghosts additionally assert the replayed star rating is 3.
 *
 * stateHash note: emitted as a digest of the end state (outcome | ticks |
 * exact float bits of finalPos) per replay. Full body-state hashing lives in
 * World.stateHash; composing it here needs engine surface not yet exposed by
 * runScriptedAttempt — upgrade when Phase 4 completes (contract §4 allows the
 * hash definition to be canonical-serialization based; this digest is the v1).
 */
import { validateLevel, type GhostSolution, type Level } from '../../src/engine/level/LevelSchema';
import { compareToRecorded, runScriptedAttempt, type ScriptedAttemptResult } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

/**
 * Two long-lived recycled worlds for the whole gate run (phaser-box2d never
 * frees slots — 18 levels x 2 ghosts x 2 runs would exhaust the 32-slot cap
 * with fresh worlds). Determinism check: a recycled slot drifts sub-mm between
 * consecutive attempts, but an IDENTICAL attempt sequence yields bit-identical
 * results across independent worlds (measured, see .fable/decisions.md) — so
 * run 1 (world A) and run 2 (world B) at the same sequence position must match
 * exactly.
 */
let worldA: World | undefined;
let worldB: World | undefined;
function gateWorlds(): { a: World; b: World } {
  worldA ??= new World();
  worldB ??= new World();
  return { a: worldA, b: worldB };
}

function fnv1a(parts: readonly number[]): string {
  const buf = new ArrayBuffer(8);
  const f64 = new Float64Array(buf);
  const u8 = new Uint8Array(buf);
  let hash = 0x811c9dc5;
  for (const part of parts) {
    f64[0] = part;
    for (let i = 0; i < 8; i++) {
      hash ^= u8[i]!;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

function digest(result: ScriptedAttemptResult): string {
  if (!result.committed) return 'uncommitted';
  return fnv1a([
    result.outcome === 'clear' ? 1 : 0,
    result.ticks,
    result.finalPos.x,
    result.finalPos.y,
  ]);
}

function checkGhost(level: Level, ghost: GhostSolution, index: number): { errors: string[]; hash: string } {
  const errors: string[] = [];
  const strokePoints = ghost.stroke.map(([x, y]) => ({ x, y }));
  const { a, b } = gateWorlds();
  const run1 = runScriptedAttempt(level, strokePoints, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world: a });
  const run2 = runScriptedAttempt(level, strokePoints, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world: b });

  if (!run1.committed) {
    return { errors: [`ghost[${index}]: stroke did not commit (${run1.reason})`], hash: 'uncommitted' };
  }

  // Cross-world determinism: the same attempt at the same sequence position in
  // two independent recycled worlds must match bit-exactly (measured property).
  const hash1 = digest(run1);
  const hash2 = digest(run2);
  if (hash1 !== hash2) {
    errors.push(`ghost[${index}]: cross-world determinism violation (${hash1} != ${hash2})`);
  }

  // Tolerance band vs the recorded result.
  const comparison = compareToRecorded(ghost.result, {
    outcome: run1.outcome,
    ticks: run1.ticks,
    finalPos: run1.finalPos,
  });
  if (!comparison.pass) {
    errors.push(
      ...comparison.errors.map((e) => `ghost[${index}]: ${e}`),
    );
  }

  // 3-star intent ghosts must actually replay at 3 stars (contract §1 Gate 2).
  if (ghost.kind === '3star' && run1.starRating !== 3) {
    errors.push(
      `ghost[${index}]: kind "3star" replayed at ${run1.starRating ?? 'no'} stars (ink ${run1.inkConsumed.toFixed(2)} vs star3 threshold ${level.starThresholds.star3})`,
    );
  }

  return { errors, hash: hash1 };
}

export function gate2Check(loaded: { json: unknown }): { errors: string[]; stateHash?: string } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  const errors: string[] = [];
  const hashes: string[] = [];
  level.ghostSolutions.forEach((ghost, index) => {
    const result = checkGhost(level, ghost, index);
    errors.push(...result.errors);
    hashes.push(result.hash);
  });
  return { errors, stateHash: hashes.join(',') };
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  const { levelsGlob, isQuiet } = parseCliOptions(process.argv.slice(2));
  process.exit(runGate(2, resolveLevelFiles(levelsGlob), isQuiet, gate2Check));
}

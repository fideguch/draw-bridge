/**
 * Gate 6 — LINE DISPLACEMENT (round-7 F5, game_plan_v5 §9.2). "線が車に押されてズレる"
 * (V4-5) is caught mechanically: run the primary ghost, snapshot the SETTLED bridge
 * chain the instant the car launches (it has settled through anticipation but the
 * car has not reached it), then track the max per-node displacement as the car
 * drives across. A well-anchored bridge (rim / mid-pillar / ledge anchors) barely
 * moves; a floppy, shoved line drifts. The metric is the max node displacement (m);
 * the floor is LINE_DISPLACEMENT_MAX_M.
 *
 * ROLLOUT (§3.6): STRICT by default; CI passes lib.WARN_NEW_GATES_FLAG until the
 * 28-slate lands. NEGATIVE CONTROL: an anchored bridge stays under the limit; a
 * shoved bridge exceeds it (lineDisplacement.spec.ts drives both directly).
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { World } from '../../src/engine/physics/World';
import {
  applyWarnMode,
  hasWarnNewGatesFlag,
  parseCliOptions,
  resolveLevelFiles,
  runGate,
} from './lib';

/** Max settled→driven chain node displacement (m) before it reads as "pushed" (§9.2). */
export const LINE_DISPLACEMENT_MAX_M = 0.3;

let displacementWorld: World | undefined;
function getDisplacementWorld(): World {
  displacementWorld ??= new World();
  return displacementWorld;
}

/** Max index-wise node displacement between two equal-length polylines (m). */
function maxNodeDisplacement(settled: readonly Point[], now: readonly Point[]): number {
  const n = Math.min(settled.length, now.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const a = settled[i]!;
    const b = now[i]!;
    max = Math.max(max, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return max;
}

export interface LineDisplacementResult {
  /** null when the ghost stroke does not commit / build a chain. */
  readonly maxDisplacement: number | null;
  readonly committed: boolean;
  readonly outcome: 'clear' | 'fail' | null;
  readonly reason?: string;
}

/**
 * Run the primary ghost and measure the max settled→driven chain displacement.
 * Exported for direct unit tests (a caller may pass a private recycled world).
 */
export function measureLineDisplacement(
  level: Level,
  world: World = getDisplacementWorld(),
): LineDisplacementResult {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    return { maxDisplacement: null, committed: false, outcome: null, reason: 'no-ghost' };
  }
  const stroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return { maxDisplacement: null, committed: false, outcome: null, reason: commit.reason };
    }
    let settled: readonly Point[] | null = null;
    let maxDisplacement = 0;
    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
      // Snapshot the SETTLED shape the first running tick (post-anticipation settle,
      // pre-drive), then measure the shove as the car crosses.
      if (settled === null && sim.phase === 'running') {
        settled = sim.renderChainPolyline();
      } else if (settled !== null) {
        maxDisplacement = Math.max(maxDisplacement, maxNodeDisplacement(settled, sim.renderChainPolyline()));
      }
    }
    return {
      maxDisplacement,
      committed: true,
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { reason: outcome.cause } : {}),
    };
  } finally {
    sim.destroy();
  }
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function lineDisplacementCheck(
  loaded: { json: unknown },
  world?: World,
): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const result = measureLineDisplacement(parsed.level, world);
  if (!result.committed || result.maxDisplacement === null) {
    return {
      errors: [`line-displacement: primary ghost did not build a bridge to measure (${result.reason ?? 'unknown'})`],
    };
  }
  if (result.maxDisplacement > LINE_DISPLACEMENT_MAX_M) {
    return {
      errors: [
        `line-displacement: settled→driven chain shove ${round2(result.maxDisplacement)}m > limit ` +
          `${LINE_DISPLACEMENT_MAX_M}m (game_plan_v5 §9.2 F5) — anchor the line (rim / mid-pillar / ledge)`,
      ],
    };
  }
  return { errors: [], warnings: [`line-displacement ${round2(result.maxDisplacement)}m <= ${LINE_DISPLACEMENT_MAX_M}m`] };
}

export function runLineDisplacementGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const isWarnMode = hasWarnNewGatesFlag(argv);
  return runGate(6, resolveLevelFiles(levelsGlob), isQuiet, (loaded) =>
    applyWarnMode(lineDisplacementCheck(loaded), isWarnMode),
  );
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runLineDisplacementGate(process.argv.slice(2)));
}

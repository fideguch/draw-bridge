/**
 * Gate 8 — MULTI-SOLUTION PROOF (round-8). The second half of the user's
 * complaint: 「複数解が存在しない」— a level whose ONLY working line is the
 * recorded ghost is a puzzle with one answer. This gate makes solution
 * plurality a MACHINE-VERIFIED level property: level JSON declares
 * `solutions[]` (DeclaredSolution: shapeTag + raw stroke, LevelSchema round-8)
 * and the gate PLAYS every declared stroke live, requiring
 *
 *   (1) EVERY declared solution to CLEAR at Lv0 through the EXACT player
 *       commit path (runScriptedAttempt -> GameSimulation.commitStroke: clip,
 *       fallback guard, solidify, settle, run, Judge — learnings round-4:
 *       "ゲート候補も同じcommit経路を通す"), and
 *   (2) >= MULTI_SOLUTION_MIN_DISTINCT_SHAPES DISTINCT shapeTags among them —
 *       two strokes of the same family are one idea drawn twice, not two
 *       solutions. Tutorial allowlist levels relax this to 1 (L1-L2 teach the
 *       single "draw a road" lesson).
 *
 * WHY A NEW GATE 8, NOT A GATE 2 EXTENSION (round-8 decision):
 *   • Gate 2's two-world determinism protocol replays EXACTLY one attempt per
 *     recorded ghost in sorted-id order — the same sequence authoring's record
 *     pass drove — and its recorded-vs-replayed band depends on that sequence
 *     alignment (gate2-ghost.ts header; authoring.ts record()). Injecting
 *     solution attempts into those worlds would shift every subsequent replay's
 *     sequence position and desync the band. Solutions therefore need their own
 *     recycled world, i.e. their own gate.
 *   • Rollout semantics differ: Gate 2 is always-STRICT (recorded data must
 *     replay), while solutions[] is STAGED — an UNDECLARED level is deferred
 *     under --warn-new-gates, but a DECLARED solution that fails to clear is a
 *     lie in the level data and stays a hard error even in warn mode.
 *
 * INTEGRITY: a declared solution committing via the F1 fallback (UNCLIPPED
 * through terrain) is a line no player could draw — hard error (Gate 3/7
 * precedent).
 *
 * NEGATIVE CONTROL (learnings T4, multi-solution.spec.ts): a fixture declaring
 * a solution that does NOT clear must FAIL this gate; a fixture declaring two
 * distinct-shape clearing solutions must PASS.
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import {
  applyWarnMode,
  hasWarnNewGatesFlag,
  parseCliOptions,
  resolveLevelFiles,
  runGate,
} from './lib';

/** Gate number in the pipeline report (gates 0-7 are taken). */
export const MULTI_SOLUTION_GATE_NUMBER = 8;

/** Distinct shapeTag floor per level — plurality means genuinely different shapes. */
export const MULTI_SOLUTION_MIN_DISTINCT_SHAPES = 2;

/**
 * Tutorial levels (real shipped ids, round-8 spec) where the single "draw a
 * road" lesson is the point: the distinct-shape floor relaxes to 1 there.
 */
export const MULTI_SOLUTION_ALLOWLIST: ReadonlySet<string> = new Set(['ch1-l01', 'ch1-l02']);

/**
 * One recycled world for ALL declared-solution attempts across the run
 * (phaser-box2d 32-slot cap; Gate 3/7 precedent). NEVER Gate 2's worlds — see
 * the header on why the replay sequences must stay separate.
 */
let solutionWorld: World | undefined;
function getSolutionWorld(): World {
  solutionWorld ??= new World();
  return solutionWorld;
}

export interface MultiSolutionCheckResult {
  readonly errors: string[];
  readonly warnings?: string[];
  /**
   * True when the level declares no solutions[] at all. The runner demotes
   * ONLY this case under --warn-new-gates (staged rollout); verification
   * failures on DECLARED solutions are strict regardless of the flag.
   */
  readonly isUndeclared?: boolean;
}

/** Play one declared solution through the player commit path; push errors/warnings. */
function verifySolution(
  level: Level,
  index: number,
  world: World,
  errors: string[],
  warnings: string[],
): void {
  const solution = level.solutions![index]!;
  const label = `solutions[${index}] shapeTag="${solution.shapeTag}"`;
  const stroke: Point[] = solution.stroke.map(([x, y]) => ({ x, y }));
  const result = runScriptedAttempt(level, stroke, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, // BR-004: proofs always run Lv0
    world,
  });
  if (!result.committed) {
    errors.push(`multi-solution: ${label} did not commit (${result.reason}) — a declared solution must be drawable`);
    return;
  }
  if (result.usedFallback) {
    errors.push(
      `multi-solution: ${label} committed UNCLIPPED THROUGH terrain (F1 fallback) — not a player-drawable line`,
    );
    return;
  }
  if (result.outcome !== 'clear') {
    errors.push(
      `multi-solution: ${label} did NOT clear — outcome=fail cause=${result.cause ?? '?'} ticks=${result.ticks} ` +
        `(a declared solution is a promise; re-author the stroke or remove it)`,
    );
    return;
  }
  warnings.push(`${label} CLEARED t=${result.ticks} ink=${result.inkConsumed.toFixed(2)} stars=${result.starRating ?? '?'}`);
}

export function multiSolutionCheck(loaded: { json: unknown }, world?: World): MultiSolutionCheckResult {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  if (level.solutions === undefined || level.solutions.length === 0) {
    return {
      errors: [
        `multi-solution: no solutions[] declared — every level must PROVE >= ${MULTI_SOLUTION_MIN_DISTINCT_SHAPES} ` +
          `distinct-shape solutions (round-8 staged rollout: declare them in the level source)`,
      ],
      isUndeclared: true,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const attemptWorld = world ?? getSolutionWorld();
  for (let i = 0; i < level.solutions.length; i++) {
    verifySolution(level, i, attemptWorld, errors, warnings);
  }

  const distinctShapes = new Set(level.solutions.map((s) => s.shapeTag));
  const requiredShapes = MULTI_SOLUTION_ALLOWLIST.has(level.id) ? 1 : MULTI_SOLUTION_MIN_DISTINCT_SHAPES;
  if (distinctShapes.size < requiredShapes) {
    errors.push(
      `multi-solution: only ${distinctShapes.size} distinct shapeTag(s) [${[...distinctShapes].join(', ')}] ` +
        `< required ${requiredShapes} — declare solutions of genuinely different shape families`,
    );
  }
  warnings.push(`shapes: ${[...distinctShapes].join(', ')} (${distinctShapes.size}/${requiredShapes} required)`);
  return { errors, warnings };
}

export function runMultiSolutionGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const isWarnMode = hasWarnNewGatesFlag(argv);
  return runGate(MULTI_SOLUTION_GATE_NUMBER, resolveLevelFiles(levelsGlob), isQuiet, (loaded) => {
    const result = multiSolutionCheck(loaded);
    // STAGED ROLLOUT: only the "nothing declared yet" case defers under the
    // flag. A DECLARED solution failing verification is strict in both modes.
    return result.isUndeclared === true ? applyWarnMode(result, isWarnMode) : result;
  });
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runMultiSolutionGate(process.argv.slice(2)));
}

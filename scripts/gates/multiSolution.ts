/**
 * Gate 8 — MULTI-SOLUTION PROOF.
 *
 * ROUND-9 RECALIBRATION (BR-015, fun decision 2): solution PLURALITY is no longer
 * a blocking requirement. Under "any physically valid one-stroke clear is a
 * legitimate win", a level does NOT have to DECLARE alternate solutions, and it
 * does NOT have to prove >= 2 distinct shape families — those become ADVISORY
 * telemetry. What the gate still ENFORCES (blocking) is DATA HONESTY: IF a level
 * declares `solutions[]`, every declared stroke must actually commit + CLEAR at
 * Lv0 through the exact player commit path (no fallback). A declared solution
 * that lies is a bug in the level data — the same integrity contract Gate 2 holds
 * for recorded ghosts. The blocking guarantees that MATTER for playability — (a)
 * >= 1 recorded ghost clears at Lv0, (b) coins are 100% collectible on a recorded
 * route — are owned by Gate 2 / the coin gate (Gate 2.5) and are untouched here.
 *
 * ROUND-8 ORIGIN (retained for context): plurality answered the complaint
 * 「複数解が存在しない」by machine-proving >= 2 distinct-shape solutions per level.
 * The round-9 fun overhaul reframed free solutions as legitimate, so plurality is
 * demoted to advisory while the honesty-of-declared-data check stays strict.
 *
 * WHY A SEPARATE GATE (unchanged): Gate 2's two-world determinism protocol
 * replays EXACTLY one attempt per recorded ghost in sorted-id order; injecting
 * solution attempts would desync its band, so declared solutions run on their own
 * recycled world here.
 *
 * NEGATIVE CONTROL (multi-solution.spec.ts): a fixture DECLARING a solution that
 * does NOT clear still FAILS this gate (honesty); a fixture that declares nothing,
 * or declares fewer than 2 shape families, PASSES with an advisory warning.
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

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
   * True when the level declares no solutions[] at all. Round-9 (BR-015): this
   * case PASSES with an advisory warning (free solutions are legitimate).
   * Verification failures on DECLARED solutions remain strict (data honesty).
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
  // ROUND-9 (BR-015): declaring solutions[] is OPTIONAL. An undeclared level
  // passes with an advisory note — free solutions are legitimate, and Gate 2
  // already proves >= 1 ghost clears.
  if (level.solutions === undefined || level.solutions.length === 0) {
    return {
      errors: [],
      warnings: [
        `multi-solution ADVISORY: no solutions[] declared — legitimate under BR-015 (free solutions); ` +
          `Gate 2 owns the ">= 1 ghost clears at Lv0" guarantee`,
      ],
      isUndeclared: true,
    };
  }

  // HONESTY (blocking): every DECLARED solution must actually clear. Plurality
  // (>= 2 distinct shape families) is ADVISORY under round-9.
  const errors: string[] = [];
  const warnings: string[] = [];
  const attemptWorld = world ?? getSolutionWorld();
  for (let i = 0; i < level.solutions.length; i++) {
    verifySolution(level, i, attemptWorld, errors, warnings);
  }

  const distinctShapes = new Set(level.solutions.map((s) => s.shapeTag));
  if (distinctShapes.size < MULTI_SOLUTION_MIN_DISTINCT_SHAPES) {
    warnings.push(
      `multi-solution ADVISORY: only ${distinctShapes.size} distinct shapeTag(s) [${[...distinctShapes].join(', ')}] ` +
        `(< ${MULTI_SOLUTION_MIN_DISTINCT_SHAPES}) — plurality is advisory under BR-015, not required`,
    );
  }
  warnings.push(`shapes: ${[...distinctShapes].join(', ')} (${distinctShapes.size} declared)`);
  return { errors, warnings };
}

export function runMultiSolutionGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  // ROUND-9 (BR-015): no rollout flag. Undeclared levels + shape-diversity are
  // advisory (multiSolutionCheck returns them as warnings with empty errors); only
  // a DECLARED solution that fails to clear blocks (data honesty).
  return runGate(MULTI_SOLUTION_GATE_NUMBER, resolveLevelFiles(levelsGlob), isQuiet, (loaded) =>
    multiSolutionCheck(loaded),
  );
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runMultiSolutionGate(process.argv.slice(2)));
}

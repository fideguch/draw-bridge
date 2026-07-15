/**
 * Gate 3 — straight-line bot MUST FAIL on every level tagged `anti-dominant`.
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §5.
 * Untagged levels no-op pass. For tagged levels the bot draws the single
 * straight rim-to-rim segment plus height variants {0, +0.5, +1.0} m; ink
 * clamp counts over-budget candidates as failed (`infeasible(budget)`); the
 * gate passes iff EVERY candidate fails.
 *
 * PLAYER-FAITHFUL SEMANTICS (review F2). Each candidate is run through
 * runScriptedAttempt -> GameSimulation.commitStroke, i.e. the EXACT commit path
 * a real player's stroke takes: terrain clipping first (no line may live inside
 * a solid), then the predominantly-outside fallback (GameSimulation F1). Since a
 * real player also cannot draw through terrain, testing the post-clip candidate
 * is not a weakening of the straight-line strategy — it IS the strongest line a
 * player pursuing that strategy can actually commit. So the bot verdict remains
 * a clean proof: if even the clipped/committed dominant line cannot clear, no
 * player drawing it can. Each candidate's commit disposition is classified
 * (clean / clipped / fallback / rejected) and surfaced (stderr + the gate line's
 * `warnings`) so the verdict is interpretable. INTEGRITY ASSERTION: a candidate
 * must never commit UNCLIPPED THROUGH terrain (the F1 fallback) — that would
 * mean testing a line no player could draw; such a candidate fails the gate.
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { detectRims, lerpPoint } from './rims';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

/**
 * One recycled world for ALL bot candidates across the run — a fresh world per
 * candidate exhausts the 32-slot cap at ~6 anti-dominant levels x 6+ simulated
 * candidates (levels agent hit this empirically). Bot verdicts only need the
 * outcome (fail/clear), well within recycled-slot macroscopic determinism.
 */
let botWorld: World | undefined;
function getBotWorld(): World {
  botWorld ??= new World();
  return botWorld;
}

/** Candidate endpoint height offsets in meters (contract §5 initial set). */
const HEIGHT_OFFSETS = [0, 0.5, 1.0] as const;
/**
 * Overlap extensions (m) beyond each rim along x (contract §5 "calibratable"):
 * exact rim-to-rim strokes have ZERO platform overlap and slide into the gap
 * on every geometry (empirically verified — the unanchored chain needs rim
 * overlap to bear load), which made the bot vacuously fail everywhere. Real
 * players draw straight lines THROUGH the rims, so the dominant-strategy
 * approximation must include overlapped straights.
 */
const OVERLAP_EXTENSIONS = [0, 1.0, 2.0] as const;

export function gate3Check(loaded: { json: unknown }): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  if (!level.gimmickTags.includes('anti-dominant')) {
    return { errors: [] };
  }

  const rims = detectRims(level);
  if (!rims) {
    return { errors: ['anti-dominant level but rim detection found no gap rims'] };
  }

  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const travelSign = flagCenterX >= level.vehicleSpawn.x ? 1 : -1;
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const offset of HEIGHT_OFFSETS) {
    for (const overlap of OVERLAP_EXTENSIONS) {
      const tag = `offset +${offset}m overlap ${overlap}m`;
      const a: Point = { x: rims.rimA.x - travelSign * overlap, y: rims.rimA.y + offset };
      const b: Point = { x: rims.rimB.x + travelSign * overlap, y: rims.rimB.y + offset };
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > level.inkBudget) {
        // infeasible(budget) — counts as a failed attempt (economy layer defense).
        classifyCandidate(level.id, tag, 'rejected(infeasible-budget)', warnings);
        continue;
      }
      // Two interior points keep the resampler direction stable on long segments.
      const stroke: Point[] = [a, lerpPoint(a, b, 1 / 3), lerpPoint(a, b, 2 / 3), b];
      const result = runScriptedAttempt(level, stroke, { world: getBotWorld() });

      // Classify the commit disposition through the SAME player commit path
      // (clip + F1 fallback) so the verdict is interpretable (review F2).
      const disposition = !result.committed
        ? `rejected(${result.reason})`
        : result.usedFallback
          ? 'fallback(UNCLIPPED-through-terrain)'
          : result.clipApplied
            ? 'clipped'
            : 'clean';
      classifyCandidate(level.id, tag, `${disposition} -> ${result.committed ? result.outcome : 'no-commit'}`, warnings);

      if (result.committed && result.usedFallback) {
        // INTEGRITY: after F1 no Gate 3 candidate should commit unclipped through
        // terrain — that would test a line no player could actually draw.
        errors.push(
          `straight-line bot committed UNCLIPPED THROUGH terrain (F1 fallback) at ${tag} — Gate 3 candidate is not player-faithful`,
        );
      }
      if (result.committed && result.outcome === 'clear') {
        errors.push(
          `straight-line bot CLEARED at ${tag} (ticks ${result.ticks}) — anti-dominant contract violated`,
        );
      }
    }
  }
  return { errors, warnings };
}

/**
 * Record a candidate's commit disposition: a compact human line to stderr (the
 * gate CLI's output discipline: stdout = NDJSON, human logs -> stderr) plus a
 * `warnings` entry carried on the gate line so verdicts stay interpretable.
 */
function classifyCandidate(levelId: string, tag: string, disposition: string, warnings: string[]): void {
  warnings.push(`${tag}: ${disposition}`);
  if (!process.env['VITEST']) {
    process.stderr.write(`gate3 ${levelId} candidate ${tag}: ${disposition}\n`);
  }
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  const { levelsGlob, isQuiet } = parseCliOptions(process.argv.slice(2));
  process.exit(runGate(3, resolveLevelFiles(levelsGlob), isQuiet, gate3Check));
}

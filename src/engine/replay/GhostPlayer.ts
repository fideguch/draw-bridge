/**
 * GhostPlayer — headless ghost replay + Gate 2 tolerance verification
 * (FR-026; contracts/gate-pipeline.md §3).
 *
 * replayGhost() re-simulates level + ghost.stroke AT LV0 UPGRADES (BR-004:
 * machine-proof that every level is clearable unupgraded) and compares the
 * replayed outcome against the recorded result:
 *
 *   | Criterion  | Tolerance                           |
 *   |------------|-------------------------------------|
 *   | Outcome    | exact match (clear)                 |
 *   | Final pos  | epsilon 0.05 m Euclidean, inclusive |
 *   | Tick count | +/-30 ticks, inclusive              |
 *
 * TOLERANCE CONSTANTS ARE CONTRACT-FROZEN, not tunables: gate-pipeline.md §3
 * mandates recalibration/re-recording over threshold loosening, so they live
 * here (like CollisionCategories) and NOT in TuningConstants.
 *
 * Determinism: recording and replay both drive GameSimulation — the exact
 * attempt lifecycle the game runs — and ghost.stroke is the committed
 * SIMPLIFIED polyline. RDP is idempotent on its own output, so the rebuilt
 * bridge and therefore the whole run are bit-identical on the same engine
 * build. The tolerance band exists for engine/library updates and
 * cross-device drift (research R4).
 */

import type { GhostResult, GhostSolution, Level, Point } from '../level/LevelSchema';
import type { FailCause } from '../rules/Judge';
import type { StarCount } from '../rules/StarRating';
import type { StrokeDiscardReason } from '../physics/StrokePipeline';
import type { UpgradeLevels } from '../GameSimulation';
import { GameSimulation } from '../GameSimulation';

/** Gate 2 final-position tolerance in meters (CONTRACT-FROZEN, see header). */
export const GHOST_FINAL_POS_EPSILON_M = 0.05;

/** Gate 2 tick-count tolerance (CONTRACT-FROZEN, see header). */
export const GHOST_TICK_TOLERANCE = 30;

export interface ReplayedOutcome {
  readonly outcome: 'clear' | 'fail';
  readonly ticks: number;
  readonly finalPos: Point;
}

export interface GhostComparison {
  readonly pass: boolean;
  readonly outcomeMatch: boolean;
  /** Euclidean distance between replayed and recorded final positions (m). */
  readonly finalPosDeltaM: number;
  /** |replayed.ticks - recorded.ticks|. */
  readonly tickDelta: number;
  readonly errors: readonly string[];
}

export interface GhostReplayResult {
  readonly pass: boolean;
  readonly details: {
    /** null when the stroke never committed (discard / insufficient ink). */
    readonly replayed: ReplayedOutcome | null;
    readonly comparison: GhostComparison | null;
    readonly errors: readonly string[];
  };
}

export type ScriptedAttemptResult =
  | { readonly committed: false; readonly reason: StrokeDiscardReason | 'insufficientInk' }
  | {
      readonly committed: true;
      readonly outcome: 'clear' | 'fail';
      /** Present iff outcome === 'fail'. */
      readonly cause?: FailCause;
      readonly ticks: number;
      /** VehicleReferencePoint at the outcome tick. */
      readonly finalPos: Point;
      /** Raw ink consumption of the committed stroke (simplified arc length). */
      readonly inkConsumed: number;
      /** null on fail (stars exist only on clear, FR-007). */
      readonly starRating: StarCount | null;
      /** Committed simplified polyline — what a ghost persists (GhostSolution.stroke). */
      readonly stroke: readonly Point[];
    };

export interface ScriptedAttemptOptions {
  /** Upgrade levels for the run. Default Lv0 (ghost replays are ALWAYS Lv0). */
  readonly upgrades?: UpgradeLevels;
  /** Called after every fixed step with (tick, VehicleReferencePoint). */
  readonly onTick?: (tick: number, referencePoint: Point) => void;
}

/**
 * Run one full scripted attempt (settle -> commit -> run to outcome) through
 * GameSimulation on a fresh headless world. Shared by ghost recording
 * (editor testplay), ghost replay, and the gate scripts — every consumer
 * exercises the exact lifecycle the render layer drives.
 */
export function runScriptedAttempt(
  level: Level,
  strokePoints: readonly Point[],
  options?: ScriptedAttemptOptions,
): ScriptedAttemptResult {
  const simulation = new GameSimulation(level, { upgrades: options?.upgrades ?? {} });
  try {
    const commit = simulation.commitStroke(strokePoints);
    if (!commit.committed) {
      return { committed: false, reason: commit.reason };
    }

    let outcome = simulation.outcome;
    while (outcome === null) {
      outcome = simulation.step();
      options?.onTick?.(simulation.currentTick, simulation.referencePoint());
    }

    const finalPos = simulation.referencePoint();
    if (outcome.outcome === 'clear') {
      return {
        committed: true,
        outcome: 'clear',
        ticks: outcome.ticks,
        finalPos,
        inkConsumed: outcome.inkConsumed,
        starRating: outcome.starRating,
        stroke: commit.stroke,
      };
    }
    return {
      committed: true,
      outcome: 'fail',
      cause: outcome.cause,
      ticks: outcome.ticks,
      finalPos,
      inkConsumed: commit.length,
      starRating: null,
      stroke: commit.stroke,
    };
  } finally {
    simulation.destroy();
  }
}

/** Pure Gate 2 band check — exported so gate scripts can unit-drive edges. */
export function compareToRecorded(recorded: GhostResult, replayed: ReplayedOutcome): GhostComparison {
  const errors: string[] = [];

  const isOutcomeMatch = replayed.outcome === recorded.outcome;
  if (!isOutcomeMatch) {
    errors.push(`outcome mismatch: replayed "${replayed.outcome}" vs recorded "${recorded.outcome}"`);
  }

  const finalPosDeltaM = Math.hypot(
    replayed.finalPos.x - recorded.finalPos.x,
    replayed.finalPos.y - recorded.finalPos.y,
  );
  if (finalPosDeltaM > GHOST_FINAL_POS_EPSILON_M) {
    errors.push(`finalPos delta ${finalPosDeltaM.toFixed(4)}m > ${GHOST_FINAL_POS_EPSILON_M}m`);
  }

  const tickDelta = Math.abs(replayed.ticks - recorded.ticks);
  if (tickDelta > GHOST_TICK_TOLERANCE) {
    errors.push(`tick delta ${tickDelta} > ${GHOST_TICK_TOLERANCE}`);
  }

  return { pass: errors.length === 0, outcomeMatch: isOutcomeMatch, finalPosDeltaM, tickDelta, errors };
}

/**
 * Replay one ghost solution against its level at Lv0 and verify the band.
 * This is Gate 2's engine (gate2-ghost.mjs iterates it over ghostSolutions[]).
 */
export function replayGhost(level: Level, ghost: GhostSolution): GhostReplayResult {
  const strokePoints: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const attempt = runScriptedAttempt(level, strokePoints, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
  });

  if (!attempt.committed) {
    const errors = [`ghost stroke did not commit: ${attempt.reason} (stroke discarded — recording is stale)`];
    return { pass: false, details: { replayed: null, comparison: null, errors } };
  }

  const replayed: ReplayedOutcome = {
    outcome: attempt.outcome,
    ticks: attempt.ticks,
    finalPos: attempt.finalPos,
  };
  const comparison = compareToRecorded(ghost.result, replayed);
  return {
    pass: comparison.pass,
    details: { replayed, comparison, errors: comparison.errors },
  };
}

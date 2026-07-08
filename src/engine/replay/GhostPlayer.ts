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
import type { CommitDiscardReason, UpgradeLevels } from '../GameSimulation';
import { GameSimulation } from '../GameSimulation';
import { CoinTracker } from '../rules/CoinTracker';
import { World } from '../physics/World';

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
  | { readonly committed: false; readonly reason: CommitDiscardReason }
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
      /** True when terrain clipping altered the committed stroke (review F2). */
      readonly clipApplied: boolean;
      /** True when the UNCLIPPED line was committed via the F1 fallback (review F2). */
      readonly usedFallback: boolean;
    };

export interface ScriptedAttemptOptions {
  /** Upgrade levels for the run. Default Lv0 (ghost replays are ALWAYS Lv0). */
  readonly upgrades?: UpgradeLevels;
  /** Called after every fixed step with (tick, VehicleReferencePoint). */
  readonly onTick?: (tick: number, referencePoint: Point) => void;
  /**
   * Reuse a caller-owned World (reset per attempt) instead of a fresh slot —
   * lets one process run unbounded sequential attempts past the phaser-box2d
   * 32-slot cap (World header). The attempt leaves the world intact for the
   * next caller; the owner destroys it. Omit for a private, owned world.
   */
  readonly world?: World;
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
  const simulation = new GameSimulation(level, {
    upgrades: options?.upgrades ?? {},
    ...(options?.world !== undefined ? { world: options.world } : {}),
  });
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
        clipApplied: commit.clipApplied,
        usedFallback: commit.usedFallback,
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
      clipApplied: commit.clipApplied,
      usedFallback: commit.usedFallback,
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
 *
 * Pass a shared `world` to replay on a recycled slot (Gate 2 runs >32 replays
 * per process); the recycled-slot outcome stays inside the Gate 2 band —
 * tick-identical, sub-mm final-position drift — see replayGhostSuite.
 */
export function replayGhost(level: Level, ghost: GhostSolution, world?: World): GhostReplayResult {
  const strokePoints: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const attempt = runScriptedAttempt(level, strokePoints, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
    ...(world !== undefined ? { world } : {}),
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

/** One (level, ghost) pair for replayGhostSuite. */
export interface GhostReplayItem {
  readonly level: Level;
  readonly ghost: GhostSolution;
}

/**
 * Replay a whole batch of ghosts through ONE recycled World — the Gate 2 path
 * (contracts/gate-pipeline.md §3 replays Ch1 = 18 levels x up to 2 ghosts = >32
 * per process, which the old fresh-world-per-replay pattern could not survive:
 * phaser-box2d never frees world slots, hard-capping at 32, see World header).
 *
 * Determinism: the recycled slot is macroscopically deterministic (identical
 * tick counts, sub-mm final-position drift vs a fresh slot — comfortably inside
 * the Gate 2 ±30 tick / 0.05 m band) and reproducible (an identical replay
 * sequence yields an identical hash sequence). See .fable/decisions.md.
 */
export function replayGhostSuite(items: readonly GhostReplayItem[]): GhostReplayResult[] {
  const world = new World();
  try {
    return items.map((item) => replayGhost(item.level, item.ghost, world));
  } finally {
    world.destroy();
  }
}

// ── Trajectory recording + coin-collection (round-4 coin overhaul) ───────────
// The user mandate: coins must lie ON the intended driving route, machine-proved
// collectable. The driving route IS the per-tick VehicleReferencePoint path
// (chassis AABB center) — the exact point CoinTracker judges against. Recording
// it lets the authoring pipeline place coins along the route, the coin gate
// prove 100% collection, and the atlas draw the driven line.

/** One per-tick VehicleReferencePoint sample of a driven attempt (world m). */
export interface TrajectorySample {
  /** Run tick (0-based from the commit frame). */
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

export interface GhostTrajectoryResult {
  readonly committed: boolean;
  /** null when the stroke never committed. */
  readonly outcome: 'clear' | 'fail' | null;
  readonly ticks: number;
  /** Per-tick VehicleReferencePoint, from the first run tick to the outcome. */
  readonly trajectory: readonly TrajectorySample[];
  /** Reference point at the outcome tick, or null when uncommitted. */
  readonly finalPos: Point | null;
}

/**
 * Drive one scripted attempt at Lv0 and capture the per-tick reference-point
 * TRAJECTORY. onTick is a pure observer (no physics effect), so recording is
 * bit-identical to a plain runScriptedAttempt and honours the caller-owned
 * recycled `world` (32-slot cap discipline, World header).
 */
export function recordGhostTrajectory(
  level: Level,
  strokePoints: readonly Point[],
  world?: World,
): GhostTrajectoryResult {
  const trajectory: TrajectorySample[] = [];
  const attempt = runScriptedAttempt(level, strokePoints, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
    ...(world !== undefined ? { world } : {}),
    onTick: (t, referencePoint) => {
      trajectory.push({ t, x: referencePoint.x, y: referencePoint.y });
    },
  });
  if (!attempt.committed) {
    return { committed: false, outcome: null, ticks: 0, trajectory, finalPos: null };
  }
  return {
    committed: true,
    outcome: attempt.outcome,
    ticks: attempt.ticks,
    trajectory,
    finalPos: attempt.finalPos,
  };
}

/** Which coin was collected, and on which run tick, along a driven trajectory. */
export interface CoinCollectionEvent {
  /** Index into the level's coins[] array. */
  readonly index: number;
  /** Run tick at which the reference point first entered collectRadiusM. */
  readonly t: number;
}

export interface CoinCollectionResult {
  /** Newly-collected events in collection order (ascending tick). */
  readonly events: readonly CoinCollectionEvent[];
  readonly collectedCount: number;
  readonly total: number;
}

/**
 * Replay a recorded trajectory through the REAL CoinTracker rule to determine
 * which coins the driven route sweeps up (and when). Pure over trajectory + coin
 * set (no physics), so authoring (placement), gate2 (the coin gate), and the
 * atlas (collection labels) all share the exact in-game collection semantics.
 */
export function collectCoinsAlongTrajectory(
  trajectory: readonly TrajectorySample[],
  coins: readonly Point[],
): CoinCollectionResult {
  const tracker = new CoinTracker(coins);
  const events: CoinCollectionEvent[] = [];
  for (const sample of trajectory) {
    for (const index of tracker.update({ x: sample.x, y: sample.y })) {
      events.push({ index, t: sample.t });
    }
  }
  return { events, collectedCount: tracker.collectedCount, total: coins.length };
}

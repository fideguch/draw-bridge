/**
 * SpikeScenario — shared scenario builder + instrumented attempt runner for
 * the research.md §R10 spikes (T035-T037).
 *
 * Consumers (all dev-only):
 * - scripts/spike/bench.ts        S1 headless step timing + breakForce calibration
 * - scripts/spike/determinism.ts  S3 1000-run stateHash proof (child batches)
 * - tests/unit/determinism.spec.ts S3 CI gate (in-process batch)
 * - src/debug/SpikeScene.ts       S2 visual sag/break/contact check
 *
 * ENGINE-UNTOUCHED CONSTRAINT: spikes must not add instrumentation surface to
 * src/engine. GameSimulation keeps its private fields; `simulationInternals`
 * reaches them via a structural cast (TypeScript `private` is compile-time
 * only). If a field is renamed the cast breaks loudly (undefined access), and
 * this module is the single place to fix.
 *
 * TUNING OVERRIDES: TuningConstants objects are designed for runtime mutation
 * (the debug tuning panel live-edits them, FR-025). applyTuningOverrides /
 * restoreTuning snapshot-and-restore the handful of constants the spikes
 * sweep; runSpikeAttempt wraps a whole attempt in try/finally so a throwing
 * run can never leak overridden values into later runs.
 *
 * WORLD BUDGET (LIB-QUIRK, see World.ts header): phaser-box2d@1.1.0 never
 * frees world slots — max 32 World instances per process, hard crash after.
 * Every runSpikeAttempt call consumes one slot. Batch accordingly
 * (SPIKE_WORLD_BUDGET leaves headroom for a warm-up run).
 */

import type { Level, Point } from '@engine/level/LevelSchema';
import type { BridgeChain, PhysicsMethod } from '@engine/physics/BridgeChainBuilder';
import type { StressTracker } from '@engine/physics/StressTracker';
import type { Vehicle } from '@engine/physics/Vehicle';
import type { World } from '@engine/physics/World';
import { GameSimulation } from '@engine/GameSimulation';
import { simplifyStroke } from '@engine/physics/StrokePipeline';
import { b2Body_GetPosition } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import { bridge, car, physics } from '@tuning/TuningConstants';

/** Safe number of physics worlds (= attempts) per Node process. */
export const SPIKE_WORLD_BUDGET = 30;

/** S1 scenario matrix axes (research.md §R10). */
export const SPIKE_GAPS_M = [2, 4, 6] as const;
export const SPIKE_SEGMENT_COUNTS = [8, 16, 24, 32] as const;
export const SPIKE_METHODS: readonly PhysicsMethod[] = ['chain', 'compound'];

// -- level ---------------------------------------------------------------------

export interface SpikeLevelOptions {
  /** Flat run-up length between spawn and the left gap rim (m). Default 6. */
  readonly runUpM?: number;
  /** Goal flag distance beyond the right gap rim (m). Default 5. */
  readonly flagOffsetM?: number;
}

/**
 * Two flat platforms separated by a `gapM` chasm centered on x = 0 — the
 * fixture-level geometry generalized to the spike gap sizes. Constructed
 * directly as a typed Level (spike levels never pass Gate 0, so the
 * ghostSolutions-mandatory rule of validateLevel does not apply here).
 */
export function buildSpikeLevel(gapM: number, options?: SpikeLevelOptions): Level {
  if (!(gapM > 0)) {
    throw new Error(`buildSpikeLevel: gapM must be > 0 (got ${gapM})`);
  }
  const half = gapM / 2;
  const runUp = options?.runUpM ?? 6;
  const flagOffset = options?.flagOffsetM ?? 5;
  return {
    schemaVersion: 1,
    id: `ch1-l01`, // schema-shaped placeholder; spike levels are never gate-checked
    terrain: [
      [
        [-half - runUp - 6, 0],
        [-half, 0],
        [-half + 0.2, -6],
      ],
      [
        [half - 0.2, -6],
        [half, 0],
        [half + flagOffset + 5, 0],
      ],
    ],
    vehicleSpawn: { x: -half - runUp, y: 0.6 },
    goalFlag: { x: half + flagOffset, y: 0, width: 1.5, height: 2.5 },
    killY: -8,
    inkBudget: 64,
    starThresholds: { star2: 48, star3: 24 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [],
  };
}

// -- stroke ----------------------------------------------------------------------

export interface ArcStrokeOptions {
  /** Overlap onto each platform beyond the gap rim (m). Default 3. */
  readonly overlapM?: number;
  /** Upward bow height at the arc center (m). Default 0.35. */
  readonly bowM?: number;
  /** Raw sample count along the arc. Default 21. */
  readonly points?: number;
  /** Resting height of the arc ends above the platforms (m). Default 0.15. */
  readonly baseY?: number;
}

/**
 * Fixed arc-shaped stroke: a parabolic upward bow spanning the gap with
 * `overlapM` resting on each platform — the "realistic bridge" drawing the
 * spike protocol prescribes (slight arch, ends supported by the rims).
 *
 * Default overlap is 3 m: the chain is unanchored, so sagging pulls the tails
 * inward — S1 measured that a 6m span slides off the rims below ~3 m overlap
 * (calibration finding; level-design guidance in research.md §R10).
 */
export function arcStroke(gapM: number, options?: ArcStrokeOptions): readonly Point[] {
  const overlap = options?.overlapM ?? 3;
  const bow = options?.bowM ?? 0.35;
  const count = options?.points ?? 21;
  const baseY = options?.baseY ?? 0.15;
  const halfWidth = gapM / 2 + overlap;
  const stroke: Point[] = [];
  for (let i = 0; i < count; i++) {
    const x = -halfWidth + (2 * halfWidth * i) / (count - 1);
    const t = x / halfWidth; // -1..1
    stroke.push({ x, y: baseY + bow * (1 - t * t) });
  }
  return stroke;
}

function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * physics.segmentLength override that makes StrokePipeline produce exactly
 * `segmentCount` segments for this stroke (round(L / (L/N)) === N).
 */
export function forcedSegmentLength(rawStroke: readonly Point[], segmentCount: number): number {
  if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > physics.segmentCountMax) {
    throw new Error(`forcedSegmentLength: segmentCount must be an integer in 1..${physics.segmentCountMax}`);
  }
  return polylineLength(simplifyStroke(rawStroke)) / segmentCount;
}

// -- tuning overrides ---------------------------------------------------------------

export interface SpikeTuningOverrides {
  /** Direct physics.segmentLength override (used for the forced-N matrix). */
  readonly segmentLength?: number;
  /** bridge.breakForceFactor override (calibration sweep axis 1). */
  readonly breakForceFactor?: number;
  /** Scale applied to car.chassisDensity AND car.wheelDensity (sweep axis 2). */
  readonly carDensityScale?: number;
  /** bridge.jointHertz override (chain shape stiffness, range 4-8). */
  readonly jointHertz?: number;
  /** bridge.jointAngleLimitRad override (chain bend bound, range 0.2-0.4). */
  readonly jointAngleLimitRad?: number;
  /** bridge.strokeMassToCarRatio override (chain weight share, range 0.3-1.0). */
  readonly strokeMassToCarRatio?: number;
  /** car.surfaceFriction override (rim grip, range 0.6-0.9). */
  readonly surfaceFriction?: number;
  /** car.maxMotorTorque override (climb-out capability, TBD constant). */
  readonly maxMotorTorque?: number;
  /** car.motorSpeedBase override (top speed, TBD constant). */
  readonly motorSpeedBase?: number;
  /** car.wheelOffsetX override (wheelbase half-spread, TBD spike S1). */
  readonly wheelOffsetX?: number;
  /** car.wheelRadius override (step tolerance, TBD spike S1). */
  readonly wheelRadius?: number;
}

export interface TuningSnapshot {
  readonly segmentLength: number;
  readonly breakForceFactor: number;
  readonly chassisDensity: number;
  readonly wheelDensity: number;
  readonly jointHertz: number;
  readonly jointAngleLimitRad: number;
  readonly strokeMassToCarRatio: number;
  readonly surfaceFriction: number;
  readonly maxMotorTorque: number;
  readonly motorSpeedBase: number;
  readonly wheelOffsetX: number;
  readonly wheelRadius: number;
}

/** Mutate the swept TuningConstants; returns the snapshot for restoreTuning. */
export function applyTuningOverrides(overrides: SpikeTuningOverrides): TuningSnapshot {
  const snapshot: TuningSnapshot = {
    segmentLength: physics.segmentLength,
    breakForceFactor: bridge.breakForceFactor,
    chassisDensity: car.chassisDensity,
    wheelDensity: car.wheelDensity,
    jointHertz: bridge.jointHertz,
    jointAngleLimitRad: bridge.jointAngleLimitRad,
    strokeMassToCarRatio: bridge.strokeMassToCarRatio,
    surfaceFriction: car.surfaceFriction,
    maxMotorTorque: car.maxMotorTorque,
    motorSpeedBase: car.motorSpeedBase,
    wheelOffsetX: car.wheelOffsetX,
    wheelRadius: car.wheelRadius,
  };
  if (overrides.segmentLength !== undefined) {
    physics.segmentLength = overrides.segmentLength;
  }
  if (overrides.breakForceFactor !== undefined) {
    bridge.breakForceFactor = overrides.breakForceFactor;
  }
  if (overrides.carDensityScale !== undefined) {
    car.chassisDensity = snapshot.chassisDensity * overrides.carDensityScale;
    car.wheelDensity = snapshot.wheelDensity * overrides.carDensityScale;
  }
  if (overrides.jointHertz !== undefined) {
    bridge.jointHertz = overrides.jointHertz;
  }
  if (overrides.jointAngleLimitRad !== undefined) {
    bridge.jointAngleLimitRad = overrides.jointAngleLimitRad;
  }
  if (overrides.strokeMassToCarRatio !== undefined) {
    bridge.strokeMassToCarRatio = overrides.strokeMassToCarRatio;
  }
  if (overrides.surfaceFriction !== undefined) {
    car.surfaceFriction = overrides.surfaceFriction;
  }
  if (overrides.maxMotorTorque !== undefined) {
    car.maxMotorTorque = overrides.maxMotorTorque;
  }
  if (overrides.motorSpeedBase !== undefined) {
    car.motorSpeedBase = overrides.motorSpeedBase;
  }
  if (overrides.wheelOffsetX !== undefined) {
    car.wheelOffsetX = overrides.wheelOffsetX;
  }
  if (overrides.wheelRadius !== undefined) {
    car.wheelRadius = overrides.wheelRadius;
  }
  return snapshot;
}

export function restoreTuning(snapshot: TuningSnapshot): void {
  physics.segmentLength = snapshot.segmentLength;
  bridge.breakForceFactor = snapshot.breakForceFactor;
  car.chassisDensity = snapshot.chassisDensity;
  car.wheelDensity = snapshot.wheelDensity;
  bridge.jointHertz = snapshot.jointHertz;
  bridge.jointAngleLimitRad = snapshot.jointAngleLimitRad;
  bridge.strokeMassToCarRatio = snapshot.strokeMassToCarRatio;
  car.surfaceFriction = snapshot.surfaceFriction;
  car.maxMotorTorque = snapshot.maxMotorTorque;
  car.motorSpeedBase = snapshot.motorSpeedBase;
  car.wheelOffsetX = snapshot.wheelOffsetX;
  car.wheelRadius = snapshot.wheelRadius;
}

// -- engine introspection --------------------------------------------------------------

export interface SimulationInternals {
  readonly world: World;
  readonly chain: BridgeChain | null;
  readonly stressTracker: StressTracker | null;
  readonly vehicle: Vehicle;
}

/** Reach GameSimulation's private fields (see module header for the contract). */
export function simulationInternals(simulation: GameSimulation): SimulationInternals {
  return simulation as unknown as SimulationInternals;
}

// -- instrumented run --------------------------------------------------------------------

export type SpikeOutcome = 'clear' | 'break' | 'fall' | 'tipOver' | 'timeout' | 'divergence';

export interface SpikeRunOptions {
  readonly method: PhysicsMethod;
  /** Force the chain segment count via a segmentLength override. */
  readonly forceSegmentCount?: number;
  readonly tuning?: SpikeTuningOverrides;
  /** Skip per-step performance.now() sampling (determinism runs). */
  readonly collectTimings?: boolean;
}

export interface SpikeRunResult {
  readonly outcome: SpikeOutcome;
  readonly ticks: number;
  /** Actual capsule segment count of the committed bridge. */
  readonly segments: number;
  readonly effectiveSegmentLength: number;
  /** Wall time of each GameSimulation.step() call (empty when not collected). */
  readonly stepDurationsMs: readonly number[];
  /** Max downward displacement of any intact chain body vs its commit pose (m). */
  readonly sagDepthM: number;
  readonly breakCount: number;
  /** Max smoothed joint stress observed across the run (chain method only). */
  readonly maxStress: number;
  readonly stateHash: string;
  readonly finalPos: Point;
  readonly inkConsumed: number;
}

/**
 * One full instrumented attempt: settle -> commit arc stroke -> run to outcome.
 * Consumes ONE world slot (see WORLD BUDGET). Throws when the stroke does not
 * commit — spike scenarios are authored to always commit.
 */
export function runSpikeAttempt(
  level: Level,
  rawStroke: readonly Point[],
  options: SpikeRunOptions,
): SpikeRunResult {
  const tuning: SpikeTuningOverrides = {
    ...options.tuning,
    ...(options.forceSegmentCount !== undefined
      ? { segmentLength: forcedSegmentLength(rawStroke, options.forceSegmentCount) }
      : {}),
  };
  const snapshot = applyTuningOverrides(tuning);
  const effectiveSegmentLength = physics.segmentLength;
  const shouldTime = options.collectTimings ?? true;

  let simulation: GameSimulation | null = null;
  try {
    simulation = new GameSimulation(level, { method: options.method });
    let breakCount = 0;
    simulation.events.on('break', () => {
      breakCount++;
    });

    const commit = simulation.commitStroke(rawStroke);
    if (!commit.committed) {
      throw new Error(`runSpikeAttempt: spike stroke must commit (reason: ${commit.reason})`);
    }

    const internals = simulationInternals(simulation);
    const chainBodies = internals.chain?.bodies ?? [];
    const baselineY = chainBodies.map((bodyId) => b2Body_GetPosition(bodyId).y);

    const stepDurationsMs: number[] = [];
    let sagDepthM = 0;
    let maxStress = 0;
    let outcome = simulation.outcome;
    while (outcome === null) {
      if (shouldTime) {
        const start = performance.now();
        outcome = simulation.step();
        stepDurationsMs.push(performance.now() - start);
      } else {
        outcome = simulation.step();
      }

      if (breakCount === 0) {
        // sag is only meaningful while the chain is intact
        for (let i = 0; i < chainBodies.length; i++) {
          const sag = (baselineY[i] as number) - b2Body_GetPosition(chainBodies[i] as b2BodyId).y;
          if (sag > sagDepthM) {
            sagDepthM = sag;
          }
        }
      }
      const tracker = internals.stressTracker;
      if (tracker !== null) {
        const jointCount = (internals.chain as BridgeChain).joints.length;
        for (let i = 0; i < jointCount; i++) {
          const stress = tracker.stressAt(i);
          if (stress > maxStress) {
            maxStress = stress;
          }
        }
      }
    }

    return {
      outcome:
        outcome.outcome === 'clear' ? 'clear' : outcome.cause === 'fall' && breakCount > 0 ? 'break' : outcome.cause,
      ticks: outcome.ticks,
      segments: commit.segments,
      effectiveSegmentLength,
      stepDurationsMs,
      sagDepthM,
      breakCount,
      maxStress,
      stateHash: internals.world.stateHash(),
      finalPos: simulation.referencePoint(),
      inkConsumed: commit.length,
    };
  } finally {
    simulation?.destroy();
    restoreTuning(snapshot);
  }
}

// -- S3 determinism probe ---------------------------------------------------------------------

export interface DeterminismProbeResult {
  readonly stateHash: string;
  readonly outcome: SpikeOutcome;
  readonly ticks: number;
  readonly finalPosX: number;
  readonly finalPosY: number;
}

/**
 * One S3 determinism probe: a SHORT full attempt (~3 s sim: 2 m gap, short
 * run-up) on the chain method, returning the exact-float-bits world stateHash
 * at the outcome tick. tests/unit/determinism.spec.ts and
 * scripts/spike/determinism.ts both run exactly this function — any hash
 * disagreement between runs (or across child processes) is a real divergence.
 */
export function runDeterminismProbe(): DeterminismProbeResult {
  const level = buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 });
  const result = runSpikeAttempt(level, arcStroke(2), { method: 'chain', collectTimings: false });
  return {
    stateHash: result.stateHash,
    outcome: result.outcome,
    ticks: result.ticks,
    finalPosX: result.finalPos.x,
    finalPosY: result.finalPos.y,
  };
}

// -- timing summary ---------------------------------------------------------------------------

export interface StepTimingSummary {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly samples: number;
}

/** Nearest-rank percentiles over the per-step wall times. */
export function summarizeStepDurations(durationsMs: readonly number[]): StepTimingSummary {
  if (durationsMs.length === 0) {
    return { p50Ms: 0, p95Ms: 0, maxMs: 0, samples: 0 };
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const rank = (p: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] as number;
  return {
    p50Ms: rank(0.5),
    p95Ms: rank(0.95),
    maxMs: sorted[sorted.length - 1] as number,
    samples: sorted.length,
  };
}

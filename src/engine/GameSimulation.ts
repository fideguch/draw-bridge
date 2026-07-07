/**
 * GameSimulation — one-attempt engine facade (FR-002..FR-009 substrate).
 *
 * Ties World + Terrain + StrokePipeline -> BridgeChainBuilder + Vehicle +
 * StressTracker + Judge + InkBudget + CoinTracker + EngineEvents into the
 * attempt lifecycle every consumer drives (GhostPlayer/gates headlessly,
 * PlayScene with render interpolation):
 *
 *   construct (build terrain/vehicle, settle ATTEMPT_SETTLE_TICKS)
 *     -> commitStroke(rawPoints)   [drawing -> anticipation, same frame]
 *     -> step() per fixed tick     [anticipation -> running -> ended]
 *     -> outcome                   [clear enriched with ink/stars/coins]
 *
 * SETTLE: the constructor steps the world ATTEMPT_SETTLE_TICKS so the vehicle
 * rests and sleeps before drawing. Recorded ghosts therefore never depend on
 * how long the player spent drawing (determinism protocol, Gate 2).
 *
 * INK CHOREOGRAPHY (FR-002/FR-003): commitStroke decrements the RAW polyline
 * arc length (the same-frame decrement the player watched), refunds it in
 * full when the pipeline discards the stroke, and settles an accepted stroke
 * to the SIMPLIFIED arc length (StrokePipeline totalLength — the
 * authoritative inkConsumed; RDP shortcuts only ever shorten, so the
 * settlement is a partial refund, never an extra charge). A stroke whose raw
 * length exceeds the remaining ink is rejected atomically ('insufficientInk')
 * — live drawing additionally gates vertex growth via inkState.canDraw.
 *
 * TICKS: run ticks are 0-based from the commit frame; currentTick is the most
 * recently evaluated tick (-1 before the first step) and freezes at the
 * outcome tick. Judge order encodes BR-009 (same-tick clear beats fail).
 *
 * Events are one-way Engine -> observers (constitution IV): strokeCommitted,
 * launchStarted (commit frame), launchReleased (motor engage), creak/break
 * (StressTracker), coinCollected, cleared/failed (terminal).
 */

import type { Level, Point } from './level/LevelSchema';
import type { BridgeChain, PhysicsMethod } from './physics/BridgeChainBuilder';
import type { StrokeDiscardReason } from './physics/StrokePipeline';
import type { FailCause } from './rules/Judge';
import type { InkZone } from './rules/InkBudget';
import type { StarCount } from './rules/StarRating';
import { EngineEvents } from './EngineEvents';
import { buildBridge } from './physics/BridgeChainBuilder';
import { processStroke } from './physics/StrokePipeline';
import { StressTracker, defaultBreakThresholds } from './physics/StressTracker';
import { Terrain } from './physics/Terrain';
import { Vehicle } from './physics/Vehicle';
import { World } from './physics/World';
import { CoinTracker } from './rules/CoinTracker';
import { InkBudget } from './rules/InkBudget';
import { Judge } from './rules/Judge';
import { rateStars } from './rules/StarRating';
import { fail, physics } from '@tuning/TuningConstants';

/**
 * Fixed pre-commit settle steps — see class header. Structural determinism
 * constant (not a tunable): changing it invalidates every recorded ghost.
 */
export const ATTEMPT_SETTLE_TICKS = 90;

/** The single per-attempt stroke id (exactly one stroke per attempt, FR-003). */
const ATTEMPT_STROKE_ID = 1;

export type SimulationPhase = 'drawing' | 'anticipation' | 'running' | 'ended';

export interface UpgradeLevels {
  /** Ink capacity upgrade level, 0..economy.maxUpgradeLevel. Default 0. */
  readonly inkCapacityLv?: number;
  /** Engine speed upgrade level, 0..economy.maxUpgradeLevel. Default 0. */
  readonly engineSpeedLv?: number;
}

export interface GameSimulationOptions {
  readonly upgrades?: UpgradeLevels;
  /** Bridge physics method (research R10 spike decides the default). */
  readonly method?: PhysicsMethod;
}

export type CommitStrokeResult =
  | {
      readonly committed: true;
      /** Authoritative ink consumed = simplified arc length (m). */
      readonly length: number;
      /** Capsule segment count of the built chain. */
      readonly segments: number;
      /** Committed simplified polyline (GhostSolution.stroke source). */
      readonly stroke: readonly Point[];
    }
  | { readonly committed: false; readonly reason: StrokeDiscardReason | 'insufficientInk' };

export type AttemptOutcome =
  | {
      readonly outcome: 'clear';
      readonly ticks: number;
      readonly inkConsumed: number;
      readonly starRating: StarCount;
      readonly coinsCollected: number;
    }
  | {
      readonly outcome: 'fail';
      readonly cause: FailCause;
      readonly causeLocation: Point;
      readonly ticks: number;
    };

export interface InkState {
  readonly effectiveBudget: number;
  readonly remaining: number;
  readonly consumed: number;
  readonly ratio: number;
  readonly zone: InkZone;
  readonly canDraw: boolean;
}

function rawPolylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export class GameSimulation {
  /** One-way Engine -> observers event bus (constitution IV). */
  readonly events = new EngineEvents();

  private readonly level: Level;
  private readonly method: PhysicsMethod;
  private readonly world: World;
  private readonly vehicle: Vehicle;
  private readonly inkBudget: InkBudget;
  private readonly coinTracker: CoinTracker;
  private readonly judge: Judge;

  private chain: BridgeChain | null = null;
  private stressTracker: StressTracker | null = null;
  private currentPhase: SimulationPhase = 'drawing';
  private attemptOutcome: AttemptOutcome | null = null;
  private lastEvaluatedTick = -1;
  private nextTick = 0;
  private isDestroyed = false;

  constructor(level: Level, options?: GameSimulationOptions) {
    this.level = level;
    this.method = options?.method ?? 'chain';
    this.world = new World();
    new Terrain(this.world, level);
    this.vehicle = new Vehicle(this.world, level.vehicleSpawn, {
      engineSpeedLv: options?.upgrades?.engineSpeedLv ?? 0,
    });
    this.inkBudget = new InkBudget({
      levelInkBudget: level.inkBudget,
      inkCapacityLv: options?.upgrades?.inkCapacityLv ?? 0,
    });
    this.coinTracker = new CoinTracker(level.coins);
    this.judge = new Judge({
      goalFlag: level.goalFlag,
      killY: level.killY,
      ...(level.maxTicks !== undefined ? { maxTicks: level.maxTicks } : {}),
    });
    for (let i = 0; i < ATTEMPT_SETTLE_TICKS; i++) {
      this.world.step();
    }
  }

  get phase(): SimulationPhase {
    return this.currentPhase;
  }

  /** Most recently evaluated run tick (-1 before the first step). */
  get currentTick(): number {
    return this.lastEvaluatedTick;
  }

  get outcome(): AttemptOutcome | null {
    return this.attemptOutcome;
  }

  get inkState(): InkState {
    return {
      effectiveBudget: this.inkBudget.effectiveBudget,
      remaining: this.inkBudget.remaining,
      consumed: this.inkBudget.consumed,
      ratio: this.inkBudget.ratio,
      zone: this.inkBudget.zone,
      canDraw: this.inkBudget.canDraw,
    };
  }

  /** VehicleReferencePoint (UL): chassis AABB center. */
  referencePoint(): Point {
    return this.vehicle.referencePoint();
  }

  /**
   * Solidify the drawn stroke: drawing -> anticipation in the same frame
   * (state machine: Drawing -> Solidify -> Anticipation, data-model §2).
   * A rejected/discarded stroke leaves the attempt in 'drawing'.
   */
  commitStroke(rawPoints: readonly Point[]): CommitStrokeResult {
    this.assertAlive();
    if (this.currentPhase !== 'drawing') {
      throw new Error(
        `GameSimulation.commitStroke: exactly one stroke per attempt (phase: ${this.currentPhase})`,
      );
    }

    const rawLength = rawPolylineLength(rawPoints);
    if (rawLength > this.inkBudget.remaining) {
      return { committed: false, reason: 'insufficientInk' };
    }
    const consumedRaw = this.inkBudget.consume(rawLength); // same-frame decrement (FR-002)

    const stroke = processStroke(rawPoints);
    if (stroke.discarded) {
      this.inkBudget.refund(consumedRaw); // full refund on discard (FR-003)
      return { committed: false, reason: stroke.reason };
    }
    // settle the account to the authoritative simplified length (class header)
    this.inkBudget.refund(consumedRaw - stroke.totalLength);

    this.chain = buildBridge(this.world, stroke.resampled, {
      method: this.method,
      strokeId: ATTEMPT_STROKE_ID,
      vehicleMass: this.vehicle.totalMass,
    });
    if (this.method === 'chain') {
      // compound (method A) has no stress/creak/break by design (game_design §3.3)
      this.stressTracker = new StressTracker(this.chain, {
        ...defaultBreakThresholds(this.vehicle.totalMass),
        onCreak: (jointIndex, stress) => this.events.emit('creak', { jointIndex, stress }),
        onBreak: (jointIndex, position) => this.events.emit('break', { jointIndex, position }),
      });
    }

    this.vehicle.startLaunch();
    this.currentPhase = 'anticipation';
    this.events.emit('strokeCommitted', { length: stroke.totalLength, segments: stroke.segments.length });
    this.events.emit('launchStarted');
    return {
      committed: true,
      length: stroke.totalLength,
      segments: stroke.segments.length,
      stroke: stroke.simplified,
    };
  }

  /**
   * Advance one fixed tick. Returns the outcome once the attempt ends
   * (repeat calls after the end are idempotent and return it again).
   */
  step(): AttemptOutcome | null {
    this.assertAlive();
    if (this.currentPhase === 'ended') {
      return this.attemptOutcome;
    }
    if (this.currentPhase === 'drawing') {
      throw new Error('GameSimulation.step: commit a stroke first (nothing to simulate while drawing)');
    }

    this.vehicle.tick();
    this.world.step();
    this.stressTracker?.update(physics.fixedDt);

    if (this.currentPhase === 'anticipation' && this.vehicle.phase === 'running') {
      this.currentPhase = 'running';
      this.events.emit('launchReleased');
    }

    const referencePoint = this.vehicle.referencePoint();
    for (const index of this.coinTracker.update(referencePoint)) {
      this.events.emit('coinCollected', { index, position: this.level.coins[index] as Point });
    }

    const tick = this.nextTick;
    this.lastEvaluatedTick = tick;
    const judged = this.judge.evaluate(tick, this.vehicle, this.chain);
    if (judged === null) {
      this.nextTick++;
      return null;
    }

    this.attemptOutcome = this.enrichOutcome(judged);
    this.currentPhase = 'ended';
    if (this.attemptOutcome.outcome === 'clear') {
      this.events.emit('cleared', { tick: this.attemptOutcome.ticks });
    } else {
      this.events.emit('failed', {
        cause: this.attemptOutcome.cause,
        position: this.attemptOutcome.causeLocation,
        tick: this.attemptOutcome.ticks,
      });
    }
    return this.attemptOutcome;
  }

  /** Step until the attempt ends. Judge timeout bounds the loop (FR-008). */
  runToOutcome(): AttemptOutcome {
    this.assertAlive();
    const tickBudget = (this.level.maxTicks ?? fail.maxTicksDefault) + 2; // judge must fire by then
    while (this.attemptOutcome === null) {
      if (this.nextTick > tickBudget) {
        throw new Error('GameSimulation.runToOutcome: judge produced no outcome within the tick budget');
      }
      this.step();
    }
    return this.attemptOutcome;
  }

  /** Tear down the physics world. Idempotent. */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.stressTracker?.destroy();
    this.world.destroy(); // frees every body incl. terrain/vehicle/chain
    this.isDestroyed = true;
  }

  private enrichOutcome(judged: NonNullable<ReturnType<Judge['evaluate']>>): AttemptOutcome {
    if (judged.outcome === 'clear') {
      return {
        outcome: 'clear',
        ticks: judged.ticks,
        inkConsumed: this.inkBudget.consumed,
        starRating: rateStars(this.inkBudget.consumed, this.level.starThresholds),
        coinsCollected: this.coinTracker.collectedCount,
      };
    }
    return judged;
  }

  private assertAlive(): void {
    if (this.isDestroyed) {
      throw new Error('GameSimulation: already destroyed');
    }
  }
}

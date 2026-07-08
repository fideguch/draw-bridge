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

import { b2Body_GetPosition, b2Body_GetRotation } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import type { Level, Point } from './level/LevelSchema';
import type { BridgeChain, PhysicsMethod } from './physics/BridgeChainBuilder';
import type { StrokeSegment } from './physics/StrokePipeline';
import type { StrokeDiscardReason } from './physics/StrokePipeline';
import type { FailCause } from './rules/Judge';
import type { InkZone } from './rules/InkBudget';
import type { StarCount } from './rules/StarRating';
import { EngineEvents } from './EngineEvents';
import { buildBridge } from './physics/BridgeChainBuilder';
import { processStroke } from './physics/StrokePipeline';
import { clipStrokeToSolids } from './physics/StrokeClipper';
import { StressTracker, defaultBreakThresholds } from './physics/StressTracker';
import { RockHazard } from './physics/RockHazard';
import { Terrain } from './physics/Terrain';
import { buildTerrainSolids, isPointInSolids } from './physics/TerrainSolids';
import type { TerrainSolids } from './physics/TerrainSolids';
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

/**
 * Best-effort clip fallback bound (review F1). When the clipped LONGEST outside
 * run is below the pipeline minimum, commitStroke may fall back to the UNCLIPPED
 * line ONLY if at least this fraction of the raw stroke lay outside solids — a
 * line hugging concave/staircase terrain that merely fragmented into short runs.
 * A stroke below the bound is predominantly BURIED and is DENIED (no line may
 * live inside solids), instead of the old unconditional bypass that committed
 * even a fully-buried stroke.
 *
 * Measured (probe over all 18 shipped levels + the clip fixture, 2026-07-08):
 * a fully-buried stroke has outsideFraction 0 (rejected); all 20 shipped ghosts
 * are clip NO-OPS (fraction 1, never reach the fallback); a deep-hug of the
 * ch1-l14 staircase (the ghost pushed into each concave corner past the 0.55 m
 * skin) measures fraction 0.9065 at a realistic 0.6 m over-draw and still 0.7188
 * at an implausible 1.2 m. 0.6 sits below that genuine-hug floor yet far above a
 * buried stroke (0) — a wide separation, so the exact value is not sensitive.
 * Structural constant (like SURFACE_SKIN_M).
 */
export const FALLBACK_MIN_OUTSIDE_FRACTION = 0.6;

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
  /**
   * Reuse an existing physics World instead of allocating a fresh slot. The
   * simulation resets the shared world on construction and leaves it intact on
   * destroy() (the caller owns its lifecycle) — this is how sequential attempts
   * (e.g. GhostPlayer batches) dodge the phaser-box2d 32-slot cap (World
   * header). Omit for a private, owned world.
   */
  readonly world?: World;
}

/** Why commitStroke rejected the stroke before a bridge was built. */
export type CommitDiscardReason = StrokeDiscardReason | 'insufficientInk' | 'invalidPoints';

export type CommitStrokeResult =
  | {
      readonly committed: true;
      /** Authoritative ink consumed = simplified arc length (m). */
      readonly length: number;
      /** Capsule segment count of the built chain. */
      readonly segments: number;
      /** Committed simplified polyline (GhostSolution.stroke source). */
      readonly stroke: readonly Point[];
      /**
       * True when terrain clipping altered the stroke (it touched a solid).
       * A false value means an open-air no-op commit (review F2 diagnostics).
       */
      readonly clipApplied: boolean;
      /**
       * True when the clipped run was sub-minimum and the UNCLIPPED line was
       * committed via the predominantly-outside fallback (review F1/F2). When
       * true the committed line still passes through terrain — gate/authoring
       * consumers assert this is never the case for their candidates.
       */
      readonly usedFallback: boolean;
    }
  | { readonly committed: false; readonly reason: CommitDiscardReason };

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

/** True when any point carries a non-finite coordinate (NaN/±Infinity). */
function hasNonFinitePoint(points: readonly Point[]): boolean {
  return points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y));
}

/**
 * Live world position of a chain segment's endpoint: the build-time local offset
 * (endpoint - segment midpoint) rigidly transformed by the body's current pose
 * (bodies are built with identity rotation at the segment midpoint).
 */
function liveSegmentEndpoint(bodyId: b2BodyId, segment: StrokeSegment, which: 'a' | 'b'): Point {
  const pos = b2Body_GetPosition(bodyId);
  const rot = b2Body_GetRotation(bodyId); // { c: cos, s: sin }
  const midX = (segment.a.x + segment.b.x) / 2;
  const midY = (segment.a.y + segment.b.y) / 2;
  const target = which === 'a' ? segment.a : segment.b;
  const localX = target.x - midX;
  const localY = target.y - midY;
  return {
    x: pos.x + rot.c * localX - rot.s * localY,
    y: pos.y + rot.s * localX + rot.c * localY,
  };
}

/** Perpendicular distance (m) from point `p` to the infinite line through a-b. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len = Math.hypot(abx, aby);
  if (len === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  return Math.abs(abx * (p.y - a.y) - aby * (p.x - a.x)) / len;
}

export class GameSimulation {
  /** One-way Engine -> observers event bus (constitution IV). */
  readonly events = new EngineEvents();

  private readonly world: World;
  /** True when this simulation allocated its own world (destroy frees it). */
  private readonly ownsWorld: boolean;
  private method: PhysicsMethod;
  private upgrades: UpgradeLevels;
  private level!: Level;
  private terrainSolids!: TerrainSolids;
  private vehicle!: Vehicle;
  private rockHazard!: RockHazard;
  private inkBudget!: InkBudget;
  private coinTracker!: CoinTracker;
  private judge!: Judge;

  private chain: BridgeChain | null = null;
  private stressTracker: StressTracker | null = null;
  private currentPhase: SimulationPhase = 'drawing';
  private attemptOutcome: AttemptOutcome | null = null;
  private lastEvaluatedTick = -1;
  private nextTick = 0;
  private isDestroyed = false;

  constructor(level: Level, options?: GameSimulationOptions) {
    this.method = options?.method ?? 'chain';
    this.upgrades = options?.upgrades ?? {};
    if (options?.world !== undefined) {
      this.world = options.world;
      this.ownsWorld = false;
      this.world.reset(); // start the shared slot from a clean slate
    } else {
      this.world = new World();
      this.ownsWorld = true;
    }
    this.build(level);
  }

  /**
   * (Re)build terrain + vehicle + rule trackers on the current world and settle
   * the vehicle, then reset all run state to a fresh 'drawing' attempt. Shared
   * by the constructor and reset(). Terrain is created for its side effect
   * (static bodies registered on the world), so it needs no field.
   */
  private build(level: Level): void {
    this.level = level;
    this.terrainSolids = buildTerrainSolids(level.terrain, level.killY, undefined, level.id);
    new Terrain(this.world, level);
    this.vehicle = new Vehicle(this.world, level.vehicleSpawn, {
      engineSpeedLv: this.upgrades.engineSpeedLv ?? 0,
    });
    this.inkBudget = new InkBudget({
      levelInkBudget: level.inkBudget,
      inkCapacityLv: this.upgrades.inkCapacityLv ?? 0,
    });
    this.coinTracker = new CoinTracker(level.coins);
    this.judge = new Judge({
      goalFlag: level.goalFlag,
      killY: level.killY,
      ...(level.maxTicks !== undefined ? { maxTicks: level.maxTicks } : {}),
      ...(level.dangerZones !== undefined ? { dangerZones: level.dangerZones } : {}),
    });
    this.chain = null;
    this.stressTracker = null;
    this.currentPhase = 'drawing';
    this.attemptOutcome = null;
    this.lastEvaluatedTick = -1;
    this.nextTick = 0;
    for (let i = 0; i < ATTEMPT_SETTLE_TICKS; i++) {
      this.world.step();
    }
    // Spawn rocks AFTER the settle (not before): a hazard begins at its authored
    // position when the RUN starts, instead of rolling/falling through the
    // pre-commit settle while the player is still drawing. Deterministic (level
    // data drives it) and a NO-OP when the level has no rocks — the added bodies
    // are the only difference from a pre-rock world, so a rock-free level keeps a
    // byte-identical stateHash (determinism negative control). Rock bodies enter
    // the World registry last, so they never perturb terrain/vehicle hash order.
    this.rockHazard = new RockHazard(this.world, this.level.rocks ?? []);
  }

  /**
   * Recycle this simulation for another attempt on the SAME physics world:
   * reset the world slot, rebuild everything, and re-settle. Unlimited attempts
   * without consuming new phaser-box2d slots (World header). `level`/`upgrades`
   * default to the current ones, so an argument-free reset() reproduces the
   * identical attempt.
   */
  reset(level?: Level, upgrades?: UpgradeLevels): void {
    this.assertAlive();
    if (upgrades !== undefined) {
      this.upgrades = upgrades;
    }
    this.stressTracker?.destroy(); // stop the old tracker touching freed joints
    this.world.reset();
    this.build(level ?? this.level);
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
   * True when a world-metre point sits INSIDE solid terrain (the same test the
   * commit-time stroke clip uses). The render layer calls this per live stroke
   * vertex so the drawing preview stops the line at the ground surface (a stroke
   * cannot exist inside solids — round-4 bug fix).
   */
  isInsideTerrain(point: Point): boolean {
    return isPointInSolids(point, this.terrainSolids);
  }

  // ── Render-observation surface (constitution IV) ────────────────────────────
  // Read-only handles the render layer OBSERVES to draw the live attempt (T045).
  // These never let a consumer mutate engine state; they exist so PlayScene can
  // construct VehicleRenderer/BridgeRenderer against the current attempt's bodies
  // and re-bind them after reset() rebuilds everything.

  /** The live vehicle (VehicleRenderer reads its body poses; never written). */
  get renderVehicle(): Vehicle {
    return this.vehicle;
  }

  /** The live rock hazards (RockRenderer reads their body poses; never written). */
  get renderRocks(): RockHazard {
    return this.rockHazard;
  }

  /** The built bridge chain, or null before commit / after reset (read-only). */
  get renderChain(): BridgeChain | null {
    return this.chain;
  }

  /**
   * The LIVE world-space polyline through the settled BridgeChain's capsule
   * endpoints — the physically-truthful bridge shape at this instant (atlas
   * physical-truth deliverable). A settled chain physically CANNOT lie inside
   * solids, so this line never penetrates terrain, unlike the raw authored
   * stroke. Empty before commit / after reset.
   *
   * For 'chain' each body maps 1:1 to a segment (body origin == segment
   * midpoint), so liveSegmentEndpoint is exact. For the rigid 'compound'
   * fallback the build-time segments are returned unchanged (the atlas always
   * uses the default 'chain' method, so this branch is never exercised there).
   */
  renderChainPolyline(): Point[] {
    const chain = this.chain;
    if (chain === null || chain.segments.length === 0) {
      return [];
    }
    const segments = chain.segments;
    const n = segments.length;
    if (chain.method === 'chain' && chain.bodies.length === n) {
      const points: Point[] = [
        liveSegmentEndpoint(chain.bodies[0] as b2BodyId, segments[0] as StrokeSegment, 'a'),
      ];
      for (let i = 0; i < n; i++) {
        points.push(liveSegmentEndpoint(chain.bodies[i] as b2BodyId, segments[i] as StrokeSegment, 'b'));
      }
      return points;
    }
    const points: Point[] = [(segments[0] as StrokeSegment).a];
    for (const segment of segments) {
      points.push(segment.b);
    }
    return points;
  }

  /** The stress tracker for the current chain, or null (compound/pre-commit). */
  get renderStressTracker(): StressTracker | null {
    return this.stressTracker;
  }

  /**
   * QG-6 shape-fidelity probe: perpendicular deviation (m) of the chain midpoint
   * from the chord joining the two bridge endpoints, read from LIVE engine body
   * poses. 0 when no bridge is built. A firm, shape-faithful bridge holds a
   * deviation close to the drawn bow immediately after commit and keeps most of
   * it as it settles; a floppy or collapsed bridge decays toward 0. Exposed for
   * the dev hook (bridgeMidDeviationM) and the QG-6 unit test.
   */
  chainMidDeviationM(): number {
    const chain = this.chain;
    if (chain === null) {
      return 0;
    }
    const segments = chain.segments;
    const n = segments.length;
    if (n === 0) {
      return 0;
    }
    const last = n - 1;
    const midIndex = Math.floor(n / 2);
    if (chain.method === 'chain' && chain.bodies.length === n) {
      const a = liveSegmentEndpoint(chain.bodies[0] as b2BodyId, segments[0] as StrokeSegment, 'a');
      const b = liveSegmentEndpoint(chain.bodies[last] as b2BodyId, segments[last] as StrokeSegment, 'b');
      const mid = liveSegmentEndpoint(chain.bodies[midIndex] as b2BodyId, segments[midIndex] as StrokeSegment, 'a');
      return perpendicularDistance(mid, a, b);
    }
    // Compound (rigid) or degenerate: the drawn shape is preserved rigidly, so
    // build-time geometry yields a method-appropriate deviation.
    return perpendicularDistance(
      (segments[midIndex] as StrokeSegment).a,
      (segments[0] as StrokeSegment).a,
      (segments[last] as StrokeSegment).b,
    );
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

    // Reject non-finite input up front, before any ink is touched: a NaN/Inf
    // vertex would poison rawPolylineLength (and the whole world) — discard it
    // as 'invalidPoints' with the ink budget untouched, attempt still drawable.
    if (hasNonFinitePoint(rawPoints)) {
      return { committed: false, reason: 'invalidPoints' };
    }

    const rawLength = rawPolylineLength(rawPoints);
    if (rawLength > this.inkBudget.remaining) {
      return { committed: false, reason: 'insufficientInk' };
    }
    const consumedRaw = this.inkBudget.consume(rawLength); // same-frame decrement (FR-002)

    // TERRAIN CLIP (round-4 bug): a line cannot exist inside solid ground. Split
    // the stroke into outside runs flush at the terrain surface and keep the
    // LONGEST; a stroke that never touches a solid passes through unchanged
    // (byte-identical — ghosts / determinism probe are unaffected). The clipped
    // ink is refunded via the settlement below (committed simplified length).
    const clip = clipStrokeToSolids(rawPoints, this.terrainSolids);

    // Best-effort (review F1): the clip IMPROVES the stroke but must not make an
    // otherwise valid line hugging concave/staircase terrain un-committable. When
    // the clipped LONGEST run is sub-minimum, fall back to the UNCLIPPED stroke
    // ONLY if the stroke was PREDOMINANTLY OUTSIDE solids (outsideFraction >=
    // FALLBACK_MIN_OUTSIDE_FRACTION — a mostly-open line that merely fragmented).
    // A predominantly-BURIED stroke (including a fully-buried one) is denied via
    // the path below — no committed line may live inside solids. The prior code
    // fell back unconditionally, which committed even fully-buried strokes.
    let stroke = processStroke(clip.longestRun);
    let isFallbackCommit = false;
    if (stroke.discarded && clip.clipped && clip.outsideFraction >= FALLBACK_MIN_OUTSIDE_FRACTION) {
      stroke = processStroke(rawPoints);
      isFallbackCommit = !stroke.discarded;
    }
    if (stroke.discarded) {
      this.inkBudget.refund(consumedRaw); // full refund on discard (FR-003)
      return { committed: false, reason: stroke.reason };
    }
    // settle the account to the authoritative simplified length (class header).
    // Simplification only removes vertices, so totalLength <= consumedRaw always;
    // clamp the difference to >= 0 because a perfectly straight stroke (raw ==
    // simplified length) yields float noise like -8.9e-16 that would otherwise
    // trip InkBudget.refund's >= 0 guard (settlement is a partial refund, never
    // an extra charge — class header).
    this.inkBudget.refund(Math.max(0, consumedRaw - stroke.totalLength));

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
      clipApplied: clip.clipped,
      usedFallback: isFallbackCommit,
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

    // Fix the tick being processed up front so currentTick is authoritative for
    // every event fired this step (launchReleased/coinCollected observers).
    const tick = this.nextTick;
    this.lastEvaluatedTick = tick;

    this.vehicle.tick(); // engages the motor exactly at the anticipation countdown zero
    // launchReleased fires at the anticipation->running transition BEFORE the
    // first motor-driven world.step, so the event tick equals that first
    // motorized tick (emission is inert to physics — determinism unchanged).
    if (this.currentPhase === 'anticipation' && this.vehicle.phase === 'running') {
      this.currentPhase = 'running';
      this.events.emit('launchReleased');
    }
    this.world.step();
    this.stressTracker?.update(physics.fixedDt);

    const referencePoint = this.vehicle.referencePoint();
    for (const index of this.coinTracker.update(referencePoint)) {
      this.events.emit('coinCollected', { index, position: this.level.coins[index] as Point });
    }

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

  /**
   * Tear down the attempt. Idempotent. Frees the underlying world only when this
   * simulation owns it; an injected (shared) world belongs to the caller and is
   * left intact — the next GameSimulation(level, { world }) resets it for reuse.
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.stressTracker?.destroy();
    if (this.ownsWorld) {
      this.world.destroy(); // frees every body incl. terrain/vehicle/chain
    }
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

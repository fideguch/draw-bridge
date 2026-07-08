/**
 * Judge — per-tick clear/fail arbitration (FR-007, FR-008).
 *
 * Call evaluate(tick, vehicle, chain?) once after every fixed step. Returns
 * the first JudgeOutcome or null while the run continues. One Judge instance
 * per attempt (it accumulates the roof-down window).
 *
 * Rules (data-model §1.5):
 * - clear: VehicleReferencePoint (chassis AABB center) inside the goalFlag
 *   AABB. Checked FIRST — same-tick clear + fail resolves as clear (BR-009).
 * - fall: referencePoint.y < killY. causeLocation = the fall point.
 * - tipOver: vehicle.roofContactActive sustained for fail.tipOverTimeSec
 *   (round(sec/fixedDt) consecutive evaluated ticks; any upright tick
 *   resets the window). causeLocation = the overturned chassis pose.
 * - hazard: the CAR (chassis or a wheel AABB) overlaps a DangerZone rect. The
 *   drawn BridgeChain and rocks passing through a zone are UNAFFECTED — a zone
 *   only kills the car. causeLocation = the centre of the car∩zone overlap.
 * - timeout: tick >= maxTicks (level override, default fail.maxTicksDefault).
 * - divergence failsafe (FR-005 exception): non-finite reference point, or
 *   vehicle/chain-body speed > physics.divergenceSpeedMax — reported as a
 *   fail with cause 'divergence' so the shell can run the <= 1 s reset path.
 *
 * Clear enrichment (inkConsumed / starRating / coinsCollected) happens in the
 * attempt orchestrator once InkBudget + StarRating land (T026/T027).
 */

import { b2Body_GetLinearVelocity, b2Body_GetPosition } from 'phaser-box2d';
import type { DangerZone, Point, Rect } from '../level/LevelSchema';
import type { BridgeChain } from '../physics/BridgeChainBuilder';
import type { Vehicle } from '../physics/Vehicle';
import { fail, physics } from '@tuning/TuningConstants';

export type FailCause = 'fall' | 'tipOver' | 'timeout' | 'divergence' | 'hazard';

export type JudgeOutcome =
  | { readonly outcome: 'clear'; readonly ticks: number }
  | {
      readonly outcome: 'fail';
      readonly cause: FailCause;
      /** Fail highlight anchor: fall point / chassis pose / divergence spot. */
      readonly causeLocation: Point;
      readonly ticks: number;
    };

/**
 * A `cause: 'divergence'` fail is a solver FAILSAFE, not a real loss (FR-005
 * exception, data-model §1.5): it is represented inside the fail union so the
 * engine stays uniform, but Render/Meta MUST route it to the silent <= 1 s
 * reset path — NO fail UI, NO `level_end` fail analytics, NO attempt
 * persistence — rather than the normal fall/tipOver/timeout fail flow. This
 * helper is the single predicate for that routing decision; it accepts any
 * outcome carrying `{ outcome, cause? }` (JudgeOutcome or AttemptOutcome).
 */
export function isFailsafeReset(outcome: {
  readonly outcome: 'clear' | 'fail';
  readonly cause?: FailCause;
}): boolean {
  return outcome.outcome === 'fail' && outcome.cause === 'divergence';
}

export interface JudgeLevelParams {
  readonly goalFlag: Rect;
  readonly killY: number;
  /** Level JSON override; defaults to fail.maxTicksDefault (1800 = 30 s). */
  readonly maxTicks?: number;
  /** DangerZone hazard bands (car overlap => cause 'hazard'). Absent == none. */
  readonly dangerZones?: readonly DangerZone[];
}

function isInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  );
}

/** True when an axis-aligned box overlaps the bottom-left anchored rect. */
function aabbOverlapsRect(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  rect: Rect,
): boolean {
  return (
    box.minX <= rect.x + rect.width && box.maxX >= rect.x && box.minY <= rect.y + rect.height && box.maxY >= rect.y
  );
}

export class Judge {
  private readonly goalFlag: Rect;
  private readonly killY: number;
  private readonly maxTicks: number;
  private readonly tipOverTicks: number;
  private readonly dangerZones: readonly DangerZone[];
  private roofDownTicks = 0;

  constructor(level: JudgeLevelParams) {
    this.goalFlag = level.goalFlag;
    this.killY = level.killY;
    this.maxTicks = level.maxTicks ?? fail.maxTicksDefault;
    this.tipOverTicks = Math.round(fail.tipOverTimeSec / physics.fixedDt);
    this.dangerZones = level.dangerZones ?? [];
  }

  /** Evaluate one tick. Order encodes BR-009: clear always wins. */
  evaluate(tick: number, vehicle: Vehicle, chain?: BridgeChain | null): JudgeOutcome | null {
    const referencePoint = vehicle.referencePoint();

    if (isInsideRect(referencePoint, this.goalFlag)) {
      return { outcome: 'clear', ticks: tick };
    }

    const divergence = this.checkDivergence(tick, vehicle, referencePoint, chain);
    if (divergence !== null) {
      return divergence;
    }
    if (referencePoint.y < this.killY) {
      return { outcome: 'fail', cause: 'fall', causeLocation: referencePoint, ticks: tick };
    }
    const hazard = this.checkHazard(tick, vehicle);
    if (hazard !== null) {
      return hazard;
    }
    const tipOver = this.checkTipOver(tick, vehicle);
    if (tipOver !== null) {
      return tipOver;
    }
    if (tick >= this.maxTicks) {
      return { outcome: 'fail', cause: 'timeout', causeLocation: referencePoint, ticks: tick };
    }
    return null;
  }

  /**
   * DangerZone hit: the car (chassis or either wheel AABB) overlaps a zone rect.
   * Only the car is tested — the drawn BridgeChain and rocks pass through zones
   * freely (a zone kills the car, nothing else). causeLocation is the centre of
   * the first car∩zone overlap so the fail marker points at the touch.
   */
  private checkHazard(tick: number, vehicle: Vehicle): JudgeOutcome | null {
    if (this.dangerZones.length === 0) {
      return null;
    }
    const boxes = vehicle.occupiedAABBs();
    for (const zone of this.dangerZones) {
      for (const box of boxes) {
        if (aabbOverlapsRect(box, zone)) {
          const cx = (Math.max(box.minX, zone.x) + Math.min(box.maxX, zone.x + zone.width)) / 2;
          const cy = (Math.max(box.minY, zone.y) + Math.min(box.maxY, zone.y + zone.height)) / 2;
          return { outcome: 'fail', cause: 'hazard', causeLocation: { x: cx, y: cy }, ticks: tick };
        }
      }
    }
    return null;
  }

  /** Solver-divergence failsafe: NaN or runaway speed anywhere we track. */
  private checkDivergence(
    tick: number,
    vehicle: Vehicle,
    referencePoint: Point,
    chain: BridgeChain | null | undefined,
  ): JudgeOutcome | null {
    const hasBrokenNumbers = !Number.isFinite(referencePoint.x) || !Number.isFinite(referencePoint.y);
    if (hasBrokenNumbers || vehicle.speed > physics.divergenceSpeedMax) {
      return { outcome: 'fail', cause: 'divergence', causeLocation: referencePoint, ticks: tick };
    }
    if (chain === undefined || chain === null) {
      return null;
    }
    for (const bodyId of chain.bodies) {
      const velocity = b2Body_GetLinearVelocity(bodyId);
      if (Math.hypot(velocity.x, velocity.y) > physics.divergenceSpeedMax) {
        const position = b2Body_GetPosition(bodyId);
        return {
          outcome: 'fail',
          cause: 'divergence',
          causeLocation: { x: position.x, y: position.y },
          ticks: tick,
        };
      }
    }
    return null;
  }

  /** Roof-down window: consecutive evaluated ticks; upright resets it. */
  private checkTipOver(tick: number, vehicle: Vehicle): JudgeOutcome | null {
    if (!vehicle.roofContactActive) {
      this.roofDownTicks = 0;
      return null;
    }
    this.roofDownTicks++;
    if (this.roofDownTicks < this.tipOverTicks) {
      return null;
    }
    const chassis = b2Body_GetPosition(vehicle.chassisId);
    return {
      outcome: 'fail',
      cause: 'tipOver',
      causeLocation: { x: chassis.x, y: chassis.y },
      ticks: tick,
    };
  }
}

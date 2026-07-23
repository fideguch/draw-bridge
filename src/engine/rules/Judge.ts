/**
 * Judge — per-tick clear/fail arbitration (FR-007, FR-008).
 *
 * Call evaluate(tick, vehicle, chain?, rocks?) once after every fixed step.
 * Returns the first JudgeOutcome or null while the run continues. One Judge
 * instance per attempt (it accumulates the roof-down window).
 *
 * JUDGE ORDERING (round-7 F1, game_plan_v5 §2.1 — evaluated top-down each tick):
 * - divergence failsafe (FR-005 exception): non-finite reference point, or
 *   vehicle/chain-body speed > physics.divergenceSpeedMax — reported as a fail
 *   with cause 'divergence' so the shell runs the silent <= 1 s reset. Checked
 *   FIRST so a NaN/runaway pose never feeds the geometry tests below.
 * - hazardContact (round-7 NEW, HIGHEST design priority): the CAR (chassis or a
 *   wheel AABB) touches a ROCK disc OR a DangerZone rect. Contact IS the loss —
 *   no bounce/decel: the run ends this tick with cause 'hazardContact'. This
 *   BEATS clear (game_plan_v5 §2.1: a same-tick goal-tie resolves hazard-wins;
 *   authoring never places a hazard on the goal line, so the tie is a
 *   deterministic edge only). causeLocation = the car∩hazard contact point.
 * - personContact (round-9 NEW, BR-011): the CAR (chassis or a wheel AABB) touches
 *   a Person's static AABB (derived from the person center + TuningConstants dims).
 *   Same priority TIER as hazardContact — it also BEATS clear on a same-tick tie —
 *   but a DEDICATED cause so Render can show a person-specific fail message. The
 *   drawn BridgeChain is unaffected by persons (only the car is tested).
 * - clear: VehicleReferencePoint (chassis AABB center) inside the goalFlag AABB.
 *   Still beats fall / tipOver / timeout (BR-009), only NOT hazardContact.
 * - tipOver: vehicle.roofContactActive sustained for fail.tipOverTimeSec
 *   (round(sec/fixedDt) consecutive evaluated ticks; any upright tick resets the
 *   window). causeLocation = the overturned chassis pose.
 * - fall (killY, DEMOTED — round-7 F3): referencePoint.y < killY. killY is now an
 *   OUT-OF-WORLD engine failsafe (authoring derives it at minTerrainY - 6, far
 *   below the visible frame), NOT a user-facing danger: falling into a designed
 *   pit resolves as tipOver / hazardContact (a pit-bottom DangerZone) FIRST, and
 *   `fall` only catches a car that escapes the world entirely. Routed like a
 *   failsafe (isFailsafeReset) so it never surfaces a user-facing fail cause.
 * - timeout: tick >= maxTicks (level override, default fail.maxTicksDefault).
 *
 * Clear enrichment (inkConsumed / starRating / coinsCollected) happens in the
 * attempt orchestrator once InkBudget + StarRating land (T026/T027).
 */

import { b2Body_GetLinearVelocity, b2Body_GetPosition } from 'phaser-box2d';
import type { DangerZone, Person, Point, Rect } from '../level/LevelSchema';
import type { BridgeChain } from '../physics/BridgeChainBuilder';
import type { Vehicle } from '../physics/Vehicle';
import { fail, person as personDims, physics } from '@tuning/TuningConstants';

/**
 * `hazardContact` (round-7 F1) unifies the rock and DangerZone/spike contact
 * losses under ONE cause: the CAR touching any hazard body is an immediate game
 * over (game_plan_v5 §2.1). `personContact` (round-9 BR-011) is the same-tier but
 * DEDICATED cause for touching a Person NPC (own Render message). `fall` is the
 * DEMOTED out-of-world killY failsafe (F3) — kept in the union for the internal
 * reset path, never a user-facing cause.
 */
export type FailCause = 'fall' | 'tipOver' | 'timeout' | 'divergence' | 'hazardContact' | 'personContact';

export type JudgeOutcome =
  | { readonly outcome: 'clear'; readonly ticks: number }
  | {
      readonly outcome: 'fail';
      readonly cause: FailCause;
      /** Fail highlight anchor: contact point / fall point / chassis pose. */
      readonly causeLocation: Point;
      readonly ticks: number;
    };

/** A live (physical, non-armed) rock disc the Judge tests for car contact. */
export interface HazardDisc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * FAILSAFE ROUTING PREDICATE (round-7). Render/Meta MUST route a failsafe fail to
 * the SILENT <= 1 s reset path — NO fail UI, NO `level_end` fail analytics, NO
 * attempt persistence — rather than the normal tipOver/timeout fail flow:
 *
 * - `divergence`: a solver FAILSAFE (FR-005 exception, data-model §1.5), not a
 *   real loss — a NaN/runaway solver state.
 * - `fall`: the out-of-world killY failsafe (round-7 F3, game_plan_v5 §4). killY
 *   sits far below the frame (minTerrainY - 6), so `fall` only fires when a car
 *   escapes the world — an abnormal case with no user-facing meaning. Designed
 *   pit losses surface as tipOver / hazardContact instead.
 *
 * It accepts any outcome carrying `{ outcome, cause? }` (JudgeOutcome or
 * AttemptOutcome). This is the single predicate for that routing decision.
 */
export function isFailsafeReset(outcome: {
  readonly outcome: 'clear' | 'fail';
  readonly cause?: FailCause;
}): boolean {
  return outcome.outcome === 'fail' && (outcome.cause === 'divergence' || outcome.cause === 'fall');
}

export interface JudgeLevelParams {
  readonly goalFlag: Rect;
  /** Out-of-world engine failsafe plane (round-7 F3): fall fires below it. */
  readonly killY: number;
  /** Level JSON override; defaults to fail.maxTicksDefault (1800 = 30 s). */
  readonly maxTicks?: number;
  /** DangerZone hazard bands (car overlap => hazardContact). Absent == none. */
  readonly dangerZones?: readonly DangerZone[];
  /** Person NPC centres (round-9 BR-011; car overlap => personContact). Absent == none. */
  readonly persons?: readonly Person[];
}

/** The static AABB a Person occupies: its centre point +/- the TuningConstants dims. */
function personToRect(centre: Person): Rect {
  return {
    x: centre.x - personDims.halfWidth,
    y: centre.y - personDims.halfHeight,
    width: 2 * personDims.halfWidth,
    height: 2 * personDims.halfHeight,
  };
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

/** Nearest point on the box to (cx, cy) — the car∩hazard contact anchor. */
function nearestPointOnBox(
  cx: number,
  cy: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
): Point {
  return {
    x: Math.min(Math.max(cx, box.minX), box.maxX),
    y: Math.min(Math.max(cy, box.minY), box.maxY),
  };
}

export class Judge {
  private readonly goalFlag: Rect;
  private readonly killY: number;
  private readonly maxTicks: number;
  private readonly tipOverTicks: number;
  private readonly dangerZones: readonly DangerZone[];
  /** Static person AABBs derived once from the level's person centres (BR-011). */
  private readonly personRects: readonly Rect[];
  private roofDownTicks = 0;

  constructor(level: JudgeLevelParams) {
    this.goalFlag = level.goalFlag;
    this.killY = level.killY;
    this.maxTicks = level.maxTicks ?? fail.maxTicksDefault;
    this.tipOverTicks = Math.round(fail.tipOverTimeSec / physics.fixedDt);
    this.dangerZones = level.dangerZones ?? [];
    this.personRects = (level.persons ?? []).map(personToRect);
  }

  /**
   * Evaluate one tick. Order encodes game_plan_v5 §2.1: divergence failsafe first
   * (NaN guard), then hazardContact (beats clear), then clear (beats the rest),
   * then tipOver, then the demoted fall failsafe, then timeout. `rocks` are the
   * LIVE (non-armed) rock discs this tick — omit for a rock-free level.
   */
  evaluate(
    tick: number,
    vehicle: Vehicle,
    chain?: BridgeChain | null,
    rocks?: readonly HazardDisc[],
  ): JudgeOutcome | null {
    const referencePoint = vehicle.referencePoint();

    const divergence = this.checkDivergence(tick, vehicle, referencePoint, chain);
    if (divergence !== null) {
      return divergence;
    }
    // hazardContact BEFORE clear: contact IS the loss and wins a same-tick goal
    // tie (game_plan_v5 §2.1 hazard-wins). Also uses the pose only after the
    // divergence NaN guard above, so occupiedAABBs are always finite here.
    const hazard = this.checkHazardContact(tick, vehicle, rocks);
    if (hazard !== null) {
      return hazard;
    }
    // personContact (round-9 BR-011): same tier as hazardContact — also beats clear.
    const person = this.checkPersonContact(tick, vehicle);
    if (person !== null) {
      return person;
    }
    if (isInsideRect(referencePoint, this.goalFlag)) {
      return { outcome: 'clear', ticks: tick };
    }
    const tipOver = this.checkTipOver(tick, vehicle);
    if (tipOver !== null) {
      return tipOver;
    }
    if (referencePoint.y < this.killY) {
      return { outcome: 'fail', cause: 'fall', causeLocation: referencePoint, ticks: tick };
    }
    if (tick >= this.maxTicks) {
      return { outcome: 'fail', cause: 'timeout', causeLocation: referencePoint, ticks: tick };
    }
    return null;
  }

  /**
   * hazardContact (round-7 F1): the CAR (chassis or either wheel AABB) touches a
   * ROCK disc or a DangerZone rect. Contact IS the loss — the run ends this tick.
   * Only the car is tested (VEHICLE fixtures): the drawn BridgeChain and rocks
   * passing over/through a zone are UNAFFECTED. DangerZones are checked before
   * rocks for a stable, deterministic cause anchor; causeLocation is the point on
   * the car nearest the touching hazard so the fail marker sits on the contact.
   */
  private checkHazardContact(
    tick: number,
    vehicle: Vehicle,
    rocks: readonly HazardDisc[] | undefined,
  ): JudgeOutcome | null {
    const hasRocks = rocks !== undefined && rocks.length > 0;
    if (this.dangerZones.length === 0 && !hasRocks) {
      return null;
    }
    const boxes = vehicle.occupiedAABBs();
    for (const zone of this.dangerZones) {
      for (const box of boxes) {
        if (aabbOverlapsRect(box, zone)) {
          const cx = (Math.max(box.minX, zone.x) + Math.min(box.maxX, zone.x + zone.width)) / 2;
          const cy = (Math.max(box.minY, zone.y) + Math.min(box.maxY, zone.y + zone.height)) / 2;
          return { outcome: 'fail', cause: 'hazardContact', causeLocation: { x: cx, y: cy }, ticks: tick };
        }
      }
    }
    if (rocks !== undefined) {
      for (const rock of rocks) {
        for (const box of boxes) {
          const near = nearestPointOnBox(rock.x, rock.y, box);
          if (Math.hypot(rock.x - near.x, rock.y - near.y) <= rock.radius) {
            return { outcome: 'fail', cause: 'hazardContact', causeLocation: near, ticks: tick };
          }
        }
      }
    }
    return null;
  }

  /**
   * personContact (round-9 BR-011): the CAR (chassis or either wheel AABB) touches
   * a Person's static AABB. Contact IS the loss — the run ends this tick with the
   * DEDICATED cause 'personContact' (same tier as hazardContact: called before
   * clear, so it wins a same-tick goal tie). Only the car is tested — the drawn
   * BridgeChain passes through persons UNAFFECTED. causeLocation = the centre of
   * the car∩person overlap so the fail marker sits on the contact.
   */
  private checkPersonContact(tick: number, vehicle: Vehicle): JudgeOutcome | null {
    if (this.personRects.length === 0) {
      return null;
    }
    const boxes = vehicle.occupiedAABBs();
    for (const rect of this.personRects) {
      for (const box of boxes) {
        if (aabbOverlapsRect(box, rect)) {
          const cx = (Math.max(box.minX, rect.x) + Math.min(box.maxX, rect.x + rect.width)) / 2;
          const cy = (Math.max(box.minY, rect.y) + Math.min(box.maxY, rect.y + rect.height)) / 2;
          return { outcome: 'fail', cause: 'personContact', causeLocation: { x: cx, y: cy }, ticks: tick };
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

/**
 * StressTracker — per-joint stress, creak band, break, orphan fade (FR-006).
 *
 * Every tick (call update(dt) once after each World.step):
 *   raw = |constraintForce| / breakForce + |constraintTorque| / breakTorque
 *   ema = stressEmaKeep * ema + stressEmaNew * raw     (TuningConstants)
 * - ema in [creakBandMin, 1.0)  -> onCreak(jointIndex, stress) each tick
 * - ema >= 1.0                  -> b2DestroyJoint + onBreak(jointIndex, pos);
 *   ALL over-threshold joints break in the same step (data-model §1.3)
 * - break position = midpoint of the two adjacent segment bodies (render
 *   fracture highlight anchor)
 *
 * ORPHAN RULE (documented decision): a segment is an orphan when EVERY joint
 * incident to it in the original chain topology is broken — i.e. the segment
 * is fully detached (end segments have one incident joint, interior two).
 * Multi-segment fragments keep intact internal joints, so they persist as
 * "the remaining bridge". Orphans immediately stop colliding with the car
 * (maskBits loses CATEGORY_VEHICLE; game_design §3.2 anti-stuck rule) and
 * expire for removal after bridge.debrisFadeDelaySec of update() time.
 *
 * Only 'chain' bridges are trackable — method A (compound) has no joints and
 * no break behavior by design (game_design §3.3), so the constructor rejects it.
 */

import {
  b2Body_GetPosition,
  b2Body_GetShapes,
  b2DestroyJoint,
  b2Filter,
  b2Joint_GetConstraintForce,
  b2Joint_GetConstraintTorque,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
} from 'phaser-box2d';
import type { b2BodyId, b2JointId, b2ShapeId } from 'phaser-box2d';
import type { Point } from '../level/LevelSchema';
import type { BridgeChain } from './BridgeChainBuilder';
import { MASK_NO_VEHICLE } from './CollisionCategories';
import { bridge, physics } from '@tuning/TuningConstants';

/** raw stress: force and torque shares of their break thresholds (pure). */
export function computeRawStress(
  force: Readonly<{ x: number; y: number }>,
  torque: number,
  breakForce: number,
  breakTorque: number,
): number {
  return Math.hypot(force.x, force.y) / breakForce + Math.abs(torque) / breakTorque;
}

/** One EMA step with the fixed keep/new weights from TuningConstants (pure). */
export function updateStressEma(previousEma: number, raw: number): number {
  return bridge.stressEmaKeep * previousEma + bridge.stressEmaNew * raw;
}

/**
 * Default thresholds per data-model §1.3: breakForce = breakForceFactor x
 * vehicle static load (m x |g|). breakTorque uses one segment length as the
 * lever arm — provisional until spike S1 tuning.
 */
export function defaultBreakThresholds(vehicleMass: number): { breakForce: number; breakTorque: number } {
  const staticLoad = vehicleMass * Math.abs(physics.gravityY);
  const breakForce = bridge.breakForceFactor * staticLoad;
  return { breakForce, breakTorque: breakForce * physics.segmentLength };
}

export interface StressTrackerOptions {
  readonly breakForce: number;
  readonly breakTorque: number;
  /** Fired each tick a joint's smoothed stress sits in [creakBandMin, 1.0). */
  readonly onCreak?: (jointIndex: number, stress: number) => void;
  /** Fired once when a joint breaks; position anchors the fracture highlight. */
  readonly onBreak?: (jointIndex: number, position: Point) => void;
}

export interface OrphanState {
  readonly segmentIndex: number;
  /** Seconds of update() time left before the fragment expires. */
  readonly fadeRemainingSec: number;
  /** True once the fade elapsed — Render removes the fragment. */
  readonly expired: boolean;
}

export class StressTracker {
  private readonly chain: BridgeChain;
  private readonly breakForce: number;
  private readonly breakTorque: number;
  private readonly onCreak: ((jointIndex: number, stress: number) => void) | undefined;
  private readonly onBreak: ((jointIndex: number, position: Point) => void) | undefined;
  private readonly ema: number[];
  private readonly broken: boolean[];
  /** segmentIndex -> fade seconds remaining (present = orphaned). */
  private readonly fadeTimers = new Map<number, number>();
  private isDestroyed = false;

  constructor(chain: BridgeChain, options: StressTrackerOptions) {
    if (chain.method !== 'chain') {
      throw new Error('StressTracker: only method C ("chain") bridges break; compound fallback has no stress');
    }
    if (!(options.breakForce > 0) || !(options.breakTorque > 0)) {
      throw new Error('StressTracker: breakForce and breakTorque must be > 0');
    }
    this.chain = chain;
    this.breakForce = options.breakForce;
    this.breakTorque = options.breakTorque;
    this.onCreak = options.onCreak;
    this.onBreak = options.onBreak;
    this.ema = chain.joints.map(() => 0);
    this.broken = chain.joints.map(() => false);
  }

  /** Smoothed stress of a joint (last computed value; broken joints freeze). */
  stressAt(jointIndex: number): number {
    return this.ema[jointIndex] ?? 0;
  }

  isBroken(jointIndex: number): boolean {
    return this.broken[jointIndex] ?? false;
  }

  /** Snapshot of current orphan fragments (fully detached segments). */
  orphans(): readonly OrphanState[] {
    return [...this.fadeTimers.entries()].map(([segmentIndex, fadeRemainingSec]) => ({
      segmentIndex,
      fadeRemainingSec,
      expired: fadeRemainingSec <= 0,
    }));
  }

  /** Call once per fixed step, after World.step. dt also drives orphan fade. */
  update(dtSec: number): void {
    if (this.isDestroyed) {
      return;
    }
    const toBreak = this.computeStress();
    const newlyOrphaned = new Set<number>();
    for (const jointIndex of toBreak) {
      this.breakJoint(jointIndex, newlyOrphaned);
    }
    this.tickFadeTimers(dtSec, newlyOrphaned);
  }

  /** Stop firing events and mutating the world. Idempotent. */
  destroy(): void {
    this.isDestroyed = true;
  }

  /** EMA update + creak events; returns the joints at/over break threshold. */
  private computeStress(): number[] {
    const toBreak: number[] = [];
    for (let i = 0; i < this.chain.joints.length; i++) {
      if (this.broken[i] === true) {
        continue;
      }
      const jointId = this.chain.joints[i] as b2JointId;
      const raw = computeRawStress(
        b2Joint_GetConstraintForce(jointId),
        b2Joint_GetConstraintTorque(jointId),
        this.breakForce,
        this.breakTorque,
      );
      const ema = updateStressEma(this.ema[i] as number, raw);
      this.ema[i] = ema;
      if (ema >= 1.0) {
        toBreak.push(i); // all over-threshold joints break this same step
      } else if (ema >= bridge.creakBandMin) {
        this.onCreak?.(i, ema);
      }
    }
    return toBreak;
  }

  private breakJoint(jointIndex: number, newlyOrphaned: Set<number>): void {
    const jointId = this.chain.joints[jointIndex] as b2JointId;
    const position = this.jointPosition(jointIndex);
    b2DestroyJoint(jointId);
    this.broken[jointIndex] = true;
    this.onBreak?.(jointIndex, position);
    // joint i sits between segments i and i+1 — both may now be detached
    this.orphanIfDetached(jointIndex, newlyOrphaned);
    this.orphanIfDetached(jointIndex + 1, newlyOrphaned);
  }

  /** Fracture anchor: midpoint of the two adjacent segment bodies. */
  private jointPosition(jointIndex: number): Point {
    const a = b2Body_GetPosition(this.chain.bodies[jointIndex] as b2BodyId);
    const b = b2Body_GetPosition(this.chain.bodies[jointIndex + 1] as b2BodyId);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Orphan rule: every incident joint of the segment is broken. */
  private orphanIfDetached(segmentIndex: number, newlyOrphaned: Set<number>): void {
    if (segmentIndex < 0 || segmentIndex >= this.chain.segments.length || this.fadeTimers.has(segmentIndex)) {
      return;
    }
    const incident = [segmentIndex - 1, segmentIndex].filter((j) => j >= 0 && j < this.chain.joints.length);
    if (!incident.every((j) => this.broken[j] === true)) {
      return;
    }
    this.fadeTimers.set(segmentIndex, bridge.debrisFadeDelaySec);
    newlyOrphaned.add(segmentIndex);
    this.disableVehicleCollision(segmentIndex);
  }

  /** Debris stops colliding with the car but still lands on terrain. */
  private disableVehicleCollision(segmentIndex: number): void {
    const bodyId = this.chain.bodies[segmentIndex] as b2BodyId;
    const shapes: b2ShapeId[] = [];
    b2Body_GetShapes(bodyId, shapes);
    for (const shapeId of shapes) {
      const current = b2Shape_GetFilter(shapeId);
      const filter = new b2Filter();
      filter.categoryBits = current.categoryBits;
      filter.groupIndex = current.groupIndex;
      filter.maskBits = current.maskBits & MASK_NO_VEHICLE;
      b2Shape_SetFilter(shapeId, filter);
    }
  }

  /** Fade starts the update AFTER orphaning (full debrisFadeDelaySec window). */
  private tickFadeTimers(dtSec: number, newlyOrphaned: ReadonlySet<number>): void {
    for (const [segmentIndex, remaining] of this.fadeTimers) {
      if (remaining > 0 && !newlyOrphaned.has(segmentIndex)) {
        this.fadeTimers.set(segmentIndex, remaining - dtSec);
      }
    }
  }
}

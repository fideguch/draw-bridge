/**
 * BridgeChainBuilder — solidifies a resampled stroke into physics (FR-003).
 *
 * Method C ('chain', primary): one dynamic capsule body per segment, adjacent
 * bodies linked by revolute joints with enableSpring (bridge.jointHertz /
 * jointDampingRatio) + enableLimit (±perJointAngleLimit) and
 * collideConnected=false. Load makes the chain genuinely sag — the design's
 * signature differentiator (game_design §3.2).
 *
 * FLEX BUDGET (game-feel rebuild 2026-07-08): the per-joint angle limit is NOT
 * a fixed constant — it is DERIVED so the whole bridge shares a fixed TOTAL
 * bend budget: perJointLimit = clamp(bridge.totalFlexBudgetRad / jointCount,
 * jointAngleLimitMinRad, jointAngleLimitRad). This decouples firmness from the
 * segment count: a short stroke now resamples to many joints (SEGMENT_COUNT_MIN
 * 6), and a fixed per-joint limit would let total flex = jointCount x limit
 * balloon into rope-like sag. Sharing the budget keeps every bridge reading as
 * a FIRM drawn line with subtle give, regardless of N.
 *
 * Method A ('compound', fallback): ONE dynamic body carrying all N capsule
 * shapes, zero joints — rigid, no stress/creak/break (game_design §3.3);
 * bending becomes a render-only effect.
 *
 * Shared rules (both methods):
 * - segment geometry comes straight from StrokePipeline's resampled polyline
 * - filter.groupIndex = -strokeId turns same-stroke self-collision off
 * - total mass is clamped to bridge.strokeMassToCarRatio x vehicleMass by
 *   deriving density from the summed capsule area (2rL + PI r^2 — matches
 *   b2ComputeCapsuleMass exactly)
 *
 * Bodies are created with identity rotation; capsule endpoints are expressed
 * in body-local coordinates, so segment orientation lives in the shape.
 */

import {
  b2Capsule,
  b2CreateCapsuleShape,
  b2CreateRevoluteJoint,
  b2DefaultRevoluteJointDef,
  b2DefaultShapeDef,
  b2DestroyJoint,
  b2Joint_IsValid,
  b2Vec2,
} from 'phaser-box2d';
import type { b2BodyId, b2JointId, b2ShapeDef } from 'phaser-box2d';
import type { Point } from '../level/LevelSchema';
import type { StrokeSegment } from './StrokePipeline';
import type { World } from './World';
import { CATEGORY_BRIDGE, MASK_ALL } from './CollisionCategories';
import { bridge, car, physics } from '@tuning/TuningConstants';

export type PhysicsMethod = 'chain' | 'compound';

export interface BuildBridgeOptions {
  readonly method: PhysicsMethod;
  /** Positive integer; becomes the negative collision groupIndex. */
  readonly strokeId: number;
  /** Vehicle total mass in kg — the chain mass clamp target reference. */
  readonly vehicleMass: number;
}

export interface BridgeChain {
  readonly method: PhysicsMethod;
  readonly strokeId: number;
  /** N bodies for 'chain', exactly 1 for 'compound'. */
  readonly bodies: readonly b2BodyId[];
  /** N-1 revolute joints for 'chain', empty for 'compound'. */
  readonly joints: readonly b2JointId[];
  /** Segment endpoint pairs (world coordinates at build time). */
  readonly segments: readonly StrokeSegment[];
  /** Remove all joints (if still alive) and bodies. Idempotent. */
  destroy(): void;
}

function toSegments(resampled: readonly Point[]): StrokeSegment[] {
  const segments: StrokeSegment[] = [];
  for (let i = 0; i < resampled.length - 1; i++) {
    segments.push({ a: resampled[i] as Point, b: resampled[i + 1] as Point });
  }
  return segments;
}

function capsuleArea(length: number): number {
  const r = bridge.capsuleRadius;
  return 2 * r * length + Math.PI * r * r;
}

/** Density so that the summed capsule mass equals ratio x vehicleMass. */
function densityFor(segments: readonly StrokeSegment[], vehicleMass: number): number {
  const totalArea = segments.reduce((sum, s) => sum + capsuleArea(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)), 0);
  return (bridge.strokeMassToCarRatio * vehicleMass) / totalArea;
}

function bridgeShapeDef(strokeId: number, density: number): b2ShapeDef {
  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = density;
  shapeDef.friction = car.surfaceFriction;
  shapeDef.restitution = 0;
  shapeDef.filter.groupIndex = -strokeId; // same-stroke self-collision off
  shapeDef.filter.categoryBits = CATEGORY_BRIDGE;
  shapeDef.filter.maskBits = MASK_ALL;
  return shapeDef;
}

function localCapsule(segment: StrokeSegment, origin: Point): b2Capsule {
  const capsule = new b2Capsule();
  capsule.center1 = new b2Vec2(segment.a.x - origin.x, segment.a.y - origin.y);
  capsule.center2 = new b2Vec2(segment.b.x - origin.x, segment.b.y - origin.y);
  capsule.radius = bridge.capsuleRadius;
  return capsule;
}

function validateOptions(resampled: readonly Point[], options: BuildBridgeOptions): void {
  if (resampled.length < 2) {
    throw new Error('buildBridge: expected >= 2 resampled points (V12: shorter strokes are discarded upstream)');
  }
  const segmentCount = resampled.length - 1;
  if (segmentCount > physics.segmentCountMax) {
    throw new Error(`buildBridge: ${segmentCount} segments exceeds physics.segmentCountMax (${physics.segmentCountMax})`);
  }
  if (!Number.isInteger(options.strokeId) || options.strokeId < 1) {
    throw new Error(`buildBridge: strokeId must be a positive integer (got ${options.strokeId})`);
  }
  if (!Number.isFinite(options.vehicleMass) || options.vehicleMass <= 0) {
    throw new Error(`buildBridge: vehicleMass must be a finite number > 0 (got ${options.vehicleMass})`);
  }
}

function buildChainBodies(world: World, segments: readonly StrokeSegment[], options: BuildBridgeOptions): b2BodyId[] {
  const density = densityFor(segments, options.vehicleMass);
  const bodies: b2BodyId[] = [];
  for (const segment of segments) {
    const mid: Point = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
    const bodyId = world.createBody({ type: 'dynamic', position: mid });
    b2CreateCapsuleShape(bodyId, bridgeShapeDef(options.strokeId, density), localCapsule(segment, mid));
    bodies.push(bodyId);
  }
  return bodies;
}

/**
 * Per-joint bend limit (radians) so the whole chain shares bridge.totalFlexBudgetRad.
 * jointCount = bodies - 1; clamped to [jointAngleLimitMinRad, jointAngleLimitRad].
 */
export function perJointAngleLimit(jointCount: number): number {
  const budgeted = bridge.totalFlexBudgetRad / Math.max(1, jointCount);
  return Math.max(bridge.jointAngleLimitMinRad, Math.min(bridge.jointAngleLimitRad, budgeted));
}

function linkChainJoints(
  world: World,
  bodies: readonly b2BodyId[],
  segments: readonly StrokeSegment[],
): b2JointId[] {
  const joints: b2JointId[] = [];
  const angleLimit = perJointAngleLimit(bodies.length - 1);
  for (let i = 0; i < bodies.length - 1; i++) {
    const segA = segments[i] as StrokeSegment;
    const segB = segments[i + 1] as StrokeSegment;
    const shared = segA.b; // === segB.a (StrokePipeline invariant)
    const centerA: Point = { x: (segA.a.x + segA.b.x) / 2, y: (segA.a.y + segA.b.y) / 2 };
    const centerB: Point = { x: (segB.a.x + segB.b.x) / 2, y: (segB.a.y + segB.b.y) / 2 };

    const def = b2DefaultRevoluteJointDef();
    def.bodyIdA = bodies[i] as b2BodyId;
    def.bodyIdB = bodies[i + 1] as b2BodyId;
    def.localAnchorA = new b2Vec2(shared.x - centerA.x, shared.y - centerA.y);
    def.localAnchorB = new b2Vec2(shared.x - centerB.x, shared.y - centerB.y);
    def.enableSpring = true;
    def.hertz = bridge.jointHertz;
    def.dampingRatio = bridge.jointDampingRatio;
    def.enableLimit = true;
    def.lowerAngle = -angleLimit;
    def.upperAngle = angleLimit;
    def.collideConnected = false;
    joints.push(world.registerJoint(b2CreateRevoluteJoint(world.id, def)));
  }
  return joints;
}

function buildCompoundBody(world: World, segments: readonly StrokeSegment[], options: BuildBridgeOptions): b2BodyId {
  const density = densityFor(segments, options.vehicleMass);
  // Body origin at the average of segment midpoints (any fixed origin works).
  const origin: Point = segments.reduce<Point>(
    (acc, s) => ({
      x: acc.x + (s.a.x + s.b.x) / (2 * segments.length),
      y: acc.y + (s.a.y + s.b.y) / (2 * segments.length),
    }),
    { x: 0, y: 0 },
  );
  const bodyId = world.createBody({ type: 'dynamic', position: origin });
  for (const segment of segments) {
    b2CreateCapsuleShape(bodyId, bridgeShapeDef(options.strokeId, density), localCapsule(segment, origin));
  }
  return bodyId;
}

/**
 * Build a bridge from StrokePipeline's resampled polyline.
 * 'chain' = method C (capsule chain, sag/break capable);
 * 'compound' = method A (single rigid body fallback).
 */
export function buildBridge(world: World, resampled: readonly Point[], options: BuildBridgeOptions): BridgeChain {
  validateOptions(resampled, options);
  const segments = toSegments(resampled);

  const bodies =
    options.method === 'chain'
      ? buildChainBodies(world, segments, options)
      : [buildCompoundBody(world, segments, options)];
  const joints = options.method === 'chain' ? linkChainJoints(world, bodies, segments) : [];

  let isDestroyed = false;
  return {
    method: options.method,
    strokeId: options.strokeId,
    bodies,
    joints,
    segments,
    destroy(): void {
      if (isDestroyed) {
        return;
      }
      for (const jointId of joints) {
        if (b2Joint_IsValid(jointId)) {
          b2DestroyJoint(jointId); // StressTracker may have broken some already
        }
      }
      for (const bodyId of bodies) {
        world.destroyBody(bodyId);
      }
      isDestroyed = true;
    },
  };
}

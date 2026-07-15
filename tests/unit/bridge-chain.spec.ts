import { describe, expect, it } from 'vitest';
import {
  b2Body_GetMass,
  b2Body_GetPosition,
  b2Body_GetShapeCount,
  b2Body_GetShapes,
  b2Joint_IsValid,
  b2RevoluteJoint_GetLowerLimit,
  b2RevoluteJoint_GetSpringDampingRatio,
  b2RevoluteJoint_GetSpringHertz,
  b2RevoluteJoint_GetUpperLimit,
  b2RevoluteJoint_IsLimitEnabled,
  b2RevoluteJoint_IsSpringEnabled,
  b2Shape_GetFilter,
} from 'phaser-box2d';
import type { b2BodyId, b2ShapeId } from 'phaser-box2d';
import type { Point } from '@engine/level/LevelSchema';
import { buildBridge, perJointAngleLimit } from '@engine/physics/BridgeChainBuilder';
import { processStroke } from '@engine/physics/StrokePipeline';
import { Terrain } from '@engine/physics/Terrain';
import { World } from '@engine/physics/World';
import { bridge } from '@tuning/TuningConstants';

/**
 * T018 — bridge chain builder (FR-003).
 * Method C ('chain'): capsule segment bodies linked by revolute spring joints
 * (hertz/damping/limit from TuningConstants, collideConnected=false,
 * groupIndex = -strokeId). Method A ('compound'): one dynamic body with N
 * capsule shapes, no joints. Both consume the same StrokePipeline output.
 */

const VEHICLE_MASS = 4; // kg — stand-in until Vehicle lands (T023)
const STROKE_ID = 1;

/** Straight horizontal stroke: cheap, predictable resample geometry. */
function horizontalResample(x0: number, x1: number, y: number): readonly Point[] {
  const result = processStroke([
    { x: x0, y },
    { x: x1, y },
  ]);
  if (result.discarded) {
    throw new Error('fixture stroke must not be discarded');
  }
  return result.resampled;
}

function shapesOf(bodyId: b2BodyId): b2ShapeId[] {
  const shapes: b2ShapeId[] = [];
  b2Body_GetShapes(bodyId, shapes);
  return shapes;
}

describe('BridgeChainBuilder — method C (chain)', () => {
  it('creates N capsule bodies and N-1 revolute joints for N segments', () => {
    const world = new World();
    const resampled = horizontalResample(-3, 3, 1); // 6m / 0.65m ~ 9 segments
    const chain = buildBridge(world, resampled, { method: 'chain', strokeId: STROKE_ID, vehicleMass: VEHICLE_MASS });

    const segmentCount = resampled.length - 1;
    expect(segmentCount).toBeGreaterThanOrEqual(8);
    expect(chain.segments).toHaveLength(segmentCount);
    expect(chain.bodies).toHaveLength(segmentCount);
    expect(chain.joints).toHaveLength(segmentCount - 1);
    expect(world.bodyCount).toBe(segmentCount);
    // one capsule shape per body
    for (const bodyId of chain.bodies) {
      expect(b2Body_GetShapeCount(bodyId)).toBe(1);
    }
    world.destroy();
  });

  it('sets joint spring/limit params from TuningConstants and enables both', () => {
    const world = new World();
    const chain = buildBridge(world, horizontalResample(-2, 2, 1), {
      method: 'chain',
      strokeId: STROKE_ID,
      vehicleMass: VEHICLE_MASS,
    });

    // Per-joint angle limit is DERIVED so the whole chain shares
    // bridge.totalFlexBudgetRad (game-feel rebuild): limit scales with 1/jointCount.
    const expectedLimit = perJointAngleLimit(chain.joints.length);
    expect(expectedLimit).toBeGreaterThan(0);
    expect(expectedLimit).toBeLessThanOrEqual(bridge.jointAngleLimitRad);
    for (const jointId of chain.joints) {
      expect(b2RevoluteJoint_IsSpringEnabled(jointId)).toBe(true);
      expect(b2RevoluteJoint_GetSpringHertz(jointId)).toBe(bridge.jointHertz);
      expect(b2RevoluteJoint_GetSpringDampingRatio(jointId)).toBe(bridge.jointDampingRatio);
      expect(b2RevoluteJoint_IsLimitEnabled(jointId)).toBe(true);
      expect(b2RevoluteJoint_GetLowerLimit(jointId)).toBeCloseTo(-expectedLimit, 10);
      expect(b2RevoluteJoint_GetUpperLimit(jointId)).toBeCloseTo(expectedLimit, 10);
    }
    world.destroy();
  });

  it('turns same-stroke self-collision off via filter groupIndex = -strokeId', () => {
    const world = new World();
    const strokeId = 7;
    const chain = buildBridge(world, horizontalResample(-2, 2, 1), {
      method: 'chain',
      strokeId,
      vehicleMass: VEHICLE_MASS,
    });

    for (const bodyId of chain.bodies) {
      for (const shapeId of shapesOf(bodyId)) {
        expect(b2Shape_GetFilter(shapeId).groupIndex).toBe(-strokeId);
      }
    }
    world.destroy();
  });

  it('clamps total chain mass to strokeMassToCarRatio x vehicle mass', () => {
    const world = new World();
    const chain = buildBridge(world, horizontalResample(-3, 3, 1), {
      method: 'chain',
      strokeId: STROKE_ID,
      vehicleMass: VEHICLE_MASS,
    });

    const totalMass = chain.bodies.reduce((sum, bodyId) => sum + b2Body_GetMass(bodyId), 0);
    expect(totalMass).toBeCloseTo(bridge.strokeMassToCarRatio * VEHICLE_MASS, 6);
    world.destroy();
  });

  it('SAGS under gravity across a gap (mid drops below endpoints) — the method C differentiator', () => {
    const world = new World();
    // two plateaus with a 4m gap; chain overhangs both rims by ~1.5m
    new Terrain(world, {
      terrain: [
        [
          [-8, 0],
          [-2, 0],
        ],
        [
          [2, 0],
          [8, 0],
        ],
      ],
      killY: -10,
    });
    const resampled = horizontalResample(-3.5, 3.5, 0.3);
    const chain = buildBridge(world, resampled, { method: 'chain', strokeId: STROKE_ID, vehicleMass: VEHICLE_MASS });

    const midIndex = Math.floor(chain.bodies.length / 2);
    const initialMidY = b2Body_GetPosition(chain.bodies[midIndex] as b2BodyId).y;

    for (let i = 0; i < 60; i++) {
      world.step();
    }

    const firstY = b2Body_GetPosition(chain.bodies[0] as b2BodyId).y;
    const lastY = b2Body_GetPosition(chain.bodies[chain.bodies.length - 1] as b2BodyId).y;
    const midY = b2Body_GetPosition(chain.bodies[midIndex] as b2BodyId).y;

    // ends rest on the plateaus, middle sags into the gap
    expect(midY).toBeLessThan(initialMidY - 0.05);
    expect(midY).toBeLessThan(firstY - 0.05);
    expect(midY).toBeLessThan(lastY - 0.05);
    // still a bridge, not a free-falling rope: joints keep it above the kill plane
    expect(midY).toBeGreaterThan(-2);
    world.destroy();
  });

  it('destroy removes all bodies and joints (idempotent)', () => {
    const world = new World();
    const chain = buildBridge(world, horizontalResample(-2, 2, 1), {
      method: 'chain',
      strokeId: STROKE_ID,
      vehicleMass: VEHICLE_MASS,
    });
    expect(world.bodyCount).toBeGreaterThan(0);

    chain.destroy();
    expect(world.bodyCount).toBe(0);
    for (const jointId of chain.joints) {
      expect(b2Joint_IsValid(jointId)).toBe(false);
    }
    chain.destroy(); // idempotent
    expect(world.bodyCount).toBe(0);
    world.destroy();
  });
});

describe('BridgeChainBuilder — method A (compound fallback)', () => {
  it('creates ONE dynamic body with N capsule shapes and zero joints', () => {
    const world = new World();
    const resampled = horizontalResample(-3, 3, 1);
    const chain = buildBridge(world, resampled, {
      method: 'compound',
      strokeId: STROKE_ID,
      vehicleMass: VEHICLE_MASS,
    });

    const segmentCount = resampled.length - 1;
    expect(chain.bodies).toHaveLength(1);
    expect(chain.joints).toHaveLength(0);
    expect(chain.segments).toHaveLength(segmentCount);
    expect(world.bodyCount).toBe(1);
    expect(b2Body_GetShapeCount(chain.bodies[0] as b2BodyId)).toBe(segmentCount);
    world.destroy();
  });

  it('applies the same mass clamp and self-collision filter as method C', () => {
    const world = new World();
    const strokeId = 3;
    const chain = buildBridge(world, horizontalResample(-3, 3, 1), {
      method: 'compound',
      strokeId,
      vehicleMass: VEHICLE_MASS,
    });

    expect(b2Body_GetMass(chain.bodies[0] as b2BodyId)).toBeCloseTo(bridge.strokeMassToCarRatio * VEHICLE_MASS, 6);
    for (const shapeId of shapesOf(chain.bodies[0] as b2BodyId)) {
      expect(b2Shape_GetFilter(shapeId).groupIndex).toBe(-strokeId);
    }
    chain.destroy();
    expect(world.bodyCount).toBe(0);
    world.destroy();
  });
});

describe('BridgeChainBuilder — input validation (V12)', () => {
  it('rejects fewer than 2 resampled points', () => {
    const world = new World();
    expect(() =>
      buildBridge(world, [{ x: 0, y: 0 }], { method: 'chain', strokeId: STROKE_ID, vehicleMass: VEHICLE_MASS }),
    ).toThrow();
    world.destroy();
  });

  it('rejects a non-positive-integer strokeId (groupIndex needs -strokeId)', () => {
    const world = new World();
    const resampled = horizontalResample(-2, 2, 1);
    expect(() => buildBridge(world, resampled, { method: 'chain', strokeId: 0, vehicleMass: VEHICLE_MASS })).toThrow();
    expect(() =>
      buildBridge(world, resampled, { method: 'chain', strokeId: 1.5, vehicleMass: VEHICLE_MASS }),
    ).toThrow();
    world.destroy();
  });

  it('rejects a non-positive vehicleMass (mass clamp needs a target)', () => {
    const world = new World();
    const resampled = horizontalResample(-2, 2, 1);
    expect(() => buildBridge(world, resampled, { method: 'chain', strokeId: STROKE_ID, vehicleMass: 0 })).toThrow();
    world.destroy();
  });

  it('rejects more segments than physics.segmentCountMax', () => {
    const world = new World();
    // hand-built 40-point polyline -> 39 segments > 32 cap (bypasses processStroke)
    const tooMany: Point[] = [];
    for (let i = 0; i < 40; i++) {
      tooMany.push({ x: i * 0.65, y: 0 });
    }
    expect(() =>
      buildBridge(world, tooMany, { method: 'chain', strokeId: STROKE_ID, vehicleMass: VEHICLE_MASS }),
    ).toThrow();
    world.destroy();
  });
});

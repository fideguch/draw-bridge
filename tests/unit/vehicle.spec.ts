import { describe, expect, it } from 'vitest';
import {
  b2Body_GetMass,
  b2Body_GetPosition,
  b2Body_SetTransform,
  b2Joint_IsValid,
  b2MakeRot,
  b2Vec2,
  b2WheelJoint_GetMaxMotorTorque,
  b2WheelJoint_GetMotorSpeed,
  b2WheelJoint_GetSpringDampingRatio,
  b2WheelJoint_GetSpringHertz,
  b2WheelJoint_IsMotorEnabled,
} from 'phaser-box2d';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { car, economy, launch, physics } from '@tuning/TuningConstants';

/**
 * T022 — vehicle (FR-005, FR-019 effect wiring).
 * Chassis (rounded box) + 2 wheels + 2 wheel joints (suspension from
 * TuningConstants). Launch: idle -> startLaunch() -> anticipation countdown
 * (launch.anticipationSec worth of ticks) -> rear motor engages with the REAL
 * upgrade multiplier (BR-005): motorSpeedBase x (1 + lv x speedPerLevelPct/100).
 */

const FLAT_GROUND = {
  terrain: [
    [
      [-20, 0],
      [20, 0],
    ],
  ],
  killY: -7,
} as const;

/** Wheel resting height + small drop-in margin. */
const SPAWN = { x: 0, y: car.wheelRadius - car.wheelOffsetY + 0.05 };

function settledVehicle(world: World, engineSpeedLv = 0): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN, { engineSpeedLv });
  for (let i = 0; i < 90; i++) {
    world.step(); // idle settle — motor stays off
  }
  return vehicle;
}

describe('Vehicle — structure', () => {
  it('creates 3 bodies (chassis + 2 wheels) and 2 wheel joints', () => {
    const world = new World();
    expect(world.bodyCount).toBe(0);
    const vehicle = new Vehicle(world, SPAWN);
    expect(world.bodyCount).toBe(3);
    expect(vehicle.wheelJointIds).toHaveLength(2);
    for (const jointId of vehicle.wheelJointIds) {
      expect(b2Joint_IsValid(jointId)).toBe(true);
    }
    expect(vehicle.totalMass).toBeGreaterThan(0);
    const summed =
      b2Body_GetMass(vehicle.chassisId) +
      vehicle.wheelIds.reduce((sum, wheelId) => sum + b2Body_GetMass(wheelId), 0);
    expect(vehicle.totalMass).toBeCloseTo(summed, 10);

    vehicle.destroy();
    expect(world.bodyCount).toBe(0);
    world.destroy();
  });

  it('applies suspension hertz/damping from TuningConstants to both wheel joints', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    for (const jointId of vehicle.wheelJointIds) {
      expect(b2WheelJoint_GetSpringHertz(jointId)).toBe(car.suspensionHertz);
      expect(b2WheelJoint_GetSpringDampingRatio(jointId)).toBe(car.suspensionDampingRatio);
      expect(b2WheelJoint_GetMaxMotorTorque(jointId)).toBe(car.maxMotorTorque);
    }
    world.destroy();
  });

  it('spawns idle: motor disabled on both wheels', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    expect(vehicle.phase).toBe('idle');
    for (const jointId of vehicle.wheelJointIds) {
      expect(b2WheelJoint_IsMotorEnabled(jointId)).toBe(false);
    }
    world.destroy();
  });
});

describe('Vehicle — launch sequence (Anticipation -> Running)', () => {
  it('derives anticipationTicks from launch.anticipationSec at the fixed step rate', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    expect(vehicle.anticipationTicks).toBe(Math.round(launch.anticipationSec / physics.fixedDt));
    world.destroy();
  });

  it('engages the rear motor EXACTLY after anticipationTicks ticks', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    vehicle.startLaunch();
    expect(vehicle.phase).toBe('anticipation');

    // during anticipation: motor off, car still
    for (let i = 0; i < vehicle.anticipationTicks - 1; i++) {
      vehicle.tick();
      world.step();
      expect(vehicle.phase).toBe('anticipation');
    }
    expect(b2WheelJoint_IsMotorEnabled(vehicle.rearWheelJointId)).toBe(false);
    expect(vehicle.speed).toBeLessThan(0.05);

    // the anticipationTicks-th tick engages the motor
    vehicle.tick();
    expect(vehicle.phase).toBe('running');
    expect(b2WheelJoint_IsMotorEnabled(vehicle.rearWheelJointId)).toBe(true);

    // and the car actually drives forward on flat terrain
    const startX = b2Body_GetPosition(vehicle.chassisId).x;
    for (let i = 0; i < 60; i++) {
      vehicle.tick();
      world.step();
    }
    expect(b2Body_GetPosition(vehicle.chassisId).x).toBeGreaterThan(startX + 0.3);
    expect(vehicle.speed).toBeGreaterThan(0.5);
    // wheels are really rolling
    const [rearOmega, frontOmega] = vehicle.wheelAngularVelocities();
    expect(Math.abs(rearOmega)).toBeGreaterThan(0.5);
    expect(Math.abs(frontOmega)).toBeGreaterThan(0.5);
    world.destroy();
  });

  it('startLaunch is only valid from idle (no double launch)', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    vehicle.startLaunch();
    expect(() => vehicle.startLaunch()).toThrow();
    world.destroy();
  });
});

describe('Vehicle — upgrade multiplier is REAL physics (BR-005)', () => {
  it('effectiveMotorSpeed = motorSpeedBase x (1 + lv x speedPerLevelPct/100)', () => {
    const world = new World();
    const lv0 = new Vehicle(world, SPAWN);
    const lv3 = new Vehicle(world, { x: 6, y: SPAWN.y }, { engineSpeedLv: 3 });

    expect(lv0.effectiveMotorSpeed).toBeCloseTo(car.motorSpeedBase, 12);
    const expectedMultiplier = 1 + 3 * (economy.speedPerLevelPct / 100);
    expect(lv3.effectiveMotorSpeed).toBeCloseTo(car.motorSpeedBase * expectedMultiplier, 12);
    expect(lv3.effectiveMotorSpeed / lv0.effectiveMotorSpeed).toBeCloseTo(expectedMultiplier, 12);
    world.destroy();
  });

  it('sets the engaged rear-motor speed to the effective value (front stays motorless)', () => {
    const world = new World();
    const vehicle = settledVehicle(world, 5);
    vehicle.startLaunch();
    for (let i = 0; i < vehicle.anticipationTicks; i++) {
      vehicle.tick();
      world.step();
    }
    expect(Math.abs(b2WheelJoint_GetMotorSpeed(vehicle.rearWheelJointId))).toBeCloseTo(
      vehicle.effectiveMotorSpeed,
      12,
    );
    expect(b2WheelJoint_IsMotorEnabled(vehicle.frontWheelJointId)).toBe(false);
    world.destroy();
  });

  it('rejects an engineSpeedLv outside 0..maxUpgradeLevel', () => {
    const world = new World();
    expect(() => new Vehicle(world, SPAWN, { engineSpeedLv: -1 })).toThrow();
    expect(() => new Vehicle(world, SPAWN, { engineSpeedLv: economy.maxUpgradeLevel + 1 })).toThrow();
    world.destroy();
  });
});

describe('Vehicle — referencePoint and roof contact', () => {
  it('referencePoint = chassis AABB center, tracking the chassis as it moves', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const before = vehicle.referencePoint();
    const chassisBefore = b2Body_GetPosition(vehicle.chassisId);
    expect(before.x).toBeCloseTo(chassisBefore.x, 1);
    expect(before.y).toBeCloseTo(chassisBefore.y, 1);

    vehicle.startLaunch();
    for (let i = 0; i < vehicle.anticipationTicks + 60; i++) {
      vehicle.tick();
      world.step();
    }
    const after = vehicle.referencePoint();
    expect(after.x).toBeGreaterThan(before.x + 0.3);
    expect(after.x).toBeCloseTo(b2Body_GetPosition(vehicle.chassisId).x, 1);
    world.destroy();
  });

  it('roofContactActive uses the chassis-inversion angle definition', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    expect(vehicle.roofContactActive).toBe(false);

    // mild tilt (0.5 rad) is NOT roof contact
    const pos = b2Body_GetPosition(vehicle.chassisId);
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(0.5));
    expect(vehicle.roofContactActive).toBe(false);

    // fully inverted IS
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(Math.PI));
    expect(vehicle.roofContactActive).toBe(true);
    world.destroy();
  });
});

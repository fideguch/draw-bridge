import { describe, expect, it } from 'vitest';
import { b2Body_GetPosition, b2Body_SetLinearVelocity, b2Body_SetTransform, b2MakeRot, b2Vec2 } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import type { Rect } from '@engine/level/LevelSchema';
import { buildBridge } from '@engine/physics/BridgeChainBuilder';
import { processStroke } from '@engine/physics/StrokePipeline';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { Judge, isFailsafeReset } from '@engine/rules/Judge';
import type { JudgeOutcome } from '@engine/rules/Judge';
import { car, fail, physics } from '@tuning/TuningConstants';

/**
 * T024 — judge (FR-007, FR-008).
 * Clear: VehicleReferencePoint (chassis AABB center) inside the goalFlag AABB.
 * Fail: fall (rp.y < killY), tipOver (roof-down sustained fail.tipOverTimeSec),
 * timeout (tick >= maxTicks, default fail.maxTicksDefault), divergence
 * failsafe (speed > physics.divergenceSpeedMax). Same-tick clear + fail
 * resolves as CLEAR (BR-009).
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

const SPAWN = { x: 0, y: car.wheelRadius - car.wheelOffsetY + 0.05 };
const FAR_FLAG: Rect = { x: 15, y: 0, width: 1, height: 2 };

const TIP_OVER_TICKS = Math.round(fail.tipOverTimeSec / physics.fixedDt);

function settledVehicle(world: World): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN);
  for (let i = 0; i < 90; i++) {
    world.step();
  }
  return vehicle;
}

describe('Judge — clear (FR-007)', () => {
  it('returns clear on the tick the reference point enters the goalFlag AABB', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: { x: 2.5, y: 0, width: 1, height: 2 }, killY: FLAT_GROUND.killY });

    vehicle.startLaunch();
    let outcome: JudgeOutcome | null = null;
    let tick = 0;
    for (; tick < 600 && outcome === null; tick++) {
      vehicle.tick();
      world.step();
      outcome = judge.evaluate(tick, vehicle);
    }

    expect(outcome).not.toBeNull();
    expect(outcome?.outcome).toBe('clear');
    if (outcome?.outcome === 'clear') {
      expect(outcome.ticks).toBeGreaterThan(vehicle.anticipationTicks);
      // the reference point really is inside the flag at the clear tick
      const rp = vehicle.referencePoint();
      expect(rp.x).toBeGreaterThanOrEqual(2.5);
      expect(rp.x).toBeLessThanOrEqual(3.5);
    }
    world.destroy();
  });

  it('returns null while no condition holds', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    for (let tick = 0; tick < 120; tick++) {
      world.step();
      expect(judge.evaluate(tick, vehicle)).toBeNull();
    }
    world.destroy();
  });
});

describe('Judge — fall (FR-008)', () => {
  it('fails with cause "fall" and the fall point when rp.y drops below killY', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN); // no terrain: free fall
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: -5 });

    let outcome: JudgeOutcome | null = null;
    for (let tick = 0; tick < 300 && outcome === null; tick++) {
      world.step();
      outcome = judge.evaluate(tick, vehicle);
    }

    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('fall');
      // cause location = the reference point at the failing tick (just past killY)
      expect(outcome.causeLocation.y).toBeLessThan(-5);
      expect(outcome.causeLocation.y).toBeGreaterThan(-6);
      expect(outcome.causeLocation.x).toBeCloseTo(SPAWN.x, 1);
    }
    world.destroy();
  });
});

describe('Judge — tip over (FR-008)', () => {
  it('fails only after roof-down persists for tipOverTimeSec worth of ticks', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    const pos = b2Body_GetPosition(vehicle.chassisId);
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(Math.PI));

    // no stepping: transform (and thus roofContactActive) stays inverted
    let tick = 0;
    for (let i = 0; i < TIP_OVER_TICKS - 1; i++) {
      expect(judge.evaluate(tick++, vehicle)).toBeNull();
    }
    const outcome = judge.evaluate(tick++, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('tipOver');
      // cause location = the overturned chassis pose
      expect(outcome.causeLocation.x).toBeCloseTo(pos.x, 1);
      expect(outcome.causeLocation.y).toBeCloseTo(pos.y, 1);
    }
    world.destroy();
  });

  it('resets the roof-down counter when the chassis recovers', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    const pos = b2Body_GetPosition(vehicle.chassisId);

    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(Math.PI));
    let tick = 0;
    for (let i = 0; i < TIP_OVER_TICKS - 5; i++) {
      expect(judge.evaluate(tick++, vehicle)).toBeNull();
    }
    // recover upright: counter must reset
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(0));
    expect(judge.evaluate(tick++, vehicle)).toBeNull();

    // invert again: a FULL window is required once more
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(pos.x, pos.y), b2MakeRot(Math.PI));
    for (let i = 0; i < TIP_OVER_TICKS - 1; i++) {
      expect(judge.evaluate(tick++, vehicle)).toBeNull();
    }
    expect(judge.evaluate(tick++, vehicle)?.outcome).toBe('fail');
    world.destroy();
  });
});

describe('Judge — timeout (FR-008)', () => {
  it('fails at fail.maxTicksDefault when the level has no override', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    expect(judge.evaluate(fail.maxTicksDefault - 1, vehicle)).toBeNull();
    const outcome = judge.evaluate(fail.maxTicksDefault, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('timeout');
      expect(outcome.ticks).toBe(fail.maxTicksDefault);
    }
    world.destroy();
  });

  it('honors the level maxTicks override', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY, maxTicks: 100 });
    expect(judge.evaluate(99, vehicle)).toBeNull();
    expect(judge.evaluate(100, vehicle)?.outcome).toBe('fail');
    world.destroy();
  });
});

describe('Judge — divergence failsafe (FR-005 exception)', () => {
  it('fails with cause "divergence" when vehicle speed exceeds divergenceSpeedMax', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    b2Body_SetLinearVelocity(vehicle.chassisId, new b2Vec2(physics.divergenceSpeedMax + 20, 0));
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('divergence');
      expect(Number.isFinite(outcome.causeLocation.x)).toBe(true);
    }
    world.destroy();
  });

  it('also trips on a diverged bridge chain body', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const stroke = processStroke([
      { x: 2, y: 1 },
      { x: 5, y: 1 },
    ]);
    if (stroke.discarded) {
      expect.fail('fixture stroke must not be discarded');
    }
    const chain = buildBridge(world, stroke.resampled, {
      method: 'chain',
      strokeId: 1,
      vehicleMass: vehicle.totalMass,
    });
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    expect(judge.evaluate(0, vehicle, chain)).toBeNull();

    b2Body_SetLinearVelocity(chain.bodies[0] as b2BodyId, new b2Vec2(0, -(physics.divergenceSpeedMax + 20)));
    const outcome = judge.evaluate(1, vehicle, chain);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('divergence');
    }
    world.destroy();
  });
});

describe('Judge — same-tick precedence (BR-009)', () => {
  it('clear beats fail when both hold on the same tick', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    // flag BELOW the kill plane: entering it also means rp.y < killY
    const judge = new Judge({ goalFlag: { x: -1, y: -8, width: 2, height: 1 }, killY: -5 });
    b2Body_SetTransform(vehicle.chassisId, new b2Vec2(0, -7.5), b2MakeRot(0));

    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('clear');
    world.destroy();
  });
});

describe('isFailsafeReset — failsafe routing helper (L5 + round-7 F3)', () => {
  it('is true for divergence AND the round-7 out-of-world fall failsafe', () => {
    expect(isFailsafeReset({ outcome: 'fail', cause: 'divergence' })).toBe(true);
    // round-7 F3: killY is now minY-6 (out-of-world), so `fall` is a failsafe that
    // silently resets — never a user-facing cause (game_plan_v5 §4).
    expect(isFailsafeReset({ outcome: 'fail', cause: 'fall' })).toBe(true);
  });

  it('is false for real user-facing fails (tipOver / timeout / hazardContact) and for clears', () => {
    expect(isFailsafeReset({ outcome: 'fail', cause: 'tipOver' })).toBe(false);
    expect(isFailsafeReset({ outcome: 'fail', cause: 'timeout' })).toBe(false);
    expect(isFailsafeReset({ outcome: 'fail', cause: 'hazardContact' })).toBe(false);
    expect(isFailsafeReset({ outcome: 'clear' })).toBe(false);
  });

  it('classifies a real Judge divergence outcome as a failsafe reset', () => {
    const world = new World();
    const vehicle = new Vehicle(world, SPAWN);
    const judge = new Judge({ goalFlag: { x: 100, y: 100, width: 1, height: 1 }, killY: -50 });
    // runaway chassis speed > physics.divergenceSpeedMax triggers the failsafe
    b2Body_SetLinearVelocity(vehicle.chassisId, new b2Vec2(physics.divergenceSpeedMax + 10, 0));

    const outcome = judge.evaluate(5, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('divergence');
      expect(isFailsafeReset(outcome)).toBe(true);
    }
    world.destroy();
  });
});

import { describe, expect, it } from 'vitest';
import { b2Joint_IsValid, b2Body_GetShapes, b2Shape_GetFilter } from 'phaser-box2d';
import type { b2BodyId, b2JointId, b2ShapeId } from 'phaser-box2d';
import type { Point } from '@engine/level/LevelSchema';
import { buildBridge } from '@engine/physics/BridgeChainBuilder';
import type { BridgeChain } from '@engine/physics/BridgeChainBuilder';
import { CATEGORY_VEHICLE } from '@engine/physics/CollisionCategories';
import { processStroke } from '@engine/physics/StrokePipeline';
import {
  StressTracker,
  computeRawStress,
  defaultBreakThresholds,
  updateStressEma,
} from '@engine/physics/StressTracker';
import { Terrain } from '@engine/physics/Terrain';
import { World } from '@engine/physics/World';
import { bridge, physics } from '@tuning/TuningConstants';

/**
 * T020 — per-joint stress/break (FR-006).
 * raw = |F|/breakForce + |tau|/breakTorque, EMA-smoothed
 * (bridge.stressEmaKeep/stressEmaNew). Creak band [creakBandMin, 1.0) fires
 * onCreak; ema >= 1.0 destroys the joint (partial collapse). Fully detached
 * segments become orphans: fade over bridge.debrisFadeDelaySec, car-collision
 * disabled immediately.
 */

const VEHICLE_MASS = 4;

interface CreakEvent {
  readonly tick: number;
  readonly jointIndex: number;
  readonly stress: number;
}

interface BreakEvent {
  readonly tick: number;
  readonly jointIndex: number;
  readonly position: Point;
}

function resampleLine(x0: number, x1: number, y: number): readonly Point[] {
  const result = processStroke([
    { x: x0, y },
    { x: x1, y },
  ]);
  if (result.discarded) {
    throw new Error('fixture stroke must not be discarded');
  }
  return result.resampled;
}

/** Chain over a 4m gap with tiny break thresholds -> sag load breaks joints. */
function buildBreakScene(world: World): BridgeChain {
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
  return buildBridge(world, resampleLine(-3.5, 3.5, 0.3), {
    method: 'chain',
    strokeId: 1,
    vehicleMass: VEHICLE_MASS,
  });
}

describe('StressTracker — EMA math (pure, exact)', () => {
  it('computeRawStress = |F|/breakForce + |torque|/breakTorque', () => {
    // |F| = hypot(3, 4) = 5
    expect(computeRawStress({ x: 3, y: 4 }, 2, 10, 4)).toBeCloseTo(5 / 10 + 2 / 4, 12);
    expect(computeRawStress({ x: 0, y: 0 }, 0, 10, 4)).toBe(0);
    expect(computeRawStress({ x: 0, y: -10 }, -8, 10, 4)).toBeCloseTo(1 + 2, 12);
  });

  it('updateStressEma applies keep/new weights from TuningConstants', () => {
    expect(updateStressEma(0, 1)).toBeCloseTo(bridge.stressEmaNew, 12);
    expect(updateStressEma(0.5, 1)).toBeCloseTo(bridge.stressEmaKeep * 0.5 + bridge.stressEmaNew * 1, 12);
    expect(updateStressEma(1, 0)).toBeCloseTo(bridge.stressEmaKeep, 12);
    // fixed pair sanity: weights sum to 1 so a constant signal is a fixed point
    expect(updateStressEma(0.7, 0.7)).toBeCloseTo(0.7, 12);
  });

  it('defaultBreakThresholds derives from breakForceFactor x static load', () => {
    const { breakForce, breakTorque } = defaultBreakThresholds(VEHICLE_MASS);
    const staticLoad = VEHICLE_MASS * Math.abs(physics.gravityY);
    expect(breakForce).toBeCloseTo(bridge.breakForceFactor * staticLoad, 12);
    expect(breakTorque).toBeGreaterThan(0);
  });
});

describe('StressTracker — creak and break on a loaded chain', () => {
  it('fires creak events in [creakBandMin, 1.0) and then breaks: joint destroyed + marked broken', () => {
    const world = new World();
    const chain = buildBreakScene(world);
    const creaks: CreakEvent[] = [];
    const breaks: BreakEvent[] = [];
    let tick = 0;
    const tracker = new StressTracker(chain, {
      breakForce: 2,
      breakTorque: 2,
      onCreak: (jointIndex, stress) => creaks.push({ tick, jointIndex, stress }),
      onBreak: (jointIndex, position) => breaks.push({ tick, jointIndex, position: { ...position } }),
    });

    for (; tick < 120 && breaks.length === 0; tick++) {
      world.step();
      tracker.update(physics.fixedDt);
    }

    expect(breaks.length).toBeGreaterThan(0);
    const firstBreak = breaks[0] as BreakEvent;

    // EMA smoothing forces the stress through the creak band before breaking
    expect(creaks.length).toBeGreaterThan(0);
    const firstCreak = creaks[0] as CreakEvent;
    expect(firstCreak.tick).toBeLessThanOrEqual(firstBreak.tick);
    for (const creak of creaks) {
      expect(creak.stress).toBeGreaterThanOrEqual(bridge.creakBandMin);
      expect(creak.stress).toBeLessThan(1.0);
    }

    // broken joint is really gone from the world and marked in the tracker
    const brokenJointId = chain.joints[firstBreak.jointIndex] as b2JointId;
    expect(b2Joint_IsValid(brokenJointId)).toBe(false);
    expect(tracker.isBroken(firstBreak.jointIndex)).toBe(true);
    expect(Number.isFinite(firstBreak.position.x)).toBe(true);
    expect(Number.isFinite(firstBreak.position.y)).toBe(true);

    // physics keeps running after partial collapse
    world.step();
    tracker.update(physics.fixedDt);
    world.destroy();
  });

  it('rejects a compound chain (fallback mode has no stress/creak/break)', () => {
    const world = new World();
    const compound = buildBridge(world, resampleLine(-2, 2, 1), {
      method: 'compound',
      strokeId: 1,
      vehicleMass: VEHICLE_MASS,
    });
    expect(() => new StressTracker(compound, { breakForce: 1, breakTorque: 1 })).toThrow();
    world.destroy();
  });

  it('rejects non-finite or non-positive break thresholds (L7)', () => {
    const world = new World();
    const chain = buildBridge(world, resampleLine(-2, 2, 1), {
      method: 'chain',
      strokeId: 1,
      vehicleMass: VEHICLE_MASS,
    });
    const badThresholds = [
      { breakForce: Number.NaN, breakTorque: 1 },
      { breakForce: 1, breakTorque: Number.POSITIVE_INFINITY },
      { breakForce: Number.NEGATIVE_INFINITY, breakTorque: 1 },
      { breakForce: 0, breakTorque: 1 },
      { breakForce: 1, breakTorque: -1 },
    ];
    for (const thresholds of badThresholds) {
      expect(() => new StressTracker(chain, thresholds)).toThrow(/finite|> 0/);
    }
    // a valid finite positive pair is still accepted
    expect(() => new StressTracker(chain, { breakForce: 1, breakTorque: 1 })).not.toThrow();
    world.destroy();
  });
});

describe('StressTracker — orphan fragments (FR-006 debris rule)', () => {
  /**
   * 2-segment chain balanced on a narrow central pillar: both ends hang, the
   * single joint bends and breaks under tiny thresholds -> BOTH segments lose
   * all their joints and become orphans.
   */
  function buildOrphanScene(world: World): BridgeChain {
    new Terrain(world, {
      terrain: [
        [
          [-0.2, 0],
          [0.2, 0],
        ],
      ],
      killY: -10,
    });
    return buildBridge(world, resampleLine(-0.65, 0.65, 0.3), {
      method: 'chain',
      strokeId: 1,
      vehicleMass: VEHICLE_MASS,
    });
  }

  function stepUntilBreak(world: World, tracker: StressTracker, maxTicks: number): number {
    for (let tick = 0; tick < maxTicks; tick++) {
      world.step();
      tracker.update(physics.fixedDt);
      if (tracker.isBroken(0)) {
        return tick;
      }
    }
    throw new Error('fixture: joint never broke');
  }

  function maskOf(bodyId: b2BodyId): number {
    const shapes: b2ShapeId[] = [];
    b2Body_GetShapes(bodyId, shapes);
    return b2Shape_GetFilter(shapes[0] as b2ShapeId).maskBits;
  }

  it('fully detached segments fade for debrisFadeDelaySec then expire; car-collision disabled at once', () => {
    const world = new World();
    const chain = buildOrphanScene(world);
    expect(chain.segments).toHaveLength(2);
    const tracker = new StressTracker(chain, { breakForce: 0.5, breakTorque: 0.5 });

    expect(tracker.orphans()).toHaveLength(0);
    expect(maskOf(chain.bodies[0] as b2BodyId) & CATEGORY_VEHICLE).toBe(CATEGORY_VEHICLE);

    stepUntilBreak(world, tracker, 300);

    // both segments lost their only joint -> both orphaned
    const orphans = tracker.orphans();
    expect(orphans.map((o) => o.segmentIndex).sort()).toEqual([0, 1]);
    for (const orphan of orphans) {
      expect(orphan.fadeRemainingSec).toBeCloseTo(bridge.debrisFadeDelaySec, 6);
      expect(orphan.expired).toBe(false);
    }
    // car-collision disabled immediately on orphaning
    expect(maskOf(chain.bodies[0] as b2BodyId) & CATEGORY_VEHICLE).toBe(0);
    expect(maskOf(chain.bodies[1] as b2BodyId) & CATEGORY_VEHICLE).toBe(0);

    // advance the clock: not expired until debrisFadeDelaySec has elapsed
    tracker.update(1.0);
    tracker.update(1.0);
    expect(tracker.orphans().every((o) => !o.expired)).toBe(true);
    tracker.update(1.0); // total 3.0s = bridge.debrisFadeDelaySec
    expect(tracker.orphans().every((o) => o.expired)).toBe(true);
    world.destroy();
  });

  it('a single mid-break does NOT orphan multi-segment fragments', () => {
    const world = new World();
    const chain = buildBreakScene(world); // >= 8 segments
    const tracker = new StressTracker(chain, { breakForce: 2, breakTorque: 2 });

    let hasBroken = false;
    for (let tick = 0; tick < 120 && !hasBroken; tick++) {
      world.step();
      tracker.update(physics.fixedDt);
      hasBroken = chain.joints.some((_, i) => tracker.isBroken(i));
    }
    expect(hasBroken).toBe(true);

    // orphans (if any) must be fully detached segments, never spot-checks of
    // fragments that still hold an intact joint
    for (const orphan of tracker.orphans()) {
      const left = orphan.segmentIndex - 1;
      const right = orphan.segmentIndex;
      if (left >= 0) {
        expect(tracker.isBroken(left)).toBe(true);
      }
      if (right < chain.joints.length) {
        expect(tracker.isBroken(right)).toBe(true);
      }
    }
    world.destroy();
  });
});

describe('StressTracker — destroy', () => {
  it('fires no events and stops mutating after destroy()', () => {
    const world = new World();
    const chain = buildBreakScene(world);
    let creakCount = 0;
    let breakCount = 0;
    const tracker = new StressTracker(chain, {
      breakForce: 2,
      breakTorque: 2,
      onCreak: () => creakCount++,
      onBreak: () => breakCount++,
    });

    tracker.destroy();
    for (let tick = 0; tick < 120; tick++) {
      world.step();
      tracker.update(physics.fixedDt); // must be a silent no-op
    }
    expect(creakCount).toBe(0);
    expect(breakCount).toBe(0);
    // no joints were broken by the dead tracker
    for (const jointId of chain.joints) {
      expect(b2Joint_IsValid(jointId)).toBe(true);
    }
    tracker.destroy(); // idempotent
    world.destroy();
  });
});

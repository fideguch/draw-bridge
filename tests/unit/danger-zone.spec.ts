import { describe, expect, it } from 'vitest';
import type { DangerZone, Level, Point } from '@engine/level/LevelSchema';
import { buildBridge } from '@engine/physics/BridgeChainBuilder';
import { processStroke } from '@engine/physics/StrokePipeline';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { Judge } from '@engine/rules/Judge';
import { GameSimulation } from '@engine/GameSimulation';
import { car } from '@tuning/TuningConstants';
import { arcStroke, buildSpikeLevel, simulationInternals } from '../../src/debug/SpikeScenario';

/**
 * DangerZone — the axis-aligned hazard band (user round-6: "危険帯であることがUIで
 * 全くわからなかった"). The CAR (chassis or a wheel AABB) overlapping a zone fails
 * with FailCause 'hazard' (clear-beats-fail per BR-009). The drawn BridgeChain and
 * rocks pass through zones UNAFFECTED — a zone only kills the car. Zones are
 * static and only feed the Judge (no bodies), so they never perturb determinism.
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
const FAR_FLAG = { x: 15, y: 0, width: 1, height: 2 } as const;

/** The frozen no-rock/no-zone determinism hash (spike:determinism). */
const NO_HAZARD_PROBE_HASH = 'd39a29bd';

function settledVehicle(world: World): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN);
  for (let i = 0; i < 90; i++) {
    world.step();
  }
  return vehicle;
}

function spikeLevelWithZones(gapM: number, dangerZones: readonly DangerZone[]): Level {
  return { ...buildSpikeLevel(gapM, { runUpM: 6, flagOffsetM: 5 }), dangerZones };
}

function runFreshToOutcome(
  level: Level,
  stroke: readonly Point[],
): { hash: string; outcome: string; cause?: string; ticks: number } {
  const sim = new GameSimulation(level, { method: 'chain' });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      throw new Error(`commit failed: ${commit.reason}`);
    }
    const outcome = sim.runToOutcome();
    return {
      hash: simulationInternals(sim).world.stateHash(),
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { cause: outcome.cause } : {}),
      ticks: outcome.ticks,
    };
  } finally {
    sim.destroy();
  }
}

describe('Judge — DangerZone hazard (car overlap => cause "hazard")', () => {
  it('fails with cause "hazard" when the car overlaps a zone', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // A zone straddling the settled car at spawn.
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: -2, y: 0, width: 4, height: 2 }],
    });
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('hazard');
      expect(Number.isFinite(outcome.causeLocation.x)).toBe(true);
      // causeLocation is the centre of the car∩zone overlap (near the car).
      expect(outcome.causeLocation.x).toBeGreaterThan(-2);
      expect(outcome.causeLocation.x).toBeLessThan(2);
    }
    world.destroy();
  });

  it('does NOT fail when no zone overlaps the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: 8, y: 0, width: 2, height: 2 }], // far from the spawn car
    });
    expect(judge.evaluate(0, vehicle)).toBeNull();
    world.destroy();
  });

  it('a zone over the BRIDGE (not the car) does NOT fail — zones only kill the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // A drawn bridge far to the right of the car, and a zone over that bridge.
    const stroke = processStroke([
      { x: 8, y: 1 },
      { x: 11, y: 1 },
    ]);
    if (stroke.discarded) {
      expect.fail('fixture stroke must not be discarded');
    }
    const chain = buildBridge(world, stroke.resampled, {
      method: 'chain',
      strokeId: 1,
      vehicleMass: vehicle.totalMass,
    });
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: 8, y: 0.5, width: 3, height: 1 }], // covers the bridge, NOT the car
    });
    // The bridge sits inside the zone but the car does not → no hazard fail.
    expect(judge.evaluate(0, vehicle, chain)).toBeNull();
    world.destroy();
  });

  it('clear beats hazard on the same tick (BR-009)', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // The goal flag AND a danger zone both cover the settled car → clear wins.
    const judge = new Judge({
      goalFlag: { x: -2, y: 0, width: 4, height: 2 },
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: -2, y: 0, width: 4, height: 2 }],
    });
    expect(judge.evaluate(0, vehicle)?.outcome).toBe('clear');
    world.destroy();
  });
});

describe('GameSimulation — DangerZone integration', () => {
  it('a zone on the driving path turns a clear into a hazard fail', () => {
    // Without a zone the arc bridge clears the 4 m gap (baseline sanity).
    const clean = runFreshToOutcome(buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), arcStroke(4));
    expect(clean.outcome).toBe('clear');

    // A zone on the right platform (before the flag) that the car must cross.
    const zoned = spikeLevelWithZones(4, [{ x: 3, y: -0.5, width: 2, height: 3 }]);
    const hazardRun = runFreshToOutcome(zoned, arcStroke(4));
    expect(hazardRun.outcome).toBe('fail');
    expect(hazardRun.cause).toBe('hazard');
  });
});

describe('DangerZone — determinism (zones are static, no bodies)', () => {
  it('a far, untouched zone is byte-identical to a zone-free world', () => {
    // Same scenario as the frozen determinism probe, plus a zone the car never
    // reaches. The hash MUST NOT move — zones feed only the Judge (no physics).
    const baseline = runFreshToOutcome(
      { ...buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }) },
      arcStroke(2),
    );
    const withFarZone = runFreshToOutcome(
      { ...buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }), dangerZones: [{ x: 100, y: 100, width: 1, height: 1 }] },
      arcStroke(2),
    );
    expect(baseline.outcome).toBe('clear');
    expect(baseline.hash).toBe(NO_HAZARD_PROBE_HASH);
    expect(withFarZone.outcome).toBe('clear');
    expect(withFarZone.hash).toBe(NO_HAZARD_PROBE_HASH); // exact float bits, unchanged
    expect(withFarZone.ticks).toBe(baseline.ticks);
  });

  it('the render-only `style` tag is physics-inert (spike-tagged == untagged)', () => {
    // A zone on the right platform the car must cross (same as the integration test).
    const geom = { x: 3, y: -0.5, width: 2, height: 3 } as const;
    const untagged = runFreshToOutcome(spikeLevelWithZones(4, [{ ...geom }]), arcStroke(4));
    const tagged = runFreshToOutcome(spikeLevelWithZones(4, [{ ...geom, style: 'spike' }]), arcStroke(4));
    // The Judge collides only the base rect — the silhouette tag changes nothing.
    expect(tagged.outcome).toBe(untagged.outcome);
    expect(tagged.cause).toBe(untagged.cause);
    expect(tagged.ticks).toBe(untagged.ticks);
    expect(tagged.hash).toBe(untagged.hash); // exact float bits
  });
});

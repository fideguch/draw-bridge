import { describe, expect, it } from 'vitest';
import type { Level } from '@engine/level/LevelSchema';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { Judge } from '@engine/rules/Judge';
import { GameSimulation } from '@engine/GameSimulation';
import { car } from '@tuning/TuningConstants';
import { arcStroke, buildSpikeLevel, simulationInternals } from '../../src/debug/SpikeScenario';

/**
 * ROCK CONTACT = GAME OVER (round-7 F1, game_plan_v5 §2.1). The CAR (chassis or a
 * wheel AABB) touching a LIVE rock disc fails the run this tick with cause
 * 'hazardContact'. Contact IS the loss — no bounce/decel — and it BEATS clear on a
 * same-tick tie. A rock-free scenario is byte-identical to before (the rule is a
 * pure Judge read, so the frozen determinism hash never moves).
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

/** The frozen no-rock determinism hash (spike:determinism). */
const NO_ROCK_PROBE_HASH = 'd39a29bd';

function settledVehicle(world: World): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN);
  for (let i = 0; i < 90; i++) {
    world.step();
  }
  return vehicle;
}

function runFreshToOutcome(level: Level, stroke: readonly { x: number; y: number }[]) {
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
      cause: outcome.outcome === 'fail' ? outcome.cause : undefined,
      ticks: outcome.ticks,
    };
  } finally {
    sim.destroy();
  }
}

describe('Judge — rock contact = hazardContact (round-7 F1)', () => {
  it('fails with cause "hazardContact" when a rock disc overlaps the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    // A rock disc sitting on the settled car at spawn.
    const outcome = judge.evaluate(0, vehicle, null, [{ x: 0, y: SPAWN.y, radius: 0.5 }]);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('hazardContact');
      // causeLocation is the point on the car nearest the rock (a real contact anchor)
      expect(Number.isFinite(outcome.causeLocation.x)).toBe(true);
      expect(Number.isFinite(outcome.causeLocation.y)).toBe(true);
    }
    world.destroy();
  });

  it('NEGATIVE CONTROL: does NOT fail when the rock disc is far from the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY });
    expect(judge.evaluate(0, vehicle, null, [{ x: 40, y: 30, radius: 0.5 }])).toBeNull();
    // and with no rocks at all it is likewise null
    expect(judge.evaluate(0, vehicle, null, [])).toBeNull();
    expect(judge.evaluate(0, vehicle)).toBeNull();
    world.destroy();
  });

  it('rock hazardContact BEATS clear on the same tick (game_plan_v5 §2.1 hazard-wins)', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // The goal flag covers the settled car AND a rock overlaps it → hazard wins.
    const judge = new Judge({ goalFlag: { x: -2, y: 0, width: 4, height: 2 }, killY: FLAT_GROUND.killY });
    const outcome = judge.evaluate(0, vehicle, null, [{ x: 0, y: SPAWN.y, radius: 0.5 }]);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('hazardContact');
    }
    world.destroy();
  });
});

describe('GameSimulation — rock = game over integration', () => {
  it('a rock landing in the car path turns a clear into a hazardContact fail', () => {
    const clean = runFreshToOutcome(buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), arcStroke(4));
    expect(clean.outcome).toBe('clear'); // no rock → the car crosses

    // A rock that lands on the dome in the car's lane: the car reaches it and dies
    // on contact (previously it drove past / tipped; now touch = instant loss).
    const rockLevel: Level = {
      ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }),
      rocks: [{ x: 0, y: 1.2, radius: 0.3 }],
    };
    const crushed = runFreshToOutcome(rockLevel, arcStroke(4));
    expect(crushed.outcome).toBe('fail');
    expect(crushed.cause).toBe('hazardContact'); // contact IS the loss (was tipOver/fall before)
  });

  it('NEGATIVE CONTROL: a rock the car never reaches still clears', () => {
    const level: Level = {
      ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }),
      rocks: [{ x: 40, y: 30, radius: 0.3 }],
    };
    expect(runFreshToOutcome(level, arcStroke(4)).outcome).toBe('clear');
  });
});

describe('rock = game over — determinism negative control', () => {
  it('a rock-free run is byte-identical to the frozen hash (the rule is a pure Judge read)', () => {
    const result = runFreshToOutcome(buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }), arcStroke(2));
    expect(result.outcome).toBe('clear');
    expect(result.hash).toBe(NO_ROCK_PROBE_HASH); // exact float bits, unchanged by round-7
  });
});

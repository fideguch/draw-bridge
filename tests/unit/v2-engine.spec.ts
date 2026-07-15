import { describe, expect, it } from 'vitest';
import type { Level, Point } from '@engine/level/LevelSchema';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { Judge } from '@engine/rules/Judge';
import { GameSimulation } from '@engine/GameSimulation';
import { car } from '@tuning/TuningConstants';
import { applyTuningOverrides, arcStroke, buildSpikeLevel, restoreTuning } from '../../src/debug/SpikeScenario';

/**
 * Round-9 v2 ENGINE semantics — the negative controls (c)/(d) from the CS-1 spec:
 * - Person NPC (BR-011): car overlap fails with FailCause 'personContact', and it
 *   BEATS clear on a same-tick goal tie (same tier as hazardContact).
 * - Objective stars (BR-014): ★2 needs the level objective — 'coins' (all coins) or
 *   'noBreak' (zero BridgeChain breaks). noBreak evaluates FALSE when a segment breaks.
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

function settledVehicle(world: World): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN);
  for (let i = 0; i < 90; i++) {
    world.step();
  }
  return vehicle;
}

/** A v2 spike level (schemaVersion 2), gap 2 m, with the given round-9 extras. */
function v2Level(extra: Partial<Level>): Level {
  return { ...buildSpikeLevel(2, { runUpM: 6, flagOffsetM: 5 }), schemaVersion: 2, ...extra };
}

describe('Judge — personContact (round-9 BR-011)', () => {
  it('(c) fails with cause "personContact" when the car overlaps a person AABB', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      persons: [{ x: 0, y: 0.85 }], // centre over the settled car (AABB y∈[0,1.7])
    });
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('personContact');
    }
    world.destroy();
  });

  it('does NOT fail when the person is far from the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({ goalFlag: FAR_FLAG, killY: FLAT_GROUND.killY, persons: [{ x: 10, y: 0.85 }] });
    expect(judge.evaluate(0, vehicle)).toBeNull();
    world.destroy();
  });

  it('(c) personContact BEATS clear on the same tick (same tier as hazardContact)', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // The goal flag AND a person both cover the settled car → person wins the tie.
    const judge = new Judge({
      goalFlag: { x: -2, y: 0, width: 4, height: 2 },
      killY: FLAT_GROUND.killY,
      persons: [{ x: 0, y: 0.85 }],
    });
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('personContact');
    }
    world.destroy();
  });
});

describe('GameSimulation — personContact integration (v2)', () => {
  it('a person on the driving route turns a clear into a personContact fail', () => {
    // A person on the right platform (x=4), before the flag (x=6) the car drives to.
    const sim = new GameSimulation(v2Level({ persons: [{ x: 4, y: 0.85 }] }), { method: 'chain' });
    const failed: string[] = [];
    sim.events.on('failed', ({ cause }) => failed.push(cause));
    const commit = sim.commitStroke(arcStroke(2));
    expect(commit.committed).toBe(true);
    const outcome = sim.runToOutcome();
    expect(outcome.outcome).toBe('fail');
    if (outcome.outcome === 'fail') {
      expect(outcome.cause).toBe('personContact');
    }
    expect(failed).toContain('personContact');
    sim.destroy();
  });

  it('a person OFF the route (high above) does not affect the clear', () => {
    const sim = new GameSimulation(v2Level({ persons: [{ x: 4, y: 12 }] }), { method: 'chain' });
    sim.commitStroke(arcStroke(2));
    const outcome = sim.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    sim.destroy();
  });
});

describe('GameSimulation — objective stars (v2, BR-014)', () => {
  it('noBreak: a clean crossing meets the objective (objectiveMet true, ★3)', () => {
    const sim = new GameSimulation(v2Level({ objective: { type: 'noBreak' } }), { method: 'chain' });
    sim.commitStroke(arcStroke(2));
    const outcome = sim.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    if (outcome.outcome === 'clear') {
      expect(outcome.objectiveMet).toBe(true);
      expect(outcome.starRating).toBe(3); // objective met + ink within star3
    }
    sim.destroy();
  });

  it('(d) noBreak: objectiveMet is FALSE when a segment breaks (still a clear ⇒ ★1)', () => {
    // A weak chain (breakForceFactor 1) breaks under the crossing car but the car
    // still clears the 2 m gap — the probe confirms clear + 3 breaks at these params.
    const snapshot = applyTuningOverrides({ breakForceFactor: 1 });
    try {
      const sim = new GameSimulation(v2Level({ objective: { type: 'noBreak' } }), { method: 'chain' });
      let breaks = 0;
      sim.events.on('break', () => breaks++);
      sim.commitStroke(arcStroke(2));
      const outcome = sim.runToOutcome();
      expect(outcome.outcome).toBe('clear');
      expect(breaks).toBeGreaterThan(0); // a segment broke this run
      if (outcome.outcome === 'clear') {
        expect(outcome.objectiveMet).toBe(false); // noBreak violated
        expect(outcome.starRating).toBe(1); // cleared, objective missed
      }
      sim.destroy();
    } finally {
      restoreTuning(snapshot);
    }
  });

  it('coins: objectiveMet true when every coin is collected on the route (★3)', () => {
    const onRoute: Point[] = [{ x: 3, y: 0.5 }]; // on the right-platform driving line
    const sim = new GameSimulation(v2Level({ objective: { type: 'coins' }, coins: onRoute }), { method: 'chain' });
    sim.commitStroke(arcStroke(2));
    const outcome = sim.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    if (outcome.outcome === 'clear') {
      expect(outcome.coinsCollected).toBe(1);
      expect(outcome.objectiveMet).toBe(true);
      expect(outcome.starRating).toBe(3);
    }
    sim.destroy();
  });

  it('(d) coins: objectiveMet FALSE when a coin is left uncollected (clear ⇒ ★1)', () => {
    const offRoute: Point[] = [{ x: 3, y: 12 }]; // unreachable above the route
    const sim = new GameSimulation(v2Level({ objective: { type: 'coins' }, coins: offRoute }), { method: 'chain' });
    sim.commitStroke(arcStroke(2));
    const outcome = sim.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    if (outcome.outcome === 'clear') {
      expect(outcome.coinsCollected).toBe(0);
      expect(outcome.objectiveMet).toBe(false);
      expect(outcome.starRating).toBe(1);
    }
    sim.destroy();
  });
});

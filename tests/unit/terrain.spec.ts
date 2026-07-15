import { describe, expect, it } from 'vitest';
import { b2Body_GetPosition, b2CreatePolygonShape, b2DefaultShapeDef, b2MakeBox } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import { validateLevel } from '@engine/level/LevelSchema';
import { Terrain } from '@engine/physics/Terrain';
import { World } from '@engine/physics/World';
import { car } from '@tuning/TuningConstants';
import exampleValid from '../fixtures/levels/example-valid.json';

/**
 * T016 — terrain: level polylines -> static one-sided chain shapes; killY is a
 * plain number for the Judge (no physics sensor). Level JSON authors terrain
 * left->right = top-side collision (contracts/level-schema.md §3 example).
 */

const FLAT_GROUND = {
  terrain: [
    [
      [-10, 0],
      [10, 0],
    ],
  ],
  killY: -7,
} as const;

function addDynamicBox(world: World, x: number, y: number): b2BodyId {
  const bodyId = world.createBody({ type: 'dynamic', position: { x, y } });
  const shapeDef = b2DefaultShapeDef();
  shapeDef.restitution = car.restitution;
  shapeDef.friction = car.tireFriction;
  b2CreatePolygonShape(bodyId, shapeDef, b2MakeBox(0.5, 0.5));
  return bodyId;
}

describe('Terrain — construction', () => {
  it('creates one static body (with chain) per terrain polyline', () => {
    const world = new World();
    expect(world.bodyCount).toBe(0);
    const terrain = new Terrain(world, FLAT_GROUND);
    expect(terrain.polylineCount).toBe(1);
    expect(world.bodyCount).toBe(1);
    terrain.destroy();
    expect(world.bodyCount).toBe(0);
    world.destroy();
  });

  it('exposes killY as a plain number for the Judge', () => {
    const world = new World();
    const terrain = new Terrain(world, FLAT_GROUND);
    expect(terrain.killY).toBe(-7);
    world.destroy();
  });

  it('rejects a polyline with fewer than 2 points', () => {
    const world = new World();
    expect(() => new Terrain(world, { terrain: [[[0, 0]]], killY: -7 })).toThrow();
    world.destroy();
  });
});

describe('Terrain — collision from above (top-side winding)', () => {
  it('a dynamic box dropped onto flat ground comes to rest above the terrain line', () => {
    const world = new World();
    new Terrain(world, FLAT_GROUND);
    const boxId = addDynamicBox(world, 0, 3);

    for (let i = 0; i < 108; i++) {
      world.step();
    }
    const settling = b2Body_GetPosition(boxId).y;
    for (let i = 0; i < 12; i++) {
      world.step(); // ~120 steps total
    }
    const settled = b2Body_GetPosition(boxId).y;

    // resting on y=0 ground with half-extent 0.5 => y ~ 0.5, definitely above the line
    expect(settled).toBeGreaterThan(0);
    expect(settled).toBeCloseTo(0.5, 1);
    // stabilized: no meaningful vertical motion over the last 12 steps
    expect(Math.abs(settled - settling)).toBeLessThan(0.01);
    world.destroy();
  });

  it('supports multi-polyline terrain from the contract example level', () => {
    const validation = validateLevel(structuredClone(exampleValid));
    if (!validation.ok) {
      expect.fail(`fixture level must validate: ${validation.errors.join(' | ')}`);
    }
    const level = validation.level;

    const world = new World();
    const terrain = new Terrain(world, level);
    expect(terrain.polylineCount).toBe(2);
    expect(terrain.killY).toBe(-7);

    // left plateau (vehicleSpawn side) and right plateau both hold a box
    const leftBox = addDynamicBox(world, -8, 2);
    const rightBox = addDynamicBox(world, 8, 2);
    for (let i = 0; i < 150; i++) {
      world.step();
    }
    expect(b2Body_GetPosition(leftBox).y).toBeGreaterThan(0);
    expect(b2Body_GetPosition(rightBox).y).toBeGreaterThan(0);
    world.destroy();
  });

  it('a box over the gap falls past the terrain (one-sided chains, no floor)', () => {
    const validation = validateLevel(structuredClone(exampleValid));
    if (!validation.ok) {
      expect.fail('fixture level must validate');
    }
    const world = new World();
    new Terrain(world, validation.level);
    const gapBox = addDynamicBox(world, 0, 2); // fixture gap spans x in (-1.6, 1.6)
    for (let i = 0; i < 150; i++) {
      world.step();
    }
    expect(b2Body_GetPosition(gapBox).y).toBeLessThan(-5);
    world.destroy();
  });
});

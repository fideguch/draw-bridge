import { describe, expect, it } from 'vitest';
import { b2Body_GetPosition, b2CreatePolygonShape, b2DefaultShapeDef, b2MakeBox } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import { World } from '@engine/physics/World';
import { car, physics } from '@tuning/TuningConstants';

/**
 * T014 — physics world lifecycle: fixed 1/60 step + accumulator, stable state
 * hash across identical runs (S3 determinism precursor). Headless Node, no
 * Phaser import (phaser-box2d is the Phaser-independent physics lib).
 *
 * NOTE: phaser-box2d@1.1.0 never frees world slots on destroy (see World.ts
 * LIB-QUIRK); this file must create fewer than 32 worlds total.
 */

function addDynamicBox(world: World, x: number, y: number): b2BodyId {
  const bodyId = world.createBody({ type: 'dynamic', position: { x, y } });
  const shapeDef = b2DefaultShapeDef();
  shapeDef.restitution = car.restitution;
  shapeDef.friction = car.surfaceFriction;
  b2CreatePolygonShape(bodyId, shapeDef, b2MakeBox(0.5, 0.5));
  return bodyId;
}

describe('World — determinism via stateHash', () => {
  it('two identical worlds stepped identically produce identical hashes (10 steps)', () => {
    const worldA = new World();
    const worldB = new World();
    addDynamicBox(worldA, 0, 5);
    addDynamicBox(worldB, 0, 5);

    expect(worldA.stateHash()).toBe(worldB.stateHash());
    for (let i = 0; i < 10; i++) {
      worldA.step();
      worldB.step();
      expect(worldA.stateHash()).toBe(worldB.stateHash());
    }
    worldA.destroy();
    worldB.destroy();
  });

  it('worlds with different state produce different hashes', () => {
    const worldA = new World();
    const worldB = new World();
    addDynamicBox(worldA, 0, 5);
    addDynamicBox(worldB, 0.25, 5); // diverged initial x
    expect(worldA.stateHash()).not.toBe(worldB.stateHash());
    worldA.destroy();
    worldB.destroy();
  });

  it('hash changes as a falling body moves between steps', () => {
    const world = new World();
    addDynamicBox(world, 0, 5);
    const before = world.stateHash();
    world.step();
    expect(world.stateHash()).not.toBe(before);
    world.destroy();
  });

  it('returns a stable non-empty hex string', () => {
    const world = new World();
    addDynamicBox(world, 1, 2);
    const hash = world.stateHash();
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(world.stateHash()).toBe(hash); // no step -> no change
    world.destroy();
  });
});

describe('World — gravity from TuningConstants', () => {
  it('a free dynamic body falls under physics.gravityY', () => {
    const world = new World();
    const bodyId = addDynamicBox(world, 0, 5);
    for (let i = 0; i < 60; i++) {
      world.step(); // 1 second
    }
    const position = b2Body_GetPosition(bodyId);
    // y = y0 + 0.5 * g * t^2 (minus solver damping) => well below start
    expect(position.y).toBeLessThan(5 + physics.gravityY * 0.25);
    world.destroy();
  });
});

describe('World — fixed-step accumulator (advance)', () => {
  it('advance(25 ms) takes exactly 1 step with alpha ~ 0.5', () => {
    const world = new World();
    const result = world.advance(25);
    expect(result.steps).toBe(1);
    expect(result.alpha).toBeGreaterThan(0.45);
    expect(result.alpha).toBeLessThan(0.55);
    world.destroy();
  });

  it('advance(40 ms) takes exactly 2 steps', () => {
    const world = new World();
    const result = world.advance(40);
    expect(result.steps).toBe(2);
    world.destroy();
  });

  it('carries the remainder across calls (8 + 8 + 9 ms => 1 step)', () => {
    const world = new World();
    expect(world.advance(8).steps).toBe(0);
    expect(world.advance(8).steps).toBe(0); // 16 ms < 1/60 s
    expect(world.advance(9).steps).toBe(1); // 25 ms total
    world.destroy();
  });

  it('keeps alpha in [0, 1) across mixed frame times', () => {
    const world = new World();
    let totalSteps = 0;
    for (const elapsedMs of [5, 13, 33.4, 100, 7, 16.7, 16.7, 16.7, 0, 50]) {
      const result = world.advance(elapsedMs);
      expect(result.steps).toBeGreaterThanOrEqual(0);
      expect(result.alpha).toBeGreaterThanOrEqual(0);
      expect(result.alpha).toBeLessThan(1);
      totalSteps += result.steps;
    }
    // 258.5 ms total at 60 Hz => 15.51 frames => 15 whole steps taken
    expect(totalSteps).toBe(15);
    world.destroy();
  });
});

describe('World — lifecycle', () => {
  it('destroy() marks the world destroyed and blocks further use', () => {
    const world = new World();
    expect(world.isDestroyed).toBe(false);
    world.destroy();
    expect(world.isDestroyed).toBe(true);
    expect(() => world.step()).toThrow();
    expect(() => world.stateHash()).toThrow();
    expect(() => world.createBody({ type: 'dynamic', position: { x: 0, y: 0 } })).toThrow();
  });

  it('destroy() is idempotent', () => {
    const world = new World();
    world.destroy();
    expect(() => world.destroy()).not.toThrow();
  });

  it('destroyBody removes the body from the state hash', () => {
    const world = new World();
    const emptyHash = world.stateHash();
    const bodyId = addDynamicBox(world, 0, 5);
    expect(world.stateHash()).not.toBe(emptyHash);
    world.destroyBody(bodyId);
    expect(world.stateHash()).toBe(emptyHash);
    world.destroy();
  });
});

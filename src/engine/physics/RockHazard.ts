/**
 * RockHazard — rolling/falling rock hazards (competitor-documented "block the
 * falling/rolling object with your line" level role, user round-5 mandate).
 *
 * Each level `rocks[]` entry becomes ONE plain dynamic circle body: it rolls and
 * falls under normal gravity, and its filter (CATEGORY_ROCK + MASK_ALL) makes it
 * collide with the terrain, the drawn BridgeChain, AND the car. There is NO new
 * fail rule — a rock that reaches the car undeflected induces the existing
 * tipOver / fall / timeout judgement through ordinary physics. The drawn line is
 * therefore a shield/deflector: catch or wall off the rock and the car survives.
 *
 * TRIGGERED SPAWN (round-6, `rocks[].triggerCarX`): a classic rock is created at
 * run start (in the constructor); a TRIGGERED rock is created LATER — the tick the
 * car's reference x first reaches `triggerCarX` (GameSimulation.step calls
 * updateTriggers). Until then the rock is ARMED: it has NO body (so it is inert to
 * physics and the state hash) but reports a render state at its spawn so the
 * renderer can warn the player. This synchronises the rock's fall/roll with the
 * car's arrival — the fix for "石が早く落ちて当たらない" (round-6). Slot order (spawn
 * order) is fixed; a triggered rock's body simply appears at its slot when armed.
 *
 * DETERMINISM: bodies are created deterministically from the level data. Classic
 * rocks are created in constructor order; a triggered rock is created the exact
 * tick `carX >= triggerCarX` first holds — carX is a pure function of the sim
 * state, so the trigger tick, the created body, and thus World.stateHash are
 * bit-reproducible. Before any trigger fires the hash is unchanged from a world
 * carrying only the classic rocks (the armed rock adds no body). An argument-free
 * reset() rebuilds the identical armed set; a level with no `rocks` creates zero
 * bodies — byte-identical to a pre-rock world (the determinism negative control).
 *
 * SURFACE properties (density fallback / friction / restitution) come from
 * TuningConstants; per-rock position, radius, optional density, initial velocity,
 * and triggerCarX come from the level JSON.
 */

import {
  b2Body_GetPosition,
  b2Body_GetRotation,
  b2Body_SetLinearVelocity,
  b2Circle,
  b2CreateCircleShape,
  b2DefaultShapeDef,
  b2Vec2,
} from 'phaser-box2d';
import type { b2BodyId, b2ShapeDef } from 'phaser-box2d';
import type { Rock } from '../level/LevelSchema';
import type { World } from './World';
import { CATEGORY_ROCK, MASK_ALL } from './CollisionCategories';
import { rock as rockTuning } from '@tuning/TuningConstants';

/**
 * Live render observation for one rock (world meters + radians). `armed` is true
 * for a triggered rock still waiting for its trigger: it is drawn as a warning at
 * its spawn but has NO body (angle is 0, it never moves, it touches nothing).
 */
export interface RockRenderState {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly radius: number;
  readonly armed: boolean;
}

/** One rock's lifecycle: an authored spec + its body once (or if) it is created. */
interface RockSlot {
  readonly spec: Rock;
  readonly radius: number;
  /** null == armed (triggered, not yet spawned); set once the body is created. */
  bodyId: b2BodyId | null;
}

function rockShapeDef(density: number): b2ShapeDef {
  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = density;
  shapeDef.friction = rockTuning.friction;
  shapeDef.restitution = rockTuning.restitution;
  shapeDef.filter.categoryBits = CATEGORY_ROCK;
  shapeDef.filter.maskBits = MASK_ALL;
  return shapeDef;
}

export class RockHazard {
  /** Every rock's slot in spawn (level) order — render + hash + trigger order. */
  private readonly slots: readonly RockSlot[];
  private readonly world: World;
  private isDestroyed = false;

  constructor(world: World, rocks: readonly Rock[]) {
    this.world = world;
    // A rock WITHOUT triggerCarX spawns now (classic behaviour, unchanged body
    // order); a rock WITH triggerCarX stays armed until updateTriggers() fires it.
    this.slots = rocks.map((spec) => ({
      spec,
      radius: spec.radius,
      bodyId: spec.triggerCarX === undefined ? this.createRock(spec) : null,
    }));
  }

  /** Total rock slots (armed + live) — stable for the whole attempt. */
  get count(): number {
    return this.slots.length;
  }

  /** Live (physical) rock body ids in slot order — armed rocks are omitted. */
  get bodyIds(): readonly b2BodyId[] {
    const ids: b2BodyId[] = [];
    for (const slot of this.slots) {
      if (slot.bodyId !== null) {
        ids.push(slot.bodyId);
      }
    }
    return ids;
  }

  /** Per-slot radius in world meters, same order as the slots (renderer + tests). */
  get radii(): readonly number[] {
    return this.slots.map((slot) => slot.radius);
  }

  /**
   * Create any ARMED (triggered) rock whose triggerCarX the car has now reached.
   * Called once per tick by GameSimulation with the current reference x. Firing
   * is monotone-safe (idempotent once a slot has a body) and deterministic: the
   * exact tick `carX >= triggerCarX` first holds is a pure function of sim state.
   */
  updateTriggers(carX: number): void {
    for (const slot of this.slots) {
      if (slot.bodyId === null && slot.spec.triggerCarX !== undefined && carX >= slot.spec.triggerCarX) {
        slot.bodyId = this.createRock(slot.spec);
      }
    }
  }

  /**
   * Live poses + radii for every slot (headless tests / debug / atlas; the game's
   * RockRenderer reads this too). Armed slots report their spawn pose with
   * `armed: true` (drawn as a warning); live slots read the body transform.
   */
  renderState(): readonly RockRenderState[] {
    return this.slots.map((slot) => {
      if (slot.bodyId === null) {
        return { x: slot.spec.x, y: slot.spec.y, angle: 0, radius: slot.radius, armed: true };
      }
      const position = b2Body_GetPosition(slot.bodyId);
      const rotation = b2Body_GetRotation(slot.bodyId);
      return {
        x: position.x,
        y: position.y,
        angle: Math.atan2(rotation.s, rotation.c),
        radius: slot.radius,
        armed: false,
      };
    });
  }

  /**
   * Remove every rock body. Idempotent. NOT called by GameSimulation's normal
   * lifecycle (World.reset/destroy frees the bodies with everything else, the
   * same as Terrain/Vehicle) — provided for standalone / test teardown.
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    for (const slot of this.slots) {
      if (slot.bodyId !== null) {
        this.world.destroyBody(slot.bodyId);
      }
    }
    this.isDestroyed = true;
  }

  private createRock(spec: Rock): b2BodyId {
    const bodyId = this.world.createBody({ type: 'dynamic', position: { x: spec.x, y: spec.y } });
    const density = spec.density ?? rockTuning.density;
    const circle = new b2Circle(new b2Vec2(0, 0), spec.radius);
    b2CreateCircleShape(bodyId, rockShapeDef(density), circle);
    if (spec.initialVelocity !== undefined) {
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(spec.initialVelocity.x, spec.initialVelocity.y));
    }
    return bodyId;
  }
}

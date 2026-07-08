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
 * DETERMINISM: rocks are created deterministically from the level data (same
 * order, same bodies) and are tracked by World, so they participate in
 * World.stateHash exactly like every other body. GameSimulation spawns them once
 * per attempt in build(); an argument-free reset() rebuilds the identical set.
 * A level with no `rocks` creates zero bodies — byte-identical to a pre-rock
 * world (the determinism negative control).
 *
 * SURFACE properties (density fallback / friction / restitution) come from
 * TuningConstants; per-rock position, radius, optional density and initial
 * velocity come from the level JSON.
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

/** Live render observation for one rock (world meters + radians). */
export interface RockRenderState {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly radius: number;
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
  /** Rock bodies in level order (render + hash order). */
  readonly bodyIds: readonly b2BodyId[];
  /** Per-rock radius in world meters, same order as bodyIds (renderer + tests). */
  readonly radii: readonly number[];

  private readonly world: World;
  private isDestroyed = false;

  constructor(world: World, rocks: readonly Rock[]) {
    this.world = world;
    const bodyIds: b2BodyId[] = [];
    const radii: number[] = [];
    for (const spec of rocks) {
      bodyIds.push(this.createRock(spec));
      radii.push(spec.radius);
    }
    this.bodyIds = bodyIds;
    this.radii = radii;
  }

  /** Number of live rocks. */
  get count(): number {
    return this.bodyIds.length;
  }

  /** Live poses + radii (headless tests / debug; renderer reads bodies directly). */
  renderState(): readonly RockRenderState[] {
    return this.bodyIds.map((bodyId, i) => {
      const position = b2Body_GetPosition(bodyId);
      const rotation = b2Body_GetRotation(bodyId);
      return {
        x: position.x,
        y: position.y,
        angle: Math.atan2(rotation.s, rotation.c),
        radius: this.radii[i] as number,
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
    for (const bodyId of this.bodyIds) {
      this.world.destroyBody(bodyId);
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

/**
 * Terrain — level terrain polylines as static one-sided chain shapes (FR-015).
 *
 * Each level polyline becomes one static body carrying one b2 chain
 * (b2CreateChain), with friction from TuningConstants (car.surfaceFriction).
 * killY is exposed as a plain number — the Judge compares
 * VehicleReferencePoint.y against it every tick; no physics sensor exists.
 *
 * PORT-CONVENTION (verified empirically against phaser-box2d@1.1.0): open
 * chains collide one-sided, and a box dropped from above only lands on the
 * chain when its points run right->left (a left->right chain lets bodies fall
 * straight through). Level JSON authors terrain in natural left->right order
 * with "vertex order = collision top-side winding" (contract §3 example), so
 * this module REVERSES each polyline before building the chain. The mapping is
 * a consistent orientation flip, so authored winding still fully controls
 * which side is solid (overhangs work by authoring the opposite direction).
 *
 * GHOST POINTS: phaser-box2d treats the first and last points of an open
 * chain as ghost vertices (they smooth collisions but are NOT collidable
 * segments). Each reversed polyline is therefore extended by linear
 * extrapolation on both ends before being handed to b2CreateChain.
 */

import { b2CreateChain, b2DefaultChainDef, b2Vec2 } from 'phaser-box2d';
import type { b2BodyId, b2ChainId } from 'phaser-box2d';
import type { Level, Polyline } from '../level/LevelSchema';
import type { World } from './World';
import { car } from '@tuning/TuningConstants';

/** The subset of Level that terrain construction needs. */
export type TerrainSource = Pick<Level, 'terrain' | 'killY'>;

/** Reverse (see PORT-CONVENTION) and add ghost points by end extrapolation. */
function toChainPoints(polyline: Polyline): b2Vec2[] {
  const reversed = polyline.map(([x, y]) => new b2Vec2(x, y)).reverse();
  const first = reversed[0] as b2Vec2;
  const second = reversed[1] as b2Vec2;
  const last = reversed[reversed.length - 1] as b2Vec2;
  const beforeLast = reversed[reversed.length - 2] as b2Vec2;
  const leadGhost = new b2Vec2(first.x + (first.x - second.x), first.y + (first.y - second.y));
  const tailGhost = new b2Vec2(last.x + (last.x - beforeLast.x), last.y + (last.y - beforeLast.y));
  return [leadGhost, ...reversed, tailGhost];
}

export class Terrain {
  /** Fall boundary for the Judge (FR-008) — plain number, no sensor. */
  readonly killY: number;

  private readonly world: World;
  private readonly bodyIds: b2BodyId[] = [];
  private readonly chainIds: b2ChainId[] = [];
  private destroyed = false;

  constructor(world: World, source: TerrainSource) {
    if (source.terrain.length < 1) {
      throw new Error('Terrain: expected >= 1 terrain polyline');
    }
    for (const [i, polyline] of source.terrain.entries()) {
      if (polyline.length < 2) {
        throw new Error(`Terrain: polyline ${i} needs >= 2 points`);
      }
    }

    this.world = world;
    this.killY = source.killY;

    for (const polyline of source.terrain) {
      const bodyId = world.createBody({ type: 'static', position: { x: 0, y: 0 } });
      const chainDef = b2DefaultChainDef();
      const points = toChainPoints(polyline);
      chainDef.points = points;
      chainDef.count = points.length;
      chainDef.isLoop = false;
      chainDef.friction = car.surfaceFriction;
      chainDef.restitution = 0;
      const chainId = b2CreateChain(bodyId, chainDef);
      this.bodyIds.push(bodyId);
      this.chainIds.push(chainId);
    }
  }

  /** Number of terrain polylines (= static bodies/chains created). */
  get polylineCount(): number {
    return this.bodyIds.length;
  }

  /** Remove all terrain bodies (chains are freed with their body). */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    for (const bodyId of this.bodyIds) {
      this.world.destroyBody(bodyId);
    }
    this.bodyIds.length = 0;
    this.chainIds.length = 0;
    this.destroyed = true;
  }
}

/**
 * World — phaser-box2d world lifecycle wrapper (FR-026 substrate, S3 precursor).
 *
 * Responsibilities:
 * - create with gravity from TuningConstants (physics.gravityY)
 * - fixed 1/60 stepping (physics.fixedDt x physics.subStepCount)
 * - frame-time accumulator: advance(elapsedMs) -> steps taken + render alpha
 * - registry of created bodies + stateHash() over their full dynamic state
 *
 * Determinism / stateHash precision: the hash mixes the EXACT float64 bits of
 * every body's position, rotation (cos/sin), linear velocity, and angular
 * velocity — deliberately NO quantization. Identical (level, stroke) runs on
 * the same engine replay the same op order, and IEEE 754 doubles are
 * bit-reproducible, so any hash difference is a real divergence (Gate 2/S3
 * relies on this to detect even 1-ulp drift).
 *
 * LIB-QUIRK(phaser-box2d@1.1.0): b2DestroyWorld reassigns a local instead of
 * the global slot, so world slots are never freed -> max 32 World instances
 * per process, and b2World_IsValid stays true after destroy. This wrapper
 * therefore tracks its own `isDestroyed` flag and guards every method.
 *
 * Spiral-of-death note: advance() itself never clamps elapsedMs (pure engine
 * policy); the Render driver is responsible for clamping frame time before
 * calling advance (Phase 5, T045).
 */

import {
  b2BodyType,
  b2Body_GetAngularVelocity,
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_GetRotation,
  b2CreateBody,
  b2CreateWorld,
  b2CreateWorldArray,
  b2DefaultBodyDef,
  b2DefaultWorldDef,
  b2DestroyBody,
  b2DestroyWorld,
  b2Vec2,
  b2World_Step,
} from 'phaser-box2d';
import type { b2BodyId, b2WorldId } from 'phaser-box2d';
import type { Point } from '../level/LevelSchema';
import { physics } from '@tuning/TuningConstants';

const MS_PER_SEC = 1000;

/** FNV-1a-style 32-bit word mix (deterministic, allocation-free). */
const FNV_PRIME_32 = 0x01000193;
const FNV_OFFSET_BASIS_32 = 0x811c9dc5;

export type BodyKind = 'static' | 'dynamic';

export interface CreateBodyOptions {
  readonly type: BodyKind;
  readonly position: Point;
  readonly fixedRotation?: boolean;
}

export interface AdvanceResult {
  /** Fixed steps executed during this advance call. */
  readonly steps: number;
  /** Interpolation factor for rendering, always in [0, 1). */
  readonly alpha: number;
}

export class World {
  private readonly worldId: b2WorldId;
  private readonly bodies: b2BodyId[] = [];
  private accumulatorSec = 0;
  private destroyed = false;

  // Scratch views reused by stateHash to read exact float bits without allocation.
  private readonly hashBuffer = new ArrayBuffer(8);
  private readonly hashF64 = new Float64Array(this.hashBuffer);
  private readonly hashU32 = new Uint32Array(this.hashBuffer);

  constructor() {
    b2CreateWorldArray(); // idempotent global init required by phaser-box2d
    const def = b2DefaultWorldDef();
    def.gravity = new b2Vec2(0, physics.gravityY);
    this.worldId = b2CreateWorld(def);
  }

  /** Underlying world id for joint/query APIs that need it (BridgeChainBuilder). */
  get id(): b2WorldId {
    this.assertAlive();
    return this.worldId;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Bodies currently tracked by this wrapper (insertion order = hash order). */
  get bodyCount(): number {
    return this.bodies.length;
  }

  /** Create a body and register it for stateHash coverage. */
  createBody(options: CreateBodyOptions): b2BodyId {
    this.assertAlive();
    const def = b2DefaultBodyDef();
    def.type = options.type === 'dynamic' ? b2BodyType.b2_dynamicBody : b2BodyType.b2_staticBody;
    def.position = new b2Vec2(options.position.x, options.position.y);
    def.fixedRotation = options.fixedRotation ?? false;
    const bodyId = b2CreateBody(this.worldId, def);
    this.bodies.push(bodyId);
    return bodyId;
  }

  /** Destroy a tracked body and remove it from the hash registry. */
  destroyBody(bodyId: b2BodyId): void {
    this.assertAlive();
    const index = this.bodies.indexOf(bodyId);
    if (index === -1) {
      throw new Error('World.destroyBody: body is not tracked by this world');
    }
    b2DestroyBody(bodyId);
    this.bodies.splice(index, 1);
  }

  /** One fixed physics step (physics.fixedDt, physics.subStepCount). */
  step(): void {
    this.assertAlive();
    b2World_Step(this.worldId, physics.fixedDt, physics.subStepCount);
  }

  /**
   * Feed elapsed wall-clock milliseconds into the fixed-step accumulator.
   * Runs as many fixed steps as fit; the remainder becomes the render alpha.
   */
  advance(elapsedMs: number): AdvanceResult {
    this.assertAlive();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new Error(`World.advance: elapsedMs must be a finite number >= 0, got ${elapsedMs}`);
    }
    this.accumulatorSec += elapsedMs / MS_PER_SEC;
    let steps = 0;
    while (this.accumulatorSec >= physics.fixedDt) {
      this.step();
      this.accumulatorSec -= physics.fixedDt;
      steps++;
    }
    return { steps, alpha: this.accumulatorSec / physics.fixedDt };
  }

  /**
   * Stable hash over all tracked bodies' position + rotation (cos/sin) +
   * linear velocity + angular velocity. Exact float bits, no quantization —
   * see module header for the rationale.
   */
  stateHash(): string {
    this.assertAlive();
    let hash = FNV_OFFSET_BASIS_32;
    const mix = (value: number): void => {
      this.hashF64[0] = value;
      hash = Math.imul(hash ^ (this.hashU32[0] as number), FNV_PRIME_32);
      hash = Math.imul(hash ^ (this.hashU32[1] as number), FNV_PRIME_32);
    };
    for (const bodyId of this.bodies) {
      const position = b2Body_GetPosition(bodyId);
      const rotation = b2Body_GetRotation(bodyId);
      const linearVelocity = b2Body_GetLinearVelocity(bodyId);
      mix(position.x);
      mix(position.y);
      mix(rotation.c);
      mix(rotation.s);
      mix(linearVelocity.x);
      mix(linearVelocity.y);
      mix(b2Body_GetAngularVelocity(bodyId));
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /** Destroy the underlying Box2D world. Idempotent. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    b2DestroyWorld(this.worldId);
    this.bodies.length = 0;
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('World: already destroyed');
    }
  }
}

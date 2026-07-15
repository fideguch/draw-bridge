/**
 * bodyPose — read a live Box2D body transform as a render Pose (T047).
 *
 * The render layer OBSERVES engine bodies (never writes: constitution IV). The
 * engine's public getters expose derived points (VehicleReferencePoint, joint
 * positions) but not every body's raw transform, so world renderers read the
 * tracked body ids directly through the same read-only phaser-box2d accessors
 * the engine uses. This is the single spot that touches Box2D from render.
 *
 * Poses are world METRES + radians; renderers map them to world pixels via
 * WorldToPixel before drawing.
 */

import { b2Body_GetLinearVelocity, b2Body_GetPosition, b2Body_GetRotation } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import type { Pose } from './StepInterpolator';

/** Live pose (metres, radians) of one body. */
export function readBodyPose(bodyId: b2BodyId): Pose {
  const position = b2Body_GetPosition(bodyId);
  const rotation = b2Body_GetRotation(bodyId);
  return { x: position.x, y: position.y, angle: Math.atan2(rotation.s, rotation.c) };
}

/** Live linear speed (m/s) of one body — the speed-lines / engine-hum gate. */
export function readBodySpeed(bodyId: b2BodyId): number {
  const velocity = b2Body_GetLinearVelocity(bodyId);
  return Math.hypot(velocity.x, velocity.y);
}

/** Live poses of an ordered body list (chain segments, vehicle parts). */
export function readBodyPoses(bodyIds: readonly b2BodyId[]): Pose[] {
  return bodyIds.map(readBodyPose);
}

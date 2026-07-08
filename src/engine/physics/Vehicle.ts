/**
 * Vehicle — chassis + 2 wheels + wheel-joint suspension (FR-005, FR-019).
 *
 * Structure (game_design §3.4): rounded-box chassis, 2 circle wheels,
 * b2WheelJoint x2 with suspension hertz/damping from TuningConstants,
 * restitution 0. Rear wheel (-x side) carries the motor; the car has zero
 * input while running.
 *
 * Launch sequence (UL: Anticipation -> Launch, FR-005):
 *   spawn idle (motor off) -> startLaunch() -> anticipation countdown of
 *   round(launch.anticipationSec / physics.fixedDt) ticks -> motor engages.
 * Call tick() once per fixed step; the countdown consumes exactly
 * anticipationTicks calls, then the motor turns on with
 *   effectiveMotorSpeed = car.motorSpeedBase x (1 + lv x speedPerLevelPct/100)
 * — a REAL physics multiplier per BR-005, not cosmetic.
 * Motor sign: negative (clockwise) angular speed rolls the car toward +x.
 *
 * VehicleReferencePoint (UL, data-model §1.4) = chassis AABB center — the
 * sole point used for clear (goalFlag entry) and fall (killY) judgement.
 *
 * roofContactActive — DOCUMENTED DEFINITION: the chassis counts as roof-down
 * while |chassis tilt| > fail.tipOverAngleRad (rotation cosine below
 * cos(threshold)). Chosen over fixture-contact events because it is
 * deterministic, headless-friendly, and free of contact-event plumbing; the
 * Judge integrates it over fail.tipOverTimeSec (T025).
 */

import {
  b2Body_ComputeAABB,
  b2Body_GetAngularVelocity,
  b2Body_GetLinearVelocity,
  b2Body_GetMass,
  b2Body_GetRotation,
  b2Body_SetAwake,
  b2Circle,
  b2CreateCircleShape,
  b2CreatePolygonShape,
  b2CreateWheelJoint,
  b2DefaultShapeDef,
  b2DefaultWheelJointDef,
  b2DestroyJoint,
  b2Joint_IsValid,
  b2MakeRoundedBox,
  b2Vec2,
  b2WheelJoint_EnableMotor,
  b2WheelJoint_SetMotorSpeed,
} from 'phaser-box2d';
import type { b2BodyId, b2JointId, b2ShapeDef } from 'phaser-box2d';
import type { Point } from '../level/LevelSchema';
import type { World } from './World';
import { CATEGORY_VEHICLE, MASK_ALL } from './CollisionCategories';
import { car, economy, launch, physics, fail } from '@tuning/TuningConstants';

export type VehiclePhase = 'idle' | 'anticipation' | 'running';

/** World-space axis-aligned bounding box (metres). */
export interface Aabb {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface VehicleOptions {
  /** Engine speed upgrade level, 0..economy.maxUpgradeLevel (FR-019). */
  readonly engineSpeedLv?: number;
}

function vehicleShapeDef(density: number, friction: number): b2ShapeDef {
  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = density;
  shapeDef.friction = friction;
  shapeDef.restitution = car.restitution;
  shapeDef.filter.categoryBits = CATEGORY_VEHICLE;
  shapeDef.filter.maskBits = MASK_ALL;
  return shapeDef;
}

export class Vehicle {
  readonly chassisId: b2BodyId;
  /** [rear (-x, motorized), front (+x)]. */
  readonly wheelIds: readonly [b2BodyId, b2BodyId];
  /** [rear, front] — same order as wheelIds. */
  readonly wheelJointIds: readonly [b2JointId, b2JointId];
  /** Countdown length: launch.anticipationSec at the fixed step rate. */
  readonly anticipationTicks: number;
  /** Real motor speed after upgrades (rad/s magnitude) — BR-005. */
  readonly effectiveMotorSpeed: number;

  private readonly world: World;
  private currentPhase: VehiclePhase = 'idle';
  private ticksUntilMotor = 0;
  private isDestroyed = false;

  constructor(world: World, spawn: Point, options?: VehicleOptions) {
    const engineSpeedLv = options?.engineSpeedLv ?? 0;
    if (!Number.isInteger(engineSpeedLv) || engineSpeedLv < 0 || engineSpeedLv > economy.maxUpgradeLevel) {
      throw new Error(`Vehicle: engineSpeedLv must be an integer in 0..${economy.maxUpgradeLevel} (got ${engineSpeedLv})`);
    }
    this.world = world;
    this.anticipationTicks = Math.round(launch.anticipationSec / physics.fixedDt);
    this.effectiveMotorSpeed = car.motorSpeedBase * (1 + engineSpeedLv * (economy.speedPerLevelPct / 100));

    this.chassisId = this.createChassis(spawn);
    const rearWheelId = this.createWheel({ x: spawn.x - car.wheelOffsetX, y: spawn.y + car.wheelOffsetY });
    const frontWheelId = this.createWheel({ x: spawn.x + car.wheelOffsetX, y: spawn.y + car.wheelOffsetY });
    this.wheelIds = [rearWheelId, frontWheelId];
    this.wheelJointIds = [
      this.createSuspension(rearWheelId, -car.wheelOffsetX),
      this.createSuspension(frontWheelId, car.wheelOffsetX),
    ];
  }

  get phase(): VehiclePhase {
    return this.currentPhase;
  }

  get rearWheelJointId(): b2JointId {
    return this.wheelJointIds[0];
  }

  get frontWheelJointId(): b2JointId {
    return this.wheelJointIds[1];
  }

  /** Chassis speed magnitude in m/s (Judge divergence input). */
  get speed(): number {
    const velocity = b2Body_GetLinearVelocity(this.chassisId);
    return Math.hypot(velocity.x, velocity.y);
  }

  /** Chassis + wheels (bridge mass clamp reference, data-model §1.3). */
  get totalMass(): number {
    return (
      b2Body_GetMass(this.chassisId) +
      b2Body_GetMass(this.wheelIds[0]) +
      b2Body_GetMass(this.wheelIds[1])
    );
  }

  /** Angle-based roof-down state — see module header for the definition. */
  get roofContactActive(): boolean {
    return b2Body_GetRotation(this.chassisId).c < Math.cos(fail.tipOverAngleRad);
  }

  /** VehicleReferencePoint = chassis AABB center (UL). */
  referencePoint(): Point {
    const aabb = b2Body_ComputeAABB(this.chassisId);
    return { x: (aabb.lowerBoundX + aabb.upperBoundX) / 2, y: (aabb.lowerBoundY + aabb.upperBoundY) / 2 };
  }

  /**
   * World-space AABBs the car physically occupies: chassis + both wheels — the
   * DangerZone overlap test surface (Judge FailCause 'hazard'). "Car (chassis or
   * wheels) overlapping a zone" is exactly any of these three boxes touching the
   * zone rect. Read-only (b2Body_ComputeAABB), so Render/gates may sample it.
   */
  occupiedAABBs(): readonly Aabb[] {
    return [this.chassisId, this.wheelIds[0], this.wheelIds[1]].map((bodyId) => {
      const aabb = b2Body_ComputeAABB(bodyId);
      return { minX: aabb.lowerBoundX, minY: aabb.lowerBoundY, maxX: aabb.upperBoundX, maxY: aabb.upperBoundY };
    });
  }

  /** [rear, front] wheel angular velocities in rad/s. */
  wheelAngularVelocities(): readonly [number, number] {
    return [b2Body_GetAngularVelocity(this.wheelIds[0]), b2Body_GetAngularVelocity(this.wheelIds[1])];
  }

  /** Idle -> Anticipation. The countdown runs inside tick(). */
  startLaunch(): void {
    if (this.currentPhase !== 'idle') {
      throw new Error(`Vehicle.startLaunch: only valid from idle (phase: ${this.currentPhase})`);
    }
    this.currentPhase = 'anticipation';
    this.ticksUntilMotor = this.anticipationTicks;
  }

  /** Call once per fixed step. Engages the motor exactly at countdown zero. */
  tick(): void {
    if (this.currentPhase !== 'anticipation') {
      return;
    }
    this.ticksUntilMotor--;
    if (this.ticksUntilMotor <= 0) {
      this.engageMotor();
    }
  }

  /** Remove joints and bodies. Idempotent. */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    for (const jointId of this.wheelJointIds) {
      if (b2Joint_IsValid(jointId)) {
        b2DestroyJoint(jointId);
      }
    }
    this.world.destroyBody(this.wheelIds[0]);
    this.world.destroyBody(this.wheelIds[1]);
    this.world.destroyBody(this.chassisId);
    this.isDestroyed = true;
  }

  private createChassis(spawn: Point): b2BodyId {
    const bodyId = this.world.createBody({ type: 'dynamic', position: spawn });
    const box = b2MakeRoundedBox(car.chassisHalfWidth, car.chassisHalfHeight, car.chassisCornerRadius);
    b2CreatePolygonShape(bodyId, vehicleShapeDef(car.chassisDensity, car.surfaceFriction), box);
    return bodyId;
  }

  private createWheel(position: Point): b2BodyId {
    const bodyId = this.world.createBody({ type: 'dynamic', position });
    const circle = new b2Circle(new b2Vec2(0, 0), car.wheelRadius);
    b2CreateCircleShape(bodyId, vehicleShapeDef(car.wheelDensity, car.tireFriction), circle);
    return bodyId;
  }

  /** Wheel joint with suspension along the chassis-local up axis. */
  private createSuspension(wheelId: b2BodyId, anchorOffsetX: number): b2JointId {
    const def = b2DefaultWheelJointDef(); // localAxisA = (0, 1) suspension axis
    def.bodyIdA = this.chassisId;
    def.bodyIdB = wheelId;
    def.localAnchorA = new b2Vec2(anchorOffsetX, car.wheelOffsetY);
    def.localAnchorB = new b2Vec2(0, 0);
    def.enableSpring = true;
    def.hertz = car.suspensionHertz;
    def.dampingRatio = car.suspensionDampingRatio;
    def.enableMotor = false;
    def.maxMotorTorque = car.maxMotorTorque;
    def.collideConnected = false;
    return this.world.registerJoint(b2CreateWheelJoint(this.world.id, def));
  }

  /** Anticipation -> Running: rear motor on at the effective speed. */
  private engageMotor(): void {
    // negative = clockwise spin = rolls toward +x in the y-up world
    b2WheelJoint_SetMotorSpeed(this.rearWheelJointId, -this.effectiveMotorSpeed);
    b2WheelJoint_EnableMotor(this.rearWheelJointId, true);
    // LIB-QUIRK(phaser-box2d@1.1.0): unlike native Box2D v3, the port's motor
    // setters do NOT wake sleeping bodies — wake the island explicitly or a
    // settled car never launches.
    b2Body_SetAwake(this.chassisId, true);
    this.currentPhase = 'running';
  }
}

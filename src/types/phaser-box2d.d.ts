/**
 * Hand-written typings for phaser-box2d@1.1.0 (the package ships no
 * declarations and a broken "main" field — see the alias in vite.config.ts).
 *
 * Only the surface actually used by src/engine + tests is typed; extend as new
 * b2 APIs are adopted. Names/signatures verified against
 * node_modules/phaser-box2d/dist/PhaserBox2D.js (Box2D v3 JS port).
 */

/* eslint-disable @typescript-eslint/naming-convention -- external library's real b2* export names */
declare module 'phaser-box2d' {
  // -- math / ids -------------------------------------------------------------

  export class b2Vec2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    clone(): b2Vec2;
    copy(v: b2Vec2): b2Vec2;
  }

  /** Rotation as cosine/sine pair (Box2D v3 style). */
  export class b2Rot {
    c: number;
    s: number;
    constructor(c?: number, s?: number);
  }

  export class b2WorldId {
    index1: number;
    revision: number;
    constructor(index?: number, revision?: number);
  }

  export class b2BodyId {
    index1: number;
    world0: number;
    revision: number;
    constructor(index?: number, world?: number, revision?: number);
  }

  export class b2ShapeId {
    index1: number;
    world0: number;
    revision: number;
  }

  export class b2ChainId {
    index1: number;
    world0: number;
    revision: number;
  }

  export class b2JointId {
    index1: number;
    world0: number;
    revision: number;
  }

  // -- defs -------------------------------------------------------------------

  export const b2BodyType: {
    readonly b2_staticBody: 0;
    readonly b2_kinematicBody: 1;
    readonly b2_dynamicBody: 2;
    readonly b2_bodyTypeCount: 3;
  };

  export class b2Filter {
    categoryBits: number;
    maskBits: number;
    groupIndex: number;
  }

  export class b2WorldDef {
    gravity: b2Vec2;
    hitEventThreshold: number;
    restitutionThreshold: number;
    contactHertz: number;
    contactDampingRatio: number;
    jointHertz: number;
    jointDampingRatio: number;
    maximumLinearVelocity: number;
    enableSleep: boolean;
    enableContinuous: boolean;
  }

  export class b2BodyDef {
    type: number;
    position: b2Vec2;
    rotation: b2Rot;
    linearVelocity: b2Vec2;
    angularVelocity: number;
    linearDamping: number;
    angularDamping: number;
    gravityScale: number;
    sleepThreshold: number;
    userData: unknown;
    enableSleep: boolean;
    isAwake: boolean;
    fixedRotation: boolean;
    isBullet: boolean;
    isEnabled: boolean;
  }

  export class b2ShapeDef {
    userData: unknown;
    friction: number;
    restitution: number;
    density: number;
    filter: b2Filter;
    isSensor: boolean;
    enableSensorEvents: boolean;
    enableContactEvents: boolean;
    enableHitEvents: boolean;
    enablePreSolveEvents: boolean;
    forceContactCreation: boolean;
  }

  export class b2ChainDef {
    userData: unknown;
    /** Ordered vertices; first and last act as GHOST points for open chains. */
    points: b2Vec2[] | null;
    count: number;
    friction: number;
    restitution: number;
    filter: b2Filter;
    isLoop: boolean;
  }

  /** Opaque convex polygon (produce via b2MakeBox / b2MakePolygon helpers). */
  export class b2Polygon {
    count: number;
    radius: number;
  }

  /** Capsule between two LOCAL points (b2CreateCapsuleShape). */
  export class b2Capsule {
    center1: b2Vec2 | null;
    center2: b2Vec2 | null;
    radius: number;
  }

  export class b2Circle {
    center: b2Vec2;
    radius: number;
    constructor(center?: b2Vec2 | null, radius?: number);
  }

  /** Axis-aligned box as four scalars (NOT b2Vec2 bounds — verified in dist). */
  export class b2AABB {
    lowerBoundX: number;
    lowerBoundY: number;
    upperBoundX: number;
    upperBoundY: number;
    constructor(lowerx?: number, lowery?: number, upperx?: number, uppery?: number);
  }

  export class b2RevoluteJointDef {
    bodyIdA: b2BodyId | null;
    bodyIdB: b2BodyId | null;
    localAnchorA: b2Vec2;
    localAnchorB: b2Vec2;
    referenceAngle: number;
    enableSpring: boolean;
    hertz: number;
    dampingRatio: number;
    enableLimit: boolean;
    lowerAngle: number;
    upperAngle: number;
    enableMotor: boolean;
    maxMotorTorque: number;
    motorSpeed: number;
    drawSize: number;
    collideConnected: boolean;
    userData: unknown;
  }

  export class b2WheelJointDef {
    bodyIdA: b2BodyId | null;
    bodyIdB: b2BodyId | null;
    localAnchorA: b2Vec2;
    localAnchorB: b2Vec2;
    /** Suspension axis in bodyA local space (default (0, 1)). */
    localAxisA: b2Vec2;
    enableSpring: boolean;
    hertz: number;
    dampingRatio: number;
    enableLimit: boolean;
    lowerTranslation: number;
    upperTranslation: number;
    enableMotor: boolean;
    maxMotorTorque: number;
    motorSpeed: number;
    collideConnected: boolean;
    userData: unknown;
  }

  export function b2DefaultWorldDef(): b2WorldDef;
  export function b2DefaultBodyDef(): b2BodyDef;
  export function b2DefaultShapeDef(): b2ShapeDef;
  export function b2DefaultChainDef(): b2ChainDef;
  /** Preset: drawSize 0.25; everything else zero/false. */
  export function b2DefaultRevoluteJointDef(): b2RevoluteJointDef;
  /** Preset: localAxisA (0,1), enableSpring true, hertz 1, dampingRatio 0.7. */
  export function b2DefaultWheelJointDef(): b2WheelJointDef;

  // -- world ------------------------------------------------------------------

  /**
   * Initializes the global world slot array (idempotent).
   * MUST be called before the first b2CreateWorld.
   */
  export function b2CreateWorldArray(): void;
  export function b2CreateWorld(def: b2WorldDef): b2WorldId;
  export function b2World_Step(worldId: b2WorldId, timeStep: number, subStepCount: number): void;
  /**
   * QUIRK(phaser-box2d@1.1.0): guts the world but never frees its slot
   * (`inUse` stays true), so at most 32 worlds can ever be created per
   * process, and b2World_IsValid keeps returning true after destroy.
   */
  export function b2DestroyWorld(worldId: b2WorldId): void;
  export function b2World_IsValid(worldId: b2WorldId): boolean;

  // -- bodies -----------------------------------------------------------------

  export function b2CreateBody(worldId: b2WorldId, def: b2BodyDef): b2BodyId;
  export function b2DestroyBody(bodyId: b2BodyId): void;
  /** Returns a live reference to the body's transform position — do not mutate. */
  export function b2Body_GetPosition(bodyId: b2BodyId): b2Vec2;
  /** Returns a live reference to the body's transform rotation — do not mutate. */
  export function b2Body_GetRotation(bodyId: b2BodyId): b2Rot;
  export function b2Body_GetLinearVelocity(bodyId: b2BodyId): b2Vec2;
  export function b2Body_GetAngularVelocity(bodyId: b2BodyId): number;
  export function b2Body_SetLinearVelocity(bodyId: b2BodyId, linearVelocity: b2Vec2): void;
  /** awake=true wakes the body's island (sleeping joints ignore motor setters). */
  export function b2Body_SetAwake(bodyId: b2BodyId, awake: boolean): void;
  /** Teleport; rotation optional (kept when undefined). Updates shape AABBs. */
  export function b2Body_SetTransform(bodyId: b2BodyId, position: b2Vec2, rotation?: b2Rot): void;
  export function b2Body_GetMass(bodyId: b2BodyId): number;
  /** Tight union of the body's shape AABBs (current transform). */
  export function b2Body_ComputeAABB(bodyId: b2BodyId): b2AABB;
  export function b2Body_GetShapeCount(bodyId: b2BodyId): number;
  /** Fills `shapeArray` (index 0..) and returns the shape count. */
  export function b2Body_GetShapes(bodyId: b2BodyId, shapeArray: b2ShapeId[]): number;
  export function b2MakeRot(angle: number): b2Rot;

  // -- shapes -----------------------------------------------------------------

  export function b2MakeBox(halfWidth: number, halfHeight: number): b2Polygon;
  /** b2MakeBox with polygon radius set — Box2D v3 rounded box. */
  export function b2MakeRoundedBox(halfWidth: number, halfHeight: number, radius: number): b2Polygon;
  export function b2CreatePolygonShape(bodyId: b2BodyId, def: b2ShapeDef, polygon: b2Polygon): b2ShapeId;
  export function b2CreateCircleShape(bodyId: b2BodyId, def: b2ShapeDef, circle: b2Circle): b2ShapeId;
  /** Degrades to a circle shape when the capsule is shorter than linearSlop. */
  export function b2CreateCapsuleShape(bodyId: b2BodyId, def: b2ShapeDef, capsule: b2Capsule): b2ShapeId;
  /** Returns a live reference to the shape's filter — copy before mutating. */
  export function b2Shape_GetFilter(shapeId: b2ShapeId): b2Filter;
  /** Replaces the filter and refreshes broadphase contacts. */
  export function b2Shape_SetFilter(shapeId: b2ShapeId, filter: b2Filter): void;

  // -- chains (one-sided static terrain) ----------------------------------------

  export function b2CreateChain(bodyId: b2BodyId, def: b2ChainDef): b2ChainId;
  export function b2DestroyChain(chainId: b2ChainId): void;

  // -- joints (stress/break pipeline, research R2) -------------------------------

  export function b2DestroyJoint(jointId: b2JointId): void;
  export function b2Joint_GetConstraintForce(jointId: b2JointId): b2Vec2;
  export function b2Joint_GetConstraintTorque(jointId: b2JointId): number;
  /** False once destroyed (revision-checked against the joint slot). */
  export function b2Joint_IsValid(jointId: b2JointId): boolean;

  export function b2CreateRevoluteJoint(worldId: b2WorldId, def: b2RevoluteJointDef): b2JointId;
  export function b2RevoluteJoint_IsSpringEnabled(jointId: b2JointId): boolean;
  export function b2RevoluteJoint_GetSpringHertz(jointId: b2JointId): number;
  export function b2RevoluteJoint_GetSpringDampingRatio(jointId: b2JointId): number;
  export function b2RevoluteJoint_IsLimitEnabled(jointId: b2JointId): boolean;
  export function b2RevoluteJoint_GetLowerLimit(jointId: b2JointId): number;
  export function b2RevoluteJoint_GetUpperLimit(jointId: b2JointId): number;

  export function b2CreateWheelJoint(worldId: b2WorldId, def: b2WheelJointDef): b2JointId;
  export function b2WheelJoint_GetSpringHertz(jointId: b2JointId): number;
  export function b2WheelJoint_GetSpringDampingRatio(jointId: b2JointId): number;
  export function b2WheelJoint_EnableMotor(jointId: b2JointId, enableMotor: boolean): void;
  export function b2WheelJoint_IsMotorEnabled(jointId: b2JointId): boolean;
  export function b2WheelJoint_SetMotorSpeed(jointId: b2JointId, motorSpeed: number): void;
  export function b2WheelJoint_GetMotorSpeed(jointId: b2JointId): number;
  export function b2WheelJoint_SetMaxMotorTorque(jointId: b2JointId, torque: number): void;
  export function b2WheelJoint_GetMaxMotorTorque(jointId: b2JointId): number;
}

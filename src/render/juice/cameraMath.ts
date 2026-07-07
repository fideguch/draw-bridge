/**
 * cameraMath — the pure, headless-testable core of the camera director (T048).
 *
 * Everything here is a plain function of numbers so it unit-tests without a
 * Phaser camera (render-logic.spec.ts): follow lerp, speed-proportional
 * look-ahead with a car-length cap, trauma^2 screen shake over deterministic
 * seeded value-noise, launch-kick decay, and zoom lerp. CameraDirector.ts is a
 * thin shell that feeds a Phaser camera from computeCameraState().
 *
 * Units: positions/offsets are WORLD PIXELS (see worldToPixel.ts); the Phaser
 * camera turns those into screen pixels. Angles are radians. Trauma is 0..1 and
 * the visible shake is trauma^2 (game_design §8.2 / §4.2 2-9).
 */

import { camera as cameraTuning } from '@tuning/TuningConstants';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

const ZERO: Vec2 = { x: 0, y: 0 };

/** Clamp to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Scalar linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Vector linear interpolation. */
export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// ── trauma ────────────────────────────────────────────────────────────────────

/** Visible shake magnitude from trauma: shake = trauma^2 (clamped 0..1). */
export function traumaToShake(trauma: number): number {
  const t = clamp(trauma, 0, 1);
  return t * t;
}

/** Add trauma from an event (launch/land/crash/goal), saturating at 1. */
export function addTrauma(current: number, amount: number): number {
  return clamp(current + amount, 0, 1);
}

/** Linear trauma decay toward 0 over `decayPerSec` per second. */
export function decayTrauma(current: number, decayPerSec: number, dt: number): number {
  return Math.max(0, clamp(current, 0, 1) - decayPerSec * dt);
}

// ── look-ahead ──────────────────────────────────────────────────────────────

export interface LookAheadParams {
  /** Car length in world pixels (the cap unit). */
  readonly carLengthPx: number;
  /** Cap in car lengths (game_design camera.lookAheadCarLengths, 1-2). */
  readonly lookAheadCarLengths: number;
  /** Speed (px/s) at which look-ahead saturates at the cap. */
  readonly saturationSpeed: number;
}

/**
 * Look-ahead offset in the travel direction, magnitude proportional to speed
 * and capped at `lookAheadCarLengths` car lengths (game_design §4.2 2-3).
 * Zero when stationary; saturates at `saturationSpeed`.
 */
export function computeLookAhead(velocity: Vec2, speed: number, params: LookAheadParams): Vec2 {
  if (speed <= 1e-6 || params.saturationSpeed <= 0) {
    return ZERO;
  }
  const capPx = params.lookAheadCarLengths * params.carLengthPx;
  const magnitude = clamp(speed / params.saturationSpeed, 0, 1) * capPx;
  return { x: (velocity.x / speed) * magnitude, y: (velocity.y / speed) * magnitude };
}

// ── deterministic value noise (seeded, no Perlin dependency) ────────────────

/** Hash an integer lattice point to [0, 1) — deterministic across runs. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * 1-D smoothed value noise in [-1, 1]. Smoothstep-interpolated between hashed
 * lattice points; deterministic given the same input (seeded shake).
 */
export function valueNoise1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i);
  const b = hash01(i + 1);
  return (a + (b - a) * u) * 2 - 1;
}

export interface ShakeParams {
  readonly maxOffsetPx: number;
  readonly maxAngleRad: number;
  readonly freqHz: number;
  /** Distinct seed so two cameras (or channels) shake independently. */
  readonly seed: number;
}

export interface ShakeOffset {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * Screen shake offset at `timeSec`, scaled by trauma^2. X/Y/angle sample the
 * noise field at separate phase offsets so they are decorrelated.
 */
export function computeShake(trauma: number, timeSec: number, params: ShakeParams): ShakeOffset {
  const magnitude = traumaToShake(trauma);
  const phase = timeSec * params.freqHz;
  return {
    x: valueNoise1D(phase + params.seed) * magnitude * params.maxOffsetPx,
    y: valueNoise1D(phase + params.seed + 137.13) * magnitude * params.maxOffsetPx,
    angle: valueNoise1D(phase + params.seed + 311.7) * magnitude * params.maxAngleRad,
  };
}

// ── composed camera state ─────────────────────────────────────────────────────

export interface CameraDirectorInput {
  /** Seconds since last update (drives decay + noise advance). */
  readonly dt: number;
  /** Absolute time in seconds for noise phase. */
  readonly time: number;
  /** Current smoothed camera centre (world px). */
  readonly center: Vec2;
  /** Follow target, e.g. VehicleReferencePoint (world px). */
  readonly target: Vec2;
  /** Target velocity (world px/s) for look-ahead direction/magnitude. */
  readonly velocity: Vec2;
  /** |velocity| in px/s. */
  readonly speed: number;
  /** Current trauma 0..1 (pre-decay; shake reads this). */
  readonly trauma: number;
  /** Current launch-kick offset (world px), decaying to 0. */
  readonly kick: Vec2;
  /** Current zoom. */
  readonly zoom: number;
  /** Zoom to lerp toward (slow-mo drives this, Phase 6). */
  readonly targetZoom: number;
}

export interface CameraDirectorParams {
  /** Follow lerp per update (camera.followLerp, 0.08-0.15). */
  readonly followLerp: number;
  /** Zoom lerp per update. */
  readonly zoomLerp: number;
  readonly lookAhead: LookAheadParams;
  readonly shake: ShakeParams;
  /** Trauma decay per second (camera.traumaDecayPerSec). */
  readonly traumaDecayPerSec: number;
  /** Launch-kick recovery time in seconds (camera.launchKickRecoverSec). */
  readonly kickRecoverSec: number;
}

export interface CameraStateOutput {
  /** New smoothed centre (feeds back next frame). */
  readonly center: Vec2;
  /** Decayed launch kick (feeds back next frame). */
  readonly kick: Vec2;
  /** Decayed trauma (feeds back next frame). */
  readonly trauma: number;
  /** Lerped zoom (feeds back next frame). */
  readonly zoom: number;
  /** Where to actually point the camera: centre + kick + shake. */
  readonly renderCenter: Vec2;
  /** Camera roll from shake (radians). */
  readonly angle: number;
}

/**
 * One camera update, pure: lerp the centre toward target+look-ahead, decay the
 * launch kick and trauma, lerp zoom, and add trauma^2 shake. The `renderCenter`
 * / `angle` are what CameraDirector applies to the Phaser camera; the other
 * fields are the next frame's state.
 */
export function computeCameraState(input: CameraDirectorInput, params: CameraDirectorParams): CameraStateOutput {
  const lookAhead = computeLookAhead(input.velocity, input.speed, params.lookAhead);
  const followTarget: Vec2 = { x: input.target.x + lookAhead.x, y: input.target.y + lookAhead.y };
  const center = lerpVec2(input.center, followTarget, clamp(params.followLerp, 0, 1));
  const zoom = lerp(input.zoom, input.targetZoom, clamp(params.zoomLerp, 0, 1));

  // Linear kick recovery: shrink toward 0 across kickRecoverSec.
  const kickDecay = params.kickRecoverSec > 0 ? clamp(input.dt / params.kickRecoverSec, 0, 1) : 1;
  const kick: Vec2 = { x: input.kick.x * (1 - kickDecay), y: input.kick.y * (1 - kickDecay) };

  const trauma = decayTrauma(input.trauma, params.traumaDecayPerSec, input.dt);
  const shake = computeShake(input.trauma, input.time, params.shake);

  return {
    center,
    kick,
    trauma,
    zoom,
    renderCenter: { x: center.x + kick.x + shake.x, y: center.y + kick.y + shake.y },
    angle: shake.angle,
  };
}

/** Degrees -> radians (camera.shakeMaxAngleDeg is authored in degrees). */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Default shake params straight from TuningConstants (camera group). Exposed so
 * CameraDirector and tests share one source; freq/offset/angle are the §8.2
 * initial values.
 */
export function defaultShakeParams(seed = 1): ShakeParams {
  return {
    maxOffsetPx: cameraTuning.shakeMaxOffsetPx,
    maxAngleRad: degToRad(cameraTuning.shakeMaxAngleDeg),
    freqHz: cameraTuning.shakeFreqHz,
    seed,
  };
}

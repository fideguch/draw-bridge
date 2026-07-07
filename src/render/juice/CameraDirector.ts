/**
 * CameraDirector — drives a Phaser camera from the pure camera core (T048,
 * FR-011, game_design §4.2 2-3 / 2-9, §8.2).
 *
 * Thin shell: it holds the mutable camera state (smoothed centre, launch kick,
 * trauma, zoom, time) and each update() feeds computeCameraState() then applies
 * the result to the Phaser camera — centre, roll (shake), zoom. All the maths
 * (follow lerp, speed-proportional look-ahead with a car-length cap, trauma^2
 * seeded-noise shake, kick decay) lives in cameraMath.ts and is unit-tested
 * headless.
 *
 * Coordinates are world PIXELS (worldToPixel.ts): the follow target + velocity
 * callbacks return world-pixel values, e.g.
 *   follow(() => transform.point(sim.referencePoint()), () => velocityPx).
 *
 * Public API PlayScene composes: follow / addTrauma / launchKick / zoomTo /
 * setZoomImmediate / update(dtMs) / reset / destroy. Phase 6 calls zoomTo for
 * the goal slow-mo zoom-in and addTrauma on launch/land/crash/goal.
 */

import type Phaser from 'phaser';
import { camera as cameraTuning, car } from '@tuning/TuningConstants';
import {
  addTrauma,
  computeCameraState,
  defaultShakeParams,
  degToRad,
  type CameraDirectorParams,
  type Vec2,
} from './cameraMath';

export interface CameraDirectorOptions {
  /** Camera to drive. Default scene.cameras.main. */
  readonly camera?: Phaser.Cameras.Scene2D.Camera;
  /** Metres -> world-pixels scale (sizes car length + look-ahead saturation). */
  readonly pixelsPerMeter: number;
  /** Follow lerp per update. Default camera.followLerp (0.10). */
  readonly followLerp?: number;
  /** Zoom lerp per update. Default ZOOM_LERP_PER_FRAME. */
  readonly zoomLerp?: number;
  /** Shake noise seed (distinct cameras shake independently). Default 1. */
  readonly shakeSeed?: number;
}

/**
 * TODO(tuning): promote to TuningConstants (camera.zoomLerp). No authored value
 * exists for how fast the camera eases between zoom levels (slow-mo in/out,
 * Phase 6); 0.15/frame is a placeholder chosen to reach target in ~0.25 s @60fps.
 */
const ZOOM_LERP_PER_FRAME = 0.15;

export class CameraDirector {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly params: CameraDirectorParams;

  private center: Vec2;
  private kick: Vec2 = { x: 0, y: 0 };
  private traumaLevel = 0;
  private zoomLevel: number;
  private targetZoomLevel: number;
  private timeSec = 0;

  private getTarget: () => Vec2;
  private getVelocity: () => Vec2;

  constructor(scene: Phaser.Scene, options: CameraDirectorOptions) {
    this.camera = options.camera ?? scene.cameras.main;
    this.center = { x: this.camera.midPoint.x, y: this.camera.midPoint.y };
    this.zoomLevel = this.camera.zoom;
    this.targetZoomLevel = this.camera.zoom;
    this.getTarget = (): Vec2 => this.center;
    this.getVelocity = (): Vec2 => ({ x: 0, y: 0 });

    const ppm = options.pixelsPerMeter;
    const carLengthPx = car.chassisHalfWidth * 2 * ppm;
    // Look-ahead saturates near the car's top speed (~motorSpeed x wheelRadius),
    // derived from tuning rather than a magic number.
    const saturationSpeed = car.motorSpeedBase * car.wheelRadius * ppm;
    this.params = {
      followLerp: options.followLerp ?? cameraTuning.followLerp,
      zoomLerp: options.zoomLerp ?? ZOOM_LERP_PER_FRAME,
      lookAhead: {
        carLengthPx,
        lookAheadCarLengths: cameraTuning.lookAheadCarLengths,
        saturationSpeed,
      },
      shake: defaultShakeParams(options.shakeSeed ?? 1),
      traumaDecayPerSec: cameraTuning.traumaDecayPerSec,
      kickRecoverSec: cameraTuning.launchKickRecoverSec,
    };
  }

  /** Bind follow target + velocity providers (world pixels / px per second). */
  follow(getTarget: () => Vec2, getVelocity?: () => Vec2): void {
    this.getTarget = getTarget;
    if (getVelocity !== undefined) {
      this.getVelocity = getVelocity;
    }
  }

  /** Add trauma from an event (camera.traumaLaunch/Land/Crash/Goal). */
  addTrauma(amount: number): void {
    this.traumaLevel = addTrauma(this.traumaLevel, amount);
  }

  /**
   * Launch kick: shove the camera opposite the travel direction by
   * camera.launchKickPx, recovering over camera.launchKickRecoverSec.
   */
  launchKick(travelDirection: Vec2): void {
    const magnitude = Math.hypot(travelDirection.x, travelDirection.y);
    if (magnitude <= 1e-6) {
      return;
    }
    const kickPx = cameraTuning.launchKickPx;
    this.kick = {
      x: -(travelDirection.x / magnitude) * kickPx,
      y: -(travelDirection.y / magnitude) * kickPx,
    };
  }

  /** Lerp toward a zoom (slow-mo zoom-in, Phase 6). */
  zoomTo(zoom: number): void {
    this.targetZoomLevel = zoom;
  }

  /** Snap zoom immediately (no lerp). */
  setZoomImmediate(zoom: number): void {
    this.zoomLevel = zoom;
    this.targetZoomLevel = zoom;
    this.camera.setZoom(zoom);
  }

  get trauma(): number {
    return this.traumaLevel;
  }

  /** Advance one render frame and apply to the Phaser camera. */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.timeSec += dt;
    const target = this.getTarget();
    const velocity = this.getVelocity();
    const speed = Math.hypot(velocity.x, velocity.y);

    const out = computeCameraState(
      {
        dt,
        time: this.timeSec,
        center: this.center,
        target,
        velocity,
        speed,
        trauma: this.traumaLevel,
        kick: this.kick,
        zoom: this.zoomLevel,
        targetZoom: this.targetZoomLevel,
      },
      this.params,
    );

    this.center = out.center;
    this.kick = out.kick;
    this.traumaLevel = out.trauma;
    this.zoomLevel = out.zoom;

    this.camera.setZoom(out.zoom);
    this.camera.centerOn(out.renderCenter.x, out.renderCenter.y);
    this.camera.setRotation(out.angle);
  }

  /** Reset follow/kick/trauma for a new attempt; optionally recentre. */
  reset(centerPx?: Vec2): void {
    if (centerPx !== undefined) {
      this.center = centerPx;
    }
    this.kick = { x: 0, y: 0 };
    this.traumaLevel = 0;
    this.timeSec = 0;
  }

  destroy(): void {
    this.camera.setRotation(0);
  }
}

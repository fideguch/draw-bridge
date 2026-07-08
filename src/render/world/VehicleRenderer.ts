/**
 * VehicleRenderer — chassis + 2 wheels from the live vehicle bodies (T047,
 * FR-005, game_design §4.2 2-4).
 *
 * Reads the chassis and both wheel transforms every frame (interpolated across
 * the fixed step) and draws:
 * - a rounded-box chassis (colorCarBody + colorInkBorder outline) at the real
 *   chassis position/rotation,
 * - two wheels (colorInkBorder discs) at their real body positions, each with a
 *   spoke cross rotated by the ACTUAL wheel body angle so spin is visible,
 * - suspension travel shows for free: the wheels are drawn at their true body
 *   positions relative to the chassis (no faked bounce — the wheel joints move
 *   them).
 *
 * Rotation sign: world is y-up, the render frame is y-down (worldToPixel), so a
 * world angle θ renders as screen angle -θ.
 */

import type Phaser from 'phaser';
import type { Vehicle } from '@engine/physics/Vehicle';
import { borderedRoundedRect } from '@render/ui/fillShapes';
import { color, stroke as strokeToken } from '@render/ui/theme';
import { car, launch } from '@tuning/TuningConstants';
import { degToRad } from '@render/juice/cameraMath';
import { readBodyPose, readBodySpeed } from './bodyPose';
import { StepInterpolator, type Pose } from './StepInterpolator';
import type { WorldToPixel } from './worldToPixel';

export interface VehicleRendererOptions {
  readonly depth?: number;
}

export class VehicleRenderer {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly vehicle: Vehicle;
  private readonly transform: WorldToPixel;
  private readonly interpolator = new StepInterpolator();

  private readonly chassisHalfWidthPx: number;
  private readonly chassisHalfHeightPx: number;
  private readonly chassisCornerPx: number;
  private readonly wheelRadiusPx: number;

  // Anticipation squash / release stretch (game_design §4.2 2-1 / 2-2). Tweened
  // fields applied as a canvas transform about the chassis centre each frame.
  private readonly squash = { x: 1, y: 1, tilt: 0 };

  constructor(scene: Phaser.Scene, vehicle: Vehicle, transform: WorldToPixel, options: VehicleRendererOptions = {}) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.vehicle = vehicle;
    this.transform = transform;
    this.chassisHalfWidthPx = transform.length(car.chassisHalfWidth);
    this.chassisHalfHeightPx = transform.length(car.chassisHalfHeight);
    this.chassisCornerPx = transform.length(car.chassisCornerRadius);
    this.wheelRadiusPx = transform.length(car.wheelRadius);
  }

  update(alpha: number): void {
    const poses = this.interpolator.sample(alpha, () => this.readPoses());
    const chassis = poses[0];
    const rearWheel = poses[1];
    const frontWheel = poses[2];
    if (chassis === undefined || rearWheel === undefined || frontWheel === undefined) {
      return;
    }
    this.graphics.clear();
    // Apply squash/stretch as a transform about the chassis pixel centre so the
    // whole car deforms around itself (identity when not launching → no cost).
    const pivot = this.transform.point(chassis);
    this.graphics.save();
    this.graphics.translateCanvas(pivot.x, pivot.y);
    this.graphics.scaleCanvas(this.squash.x, this.squash.y);
    this.graphics.rotateCanvas(this.squash.tilt);
    this.graphics.translateCanvas(-pivot.x, -pivot.y);
    // Wheels first so the chassis body overlaps their inner edge.
    this.drawWheel(rearWheel);
    this.drawWheel(frontWheel);
    this.drawChassis(chassis);
    this.graphics.restore();
  }

  /** Current chassis linear speed (m/s) — speed-lines / engine-hum gate. */
  chassisSpeed(): number {
    return readBodySpeed(this.vehicle.chassisId);
  }

  /**
   * Anticipation squash (§4.2 2-1): ease into a rear-tilted, vertically
   * compressed pose over launch.squashEaseInSec. Held until playRelease().
   */
  playAnticipation(): void {
    this.scene.tweens.killTweensOf(this.squash);
    this.scene.tweens.add({
      targets: this.squash,
      x: launch.squashScaleX,
      y: launch.squashScaleY,
      tilt: -degToRad(launch.squashTiltDeg), // nose-up rear lean (car faces +x)
      duration: launch.squashEaseInSec * 1000,
      ease: 'Sine.In',
    });
  }

  /**
   * Release stretch (§4.2 2-2): snap to a forward stretch then recover to rest
   * over launch.stretchRecoverMs.
   */
  playRelease(): void {
    this.scene.tweens.killTweensOf(this.squash);
    this.squash.x = launch.stretchScaleX;
    this.squash.y = launch.stretchScaleY;
    this.squash.tilt = 0;
    this.scene.tweens.add({
      targets: this.squash,
      x: 1,
      y: 1,
      tilt: 0,
      duration: launch.stretchRecoverMs,
      ease: 'Quad.Out',
    });
  }

  /** Forget interpolation history + squash on attempt restart. */
  reset(): void {
    this.interpolator.reset();
    this.scene.tweens.killTweensOf(this.squash);
    this.squash.x = 1;
    this.squash.y = 1;
    this.squash.tilt = 0;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.squash);
    this.graphics.destroy();
  }

  private readPoses(): Pose[] {
    return [
      readBodyPose(this.vehicle.chassisId),
      readBodyPose(this.vehicle.wheelIds[0]),
      readBodyPose(this.vehicle.wheelIds[1]),
    ];
  }

  private drawChassis(pose: Pose): void {
    const px = this.transform.point(pose);
    this.graphics.save();
    this.graphics.translateCanvas(px.x, px.y);
    this.graphics.rotateCanvas(-pose.angle);
    const width = this.chassisHalfWidthPx * 2;
    const height = this.chassisHalfHeightPx * 2;
    borderedRoundedRect(
      this.graphics,
      -this.chassisHalfWidthPx,
      -this.chassisHalfHeightPx,
      width,
      height,
      this.chassisCornerPx,
      { fill: color.carBody, border: color.inkBorder, borderWidth: strokeToken.game },
    );
    this.graphics.restore();
  }

  private drawWheel(pose: Pose): void {
    const px = this.transform.point(pose);
    const radius = this.wheelRadiusPx;
    this.graphics.save();
    this.graphics.translateCanvas(px.x, px.y);
    this.graphics.rotateCanvas(-pose.angle);
    this.graphics.fillStyle(color.inkBorder, 1);
    this.graphics.fillCircle(0, 0, radius);
    // Spoke cross (two filled bars) rotates with the wheel body -> spin is
    // legible. Fill-only: no strokePath (research §3).
    const spoke = Math.max(2, radius * 0.16);
    this.graphics.fillStyle(color.inkLine, 1);
    this.graphics.fillRect(-radius, -spoke / 2, radius * 2, spoke);
    this.graphics.fillRect(-spoke / 2, -radius, spoke, radius * 2);
    this.graphics.fillCircle(0, 0, Math.max(2, radius * 0.25));
    this.graphics.restore();
  }
}

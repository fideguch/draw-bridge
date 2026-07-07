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
import { color, stroke as strokeToken } from '@render/ui/theme';
import { car } from '@tuning/TuningConstants';
import { readBodyPose } from './bodyPose';
import { StepInterpolator, type Pose } from './StepInterpolator';
import type { WorldToPixel } from './worldToPixel';

export interface VehicleRendererOptions {
  readonly depth?: number;
}

export class VehicleRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly vehicle: Vehicle;
  private readonly transform: WorldToPixel;
  private readonly interpolator = new StepInterpolator();

  private readonly chassisHalfWidthPx: number;
  private readonly chassisHalfHeightPx: number;
  private readonly chassisCornerPx: number;
  private readonly wheelRadiusPx: number;

  constructor(scene: Phaser.Scene, vehicle: Vehicle, transform: WorldToPixel, options: VehicleRendererOptions = {}) {
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
    // Wheels first so the chassis body overlaps their inner edge.
    this.drawWheel(rearWheel);
    this.drawWheel(frontWheel);
    this.drawChassis(chassis);
  }

  /** Forget interpolation history on attempt restart. */
  reset(): void {
    this.interpolator.reset();
  }

  destroy(): void {
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
    this.graphics.fillStyle(color.carBody, 1);
    this.graphics.fillRoundedRect(-this.chassisHalfWidthPx, -this.chassisHalfHeightPx, width, height, this.chassisCornerPx);
    this.graphics.lineStyle(strokeToken.game, color.inkBorder, 1);
    this.graphics.strokeRoundedRect(-this.chassisHalfWidthPx, -this.chassisHalfHeightPx, width, height, this.chassisCornerPx);
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
    // Spoke cross rotates with the wheel body -> spin is legible.
    this.graphics.lineStyle(2, color.inkLine, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(-radius, 0);
    this.graphics.lineTo(radius, 0);
    this.graphics.moveTo(0, -radius);
    this.graphics.lineTo(0, radius);
    this.graphics.strokePath();
    this.graphics.fillStyle(color.inkLine, 1);
    this.graphics.fillCircle(0, 0, Math.max(2, radius * 0.25));
    this.graphics.restore();
  }
}

/**
 * VehicleRenderer — a sporty little rally car drawn from the live vehicle bodies
 * (T047, FR-005, game_design §4.2 2-4).
 *
 * Reads the chassis and both wheel transforms every frame (interpolated across
 * the fixed step) and draws, FILL-ONLY (no Graphics stroke* — research
 * 08_mobile_quality §3), out of src/render/ui/fillShapes primitives:
 * - a rounded-box chassis at the real chassis pose, layered into a car
 *   silhouette: darker-orange belly shadow (volume), a cream racing beltline, a
 *   steel-blue cabin with a raked windshield + side glass, and head/tail lights,
 * - two alloy wheels at their real body positions — dark tyre + silver rim +
 *   5 spokes + a body-coloured hub cap, the spokes rotated by the ACTUAL wheel
 *   body angle so spin stays legible,
 * - suspension travel shows for free: the wheels are drawn at their true body
 *   positions relative to the chassis (no faked bounce — the wheel joints move
 *   them). Wheels draw BEFORE the chassis so the body tucks over the wheel tops,
 *   giving the wheel-arch cutout illusion.
 *
 * Rotation sign: world is y-up, the render frame is y-down (worldToPixel), so a
 * world angle θ renders as screen angle -θ. In the chassis-local frame +x is
 * forward (the car faces +x) and -y is up (roof), +y is down (belly).
 */

import type Phaser from 'phaser';
import type { Vehicle } from '@engine/physics/Vehicle';
import {
  borderedCircle,
  borderedPolygon,
  borderedRoundedRect,
  clampRadius,
  fillThickPolyline,
  type Vec2,
} from '@render/ui/fillShapes';
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
    // Wheels first so the chassis body overlaps their inner edge (arch tuck).
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

  /** Paint the whole car body (chassis pose): base + belly + stripe + cabin + lights. */
  private drawChassis(pose: Pose): void {
    const px = this.transform.point(pose);
    this.graphics.save();
    this.graphics.translateCanvas(px.x, px.y);
    this.graphics.rotateCanvas(-pose.angle);
    const w = this.chassisHalfWidthPx;
    const h = this.chassisHalfHeightPx;
    this.paintBody(w, h);
    this.paintCabin(w, h);
    this.paintLights(w, h);
    this.graphics.restore();
  }

  /** Base rounded-box body + darker belly shade + cream racing beltline stripe. */
  private paintBody(w: number, h: number): void {
    const g = this.graphics;
    const width = w * 2;
    const height = h * 2;
    // Proportional cap: at low pixels-per-meter the fixed stroke token exceeds
    // half the chassis height and eats the body fill entirely (the all-dark-car
    // bug, same class as the world-coin border bug).
    const b = Math.min(strokeToken.game, height * 0.18, width * 0.18);
    borderedRoundedRect(g, -w, -h, width, height, this.chassisCornerPx, {
      fill: color.carBody,
      border: color.inkBorder,
      borderWidth: b,
    });
    // Belly ambient-occlusion: darker orange over the lower ~45% for volume.
    const bellyTop = 0.1 * h;
    const bellyH = h - b - bellyTop;
    if (bellyH > 0) {
      g.fillStyle(color.carBodyDark, 1);
      g.fillRoundedRect(
        -w + b,
        bellyTop,
        width - 2 * b,
        bellyH,
        clampRadius(this.chassisCornerPx - b, width - 2 * b, bellyH),
      );
    }
    // Cream beltline racing stripe across the upper body side.
    const stripeH = 0.42 * h;
    g.fillStyle(color.carStripe, 1);
    g.fillRoundedRect(-w + b, -0.52 * h, width - 2 * b, stripeH, Math.min(stripeH * 0.5, this.chassisCornerPx));
  }

  /** Steel cabin (rear-biased, raked windshield) + side/windshield glass. */
  private paintCabin(w: number, h: number): void {
    const g = this.graphics;
    const roofY = -1.86 * h; // roof height above chassis centre
    const baseY = -0.46 * h; // cabin base sits just inside the body top
    const cabin: Vec2[] = [
      { x: -0.66 * w, y: baseY }, // rear-bottom (C-pillar base)
      { x: -0.52 * w, y: roofY }, // rear-top
      { x: 0.26 * w, y: roofY }, // front-top (wider greenhouse)
      { x: 0.6 * w, y: baseY }, // windshield base (front) — forward rake
    ];
    const cabinBorder = Math.max(1, Math.min(strokeToken.game, h * 0.32));
    borderedPolygon(g, cabin, { fill: color.carRoof, border: color.inkBorder, borderWidth: cabinBorder });
    // Glass: a large side window + a raked windshield, split by an A-pillar gap.
    const glassTop = roofY + h * 0.22;
    const glassBot = baseY - h * 0.16;
    this.fillQuad(
      { x: -0.5 * w, y: glassTop },
      { x: 0.02 * w, y: glassTop },
      { x: -0.01 * w, y: glassBot },
      { x: -0.46 * w, y: glassBot },
      color.carGlass,
    );
    this.fillQuad(
      { x: 0.15 * w, y: glassTop },
      { x: 0.24 * w, y: glassTop },
      { x: 0.53 * w, y: glassBot },
      { x: 0.44 * w, y: glassBot },
      color.carGlass,
    );
  }

  /** Front headlight (pale glow) + rear tail-light dot. */
  private paintLights(w: number, h: number): void {
    const g = this.graphics;
    const rHead = Math.max(1.5, h * 0.34);
    borderedCircle(g, 0.86 * w, -0.36 * h, rHead, {
      fill: color.carHeadlight,
      border: color.inkBorder,
      borderWidth: Math.max(1, h * 0.09),
    });
    g.fillStyle(color.carTailLight, 1);
    g.fillCircle(-0.9 * w, -0.24 * h, Math.max(1.2, h * 0.22));
  }

  /** Fill a convex quad from two triangles (fill-only, borderless). */
  private fillQuad(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2, fill: number): void {
    const g = this.graphics;
    g.fillStyle(fill, 1);
    g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    g.fillTriangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y);
  }

  /** Alloy wheel: dark tyre + silver rim + 5 rotating spokes + body-colour hub. */
  private drawWheel(pose: Pose): void {
    const g = this.graphics;
    const px = this.transform.point(pose);
    const r = this.wheelRadiusPx;
    g.save();
    g.translateCanvas(px.x, px.y);
    g.rotateCanvas(-pose.angle);
    // Tyre (dark disc) then silver rim face inset — leaves a tyre band.
    g.fillStyle(color.inkBorder, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(color.carRim, 1);
    g.fillCircle(0, 0, r * 0.7);
    // 5 dark spokes from hub to rim — fill-only, rotate with the wheel body so
    // spin stays legible (odd count = no 90° visual repeat).
    const spokeCount = 5;
    const spokeW = Math.max(1.5, r * 0.12);
    const hubR = r * 0.16;
    const rimR = r * 0.64;
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      fillThickPolyline(
        g,
        [
          { x: cos * hubR, y: sin * hubR },
          { x: cos * rimR, y: sin * rimR },
        ],
        spokeW,
        color.inkBorder,
      );
    }
    // Body-coloured hub cap with a dark rim.
    borderedCircle(g, 0, 0, r * 0.26, {
      fill: color.carBody,
      border: color.inkBorder,
      borderWidth: Math.max(1, r * 0.07),
    });
    g.restore();
  }
}

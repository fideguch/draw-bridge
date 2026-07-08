/**
 * RockRenderer — rolling/falling rock hazards drawn from the live RockHazard
 * bodies (competitor-documented "block the object with your line" mechanic).
 *
 * Reads each rock body transform every frame (interpolated across the fixed step
 * like VehicleRenderer) and draws, FILL-ONLY (no Graphics stroke* — research
 * 08_mobile_quality §3), a chunky slate boulder out of fillShapes primitives:
 * - a dark base disc + mid-grey body (borderedCircle), giving a stone rim,
 * - a ring of lighter angular facets around a darker core, plus a two-line cross
 *   through the centre — all rotated by the ACTUAL body angle so a rolling rock
 *   visibly spins (the wheel-spoke trick, odd facet count = no 90° repeat).
 *
 * Rotation sign: world is y-up, the render frame is y-down (worldToPixel), so a
 * world angle θ renders as screen angle -θ (identical convention to VehicleRenderer).
 *
 * Radii are static (RockHazard.radii); only the poses interpolate. A level with
 * no rocks builds an empty renderer whose update()/destroy() are no-ops.
 */

import type Phaser from 'phaser';
import type { RockHazard } from '@engine/physics/RockHazard';
import { borderedCircle, fillThickPolyline, type Vec2 } from '@render/ui/fillShapes';
import { color } from '@render/ui/theme';
import { readBodyPose } from './bodyPose';
import { StepInterpolator, type Pose } from './StepInterpolator';
import type { WorldToPixel } from './worldToPixel';

export interface RockRendererOptions {
  readonly depth?: number;
}

/** Facet ring count — odd so a spinning rock never reads as 90°-symmetric. */
const FACET_COUNT = 7;

export class RockRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hazard: RockHazard;
  private readonly transform: WorldToPixel;
  private readonly interpolator = new StepInterpolator();
  /** Per-rock radius in px, same order as hazard.bodyIds. */
  private readonly radiiPx: readonly number[];

  constructor(scene: Phaser.Scene, hazard: RockHazard, transform: WorldToPixel, options: RockRendererOptions = {}) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.hazard = hazard;
    this.transform = transform;
    this.radiiPx = hazard.radii.map((r) => transform.length(r));
  }

  update(alpha: number): void {
    if (this.hazard.count === 0) {
      return;
    }
    const poses = this.interpolator.sample(alpha, () => this.readPoses());
    this.graphics.clear();
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      const radiusPx = this.radiiPx[i];
      if (pose === undefined || radiusPx === undefined) {
        continue;
      }
      this.drawRock(pose, radiusPx);
    }
  }

  /** Forget interpolation history on attempt restart (fresh renderer usually). */
  reset(): void {
    this.interpolator.reset();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private readPoses(): Pose[] {
    return this.hazard.bodyIds.map(readBodyPose);
  }

  /** One boulder: dark rim + grey body + rotating facet ring + core cross. */
  private drawRock(pose: Pose, r: number): void {
    const g = this.graphics;
    const px = this.transform.point(pose);
    g.save();
    g.translateCanvas(px.x, px.y);
    g.rotateCanvas(-pose.angle);
    // Dark base disc + mid-grey body (stone rim).
    borderedCircle(g, 0, 0, r, {
      fill: color.rockFill,
      border: color.rockDark,
      borderWidth: Math.max(1.5, r * 0.14),
    });
    // Lighter angular facets around a darker core — a ring of stubby wedges.
    const facetW = Math.max(1.5, r * 0.16);
    const innerR = r * 0.24;
    const outerR = r * 0.72;
    for (let i = 0; i < FACET_COUNT; i++) {
      const a = (i / FACET_COUNT) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      fillThickPolyline(
        g,
        [
          { x: cos * innerR, y: sin * innerR },
          { x: cos * outerR, y: sin * outerR },
        ],
        facetW,
        color.rockLight,
      );
    }
    // Darker core cross so rotation stays legible even on small rocks.
    const cross: Vec2[] = [
      { x: -r * 0.34, y: 0 },
      { x: r * 0.34, y: 0 },
    ];
    fillThickPolyline(g, cross, Math.max(1.5, r * 0.12), color.rockDark);
    fillThickPolyline(
      g,
      [
        { x: 0, y: -r * 0.34 },
        { x: 0, y: r * 0.34 },
      ],
      Math.max(1.5, r * 0.12),
      color.rockDark,
    );
    // Dark centre pip.
    g.fillStyle(color.rockDark, 1);
    g.fillCircle(0, 0, Math.max(1.5, r * 0.16));
    g.restore();
  }
}

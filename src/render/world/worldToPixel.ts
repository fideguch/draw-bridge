/**
 * worldToPixel — the one coordinate contract every render module shares (T046-T048).
 *
 * The engine's physics world is metres, y-UP (gravity -10). Phaser draws in
 * pixels, y-DOWN. This maps world metres -> "world pixels" (still a world-space
 * quantity, NOT screen space): a Phaser Camera — driven by CameraDirector —
 * turns world pixels into screen pixels via scroll/zoom/rotation. Splitting the
 * flip+scale (here, deterministic, pure) from the follow/shake (camera) keeps
 * both trivially reasoned about.
 *
 *   px.x = originX + worldX * pixelsPerMeter
 *   px.y = originY - worldY * pixelsPerMeter          // y-UP -> y-DOWN flip
 *
 * Every world renderer plots at these world-pixel coordinates; StrokeInput uses
 * the inverse (`toWorld`) to turn a camera-transformed pointer back into the
 * metre-space points GameSimulation.commitStroke expects.
 *
 * Pure and dependency-light (only the Point type is imported, type-only) so it
 * is unit-testable headless — no Phaser instantiation.
 */

import type { Point } from '@engine/level/LevelSchema';

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface WorldToPixelOptions {
  /** Metres -> pixels scale (> 0). */
  readonly pixelsPerMeter: number;
  /** World-pixel origin offset X (default 0). */
  readonly originX?: number;
  /** World-pixel origin offset Y (default 0). */
  readonly originY?: number;
}

export class WorldToPixel {
  readonly pixelsPerMeter: number;
  private readonly originX: number;
  private readonly originY: number;

  constructor(options: WorldToPixelOptions) {
    if (!Number.isFinite(options.pixelsPerMeter) || options.pixelsPerMeter <= 0) {
      throw new Error(`WorldToPixel: pixelsPerMeter must be a finite number > 0 (got ${options.pixelsPerMeter})`);
    }
    this.pixelsPerMeter = options.pixelsPerMeter;
    this.originX = options.originX ?? 0;
    this.originY = options.originY ?? 0;
  }

  /** World metre X -> world-pixel X. */
  x(worldX: number): number {
    return this.originX + worldX * this.pixelsPerMeter;
  }

  /** World metre Y -> world-pixel Y (y-up -> y-down flip). */
  y(worldY: number): number {
    return this.originY - worldY * this.pixelsPerMeter;
  }

  /** World point -> world-pixel point. */
  point(worldPoint: Point): PixelPoint {
    return { x: this.x(worldPoint.x), y: this.y(worldPoint.y) };
  }

  /** A length in metres -> a length in pixels (sign-free scale). */
  length(meters: number): number {
    return meters * this.pixelsPerMeter;
  }

  /** Inverse: world-pixel -> world metres (camera-transformed pointer -> stroke input). */
  toWorld(pixelX: number, pixelY: number): Point {
    return {
      x: (pixelX - this.originX) / this.pixelsPerMeter,
      y: (this.originY - pixelY) / this.pixelsPerMeter,
    };
  }
}

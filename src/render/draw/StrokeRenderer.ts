/**
 * StrokeRenderer — live stroke line rendering (T046, FR-001, game_design §4.1).
 *
 * Draws the in-progress stroke with a Phaser Graphics in WORLD-PIXEL space (via
 * WorldToPixel, so it aligns with the bridge the engine will build from it).
 * Per the design:
 * - width = draw.lineWidthScreenPct of screen width (screen px at zoom 1),
 * - round caps + round joins (approximated by a filled disc at every vertex),
 * - a colorInkBorder underlay (draw.borderWidthPx wider) for the dark outline,
 * - ink line colour shifts with the remaining-ink ZONE (ok / low / critical)
 *   so the line and the ink bar read as the same resource (FR-002).
 *
 * Smoothing is past-only: buildStrokePath Catmull-Rom smooths every vertex
 * except the last two, which stay raw — the tip never lags the finger.
 */

import type Phaser from 'phaser';
import type { Point } from '@engine/level/LevelSchema';
import { color, screen } from '@render/ui/theme';
import { draw } from '@tuning/TuningConstants';
import { buildStrokePath } from './strokeMath';
import { inkZoneColor, inkZoneOf } from '@render/world/renderColors';
import type { PixelPoint, WorldToPixel } from '@render/world/worldToPixel';

export interface StrokeRendererOptions {
  readonly transform: WorldToPixel;
  /** Line width in px. Default draw.lineWidthScreenPct of the screen width. */
  readonly lineWidthPx?: number;
  /** Dark border width per side in px. Default draw.borderWidthPx. */
  readonly borderWidthPx?: number;
  /** Render depth (draw order). */
  readonly depth?: number;
}

export class StrokeRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly transform: WorldToPixel;
  private readonly lineWidthPx: number;
  private readonly borderWidthPx: number;

  constructor(scene: Phaser.Scene, options: StrokeRendererOptions) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.transform = options.transform;
    this.lineWidthPx = options.lineWidthPx ?? (draw.lineWidthScreenPct / 100) * screen.width;
    this.borderWidthPx = options.borderWidthPx ?? draw.borderWidthPx;
  }

  /** Underlying Graphics — PlayScene may reparent / reorder it. */
  get gameObject(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  /**
   * Redraw the stroke for the current points + remaining ink ratio (0..1).
   * Call every frame the stroke changes; pass the live points array.
   */
  redraw(worldPoints: readonly Point[], remainingInkRatio: number): void {
    this.graphics.clear();
    if (worldPoints.length === 0) {
      return;
    }
    const inkColor = inkZoneColor(inkZoneOf(remainingInkRatio));
    const pixels = buildStrokePath(worldPoints).map((p) => this.transform.point(p));
    const first = pixels[0];
    if (first === undefined) {
      return;
    }
    if (pixels.length === 1) {
      // A single tap renders as a dot (border disc + ink disc).
      this.graphics.fillStyle(color.inkBorder, 1);
      this.graphics.fillCircle(first.x, first.y, this.lineWidthPx / 2 + this.borderWidthPx);
      this.graphics.fillStyle(inkColor, 1);
      this.graphics.fillCircle(first.x, first.y, this.lineWidthPx / 2);
      return;
    }
    this.strokeRoundedPolyline(pixels, this.lineWidthPx + this.borderWidthPx * 2, color.inkBorder);
    this.strokeRoundedPolyline(pixels, this.lineWidthPx, inkColor);
  }

  clear(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  /** Stroke a polyline with round caps + joins (disc at each vertex). */
  private strokeRoundedPolyline(pixels: readonly PixelPoint[], width: number, colorValue: number): void {
    const first = pixels[0];
    if (first === undefined) {
      return;
    }
    this.graphics.lineStyle(width, colorValue, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(first.x, first.y);
    for (let i = 1; i < pixels.length; i++) {
      const point = pixels[i] as PixelPoint;
      this.graphics.lineTo(point.x, point.y);
    }
    this.graphics.strokePath();
    const radius = width / 2;
    this.graphics.fillStyle(colorValue, 1);
    for (const point of pixels) {
      this.graphics.fillCircle(point.x, point.y, radius);
    }
  }
}

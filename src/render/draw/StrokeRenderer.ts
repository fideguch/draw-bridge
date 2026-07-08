/**
 * StrokeRenderer — the LIVE drawn line (FR-001 / game_design §4.1).
 *
 * HOT PATH: redraw() runs on every accepted pointer sample. The naive
 * clear-and-repaint (smoothed spline over all points, quads+discs per vertex)
 * is O(n²) across a stroke and froze the main thread on device once DPR-native
 * sampling tripled the vertex density (2026-07-08 regression). This renderer
 * therefore APPENDS: two persistent Graphics layers (border below, ink above)
 * receive only the new segment(s); the layering keeps the dark border under
 * the ink at every joint without re-painting history.
 *
 * No live smoothing: at ~6 CSS-px sampling the raw polyline is already smooth
 * to the eye, and on commit the solidified bridge takes over rendering.
 * A full repaint happens only when the ink zone (color) changes or the point
 * list shrinks (restart/discard).
 */

import type Phaser from 'phaser';
import type { Point } from '@engine/level/LevelSchema';
import { fillThickPolyline } from '@render/ui/fillShapes';
import { inkZoneColor, inkZoneOf } from '@render/world/renderColors';
import { color, layout } from '@render/ui/theme';
import { draw } from '@tuning/TuningConstants';
import type { WorldToPixel } from '@render/world/worldToPixel';

interface PixelPoint {
  x: number;
  y: number;
}

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
  private readonly borderGfx: Phaser.GameObjects.Graphics;
  private readonly inkGfx: Phaser.GameObjects.Graphics;
  private transform: WorldToPixel;
  private readonly lineWidthPx: number;
  private readonly borderWidthPx: number;
  /** Number of points already painted (append cursor). */
  private paintedCount = 0;
  private lastZoneColor: number | null = null;

  constructor(scene: Phaser.Scene, options: StrokeRendererOptions) {
    this.borderGfx = scene.add.graphics();
    this.inkGfx = scene.add.graphics();
    if (options.depth !== undefined) {
      this.borderGfx.setDepth(options.depth);
      this.inkGfx.setDepth(options.depth + 0.1);
    }
    this.transform = options.transform;
    this.lineWidthPx = options.lineWidthPx ?? (draw.lineWidthScreenPct / 100) * layout.width;
    this.borderWidthPx = options.borderWidthPx ?? layout.ui(draw.borderWidthPx);
  }

  /** Border layer Graphics — PlayScene may reparent / reorder it. */
  get gameObject(): Phaser.GameObjects.Graphics {
    return this.borderGfx;
  }

  /** Swap the metre↔pixel transform (device resize re-frames the world). */
  setTransform(transform: WorldToPixel): void {
    this.transform = transform;
    this.paintedCount = 0; // force full repaint at the new scale
    this.lastZoneColor = null;
  }

  /**
   * Render the stroke for the current points + remaining ink ratio (0..1).
   * Appends new segments only; full repaint on zone change / shrink.
   */
  redraw(worldPoints: readonly Point[], remainingInkRatio: number): void {
    const zoneColor = inkZoneColor(inkZoneOf(remainingInkRatio));
    const hasShrunk = worldPoints.length < this.paintedCount;
    const hasZoneChanged = this.lastZoneColor !== null && zoneColor !== this.lastZoneColor;

    if (worldPoints.length === 0) {
      this.clear();
      return;
    }
    if (hasShrunk || hasZoneChanged || this.lastZoneColor === null) {
      this.repaintAll(worldPoints, zoneColor);
      return;
    }
    this.appendFrom(this.paintedCount, worldPoints, zoneColor);
  }

  clear(): void {
    this.borderGfx.clear();
    this.inkGfx.clear();
    this.paintedCount = 0;
    this.lastZoneColor = null;
  }

  destroy(): void {
    this.borderGfx.destroy();
    this.inkGfx.destroy();
  }

  private repaintAll(worldPoints: readonly Point[], zoneColor: number): void {
    this.borderGfx.clear();
    this.inkGfx.clear();
    this.paintedCount = 0;
    this.lastZoneColor = zoneColor;
    this.appendFrom(0, worldPoints, zoneColor);
  }

  /** Paint points[fromIndex..end] as segments continuing the existing line. */
  private appendFrom(fromIndex: number, worldPoints: readonly Point[], zoneColor: number): void {
    this.lastZoneColor = zoneColor;
    const startIndex = Math.max(0, fromIndex - 1); // reconnect to the last painted vertex
    const slice: PixelPoint[] = [];
    for (let i = startIndex; i < worldPoints.length; i++) {
      slice.push(this.transform.point(worldPoints[i] as Point));
    }
    if (slice.length === 0) {
      return;
    }
    fillThickPolyline(this.borderGfx, slice, this.lineWidthPx + this.borderWidthPx * 2, color.inkBorder);
    fillThickPolyline(this.inkGfx, slice, this.lineWidthPx, zoneColor);
    this.paintedCount = worldPoints.length;
  }
}

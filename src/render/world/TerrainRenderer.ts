/**
 * TerrainRenderer — level terrain polylines as filled ground (T047, FR-015).
 *
 * Each terrain polyline is drawn once (terrain is static) as a solid shape:
 * the surface polyline, extended straight down to killY, is filled with
 * colorTerrainFill; a colorTerrainGrass cap and a colorTerrainStroke outline
 * trace the top edge (ui_design_brief §2 colour-separation map). Extending to
 * killY guarantees the fill covers the visible bottom of the frame regardless
 * of camera scroll.
 *
 * Static: update(alpha) is a no-op, present only for renderer-interface
 * uniformity (constructor / update / destroy).
 */

import type Phaser from 'phaser';
import type { Level } from '@engine/level/LevelSchema';
import { fillThickPolyline } from '@render/ui/fillShapes';
import { color, layout, stroke as strokeToken } from '@render/ui/theme';
import type { PixelPoint, WorldToPixel } from './worldToPixel';

export type TerrainSource = Pick<Level, 'terrain' | 'killY'>;

export interface TerrainRendererOptions {
  readonly depth?: number;
  /** Grass cap thickness in px (ui_design_brief §3.1 "厚さ 6pt"). */
  readonly grassCapPx?: number;
}

/** Grass band width in 390-design px (ui/DPR-scaled at draw time). */
const DEFAULT_GRASS_CAP_PX = 10;

export class TerrainRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    source: TerrainSource,
    transform: WorldToPixel,
    options: TerrainRendererOptions = {},
  ) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.draw(source, transform, options.grassCapPx ?? DEFAULT_GRASS_CAP_PX);
  }

  /** Terrain is static — nothing to interpolate. */
  update(_alpha: number): void {
    // no-op (interface uniformity)
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private draw(source: TerrainSource, transform: WorldToPixel, grassCapPx: number): void {
    // Fill down to well past the canvas bottom: the framing caps the VIEW at a
    // shallow pit depth, so killY can land mid-screen — ending the fill there
    // rendered the terrain as a floating island with sky underneath.
    const killYPixel = Math.max(transform.y(source.killY), layout.height * 2);
    for (const polyline of source.terrain) {
      const topEdge: PixelPoint[] = polyline.map(([x, y]) => transform.point({ x, y }));
      const first = topEdge[0];
      const last = topEdge[topEdge.length - 1];
      if (first === undefined || last === undefined) {
        continue;
      }

      // Filled body: top edge, then straight down to killY on both ends.
      this.graphics.fillStyle(color.terrainFill, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(first.x, first.y);
      for (let i = 1; i < topEdge.length; i++) {
        const point = topEdge[i] as PixelPoint;
        this.graphics.lineTo(point.x, point.y);
      }
      this.graphics.lineTo(last.x, killYPixel);
      this.graphics.lineTo(first.x, killYPixel);
      this.graphics.closePath();
      this.graphics.fillPath();

      // Grass band with a dark outline: paint the dark line WIDER first, then
      // the grass on top — leaves a thin dark rim above and below the green
      // (slope-safe; drawing the thin line second used to cover the grass
      // entirely, so the play terrain read as bare brown vs Home's scenery).
      const grassW = layout.ui(grassCapPx);
      this.strokeEdge(topEdge, grassW + strokeToken.game, color.terrainStroke);
      this.strokeEdge(topEdge, grassW, color.terrainGrass);
    }
  }

  /** Trace the surface edge as a filled thick polyline (fill-only; research §3). */
  private strokeEdge(edge: readonly PixelPoint[], width: number, colorValue: number): void {
    fillThickPolyline(this.graphics, edge, width, colorValue);
  }
}

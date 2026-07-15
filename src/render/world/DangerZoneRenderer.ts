/**
 * DangerZoneRenderer — the level's DangerZone hazard rects (round-9 simplification;
 * designer mandate 2026-07-15 "ゲーム性と関係のない仕様・UIは簡素化" + Figma comments 8/10
 * + hard ban "kill zone = plain red rectangle only", conventions.md BR-012).
 *
 * Each zone (level JSON `dangerZones[]`, v1 AND v2) is drawn as ONE static,
 * opaque red rect with a thin darker-red edge for readability against both
 * terrain and sky — no wash pulse, no scrolling hatch, no spike/spikeDown teeth
 * silhouettes (those pieces of the old hazard visual language are REMOVED
 * game-wide). The `style` tag stays physics-inert and is simply ignored here.
 *
 * Static, matching the TerrainRenderer/FlagRenderer/CoinRenderer contract:
 * update()/destroy() exist only for world-renderer interface uniformity.
 *
 * A level with no dangerZones builds an empty renderer whose update()/destroy()
 * are no-ops.
 */

import type Phaser from 'phaser';
import type { DangerZone } from '@engine/level/LevelSchema';
import { color, layout } from '@render/ui/theme';
import { hazardRender } from '@tuning/TuningConstants';
import type { WorldToPixel } from './worldToPixel';

export interface DangerZoneRendererOptions {
  readonly depth?: number;
}

export class DangerZoneRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    zones: readonly DangerZone[],
    transform: WorldToPixel,
    options: DangerZoneRendererOptions = {},
  ) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.draw(zones, transform);
  }

  /** Static — nothing to animate (interface uniformity). */
  update(_alpha: number): void {
    // no-op
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private draw(zones: readonly DangerZone[], transform: WorldToPixel): void {
    const g = this.graphics;
    const borderPx = layout.ui(hazardRender.zoneBorderPx);
    for (const zone of zones) {
      const x0 = transform.x(zone.x);
      const x1 = transform.x(zone.x + zone.width);
      const y0 = transform.y(zone.y + zone.height); // top edge (higher world y -> smaller pixel y)
      const y1 = transform.y(zone.y); // bottom edge
      const w = x1 - x0;
      const h = y1 - y0;
      // Darker-red edge frame, then the opaque red fill inset so a thin border reads.
      g.fillStyle(color.hazardBorderRed, 1);
      g.fillRect(x0, y0, w, h);
      const inset = Math.min(borderPx, w / 2, h / 2);
      g.fillStyle(color.hazardRed, 1);
      g.fillRect(x0 + inset, y0 + inset, Math.max(0, w - inset * 2), Math.max(0, h - inset * 2));
    }
  }
}

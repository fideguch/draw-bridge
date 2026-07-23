/**
 * PersonRenderer — Person NPC obstacles (round-9 BR-011, level JSON `persons[]`,
 * v2 levels only). Each entry's `{x, y}` is the AABB CENTRE; half-extents come
 * from TuningConstants `person` (halfWidth/halfHeight, ~1.3x1.7m) — the SAME
 * values the engine derives its 'personContact' collision rect from, so the
 * drawn silhouette is exactly the hazard footprint (the CAR, chassis or wheel,
 * touching it fails the attempt; the drawn BridgeChain is unaffected).
 *
 * Deliberately NOT drawn in the reserved hazard-red family (DESIGN.md §4.9 is
 * rock/zone only, designer comment 11): a person reads as a distinct "route
 * around me" obstacle — a high-contrast dark stick figure (head + body + arms +
 * legs) on a light card, pedestrian-sign style, legible on both sky and terrain.
 *
 * Static, matching the TerrainRenderer/FlagRenderer/CoinRenderer contract:
 * update()/destroy() exist only for world-renderer interface uniformity.
 */

import type Phaser from 'phaser';
import type { Person } from '@engine/level/LevelSchema';
import { borderedRoundedRect, fillThickPolyline } from '@render/ui/fillShapes';
import { color, stroke as strokeToken } from '@render/ui/theme';
import { person as personTuning } from '@tuning/TuningConstants';
import type { WorldToPixel } from './worldToPixel';

export interface PersonRendererOptions {
  readonly depth?: number;
}

export class PersonRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    persons: readonly Person[],
    transform: WorldToPixel,
    options: PersonRendererOptions = {},
  ) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    const halfWidthPx = transform.length(personTuning.halfWidth);
    const halfHeightPx = transform.length(personTuning.halfHeight);
    for (const centre of persons) {
      const px = transform.point(centre);
      this.drawPerson(px.x, px.y, halfWidthPx, halfHeightPx);
    }
  }

  /** Static — nothing to animate (interface uniformity). */
  update(_alpha: number): void {
    // no-op
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawPerson(cx: number, cy: number, halfW: number, halfH: number): void {
    const g = this.graphics;
    // Light "sign" card filling the AABB so the dark figure reads on any background.
    const cardRadius = Math.min(halfW, halfH) * 0.3;
    borderedRoundedRect(g, cx - halfW, cy - halfH, halfW * 2, halfH * 2, cardRadius, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: strokeToken.game,
    });

    // Dark stick figure centred in the card: head + torso + arms + legs.
    const limbWidth = Math.max(2, halfW * 0.24);
    const headR = halfH * 0.2;
    const headCy = cy - halfH * 0.6;
    const neckY = headCy + headR;
    const shoulderDropY = neckY + halfH * 0.12;
    const hipY = cy + halfH * 0.15;
    const footY = cy + halfH * 0.75;

    g.fillStyle(color.textPrimary, 1);
    g.fillCircle(cx, headCy, headR);

    fillThickPolyline(g, [{ x: cx, y: neckY }, { x: cx, y: hipY }], limbWidth, color.textPrimary);
    fillThickPolyline(
      g,
      [
        { x: cx - halfW * 0.55, y: shoulderDropY },
        { x: cx, y: neckY },
        { x: cx + halfW * 0.55, y: shoulderDropY },
      ],
      limbWidth,
      color.textPrimary,
    );
    fillThickPolyline(g, [{ x: cx, y: hipY }, { x: cx - halfW * 0.45, y: footY }], limbWidth, color.textPrimary);
    fillThickPolyline(g, [{ x: cx, y: hipY }, { x: cx + halfW * 0.45, y: footY }], limbWidth, color.textPrimary);
  }
}

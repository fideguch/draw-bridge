/**
 * DangerZoneRenderer — draws the level's DangerZone hazard bands (user round-6:
 * "危険帯であることがUIで全くわからなかった。最悪"). Each zone is an axis-aligned
 * rect the CAR must not touch (Judge FailCause 'hazard'); this renderer gives it
 * an unmistakable "danger" visual language modelled on the competitor's hatched
 * hazard band (Draw Bridge L210):
 *   - a translucent red fill wash,
 *   - darker-red 45° diagonal hatch stripes (clipped to the rect),
 *   - a thin red border.
 *
 * FILL-ONLY (no Graphics stroke* — research 08_mobile_quality §3 / fillShapes.ts):
 * the fill, hatch and border are all built from fillRect / fillThickPolyline. The
 * geometry is STATIC (zones never move), so it is drawn ONCE in the constructor;
 * update(alpha) only pulses the whole layer's alpha subtly (a slow breathing
 * pulse off the scene clock) so the band reads as "live danger" without redrawing.
 *
 * A level with no dangerZones builds an empty renderer whose update()/destroy()
 * are no-ops.
 */

import type Phaser from 'phaser';
import type { DangerZone } from '@engine/level/LevelSchema';
import { fillThickPolyline } from '@render/ui/fillShapes';
import { color, layout } from '@render/ui/theme';
import type { WorldToPixel } from './worldToPixel';

export interface DangerZoneRendererOptions {
  readonly depth?: number;
}

/** Translucent red wash alpha (the fill sits under hatch + border). */
const FILL_ALPHA = 0.16;
/** Diagonal hatch spacing in design px (ui-scaled). */
const HATCH_SPACING_PX = 14;
/** Diagonal hatch line width in design px (ui-scaled). */
const HATCH_WIDTH_PX = 3;
/** Border thickness in design px (ui-scaled). */
const BORDER_WIDTH_PX = 2.5;
/** Subtle alpha pulse bounds + period (ms) — "live danger" breathing. */
const PULSE_MIN_ALPHA = 0.8;
const PULSE_MAX_ALPHA = 1;
const PULSE_PERIOD_MS = 1400;

interface PixelRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export class DangerZoneRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly zoneCount: number;

  constructor(
    scene: Phaser.Scene,
    zones: readonly DangerZone[],
    transform: WorldToPixel,
    options: DangerZoneRendererOptions = {},
  ) {
    this.scene = scene;
    this.zoneCount = zones.length;
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    for (const zone of zones) {
      this.drawZone(toPixelRect(zone, transform));
    }
  }

  /** Subtle breathing alpha pulse (geometry is static — nothing else to update). */
  update(_alpha: number): void {
    if (this.zoneCount === 0) {
      return;
    }
    const phase = (this.scene.time.now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0..1..0
    this.graphics.setAlpha(PULSE_MIN_ALPHA + (PULSE_MAX_ALPHA - PULSE_MIN_ALPHA) * wave);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawZone(r: PixelRect): void {
    const g = this.graphics;
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    // Translucent red fill wash.
    g.fillStyle(color.hazardFill, FILL_ALPHA);
    g.fillRect(r.x0, r.y0, w, h);
    // 45° diagonal hatch (x + y = c family), each stripe clipped to the rect.
    const spacing = layout.ui(HATCH_SPACING_PX);
    const stripeW = layout.ui(HATCH_WIDTH_PX);
    const cStart = r.x0 + r.y0;
    const cEnd = r.x1 + r.y1;
    for (let c = cStart; c <= cEnd; c += spacing) {
      const xa = Math.max(r.x0, c - r.y1);
      const xb = Math.min(r.x1, c - r.y0);
      if (xa <= xb) {
        fillThickPolyline(
          g,
          [
            { x: xa, y: c - xa },
            { x: xb, y: c - xb },
          ],
          stripeW,
          color.hazardStripe,
          0.55,
        );
      }
    }
    // Thin red border (closed loop of the four corners, fill-only).
    const bw = layout.ui(BORDER_WIDTH_PX);
    fillThickPolyline(
      g,
      [
        { x: r.x0, y: r.y0 },
        { x: r.x1, y: r.y0 },
        { x: r.x1, y: r.y1 },
        { x: r.x0, y: r.y1 },
        { x: r.x0, y: r.y0 },
      ],
      bw,
      color.hazardBorder,
    );
  }
}

/** World rect (bottom-left anchored, y-up) -> pixel rect (y-down, y0 < y1). */
function toPixelRect(zone: DangerZone, transform: WorldToPixel): PixelRect {
  const x0 = transform.x(zone.x);
  const x1 = transform.x(zone.x + zone.width);
  const y0 = transform.y(zone.y + zone.height); // top edge (higher world y -> smaller pixel y)
  const y1 = transform.y(zone.y); // bottom edge
  return { x0, y0, x1, y1 };
}

/**
 * DangerZoneRenderer — draws the level's DangerZone hazard bands (user round-6:
 * "危険帯であることがUIで全くわからなかった。最悪" / round-7 Discord: "障害物の視認性が
 * 終わってる"). Each zone is an axis-aligned rect the CAR must not touch (Judge
 * FailCause 'hazardContact'). This renderer speaks the RESERVED hazard signal language
 * (DESIGN.md §4.9 — a red/orange family on near-black, used for nothing else):
 *
 *   - a SATURATED red fill wash (hazardRed, high alpha — not the old pale 0.16),
 *   - darker-red 45° diagonal hatch that SCROLLS (a live barber-pole crawl),
 *   - a darker-red border framing the whole band,
 *   - and, when the zone is tagged `style: 'spike' | 'spikeDown'`, a row of
 *     near-black TEETH with a red-tip gradient (redundant shape coding) —
 *     upward saw teeth for a floor spike pit, downward stalactites for a ceiling.
 *
 * FILL-ONLY (no Graphics stroke* — research 08_mobile_quality §3 / fillShapes.ts):
 * wash + border are fillRect / fillThickPolyline; teeth are filled triangles via
 * borderedPolygon. Geometry is redrawn every frame (a handful of zones) so the
 * stripe scroll + wash breathing animate without any texture work. The `style`
 * tag is inert render metadata (the engine collides only the base rect), so it
 * never perturbs determinism.
 *
 * A level with no dangerZones builds an empty renderer whose update()/destroy()
 * are no-ops.
 */

import type Phaser from 'phaser';
import type { DangerStyle, DangerZone } from '@engine/level/LevelSchema';
import { borderedPolygon, fillThickPolyline, type Vec2 } from '@render/ui/fillShapes';
import { color, layout } from '@render/ui/theme';
import { hazardRender } from '@tuning/TuningConstants';
import type { WorldToPixel } from './worldToPixel';

export interface DangerZoneRendererOptions {
  readonly depth?: number;
}

interface ZonePixel {
  /** Top-left / bottom-right in pixel space (y0 < y1). */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly style: DangerStyle;
  /** Tooth base x-positions (spike/spikeDown) precomputed from width. */
  readonly toothXs: readonly number[];
}

export class DangerZoneRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly zones: readonly ZonePixel[];

  constructor(
    scene: Phaser.Scene,
    zones: readonly DangerZone[],
    transform: WorldToPixel,
    options: DangerZoneRendererOptions = {},
  ) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.zones = zones.map((zone) => toZonePixel(zone, transform));
    // Draw an initial frame so a paused/first frame already reads as danger.
    this.update(0);
  }

  /** Redraw every frame: animate the wash pulse + hatch scroll (fill-only). */
  update(_alpha: number): void {
    if (this.zones.length === 0) {
      return;
    }
    const now = this.scene.time.now;
    const phase = (now % hazardRender.zonePulsePeriodMs) / hazardRender.zonePulsePeriodMs;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0..1..0
    const fillAlpha =
      hazardRender.zoneFillAlphaMin + (hazardRender.zoneFillAlphaMax - hazardRender.zoneFillAlphaMin) * wave;
    const scrollPx = ((now / 1000) * layout.ui(hazardRender.zoneStripeScrollPxPerSec)) % layout.ui(hazardRender.zoneHatchSpacingPx);
    this.graphics.clear();
    for (const zone of this.zones) {
      this.drawZone(zone, fillAlpha, scrollPx);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawZone(z: ZonePixel, fillAlpha: number, scrollPx: number): void {
    const g = this.graphics;
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    // Saturated red wash (breathing alpha).
    g.fillStyle(color.hazardRed, fillAlpha);
    g.fillRect(z.x0, z.y0, w, h);
    // Scrolling 45° diagonal hatch (x + y = c family), each stripe clipped to the rect.
    const spacing = layout.ui(hazardRender.zoneHatchSpacingPx);
    const stripeW = layout.ui(hazardRender.zoneHatchWidthPx);
    const cStart = z.x0 + z.y0 - scrollPx;
    const cEnd = z.x1 + z.y1;
    for (let c = cStart; c <= cEnd; c += spacing) {
      const xa = Math.max(z.x0, c - z.y1);
      const xb = Math.min(z.x1, c - z.y0);
      if (xa <= xb) {
        fillThickPolyline(
          g,
          [
            { x: xa, y: c - xa },
            { x: xb, y: c - xb },
          ],
          stripeW,
          color.hazardRedDeep,
          hazardRender.zoneStripeAlpha,
        );
      }
    }
    // Teeth (redundant shape coding) for spike / spikeDown zones.
    if (z.style === 'spike' || z.style === 'spikeDown') {
      this.drawTeeth(z, h);
    }
    // Darker-red border framing the band (fill-only closed loop).
    const bw = layout.ui(hazardRender.zoneBorderPx);
    fillThickPolyline(
      g,
      [
        { x: z.x0, y: z.y0 },
        { x: z.x1, y: z.y0 },
        { x: z.x1, y: z.y1 },
        { x: z.x0, y: z.y1 },
        { x: z.x0, y: z.y0 },
      ],
      bw,
      color.hazardBorderRed,
    );
  }

  /**
   * A saw row of near-black teeth with a red-tip gradient. `spike` = apexes point
   * UP (floor spikes; base on the band's lower edge y1); `spikeDown` = apexes
   * point DOWN (stalactites; base on the upper edge y0). Two-band gradient (dark
   * base -> deep red -> red tip) approximates the "red tip" spec fill-only.
   */
  private drawTeeth(z: ZonePixel, bandH: number): void {
    const g = this.graphics;
    const isUpward = z.style === 'spike';
    const toothH = bandH * hazardRender.toothHeightFrac;
    const baseY = isUpward ? z.y1 : z.y0;
    const apexDir = isUpward ? -1 : 1; // pixel-y direction of the apex
    const rim = Math.max(1, layout.ui(1));
    const xs = z.toothXs;
    for (let i = 0; i < xs.length - 1; i++) {
      const xL = xs[i] as number;
      const xR = xs[i + 1] as number;
      const xc = (xL + xR) / 2;
      const half = (xR - xL) / 2;
      const apexY = baseY + apexDir * toothH;
      // Full tooth in near-black (a crisp rim separates adjacent teeth + pops on terrain).
      const tooth: Vec2[] = [
        { x: xL, y: baseY },
        { x: xc, y: apexY },
        { x: xR, y: baseY },
      ];
      borderedPolygon(g, tooth, { fill: color.hazardDark, border: color.hazardDark, borderWidth: rim });
      // Red-tip gradient: deep-red upper ~55%, bright-red top toothTipFrac.
      this.drawTip(xc, half, baseY, apexY, apexDir, 0.55, color.hazardRedDeep);
      this.drawTip(xc, half, baseY, apexY, apexDir, hazardRender.toothTipFrac, color.hazardRed);
    }
  }

  /** One similar sub-triangle from the apex covering the top `frac` of a tooth. */
  private drawTip(
    xc: number,
    half: number,
    baseY: number,
    apexY: number,
    apexDir: number,
    frac: number,
    fill: number,
  ): void {
    const cutY = apexY - apexDir * (apexY - baseY) * frac; // cut plane `frac` down from the apex
    const cutHalf = half * frac;
    const tip: Vec2[] = [
      { x: xc, y: apexY },
      { x: xc - cutHalf, y: cutY },
      { x: xc + cutHalf, y: cutY },
    ];
    borderedPolygon(this.graphics, tip, { fill, border: fill, borderWidth: 0.5 });
  }
}

/** World rect -> pixel rect + precomputed tooth x-positions from the style/width. */
function toZonePixel(zone: DangerZone, transform: WorldToPixel): ZonePixel {
  const x0 = transform.x(zone.x);
  const x1 = transform.x(zone.x + zone.width);
  const y0 = transform.y(zone.y + zone.height); // top edge (higher world y -> smaller pixel y)
  const y1 = transform.y(zone.y); // bottom edge
  const style: DangerStyle = zone.style ?? 'zone';
  const toothXs: number[] = [];
  if (style === 'spike' || style === 'spikeDown') {
    // At least 2 teeth; density from world width so tooth size is consistent.
    const count = Math.max(2, Math.round(zone.width * hazardRender.teethPerMeter));
    for (let i = 0; i <= count; i++) {
      toothXs.push(x0 + ((x1 - x0) * i) / count);
    }
  }
  return { x0, y0, x1, y1, style, toothXs };
}

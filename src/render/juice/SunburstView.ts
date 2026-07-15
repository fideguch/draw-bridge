/**
 * SunburstView — the goal "放射光" glow behind the result panel (L8, research 10
 * §3 / §5.2; celebration overhaul 2026-07-08). A ring of golden wedges gives the
 * flat scrim+text result surface the "豪華さ" it lacked, at ≈0 cost: the rays are
 * drawn ONCE (fill-only fillTriangle — no stroke, research 08 §3) into a single
 * Graphics whose local origin is the ray convergence, and left STATIC.
 *
 * Own-eyes note (headless software-WebGL): a large Graphics that is TWEENED (a
 * continuous rotation, or an alpha bloom) rendered blank in that path, and a
 * generateTexture bake was blank too — so this deliberately draws the rays once
 * and never animates the object. Its entrance reads off the scrim fade-in behind
 * it; it is torn down (destroy) when the overlay is dismissed.
 *
 * Presentation only and THEME-FREE: the ray colour is injected (the wiring passes
 * color.star), so this module imports no theme value and pulls Phaser as a
 * TYPE-only import (matching Confetti / StarBurst).
 */

import type Phaser from 'phaser';
import { goal } from '@tuning/TuningConstants';

/** Angular half-width of each ray as a fraction of its slot (chunky gold spokes). */
const RAY_HALF_SLOT_FRACTION = 0.34;

export interface SunburstViewOptions {
  /** Ray fill colour (0xRRGGBB) — the wiring passes color.star. */
  readonly color: number;
  readonly depth?: number;
}

export class SunburstView {
  private readonly scene: Phaser.Scene;
  private readonly options: SunburstViewOptions;
  private graphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, options: SunburstViewOptions) {
    this.scene = scene;
    this.options = options;
  }

  /**
   * Show the sunburst with its convergence at (cx, cy), rays reaching ~`sizePx`/2.
   * Static (see header). Restarts cleanly.
   */
  show(cx: number, cy: number, sizePx: number): void {
    this.destroy();

    const g = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setPosition(cx, cy)
      .setAlpha(goal.sunburstMaxAlpha);
    if (this.options.depth !== undefined) {
      g.setDepth(this.options.depth);
    }
    const r = sizePx / 2;
    g.fillStyle(this.options.color, 1);
    const slot = (Math.PI * 2) / goal.sunburstRayCount;
    const half = slot * RAY_HALF_SLOT_FRACTION;
    // Half-slot tilt so no ray sits perfectly on the horizontal/vertical axis.
    const tilt = slot * 0.5;
    for (let i = 0; i < goal.sunburstRayCount; i++) {
      const a = tilt + i * slot;
      g.fillTriangle(
        0,
        0,
        Math.cos(a - half) * r,
        Math.sin(a - half) * r,
        Math.cos(a + half) * r,
        Math.sin(a + half) * r,
      );
    }
    this.graphics = g;
  }

  destroy(): void {
    if (this.graphics !== null) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}

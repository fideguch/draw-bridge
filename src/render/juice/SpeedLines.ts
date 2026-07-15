/**
 * SpeedLines — the speed-streak overlay shown when the car exceeds 60% of top
 * speed (game_design §4.2 2-10, speedLines.thresholdRatio). Screen-fixed and
 * theme-free (the streak colour is injected); a Graphics of thin horizontal
 * streaks in the outer left/right margins whose alpha rides the over-threshold
 * intensity. Positions are seeded once so the streaks steady rather than flicker;
 * only their alpha animates with speed.
 *
 * `speedLineIntensity` is the pure gate (headless-tested): 0 below the threshold,
 * ramping to 1 at top speed — kept separate so the mapping unit-tests without a
 * scene, matching the juice-primitives precedent.
 */

import type Phaser from 'phaser';
import { clamp } from './cameraMath';

/** Over-threshold intensity in [0,1]: 0 at/below `threshold`, 1 at ratio 1. */
export function speedLineIntensity(speedRatio: number, threshold: number): number {
  if (speedRatio <= threshold || threshold >= 1) {
    return 0;
  }
  return clamp((speedRatio - threshold) / (1 - threshold), 0, 1);
}

interface Streak {
  readonly y: number;
  readonly side: number; // -1 left, +1 right
  readonly len: number;
}

const STREAK_COUNT = 14;
const MARGIN_FRACTION = 0.28; // streaks live in the outer 28% on each side
const MAX_ALPHA = 0.5;
const STREAK_THICKNESS = 2;

export interface SpeedLinesOptions {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly color: number;
  readonly depth?: number;
  readonly rng?: () => number;
}

export class SpeedLines {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly options: SpeedLinesOptions;
  private readonly streaks: Streak[];

  constructor(scene: Phaser.Scene, options: SpeedLinesOptions) {
    this.options = options;
    this.graphics = scene.add.graphics().setScrollFactor(0);
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    const rng = options.rng ?? Math.random;
    const margin = options.widthPx * MARGIN_FRACTION;
    this.streaks = Array.from({ length: STREAK_COUNT }, () => ({
      y: rng() * options.heightPx,
      side: rng() < 0.5 ? -1 : 1,
      len: margin * (0.4 + rng() * 0.6),
    }));
  }

  /** Redraw for `intensity` in [0,1] (0 hides the overlay). */
  update(intensity: number): void {
    this.graphics.clear();
    if (intensity <= 0) {
      return;
    }
    const alpha = clamp(intensity, 0, 1) * MAX_ALPHA;
    this.graphics.fillStyle(this.options.color, alpha);
    const { widthPx } = this.options;
    for (const streak of this.streaks) {
      const x = streak.side < 0 ? 0 : widthPx - streak.len;
      this.graphics.fillRect(x, streak.y, streak.len, STREAK_THICKNESS);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

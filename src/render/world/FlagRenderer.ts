/**
 * FlagRenderer — goal flag with a waving pennant (T047, FR-007, ui_design_brief
 * §2 colour-separation map "ゴール = マゼンタの旗 + ポール + 揺れアニメ").
 *
 * Draws a pole spanning the goalFlag rect height with a colorGoalFlag pennant
 * near the top. The pennant waves with a simple 2-3 frame cycle (the tip snaps
 * between three offsets) — cheap, readable, and matching the flat hyper-casual
 * art direction. update(alpha) advances the wave from scene time.
 */

import type Phaser from 'phaser';
import type { Rect } from '@engine/level/LevelSchema';
import { color, stroke as strokeToken } from '@render/ui/theme';
import type { WorldToPixel } from './worldToPixel';

export interface FlagRendererOptions {
  readonly depth?: number;
  /** Milliseconds per wave frame (3-frame cycle). Default 180. */
  readonly waveFrameMs?: number;
}

const DEFAULT_WAVE_FRAME_MS = 180;
/** Three-frame tip offset pattern (fraction of pennant length). */
const WAVE_OFFSETS = [-0.12, 0, 0.12] as const;

export class FlagRenderer {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly waveFrameMs: number;

  private readonly poleTopX: number;
  private readonly poleTopY: number;
  private readonly poleBaseY: number;
  private readonly pennantLenPx: number;
  private readonly pennantHeightPx: number;

  constructor(scene: Phaser.Scene, goalFlag: Rect, transform: WorldToPixel, options: FlagRendererOptions = {}) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.waveFrameMs = options.waveFrameMs ?? DEFAULT_WAVE_FRAME_MS;

    // Pole on the rect's left edge, from base (y) up to top (y + height).
    const top = transform.point({ x: goalFlag.x, y: goalFlag.y + goalFlag.height });
    this.poleTopX = top.x;
    this.poleTopY = top.y;
    this.poleBaseY = transform.y(goalFlag.y);
    this.pennantLenPx = transform.length(goalFlag.width) * 0.6;
    this.pennantHeightPx = transform.length(goalFlag.height) * 0.28;

    this.redraw(0);
  }

  update(_alpha: number): void {
    this.redraw(this.currentWaveOffset());
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private currentWaveOffset(): number {
    const frame = Math.floor(this.scene.time.now / this.waveFrameMs) % WAVE_OFFSETS.length;
    return (WAVE_OFFSETS[frame] ?? 0) * this.pennantLenPx;
  }

  private redraw(waveOffsetPx: number): void {
    this.graphics.clear();
    // Pole.
    this.graphics.lineStyle(strokeToken.game, color.inkBorder, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(this.poleTopX, this.poleBaseY);
    this.graphics.lineTo(this.poleTopX, this.poleTopY);
    this.graphics.strokePath();
    // Waving magenta pennant hanging from the top of the pole.
    const tipX = this.poleTopX + this.pennantLenPx + waveOffsetPx;
    const tipY = this.poleTopY + this.pennantHeightPx / 2;
    this.graphics.fillStyle(color.goalFlag, 1);
    this.graphics.fillTriangle(
      this.poleTopX,
      this.poleTopY,
      this.poleTopX,
      this.poleTopY + this.pennantHeightPx,
      tipX,
      tipY,
    );
    this.graphics.lineStyle(strokeToken.game, color.inkBorder, 1);
    this.graphics.strokeTriangle(
      this.poleTopX,
      this.poleTopY,
      this.poleTopX,
      this.poleTopY + this.pennantHeightPx,
      tipX,
      tipY,
    );
  }
}

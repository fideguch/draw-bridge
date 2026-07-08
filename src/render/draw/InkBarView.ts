/**
 * InkBarView — HUD ink meter bound to remaining ink (T046, FR-002, SC-003).
 *
 * A screen-fixed pill (setScrollFactor 0) at top-centre (ui_design_brief §6.3,
 * 234×14pt). The fill width tracks the remaining ratio and its colour follows
 * the zone thresholds (game_design §8.3, ui_design_brief §3.1):
 * - > 50%   green  (colorInkBarHigh = uiPrimary)
 * - 20-50%  yellow (colorInkBarMid  = stressMid)
 * - < 20%   red    (colorInkBarLow  = stressHigh) + 300 ms blink
 *
 * playDepletedFeedback() is the empty-ink hook (game_design §4.1 1-5): a
 * 4-6px / 150 ms horizontal shake (ink.depleteShakePx / depleteShakeMs). The
 * accompanying whiff SFX + warning haptic are wired by PlayScene / HapticsRouter
 * (this view owns the visual only, double-coding per NFR-009).
 */

import type Phaser from 'phaser';
import type { InkZone } from '@engine/rules/InkBudget';
import { color, layout, radius as radiusToken, stroke } from '@render/ui/theme';
import { ink } from '@tuning/TuningConstants';
import { inkZoneOf } from '@render/world/renderColors';

/** Design bar dimensions (ui_design_brief §6.3): 234×14pt pill (ui-scaled to game px). */
const DEFAULT_BAR_WIDTH_DESIGN = 234;
const DEFAULT_BAR_HEIGHT_DESIGN = 14;
/** HUD depth above the world, below modals. */
const HUD_DEPTH = 1000;

export interface InkBarViewOptions {
  /** Centre X in screen px. Default screen centre. */
  readonly x?: number;
  /** Centre Y in screen px. Default just under the safe-area top. */
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}

function zoneColor(zone: InkZone): number {
  switch (zone) {
    case 'ok':
      return color.uiPrimary;
    case 'low':
      return color.stressMid;
    case 'critical':
      return color.stressHigh;
  }
}

export class InkBarView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly fillGraphics: Phaser.GameObjects.Graphics;
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly baseX: number;

  constructor(scene: Phaser.Scene, options: InkBarViewOptions = {}) {
    this.scene = scene;
    this.barWidth = options.width ?? layout.ui(DEFAULT_BAR_WIDTH_DESIGN);
    this.barHeight = options.height ?? layout.ui(DEFAULT_BAR_HEIGHT_DESIGN);
    this.baseX = options.x ?? layout.width / 2;
    const y = options.y ?? layout.safe.top + this.barHeight / 2 + layout.ui(24);

    this.container = scene.add.container(this.baseX, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(options.depth ?? HUD_DEPTH);

    const track = scene.add.graphics();
    this.drawTrack(track);
    this.fillGraphics = scene.add.graphics();
    this.container.add(track);
    this.container.add(this.fillGraphics);

    this.update(1);
  }

  /**
   * Bind the bar to a remaining ratio (0..1). `zone` defaults to the ratio-
   * derived zone but may be passed to match the engine's InkBudget.zone exactly.
   * Blinks in the critical zone (300 ms, ink.blinkPeriodMs).
   */
  update(ratio: number, zone?: InkZone): void {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    const activeZone = zone ?? inkZoneOf(clamped);
    const fillColor = zoneColor(activeZone);
    const fillWidth = this.barWidth * clamped;

    this.fillGraphics.clear();
    if (fillWidth > 0) {
      const pillRadius = Math.min(this.barHeight / 2, fillWidth / 2);
      this.fillGraphics.fillStyle(fillColor, 1);
      this.fillGraphics.fillRoundedRect(
        -this.barWidth / 2,
        -this.barHeight / 2,
        fillWidth,
        this.barHeight,
        pillRadius,
      );
    }
    this.fillGraphics.setAlpha(activeZone === 'critical' ? this.blinkAlpha() : 1);
  }

  /** Empty-ink feedback: horizontal shake (game_design §4.1 1-5). */
  playDepletedFeedback(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.x = this.baseX;
    this.scene.tweens.add({
      targets: this.container,
      x: this.baseX + layout.ui(ink.depleteShakePx),
      duration: ink.depleteShakeMs / 6,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.container.x = this.baseX;
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  /** Triangle blink in [0.4, 1] over one ink.blinkPeriodMs cycle. */
  private blinkAlpha(): number {
    const phase = (this.scene.time.now % ink.blinkPeriodMs) / ink.blinkPeriodMs;
    return 0.4 + 0.6 * Math.abs(1 - 2 * phase);
  }

  private drawTrack(track: Phaser.GameObjects.Graphics): void {
    const pillRadius = Math.min(radiusToken.full, this.barHeight / 2);
    track.fillStyle(color.uiSurface, 0.35);
    track.fillRoundedRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, pillRadius);
    track.lineStyle(stroke.ui, color.inkBorder, 1);
    track.strokeRoundedRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, pillRadius);
  }
}

/**
 * InkBarView — the HUD InkGauge bound to remaining ink (FR-002, SC-003;
 * DESIGN.md §4.7 全面REFINE "インクと読める化").
 *
 * The pre-overhaul meter was a thin 234×14 bar that did not read as "ink". This
 * is the DESIGN.md §4.7 complex gauge: an ink-BOTTLE icon + a fatter fill bar
 * (216×18) + a numeral %, screen-fixed (setScrollFactor 0) at top-centre under
 * the level number. Star-threshold ticks (★2/★3) are marked ON the bar — the one
 * ink-visualisation pattern proven in the genre (Happy Glass / Love Balls) — so
 * "stop here for ★3" is legible mid-draw.
 *
 * Zone colour (game_design §8.3):
 * - > 50%   green  (inkBarHigh)
 * - 20-50%  yellow (inkBarMid)
 * - < 20%   red    (inkBarLow) + 300 ms blink
 * The bottle icon + numeral shift to the same zone colour (double-coding, NFR-009).
 *
 * playDepletedFeedback() is the empty-ink hook (game_design §4.1 1-5): a
 * 4-6px / 150 ms horizontal shake (ink.depleteShakePx / depleteShakeMs). The
 * accompanying whiff SFX + warning haptic are wired by PlayScene / HapticsRouter.
 */

import type Phaser from 'phaser';
import type { InkZone } from '@engine/rules/InkBudget';
import { borderedRoundedRect, clampRadius } from '@render/ui/fillShapes';
import { drawIcon } from '@render/ui/icons';
import { color, layout, makeTextStyle, radius as radiusToken, space, stroke, type } from '@render/ui/theme';
import { ink } from '@tuning/TuningConstants';
import { inkZoneOf } from '@render/world/renderColors';

/** Gauge geometry (DESIGN.md §4.7). Design px — ui-scaled to game px. */
const BAR_WIDTH_DESIGN = 216;
const BAR_HEIGHT_DESIGN = 18;
const BOTTLE_SIZE_DESIGN = 22;
const MARKER_SIZE_DESIGN = 10;
/** HUD depth above the world, below modals. */
const HUD_DEPTH = 1000;

export interface InkBarViewOptions {
  /** Centre X in screen px. Default screen centre. */
  readonly x?: number;
  /** Centre Y in screen px. Default just under the safe-area top. */
  readonly y?: number;
  readonly depth?: number;
  /**
   * Star-threshold ticks as REMAINING ratios [0,1] (DESIGN.md §4.7). Typically
   * [star3Ratio, star2Ratio] where a tick lights while remaining ≥ its ratio
   * (i.e. that star is still earnable). PlayScene derives these from the level's
   * star thresholds ÷ effective budget.
   */
  readonly markers?: readonly number[];
}

function zoneColor(zone: InkZone): number {
  switch (zone) {
    case 'ok':
      return color.inkBarHigh;
    case 'low':
      return color.inkBarMid;
    case 'critical':
      return color.inkBarLow;
  }
}

export class InkBarView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bottle: Phaser.GameObjects.Graphics;
  private readonly fillGraphics: Phaser.GameObjects.Graphics;
  private readonly markerGraphics: Phaser.GameObjects.Graphics;
  private readonly percentText: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly bottleSize: number;
  private readonly baseX: number;
  private readonly markers: readonly number[];
  private lastZone: InkZone | null = null;

  constructor(scene: Phaser.Scene, options: InkBarViewOptions = {}) {
    this.scene = scene;
    this.barWidth = layout.ui(BAR_WIDTH_DESIGN);
    this.barHeight = layout.ui(BAR_HEIGHT_DESIGN);
    this.bottleSize = layout.ui(BOTTLE_SIZE_DESIGN);
    this.baseX = options.x ?? layout.width / 2;
    this.markers = options.markers ?? [];
    const y = options.y ?? layout.safe.top + this.barHeight / 2 + layout.ui(28);

    this.container = scene.add.container(this.baseX, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(options.depth ?? HUD_DEPTH);

    const gap = layout.ui(space.space2);
    // Bar centred on the container origin so the digit count never shifts it.
    const track = scene.add.graphics();
    this.drawTrack(track);
    this.fillGraphics = scene.add.graphics();
    this.markerGraphics = scene.add.graphics();

    // Bottle icon to the LEFT of the bar; % numeral to the RIGHT (left-aligned).
    this.bottle = scene.add.graphics();
    this.bottle.setPosition(-this.barWidth / 2 - gap - this.bottleSize / 2, 0);
    this.percentText = scene.add
      .text(this.barWidth / 2 + gap, 0, '100%', makeTextStyle(type.hudNumeral, color.inkBorder))
      .setOrigin(0, 0.5);

    this.container.add([this.bottle, track, this.fillGraphics, this.markerGraphics, this.percentText]);

    this.update(1);
  }

  /**
   * Bind the gauge to a remaining ratio (0..1). `zone` defaults to the ratio-
   * derived zone but may be passed to match the engine's InkBudget.zone exactly.
   * Blinks the fill in the critical zone (300 ms, ink.blinkPeriodMs).
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

    this.drawMarkers(clamped);
    // Numeral stays inkBorder in ALL zones: the zone hues fail WCAG 1.4.11 on
    // the sky, and the bar fill + bottle tint + blink already carry the zone
    // (DESIGN.md §4.7 permits inkBorder色; NFR-009 double-coding is intact).
    this.percentText.setText(`${Math.round(clamped * 100)}%`);
    // Bottle icon shifts to the zone colour (colour double-coding, NFR-009).
    if (activeZone !== this.lastZone) {
      this.lastZone = activeZone;
      this.bottle.clear();
      drawIcon(this.bottle, 'ink', this.bottleSize, { color: fillColor, holeColor: color.uiSurface });
    }
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

  /**
   * Draw ★-threshold ticks on the bar. A tick lights (star colour) while the
   * current remaining ratio is at/above it (that star still earnable), else it
   * sits empty (starEmpty). Small 5-point stars, fill-only (research §3).
   */
  private drawMarkers(currentRatio: number): void {
    this.markerGraphics.clear();
    if (this.markers.length === 0) {
      return;
    }
    const r = layout.ui(MARKER_SIZE_DESIGN) / 2;
    const y = -this.barHeight / 2 - r - layout.ui(1);
    for (const markerRatio of this.markers) {
      const t = Math.min(Math.max(markerRatio, 0), 1);
      const x = -this.barWidth / 2 + this.barWidth * t;
      const isLit = currentRatio >= t;
      fillStar(this.markerGraphics, x, y, r, isLit ? color.star : color.starEmpty);
    }
  }

  /** Triangle blink in [0.4, 1] over one ink.blinkPeriodMs cycle. */
  private blinkAlpha(): number {
    const phase = (this.scene.time.now % ink.blinkPeriodMs) / ink.blinkPeriodMs;
    return 0.4 + 0.6 * Math.abs(1 - 2 * phase);
  }

  private drawTrack(track: Phaser.GameObjects.Graphics): void {
    const pillRadius = clampRadius(radiusToken.full, this.barWidth, this.barHeight);
    borderedRoundedRect(track, -this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, pillRadius, {
      fill: color.uiSurface,
      fillAlpha: 0.4,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });
  }
}

/** A small filled 5-point star (fill-only) for the gauge threshold ticks. */
function fillStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, colorValue: number): void {
  const points: Array<{ x: number; y: number }> = [];
  const inner = r * 0.44;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  g.fillStyle(colorValue, 1);
  g.fillPoints(points as unknown as Phaser.Math.Vector2[], true);
}

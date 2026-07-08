/**
 * CoinCounter.ts — the shared coin-balance pill (ui_design_brief §6.0 コイン残高
 * ピル). Rendered identically on Home / Shop (and later Result) so the single
 * balance reads the same everywhere (FR-018, trust pattern P1).
 *
 * The pill is right-anchored: its right edge stays at the container origin, so
 * a digit-count change never shifts the top-right anchor.
 */

import Phaser from 'phaser';
import { formatCoins } from './format';
import { color, layout, makeTextStyle, radius, space, stroke, type } from './theme';

// Design px (ui_design_brief §6.0) — ui-scaled to game px on read.
const PILL_HEIGHT_DESIGN = 32;
const COIN_RADIUS_DESIGN = 8;

export class CoinCounter extends Phaser.GameObjects.Container {
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly coinIcon: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  /** @param rightX right edge x (screen). @param y vertical center (screen). */
  constructor(scene: Phaser.Scene, rightX: number, y: number, balance: number) {
    super(scene, rightX, y);
    this.pill = scene.add.graphics();
    this.coinIcon = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, formatCoins(balance), makeTextStyle(type.hudNumeral, color.textPrimary))
      .setOrigin(0, 0.5);
    this.add([this.pill, this.coinIcon, this.label]);
    this.redraw();
    scene.add.existing(this);
  }

  setBalance(balance: number): this {
    this.label.setText(formatCoins(balance));
    this.redraw();
    return this;
  }

  private redraw(): void {
    const pad = layout.ui(space.space3);
    const gap = layout.ui(space.space2);
    const coinRadius = layout.ui(COIN_RADIUS_DESIGN);
    const pillHeight = layout.ui(PILL_HEIGHT_DESIGN);
    const textWidth = this.label.width;
    const contentWidth = pad + coinRadius * 2 + gap + textWidth + pad;
    const left = -contentWidth;
    // Clamp the pill radius to half the height (radius.full is ui-scaled huge).
    const pill = Math.min(radius.full, pillHeight / 2);

    this.pill.clear();
    this.pill.fillStyle(color.uiSurface, 1);
    this.pill.fillRoundedRect(left, -pillHeight / 2, contentWidth, pillHeight, pill);
    this.pill.lineStyle(stroke.ui, color.inkBorder, 1);
    this.pill.strokeRoundedRect(left, -pillHeight / 2, contentWidth, pillHeight, pill);

    const coinCenterX = left + pad + coinRadius;
    this.coinIcon.clear();
    this.coinIcon.fillStyle(color.coin, 1);
    this.coinIcon.fillCircle(coinCenterX, 0, coinRadius);
    this.coinIcon.lineStyle(stroke.ui, color.coinStroke, 1);
    this.coinIcon.strokeCircle(coinCenterX, 0, coinRadius);

    this.label.setX(coinCenterX + coinRadius + gap);
  }
}

/**
 * CoinCounter.ts — the shared coin-balance pill (DESIGN.md §4.2 コイン残高ピル).
 * Rendered identically on the Hub / 強化(Upgrade) / clear result so the single
 * balance reads the same everywhere (FR-018, trust pattern P1). NEVER shown on
 * the play HUD (DESIGN.md 原則1 — the play field stays clear).
 *
 * The pill is right-anchored: its right edge stays at the container origin, so
 * a digit-count change never shifts the top-right anchor.
 */

import Phaser from 'phaser';
import { formatCoins } from './format';
import { borderedCircle, borderedRoundedRect, clampRadius } from './fillShapes';
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
    const pill = clampRadius(radius.full, contentWidth, pillHeight);

    this.pill.clear();
    borderedRoundedRect(this.pill, left, -pillHeight / 2, contentWidth, pillHeight, pill, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });

    const coinCenterX = left + pad + coinRadius;
    this.coinIcon.clear();
    borderedCircle(this.coinIcon, coinCenterX, 0, coinRadius, {
      fill: color.coin,
      border: color.coinStroke,
      borderWidth: stroke.ui,
    });

    this.label.setX(coinCenterX + coinRadius + gap);
  }
}

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
import { color, makeTextStyle, radius, space, stroke, type } from './theme';

const PILL_HEIGHT = 32;
const COIN_RADIUS = 8;

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
    const pad = space.space3;
    const gap = space.space2;
    const textWidth = this.label.width;
    const contentWidth = pad + COIN_RADIUS * 2 + gap + textWidth + pad;
    const left = -contentWidth;

    this.pill.clear();
    this.pill.fillStyle(color.uiSurface, 1);
    this.pill.fillRoundedRect(left, -PILL_HEIGHT / 2, contentWidth, PILL_HEIGHT, radius.full);
    this.pill.lineStyle(stroke.ui, color.inkBorder, 1);
    this.pill.strokeRoundedRect(left, -PILL_HEIGHT / 2, contentWidth, PILL_HEIGHT, radius.full);

    const coinCenterX = left + pad + COIN_RADIUS;
    this.coinIcon.clear();
    this.coinIcon.fillStyle(color.coin, 1);
    this.coinIcon.fillCircle(coinCenterX, 0, COIN_RADIUS);
    this.coinIcon.lineStyle(stroke.ui, color.coinStroke, 1);
    this.coinIcon.strokeCircle(coinCenterX, 0, COIN_RADIUS);

    this.label.setX(coinCenterX + COIN_RADIUS + gap);
  }
}

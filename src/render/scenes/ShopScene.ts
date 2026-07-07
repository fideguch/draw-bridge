/**
 * ShopScene — SC-007 アップグレードショップ. Two upgrade axes (インク量 / 車速)
 * with current Lv pips, current→next effect %, and a prominent price button that
 * disables + shows the shortfall when the balance is short (ui_design_brief §6.7,
 * ux_protocol SC-007, FR-019, trust pattern P5). Purchase is immediate, no
 * confirm dialog, double-tap-safe.
 */

import Phaser from 'phaser';
import { economy } from '@tuning/TuningConstants';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { formatCoins } from '@render/ui/format';
import { getServices } from '@render/ui/services';
import type { GameServices, UpgradeAxisId } from '@render/ui/services';
import { color, makeTextStyle, radius, safeArea, screen, space, stroke, type } from '@render/ui/theme';

interface AxisCard {
  readonly axis: UpgradeAxisId;
  readonly label: string;
  readonly perLevelPct: number;
  readonly top: number;
}

const CARD_LEFT = 16;
const CARD_WIDTH = 358;
const CARD_HEIGHT = 180;
const CARD_GAP = 24;
const FIRST_CARD_TOP = 124;

export class ShopScene extends Phaser.Scene {
  private services!: GameServices;
  private coinCounter!: CoinCounter;
  private readonly dynamic: Phaser.GameObjects.GameObject[] = [];
  private isBusy = false;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);

    const topRowY = safeArea.top + space.space4 + 22;
    new Button(this, {
      x: safeArea.margin + 22,
      y: topRowY,
      width: 44,
      height: 44,
      label: '←',
      variant: 'secondary',
      services: this.services,
      onClick: () => this.scene.start('Home'),
    });
    this.add
      .text(safeArea.margin + 66, topRowY, 'ショップ', makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0, 0.5);
    this.coinCounter = new CoinCounter(this, screen.width - safeArea.margin, topRowY, this.services.getBalance());

    this.renderCards();
  }

  private get cards(): readonly AxisCard[] {
    return [
      { axis: 'inkCapacity', label: 'インク量', perLevelPct: economy.inkPerLevelPct, top: FIRST_CARD_TOP },
      { axis: 'engineSpeed', label: '車速', perLevelPct: economy.speedPerLevelPct, top: FIRST_CARD_TOP + CARD_HEIGHT + CARD_GAP },
    ];
  }

  private renderCards(): void {
    for (const object of this.dynamic) {
      object.destroy();
    }
    this.dynamic.length = 0;
    this.coinCounter.setBalance(this.services.getBalance());
    for (const card of this.cards) {
      this.renderCard(card);
    }
  }

  private renderCard(card: AxisCard): void {
    const level = this.services.getUpgradeLevel(card.axis);
    const isMaxed = level >= economy.maxUpgradeLevel;

    const bg = this.add.graphics();
    bg.fillStyle(color.uiSurface, 1);
    bg.fillRoundedRect(CARD_LEFT, card.top, CARD_WIDTH, CARD_HEIGHT, radius.m);
    bg.lineStyle(stroke.ui, color.inkBorder, 1);
    bg.strokeRoundedRect(CARD_LEFT, card.top, CARD_WIDTH, CARD_HEIGHT, radius.m);
    this.track(bg);

    this.track(
      this.add
        .text(CARD_LEFT + space.space4, card.top + 18, card.label, makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(0, 0.5),
    );
    this.renderPips(card, level);

    const current = level * card.perLevelPct;
    const effect = isMaxed
      ? `効果: +${current}%（MAX）`
      : `効果: +${current}% → 次Lv +${(level + 1) * card.perLevelPct}%`;
    this.track(
      this.add
        .text(CARD_LEFT + space.space4, card.top + 78, effect, makeTextStyle(type.body, color.textSecondary))
        .setOrigin(0, 0),
    );

    this.renderPriceButton(card, level, isMaxed);
  }

  private renderPips(card: AxisCard, level: number): void {
    const g = this.add.graphics();
    const pipGap = 20;
    const pipRadius = 6;
    const blockRight = CARD_LEFT + CARD_WIDTH - space.space4;
    const startX = blockRight - (economy.maxUpgradeLevel - 1) * pipGap;
    const y = card.top + 18;
    for (let i = 0; i < economy.maxUpgradeLevel; i += 1) {
      const x = startX + i * pipGap;
      if (i < level) {
        g.fillStyle(color.uiPrimary, 1);
        g.fillCircle(x, y, pipRadius);
      } else {
        g.lineStyle(stroke.ui, color.uiDisabled, 1);
        g.strokeCircle(x, y, pipRadius);
      }
    }
    this.track(g);
    this.track(
      this.add
        .text(startX - space.space3, y, `Lv${level}`, makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(1, 0.5),
    );
  }

  private renderPriceButton(card: AxisCard, level: number, isMaxed: boolean): void {
    const centerX = screen.width / 2;
    const centerY = card.top + 132;
    if (isMaxed) {
      this.track(
        new Button(this, {
          x: centerX,
          y: centerY,
          width: 200,
          height: 52,
          label: 'MAX',
          variant: 'secondary',
          services: this.services,
          onClick: () => undefined,
        }).setEnabled(false),
      );
      return;
    }

    const price = this.services.getUpgradePrice(card.axis) ?? 0;
    const balance = this.services.getBalance();
    const isAffordable = balance >= price;
    const button = new Button(this, {
      x: centerX,
      y: centerY,
      width: 200,
      height: 52,
      label: `◎ ${formatCoins(price)}`,
      variant: 'primary',
      services: this.services,
      onClick: () => void this.buy(card.axis),
    });
    button.setEnabled(isAffordable);
    this.track(button);

    if (!isAffordable) {
      this.track(
        this.add
          .text(centerX, centerY + 34, `あと ${formatCoins(price - balance)}`, makeTextStyle(type.caption, color.uiDanger))
          .setOrigin(0.5),
      );
    }
  }

  /** Buy one level; guarded so a rapid double-tap processes once (FR-019). */
  private async buy(axis: UpgradeAxisId): Promise<void> {
    if (this.isBusy) {
      return;
    }
    this.isBusy = true;
    try {
      await this.services.purchase(axis);
    } finally {
      this.isBusy = false;
    }
    this.renderCards();
  }

  private track(object: Phaser.GameObjects.GameObject): void {
    this.dynamic.push(object);
  }
}

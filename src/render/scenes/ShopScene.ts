/**
 * ShopScene — SC-007 アップグレードショップ. Two upgrade axes (インク量 / 車速)
 * with current Lv pips, current→next effect %, and a prominent price button that
 * disables + shows the shortfall when the balance is short (ui_design_brief §6.7,
 * ux_protocol SC-007, FR-019, trust pattern P5). Purchase is immediate, no
 * confirm dialog, double-tap-safe.
 *
 * DPR-native: cards fill the live width; design offsets/sizes go through
 * `layout.ui()` (research §2.3). Re-anchors on the layout event.
 */

import Phaser from 'phaser';
import { economy } from '@tuning/TuningConstants';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { formatCoins } from '@render/ui/format';
import { getServices } from '@render/ui/services';
import type { GameServices, UpgradeAxisId } from '@render/ui/services';
import { borderedCircle, borderedRoundedRect } from '@render/ui/fillShapes';
import { color, layout, LAYOUT_EVENT, makeTextStyle, margin, radius, space, stroke, type } from '@render/ui/theme';

interface AxisCard {
  readonly axis: UpgradeAxisId;
  readonly label: string;
  readonly perLevelPct: number;
  /** Card top edge in game px. */
  readonly top: number;
}

// Design px (ui_design_brief §6.7) — ui-scaled to game px at use sites.
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

  private ui(n: number): number {
    return layout.ui(n);
  }

  private get cardLeft(): number {
    return this.ui(margin);
  }

  private get cardWidth(): number {
    return layout.width - 2 * this.ui(margin);
  }

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);

    const topRowY = layout.safe.top + this.ui(space.space4 + 22);
    new Button(this, {
      x: layout.safe.left + this.ui(margin + 22),
      y: topRowY,
      width: 44,
      height: 44,
      label: '',
      icon: 'back',
      iconSize: 22,
      variant: 'secondary',
      services: this.services,
      devId: 'shop-back',
      onClick: () => this.scene.start('Home'),
    });
    this.add
      .text(layout.safe.left + this.ui(margin + 66), topRowY, 'ショップ', makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0, 0.5);
    this.coinCounter = new CoinCounter(this, layout.width - layout.safe.right - this.ui(margin), topRowY, this.services.getBalance());

    this.renderCards();
    this.subscribeLayout();
  }

  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart();
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  private get cards(): readonly AxisCard[] {
    const firstTop = layout.safe.top + this.ui(FIRST_CARD_TOP - 47);
    const stride = this.ui(CARD_HEIGHT + CARD_GAP);
    return [
      { axis: 'inkCapacity', label: 'インク量', perLevelPct: economy.inkPerLevelPct, top: firstTop },
      { axis: 'engineSpeed', label: '車速', perLevelPct: economy.speedPerLevelPct, top: firstTop + stride },
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
    const cardLeft = this.cardLeft;
    const cardWidth = this.cardWidth;
    const cardHeight = this.ui(CARD_HEIGHT);

    const bg = this.add.graphics();
    borderedRoundedRect(bg, cardLeft, card.top, cardWidth, cardHeight, radius.m, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });
    this.track(bg);

    this.track(
      this.add
        .text(cardLeft + this.ui(space.space4), card.top + this.ui(18), card.label, makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(0, 0.5),
    );
    this.renderPips(card, level);

    const current = level * card.perLevelPct;
    const effect = isMaxed
      ? `効果: +${current}%（MAX）`
      : `効果: +${current}% → 次Lv +${(level + 1) * card.perLevelPct}%`;
    this.track(
      this.add
        .text(cardLeft + this.ui(space.space4), card.top + this.ui(78), effect, makeTextStyle(type.body, color.textSecondary))
        .setOrigin(0, 0),
    );

    this.renderPriceButton(card, level, isMaxed);
  }

  private renderPips(card: AxisCard, level: number): void {
    const g = this.add.graphics();
    const pipGap = this.ui(20);
    const pipRadius = this.ui(6);
    const blockRight = this.cardLeft + this.cardWidth - this.ui(space.space4);
    const startX = blockRight - (economy.maxUpgradeLevel - 1) * pipGap;
    const y = card.top + this.ui(18);
    for (let i = 0; i < economy.maxUpgradeLevel; i += 1) {
      const x = startX + i * pipGap;
      if (i < level) {
        g.fillStyle(color.uiPrimary, 1);
        g.fillCircle(x, y, pipRadius);
      } else {
        // Empty pip: a ring drawn fill-only over the card surface (no strokeCircle).
        borderedCircle(g, x, y, pipRadius, {
          fill: color.uiSurface,
          border: color.uiDisabled,
          borderWidth: stroke.ui,
        });
      }
    }
    this.track(g);
    this.track(
      this.add
        .text(startX - this.ui(space.space3), y, `Lv${level}`, makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(1, 0.5),
    );
  }

  private renderPriceButton(card: AxisCard, level: number, isMaxed: boolean): void {
    const centerX = layout.width / 2;
    const centerY = card.top + this.ui(132);
    if (isMaxed) {
      this.track(
        new Button(this, {
          x: centerX,
          y: centerY,
          width: 200,
          height: 52,
          label: '最大',
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
      label: formatCoins(price),
      icon: 'coin',
      iconSize: 20,
      variant: 'primary',
      services: this.services,
      devId: `shop-buy-${card.axis}`,
      onClick: () => void this.buy(card.axis),
    });
    button.setEnabled(isAffordable);
    this.track(button);

    if (!isAffordable) {
      this.track(
        this.add
          .text(centerX, centerY + this.ui(34), `あと ${formatCoins(price - balance)}`, makeTextStyle(type.caption, color.uiDanger))
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

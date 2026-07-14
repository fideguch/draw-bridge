/**
 * UpgradeScene — SC-007 「強化」 (旧 ShopScene; UL-026, DESIGN.md §6.5).
 *
 * Renamed from "ショップ" to "強化" (2026-07-08) so the coin-only, no-IAP economy
 * (BR-008) is never mistaken for a paid store. Two upgrade axes (インク量 / 車速)
 * as chunky UpgradeCards (DESIGN.md §4.3): axis icon + name, current Lv pips,
 * current→next effect %, and a prominent gold `premium` price button that
 * disables + shows the shortfall when the balance is short. Purchase is immediate,
 * no confirm dialog, double-tap-safe (FR-019).
 *
 * Entry points (Hub / Pause / Clear / Fail) pass `returnScene` (+ optional
 * `returnData`) so back returns to the caller (DESIGN.md §6.5). A `recommendedAxis`
 * (from the Fail "インクを増やす" upsell) tags that card with an おすすめ badge.
 *
 * DPR-native: cards fill the live width; design offsets go through `layout.ui()`.
 */

import Phaser from 'phaser';
import { economy } from '@tuning/TuningConstants';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { formatCoins } from '@render/ui/format';
import { getServices } from '@render/ui/services';
import type { GameServices, UpgradeAxisId } from '@render/ui/services';
import { borderedCircle, borderedRoundedRect } from '@render/ui/fillShapes';
import { drawIcon, type IconName } from '@render/ui/icons';
import { t } from '@render/i18n';
import { color, layout, LAYOUT_EVENT, makeTextStyle, margin, radius, shadowDepthM, space, stroke, type } from '@render/ui/theme';

interface AxisCard {
  readonly axis: UpgradeAxisId;
  readonly label: string;
  readonly icon: IconName;
  readonly perLevelPct: number;
  /** Card top edge in game px. */
  readonly top: number;
}

/** Where to return when the back button is tapped (DESIGN.md §6.5). */
export interface UpgradeSceneData {
  readonly returnScene?: string;
  readonly returnData?: Record<string, unknown>;
  /** Axis to highlight with an おすすめ badge (Fail ink-upsell → 'inkCapacity'). */
  readonly recommendedAxis?: UpgradeAxisId;
}

// Design px (DESIGN.md §4.3/§6.5) — ui-scaled to game px at use sites.
const CARD_HEIGHT = 184;
const CARD_GAP = 24;
const FIRST_CARD_TOP = 124;

export class UpgradeScene extends Phaser.Scene {
  private services!: GameServices;
  private coinCounter!: CoinCounter;
  private readonly dynamic: Phaser.GameObjects.GameObject[] = [];
  private isBusy = false;
  private returnScene = 'Hub';
  private returnData: Record<string, unknown> | undefined;
  private recommendedAxis: UpgradeAxisId | null = null;

  constructor() {
    super('Upgrade');
  }

  init(data: UpgradeSceneData): void {
    this.returnScene = data.returnScene ?? 'Hub';
    this.returnData = data.returnData;
    this.recommendedAxis = data.recommendedAxis ?? null;
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
      size: 'iconM',
      label: '',
      icon: 'back',
      variant: 'secondary',
      services: this.services,
      devId: 'upgrade-back',
      onClick: () => this.goBack(),
    });
    this.add
      .text(layout.safe.left + this.ui(margin + 66), topRowY, t('common.upgrade'), makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0, 0.5);
    this.coinCounter = new CoinCounter(this, layout.width - layout.safe.right - this.ui(margin), topRowY, this.services.getBalance());

    this.renderCards();
    this.subscribeLayout();
  }

  private goBack(): void {
    if (this.returnData !== undefined) {
      this.scene.start(this.returnScene, this.returnData);
    } else {
      this.scene.start(this.returnScene);
    }
  }

  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart({ returnScene: this.returnScene, returnData: this.returnData, recommendedAxis: this.recommendedAxis ?? undefined });
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  private get cards(): readonly AxisCard[] {
    const firstTop = layout.safe.top + this.ui(FIRST_CARD_TOP - 47);
    const stride = this.ui(CARD_HEIGHT + CARD_GAP);
    return [
      { axis: 'inkCapacity', label: t('upgrade.inkAmount'), icon: 'ink', perLevelPct: economy.inkPerLevelPct, top: firstTop },
      { axis: 'engineSpeed', label: t('upgrade.carSpeed'), icon: 'speed', perLevelPct: economy.speedPerLevelPct, top: firstTop + stride },
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

    // Chunky shadow + thick-outlined radiusXl card (DESIGN.md §4.3/§4.6).
    const shadow = this.add.graphics();
    shadow.fillStyle(color.uiSecondaryShadow, 1);
    shadow.fillRoundedRect(cardLeft, card.top + this.ui(shadowDepthM), cardWidth, cardHeight, radius.xl);
    this.track(shadow);

    const bg = this.add.graphics();
    borderedRoundedRect(bg, cardLeft, card.top, cardWidth, cardHeight, radius.xl, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.panel,
    });
    this.track(bg);

    // Header: axis icon + name (left).
    const iconBox = this.ui(28);
    const iconCx = cardLeft + this.ui(space.space4) + iconBox / 2;
    const headerY = card.top + this.ui(28);
    const iconGfx = this.add.graphics().setPosition(iconCx, headerY);
    drawIcon(iconGfx, card.icon, iconBox, { color: color.textPrimary, holeColor: color.uiSurface });
    this.track(iconGfx);
    this.track(
      this.add
        .text(iconCx + iconBox / 2 + this.ui(space.space2), headerY, card.label, makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(0, 0.5),
    );
    this.renderPips(card, level, headerY);

    const current = level * card.perLevelPct;
    const effect = isMaxed
      ? t('upgrade.effectMax', { pct: current })
      : t('upgrade.effectNext', { pct: current, nextPct: (level + 1) * card.perLevelPct });
    this.track(
      this.add
        .text(cardLeft + this.ui(space.space4), card.top + this.ui(82), effect, makeTextStyle(type.label, color.textSecondary))
        .setOrigin(0, 0.5),
    );

    if (this.recommendedAxis === card.axis && !isMaxed) {
      this.renderRecommendedBadge(cardLeft + cardWidth, card.top);
    }

    this.renderPriceButton(card, level, isMaxed);
  }

  private renderPips(card: AxisCard, level: number, y: number): void {
    const g = this.add.graphics();
    const pipGap = this.ui(20);
    const pipRadius = this.ui(6);
    const blockRight = this.cardLeft + this.cardWidth - this.ui(space.space4);
    const startX = blockRight - (economy.maxUpgradeLevel - 1) * pipGap;
    for (let i = 0; i < economy.maxUpgradeLevel; i += 1) {
      const x = startX + i * pipGap;
      if (i < level) {
        g.fillStyle(color.uiPrimary, 1);
        g.fillCircle(x, y, pipRadius);
      } else {
        borderedCircle(g, x, y, pipRadius, { fill: color.uiSurface, border: color.uiDisabled, borderWidth: stroke.ui });
      }
    }
    this.track(g);
    this.track(
      this.add.text(startX - this.ui(space.space3), y, `Lv${level}`, makeTextStyle(type.h2, color.textPrimary)).setOrigin(1, 0.5),
    );
  }

  private renderRecommendedBadge(cardRight: number, cardTop: number): void {
    const badgeW = this.ui(72);
    const badgeH = this.ui(24);
    const bx = cardRight - badgeW + this.ui(space.space2);
    const by = cardTop - badgeH / 2;
    const g = this.add.graphics();
    g.fillStyle(color.uiPremium, 1);
    g.fillRoundedRect(bx, by, badgeW, badgeH, badgeH / 2);
    this.track(g);
    this.track(
      this.add.text(bx + badgeW / 2, by + badgeH / 2, t('common.recommended'), makeTextStyle(type.labelSmall, color.textPrimary)).setOrigin(0.5),
    );
  }

  private renderPriceButton(card: AxisCard, level: number, isMaxed: boolean): void {
    const centerX = layout.width / 2;
    const centerY = card.top + this.ui(136);
    if (isMaxed) {
      this.track(
        new Button(this, {
          x: centerX,
          y: centerY,
          size: 'M',
          label: t('common.max'),
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
      size: 'M',
      label: formatCoins(price),
      icon: 'coin',
      iconSize: 20,
      variant: 'premium',
      services: this.services,
      devId: `upgrade-buy-${card.axis}`,
      onClick: () => void this.buy(card.axis),
    });
    button.setEnabled(isAffordable);
    this.track(button);

    if (!isAffordable) {
      this.track(
        this.add
          .text(centerX, centerY + this.ui(34), t('upgrade.shortBy', { amount: formatCoins(price - balance) }), makeTextStyle(type.caption, color.uiDanger))
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

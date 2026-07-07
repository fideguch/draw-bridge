/**
 * HomeScene — SC-001 タイトル/ホーム. Play (2 taps to gameplay), coin balance,
 * settings + shop entries (ui_design_brief §6.1, ux_protocol SC-001).
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { drawGroundScene } from '@render/ui/scenery';
import { getServices } from '@render/ui/services';
import { appInfo, color, makeTextStyle, safeArea, screen, space, type } from '@render/ui/theme';
import { SAVE_NOTICE_KEY } from './BootScene';
import type { SaveNotice } from '@render/ui/services';

export class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }

  create(): void {
    const services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);
    drawGroundScene(this);

    const topRowY = safeArea.top + space.space4 + 22;

    // settings entry (top-left, 44×44)
    new Button(this, {
      x: safeArea.margin + 22,
      y: topRowY,
      width: 44,
      height: 44,
      label: '⚙',
      variant: 'secondary',
      fontSize: type.h2.size,
      services,
      onClick: () => this.scene.start('Settings'),
    });

    // coin balance (top-right pill) — same value/format as Shop/Result (P1)
    new CoinCounter(this, screen.width - safeArea.margin, topRowY, services.getBalance());

    // wordmark (25% height, centered) — must not contain "Draw Bridge"
    this.add
      .text(screen.width / 2, screen.height * 0.25, appInfo.title, makeTextStyle(type.display, color.textPrimary))
      .setOrigin(0.5);

    // play (280×64, thumb zone) → level select (tap a tile = 2nd tap to play)
    new Button(this, {
      x: screen.width / 2,
      y: screen.height - safeArea.bottom - space.space8 - 32,
      width: 280,
      height: 64,
      label: '▶ あそぶ',
      variant: 'primary',
      services,
      devId: 'home-play',
      onClick: () => this.scene.start('LevelSelect'),
    });

    // shop entry (bottom-left secondary, 132×48)
    new Button(this, {
      x: safeArea.margin + 66,
      y: screen.height - safeArea.bottom - 24,
      width: 132,
      height: 48,
      label: 'ショップ',
      variant: 'secondary',
      services,
      devId: 'home-shop',
      onClick: () => this.scene.start('Shop'),
    });

    this.showSaveNoticeIfAny();
  }

  /** Surface a one-shot corruption-restore notice (FR-021 — never silent). */
  private showSaveNoticeIfAny(): void {
    const notice = this.registry.get(SAVE_NOTICE_KEY) as SaveNotice | undefined;
    if (notice === undefined) {
      return;
    }
    this.registry.remove(SAVE_NOTICE_KEY);
    const message = notice.fullReset
      ? '進行データを復元できませんでした'
      : '一部の進行データを復元できませんでした';
    this.add
      .text(screen.width / 2, screen.height * 0.25 + space.space8, message, makeTextStyle(type.caption, color.uiDanger))
      .setOrigin(0.5);
  }
}

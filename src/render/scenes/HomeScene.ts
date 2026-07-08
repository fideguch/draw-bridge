/**
 * HomeScene — SC-001 タイトル/ホーム. Play (2 taps to gameplay), coin balance,
 * settings + shop entries (ui_design_brief §6.1, ux_protocol SC-001).
 *
 * Layout is DPR-native: positions come from the live `layout` (game px), design
 * offsets/sizes go through `layout.ui()` (research §2.3). あそぶ is the bottom
 * centre button, ショップ sits bottom-left ABOVE it, ⚙ is top-left — the three
 * tap targets never intersect (QG-3). Re-anchors on the layout event (resize).
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { drawGroundScene } from '@render/ui/scenery';
import { getServices } from '@render/ui/services';
import { appInfo, color, layout, LAYOUT_EVENT, makeTextStyle, margin, space, type } from '@render/ui/theme';
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

    const ui = (n: number): number => layout.ui(n);
    const topRowY = layout.safe.top + ui(space.space4 + 22);

    // settings entry (top-left, 44×44)
    new Button(this, {
      x: layout.safe.left + ui(margin + 22),
      y: topRowY,
      width: 44,
      height: 44,
      label: '⚙',
      variant: 'secondary',
      fontSize: type.h2.size,
      services,
      devId: 'home-settings',
      onClick: () => this.scene.start('Settings'),
    });

    // coin balance (top-right pill) — same value/format as Shop/Result (P1)
    new CoinCounter(this, layout.width - layout.safe.right - ui(margin), topRowY, services.getBalance());

    // wordmark (25% height, centered) — must not contain "Draw Bridge"
    this.add
      .text(layout.width / 2, layout.height * 0.25, appInfo.title, makeTextStyle(type.display, color.textPrimary))
      .setOrigin(0.5);

    // play (280×64, thumb zone) → level select (tap a tile = 2nd tap to play)
    const playCenterY = layout.height - layout.safe.bottom - ui(60);
    new Button(this, {
      x: layout.width / 2,
      y: playCenterY,
      width: 280,
      height: 64,
      label: '▶ あそぶ',
      variant: 'primary',
      services,
      devId: 'home-play',
      onClick: () => this.scene.start('LevelSelect'),
    });

    // shop entry (bottom-left secondary, 132×48) — stacked ABOVE あそぶ so the two
    // tap rects never intersect (QG-3: あそぶ/ショップ重なり fix).
    const playTop = playCenterY - ui(32);
    new Button(this, {
      x: layout.safe.left + ui(margin + 66),
      y: playTop - ui(space.space2 + 24),
      width: 132,
      height: 48,
      label: 'ショップ',
      variant: 'secondary',
      services,
      devId: 'home-shop',
      onClick: () => this.scene.start('Shop'),
    });

    this.showSaveNoticeIfAny();
    this.subscribeLayout();
  }

  /** Rebuild the whole scene on a device resize (safe: menu has no live state). */
  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart();
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
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
      .text(layout.width / 2, layout.height * 0.25 + layout.ui(space.space8), message, makeTextStyle(type.caption, color.uiDanger))
      .setOrigin(0.5);
  }
}

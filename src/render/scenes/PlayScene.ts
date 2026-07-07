/**
 * PlayScene — STUB (T045 boundary). Phase 5 replaces this file with the real
 * gameplay scene (load level JSON, build the Engine world, fixed-step drive +
 * render interpolation). For now it only proves routing: it shows the routed
 * level id and a placeholder, with a back exit to level select. Keep < 60 lines.
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import { getServices } from '@render/ui/services';
import { color, makeTextStyle, safeArea, screen, space, type } from '@render/ui/theme';

export class PlayScene extends Phaser.Scene {
  private levelId = 'ch1-l01';

  constructor() {
    super('Play');
  }

  init(data: { readonly levelId?: string }): void {
    this.levelId = data.levelId ?? 'ch1-l01';
  }

  create(): void {
    const services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);

    this.add
      .text(screen.width / 2, screen.height * 0.4, this.levelId, makeTextStyle(type.display, color.textPrimary))
      .setOrigin(0.5);
    this.add
      .text(
        screen.width / 2,
        screen.height * 0.4 + space.space12,
        'Phase 5 で実装予定',
        makeTextStyle(type.body, color.textSecondary),
      )
      .setOrigin(0.5);

    new Button(this, {
      x: safeArea.margin + 22,
      y: safeArea.top + space.space4 + 22,
      width: 44,
      height: 44,
      label: '←',
      variant: 'secondary',
      services,
      onClick: () => this.scene.start('LevelSelect'),
    });
  }
}

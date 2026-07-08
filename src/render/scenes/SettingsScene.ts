/**
 * SettingsScene — SC-008 設定. Sound / haptics toggles (immediate apply +
 * persist), progress reset behind a double-confirm with a type-to-confirm gate,
 * plus credits + version (ui_design_brief §6.8, ux_protocol SC-008, FR-014/020).
 *
 * Type-to-confirm (see resetConfirm.ts): modal 2 asks the player to tap リ→セ→ッ
 * →ト in order from shuffled character buttons; the 実行 button only enables on
 * an exact match. In-canvas taps avoid a DOM-input overlay's letterbox offset
 * and any katakana IME friction, and the matcher is a pure, tested function.
 *
 * DPR-native: rows are anchored below the safe-area top; design offsets/sizes go
 * through `layout.ui()` (research §2.3). Re-anchors on the layout event.
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import { getServices } from '@render/ui/services';
import type { GameServices } from '@render/ui/services';
import {
  RESET_CONFIRM_CHARS,
  RESET_CONFIRM_WORD,
  appendConfirmChar,
  isConfirmComplete,
} from '@render/ui/resetConfirm';
import { Toggle } from '@render/ui/Toggle';
import { borderedRoundedRect, fillLine } from '@render/ui/fillShapes';
import { appInfo, color, layout, LAYOUT_EVENT, makeTextStyle, margin, radius, scrim, space, stroke, type } from '@render/ui/theme';

const MODAL_DEPTH = 100;

export class SettingsScene extends Phaser.Scene {
  private services!: GameServices;
  private readonly modalObjects: Phaser.GameObjects.GameObject[] = [];
  private typedSequence = '';
  private executeButton: Button | null = null;
  private progressText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Settings');
  }

  private ui(n: number): number {
    return layout.ui(n);
  }

  /** Absolute design Y (measured from the 47pt design inset) → game px. */
  private absY(designY: number): number {
    return layout.safe.top + this.ui(designY - 47);
  }

  private get rowLabelX(): number {
    return layout.safe.left + this.ui(margin + space.space2);
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
      devId: 'settings-back',
      onClick: () => this.scene.start('Hub'),
    });
    this.add.text(layout.safe.left + this.ui(margin + 66), topRowY, '設定', makeTextStyle(type.h1, color.textPrimary)).setOrigin(0, 0.5);

    this.buildToggleRow('サウンド', this.absY(180), this.services.isSoundEnabled(), (enabled) => {
      void this.services.setSoundEnabled(enabled);
      if (enabled) {
        this.services.playTap(); // OFF→ON confirm sound (ux_protocol SC-008)
      }
    });
    this.buildToggleRow('ハプティクス', this.absY(240), this.services.isHapticsEnabled(), (enabled) => {
      void this.services.setHapticsEnabled(enabled);
      if (enabled) {
        this.services.uiHaptic(); // OFF→ON confirm vibration
      }
    });

    const divider = this.add.graphics();
    const dividerY = this.absY(292);
    fillLine(
      divider,
      layout.safe.left + this.ui(margin),
      dividerY,
      layout.width - layout.safe.right - this.ui(margin),
      dividerY,
      stroke.ui,
      color.uiDisabled,
    );

    this.add.text(this.rowLabelX, this.absY(330), '進行をリセット', makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0.5);
    new Button(this, {
      x: layout.width - layout.safe.right - this.ui(margin + 80),
      y: this.absY(330),
      size: 'S',
      label: 'リセット',
      variant: 'danger',
      services: this.services,
      onClick: () => this.openConfirm1(),
    });

    this.add.text(this.rowLabelX, this.absY(420), 'クレジット', makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0);
    this.add.text(this.rowLabelX, this.absY(448), appInfo.credits, makeTextStyle(type.caption, color.textSecondary)).setOrigin(0, 0);
    this.add
      .text(this.rowLabelX, this.absY(512), `バージョン ${appInfo.version}`, makeTextStyle(type.caption, color.textSecondary))
      .setOrigin(0, 0);

    this.subscribeLayout();
  }

  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart();
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  private buildToggleRow(label: string, y: number, initial: boolean, onChange: (enabled: boolean) => void): void {
    this.add.text(this.rowLabelX, y, label, makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0.5);
    new Toggle(this, {
      x: layout.width - layout.safe.right - this.ui(margin + 14),
      y,
      initial,
      services: this.services,
      onChange,
    });
  }

  // ── reset double-confirm ────────────────────────────────────────────────────

  private openConfirm1(): void {
    this.closeModal();
    this.addScrim();
    // Card wide enough for two catalog-S buttons (DESIGN.md §4.1 size system).
    this.addCard(this.ui(356), this.absY(220), this.ui(176));
    this.trackModal(
      this.add
        .text(layout.width / 2, this.absY(262), '本当にリセットしますか？', makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      new Button(this, {
        x: layout.width / 2 - this.ui(86),
        y: this.absY(336),
        size: 'S',
        label: 'キャンセル',
        variant: 'secondary',
        services: this.services,
        onClick: () => this.closeModal(),
      }).setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      new Button(this, {
        x: layout.width / 2 + this.ui(86),
        y: this.absY(336),
        size: 'S',
        label: '続ける',
        variant: 'primary',
        services: this.services,
        onClick: () => this.openConfirm2(),
      }).setDepth(MODAL_DEPTH + 1),
    );
  }

  private openConfirm2(): void {
    this.closeModal();
    this.typedSequence = '';
    this.addScrim();
    this.addCard(this.ui(356), this.absY(232), this.ui(356));

    this.trackModal(
      this.add
        .text(layout.width / 2, this.absY(272), '全ての星とコインが消えます', makeTextStyle(type.body, color.uiDanger))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      this.add
        .text(layout.width / 2, this.absY(308), '「リセット」を順にタップ', makeTextStyle(type.caption, color.textSecondary))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );

    this.progressText = this.add
      .text(layout.width / 2, this.absY(344), this.progressLabel(), makeTextStyle(type.h2, color.textPrimary))
      .setOrigin(0.5)
      .setDepth(MODAL_DEPTH + 1);
    this.trackModal(this.progressText);

    this.buildCharButtons(this.absY(400));

    this.trackModal(
      new Button(this, {
        x: layout.width / 2 - this.ui(86),
        y: this.absY(476),
        size: 'S',
        label: 'キャンセル',
        variant: 'secondary',
        services: this.services,
        onClick: () => this.closeModal(),
      }).setDepth(MODAL_DEPTH + 1),
    );
    this.executeButton = new Button(this, {
      x: layout.width / 2 + this.ui(86),
      y: this.absY(476),
      size: 'S',
      label: 'リセット実行',
      variant: 'danger',
      fontSize: type.body.size,
      services: this.services,
      onClick: () => void this.doReset(),
    });
    this.executeButton.setEnabled(false).setDepth(MODAL_DEPTH + 1);
    this.trackModal(this.executeButton);
  }

  private buildCharButtons(y: number): void {
    const shuffled = Phaser.Utils.Array.Shuffle([...RESET_CONFIRM_CHARS]);
    const gap = this.ui(12);
    const buttonSize = this.ui(56);
    const total = shuffled.length * buttonSize + (shuffled.length - 1) * gap;
    const startX = layout.width / 2 - total / 2 + buttonSize / 2;
    shuffled.forEach((char, index) => {
      this.trackModal(
        new Button(this, {
          x: startX + index * (buttonSize + gap),
          y,
          size: 'iconL', // catalog 56×56 (DESIGN.md §4.1) — key-tile shape
          label: char,
          variant: 'secondary',
          fontSize: type.h2.size,
          services: this.services,
          onClick: () => this.onCharTap(char),
        }).setDepth(MODAL_DEPTH + 1),
      );
    });
  }

  private onCharTap(char: string): void {
    this.typedSequence = appendConfirmChar(this.typedSequence, char, RESET_CONFIRM_WORD);
    this.progressText?.setText(this.progressLabel());
    this.executeButton?.setEnabled(isConfirmComplete(this.typedSequence, RESET_CONFIRM_WORD));
  }

  private progressLabel(): string {
    const revealed = Array.from(RESET_CONFIRM_WORD)
      .map((glyph, index) => (index < this.typedSequence.length ? glyph : '＿'))
      .join(' ');
    return revealed;
  }

  private async doReset(): Promise<void> {
    if (!isConfirmComplete(this.typedSequence, RESET_CONFIRM_WORD)) {
      return;
    }
    await this.services.resetProgress();
    this.closeModal();
    this.scene.start('Hub');
  }

  private addScrim(): void {
    const rect = this.add
      .rectangle(layout.width / 2, layout.height / 2, layout.width, layout.height, scrim.color, scrim.alpha)
      .setDepth(MODAL_DEPTH)
      .setInteractive();
    this.trackModal(rect);
  }

  /** @param width @param top @param height all in game px. */
  private addCard(width: number, top: number, height: number): void {
    const card = this.add.graphics().setDepth(MODAL_DEPTH);
    borderedRoundedRect(card, (layout.width - width) / 2, top, width, height, radius.m, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });
    this.trackModal(card);
  }

  private closeModal(): void {
    for (const object of this.modalObjects) {
      object.destroy();
    }
    this.modalObjects.length = 0;
    this.executeButton = null;
    this.progressText = null;
  }

  private trackModal(object: Phaser.GameObjects.GameObject): void {
    this.modalObjects.push(object);
  }
}

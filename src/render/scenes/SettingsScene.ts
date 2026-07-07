/**
 * SettingsScene — SC-008 設定. Sound / haptics toggles (immediate apply +
 * persist), progress reset behind a double-confirm with a type-to-confirm gate,
 * plus credits + version (ui_design_brief §6.8, ux_protocol SC-008, FR-014/020).
 *
 * Type-to-confirm (see resetConfirm.ts): modal 2 asks the player to tap リ→セ→ッ
 * →ト in order from shuffled character buttons; the 実行 button only enables on
 * an exact match. In-canvas taps avoid a DOM-input overlay's letterbox offset
 * and any katakana IME friction, and the matcher is a pure, tested function.
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
import { appInfo, color, makeTextStyle, radius, safeArea, scrim, screen, space, stroke, type } from '@render/ui/theme';

const ROW_LABEL_X = safeArea.margin + space.space2;
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
    this.add.text(safeArea.margin + 66, topRowY, '設定', makeTextStyle(type.h1, color.textPrimary)).setOrigin(0, 0.5);

    this.buildToggleRow('サウンド', 180, this.services.isSoundEnabled(), (enabled) => {
      void this.services.setSoundEnabled(enabled);
      if (enabled) {
        this.services.playTap(); // OFF→ON confirm sound (ux_protocol SC-008)
      }
    });
    this.buildToggleRow('ハプティクス', 240, this.services.isHapticsEnabled(), (enabled) => {
      void this.services.setHapticsEnabled(enabled);
      if (enabled) {
        this.services.uiHaptic(); // OFF→ON confirm vibration
      }
    });

    const divider = this.add.graphics();
    divider.lineStyle(stroke.ui, color.uiDisabled, 1);
    divider.lineBetween(safeArea.margin, 292, screen.width - safeArea.margin, 292);

    this.add.text(ROW_LABEL_X, 330, '進行をリセット', makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0.5);
    new Button(this, {
      x: screen.width - safeArea.margin - 66,
      y: 330,
      width: 132,
      height: 48,
      label: 'リセット',
      variant: 'danger',
      services: this.services,
      onClick: () => this.openConfirm1(),
    });

    this.add.text(ROW_LABEL_X, 420, 'クレジット', makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0);
    this.add.text(ROW_LABEL_X, 448, appInfo.credits, makeTextStyle(type.caption, color.textSecondary)).setOrigin(0, 0);
    this.add
      .text(ROW_LABEL_X, 512, `Version ${appInfo.version}`, makeTextStyle(type.caption, color.textSecondary))
      .setOrigin(0, 0);
  }

  private buildToggleRow(label: string, y: number, initial: boolean, onChange: (enabled: boolean) => void): void {
    this.add.text(ROW_LABEL_X, y, label, makeTextStyle(type.body, color.textPrimary)).setOrigin(0, 0.5);
    new Toggle(this, {
      x: screen.width - safeArea.margin - 30,
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
    this.addCard(300, 220, 176);
    this.trackModal(
      this.add
        .text(screen.width / 2, 262, '本当にリセットしますか？', makeTextStyle(type.h2, color.textPrimary))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      new Button(this, {
        x: screen.width / 2 - 72,
        y: 336,
        width: 120,
        height: 48,
        label: 'キャンセル',
        variant: 'secondary',
        services: this.services,
        onClick: () => this.closeModal(),
      }).setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      new Button(this, {
        x: screen.width / 2 + 72,
        y: 336,
        width: 120,
        height: 48,
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
    this.addCard(340, 232, 356);

    this.trackModal(
      this.add
        .text(screen.width / 2, 272, '全ての星とコインが消えます', makeTextStyle(type.body, color.uiDanger))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );
    this.trackModal(
      this.add
        .text(screen.width / 2, 308, '「リセット」を順にタップ', makeTextStyle(type.caption, color.textSecondary))
        .setOrigin(0.5)
        .setDepth(MODAL_DEPTH + 1),
    );

    this.progressText = this.add
      .text(screen.width / 2, 344, this.progressLabel(), makeTextStyle(type.h2, color.textPrimary))
      .setOrigin(0.5)
      .setDepth(MODAL_DEPTH + 1);
    this.trackModal(this.progressText);

    this.buildCharButtons(400);

    this.trackModal(
      new Button(this, {
        x: screen.width / 2 - 78,
        y: 476,
        width: 120,
        height: 48,
        label: 'キャンセル',
        variant: 'secondary',
        services: this.services,
        onClick: () => this.closeModal(),
      }).setDepth(MODAL_DEPTH + 1),
    );
    this.executeButton = new Button(this, {
      x: screen.width / 2 + 78,
      y: 476,
      width: 120,
      height: 48,
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
    const gap = 12;
    const buttonSize = 56;
    const total = shuffled.length * buttonSize + (shuffled.length - 1) * gap;
    const startX = screen.width / 2 - total / 2 + buttonSize / 2;
    shuffled.forEach((char, index) => {
      this.trackModal(
        new Button(this, {
          x: startX + index * (buttonSize + gap),
          y,
          width: buttonSize,
          height: buttonSize,
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
    this.scene.start('Home');
  }

  private addScrim(): void {
    const rect = this.add
      .rectangle(screen.width / 2, screen.height / 2, screen.width, screen.height, scrim.color, scrim.alpha)
      .setDepth(MODAL_DEPTH)
      .setInteractive();
    this.trackModal(rect);
  }

  private addCard(width: number, top: number, height: number): void {
    const card = this.add.graphics().setDepth(MODAL_DEPTH);
    card.fillStyle(color.uiSurface, 1);
    card.fillRoundedRect((screen.width - width) / 2, top, width, height, radius.m);
    card.lineStyle(stroke.ui, color.inkBorder, 1);
    card.strokeRoundedRect((screen.width - width) / 2, top, width, height, radius.m);
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

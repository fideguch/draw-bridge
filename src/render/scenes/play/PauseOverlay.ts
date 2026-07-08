/**
 * PauseOverlay — the in-play escape hatch (2026-07-08 feedback: "プレイ中に
 * 設定や一覧メニューへ戻る動線がない").
 *
 * A modal scrim + three actions:
 *   つづける   — resume the attempt exactly where it paused
 *   やりなおす — restart the attempt (same as HUD restart)
 *   レベル一覧 — abandon the attempt, back to LevelSelect
 *
 * The overlay owns only its display objects; the SCENE owns the actual pause
 * (PlayScene freezes stepping while `onResume`/`onRetry`/`onLevels` route).
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import type { GameServices } from '@render/ui/services';
import { color, layout, makeTextStyle, radius, scrim, type } from '@render/ui/theme';
import { borderedRoundedRect } from '@render/ui/fillShapes';

export interface PauseOverlayActions {
  readonly onResume: () => void;
  readonly onRetry: () => void;
  readonly onLevels: () => void;
}

const OVERLAY_DEPTH = 1900;
const PANEL_WIDTH_DESIGN = 280;
const BUTTON_WIDTH_DESIGN = 220;
const BUTTON_HEIGHT_DESIGN = 56;
const BUTTON_GAP_DESIGN = 18;

export class PauseOverlay {
  private readonly scene: Phaser.Scene;
  private readonly services: GameServices;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private isShown = false;

  constructor(scene: Phaser.Scene, services: GameServices) {
    this.scene = scene;
    this.services = services;
  }

  get isOpen(): boolean {
    return this.isShown;
  }

  show(actions: PauseOverlayActions): void {
    if (this.isShown) {
      return;
    }
    this.isShown = true;

    const blocker = this.scene.add
      .rectangle(layout.width / 2, layout.height / 2, layout.width, layout.height, scrim.color, scrim.alpha)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive({ useHandCursor: false });

    const panelW = layout.ui(PANEL_WIDTH_DESIGN);
    const buttonCount = 3;
    const panelH =
      layout.ui(BUTTON_HEIGHT_DESIGN) * buttonCount +
      layout.ui(BUTTON_GAP_DESIGN) * (buttonCount + 1) +
      layout.ui(52);
    const cx = layout.width / 2;
    const cy = layout.height / 2;

    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH + 1);
    borderedRoundedRect(panel, cx - panelW / 2, cy - panelH / 2, panelW, panelH, radius.l, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: layout.ui(3),
    });

    const title = this.scene.add
      .text(cx, cy - panelH / 2 + layout.ui(34), 'ポーズ', makeTextStyle({ size: type.h2.size, bold: true }, color.textPrimary))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 2);

    const rows: Array<{ label: string; devId: string; variant: 'primary' | 'secondary'; run: () => void }> = [
      { label: 'つづける', devId: 'pause-resume', variant: 'primary', run: actions.onResume },
      { label: 'やりなおす', devId: 'pause-retry', variant: 'secondary', run: actions.onRetry },
      { label: 'レベル一覧', devId: 'pause-levels', variant: 'secondary', run: actions.onLevels },
    ];
    const firstY = cy - panelH / 2 + layout.ui(52 + BUTTON_GAP_DESIGN) + layout.ui(BUTTON_HEIGHT_DESIGN) / 2;
    const buttons = rows.map((row, index) => {
      const button = new Button(this.scene, {
        x: cx,
        y: firstY + index * layout.ui(BUTTON_HEIGHT_DESIGN + BUTTON_GAP_DESIGN),
        width: BUTTON_WIDTH_DESIGN,
        height: BUTTON_HEIGHT_DESIGN,
        label: row.label,
        variant: row.variant,
        services: this.services,
        devId: row.devId,
        // Defer one tick: the action may tear this overlay down mid-pointerup.
        onClick: () => this.scene.time.delayedCall(0, row.run),
      });
      button.setScrollFactor(0).setDepth(OVERLAY_DEPTH + 2);
      return button;
    });

    this.objects = [blocker, panel, title, ...buttons];
  }

  hide(): void {
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects = [];
    this.isShown = false;
  }

  destroy(): void {
    this.hide();
  }
}

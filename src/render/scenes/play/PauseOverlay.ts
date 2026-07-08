/**
 * PauseOverlay — the in-play escape hatch (2026-07-08 feedback: "プレイ中に
 * 設定や一覧メニューへ戻る動線がない").
 *
 * A modal scrim + a chunky panel (DESIGN.md §4.6/§4.7 PauseSheet) with four
 * actions (size M, catalog components):
 *   つづける   — resume the attempt exactly where it paused (primary)
 *   やりなおす — restart the attempt (same as HUD restart)
 *   強化       — open the Upgrade screen (全画面導線, DESIGN.md §9)
 *   レベル一覧 — abandon the attempt, back to the Hub grid
 *
 * The overlay owns only its display objects; the SCENE owns the actual pause
 * (PlayScene freezes stepping while the actions route).
 */

import Phaser from 'phaser';
import { Button } from '@render/ui/Button';
import type { ButtonVariant } from '@render/ui/Button';
import type { IconName } from '@render/ui/icons';
import type { GameServices } from '@render/ui/services';
import { color, layout, makeTextStyle, radius, scrim, shadowDepthL, stroke, type } from '@render/ui/theme';
import { borderedRoundedRect } from '@render/ui/fillShapes';

export interface PauseOverlayActions {
  readonly onResume: () => void;
  readonly onRetry: () => void;
  readonly onUpgrade: () => void;
  readonly onLevels: () => void;
}

const OVERLAY_DEPTH = 1900;
const PANEL_WIDTH_DESIGN = 288;
const BUTTON_HEIGHT_DESIGN = 52; // size M
const BUTTON_GAP_DESIGN = 18;
const TITLE_BAND_DESIGN = 52;

interface PauseRow {
  readonly label: string;
  readonly devId: string;
  readonly variant: ButtonVariant;
  readonly icon?: IconName;
  readonly run: () => void;
}

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

    const rows: PauseRow[] = [
      { label: 'つづける', devId: 'pause-resume', variant: 'primary', run: actions.onResume },
      { label: 'やりなおす', devId: 'pause-retry', variant: 'secondary', run: actions.onRetry },
      { label: '強化', devId: 'pause-upgrade', variant: 'secondary', icon: 'coin', run: actions.onUpgrade },
      { label: 'レベル一覧', devId: 'pause-levels', variant: 'secondary', run: actions.onLevels },
    ];

    const panelW = layout.ui(PANEL_WIDTH_DESIGN);
    const panelH =
      layout.ui(BUTTON_HEIGHT_DESIGN) * rows.length +
      layout.ui(BUTTON_GAP_DESIGN) * (rows.length + 1) +
      layout.ui(TITLE_BAND_DESIGN);
    const cx = layout.width / 2;
    const cy = layout.height / 2;

    // Chunky panel: dark-tone shadow (depth6) under a thick-outlined radiusXl face.
    const shadow = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH);
    shadow.fillStyle(color.uiSecondaryShadow, 1);
    shadow.fillRoundedRect(cx - panelW / 2, cy - panelH / 2 + layout.ui(shadowDepthL), panelW, panelH, radius.xl);

    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH + 1);
    borderedRoundedRect(panel, cx - panelW / 2, cy - panelH / 2, panelW, panelH, radius.xl, {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.panel,
    });

    const title = this.scene.add
      .text(cx, cy - panelH / 2 + layout.ui(34), 'ポーズ', makeTextStyle(type.h2, color.textPrimary))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 2);

    const firstY = cy - panelH / 2 + layout.ui(TITLE_BAND_DESIGN + BUTTON_GAP_DESIGN) + layout.ui(BUTTON_HEIGHT_DESIGN) / 2;
    const buttons = rows.map((row, index) => {
      const button = new Button(this.scene, {
        x: cx,
        y: firstY + index * layout.ui(BUTTON_HEIGHT_DESIGN + BUTTON_GAP_DESIGN),
        size: 'M',
        label: row.label,
        ...(row.icon !== undefined ? { icon: row.icon, iconSize: 20 } : {}),
        variant: row.variant,
        services: this.services,
        devId: row.devId,
        // Defer one tick: the action may tear this overlay down mid-pointerup.
        onClick: () => this.scene.time.delayedCall(0, row.run),
      });
      button.setScrollFactor(0).setDepth(OVERLAY_DEPTH + 2);
      return button;
    });

    this.objects = [blocker, shadow, panel, title, ...buttons];
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

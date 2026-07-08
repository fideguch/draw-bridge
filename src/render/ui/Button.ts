/**
 * Button.ts — the shared Phaser button (ui_design_brief §3.4 / §6.0 / motion
 * rule 6). One widget for every screen so press feel is identical (P4).
 *
 * - Touch target ≥ 44pt enforced on the hit area regardless of visual size (§4).
 * - Press feedback = hard-shadow collapse + 4pt down-shift (§3.4 shadowButton).
 * - On activate it drives the shared feedback through GameServices: first-gesture
 *   audio unlock, tap SFX, and a light UI haptic (SC-001 "タップ音1種").
 *
 * DPR-native: callers pass POSITION (x/y) in game px (computed from `layout`) and
 * SIZE (width/height/fontSize/cornerRadius) in 390-design units — the button
 * ui-scales those to game px so it renders 1:1 crisp on every device (research §2).
 */

import Phaser from 'phaser';
import { registerDevButton } from '../devhook';
import type { GameServices } from './services';
import { color, layout, makeTextStyle, minTouchTarget, radius, shadowOffsetY, stroke, type } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly services: GameServices;
  readonly variant?: ButtonVariant;
  readonly fontSize?: number;
  readonly cornerRadius?: number;
  /** Stable E2E tap-target id (dev builds only — see src/render/devhook.ts). */
  readonly devId?: string;
}

interface VariantStyle {
  readonly fill: number;
  readonly shadow: number;
  readonly text: number;
  readonly border: number | null;
}

function styleFor(variant: ButtonVariant, isEnabled: boolean): VariantStyle {
  if (!isEnabled) {
    return { fill: color.uiDisabled, shadow: color.uiDisabledShadow, text: color.textInverse, border: null };
  }
  switch (variant) {
    case 'primary':
      return { fill: color.uiPrimary, shadow: color.uiPrimaryShadow, text: color.textPrimary, border: null };
    case 'danger':
      return { fill: color.uiSurface, shadow: color.uiDangerShadow, text: color.uiDanger, border: color.uiDanger };
    case 'secondary':
    default:
      return { fill: color.uiSurface, shadow: color.uiDisabledShadow, text: color.textPrimary, border: color.inkBorder };
  }
}

export class Button extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly options: ButtonOptions;
  private readonly variant: ButtonVariant;
  private readonly corner: number;
  /** Body + hit dimensions + press shift, ui-scaled to game px once at build. */
  private readonly uiWidth: number;
  private readonly uiHeight: number;
  private readonly shadowShift: number;
  private isEnabled = true;
  private isPressed = false;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    this.options = options;
    this.variant = options.variant ?? 'primary';
    // radius.l / radius.m are already ui-scaled (game px); the height threshold
    // compares in design space so the "big button" cutoff is device-independent.
    this.corner =
      options.cornerRadius !== undefined
        ? layout.ui(options.cornerRadius)
        : options.height >= 60
          ? radius.l
          : radius.m;
    this.uiWidth = layout.ui(options.width);
    this.uiHeight = layout.ui(options.height);
    this.shadowShift = layout.ui(shadowOffsetY);

    this.shadow = scene.add.graphics();
    this.bodyGfx = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, options.label, makeTextStyle({ size: options.fontSize ?? type.button.size, bold: true }, color.textPrimary))
      .setOrigin(0.5);
    this.face = scene.add.container(0, 0, [this.bodyGfx, this.label]);
    this.add([this.shadow, this.face]);

    const hitWidth = layout.ui(Math.max(options.width, minTouchTarget));
    const hitHeight = layout.ui(Math.max(options.height, minTouchTarget));
    this.setSize(hitWidth, hitHeight);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerdown', this.onPress, this);
    this.on('pointerup', this.onRelease, this);
    this.on('pointerout', this.onCancel, this);
    this.on('pointerupoutside', this.onCancel, this);

    this.redraw();
    scene.add.existing(this);

    if (import.meta.env.DEV && options.devId) {
      registerDevButton(options.devId, scene, () => ({
        x: this.x - hitWidth / 2,
        y: this.y - hitHeight / 2,
        width: hitWidth,
        height: hitHeight,
      }));
    }
  }

  setEnabled(enabled: boolean): this {
    this.isEnabled = enabled;
    if (enabled) {
      this.setInteractive();
    } else {
      this.disableInteractive();
      this.releaseVisual();
    }
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  private onPress(): void {
    if (!this.isEnabled) {
      return;
    }
    this.isPressed = true;
    this.face.y = this.shadowShift;
    this.shadow.setVisible(false);
  }

  private onRelease(): void {
    if (!this.isEnabled || !this.isPressed) {
      return;
    }
    this.releaseVisual();
    this.options.services.resumeAudio();
    this.options.services.playTap();
    this.options.services.uiHaptic();
    this.options.onClick();
  }

  private onCancel(): void {
    this.releaseVisual();
  }

  private releaseVisual(): void {
    this.isPressed = false;
    this.face.y = 0;
    this.shadow.setVisible(true);
  }

  private redraw(): void {
    const s = styleFor(this.variant, this.isEnabled);
    const w = this.uiWidth;
    const h = this.uiHeight;
    const left = -w / 2;
    const top = -h / 2;

    this.shadow.clear();
    this.shadow.fillStyle(s.shadow, 1);
    this.shadow.fillRoundedRect(left, top + this.shadowShift, w, h, this.corner);

    this.bodyGfx.clear();
    this.bodyGfx.fillStyle(s.fill, 1);
    this.bodyGfx.fillRoundedRect(left, top, w, h, this.corner);
    if (s.border !== null) {
      this.bodyGfx.lineStyle(stroke.ui, s.border, 1);
      this.bodyGfx.strokeRoundedRect(left, top, w, h, this.corner);
    }
    this.label.setColor(makeTextStyle(type.button, s.text).color ?? '#000000');
  }
}

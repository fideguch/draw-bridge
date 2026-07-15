/**
 * Button.ts — the shared Phaser button (DESIGN.md §4.1 / §3.4 / motion rule).
 * One widget for every screen so press feel is identical (P4).
 *
 * SIZE SYSTEM (DESIGN.md §4.1 — kills the pre-overhaul per-screen size chaos):
 * every button declares a `size` preset (L / M / S / iconM / iconL) that fixes
 * its W×H, corner radius, chunky-shadow depth, font + icon size. Explicit
 * width/height remain supported ONLY for the two spec'd exceptions (the result
 * 2-choice M-narrow 148×52 and the settings reset-confirm sub-dialog).
 *
 * VARIANTS (DESIGN.md §4.1): primary (green CTA) / secondary (cream + navy
 * border, the "押せる塊") / premium (gold currency CTA) / danger (red border on
 * white) / ghost (flat text link). Semantic colour is never swapped (原則5).
 *
 * - Touch target ≥ 44pt enforced on the hit area regardless of visual size (§3.5).
 * - Press feedback = chunky-shadow collapse + `depth`pt down-shift (§3.4). Ghost
 *   and disabled render FLAT (no shadow) so "can't lift" reads as "can't press".
 * - On activate it drives the shared feedback through GameServices: first-gesture
 *   audio unlock, tap SFX, and a light UI haptic (SC-001 "タップ音1種").
 *
 * DPR-native: callers pass POSITION (x/y) in game px (computed from `layout`) and
 * SIZE in 390-design units — the button ui-scales those to game px so it renders
 * 1:1 crisp on every device (research §2).
 */

import Phaser from 'phaser';
import { registerDevButton } from '../devhook';
import { borderedRoundedRect } from './fillShapes';
import { drawIcon, type IconName } from './icons';
import type { GameServices } from './services';
import { color, layout, makeTextStyle, minTouchTarget, shadowDepthM, stroke, type } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'premium' | 'danger' | 'ghost';

/** Catalog size presets (DESIGN.md §4.1). Values are 390-design px. */
export type ButtonSize = 'L' | 'M' | 'S' | 'iconM' | 'iconL';

interface SizePreset {
  readonly width: number;
  readonly height: number;
  /** Corner radius (design px). */
  readonly radius: number;
  /** Chunky-shadow depth (design px). */
  readonly depth: number;
  /** Label font size (design px); undefined for icon-only presets. */
  readonly font?: number;
  /** Icon box size (design px). */
  readonly icon: number;
}

// Map (not an object literal) so the single-letter L/M/S keys stay legal under
// the naming-convention lint while remaining the public ButtonSize vocabulary.
const SIZE_PRESETS = new Map<ButtonSize, SizePreset>([
  ['L', { width: 280, height: 64, radius: 20, depth: 6, font: 18, icon: 20 }],
  ['M', { width: 220, height: 52, radius: 20, depth: 4, font: 18, icon: 20 }],
  ['S', { width: 160, height: 44, radius: 12, depth: 4, font: 18, icon: 18 }],
  ['iconM', { width: 44, height: 44, radius: 12, depth: 4, icon: 24 }],
  ['iconL', { width: 56, height: 56, radius: 20, depth: 4, icon: 26 }],
]);

/** Design-px gap between a leading icon and its label (0 when icon-only). */
const ICON_LABEL_GAP_DESIGN = 6;

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  /** Catalog size preset (DESIGN.md §4.1) — sets W/H/radius/depth/font/icon. */
  readonly size?: ButtonSize;
  /** Explicit width override (design px). Spec'd exceptions only. */
  readonly width?: number;
  /** Explicit height override (design px). Spec'd exceptions only. */
  readonly height?: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly services: GameServices;
  readonly variant?: ButtonVariant;
  readonly fontSize?: number;
  readonly cornerRadius?: number;
  /** Leading vector icon (fill-only, research §4.2) — replaces glyph labels. */
  readonly icon?: IconName;
  /** Icon box size in design px. Defaults to the preset/font size. */
  readonly iconSize?: number;
  /**
   * Label/icon colour override for the ENABLED state. Needed for ghost buttons
   * placed on a dark scrim, where the default textSecondary would fail the WCAG
   * AA contrast gate (DESIGN.md §3.1). Disabled state keeps the standard style.
   */
  readonly textColor?: number;
  /** Stable E2E tap-target id (dev builds only — see src/render/devhook.ts). */
  readonly devId?: string;
}

interface VariantStyle {
  /** Face fill; null = no fill (ghost). */
  readonly fill: number | null;
  readonly shadow: number;
  readonly text: number;
  readonly border: number | null;
  /** Whether the face lifts on a chunky shadow (false = flat: ghost/disabled). */
  readonly elevated: boolean;
}

function styleFor(variant: ButtonVariant, isEnabled: boolean): VariantStyle {
  if (!isEnabled) {
    // Disabled is FLAT (no lift) + grey fill — "can't press" is shown by shape,
    // not colour alone (DESIGN.md §4.1 / DoD).
    return { fill: color.uiDisabled, shadow: color.uiDisabledShadow, text: color.textInverse, border: null, elevated: false };
  }
  switch (variant) {
    case 'primary':
      return { fill: color.uiPrimary, shadow: color.uiPrimaryShadow, text: color.textPrimary, border: null, elevated: true };
    case 'premium':
      return { fill: color.uiPremium, shadow: color.uiPremiumShadow, text: color.textPrimary, border: null, elevated: true };
    case 'danger':
      return { fill: color.uiSurface, shadow: color.uiDangerShadow, text: color.uiDanger, border: color.uiDanger, elevated: true };
    case 'ghost':
      return { fill: null, shadow: color.uiDisabledShadow, text: color.textSecondary, border: null, elevated: false };
    case 'secondary':
    default:
      return { fill: color.uiSecondary, shadow: color.uiSecondaryShadow, text: color.textPrimary, border: color.inkBorder, elevated: true };
  }
}

export class Button extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  private readonly iconGfx: Phaser.GameObjects.Graphics | null;
  private readonly iconName?: IconName;
  private readonly iconPx: number;
  private readonly face: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly options: ButtonOptions;
  private readonly variant: ButtonVariant;
  private readonly corner: number;
  private readonly fontSizeDesign: number;
  /** Body + hit dimensions + press shift, ui-scaled to game px once at build. */
  private readonly uiWidth: number;
  private readonly uiHeight: number;
  private readonly shadowShift: number;
  private isEnabled = true;
  private isPressed = false;
  private elevated = true;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    this.options = options;
    this.variant = options.variant ?? 'primary';
    const preset = options.size !== undefined ? SIZE_PRESETS.get(options.size) ?? null : null;
    const widthDesign = options.width ?? preset?.width ?? 220;
    const heightDesign = options.height ?? preset?.height ?? 52;
    const cornerDesign = options.cornerRadius ?? preset?.radius ?? (heightDesign >= 60 ? 20 : 12);
    const depthDesign = preset?.depth ?? shadowDepthM;
    this.fontSizeDesign = options.fontSize ?? preset?.font ?? type.button.size;

    this.corner = layout.ui(cornerDesign);
    this.uiWidth = layout.ui(widthDesign);
    this.uiHeight = layout.ui(heightDesign);
    this.shadowShift = layout.ui(depthDesign);
    this.iconName = options.icon;
    this.iconPx = layout.ui(options.iconSize ?? preset?.icon ?? this.fontSizeDesign);

    this.shadow = scene.add.graphics();
    this.bodyGfx = scene.add.graphics();
    this.iconGfx = options.icon !== undefined ? scene.add.graphics() : null;
    this.label = scene.add
      .text(0, 0, options.label, makeTextStyle({ size: this.fontSizeDesign, bold: true }, color.textPrimary))
      .setOrigin(0.5);
    const faceChildren: Phaser.GameObjects.GameObject[] = [this.bodyGfx];
    if (this.iconGfx !== null) {
      faceChildren.push(this.iconGfx);
    }
    faceChildren.push(this.label);
    this.face = scene.add.container(0, 0, faceChildren);
    this.add([this.shadow, this.face]);
    this.layoutContents();

    const hitWidth = layout.ui(Math.max(widthDesign, minTouchTarget));
    const hitHeight = layout.ui(Math.max(heightDesign, minTouchTarget));
    this.setSize(hitWidth, hitHeight);
    // Phaser 4 Containers report origin (0.5,0.5) and pointWithinHitArea ADDS
    // displayOrigin (w/2,h/2) to the local point before the contains check, so a
    // centred rect (-w/2,-h/2,w,h) only matched the TOP-LEFT QUADRANT of the
    // button (the 2026-07-08 "buttons don't respond" device bug). A (0,0,w,h)
    // rect covers the full visual bounds exactly after that origin shift.
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, hitWidth, hitHeight),
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
    this.layoutContents();
    return this;
  }

  /** Centre the icon + label group inside the face (icon leads the label). */
  private layoutContents(): void {
    if (this.iconGfx === null) {
      this.label.setOrigin(0.5).setPosition(0, 0);
      return;
    }
    const hasLabel = this.label.text.length > 0;
    const gap = hasLabel ? layout.ui(ICON_LABEL_GAP_DESIGN) : 0;
    const labelWidth = hasLabel ? this.label.width : 0;
    const totalWidth = this.iconPx + gap + labelWidth;
    const leftEdge = -totalWidth / 2;
    this.iconGfx.setPosition(leftEdge + this.iconPx / 2, 0);
    this.label.setOrigin(0, 0.5).setPosition(leftEdge + this.iconPx + gap, 0);
  }

  private onPress(): void {
    if (!this.isEnabled) {
      return;
    }
    this.isPressed = true;
    if (this.elevated) {
      this.face.y = this.shadowShift;
      this.shadow.setVisible(false);
    } else {
      this.face.setAlpha(0.6); // flat variants (ghost) dim instead of sinking
    }
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
    this.face.setAlpha(1);
    this.shadow.setVisible(true);
  }

  private redraw(): void {
    const base = styleFor(this.variant, this.isEnabled);
    const s: VariantStyle =
      this.isEnabled && this.options.textColor !== undefined ? { ...base, text: this.options.textColor } : base;
    this.elevated = s.elevated;
    const w = this.uiWidth;
    const h = this.uiHeight;
    const left = -w / 2;
    const top = -h / 2;

    this.shadow.clear();
    if (s.elevated) {
      this.shadow.fillStyle(s.shadow, 1);
      this.shadow.fillRoundedRect(left, top + this.shadowShift, w, h, this.corner);
    }
    this.shadow.setVisible(s.elevated);

    // Body: ghost draws nothing; borderless variants are a single fill; bordered
    // variants use the double-fill technique (research §3.2) — Phaser 4
    // strokeRoundedRect is broken.
    this.bodyGfx.clear();
    if (s.fill !== null) {
      if (s.border !== null) {
        borderedRoundedRect(this.bodyGfx, left, top, w, h, this.corner, {
          fill: s.fill,
          border: s.border,
          borderWidth: stroke.ui,
        });
      } else {
        this.bodyGfx.fillStyle(s.fill, 1);
        this.bodyGfx.fillRoundedRect(left, top, w, h, this.corner);
      }
    }

    if (this.iconGfx !== null && this.iconName !== undefined) {
      this.iconGfx.clear();
      drawIcon(this.iconGfx, this.iconName, this.iconPx, { color: s.text, holeColor: s.fill ?? color.uiSurface });
    }

    this.label.setColor(makeTextStyle(type.button, s.text).color ?? '#000000');
  }
}

/**
 * Toggle.ts — the settings ON/OFF switch (ui_design_brief §6.8 / SC-008).
 *
 * 51×31pt track with a ≥44pt hit area (§4). Tapping flips state, animates the
 * knob, unlocks audio, and reports the new state via onChange — the scene owns
 * the OFF→ON confirm feedback (sound vs. haptics differ per row, ux_protocol
 * SC-008 feedback table).
 */

import Phaser from 'phaser';
import type { GameServices } from './services';
import { borderedCircle, clampRadius } from './fillShapes';
import { color, layout, radius, stroke } from './theme';

// Design px (ui_design_brief §6.8) — ui-scaled to game px in the constructor.
const TRACK_WIDTH_DESIGN = 51;
const TRACK_HEIGHT_DESIGN = 31;
const KNOB_RADIUS_DESIGN = 12;
const KNOB_TRAVEL_DESIGN = (TRACK_WIDTH_DESIGN - KNOB_RADIUS_DESIGN * 2 - 4) / 2;
const HIT_WIDTH_DESIGN = 60;
const HIT_HEIGHT_DESIGN = 44;

export interface ToggleOptions {
  readonly x: number;
  readonly y: number;
  readonly initial: boolean;
  readonly onChange: (enabled: boolean) => void;
  readonly services: GameServices;
}

export class Toggle extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly options: ToggleOptions;
  // Dimensions ui-scaled to game px once (DPR-crisp — research §2).
  private readonly trackWidth = layout.ui(TRACK_WIDTH_DESIGN);
  private readonly trackHeight = layout.ui(TRACK_HEIGHT_DESIGN);
  private readonly knobTravel = layout.ui(KNOB_TRAVEL_DESIGN);
  private isOn: boolean;

  constructor(scene: Phaser.Scene, options: ToggleOptions) {
    super(scene, options.x, options.y);
    this.options = options;
    this.isOn = options.initial;

    this.track = scene.add.graphics();
    // Fill-only bordered knob (no setStrokeStyle — research §3). Drawn at local
    // (0, 0) so the position tween only moves the graphics' x.
    this.knob = scene.add.graphics();
    borderedCircle(this.knob, 0, 0, layout.ui(KNOB_RADIUS_DESIGN), {
      fill: color.uiSurface,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });
    this.add([this.track, this.knob]);

    const hitWidth = layout.ui(HIT_WIDTH_DESIGN);
    const hitHeight = layout.ui(HIT_HEIGHT_DESIGN);
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
    this.on('pointerup', this.onTap, this);

    this.render(false);
    scene.add.existing(this);
  }

  get value(): boolean {
    return this.isOn;
  }

  private onTap(): void {
    this.options.services.resumeAudio();
    this.isOn = !this.isOn;
    this.render(true);
    this.options.onChange(this.isOn);
  }

  private render(animate: boolean): void {
    // Clamp the pill radius to half the track height: radius.full is ui-scaled to
    // a huge value and Phaser's fillRoundedRect blows the corner arcs out into a
    // full-width cross on a small near-square rect if the radius exceeds it.
    const pill = clampRadius(radius.full, this.trackWidth, this.trackHeight);
    this.track.clear();
    this.track.fillStyle(this.isOn ? color.uiPrimary : color.uiDisabled, 1);
    this.track.fillRoundedRect(-this.trackWidth / 2, -this.trackHeight / 2, this.trackWidth, this.trackHeight, pill);

    const targetX = this.isOn ? this.knobTravel : -this.knobTravel;
    if (animate) {
      this.scene.tweens.add({ targets: this.knob, x: targetX, duration: 120, ease: 'Quad.easeOut' });
    } else {
      this.knob.setX(targetX);
    }
  }
}

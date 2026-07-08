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
  private readonly knob: Phaser.GameObjects.Arc;
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
    this.knob = scene.add
      .circle(0, 0, layout.ui(KNOB_RADIUS_DESIGN), color.uiSurface)
      .setStrokeStyle(stroke.ui, color.inkBorder);
    this.add([this.track, this.knob]);

    const hitWidth = layout.ui(HIT_WIDTH_DESIGN);
    const hitHeight = layout.ui(HIT_HEIGHT_DESIGN);
    this.setSize(hitWidth, hitHeight);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight),
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
    const pill = Math.min(radius.full, this.trackHeight / 2);
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

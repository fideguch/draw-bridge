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
import { color, radius, stroke } from './theme';

const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const KNOB_RADIUS = 12;
const KNOB_TRAVEL = (TRACK_WIDTH - KNOB_RADIUS * 2 - 4) / 2;
const HIT_WIDTH = 60;
const HIT_HEIGHT = 44;

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
  private isOn: boolean;

  constructor(scene: Phaser.Scene, options: ToggleOptions) {
    super(scene, options.x, options.y);
    this.options = options;
    this.isOn = options.initial;

    this.track = scene.add.graphics();
    this.knob = scene.add.circle(0, 0, KNOB_RADIUS, color.uiSurface).setStrokeStyle(stroke.ui, color.inkBorder);
    this.add([this.track, this.knob]);

    this.setSize(HIT_WIDTH, HIT_HEIGHT);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-HIT_WIDTH / 2, -HIT_HEIGHT / 2, HIT_WIDTH, HIT_HEIGHT),
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
    this.track.clear();
    this.track.fillStyle(this.isOn ? color.uiPrimary : color.uiDisabled, 1);
    this.track.fillRoundedRect(-TRACK_WIDTH / 2, -TRACK_HEIGHT / 2, TRACK_WIDTH, TRACK_HEIGHT, radius.full);

    const targetX = this.isOn ? KNOB_TRAVEL : -KNOB_TRAVEL;
    if (animate) {
      this.scene.tweens.add({ targets: this.knob, x: targetX, duration: 120, ease: 'Quad.easeOut' });
    } else {
      this.knob.setX(targetX);
    }
  }
}

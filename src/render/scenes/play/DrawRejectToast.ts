/**
 * DrawRejectToast — brief on-screen text for a pre-launch stroke rejection
 * (round-9 BR-012 `enteredDangerZone` / BR-013 `splitByTerrain`). The stroke
 * already clears itself for instant redraw (PlayScene.commitStroke) and the
 * engine already refunded the ink atomically — this is the ONLY additional
 * feedback: no modal, no launch. Fades in, holds briefly, fades out; safe to
 * re-trigger mid-fade (a fresh call replaces whatever is in flight).
 */

import type Phaser from 'phaser';
import { color, layout, makeTextStyle, type } from '@render/ui/theme';

const FADE_IN_MS = 80;
const HOLD_MS = 700;
const FADE_OUT_MS = 220;

export interface DrawRejectToastOptions {
  readonly y?: number;
  readonly depth?: number;
}

export class DrawRejectToast {
  private readonly scene: Phaser.Scene;
  private readonly text: Phaser.GameObjects.Text;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, options: DrawRejectToastOptions = {}) {
    this.scene = scene;
    this.text = scene.add
      .text(layout.width / 2, options.y ?? layout.safe.top + layout.ui(112), '', makeTextStyle(type.body, color.textPrimary))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
    if (options.depth !== undefined) {
      this.text.setDepth(options.depth);
    }
  }

  /** Show `message`, replacing any toast already in flight. */
  show(message: string): void {
    this.scene.tweens.killTweensOf(this.text);
    this.hideTimer?.remove(false);
    this.text.setText(message).setAlpha(0);
    this.scene.tweens.add({ targets: this.text, alpha: 1, duration: FADE_IN_MS, ease: 'Quad.Out' });
    this.hideTimer = this.scene.time.delayedCall(FADE_IN_MS + HOLD_MS, () => {
      this.scene.tweens.add({ targets: this.text, alpha: 0, duration: FADE_OUT_MS, ease: 'Quad.In' });
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.text);
    this.hideTimer?.remove(false);
    this.hideTimer = null;
    this.text.destroy();
  }
}

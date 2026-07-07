/**
 * CoinRenderer — collectible coins + pickup pop (T047, FR-009, game_design
 * §4.2 2-7).
 *
 * Draws each level coin (colorCoin disc + colorCoinStroke border + inner glyph)
 * at its static world position. When the engine emits coinCollected{index}, the
 * matching coin plays the pickup pop (scale 1.0 -> coin.popScale -> 0 over
 * coin.popMs) and spawns coin.sparkleCount sparkle particles, then hides. The
 * pitch-ladder pickup SOUND is SfxPlayer's job (Phase 6); this is the visual
 * half of the double-coded feedback.
 *
 * Coins are static, so update(alpha) is a no-op; pop/sparkle timing is driven by
 * Phaser tweens on the coinCollected event.
 */

import type Phaser from 'phaser';
import type { Point } from '@engine/level/LevelSchema';
import type { EngineEvents } from '@engine/EngineEvents';
import { color, stroke as strokeToken } from '@render/ui/theme';
import { coin as coinTuning } from '@tuning/TuningConstants';
import type { WorldToPixel } from './worldToPixel';

export interface CoinRendererOptions {
  /** Subscribe to coinCollected for the pickup pop (recommended). */
  readonly events?: EngineEvents;
  readonly depth?: number;
  /** Visual coin radius in px. Default derived from 0.3 m. */
  readonly radiusPx?: number;
}

const DEFAULT_COIN_RADIUS_M = 0.3;

export class CoinRenderer {
  private readonly scene: Phaser.Scene;
  private readonly radiusPx: number;
  private readonly coinObjects: Phaser.GameObjects.Graphics[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(scene: Phaser.Scene, coins: readonly Point[], transform: WorldToPixel, options: CoinRendererOptions = {}) {
    this.scene = scene;
    this.radiusPx = options.radiusPx ?? Math.max(10, transform.length(DEFAULT_COIN_RADIUS_M));

    for (const position of coins) {
      const graphics = scene.add.graphics();
      if (options.depth !== undefined) {
        graphics.setDepth(options.depth);
      }
      const pixel = transform.point(position);
      graphics.setPosition(pixel.x, pixel.y);
      this.drawCoin(graphics);
      this.coinObjects.push(graphics);
    }

    if (options.events !== undefined) {
      this.unsubscribe = options.events.on('coinCollected', (payload) => this.collect(payload.index));
    }
  }

  /** Coins are static — timing is tween-driven on pickup. */
  update(_alpha: number): void {
    // no-op (interface uniformity)
  }

  /** Play the pickup pop for a coin index (idempotent; hides it after). */
  collect(index: number): void {
    const graphics = this.coinObjects[index];
    if (graphics === undefined || !graphics.visible) {
      return;
    }
    this.scene.tweens.add({
      targets: graphics,
      scale: coinTuning.popScale,
      duration: coinTuning.popMs * 0.4,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: graphics,
          scale: 0,
          duration: coinTuning.popMs * 0.6,
          ease: 'Quad.In',
          onComplete: () => graphics.setVisible(false),
        });
      },
    });
    this.spawnSparkles(graphics.x, graphics.y);
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const graphics of this.coinObjects) {
      this.scene.tweens.killTweensOf(graphics);
      graphics.destroy();
    }
    this.coinObjects.length = 0;
  }

  private drawCoin(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(color.coin, 1);
    graphics.fillCircle(0, 0, this.radiusPx);
    graphics.lineStyle(strokeToken.game, color.coinStroke, 1);
    graphics.strokeCircle(0, 0, this.radiusPx);
    // Inner glyph ring so a collected coin reads as a coin at any size.
    graphics.lineStyle(Math.max(2, this.radiusPx * 0.12), color.coinStroke, 1);
    graphics.strokeCircle(0, 0, this.radiusPx * 0.45);
  }

  private spawnSparkles(x: number, y: number): void {
    for (let i = 0; i < coinTuning.sparkleCount; i++) {
      const spark = this.scene.add.graphics();
      spark.setPosition(x, y);
      spark.fillStyle(color.coin, 1);
      spark.fillCircle(0, 0, Math.max(2, this.radiusPx * 0.18));
      const angle = (i / coinTuning.sparkleCount) * Math.PI * 2;
      const reach = this.radiusPx * 2.2;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * reach,
        y: y + Math.sin(angle) * reach,
        alpha: 0,
        duration: coinTuning.popMs,
        ease: 'Quad.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }
}

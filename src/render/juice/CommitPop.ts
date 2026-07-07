/**
 * CommitPop — the line-confirm pop (game_design §4.1 1-6, draw.confirmPopScale /
 * confirmPopMs). On commit the live stroke is cleared and replaced by the
 * physicalised BridgeRenderer; this plays a one-shot bright flash of the just-
 * committed polyline that pops scale 1.0 → confirmPopScale → 1.0 with an
 * ease-out-back and fades out, giving the tactile "コトッ" confirmation the
 * commit SFX + haptic already fire for.
 *
 * The flash Graphics is positioned at the polyline centroid and drawn in centroid-
 * LOCAL coordinates, so the scale tween pops about the line's centre rather than
 * the canvas origin (no drift — the same container-relative trick the star pops
 * use). It self-destroys when the tween ends.
 */

import type Phaser from 'phaser';
import { draw } from '@tuning/TuningConstants';
import type { PixelPoint } from '@render/world/worldToPixel';

export interface CommitPopOptions {
  readonly color: number;
  readonly lineWidthPx: number;
  readonly depth?: number;
}

/** Play the confirm pop for a committed pixel polyline. No-op for <1 point. */
export function playCommitPop(
  scene: Phaser.Scene,
  pixels: readonly PixelPoint[],
  options: CommitPopOptions,
): void {
  if (pixels.length < 1) {
    return;
  }
  let cx = 0;
  let cy = 0;
  for (const point of pixels) {
    cx += point.x;
    cy += point.y;
  }
  cx /= pixels.length;
  cy /= pixels.length;

  const graphics = scene.add.graphics();
  graphics.setPosition(cx, cy);
  if (options.depth !== undefined) {
    graphics.setDepth(options.depth);
  }
  graphics.lineStyle(options.lineWidthPx, options.color, 1);
  graphics.fillStyle(options.color, 1);
  const first = pixels[0] as PixelPoint;
  graphics.beginPath();
  graphics.moveTo(first.x - cx, first.y - cy);
  for (let i = 1; i < pixels.length; i++) {
    const point = pixels[i] as PixelPoint;
    graphics.lineTo(point.x - cx, point.y - cy);
  }
  graphics.strokePath();
  for (const point of pixels) {
    graphics.fillCircle(point.x - cx, point.y - cy, options.lineWidthPx / 2);
  }

  graphics.setScale(1).setAlpha(0.9);
  scene.tweens.add({
    targets: graphics,
    scale: draw.confirmPopScale,
    duration: draw.confirmPopMs * 0.5,
    ease: 'Back.Out',
    yoyo: true,
    onComplete: () => graphics.destroy(),
  });
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: draw.confirmPopMs,
    ease: 'Quad.Out',
  });
}

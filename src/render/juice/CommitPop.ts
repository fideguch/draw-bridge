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
import { fillThickPolyline, type Vec2 } from '@render/ui/fillShapes';
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
  // Centroid-local thick polyline, fill-only (no strokePath; research §3).
  const local: Vec2[] = pixels.map((point) => ({ x: point.x - cx, y: point.y - cy }));
  fillThickPolyline(graphics, local, options.lineWidthPx, options.color);

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

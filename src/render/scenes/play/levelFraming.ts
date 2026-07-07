/**
 * levelFraming — fit a whole level into the portrait viewport (T045, SC-003).
 *
 * The drawing overview must show the entire solvable terrain "at a glance"
 * (SC-003 "解くべき地形が一目で読める"). Rather than fight camera zoom (which
 * would also scale the screen-fixed HUD and the dev-hook button rects), the
 * whole attempt runs at camera scroll (0,0) / zoom 1 and the level is fit into
 * the viewport by BAKING the scale + centre offset into WorldToPixel. At zoom 1
 * a screen point equals its world-pixel point, so the E2E's world→screen map is
 * the exact inverse of StrokeInput's screen→world (round-trips a recorded ghost
 * stroke without drift).
 *
 * Pure + Phaser-free so it unit-tests headless (render-logic style).
 */

import type { Level } from '@engine/level/LevelSchema';
import type { WorldToPixelOptions } from '@render/world/worldToPixel';

export interface FramingViewport {
  readonly width: number;
  readonly height: number;
  /** Uniform inset (px) kept clear of content on every edge. */
  readonly margin: number;
}

/** Extra world metres of headroom above the content so there is room to draw. */
const DRAW_HEADROOM_M = 1.5;

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function extend(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
}

/**
 * World-space bounding box of everything the player must read to solve the
 * level: terrain, the goal flag, the spawn, coins, and the pit floor (killY),
 * plus a little headroom above for the drawn arc.
 */
export function levelContentBounds(level: Level): Bounds {
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const polyline of level.terrain) {
    for (const [x, y] of polyline) {
      extend(bounds, x, y);
    }
  }
  extend(bounds, level.goalFlag.x, level.goalFlag.y);
  extend(bounds, level.goalFlag.x + level.goalFlag.width, level.goalFlag.y + level.goalFlag.height);
  extend(bounds, level.vehicleSpawn.x, level.vehicleSpawn.y);
  for (const coin of level.coins) {
    extend(bounds, coin.x, coin.y);
  }
  // Show the pit floor so the gap reads as a hazard, and headroom to draw above.
  bounds.minY = Math.min(bounds.minY, level.killY);
  bounds.maxY += DRAW_HEADROOM_M;
  return bounds;
}

/**
 * WorldToPixel options that fit the level's content box inside the viewport
 * (uniform scale, centred, `margin` px inset). Feed straight to
 * `new WorldToPixel(framingFor(level, viewport))`.
 */
export function framingFor(level: Level, viewport: FramingViewport): Required<WorldToPixelOptions> {
  const bounds = levelContentBounds(level);
  const contentW = Math.max(bounds.maxX - bounds.minX, 1e-3);
  const contentH = Math.max(bounds.maxY - bounds.minY, 1e-3);
  const availW = Math.max(viewport.width - 2 * viewport.margin, 1);
  const availH = Math.max(viewport.height - 2 * viewport.margin, 1);
  const pixelsPerMeter = Math.min(availW / contentW, availH / contentH);

  const centerWorldX = (bounds.minX + bounds.maxX) / 2;
  const centerWorldY = (bounds.minY + bounds.maxY) / 2;
  // px.x = originX + wx*ppm ; px.y = originY - wy*ppm  (worldToPixel y-flip).
  // Solve so the content centre lands on the viewport centre.
  return {
    pixelsPerMeter,
    originX: viewport.width / 2 - centerWorldX * pixelsPerMeter,
    originY: viewport.height / 2 + centerWorldY * pixelsPerMeter,
  };
}

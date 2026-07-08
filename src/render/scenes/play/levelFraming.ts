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
/** Horizontal padding (m) around the playable span (spawn ↔ flag). */
const PLAY_PAD_X_M = 2.0;
/** How much of the pit to show below the lowest rim (m) — NOT down to killY. */
const PIT_VIEW_DEPTH_M = 3.0;

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
  // PLAYABLE WINDOW, not the full terrain extent: terrain runways/pits extend
  // far past the action (L1 spans 24 m wide, killY -8 m deep) and framing all
  // of it rendered the stage tiny on device (2026-07-08 feedback). The player
  // must read spawn -> gap -> flag; trailing terrain and the pit bottom are
  // scenery the renderer still draws outside the frame.
  const flagLeft = level.goalFlag.x;
  const flagRight = level.goalFlag.x + level.goalFlag.width;
  const minX = Math.min(level.vehicleSpawn.x, flagLeft) - PLAY_PAD_X_M;
  const maxX = Math.max(level.vehicleSpawn.x, flagRight) + PLAY_PAD_X_M;

  const bounds: Bounds = {
    minX,
    maxX,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  // Vertical extent from content INSIDE the window only.
  let lowestRimY = Number.POSITIVE_INFINITY;
  for (const polyline of level.terrain) {
    for (const [x, y] of polyline) {
      if (x >= minX && x <= maxX) {
        bounds.maxY = Math.max(bounds.maxY, y);
        lowestRimY = Math.min(lowestRimY, y);
        bounds.minY = Math.min(bounds.minY, y);
      }
    }
  }
  const extendY = (y: number): void => {
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  extendY(level.goalFlag.y);
  extendY(level.goalFlag.y + level.goalFlag.height);
  extendY(level.vehicleSpawn.y);
  for (const coin of level.coins) {
    if (coin.x >= minX && coin.x <= maxX) {
      extendY(coin.y);
    }
  }
  // Show enough pit to read the hazard, capped — never the full killY depth.
  const surfaceY = Number.isFinite(lowestRimY) ? lowestRimY : level.vehicleSpawn.y;
  bounds.minY = Math.max(Math.min(bounds.minY, surfaceY - PIT_VIEW_DEPTH_M), level.killY);
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

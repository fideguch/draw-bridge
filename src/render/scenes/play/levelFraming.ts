/**
 * levelFraming — fit a whole level into the portrait viewport (T045, SC-003;
 * round-9 CS-3 portrait-first stage).
 *
 * The drawing overview must show the entire solvable terrain "at a glance"
 * (SC-003 "解くべき地形が一目で読める"). Rather than fight camera zoom (which
 * would also scale the screen-fixed HUD and the dev-hook button rects), the
 * whole attempt runs at camera scroll (0,0) / zoom 1 and the level is fit into
 * an explicit world-viewport RECT by BAKING the scale + centre offset into
 * WorldToPixel. At zoom 1 a screen point equals its world-pixel point, so the
 * E2E's world→screen map is the exact inverse of StrokeInput's screen→world
 * (round-trips a recorded ghost stroke without drift). Changing the rect only
 * moves WHERE on screen the content lands and at what scale — the round-trip
 * stays exact because StrokeInput shares this same transform.
 *
 * VERSION-GATED BOUNDS (round-9): v1 (the 28 shipped levels) keep the
 * width-led PLAYABLE-WINDOW bounds byte-for-byte, so their framing is unchanged
 * (HARD non-shrink guard — see levelContentBounds). v2 levels use the full
 * union of ALL content extents so a tall (up to 15 m × 24 m) authoring box
 * frames entirely (min-fit letterboxes horizontally — that is fine).
 *
 * Pure + Phaser-free so it unit-tests headless (render-logic style). The
 * caller (playViewport.ts) owns the per-edge safe-area maths that produces the
 * rect; this module never sees safe insets.
 */

import type { Level } from '@engine/level/LevelSchema';
import type { WorldToPixelOptions } from '@render/world/worldToPixel';
import { framing, person } from '@tuning/TuningConstants';

/**
 * The world-viewport RECT (game px) the level content is fit into, at camera
 * scroll(0,0)/zoom 1. `{x, y}` is the top-left; content is centred inside it.
 * The caller (playViewport.ts) reserves the HUD band / bottom band and applies
 * per-edge safe-area insets BEFORE building this rect — safe insets are NEVER
 * folded into a single uniform margin here (2026-07-08 device bug).
 */
export interface FramingViewport {
  /** Left edge of the world viewport, game px. */
  readonly x: number;
  /** Top edge of the world viewport (below the HUD band), game px. */
  readonly y: number;
  /** Width of the world viewport, game px. */
  readonly width: number;
  /** Height of the world viewport (between HUD band and bottom band), game px. */
  readonly height: number;
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

/**
 * World-space bounding box of everything the player must read to solve the
 * level. VERSION-GATED: v1 keeps the width-led playable window (unchanged); v2
 * takes the full union of every content extent so a tall stage frames entirely.
 */
export function levelContentBounds(level: Level): Bounds {
  return level.schemaVersion >= 2 ? boundsAllContent(level) : boundsPlayWindow(level);
}

/**
 * v1 (schemaVersion 1) bounds — UNCHANGED from the pre-round-9 code. A PLAYABLE
 * WINDOW, not the full terrain extent: terrain runways/pits extend far past the
 * action (L1 spans 24 m wide, killY -8 m deep) and framing all of it rendered
 * the stage tiny on device (2026-07-08 feedback). The player must read spawn ->
 * gap -> flag; trailing terrain and the pit bottom are scenery the renderer
 * still draws outside the frame. Preserving this verbatim keeps every shipped v1
 * level's framing identical (HARD CONSTRAINT: v1 may not shrink).
 */
function boundsPlayWindow(level: Level): Bounds {
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

function extend(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
}

/**
 * v2 (schemaVersion >= 2) bounds — the UNION of every content extent the player
 * must read: terrain polylines, spawn, goal flag, danger zones, rocks, persons,
 * coins. A tall level (content spanning ~24 m vertically) frames its full height
 * at zoom-1 min-fit; the framing letterboxes horizontally when height binds —
 * that is intended (portrait-first stage). Separate horizontal / vertical world
 * padding (TuningConstants.framing) surrounds the content so the drawn arc and
 * a landing have room. Authored inside a 15 m × 24 m box, so this never balloons.
 */
function boundsAllContent(level: Level): Bounds {
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
  extend(bounds, level.vehicleSpawn.x, level.vehicleSpawn.y);
  extend(bounds, level.goalFlag.x, level.goalFlag.y);
  extend(bounds, level.goalFlag.x + level.goalFlag.width, level.goalFlag.y + level.goalFlag.height);
  for (const zone of level.dangerZones ?? []) {
    extend(bounds, zone.x, zone.y);
    extend(bounds, zone.x + zone.width, zone.y + zone.height);
  }
  for (const r of level.rocks ?? []) {
    extend(bounds, r.x - r.radius, r.y - r.radius);
    extend(bounds, r.x + r.radius, r.y + r.radius);
  }
  for (const p of level.persons ?? []) {
    extend(bounds, p.x - person.halfWidth, p.y - person.halfHeight);
    extend(bounds, p.x + person.halfWidth, p.y + person.halfHeight);
  }
  for (const coin of level.coins) {
    extend(bounds, coin.x, coin.y);
  }
  // Separate H/V world padding (never a single uniform margin): drop room below,
  // draw headroom above, symmetric side padding.
  bounds.minX -= framing.contentPadXM;
  bounds.maxX += framing.contentPadXM;
  bounds.minY -= framing.contentPadBelowM;
  bounds.maxY += framing.contentPadAboveM;
  return bounds;
}

/**
 * WorldToPixel options that fit the level's content box inside the world-viewport
 * RECT (uniform scale, centred in the rect). Feed straight to
 * `new WorldToPixel(framingFor(level, viewport))`. The rect is produced by
 * playViewport.ts with per-edge safe insets + HUD/bottom bands already applied.
 */
export function framingFor(level: Level, viewport: FramingViewport): Required<WorldToPixelOptions> {
  const bounds = levelContentBounds(level);
  const contentW = Math.max(bounds.maxX - bounds.minX, 1e-3);
  const contentH = Math.max(bounds.maxY - bounds.minY, 1e-3);
  const rectW = Math.max(viewport.width, 1);
  const rectH = Math.max(viewport.height, 1);
  const pixelsPerMeter = Math.min(rectW / contentW, rectH / contentH);

  const centerWorldX = (bounds.minX + bounds.maxX) / 2;
  const centerWorldY = (bounds.minY + bounds.maxY) / 2;
  // px.x = originX + wx*ppm ; px.y = originY - wy*ppm  (worldToPixel y-flip).
  // Solve so the content centre lands on the centre of the world-viewport rect.
  const rectCenterX = viewport.x + rectW / 2;
  const rectCenterY = viewport.y + rectH / 2;
  return {
    pixelsPerMeter,
    originX: rectCenterX - centerWorldX * pixelsPerMeter,
    originY: rectCenterY + centerWorldY * pixelsPerMeter,
  };
}

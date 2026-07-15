/**
 * playViewport — the world-viewport RECT the level is framed into (round-9 CS-3).
 *
 * The play surface is split into three horizontal bands (portrait-first stage):
 *   ┌───────────────────────────┐  safe.top
 *   │        HUD band           │  pause row + level label + ink gauge
 *   ├───────────────────────────┤  ← world viewport TOP
 *   │      WORLD VIEWPORT        │  the framed level (levelFraming fits here)
 *   ├───────────────────────────┤  ← world viewport BOTTOM
 *   │       bottom band         │  restart thumb zone
 *   └───────────────────────────┘  safe.bottom
 *
 * Safe-area insets are applied PER EDGE (2026-07-08 device bug: folding safe.top
 * into a uniform margin also shrank the horizontal fit and ate ~247 px of stage
 * width). Left/right insets move the rect (position), they do not otherwise
 * shrink the world scale beyond the L/R margin.
 *
 * VERSION-GATED (HARD CONSTRAINT: v1 framing may not shrink): v1 levels get the
 * pre-round-9 full-area rect (a uniform ui(viewportMarginXPx) inset on every
 * edge, per-edge safe added) so their framing is byte-identical to today. v2
 * levels get the reduced HUD-band / bottom-band rect so the taller stage fits
 * between the HUD and the restart zone.
 *
 * Pure + Phaser-free (takes a plain layout snapshot) so it unit-tests headless.
 */

import { framing } from '@tuning/TuningConstants';
import type { FramingViewport } from './levelFraming';

/** Per-edge safe-area insets in game px (layout.safe shape). */
export interface SafeInsetsPx {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/**
 * The live-layout inputs playViewport needs: the game-pixel canvas size, the
 * per-edge safe insets, and the design→game px scaler (`layout.ui`). Passing a
 * snapshot (not the `layout` singleton) keeps this module Phaser-free + testable.
 */
export interface ViewportLayout {
  readonly width: number;
  readonly height: number;
  readonly safe: SafeInsetsPx;
  readonly ui: (designUnits: number) => number;
}

/**
 * The world-viewport rect for a level of the given schema version.
 * v1 → legacy full-area rect (unchanged framing); v2 → HUD-band reduced rect.
 */
export function worldViewportRect(layout: ViewportLayout, schemaVersion: number): FramingViewport {
  return schemaVersion >= 2 ? stageWorldRect(layout) : legacyWorldRect(layout);
}

/**
 * v1 rect — reproduces the pre-round-9 framing EXACTLY: a uniform
 * ui(viewportMarginXPx) inset on all four edges, plus per-edge safe insets.
 * (Equivalent to the old framingFor's internal availW/availH + safe-centre.)
 */
function legacyWorldRect(layout: ViewportLayout): FramingViewport {
  const m = layout.ui(framing.viewportMarginXPx);
  const x = layout.safe.left + m;
  const y = layout.safe.top + m;
  return {
    x,
    y,
    width: Math.max(layout.width - layout.safe.left - layout.safe.right - 2 * m, 1),
    height: Math.max(layout.height - layout.safe.top - layout.safe.bottom - 2 * m, 1),
  };
}

/**
 * v2 rect — the world viewport reserves the top HUD band and the bottom restart
 * band; horizontal margin + per-edge L/R safe insets position it. The reduced
 * height lets a tall (up to 24 m) stage fit between the bands.
 */
function stageWorldRect(layout: ViewportLayout): FramingViewport {
  const mx = layout.ui(framing.viewportMarginXPx);
  const top = layout.safe.top + layout.ui(framing.hudBandPx);
  const bottom = layout.safe.bottom + layout.ui(framing.bottomBandPx);
  return {
    x: layout.safe.left + mx,
    y: top,
    width: Math.max(layout.width - layout.safe.left - layout.safe.right - 2 * mx, 1),
    height: Math.max(layout.height - top - bottom, 1),
  };
}

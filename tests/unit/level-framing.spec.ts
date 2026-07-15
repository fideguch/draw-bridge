/**
 * levelFraming + playViewport — the pure viewport-fit maths behind the PlayScene
 * portrait-first overview (T045, SC-003; round-9 CS-3). Phaser-free, so it runs
 * in the vitest node environment.
 *
 * The round-9 API is RECT-based: framingFor fits the level content into an
 * explicit world-viewport rect {x, y, width, height} that playViewport.ts
 * produces (HUD band + bottom band + per-edge safe insets already applied).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLevel } from '@engine/level/LevelLoader';
import type { Level } from '@engine/level/LevelSchema';
import { WorldToPixel } from '@render/world/worldToPixel';
import { framingFor, levelContentBounds, type FramingViewport } from '@render/scenes/play/levelFraming';
import { worldViewportRect, type ViewportLayout } from '@render/scenes/play/playViewport';
import { framing } from '@tuning/TuningConstants';

function loadFixtureLevel(): Level {
  const file = join(process.cwd(), 'tests', 'fixtures', 'gate-levels', 'ch1-l01.json');
  const result = loadLevel(readFileSync(file, 'utf-8'), { filenameStem: 'ch1-l01' });
  if (!result.ok) {
    throw new Error(`fixture ch1-l01 failed to load: ${result.errors.join(', ')}`);
  }
  return result.level;
}

/** A layout snapshot (identity ui, zero safe) for a 390×844 phone. */
function phoneLayout(overrides: Partial<ViewportLayout> = {}): ViewportLayout {
  return {
    width: 390,
    height: 844,
    safe: { top: 0, bottom: 0, left: 0, right: 0 },
    ui: (n: number): number => n,
    ...overrides,
  };
}

/**
 * Synthetic v2 level whose content spans 15 m wide × 24 m tall (the round-9
 * authoring box). Only the fields levelContentBounds reads are populated — this
 * is a pure-function fixture, not a validated level. Includes a rock, a person,
 * a danger zone and a high coin so every union branch is exercised.
 */
function syntheticTallV2(): Level {
  return {
    schemaVersion: 2,
    id: 'ch1-l20',
    terrain: [
      [
        [0, 0],
        [15, 0],
      ],
    ],
    vehicleSpawn: { x: 1, y: 0.5 },
    goalFlag: { x: 13, y: 22, width: 1, height: 2 }, // top edge at y = 24
    killY: -6,
    coins: [{ x: 7, y: 12 }],
    rocks: [{ x: 10, y: 8, radius: 0.5 }],
    persons: [{ x: 5, y: 0.85 }],
    dangerZones: [{ x: 6, y: 0, width: 2, height: 1 }],
  } as unknown as Level;
}

describe('levelContentBounds — v1 (playable window, UNCHANGED)', () => {
  const level = loadFixtureLevel();

  it('spans the PLAYABLE window (spawn ↔ flag + pad) — not the full terrain runway', () => {
    const bounds = levelContentBounds(level);
    const flagRight = level.goalFlag.x + level.goalFlag.width;
    expect(bounds.minX).toBeLessThanOrEqual(level.vehicleSpawn.x - 1.5);
    expect(bounds.maxX).toBeGreaterThanOrEqual(flagRight + 1.5);
    const terrainXs = level.terrain.flatMap((line) => line.map(([x]) => x));
    const runwaySpan = Math.max(...terrainXs) - Math.min(...terrainXs);
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(runwaySpan);
  });

  it('shows a capped pit depth (hazard readable, never the full killY chasm)', () => {
    const bounds = levelContentBounds(level);
    const rimYs = level.terrain.flatMap((line) => line.map(([, y]) => y));
    const lowestRim = Math.min(...rimYs.filter((y) => y > level.killY));
    expect(bounds.minY).toBeLessThanOrEqual(lowestRim);
    expect(bounds.minY).toBeGreaterThanOrEqual(level.killY);
  });

  it('leaves headroom above the highest content to draw into', () => {
    const bounds = levelContentBounds(level);
    const topContent = Math.max(
      level.goalFlag.y + level.goalFlag.height,
      level.vehicleSpawn.y,
      ...level.coins.map((coin) => coin.y),
    );
    expect(bounds.maxY).toBeGreaterThan(topContent);
  });
});

describe('levelContentBounds — v2 (union of ALL content, vertical-aware)', () => {
  const level = syntheticTallV2();

  it('frames the full 24 m vertical content extent (+ separate H/V padding)', () => {
    const bounds = levelContentBounds(level);
    // The whole authoring box (y 0 → 24) is inside the bounds…
    expect(bounds.minY).toBeLessThanOrEqual(0);
    expect(bounds.maxY).toBeGreaterThanOrEqual(24);
    // …with the configured separate below/above world padding (NOT uniform).
    expect(bounds.minY).toBeCloseTo(0 - framing.contentPadBelowM, 6);
    expect(bounds.maxY).toBeCloseTo(24 + framing.contentPadAboveM, 6);
    expect(bounds.minX).toBeCloseTo(0 - framing.contentPadXM, 6);
    expect(bounds.maxX).toBeCloseTo(15 + framing.contentPadXM, 6);
  });

  it('unions rock / person / danger-zone / coin extents (none clipped)', () => {
    const bounds = levelContentBounds(level);
    // person top (y 0.85 + halfHeight 0.85 = 1.7) and rock (y 8 ± 0.5) and the
    // high coin (y 12) all sit within [minY, maxY].
    for (const y of [1.7, 8.5, 12]) {
      expect(y).toBeGreaterThan(bounds.minY);
      expect(y).toBeLessThan(bounds.maxY);
    }
  });
});

describe('framingFor — rect API', () => {
  const level = loadFixtureLevel();
  const rect: FramingViewport = { x: 40, y: 40, width: 310, height: 764 };
  const framed = framingFor(level, rect);
  const transform = new WorldToPixel(framed);

  it('produces a positive uniform scale + finite origin', () => {
    expect(framed.pixelsPerMeter).toBeGreaterThan(0);
    expect(Number.isFinite(framed.originX)).toBe(true);
    expect(Number.isFinite(framed.originY)).toBe(true);
  });

  it('maps the content centre to the RECT centre', () => {
    const bounds = levelContentBounds(level);
    const centre = transform.point({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    });
    expect(centre.x).toBeCloseTo(rect.x + rect.width / 2, 5);
    expect(centre.y).toBeCloseTo(rect.y + rect.height / 2, 5);
  });

  it('keeps every content corner inside the rect', () => {
    const bounds = levelContentBounds(level);
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.maxX, y: bounds.minY },
    ];
    for (const corner of corners) {
      const pixel = transform.point(corner);
      expect(pixel.x).toBeGreaterThanOrEqual(rect.x - 1e-6);
      expect(pixel.x).toBeLessThanOrEqual(rect.x + rect.width + 1e-6);
      expect(pixel.y).toBeGreaterThanOrEqual(rect.y - 1e-6);
      expect(pixel.y).toBeLessThanOrEqual(rect.y + rect.height + 1e-6);
    }
  });

  it('frames a synthetic 15×24 v2 level entirely (full 24 m height visible, min-fit)', () => {
    const tall = syntheticTallV2();
    const stageRect = worldViewportRect(phoneLayout(), 2);
    const t = new WorldToPixel(framingFor(tall, stageRect));
    // y = 24 (top of content) sits at/under the rect top; y = 0 (ground) sits
    // at/above the rect bottom — the whole 24 m spans inside the viewport.
    const top = t.point({ x: 7, y: 24 });
    const ground = t.point({ x: 7, y: 0 });
    expect(top.y).toBeGreaterThanOrEqual(stageRect.y - 1e-6);
    expect(ground.y).toBeLessThanOrEqual(stageRect.y + stageRect.height + 1e-6);
    // The shown vertical world span covers at least the full 24 m authoring box.
    const shownWorldHeight = stageRect.height / framingFor(tall, stageRect).pixelsPerMeter;
    expect(shownWorldHeight).toBeGreaterThanOrEqual(24);
  });
});

describe('framingFor — v1 NON-SHRINK regression (HARD CONSTRAINT: v1 may not shrink)', () => {
  // Baseline captured from the pre-CS-3 code for ch1-l01 at viewport 390×844,
  // margin 40, zero safe (see Writer report). The refactor MUST reproduce it.
  const BASELINE = {
    pixelsPerMeter: 27.43362831858407,
    originX: 182.65486725663717,
    originY: 394.56637168141594,
  } as const;

  it('reproduces the exact pre-round-9 ch1-l01 framing via the v1 legacy rect', () => {
    const level = loadFixtureLevel();
    // The v1 rect playViewport builds for a 390×844 zero-safe phone == the old
    // full-area inset box {x:40, y:40, w:310, h:764}.
    const v1Rect = worldViewportRect(phoneLayout(), 1);
    expect(v1Rect).toEqual({ x: 40, y: 40, width: 310, height: 764 });
    const framed = framingFor(level, v1Rect);
    expect(framed.pixelsPerMeter).toBeCloseTo(BASELINE.pixelsPerMeter, 9);
    expect(framed.originX).toBeCloseTo(BASELINE.originX, 9);
    expect(framed.originY).toBeCloseTo(BASELINE.originY, 9);
  });

  it('v1 shown world width is UNCHANGED (width stays the binding constraint)', () => {
    const level = loadFixtureLevel();
    const v1Rect = worldViewportRect(phoneLayout(), 1);
    const shownWorldWidth = v1Rect.width / framingFor(level, v1Rect).pixelsPerMeter;
    const bounds = levelContentBounds(level);
    // Width-bound ⇒ the shown world width equals the content width exactly.
    expect(shownWorldWidth).toBeCloseTo(bounds.maxX - bounds.minX, 6);
  });
});

describe('worldViewportRect — HUD/bottom bands + PER-EDGE safe (no uniform fold)', () => {
  it('v1 = legacy full-area rect (uniform margin, unchanged framing)', () => {
    expect(worldViewportRect(phoneLayout(), 1)).toEqual({ x: 40, y: 40, width: 310, height: 764 });
  });

  it('v2 reserves the HUD band (top) and bottom restart band', () => {
    const rect = worldViewportRect(phoneLayout(), 2);
    expect(rect.y).toBe(framing.hudBandPx); // world begins below the HUD band
    expect(rect.height).toBe(844 - framing.hudBandPx - framing.bottomBandPx);
    expect(rect.width).toBe(310); // horizontal margin only, no vertical fold
  });

  it('applies safe insets PER EDGE — top inset never eats horizontal width', () => {
    const withTop = worldViewportRect(phoneLayout({ safe: { top: 59, bottom: 34, left: 0, right: 0 } }), 2);
    // A Dynamic-Island top inset pushes the world DOWN but does NOT shrink width.
    expect(withTop.y).toBe(59 + framing.hudBandPx);
    expect(withTop.width).toBe(310);
    // A left inset shrinks width by exactly that inset (per-edge, not doubled).
    const withLeft = worldViewportRect(phoneLayout({ safe: { top: 0, bottom: 0, left: 20, right: 0 } }), 2);
    expect(withLeft.width).toBe(390 - 20 - 2 * framing.viewportMarginXPx);
    expect(withLeft.x).toBe(20 + framing.viewportMarginXPx);
  });
});

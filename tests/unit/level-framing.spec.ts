/**
 * levelFraming — the pure viewport-fit maths behind the PlayScene overview
 * (T045, SC-003). Phaser-free, so it runs in the vitest node environment.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLevel } from '@engine/level/LevelLoader';
import type { Level } from '@engine/level/LevelSchema';
import { WorldToPixel } from '@render/world/worldToPixel';
import { framingFor, levelContentBounds } from '@render/scenes/play/levelFraming';

function loadFixtureLevel(): Level {
  const file = join(process.cwd(), 'tests', 'fixtures', 'gate-levels', 'ch1-l01.json');
  const result = loadLevel(readFileSync(file, 'utf-8'), { filenameStem: 'ch1-l01' });
  if (!result.ok) {
    throw new Error(`fixture ch1-l01 failed to load: ${result.errors.join(', ')}`);
  }
  return result.level;
}

const VIEWPORT = { width: 390, height: 844, margin: 40 } as const;

describe('levelContentBounds', () => {
  const level = loadFixtureLevel();

  it('spans the PLAYABLE window (spawn ↔ flag + pad) — not the full terrain runway', () => {
    const bounds = levelContentBounds(level);
    const flagRight = level.goalFlag.x + level.goalFlag.width;
    // Covers the action with padding…
    expect(bounds.minX).toBeLessThanOrEqual(level.vehicleSpawn.x - 1.5);
    expect(bounds.maxX).toBeGreaterThanOrEqual(flagRight + 1.5);
    // …but does NOT balloon to distant scenery (the tiny-stage device bug):
    const terrainXs = level.terrain.flatMap((line) => line.map(([x]) => x));
    const runwaySpan = Math.max(...terrainXs) - Math.min(...terrainXs);
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(runwaySpan);
  });

  it('shows a capped pit depth (hazard readable, never the full killY chasm)', () => {
    const bounds = levelContentBounds(level);
    const rimYs = level.terrain.flatMap((line) => line.map(([, y]) => y));
    const lowestRim = Math.min(...rimYs.filter((y) => y > level.killY));
    expect(bounds.minY).toBeLessThanOrEqual(lowestRim); // pit visible
    expect(bounds.minY).toBeGreaterThanOrEqual(level.killY); // but bounded
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

describe('framingFor', () => {
  const level = loadFixtureLevel();
  const framing = framingFor(level, VIEWPORT);
  const transform = new WorldToPixel(framing);

  it('produces a positive uniform scale', () => {
    expect(framing.pixelsPerMeter).toBeGreaterThan(0);
    expect(Number.isFinite(framing.originX)).toBe(true);
    expect(Number.isFinite(framing.originY)).toBe(true);
  });

  it('maps the content centre to the viewport centre', () => {
    const bounds = levelContentBounds(level);
    const centre = transform.point({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    });
    expect(centre.x).toBeCloseTo(VIEWPORT.width / 2, 5);
    expect(centre.y).toBeCloseTo(VIEWPORT.height / 2, 5);
  });

  it('keeps every content corner inside the margin box', () => {
    const bounds = levelContentBounds(level);
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.maxX, y: bounds.minY },
    ];
    for (const corner of corners) {
      const pixel = transform.point(corner);
      expect(pixel.x).toBeGreaterThanOrEqual(VIEWPORT.margin - 1e-6);
      expect(pixel.x).toBeLessThanOrEqual(VIEWPORT.width - VIEWPORT.margin + 1e-6);
      expect(pixel.y).toBeGreaterThanOrEqual(VIEWPORT.margin - 1e-6);
      expect(pixel.y).toBeLessThanOrEqual(VIEWPORT.height - VIEWPORT.margin + 1e-6);
    }
  });
});

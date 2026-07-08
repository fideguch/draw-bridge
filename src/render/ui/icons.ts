/**
 * icons.ts — pure fill-only vector icons (research 08_mobile_quality §4.2).
 *
 * The app used text/emoji GLYPHS as icons (⚙ ← ↺ ▶ ◎) which are font-dependent
 * (字形が端末で変わる), un-tintable, and blur on Retina. Each is replaced by a
 * Graphics composition drawn from fills only — no `strokePath`/`strokeCircle`
 * (§3 line bugs), no SVG asset pipeline (self-contained, NFR-013 "no textures").
 *
 * Because the backing store is DEVICE pixels (Scale.NONE + DPR — research §2),
 * a filled path drawn at `size` game px is inherently 1:1 crisp. Every icon is
 * drawn CENTRED on (0, 0) inside a `size`×`size` box; the caller positions the
 * Graphics. Monochrome icons take a `color`; the gear's centre hole is punched in
 * `holeColor` (the button face) and the coin is 2-tone from the theme.
 */

import type Phaser from 'phaser';
import { color } from './theme';

export type IconName = 'gear' | 'back' | 'restart' | 'play' | 'coin' | 'pause' | 'ink' | 'speed' | 'lock';

export interface IconStyle {
  /** Foreground fill (monochrome icons). */
  readonly color: number;
  /** Colour for the gear's centre hole — pass the button face fill. */
  readonly holeColor?: number;
}

type Gfx = Phaser.GameObjects.Graphics;

/** Draw `name` centred on (0, 0) fitting a `size`×`size` box, fill-only. */
export function drawIcon(g: Gfx, name: IconName, size: number, style: IconStyle): void {
  switch (name) {
    case 'gear':
      drawGear(g, size, style);
      return;
    case 'back':
      drawBack(g, size, style);
      return;
    case 'restart':
      drawRestart(g, size, style);
      return;
    case 'play':
      drawPlay(g, size, style);
      return;
    case 'coin':
      drawCoin(g, size);
      return;
    case 'pause':
      drawPause(g, size, style);
      return;
    case 'ink':
      drawInk(g, size, style);
      return;
    case 'speed':
      drawSpeed(g, size, style);
      return;
    case 'lock':
      drawLock(g, size, style);
      return;
  }
}

/**
 * Ink bottle: a trapezoid bottle body + a short neck + a nib/drop, fill-only.
 * Reads as "this is the ink resource" beside the HUD gauge (DESIGN.md §4.7/§4.8).
 */
function drawInk(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  g.fillStyle(style.color, 1);
  // Neck (short rounded rect at the top).
  const neckW = size * 0.26;
  const neckH = size * 0.16;
  g.fillRoundedRect(-neckW / 2, -half * 0.9, neckW, neckH, neckW * 0.25);
  // Bottle body: a downward-widening trapezoid with a flat rounded base.
  const topW = size * 0.44;
  const botW = size * 0.72;
  const bodyTop = -half * 0.74;
  const bodyBot = half * 0.62;
  g.fillPoints(
    [
      { x: -topW / 2, y: bodyTop },
      { x: topW / 2, y: bodyTop },
      { x: botW / 2, y: bodyBot },
      { x: -botW / 2, y: bodyBot },
    ] as unknown as Phaser.Math.Vector2[],
    true,
  );
  g.fillRoundedRect(-botW / 2, bodyBot - size * 0.14, botW, size * 0.2, size * 0.1);
  // Ink drop highlight punched in the hole colour (a readable "fill level" cue).
  g.fillStyle(style.holeColor ?? color.uiSurface, 1);
  g.fillCircle(0, half * 0.18, size * 0.16);
}

/** Speed: a forward-leaning lightning bolt (engine-speed axis, DESIGN.md §4.8). */
function drawSpeed(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  g.fillStyle(style.color, 1);
  g.fillPoints(
    [
      { x: half * 0.28, y: -half * 0.92 },
      { x: -half * 0.5, y: half * 0.12 },
      { x: -half * 0.04, y: half * 0.12 },
      { x: -half * 0.28, y: half * 0.92 },
      { x: half * 0.5, y: -half * 0.18 },
      { x: half * 0.04, y: -half * 0.18 },
    ] as unknown as Phaser.Math.Vector2[],
    true,
  );
}

/**
 * Padlock: a shackle ring (outer disc + hole-colour inner disc, upper half only
 * shown once the body covers the rest) + a rounded body with a keyhole. Fill-only
 * (research §3 — no strokeCircle), matches the tile lock (DESIGN.md §4.4/§4.8).
 */
function drawLock(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  const bodyW = size * 0.62;
  const bodyH = size * 0.5;
  const bodyTop = half * 0.02;
  const shackleR = bodyW * 0.34;
  const shackleCy = bodyTop - shackleR * 0.5;
  const shackleThick = size * 0.11;
  // Shackle ring (fill-only): outer disc, then hole-colour inner disc.
  g.fillStyle(style.color, 1);
  g.fillCircle(0, shackleCy, shackleR);
  g.fillStyle(style.holeColor ?? color.uiSurface, 1);
  g.fillCircle(0, shackleCy, shackleR - shackleThick);
  // Body covers the ring's lower half so only the top arc reads as a shackle.
  g.fillStyle(style.color, 1);
  g.fillRoundedRect(-bodyW / 2, bodyTop, bodyW, bodyH, size * 0.1);
  // Keyhole punched in the hole colour.
  g.fillStyle(style.holeColor ?? color.uiSurface, 1);
  g.fillCircle(0, bodyTop + bodyH * 0.42, size * 0.07);
}

/** Two rounded vertical bars. */
function drawPause(g: Gfx, size: number, style: IconStyle): void {
  const barW = size * 0.26;
  const barH = size * 0.86;
  const gap = size * 0.16;
  const r = barW / 2;
  g.fillStyle(style.color, 1);
  g.fillRoundedRect(-gap / 2 - barW, -barH / 2, barW, barH, r);
  g.fillRoundedRect(gap / 2, -barH / 2, barW, barH, r);
}

/** 8-tooth gear: radial tooth quads + a body disc + a face-coloured centre hole. */
function drawGear(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  const bodyR = half * 0.66;
  const holeR = half * 0.3;
  const teeth = 8;
  const toothLen = half * 0.34;
  const toothHalfW = size * 0.11;
  const ringR = bodyR * 0.82;
  g.fillStyle(style.color, 1);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const tx = -uy; // tangent
    const ty = ux;
    const baseX = ux * ringR;
    const baseY = uy * ringR;
    const tipX = ux * (ringR + toothLen);
    const tipY = uy * (ringR + toothLen);
    g.fillPoints(
      [
        { x: baseX + tx * toothHalfW, y: baseY + ty * toothHalfW },
        { x: tipX + tx * toothHalfW * 0.7, y: tipY + ty * toothHalfW * 0.7 },
        { x: tipX - tx * toothHalfW * 0.7, y: tipY - ty * toothHalfW * 0.7 },
        { x: baseX - tx * toothHalfW, y: baseY - ty * toothHalfW },
      ] as unknown as Phaser.Math.Vector2[],
      true,
    );
  }
  g.fillCircle(0, 0, bodyR);
  g.fillStyle(style.holeColor ?? color.uiSurface, 1);
  g.fillCircle(0, 0, holeR);
}

/** Left-pointing arrow: a triangle head + a rectangular shaft. */
function drawBack(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  const headW = size * 0.46;
  const headH = size * 0.64;
  const shaftH = size * 0.2;
  g.fillStyle(style.color, 1);
  g.fillTriangle(-half, 0, -half + headW, -headH / 2, -half + headW, headH / 2);
  const shaftLeft = -half + headW * 0.55;
  const shaftRight = half * 0.86;
  g.fillRect(shaftLeft, -shaftH / 2, shaftRight - shaftLeft, shaftH);
}

/** Counter-clockwise circular arrow: a partial annulus + a tangential arrowhead. */
function drawRestart(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  const outerR = half * 0.9;
  const innerR = half * 0.5;
  const midR = (outerR + innerR) / 2;
  const thick = outerR - innerR;
  // Arc sweeps clockwise (screen) from startA, leaving a gap for the arrowhead.
  const startA = -Math.PI * 0.28;
  const endA = Math.PI * 1.5;
  const steps = 28;
  g.fillStyle(style.color, 1);
  for (let i = 0; i < steps; i++) {
    const a0 = startA + ((endA - startA) * i) / steps;
    const a1 = startA + ((endA - startA) * (i + 1)) / steps;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    g.fillPoints(
      [
        { x: c0 * outerR, y: s0 * outerR },
        { x: c1 * outerR, y: s1 * outerR },
        { x: c1 * innerR, y: s1 * innerR },
        { x: c0 * innerR, y: s0 * innerR },
      ] as unknown as Phaser.Math.Vector2[],
      true,
    );
  }
  // Arrowhead at the start of the arc, pointing along the (clockwise) tangent.
  const ax = Math.cos(startA) * midR;
  const ay = Math.sin(startA) * midR;
  const tx = Math.sin(startA); // clockwise tangent = (sin, -cos)
  const ty = -Math.cos(startA);
  const rx = Math.cos(startA); // radial
  const ry = Math.sin(startA);
  const headLen = thick * 1.5;
  const headWide = thick * 1.35;
  g.fillTriangle(
    ax + tx * headLen,
    ay + ty * headLen,
    ax + rx * headWide,
    ay + ry * headWide,
    ax - rx * headWide,
    ay - ry * headWide,
  );
}

/** Right-pointing play triangle, mass-centred within the box. */
function drawPlay(g: Gfx, size: number, style: IconStyle): void {
  const half = size / 2;
  const shift = -size * 0.06; // nudge left so the visual centroid sits on 0
  g.fillStyle(style.color, 1);
  g.fillTriangle(
    -half * 0.62 + shift,
    -half * 0.82,
    -half * 0.62 + shift,
    half * 0.82,
    half * 0.84 + shift,
    0,
  );
}

/** Two-tone coin: bordered disc + an inner ring (reads as a coin at any size). */
function drawCoin(g: Gfx, size: number): void {
  const r = size / 2;
  g.fillStyle(color.coinStroke, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(color.coin, 1);
  g.fillCircle(0, 0, r * 0.82);
  g.fillStyle(color.coinStroke, 1);
  g.fillCircle(0, 0, r * 0.42);
  g.fillStyle(color.coin, 1);
  g.fillCircle(0, 0, r * 0.3);
}

/**
 * fillShapes.ts — the fill-only rendering primitives that replace every Phaser 4
 * Graphics STROKE call site (research 08_mobile_quality §3). Phaser 4.2's
 * `strokeRoundedRect` / `strokePath` / `strokeCircle` are known-broken on mobile
 * (#5429 / #7198), so the whole app draws borders, dividers, rings and thick
 * lines out of fills instead:
 *
 * - borders            → a border-coloured shape with the fill inset by the
 *                        border width ("double fill", §3.2 決定).
 * - dividers / lines   → thin `fillRect`.
 * - stroked circles    → an outer border disc + an inset fill disc.
 * - hollow rings       → a filled annulus tiled from quads (a true ring, but
 *                        fill-only — no stroke, no destination-out).
 * - polyline strokes   → filled quad segments + round joint discs (the live
 *                        stroke, terrain edge, flag pole, spoke cross …).
 *
 * This module is deliberately THEME-FREE (only a type-only Phaser import) so the
 * theme-injected, headless-importable views (StarBurst / RewardCountUp) can use
 * it without pulling any Phaser value or colour token. Callers pass explicit
 * colours. Every geometry input is game px (DPR-native), so the output is 1:1
 * crisp on every device.
 */

import type Phaser from 'phaser';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

type Gfx = Phaser.GameObjects.Graphics;

/**
 * `Graphics.fillPoints` reads only `.x`/`.y` at runtime but its d.ts demands
 * `Phaser.Math.Vector2[]`; plain Vec2 literals are structurally sufficient, so
 * this one cast is centralised here (keeps callers Vector2-construction-free).
 */
function fillPoly(g: Gfx, points: readonly Vec2[]): void {
  g.fillPoints(points as unknown as Phaser.Math.Vector2[], true);
}

/** Clamp a corner / pill radius so a rounded fill can never overshoot the rect. */
export function clampRadius(radius: number, width: number, height: number): number {
  return Math.max(0, Math.min(radius, width / 2, height / 2));
}

export interface BorderFillOptions {
  readonly fill: number;
  readonly fillAlpha?: number;
  readonly border: number;
  readonly borderWidth: number;
}

/**
 * Rounded rect with a solid border via the double-fill technique (§3.2): paint
 * the border-coloured rect, then the fill inset by `borderWidth` on every side.
 * The corner radius is clamped to the rect (research §3 radius ≤ min(w,h)/2).
 */
export function borderedRoundedRect(
  g: Gfx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  opts: BorderFillOptions,
): void {
  const r = clampRadius(radius, w, h);
  g.fillStyle(opts.border, 1);
  g.fillRoundedRect(x, y, w, h, r);
  const b = opts.borderWidth;
  const iw = Math.max(0, w - 2 * b);
  const ih = Math.max(0, h - 2 * b);
  g.fillStyle(opts.fill, opts.fillAlpha ?? 1);
  g.fillRoundedRect(x + b, y + b, iw, ih, clampRadius(r - b, iw, ih));
}

/** Solid-bordered disc: an outer border disc with the fill disc inset by `borderWidth`. */
export function borderedCircle(g: Gfx, cx: number, cy: number, r: number, opts: BorderFillOptions): void {
  g.fillStyle(opts.border, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(opts.fill, opts.fillAlpha ?? 1);
  g.fillCircle(cx, cy, Math.max(0, r - opts.borderWidth));
}

/** A thin filled rectangle standing in for a horizontal/vertical stroked line. */
export function fillLine(
  g: Gfx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  colorValue: number,
  alpha = 1,
): void {
  const half = width / 2;
  g.fillStyle(colorValue, alpha);
  if (y1 === y2) {
    g.fillRect(Math.min(x1, x2), y1 - half, Math.abs(x2 - x1), width);
  } else if (x1 === x2) {
    g.fillRect(x1 - half, Math.min(y1, y2), width, Math.abs(y2 - y1));
  } else {
    fillThickPolyline(g, [{ x: x1, y: y1 }, { x: x2, y: y2 }], width, colorValue, alpha);
  }
}

/**
 * A hollow ring (annulus) tiled from `steps` quads — a TRUE ring drawn fill-only
 * (no stroke, no destination-out blend). Used for expanding shockwaves / the
 * fail-cause marker where a solid disc would read wrong.
 */
export function fillRing(
  g: Gfx,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  colorValue: number,
  alpha = 1,
  steps = 40,
): void {
  const inner = Math.max(0, Math.min(innerR, outerR));
  g.fillStyle(colorValue, alpha);
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    fillPoly(g, [
      { x: cx + c0 * outerR, y: cy + s0 * outerR },
      { x: cx + c1 * outerR, y: cy + s1 * outerR },
      { x: cx + c1 * inner, y: cy + s1 * inner },
      { x: cx + c0 * inner, y: cy + s0 * inner },
    ]);
  }
}

/** Move every vertex `amount` px away from the polygon centroid (outward border ring). */
export function outsetPolygon(points: readonly Vec2[], amount: number): Vec2[] {
  const n = points.length;
  if (n === 0) {
    return [];
  }
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const scale = (d + amount) / d;
    return { x: cx + dx * scale, y: cy + dy * scale };
  });
}

/** A convex-ish polygon with a solid border: an outset border polygon under the fill. */
export function borderedPolygon(
  g: Gfx,
  points: readonly Vec2[],
  opts: BorderFillOptions,
): void {
  if (points.length < 3) {
    return;
  }
  g.fillStyle(opts.border, 1);
  fillPoly(g, outsetPolygon(points, opts.borderWidth));
  g.fillStyle(opts.fill, opts.fillAlpha ?? 1);
  fillPoly(g, points);
}

/**
 * Stroke a polyline out of fills: one oriented quad per segment plus a round
 * joint/cap disc at every vertex (matches lineStyle's round caps + joins). This
 * is the free-polyline replacement for `strokePath` (live stroke, terrain edge,
 * commit-pop flash) that has no rounded-fill equivalent.
 */
export function fillThickPolyline(
  g: Gfx,
  points: readonly Vec2[],
  width: number,
  colorValue: number,
  alpha = 1,
): void {
  if (points.length === 0) {
    return;
  }
  const half = width / 2;
  g.fillStyle(colorValue, alpha);
  if (points.length === 1) {
    const only = points[0] as Vec2;
    g.fillCircle(only.x, only.y, half);
    return;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec2;
    const b = points[i + 1] as Vec2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      continue;
    }
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    fillPoly(g, [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny },
    ]);
  }
  // Round caps + joins.
  for (const p of points) {
    g.fillCircle(p.x, p.y, half);
  }
}

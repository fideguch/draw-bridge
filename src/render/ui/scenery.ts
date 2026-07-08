/**
 * scenery.ts — decorative program-drawn backdrops (no textures, NFR-013). Home
 * uses the game palette so the title screen reads as the real world
 * (ui_design_brief §6.1 "背景: 空+地形+静止車").
 *
 * DPR-native: extents come from the live `layout` (game px) and every design
 * offset/size is ui-scaled so the vignette fills the real viewport and renders
 * crisp on every device (research §2).
 */

import Phaser from 'phaser';
import { borderedPolygon, borderedRoundedRect, fillLine } from './fillShapes';
import { color, layout, stroke } from './theme';

/** Draw a static ground + parked car + goal flag vignette across the bottom. */
export function drawGroundScene(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const width = layout.width;
  const height = layout.height;
  const groundY = height * 0.72;
  const ui = (n: number): number => layout.ui(n);

  // terrain body + grass cap + outline (full-bleed width)
  g.fillStyle(color.terrainFill, 1);
  g.fillRect(0, groundY, width, height - groundY);
  g.fillStyle(color.terrainGrass, 1);
  g.fillRect(0, groundY, width, ui(8));
  fillLine(g, 0, groundY, width, groundY, stroke.game, color.terrainStroke);

  // parked hero car — sporty redesign matching VehicleRenderer (static, no spin)
  drawParkedCar(g, ui(108), groundY, ui);

  // goal flag (pole + magenta pennant)
  const flagX = ui(300);
  fillLine(g, flagX, groundY, flagX, groundY - ui(64), stroke.game, color.inkBorder);
  g.fillStyle(color.goalFlag, 1);
  g.fillTriangle(flagX, groundY - ui(64), flagX, groundY - ui(40), flagX + ui(30), groundY - ui(52));
}

/**
 * Static sporty parked car matching VehicleRenderer's design (fill-only): tyre +
 * silver rim + spoke cross + hub wheels, an orange body with a darker belly, a
 * cream beltline stripe, a steel cabin with raked glass, and a headlight.
 */
function drawParkedCar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  groundY: number,
  ui: (n: number) => number,
): void {
  const bw = ui(66);
  const bh = ui(24);
  const bodyTop = groundY - ui(34);
  const bodyBottom = bodyTop + bh;
  const b = stroke.game;
  const wheelR = ui(11);
  const wheelY = bodyBottom + ui(1);
  const wheelDX = ui(19);

  // wheels first so the body tucks over their tops (arch illusion)
  for (const wx of [cx - wheelDX, cx + wheelDX]) {
    g.fillStyle(color.inkBorder, 1);
    g.fillCircle(wx, wheelY, wheelR);
    g.fillStyle(color.carRim, 1);
    g.fillCircle(wx, wheelY, wheelR * 0.7);
    const sp = Math.max(2, wheelR * 0.16);
    g.fillStyle(color.inkBorder, 1);
    g.fillRect(wx - wheelR * 0.62, wheelY - sp / 2, wheelR * 1.24, sp);
    g.fillRect(wx - sp / 2, wheelY - wheelR * 0.62, sp, wheelR * 1.24);
    g.fillStyle(color.carBody, 1);
    g.fillCircle(wx, wheelY, wheelR * 0.26);
  }

  // body base + belly shade + cream beltline stripe
  borderedRoundedRect(g, cx - bw / 2, bodyTop, bw, bh, ui(8), {
    fill: color.carBody,
    border: color.inkBorder,
    borderWidth: b,
  });
  g.fillStyle(color.carBodyDark, 1);
  g.fillRoundedRect(cx - bw / 2 + b, bodyTop + bh * 0.55, bw - 2 * b, bh * 0.45 - b, ui(3));
  g.fillStyle(color.carStripe, 1);
  g.fillRoundedRect(cx - bw / 2 + b, bodyTop + bh * 0.28, bw - 2 * b, bh * 0.2, ui(2));

  // cabin (steel, rear-biased, raked windshield) + glass
  const roofY = bodyTop - ui(14);
  const baseY = bodyTop + bh * 0.16;
  const cabin = [
    { x: cx - bw * 0.3, y: baseY },
    { x: cx - bw * 0.23, y: roofY },
    { x: cx + bw * 0.13, y: roofY },
    { x: cx + bw * 0.28, y: baseY },
  ];
  borderedPolygon(g, cabin, { fill: color.carRoof, border: color.inkBorder, borderWidth: b });
  const gTop = roofY + ui(3);
  const gBot = baseY - ui(2);
  g.fillStyle(color.carGlass, 1);
  g.fillTriangle(cx - bw * 0.26, gTop, cx - bw * 0.005, gTop, cx - bw * 0.025, gBot);
  g.fillTriangle(cx - bw * 0.26, gTop, cx - bw * 0.025, gBot, cx - bw * 0.24, gBot);
  g.fillTriangle(cx + bw * 0.06, gTop, cx + bw * 0.11, gTop, cx + bw * 0.24, gBot);
  g.fillTriangle(cx + bw * 0.06, gTop, cx + bw * 0.24, gBot, cx + bw * 0.2, gBot);

  // headlight
  g.fillStyle(color.carHeadlight, 1);
  g.fillCircle(cx + bw * 0.45, bodyTop + bh * 0.24, ui(3.4));
}

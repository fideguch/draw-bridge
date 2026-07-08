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
import { borderedRoundedRect, fillLine } from './fillShapes';
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

  // parked hero car (rounded body + two wheels)
  const carX = ui(108);
  borderedRoundedRect(g, carX - ui(30), groundY - ui(34), ui(60), ui(24), ui(8), {
    fill: color.carBody,
    border: color.inkBorder,
    borderWidth: stroke.game,
  });
  g.fillStyle(color.inkBorder, 1);
  g.fillCircle(carX - ui(16), groundY - ui(8), ui(10));
  g.fillCircle(carX + ui(16), groundY - ui(8), ui(10));

  // goal flag (pole + magenta pennant)
  const flagX = ui(300);
  fillLine(g, flagX, groundY, flagX, groundY - ui(64), stroke.game, color.inkBorder);
  g.fillStyle(color.goalFlag, 1);
  g.fillTriangle(flagX, groundY - ui(64), flagX, groundY - ui(40), flagX + ui(30), groundY - ui(52));
}

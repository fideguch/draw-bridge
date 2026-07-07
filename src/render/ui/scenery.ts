/**
 * scenery.ts — decorative program-drawn backdrops (no textures, NFR-013). Home
 * uses the game palette so the title screen reads as the real world
 * (ui_design_brief §6.1 "背景: 空+地形+静止車").
 */

import Phaser from 'phaser';
import { color, screen, stroke } from './theme';

/** Draw a static ground + parked car + goal flag vignette across the bottom. */
export function drawGroundScene(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const groundY = screen.height * 0.72;

  // terrain body + grass cap + outline
  g.fillStyle(color.terrainFill, 1);
  g.fillRect(0, groundY, screen.width, screen.height - groundY);
  g.fillStyle(color.terrainGrass, 1);
  g.fillRect(0, groundY, screen.width, 8);
  g.lineStyle(stroke.game, color.terrainStroke, 1);
  g.lineBetween(0, groundY, screen.width, groundY);

  // parked hero car (rounded body + two wheels)
  const carX = 108;
  g.fillStyle(color.carBody, 1);
  g.fillRoundedRect(carX - 30, groundY - 34, 60, 24, 8);
  g.lineStyle(stroke.game, color.inkBorder, 1);
  g.strokeRoundedRect(carX - 30, groundY - 34, 60, 24, 8);
  g.fillStyle(color.inkBorder, 1);
  g.fillCircle(carX - 16, groundY - 8, 10);
  g.fillCircle(carX + 16, groundY - 8, 10);

  // goal flag (pole + magenta pennant)
  const flagX = 300;
  g.lineStyle(stroke.game, color.inkBorder, 1);
  g.lineBetween(flagX, groundY, flagX, groundY - 64);
  g.fillStyle(color.goalFlag, 1);
  g.fillTriangle(flagX, groundY - 64, flagX, groundY - 40, flagX + 30, groundY - 52);
}

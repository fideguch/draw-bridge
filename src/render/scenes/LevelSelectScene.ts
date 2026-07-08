/**
 * LevelSelectScene — SC-002 レベル選択. 15 main + 3 bonus tiles in a 3×6 grid
 * with per-tile stars (0–3, best kept), lock state (sequential unlock), bonus
 * distinction, and a pulse on the next level to play (ui_design_brief §6.2,
 * ux_protocol SC-002, FR-016). Replaying a cleared level is always allowed.
 *
 * DPR-native: extents come from the live `layout` (game px); design offsets/sizes
 * go through `layout.ui()` (research §2.3). Re-anchors on the layout event.
 */

import Phaser from 'phaser';
import { registerDevButton } from '@render/devhook';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { CHAPTER1_TILES, CHAPTER1_TITLE, findNextLevelId, isLevelUnlocked } from '@render/ui/levelCatalog';
import type { LevelTile } from '@render/ui/levelCatalog';
import { getServices } from '@render/ui/services';
import type { GameServices } from '@render/ui/services';
import { color, layout, LAYOUT_EVENT, makeTextStyle, margin, radius, space, stroke, type } from '@render/ui/theme';

// Design px (ui_design_brief §6.2) — ui-scaled to game px at use sites.
const TILE_SIZE = 96;
const TILE_GAP = 16;
const COLS = 3;
const GRID_TOP_Y = 150;
const MAX_STARS = 3;

export class LevelSelectScene extends Phaser.Scene {
  private services!: GameServices;
  private hint: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('LevelSelect');
  }

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);

    const ui = (n: number): number => layout.ui(n);
    const topRowY = layout.safe.top + ui(space.space4 + 22);
    new Button(this, {
      x: layout.safe.left + ui(margin + 22),
      y: topRowY,
      width: 44,
      height: 44,
      label: '←',
      variant: 'secondary',
      services: this.services,
      onClick: () => this.scene.start('Home'),
    });
    this.add
      .text(layout.safe.left + ui(margin + 66), topRowY, CHAPTER1_TITLE, makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0, 0.5);
    new CoinCounter(this, layout.width - layout.safe.right - ui(margin), topRowY, this.services.getBalance());

    const isCleared = (id: string): boolean => this.services.isCleared(id);
    const nextId = findNextLevelId(CHAPTER1_TILES, isCleared);
    const gridWidth = ui(COLS * TILE_SIZE + (COLS - 1) * TILE_GAP);
    const startX = (layout.width - gridWidth) / 2;
    const gridTopY = layout.safe.top + ui(GRID_TOP_Y - 47); // GRID_TOP_Y was measured from the design's 47pt inset

    CHAPTER1_TILES.forEach((tile, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const cx = startX + ui(TILE_SIZE / 2) + col * ui(TILE_SIZE + TILE_GAP);
      const cy = gridTopY + ui(TILE_SIZE / 2) + row * ui(TILE_SIZE + TILE_GAP);
      this.createTile(tile, cx, cy, isLevelUnlocked(tile, isCleared), tile.id === nextId);
    });

    this.subscribeLayout();
  }

  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart();
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  private createTile(tile: LevelTile, cx: number, cy: number, isUnlocked: boolean, isNext: boolean): void {
    const tileSize = layout.ui(TILE_SIZE);
    const container = this.add.container(cx, cy);
    const bestStars = this.services.getProgress(tile.id)?.bestStars ?? 0;

    const fill = !isUnlocked ? color.uiDisabled : tile.isBonus ? color.coin : color.uiSurface;
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, radius.s);
    g.lineStyle(stroke.ui, color.inkBorder, 1);
    g.strokeRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, radius.s);
    container.add(g);

    const numberColor = isUnlocked ? color.textPrimary : color.textSecondary;
    container.add(
      this.add.text(0, -layout.ui(22), tile.label, makeTextStyle(type.h2, numberColor)).setOrigin(0.5),
    );
    if (tile.isBonus) {
      container.add(
        this.add.text(0, -layout.ui(2), 'ボーナス', makeTextStyle({ size: 12, bold: true }, color.textPrimary)).setOrigin(0.5),
      );
    }

    if (!isUnlocked) {
      this.drawLock(container);
    } else {
      this.drawStars(container, bestStars);
    }

    container.setSize(tileSize, tileSize);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-tileSize / 2, -tileSize / 2, tileSize, tileSize),
      Phaser.Geom.Rectangle.Contains,
    );

    if (isUnlocked) {
      if (import.meta.env.DEV) {
        registerDevButton(`level-${tile.id}`, this, () => ({
          x: cx - tileSize / 2,
          y: cy - tileSize / 2,
          width: tileSize,
          height: tileSize,
        }));
      }
      container.on('pointerup', () => {
        this.services.resumeAudio();
        this.services.playTap();
        this.services.uiHaptic();
        this.scene.start('Play', { levelId: tile.id });
      });
      if (isNext) {
        this.tweens.add({
          targets: container,
          scale: 1.05,
          duration: 800,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      container.on('pointerup', () => this.rejectLocked(container));
    }
  }

  private drawStars(container: Phaser.GameObjects.Container, bestStars: number): void {
    const starGap = layout.ui(18);
    for (let i = 0; i < MAX_STARS; i += 1) {
      const isEarned = i < bestStars;
      const glyph = isEarned ? '★' : '☆';
      container.add(
        this.add
          .text((i - 1) * starGap, layout.ui(24), glyph, makeTextStyle({ size: 16, bold: false }, isEarned ? color.star : color.starEmpty))
          .setOrigin(0.5),
      );
    }
  }

  private drawLock(container: Phaser.GameObjects.Container): void {
    const ui = (n: number): number => layout.ui(n);
    const g = this.add.graphics();
    g.lineStyle(stroke.game, color.textSecondary, 1);
    g.strokeCircle(0, ui(20), ui(7)); // shackle (body covers its lower half)
    g.fillStyle(color.textSecondary, 1);
    g.fillRoundedRect(-ui(9), ui(20), ui(18), ui(14), ui(3)); // body
    container.add(g);
  }

  private rejectLocked(container: Phaser.GameObjects.Container): void {
    this.services.resumeAudio();
    this.services.uiHaptic();
    this.tweens.add({
      targets: container,
      x: container.x + layout.ui(6),
      duration: 60,
      ease: 'Quad.easeInOut',
      yoyo: true,
      repeat: 2,
    });
    this.showHint('前のレベルをクリア');
  }

  private showHint(message: string): void {
    this.hint?.destroy();
    this.hint = this.add
      .text(layout.width / 2, layout.height - layout.safe.bottom - layout.ui(8), message, makeTextStyle(type.body, color.uiDanger))
      .setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 900, duration: 400 });
  }
}

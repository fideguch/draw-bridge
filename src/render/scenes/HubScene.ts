/**
 * HubScene — the merged Home + LevelSelect surface (DESIGN.md §2.2 / §6.1).
 *
 * The pre-overhaul build had a marketing Home (wordmark + あそぶ) that only
 * existed to open a separate LevelSelect grid — the exact redundant gate the
 * genre abandoned (DESIGN.md §2.2). This is ONE hub: it opens straight onto the
 * level grid, with a compact wordmark header, a coin pill, a settings gear, a
 * bottom つづきから primary CTA (→ next uncleared level), and a 強化 entry.
 *
 * The grid scrolls vertically (18 tiles / 6 rows won't fit above the bottom bar)
 * via a drag on a `gridLayer` container; sky-coloured bars occlude the tiles that
 * scroll under the header/footer. Tile taps are suppressed when the pointer
 * dragged (so scrolling never mis-fires a level). Dev tap rects report the live
 * scrolled position so E2E stays coherent.
 *
 * DPR-native: positions come from the live `layout` (game px); design offsets go
 * through `layout.ui()` (research §2.3). Re-anchors on the layout event.
 */

import Phaser from 'phaser';
import { registerDevButton } from '@render/devhook';
import { Button } from '@render/ui/Button';
import { CoinCounter } from '@render/ui/CoinCounter';
import { CHAPTER1_TILES, findNextLevelId, isLevelUnlocked } from '@render/ui/levelCatalog';
import type { LevelTile } from '@render/ui/levelCatalog';
import { borderedRoundedRect } from '@render/ui/fillShapes';
import { drawIcon } from '@render/ui/icons';
import { getServices } from '@render/ui/services';
import type { GameServices } from '@render/ui/services';
import { appInfo, color, layout, LAYOUT_EVENT, makeTextStyle, margin, radius, space, stroke, type } from '@render/ui/theme';
import { SAVE_NOTICE_KEY } from './BootScene';
import type { SaveNotice } from '@render/ui/services';

// Design px (DESIGN.md §6.1) — ui-scaled to game px at use sites.
const TILE_SIZE = 96;
const TILE_GAP = 16;
const COLS = 3;
const MAX_STARS = 3;
const TILE_SHADOW_DEPTH = 4;
/** Pointer travel (game px) past which a press counts as a scroll, not a tap. */
const DRAG_TAP_THRESHOLD = 10;

const DEPTH = { grid: 1, barBg: 5, bar: 10, toast: 20 } as const;

export class HubScene extends Phaser.Scene {
  private services!: GameServices;
  private gridLayer!: Phaser.GameObjects.Container;
  private hint: Phaser.GameObjects.Text | null = null;
  private scrollY = 0;
  private minScrollY = 0;
  private dragStartPointerY = 0;
  private dragStartScroll = 0;
  private dragMoved = false;

  constructor() {
    super('Hub');
  }

  private ui(n: number): number {
    return layout.ui(n);
  }

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);
    this.scrollY = 0;

    this.gridLayer = this.add.container(0, 0).setDepth(DEPTH.grid);
    this.buildGrid();
    this.buildTopBar();
    this.buildBottomBar();
    this.installScroll();
    this.showSaveNoticeIfAny();
    this.subscribeLayout();
  }

  // ── top / bottom chrome (fixed, never scrolls) ────────────────────────────

  private get topRowY(): number {
    return layout.safe.top + this.ui(space.space4 + 22);
  }

  private get gridTopY(): number {
    return this.topRowY + this.ui(22 + space.space6);
  }

  /** Continue-CTA vertical centre (thumb zone, DESIGN.md §6.1). */
  private get continueCy(): number {
    return layout.height - layout.safe.bottom - this.ui(64);
  }

  /** 強化 sits above-left of つづきから, tap rects non-intersecting (QG-3). */
  private get upgradeCy(): number {
    return this.continueCy - this.ui(32) - this.ui(space.space4 + 22);
  }

  /** Top edge of the occluding footer bar (grid scrolls under it). */
  private get bottomBarTop(): number {
    return this.upgradeCy - this.ui(22 + space.space2);
  }

  private buildTopBar(): void {
    const topBarBottom = this.topRowY + this.ui(22 + space.space3);
    const topBg = this.add.graphics().setDepth(DEPTH.barBg);
    topBg.fillStyle(color.sky, 1);
    topBg.fillRect(0, 0, layout.width, topBarBottom);

    new Button(this, {
      x: layout.safe.left + this.ui(margin + 22),
      y: this.topRowY,
      size: 'iconM',
      label: '',
      icon: 'gear',
      variant: 'secondary',
      services: this.services,
      devId: 'hub-settings',
      onClick: () => this.scene.start('Settings'),
    }).setDepth(DEPTH.bar);

    this.add
      .text(layout.width / 2, this.topRowY, appInfo.title, makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0.5)
      .setDepth(DEPTH.bar);

    new CoinCounter(this, layout.width - layout.safe.right - this.ui(margin), this.topRowY, this.services.getBalance()).setDepth(
      DEPTH.bar,
    );
  }

  private buildBottomBar(): void {
    const bottomBg = this.add.graphics().setDepth(DEPTH.barBg);
    bottomBg.fillStyle(color.sky, 1);
    bottomBg.fillRect(0, this.bottomBarTop, layout.width, layout.height - this.bottomBarTop);

    const isCleared = (id: string): boolean => this.services.isCleared(id);
    const nextId = findNextLevelId(CHAPTER1_TILES, isCleared);
    const target = nextId ?? CHAPTER1_TILES[0]?.id ?? 'ch1-l01';

    new Button(this, {
      x: layout.width / 2,
      y: this.continueCy,
      size: 'L',
      label: 'つづきから',
      icon: 'play',
      variant: 'primary',
      services: this.services,
      devId: 'hub-continue',
      onClick: () => this.scene.start('Play', { levelId: target }),
    }).setDepth(DEPTH.bar);

    new Button(this, {
      x: layout.safe.left + this.ui(margin + 80),
      y: this.upgradeCy,
      size: 'S',
      label: '強化',
      icon: 'coin',
      variant: 'secondary',
      services: this.services,
      devId: 'hub-upgrade',
      onClick: () => this.scene.start('Upgrade', { returnScene: 'Hub' }),
    }).setDepth(DEPTH.bar);
  }

  // ── level grid (scrolls) ──────────────────────────────────────────────────

  private buildGrid(): void {
    const isCleared = (id: string): boolean => this.services.isCleared(id);
    const nextId = findNextLevelId(CHAPTER1_TILES, isCleared);
    const gridWidth = this.ui(COLS * TILE_SIZE + (COLS - 1) * TILE_GAP);
    const startX = (layout.width - gridWidth) / 2;

    let lastBottom = this.gridTopY;
    CHAPTER1_TILES.forEach((tile, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const cx = startX + this.ui(TILE_SIZE / 2) + col * this.ui(TILE_SIZE + TILE_GAP);
      const cy = this.gridTopY + this.ui(TILE_SIZE / 2) + row * this.ui(TILE_SIZE + TILE_GAP);
      this.createTile(tile, cx, cy, isLevelUnlocked(tile, isCleared), tile.id === nextId);
      lastBottom = cy + this.ui(TILE_SIZE / 2);
    });

    // Scroll range: content that overflows the footer bar can be dragged up.
    const overflow = lastBottom - this.bottomBarTop + this.ui(space.space4);
    this.minScrollY = overflow > 0 ? -overflow : 0;
  }

  private installScroll(): void {
    if (this.minScrollY >= 0) {
      return; // everything fits — no scroll wiring
    }
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.dragStartPointerY = pointer.y;
      this.dragStartScroll = this.scrollY;
      this.dragMoved = false;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) {
        return;
      }
      const dy = pointer.y - this.dragStartPointerY;
      if (Math.abs(dy) > DRAG_TAP_THRESHOLD) {
        this.dragMoved = true;
      }
      this.scrollY = Phaser.Math.Clamp(this.dragStartScroll + dy, this.minScrollY, 0);
      this.gridLayer.y = this.scrollY;
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: unknown, _o: unknown, _dx: number, dyWheel: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dyWheel, this.minScrollY, 0);
      this.gridLayer.y = this.scrollY;
    });
  }

  private createTile(tile: LevelTile, cx: number, cy: number, isUnlocked: boolean, isNext: boolean): void {
    const tileSize = this.ui(TILE_SIZE);
    const depth = this.ui(TILE_SHADOW_DEPTH);
    const container = this.add.container(cx, cy);
    this.gridLayer.add(container);
    const bestStars = this.services.getProgress(tile.id)?.bestStars ?? 0;

    const fill = !isUnlocked ? color.uiDisabled : tile.isBonus ? color.coin : color.uiSurface;
    // Chunky shadow for unlocked tiles; locked tiles stay FLAT (DESIGN.md §4.4).
    if (isUnlocked) {
      const shadow = this.add.graphics();
      shadow.fillStyle(tile.isBonus ? color.uiPremiumShadow : color.uiSecondaryShadow, 1);
      shadow.fillRoundedRect(-tileSize / 2, -tileSize / 2 + depth, tileSize, tileSize, radius.m);
      container.add(shadow);
    }
    const g = this.add.graphics();
    borderedRoundedRect(g, -tileSize / 2, -tileSize / 2, tileSize, tileSize, radius.m, {
      fill,
      border: color.inkBorder,
      borderWidth: stroke.ui,
    });
    container.add(g);

    const numberColor = isUnlocked ? color.textPrimary : color.textSecondary;
    container.add(this.add.text(0, -this.ui(22), tile.label, makeTextStyle(type.h2, numberColor)).setOrigin(0.5));
    if (tile.isBonus) {
      container.add(this.add.text(0, -this.ui(2), 'ボーナス', makeTextStyle(type.labelSmall, color.textPrimary)).setOrigin(0.5));
    }

    if (!isUnlocked) {
      this.drawLock(container);
    } else {
      this.drawStars(container, bestStars);
    }

    container.setSize(tileSize, tileSize);
    // (0,0,w,h) hit rect — see Button.ts note on the Phaser 4 displayOrigin quirk.
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, tileSize, tileSize), Phaser.Geom.Rectangle.Contains);

    if (isUnlocked) {
      if (import.meta.env.DEV) {
        registerDevButton(`level-${tile.id}`, this, () => ({
          x: cx - tileSize / 2,
          y: cy + this.gridLayer.y - tileSize / 2,
          width: tileSize,
          height: tileSize,
        }));
      }
      container.on('pointerup', () => {
        if (this.dragMoved) {
          return; // this pointer was a scroll drag, not a tap
        }
        this.services.resumeAudio();
        this.services.playTap();
        this.services.uiHaptic();
        this.scene.start('Play', { levelId: tile.id });
      });
      if (isNext) {
        this.tweens.add({ targets: container, scale: 1.05, duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      }
    } else {
      container.on('pointerup', () => {
        if (this.dragMoved) {
          return;
        }
        this.rejectLocked(container);
      });
    }
  }

  private drawStars(container: Phaser.GameObjects.Container, bestStars: number): void {
    const starGap = this.ui(18);
    for (let i = 0; i < MAX_STARS; i += 1) {
      const isEarned = i < bestStars;
      const glyph = isEarned ? '★' : '☆';
      container.add(
        this.add
          .text((i - 1) * starGap, this.ui(24), glyph, makeTextStyle({ size: 16, bold: false }, isEarned ? color.star : color.starEmpty))
          .setOrigin(0.5),
      );
    }
  }

  private drawLock(container: Phaser.GameObjects.Container): void {
    const g = this.add.graphics();
    // Shared padlock icon so tile + button locks look identical (DESIGN.md §4.4).
    drawIcon(g, 'lock', this.ui(30), { color: color.textSecondary, holeColor: color.uiDisabled });
    g.setPosition(0, this.ui(22));
    container.add(g);
  }

  private rejectLocked(container: Phaser.GameObjects.Container): void {
    this.services.resumeAudio();
    this.services.uiHaptic();
    this.tweens.add({
      targets: container,
      x: container.x + this.ui(6),
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
      .text(layout.width / 2, this.bottomBarTop - this.ui(space.space4), message, makeTextStyle(type.body, color.uiDanger))
      .setOrigin(0.5)
      .setDepth(DEPTH.toast);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 900, duration: 400 });
  }

  private subscribeLayout(): void {
    const onLayout = (): void => {
      this.scene.restart();
    };
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  /** Surface a one-shot corruption-restore notice (FR-021 — never silent). */
  private showSaveNoticeIfAny(): void {
    const notice = this.registry.get(SAVE_NOTICE_KEY) as SaveNotice | undefined;
    if (notice === undefined) {
      return;
    }
    this.registry.remove(SAVE_NOTICE_KEY);
    const message = notice.fullReset ? '進行データを復元できませんでした' : '一部の進行データを復元できませんでした';
    this.add
      .text(layout.width / 2, this.topRowY + this.ui(space.space8), message, makeTextStyle(type.caption, color.uiDanger))
      .setOrigin(0.5)
      .setDepth(DEPTH.toast);
  }
}

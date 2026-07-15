/**
 * StrokeInput — pointer capture for the drawing phase (T046, FR-001, SC-003).
 *
 * Captures a single stroke from pointer events on a Phaser scene and emits its
 * vertices in WORLD METRES (the coordinate GameSimulation.commitStroke expects).
 * Screen -> world uses the injected camera (getWorldPoint) then WorldToPixel's
 * inverse, so it is correct at any camera scroll/zoom.
 *
 * Thinning (game_design §4.1 1-2): a vertex is appended only once the pointer
 * has travelled >= minVertexDistancePx in SCREEN space (draw.minPointDistPx by
 * default) — a screen-space gate so it is zoom-independent. NO smoothing here:
 * smoothing is a render-only, past-only concern (StrokeRenderer). The raw tip is
 * always emitted verbatim on pointerup so the committed line reaches the finger.
 *
 * The caller owns policy: `canDraw` gates whether a stroke may start / grow (ink
 * remaining, correct phase, one-stroke-per-attempt); StrokeInput never talks to
 * the engine. Emits onStrokeStart / onStrokePoint / onStrokeEnd.
 */

import type Phaser from 'phaser';
import type { Point } from '@engine/level/LevelSchema';
import { layout } from '@render/ui/theme';
import { draw } from '@tuning/TuningConstants';
import { shouldAppendPoint } from './strokeMath';
import type { WorldToPixel } from '@render/world/worldToPixel';

export interface StrokeInputCallbacks {
  /** Pointer went down and a stroke began (first vertex, world metres). */
  readonly onStrokeStart?: (worldPoint: Point) => void;
  /** A vertex was appended (world metres). */
  readonly onStrokePoint?: (worldPoint: Point) => void;
  /** Pointer released — the full committed polyline (world metres, >= 1 point). */
  readonly onStrokeEnd?: (worldPoints: readonly Point[]) => void;
}

export interface StrokeInputOptions {
  /** Metre <-> world-pixel transform (its inverse turns pointer px into metres). */
  readonly transform: WorldToPixel;
  /** Camera that maps screen -> world pixels (the drawing-phase overview cam). */
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  /** Screen-space min vertex distance in px. Default draw.minPointDistPx. */
  readonly minVertexDistancePx?: number;
  /** Gate: may a stroke start / keep growing? Default always true. */
  readonly canDraw?: () => boolean;
  readonly callbacks?: StrokeInputCallbacks;
}

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export class StrokeInput {
  private readonly scene: Phaser.Scene;
  private transform: WorldToPixel;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly minVertexDistancePx: number;
  private readonly canDraw: () => boolean;
  private readonly callbacks: StrokeInputCallbacks;

  private readonly points: Point[] = [];
  private lastScreen: ScreenPoint | null = null;
  private isDrawing = false;
  private isEnabled = false;

  constructor(scene: Phaser.Scene, options: StrokeInputOptions) {
    this.scene = scene;
    this.transform = options.transform;
    this.camera = options.camera;
    // draw.minPointDistPx is a CSS-px design value; game px are device px now
    // (DPR-native canvas), so scale it or sampling becomes ~3x too dense —
    // which made the O(n) live repaint freeze the main thread (2026-07-08).
    this.minVertexDistancePx = options.minVertexDistancePx ?? draw.minPointDistPx * layout.dpr;
    this.canDraw = options.canDraw ?? ((): boolean => true);
    this.callbacks = options.callbacks ?? {};
  }

  /** Swap the metre↔pixel transform (device resize re-frames the world, T045). */
  setTransform(transform: WorldToPixel): void {
    this.transform = transform;
  }

  /** Start listening for pointer events. Idempotent. */
  enable(): void {
    if (this.isEnabled) {
      return;
    }
    this.isEnabled = true;
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /** Stop listening and cancel any in-progress stroke (no onStrokeEnd). */
  disable(): void {
    if (!this.isEnabled) {
      return;
    }
    this.isEnabled = false;
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.resetStroke();
  }

  destroy(): void {
    this.disable();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isDrawing || !this.canDraw()) {
      return;
    }
    this.isDrawing = true;
    this.points.length = 0;
    const worldPoint = this.toWorld(pointer);
    this.points.push(worldPoint);
    this.lastScreen = { x: pointer.x, y: pointer.y };
    this.callbacks.onStrokeStart?.(worldPoint);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing || !pointer.isDown) {
      return;
    }
    // Ink depleted (or otherwise gated): stop growing but keep the stroke live
    // so releasing still commits what was drawn (game_design §2 Drawing rule).
    if (!this.canDraw()) {
      return;
    }
    const candidateScreen: ScreenPoint = { x: pointer.x, y: pointer.y };
    if (this.lastScreen !== null && !shouldAppendPoint(this.lastScreen, candidateScreen, this.minVertexDistancePx)) {
      return;
    }
    const worldPoint = this.toWorld(pointer);
    this.points.push(worldPoint);
    this.lastScreen = candidateScreen;
    this.callbacks.onStrokePoint?.(worldPoint);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing) {
      return;
    }
    // Always include the raw release point so the committed line reaches the tip.
    const tip = this.toWorld(pointer);
    const last = this.points[this.points.length - 1];
    if (last === undefined || tip.x !== last.x || tip.y !== last.y) {
      this.points.push(tip);
    }
    const committed = this.points.map((p) => ({ x: p.x, y: p.y }));
    this.resetStroke();
    this.callbacks.onStrokeEnd?.(committed);
  }

  private toWorld(pointer: Phaser.Input.Pointer): Point {
    const worldPixel = this.camera.getWorldPoint(pointer.x, pointer.y);
    return this.transform.toWorld(worldPixel.x, worldPixel.y);
  }

  private resetStroke(): void {
    this.isDrawing = false;
    this.points.length = 0;
    this.lastScreen = null;
  }
}

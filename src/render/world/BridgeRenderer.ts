/**
 * BridgeRenderer — the solidified stroke as a smooth, stress-tinted bridge
 * (T047, FR-003, FR-006, game_design §3.1 "描画層" / §4.2 2-6).
 *
 * Physics is N capsule segments (BridgeChainBuilder method C); rendering keeps
 * physics N and draw vertices separate: it reads the live segment-body centres
 * (interpolated across the fixed step) and draws ONE Catmull-Rom spline through
 * them per UN-BROKEN run of the chain. A broken joint splits the run; the two
 * new ends get a small jagged "torn" cap. Each span is tinted by its joint's
 * stress via stressColor (white -> yellow -> red), and detached fragments fade
 * out over their orphan timer (StressTracker.orphans()).
 *
 * Stress + break state are POLLED from the StressTracker getters (stressAt /
 * isBroken / orphans) — read-only observation, never a write back to the engine.
 * Method A (compound) has no joints/stress: it draws a single plain spline by
 * rigidly transforming the build-time segment centres by the one body's pose.
 */

import type Phaser from 'phaser';
import type { BridgeChain } from '@engine/physics/BridgeChainBuilder';
import type { StressTracker } from '@engine/physics/StressTracker';
import { color } from '@render/ui/theme';
import { screen } from '@render/ui/theme';
import { bridge, draw } from '@tuning/TuningConstants';
import { clamp } from '@render/juice/cameraMath';
import { catmullRom } from '@render/draw/strokeMath';
import { stressColor } from './renderColors';
import { readBodyPose } from './bodyPose';
import { StepInterpolator, type Pose } from './StepInterpolator';
import type { PixelPoint, WorldToPixel } from './worldToPixel';

/** Centre point in world metres (the spline control points). */
interface Center {
  readonly x: number;
  readonly y: number;
}

export interface BridgeRendererOptions {
  /** Poll this tracker for stress/break/orphan state (chain method only). */
  readonly stressTracker?: StressTracker;
  readonly depth?: number;
  /** Line width in px. Default draw.lineWidthScreenPct of screen width. */
  readonly lineWidthPx?: number;
  /** Dark border width per side in px. Default draw.borderWidthPx. */
  readonly borderWidthPx?: number;
}

const SUBDIVISIONS = 6;

export class BridgeRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly chain: BridgeChain;
  private readonly transform: WorldToPixel;
  private readonly stressTracker: StressTracker | undefined;
  private readonly interpolator = new StepInterpolator();
  private readonly lineWidthPx: number;
  private readonly borderWidthPx: number;

  // Compound (method A) rigid reconstruction: build-time centres in body-local
  // space + the body's initial pose (segments are created with identity rotation).
  private readonly compoundLocalCenters: readonly Center[];
  private readonly compoundInitial: Pose;

  constructor(scene: Phaser.Scene, chain: BridgeChain, transform: WorldToPixel, options: BridgeRendererOptions = {}) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.chain = chain;
    this.transform = transform;
    this.stressTracker = chain.method === 'chain' ? options.stressTracker : undefined;
    this.lineWidthPx = options.lineWidthPx ?? (draw.lineWidthScreenPct / 100) * screen.width;
    this.borderWidthPx = options.borderWidthPx ?? draw.borderWidthPx;

    const firstBody = chain.bodies[0];
    this.compoundInitial =
      chain.method === 'compound' && firstBody !== undefined
        ? readBodyPose(firstBody)
        : { x: 0, y: 0, angle: 0 };
    this.compoundLocalCenters =
      chain.method === 'compound'
        ? chain.segments.map((segment) => ({
            x: (segment.a.x + segment.b.x) / 2 - this.compoundInitial.x,
            y: (segment.a.y + segment.b.y) / 2 - this.compoundInitial.y,
          }))
        : [];
  }

  update(alpha: number): void {
    this.graphics.clear();
    const centers = this.readCenters(alpha);
    if (centers.length < 1) {
      return;
    }
    for (const run of this.splitIntoRuns(centers)) {
      this.drawRun(centers, run);
    }
  }

  /** Forget interpolation history on attempt restart. */
  reset(): void {
    this.interpolator.reset();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  // ── centre extraction (interpolated) ────────────────────────────────────────

  private readCenters(alpha: number): Center[] {
    const poses = this.interpolator.sample(alpha, () => this.readLivePoses());
    if (this.chain.method === 'chain') {
      // One body per segment: its origin IS the segment centre.
      return poses.map((pose) => ({ x: pose.x, y: pose.y }));
    }
    // Compound: rigidly transform the build-time local centres by the one body.
    const body = poses[0];
    if (body === undefined) {
      return [];
    }
    const deltaAngle = body.angle - this.compoundInitial.angle;
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    return this.compoundLocalCenters.map((local) => ({
      x: body.x + local.x * cos - local.y * sin,
      y: body.y + local.x * sin + local.y * cos,
    }));
  }

  private readLivePoses(): Pose[] {
    return this.chain.bodies.map((bodyId) => readBodyPose(bodyId));
  }

  // ── runs (split at broken joints) ───────────────────────────────────────────

  /** Contiguous [start, end] index ranges not separated by a broken joint. */
  private splitIntoRuns(centers: readonly Center[]): Array<{ readonly start: number; readonly end: number }> {
    const runs: Array<{ start: number; end: number }> = [];
    let start = 0;
    for (let i = 0; i < centers.length; i++) {
      const isBoundaryBroken = i < centers.length - 1 && this.isJointBroken(i);
      if (isBoundaryBroken || i === centers.length - 1) {
        runs.push({ start, end: i });
        if (isBoundaryBroken) {
          start = i + 1;
        }
      }
    }
    return runs;
  }

  private isJointBroken(jointIndex: number): boolean {
    return this.stressTracker?.isBroken(jointIndex) ?? false;
  }

  private jointStress(jointIndex: number): number {
    return this.stressTracker?.stressAt(jointIndex) ?? 0;
  }

  /** Fade alpha for a segment (1 normally; ramps to 0 over the orphan timer). */
  private segmentAlpha(segmentIndex: number): number {
    if (this.stressTracker === undefined) {
      return 1;
    }
    for (const orphan of this.stressTracker.orphans()) {
      if (orphan.segmentIndex === segmentIndex) {
        return orphan.expired ? 0 : clamp(orphan.fadeRemainingSec / bridge.debrisFadeDelaySec, 0, 1);
      }
    }
    return 1;
  }

  // ── drawing ─────────────────────────────────────────────────────────────────

  private drawRun(centers: readonly Center[], run: { readonly start: number; readonly end: number }): void {
    let runAlpha = 1;
    for (let seg = run.start; seg <= run.end; seg++) {
      runAlpha = Math.min(runAlpha, this.segmentAlpha(seg));
    }
    if (runAlpha <= 0) {
      return;
    }

    const pixels: PixelPoint[] = [];
    for (let i = run.start; i <= run.end; i++) {
      pixels.push(this.transform.point(centers[i] as Center));
    }
    const first = pixels[0];
    if (first === undefined) {
      return;
    }
    if (pixels.length === 1) {
      this.drawDot(first, this.lineWidthPx / 2, color.inkLine, runAlpha);
      return;
    }

    // 1) Border underlay: whole smoothed run in one dark stroke.
    const smoothed = this.smoothRun(pixels);
    this.strokePolyline(smoothed, this.lineWidthPx + this.borderWidthPx * 2, color.inkBorder, runAlpha);
    for (const point of pixels) {
      this.drawDot(point, (this.lineWidthPx + this.borderWidthPx * 2) / 2, color.inkBorder, runAlpha);
    }

    // 2) Ink pass: each span tinted by its joint's stress.
    for (let local = 0; local < pixels.length - 1; local++) {
      const jointIndex = run.start + local; // joint between centre local and local+1
      const spanColor = stressColor(this.jointStress(jointIndex));
      this.strokePolyline(this.smoothSpan(pixels, local), this.lineWidthPx, spanColor, runAlpha);
    }
    for (let local = 0; local < pixels.length; local++) {
      const point = pixels[local] as PixelPoint;
      const nearestJoint = run.start + Math.min(local, pixels.length - 2);
      this.drawDot(point, this.lineWidthPx / 2, stressColor(this.jointStress(nearestJoint)), runAlpha);
    }

    // 3) Jagged "torn" caps at ends that are breaks (not the true chain ends).
    if (run.start > 0) {
      this.drawTornCap(pixels[0] as PixelPoint, pixels[1] as PixelPoint, runAlpha);
    }
    if (run.end < centers.length - 1) {
      this.drawTornCap(pixels[pixels.length - 1] as PixelPoint, pixels[pixels.length - 2] as PixelPoint, runAlpha);
    }
  }

  /** Full smoothed polyline through all run centres (border pass). */
  private smoothRun(centers: readonly PixelPoint[]): PixelPoint[] {
    const out: PixelPoint[] = [centers[0] as PixelPoint];
    for (let j = 0; j < centers.length - 1; j++) {
      for (let s = 1; s <= SUBDIVISIONS; s++) {
        out.push(this.spanPoint(centers, j, s / SUBDIVISIONS));
      }
    }
    return out;
  }

  /** Smoothed sub-polyline for span j (centre j -> centre j+1 inclusive). */
  private smoothSpan(centers: readonly PixelPoint[], j: number): PixelPoint[] {
    const out: PixelPoint[] = [centers[j] as PixelPoint];
    for (let s = 1; s <= SUBDIVISIONS; s++) {
      out.push(this.spanPoint(centers, j, s / SUBDIVISIONS));
    }
    return out;
  }

  private spanPoint(centers: readonly PixelPoint[], j: number, t: number): PixelPoint {
    const n = centers.length;
    const at = (i: number): PixelPoint => centers[Math.min(Math.max(i, 0), n - 1)] as PixelPoint;
    return catmullRom(at(j - 1), at(j), at(j + 1), at(j + 2), t);
  }

  private strokePolyline(pixels: readonly PixelPoint[], width: number, colorValue: number, alpha: number): void {
    const first = pixels[0];
    if (first === undefined) {
      return;
    }
    this.graphics.lineStyle(width, colorValue, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(first.x, first.y);
    for (let i = 1; i < pixels.length; i++) {
      const point = pixels[i] as PixelPoint;
      this.graphics.lineTo(point.x, point.y);
    }
    this.graphics.strokePath();
  }

  private drawDot(point: PixelPoint, radius: number, colorValue: number, alpha: number): void {
    this.graphics.fillStyle(colorValue, alpha);
    this.graphics.fillCircle(point.x, point.y, radius);
  }

  /** A small zigzag notch at a broken end (game_design "折れ口ギザギザ"). */
  private drawTornCap(end: PixelPoint, neighbor: PixelPoint, alpha: number): void {
    const dx = end.x - neighbor.x;
    const dy = end.y - neighbor.y;
    const length = Math.hypot(dx, dy) || 1;
    const dirX = dx / length;
    const dirY = dy / length;
    const perpX = -dirY;
    const perpY = dirX;
    const amp = this.lineWidthPx * 0.6;
    const reach = this.lineWidthPx * 0.9;
    this.graphics.lineStyle(this.borderWidthPx * 2, color.stressHigh, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(end.x - perpX * amp, end.y - perpY * amp);
    this.graphics.lineTo(end.x + dirX * reach, end.y + dirY * reach);
    this.graphics.lineTo(end.x + perpX * amp, end.y + perpY * amp);
    this.graphics.strokePath();
  }
}

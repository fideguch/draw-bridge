/**
 * BridgeRenderer — the solidified stroke as a smooth, stress-tinted bridge
 * (T047, FR-003, FR-006, game_design §3.1 "描画層" / §4.2 2-6).
 *
 * Physics is N capsule segments (BridgeChainBuilder method C); rendering keeps
 * physics N and draw vertices separate. Each render CONTROL POINT list runs
 * through the live segment poses (interpolated across the fixed step), and the
 * spline is drawn as ONE Catmull-Rom curve per UN-BROKEN run of the chain. A
 * broken joint splits the run; the two new ends get a small jagged "torn" cap.
 * Each span is tinted by its joint's stress via stressColor (white -> yellow ->
 * red), and detached fragments fade out over their orphan timer.
 *
 * SHAPE FIDELITY (game-feel rebuild 2026-07-08): the control points are NOT just
 * the N body centres — they interleave, per segment, the segment's capsule
 * ENDPOINTS (the joint anchors, which sit on the drawn stroke) with the body
 * centre, plus the two true outer endpoints. So the rendered curve passes
 * through the drawn apex even at a low segment count, instead of chording flat
 * below the arc (the "line reverts to straight" render symptom).
 *
 * Stress + break state are POLLED from the StressTracker getters (stressAt /
 * isBroken / orphans) — read-only observation, never a write back to the engine.
 * Method A (compound) has no joints/stress: it draws a single plain spline by
 * rigidly transforming the build-time segment geometry by the one body's pose.
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

/** A point in world metres (a spline control point before pixel projection). */
interface Center {
  readonly x: number;
  readonly y: number;
}

/** Live world geometry of one chain segment body (centre + capsule endpoints). */
interface SegmentGeometry {
  readonly center: Center;
  /** World position of the capsule 'a' endpoint (segment start). */
  readonly epA: Center;
  /** World position of the capsule 'b' endpoint (segment end). */
  readonly epB: Center;
}

/** One spline control point: a world position + the joint index that tints it. */
interface RenderNode {
  readonly world: Center;
  readonly joint: number;
}

/** A contiguous, un-broken run of control points spanning bodies [segStart, segEnd]. */
interface RenderRun {
  readonly nodes: readonly RenderNode[];
  readonly segStart: number;
  readonly segEnd: number;
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

  // Compound (method A) rigid reconstruction: build-time segment endpoints in
  // body-local space + the body's initial pose (created with identity rotation).
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
  }

  update(alpha: number): void {
    this.graphics.clear();
    const runs = this.chain.method === 'chain' ? this.buildChainRuns(alpha) : this.buildCompoundRuns(alpha);
    for (const run of runs) {
      this.drawRun(run);
    }
  }

  /** Forget interpolation history on attempt restart. */
  reset(): void {
    this.interpolator.reset();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  // ── control-point extraction ────────────────────────────────────────────────

  private readLivePoses(): Pose[] {
    return this.chain.bodies.map((bodyId) => readBodyPose(bodyId));
  }

  /** Per-body live geometry: centre + both rotated capsule endpoints (chain). */
  private readChainGeometry(alpha: number): SegmentGeometry[] {
    const poses = this.interpolator.sample(alpha, () => this.readLivePoses());
    const geometry: SegmentGeometry[] = [];
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i] as Pose;
      const center: Center = { x: pose.x, y: pose.y };
      const segment = this.chain.segments[i];
      if (segment === undefined) {
        geometry.push({ center, epA: center, epB: center });
        continue;
      }
      // Build-time capsule half-vector (endpoint - segment midpoint); bodies are
      // built with identity rotation, so the live rotation applies directly.
      const halfX = (segment.a.x - segment.b.x) / 2;
      const halfY = (segment.a.y - segment.b.y) / 2;
      const cos = Math.cos(pose.angle);
      const sin = Math.sin(pose.angle);
      const rotX = halfX * cos - halfY * sin;
      const rotY = halfX * sin + halfY * cos;
      geometry.push({
        center,
        epA: { x: pose.x + rotX, y: pose.y + rotY },
        epB: { x: pose.x - rotX, y: pose.y - rotY },
      });
    }
    return geometry;
  }

  /**
   * Chain control points: for each un-broken body i, the sequence
   *   epA_i (run start only), centre_i, jointAnchor_i (= midpoint of epB_i and
   *   epA_{i+1}), ... , epB_last (run end).
   * A broken joint closes the current run at the tear (epB of the left body) and
   * opens the next run at epA of the right body — so the curve visibly splits.
   */
  private buildChainRuns(alpha: number): RenderRun[] {
    const geometry = this.readChainGeometry(alpha);
    const n = geometry.length;
    if (n === 0) {
      return [];
    }
    const jointCount = n - 1;
    const clampJoint = (value: number): number => Math.max(0, Math.min(Math.max(0, jointCount - 1), value));

    const runs: RenderRun[] = [];
    let nodes: RenderNode[] = [];
    let segStart = 0;
    for (let i = 0; i < n; i++) {
      const g = geometry[i] as SegmentGeometry;
      if (nodes.length === 0) {
        segStart = i;
        nodes.push({ world: g.epA, joint: clampJoint(i) });
      }
      nodes.push({ world: g.center, joint: clampJoint(i) });

      const isLastBody = i === n - 1;
      if (!isLastBody && this.isJointBroken(i)) {
        nodes.push({ world: g.epB, joint: clampJoint(i) }); // close the left side at the tear
        runs.push({ nodes, segStart, segEnd: i });
        nodes = [];
      } else if (!isLastBody) {
        const next = geometry[i + 1] as SegmentGeometry;
        nodes.push({ world: midpoint(g.epB, next.epA), joint: i }); // shared joint anchor = drawn apex
      } else {
        nodes.push({ world: g.epB, joint: clampJoint(i) }); // true far endpoint
        runs.push({ nodes, segStart, segEnd: i });
        nodes = [];
      }
    }
    return runs;
  }

  /**
   * Compound control points: the whole drawn polyline (resampled vertices)
   * rigidly transformed by the single body's pose — one plain run, no joints.
   */
  private buildCompoundRuns(alpha: number): RenderRun[] {
    const poses = this.interpolator.sample(alpha, () => this.readLivePoses());
    const body = poses[0];
    const segments = this.chain.segments;
    if (body === undefined || segments.length === 0) {
      return [];
    }
    const deltaAngle = body.angle - this.compoundInitial.angle;
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    const toWorld = (point: Center): Center => {
      const localX = point.x - this.compoundInitial.x;
      const localY = point.y - this.compoundInitial.y;
      return { x: body.x + localX * cos - localY * sin, y: body.y + localX * sin + localY * cos };
    };
    const first = segments[0] as { a: Center; b: Center };
    const nodes: RenderNode[] = [{ world: toWorld(first.a), joint: 0 }];
    for (const segment of segments) {
      nodes.push({ world: toWorld(segment.b), joint: 0 });
    }
    return [{ nodes, segStart: 0, segEnd: segments.length - 1 }];
  }

  // ── break / stress / orphan polling ─────────────────────────────────────────

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

  private drawRun(run: RenderRun): void {
    let runAlpha = 1;
    for (let seg = run.segStart; seg <= run.segEnd; seg++) {
      runAlpha = Math.min(runAlpha, this.segmentAlpha(seg));
    }
    if (runAlpha <= 0) {
      return;
    }

    const nodes = run.nodes;
    const pixels: PixelPoint[] = nodes.map((node) => this.transform.point(node.world));
    const first = pixels[0];
    if (first === undefined) {
      return;
    }
    if (pixels.length === 1) {
      this.drawDot(first, this.lineWidthPx / 2, color.inkLine, runAlpha);
      return;
    }

    // 1) Border underlay: whole smoothed run in one dark stroke.
    const smoothed = this.smoothWhole(pixels);
    this.strokePolyline(smoothed, this.lineWidthPx + this.borderWidthPx * 2, color.inkBorder, runAlpha);
    for (const point of pixels) {
      this.drawDot(point, (this.lineWidthPx + this.borderWidthPx * 2) / 2, color.inkBorder, runAlpha);
    }

    // 2) Ink pass: each span tinted by its adjacent joints' stress.
    for (let k = 0; k < pixels.length - 1; k++) {
      const stress = Math.max(
        this.jointStress((nodes[k] as RenderNode).joint),
        this.jointStress((nodes[k + 1] as RenderNode).joint),
      );
      this.strokePolyline(this.smoothSpan(pixels, k), this.lineWidthPx, stressColor(stress), runAlpha);
    }
    for (let k = 0; k < pixels.length; k++) {
      const point = pixels[k] as PixelPoint;
      this.drawDot(point, this.lineWidthPx / 2, stressColor(this.jointStress((nodes[k] as RenderNode).joint)), runAlpha);
    }

    // 3) Jagged "torn" caps at ends that are breaks (not the true chain ends).
    const lastSegment = this.chain.segments.length - 1;
    if (run.segStart > 0) {
      this.drawTornCap(pixels[0] as PixelPoint, pixels[1] as PixelPoint, runAlpha);
    }
    if (run.segEnd < lastSegment) {
      this.drawTornCap(pixels[pixels.length - 1] as PixelPoint, pixels[pixels.length - 2] as PixelPoint, runAlpha);
    }
  }

  /** Full smoothed polyline through all run control points (border pass). */
  private smoothWhole(points: readonly PixelPoint[]): PixelPoint[] {
    const out: PixelPoint[] = [points[0] as PixelPoint];
    for (let j = 0; j < points.length - 1; j++) {
      for (let s = 1; s <= SUBDIVISIONS; s++) {
        out.push(this.spanPoint(points, j, s / SUBDIVISIONS));
      }
    }
    return out;
  }

  /** Smoothed sub-polyline for span j (point j -> point j+1 inclusive). */
  private smoothSpan(points: readonly PixelPoint[], j: number): PixelPoint[] {
    const out: PixelPoint[] = [points[j] as PixelPoint];
    for (let s = 1; s <= SUBDIVISIONS; s++) {
      out.push(this.spanPoint(points, j, s / SUBDIVISIONS));
    }
    return out;
  }

  private spanPoint(points: readonly PixelPoint[], j: number, t: number): PixelPoint {
    const n = points.length;
    const at = (i: number): PixelPoint => points[Math.min(Math.max(i, 0), n - 1)] as PixelPoint;
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

/** Midpoint of two world points. */
function midpoint(a: Center, b: Center): Center {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

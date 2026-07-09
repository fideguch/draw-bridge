/**
 * RockRenderer — rolling/falling rock hazards drawn from the live RockHazard
 * bodies (competitor-documented "block the object with your line" mechanic).
 *
 * Round-7 hazard-visibility overhaul (Discord: "障害物の視認性が終わってる"): the rock
 * now speaks the RESERVED hazard signal language (DESIGN.md §4.9) so it screams
 * DANGER at thumbnail size on BOTH sky and terrain. Reads each rock body transform
 * every frame (interpolated across the fixed step like VehicleRenderer) and draws,
 * FILL-ONLY (no Graphics stroke* — research 08_mobile_quality §3):
 *   - a heavy DARK CHARCOAL boulder (charcoal body + near-black rim) — not the old
 *     low-contrast slate disc,
 *   - a ring of RED-ORANGE crack facets + a glowing core fissure, rotated by the
 *     ACTUAL body angle so a rolling rock visibly spins (odd count = no 90° repeat),
 *   - MOTION STREAKS trailing a fast-moving rock (redundant motion coding).
 *
 * Rotation sign: world is y-up, the render frame is y-down (worldToPixel), so a
 * world angle θ renders as screen angle -θ (identical convention to VehicleRenderer).
 *
 * TRIGGERED rocks (round-6): before its trigger a rock is ARMED — it has no body
 * yet, so it is drawn at its spawn as a bold amber warning: a pulsing "incoming"
 * aura + a "!" glyph + a DROP BEAM down to a ground TARGET RETICLE at the predicted
 * landing lane (fairness: the player SEES the threat AND where it lands). Once the
 * car reaches triggerCarX the engine spawns the body and the same slot renders as a
 * solid boulder. renderState() returns every slot (armed + live) in a stable order,
 * so the armed->live handover is seamless.
 */

import type Phaser from 'phaser';
import type { RockHazard } from '@engine/physics/RockHazard';
import { borderedCircle, fillRing, fillThickPolyline, type Vec2 } from '@render/ui/fillShapes';
import { color } from '@render/ui/theme';
import { hazardRender } from '@tuning/TuningConstants';
import { StepInterpolator, type Pose } from './StepInterpolator';
import type { PixelPoint, WorldToPixel } from './worldToPixel';

export interface RockRendererOptions {
  readonly depth?: number;
}

/** Crack-facet ring count — odd so a spinning rock never reads as 90°-symmetric. */
const FACET_COUNT = 7;

export class RockRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hazard: RockHazard;
  private readonly transform: WorldToPixel;
  private readonly interpolator = new StepInterpolator();
  /** Per-slot radius in px, same order as hazard.renderState(). */
  private readonly radiiPx: readonly number[];
  /** Downward drop-beam length (px) for the armed warning. */
  private readonly beamLengthPx: number;
  /** Monotonic phase for the armed-rock warning pulse (render-only, not physics). */
  private pulsePhase = 0;
  /** Previous per-slot pixel position (screen-space velocity for motion streaks). */
  private prevPx: (PixelPoint | undefined)[] = [];

  constructor(scene: Phaser.Scene, hazard: RockHazard, transform: WorldToPixel, options: RockRendererOptions = {}) {
    this.graphics = scene.add.graphics();
    if (options.depth !== undefined) {
      this.graphics.setDepth(options.depth);
    }
    this.hazard = hazard;
    this.transform = transform;
    this.radiiPx = hazard.radii.map((r) => transform.length(r));
    this.beamLengthPx = transform.length(hazardRender.warnBeamLengthM);
  }

  update(alpha: number): void {
    if (this.hazard.count === 0) {
      return;
    }
    this.pulsePhase += hazardRender.warnPulseSpeed;
    // Live poses interpolate for smoothness; the armed flag is read fresh each frame
    // (an armed rock is static at its spawn, so its interpolated pose is identity).
    const states = this.hazard.renderState();
    const poses = this.interpolator.sample(alpha, () => states.map((s) => ({ x: s.x, y: s.y, angle: s.angle })));
    this.graphics.clear();
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const pose = poses[i];
      const radiusPx = this.radiiPx[i];
      if (state === undefined || pose === undefined || radiusPx === undefined) {
        continue;
      }
      const px = this.transform.point(pose);
      if (state.armed) {
        this.prevPx[i] = undefined;
        this.drawWarning(px, radiusPx);
      } else {
        const prev = this.prevPx[i];
        if (prev !== undefined) {
          this.drawStreaks(px, prev, radiusPx);
        }
        this.drawRock(pose, px, radiusPx);
        this.prevPx[i] = px;
      }
    }
  }

  /** Forget interpolation + streak history on attempt restart (fresh renderer usually). */
  reset(): void {
    this.interpolator.reset();
    this.prevPx = [];
  }

  destroy(): void {
    this.graphics.destroy();
  }

  /**
   * ARMED (pre-trigger) rock: a bold amber warning at its spawn — a pulsing
   * "incoming" aura + a bright "!" glyph — PLUS a drop beam down to a ground
   * TARGET RETICLE at the predicted landing lane (fairness: shows WHERE it hits).
   * Fill-only (no Graphics stroke).
   */
  private drawWarning(px: PixelPoint, r: number): void {
    const g = this.graphics;
    const pulse = 0.5 + 0.5 * Math.sin(this.pulsePhase); // 0..1
    const targetY = px.y + this.beamLengthPx;
    // Drop beam: a translucent amber column from the spawn down to the target.
    const beamHalf = Math.max(2, r * 0.42);
    g.fillStyle(color.hazardWarn, 0.18 + 0.12 * pulse);
    g.fillRect(px.x - beamHalf, px.y, beamHalf * 2, this.beamLengthPx);
    // Target reticle on the ground: a pulsing ring + cross where the rock will land.
    const reticleR = r * (hazardRender.warnReticleRadiusMult + 0.35 * pulse);
    fillRing(g, px.x, targetY, reticleR, reticleR * 0.72, color.hazardWarn, 0.5 + 0.4 * pulse);
    const crossR = reticleR * 0.9;
    const crossW = Math.max(1.5, r * 0.14);
    fillThickPolyline(g, [{ x: px.x - crossR, y: targetY }, { x: px.x + crossR, y: targetY }], crossW, color.hazardRed, 0.85);
    fillThickPolyline(g, [{ x: px.x, y: targetY - crossR }, { x: px.x, y: targetY + crossR }], crossW, color.hazardRed, 0.85);
    // Expanding warning halo at the spawn (grows + fades with the pulse).
    g.save();
    g.translateCanvas(px.x, px.y);
    g.fillStyle(color.hazardWarn, 0.14 + 0.16 * pulse);
    g.fillCircle(0, 0, r * (1.4 + 0.4 * pulse));
    // Amber boulder ghost so the size/threat is legible.
    g.fillStyle(color.hazardWarn, 0.32 + 0.18 * pulse);
    g.fillCircle(0, 0, r);
    // Bold "!" glyph: a vertical bar + a dot, bright warm core, centred.
    const barW = Math.max(2, r * 0.2);
    fillThickPolyline(g, [{ x: 0, y: -r * 0.44 }, { x: 0, y: r * 0.1 }], barW, color.hazardWarnCore);
    g.fillStyle(color.hazardWarnCore, 1);
    g.fillCircle(0, r * 0.36, barW * 0.62);
    g.restore();
  }

  /** Motion streaks: translucent red trails behind a fast-moving boulder. */
  private drawStreaks(px: PixelPoint, prev: PixelPoint, r: number): void {
    const g = this.graphics;
    const dx = px.x - prev.x;
    const dy = px.y - prev.y;
    const speed = Math.hypot(dx, dy);
    if (speed < hazardRender.streakSpeedMinPx) {
      return;
    }
    const ux = dx / speed;
    const uy = dy / speed;
    const len = speed * hazardRender.streakLengthMult;
    const alpha = Math.min(hazardRender.streakAlphaMax, (speed / (r + 1)) * hazardRender.streakAlphaMax);
    const perpX = -uy;
    const perpY = ux;
    const width = Math.max(1.5, r * 0.28);
    for (const off of [-0.5, 0, 0.5]) {
      const ox = perpX * off * r;
      const oy = perpY * off * r;
      const tail = { x: px.x - ux * len + ox, y: px.y - uy * len + oy };
      const head = { x: px.x - ux * r * 0.4 + ox, y: px.y - uy * r * 0.4 + oy };
      fillThickPolyline(g, [tail, head], width, color.hazardCrack, alpha);
    }
  }

  /** One boulder: near-black rim + dark charcoal body + red-orange crack ring + core fissure. */
  private drawRock(pose: Pose, px: PixelPoint, r: number): void {
    const g = this.graphics;
    g.save();
    g.translateCanvas(px.x, px.y);
    // Heat glow (rotation-invariant, drawn un-rotated) so even a small boulder
    // pops on the pale sky and reads as a molten hazard.
    g.fillStyle(color.hazardCrack, 0.16);
    g.fillCircle(0, 0, r * 1.24);
    g.rotateCanvas(-pose.angle);
    // Near-black rim + charcoal body (a heavy dark stone).
    borderedCircle(g, 0, 0, r, {
      fill: color.hazardCharcoal,
      border: color.hazardDark,
      borderWidth: Math.max(1.5, r * 0.16),
    });
    // Lighter charcoal highlight (upper-left) — gives the boulder form/volume.
    g.fillStyle(color.hazardStone, 0.9);
    g.fillCircle(-r * 0.3, -r * 0.3, r * 0.26);
    // Red-orange crack facets radiating from the core (deep-red underlay + bright crack).
    const innerR = r * 0.18;
    const outerR = r * 0.84;
    const deepW = Math.max(2, r * 0.24);
    const crackW = Math.max(1.5, r * 0.15);
    for (let i = 0; i < FACET_COUNT; i++) {
      const a = (i / FACET_COUNT) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const inner: Vec2 = { x: cos * innerR, y: sin * innerR };
      const outer: Vec2 = { x: cos * outerR, y: sin * outerR };
      fillThickPolyline(g, [inner, outer], deepW, color.hazardRedDeep);
      fillThickPolyline(g, [inner, outer], crackW, color.hazardCrack);
    }
    // Glowing core fissure: a bright red-orange centre pip on a deep-red halo,
    // with a hot warm-white glint (molten look).
    g.fillStyle(color.hazardRedDeep, 1);
    g.fillCircle(0, 0, Math.max(2, r * 0.3));
    g.fillStyle(color.hazardCrack, 1);
    g.fillCircle(0, 0, Math.max(1.5, r * 0.18));
    g.fillStyle(color.hazardWarnCore, 0.85);
    g.fillCircle(0, 0, Math.max(1, r * 0.08));
    g.restore();
  }
}

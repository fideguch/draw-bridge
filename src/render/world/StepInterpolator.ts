/**
 * StepInterpolator — fixed-timestep render interpolation for physics bodies
 * (T047, game_design §3.6 "補間レンダリング").
 *
 * Physics runs at a fixed 1/60 step inside World.advance(); render frames land
 * between steps. To avoid stutter, dynamic bodies are drawn at
 * lerp(previousStepPose, latestStepPose, alpha), where alpha is the leftover
 * accumulator fraction World.advance() returns (always in [0, 1)).
 *
 * The renderer only ever sees the LIVE pose (Box2D exposes current transforms,
 * not a step history), so this helper reconstructs the "previous step" by
 * snapshotting: a step boundary is detected when alpha drops below the previous
 * frame's alpha (the accumulator wrapped). That is exact whenever the render
 * rate >= the physics rate (the normal case); under heavy frame drops it lags
 * by at most one extra step, never diverging. Renders one fixed step behind —
 * the standard, correct fixed-timestep interpolation trade-off.
 *
 * Pure (no Phaser / Box2D imports): the caller passes a `readLive` closure that
 * reads the current poses, so this stays headless-testable.
 */

import { clamp, lerp } from '@render/juice/cameraMath';

export interface Pose {
  /** World metres (or world px — the helper is unit-agnostic). */
  readonly x: number;
  readonly y: number;
  /** Radians. */
  readonly angle: number;
}

/** Shortest-arc angle interpolation (wraps across ±π). */
export function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  let delta = (b - a) % twoPi;
  if (delta > Math.PI) {
    delta -= twoPi;
  } else if (delta < -Math.PI) {
    delta += twoPi;
  }
  return a + delta * t;
}

/** Interpolate a single pose (angle via shortest arc). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: lerpAngle(a.angle, b.angle, t) };
}

export class StepInterpolator {
  private previous: readonly Pose[] | null = null;
  private current: readonly Pose[] | null = null;
  private lastAlpha = 1;

  /**
   * Interpolated poses for this render frame. `readLive` reads the current
   * (post-step) poses; `alpha` is World.advance()'s leftover fraction.
   */
  sample(alpha: number, readLive: () => readonly Pose[]): Pose[] {
    const live = readLive();
    if (this.current === null) {
      this.previous = live;
      this.current = live;
    } else if (alpha < this.lastAlpha) {
      // Accumulator wrapped -> at least one fixed step happened since last frame.
      this.previous = this.current;
      this.current = live;
    } else {
      // Same step window: positions are unchanged; keep previous, refresh current.
      this.current = live;
    }
    this.lastAlpha = alpha;

    const previous = this.previous ?? this.current;
    const current = this.current;
    const t = clamp(alpha, 0, 1);
    const count = Math.min(previous.length, current.length);
    const out: Pose[] = [];
    for (let i = 0; i < count; i++) {
      out.push(lerpPose(previous[i] as Pose, current[i] as Pose, t));
    }
    return out;
  }

  /** Forget history (call on attempt restart so the next frame snaps cleanly). */
  reset(): void {
    this.previous = null;
    this.current = null;
    this.lastAlpha = 1;
  }
}

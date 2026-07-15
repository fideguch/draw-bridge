/**
 * timeScaleMath — the pure, headless-testable core of the goal hit-stop /
 * slow-motion time scaling (T060, game_design §4.3 3-1 / 3-2).
 *
 * Mirrors the cameraMath.ts precedent: everything here is a plain function of
 * numbers so it unit-tests without Phaser or a game clock. A `TimeScalePlan` is
 * an immutable description of one celebration's time-scale envelope over REAL
 * time; `computeTimeScale(plan, nowMs)` samples it. TimeScale.ts (the controller)
 * is the thin shell that holds a real-time accumulator and drives `sim.advance`
 * with the scaled delta.
 *
 * Phase envelope (game_design §4.3):
 *   [0, hitStopEnd)   full stop        scale 0     (拍1 hit-stop 80-120 ms)
 *   [hitStopEnd, hold) slow hold       scale slow  (拍2 timeScale 0.3, 0.3-0.5 s)
 *   [hold, recover)   lerp back to 1   slow -> 1   (0.2-0.3 s ease to normal)
 *   [recover, ...)    normal, done     scale 1
 *
 * Units: all durations are REAL milliseconds; scale is a dimensionless
 * multiplier applied to the frame delta before it reaches the fixed-step sim.
 */

import { goal, camera as cameraTuning } from '@tuning/TuningConstants';
import { clamp, lerp } from './cameraMath';

/** Normal (unscaled) time. */
export const NORMAL_SCALE = 1;
/** Full stop (hit-stop) — the "cut" frame at goal contact. */
export const FULL_STOP_SCALE = 0;

/**
 * Immutable time-scale envelope for one celebration, anchored at `startMs` on
 * the controller's real-time clock. Any phase with a 0-length duration is
 * skipped, so the same shape expresses hit-stop-only, slow-mo-only, or the full
 * goal sequence.
 */
export interface TimeScalePlan {
  /** Real-time ms when the plan starts (t0 on the controller clock). */
  readonly startMs: number;
  /** Full-stop (hit-stop) duration in real ms. 0 to skip the hit-stop. */
  readonly hitStopMs: number;
  /** Slow-motion target scale (e.g. goal.slowTimeScale 0.3). */
  readonly slowScale: number;
  /** Slow-motion hold at `slowScale` in real ms. 0 to skip the hold. */
  readonly slowHoldMs: number;
  /** Lerp-back-to-1.0 duration in real ms. 0 snaps straight to normal. */
  readonly recoverMs: number;
}

export interface TimeScaleSample {
  /** Time multiplier at the sampled instant. */
  readonly scale: number;
  /** True once the plan has fully returned to normal time. */
  readonly isDone: boolean;
}

/**
 * Sample a plan at real time `nowMs`. Pure: identical inputs → identical output.
 * Before/at t0 it returns the first active phase's scale; after the last phase
 * it returns normal scale with `isDone` true.
 */
export function computeTimeScale(plan: TimeScalePlan, nowMs: number): TimeScaleSample {
  const hitStopMs = Math.max(0, plan.hitStopMs);
  const slowHoldMs = Math.max(0, plan.slowHoldMs);
  const recoverMs = Math.max(0, plan.recoverMs);
  const holdEnd = hitStopMs + slowHoldMs;
  const recoverEnd = holdEnd + recoverMs;
  const elapsed = nowMs - plan.startMs;

  if (elapsed <= 0) {
    if (hitStopMs > 0) {
      return { scale: FULL_STOP_SCALE, isDone: false };
    }
    if (slowHoldMs > 0 || recoverMs > 0) {
      return { scale: plan.slowScale, isDone: false };
    }
    return { scale: NORMAL_SCALE, isDone: true };
  }
  if (elapsed < hitStopMs) {
    return { scale: FULL_STOP_SCALE, isDone: false };
  }
  if (elapsed < holdEnd) {
    return { scale: plan.slowScale, isDone: false };
  }
  if (elapsed < recoverEnd) {
    const t = recoverMs > 0 ? (elapsed - holdEnd) / recoverMs : 1;
    return { scale: lerp(plan.slowScale, NORMAL_SCALE, clamp(t, 0, 1)), isDone: false };
  }
  return { scale: NORMAL_SCALE, isDone: true };
}

/** Total real-time duration of a plan in ms (hit-stop + hold + recover). */
export function planDurationMs(plan: TimeScalePlan): number {
  return Math.max(0, plan.hitStopMs) + Math.max(0, plan.slowHoldMs) + Math.max(0, plan.recoverMs);
}

/**
 * The full goal celebration envelope (game_design §4.3 3-1 + 3-2): hit-stop then
 * slow-mo hold then lerp back, all values from the `goal` tuning group.
 */
export function makeGoalTimeScalePlan(startMs: number): TimeScalePlan {
  return {
    startMs,
    hitStopMs: goal.hitStopMs,
    slowScale: goal.slowTimeScale,
    slowHoldMs: goal.slowHoldSec * 1000,
    recoverMs: goal.slowRecoverSec * 1000,
  };
}

/** A hit-stop-only envelope (goal contact or a big crash — see BR-006 budget). */
export function makeHitStopPlan(startMs: number, hitStopMs: number = goal.hitStopMs): TimeScalePlan {
  return { startMs, hitStopMs, slowScale: NORMAL_SCALE, slowHoldMs: 0, recoverMs: 0 };
}

export interface SlowMoPlanOptions {
  /** Slow-mo scale. Defaults to goal.slowTimeScale. */
  readonly scale?: number;
  /** Hold duration in real ms. Defaults to goal.slowHoldSec. */
  readonly holdMs?: number;
  /** Recovery lerp duration in real ms. Defaults to goal.slowRecoverSec. */
  readonly recoverMs?: number;
  /** Optional leading hit-stop in real ms. Defaults to 0 (none). */
  readonly hitStopMs?: number;
}

/** A slow-mo envelope with an optional leading hit-stop; tuning-defaulted. */
export function makeSlowMoPlan(startMs: number, options: SlowMoPlanOptions = {}): TimeScalePlan {
  return {
    startMs,
    hitStopMs: options.hitStopMs ?? 0,
    slowScale: options.scale ?? goal.slowTimeScale,
    slowHoldMs: options.holdMs ?? goal.slowHoldSec * 1000,
    recoverMs: options.recoverMs ?? goal.slowRecoverSec * 1000,
  };
}

/**
 * Camera zoom factor for a given time scale (game_design §4.3 3-2 "スロー中カメラ
 * 15-25% ズームイン"). Linearly maps scale∈[slowScale, 1] → zoom∈[1+pct, 1] so
 * the wiring can drive CameraDirector.zoomTo() off the controller's scale. At
 * full stop (scale 0) the zoom saturates at the maximum. Pure helper for the
 * GoalSequence wiring; the controller stays decoupled from the camera.
 */
export function slowMoZoom(
  scale: number,
  slowScale: number = goal.slowTimeScale,
  zoomInPct: number = cameraTuning.goalZoomInPct,
): number {
  if (slowScale >= NORMAL_SCALE) {
    return NORMAL_SCALE;
  }
  const t = clamp((NORMAL_SCALE - scale) / (NORMAL_SCALE - slowScale), 0, 1);
  return 1 + (zoomInPct / 100) * t;
}

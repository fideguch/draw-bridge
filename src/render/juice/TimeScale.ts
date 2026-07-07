/**
 * TimeScaleController — drives the goal hit-stop / slow-motion off the pure
 * timeScaleMath envelope (T060, game_design §4.3 3-1 / 3-2, BR-006 / §4.4 X-2).
 *
 * Phaser-free by construction: PlayScene feeds it the real frame delta and hands
 * the returned SCALED delta to `sim.advance`. The sim's fixed timestep stays
 * physics.fixedDt (1/60) internally — during slow-mo the accumulator simply
 * receives less real time per frame, so FEWER fixed steps are consumed and the
 * world advances in slow motion WITHOUT changing the timestep (this is the
 * "physics fixedDelta linked" approach the design calls for; determinism
 * contract, game_design §3.6, is preserved).
 *
 * Budget guard (BR-006, game_design §4.4 X-2 "hit-stop 1レベル 1〜2回まで"):
 * hit-stops are capped per level attempt and the goal + crash hit-stops SHARE
 * the same budget (X-3). Slow-mo / confetti are NOT budget-limited — only the
 * full-stop frame is. resetBudget() is called on each new attempt.
 *
 * Camera link: pass `onScaleChange` to mirror the scale onto the camera zoom —
 * the wiring maps it with slowMoZoom() and calls CameraDirector.zoomTo(), e.g.
 *   new TimeScaleController({ onScaleChange: (s) =>
 *     camera.zoomTo(slowMoZoom(s)) });
 * The controller itself never imports the camera, keeping this module isolated.
 */

import { goal } from '@tuning/TuningConstants';
import {
  computeTimeScale,
  makeGoalTimeScalePlan,
  makeHitStopPlan,
  makeSlowMoPlan,
  NORMAL_SCALE,
  type SlowMoPlanOptions,
  type TimeScalePlan,
} from './timeScaleMath';

/**
 * TODO(tuning): no `goal.hitStopMaxPerAttempt` exists in TuningConstants; the
 * design fixes the cap at 1-2 (game_design §4.4 X-2, BR-006). 2 is the range
 * ceiling. Promote to the goal group when the tuning panel (FR-025) gains it.
 */
const HIT_STOP_MAX_PER_ATTEMPT = 2;

export interface TimeScaleControllerOptions {
  /** Max hit-stops per attempt (BR-006). Defaults to HIT_STOP_MAX_PER_ATTEMPT. */
  readonly hitStopMaxPerAttempt?: number;
  /** Fired whenever the scale changes (camera zoom link). */
  readonly onScaleChange?: (scale: number) => void;
}

export class TimeScaleController {
  private plan: TimeScalePlan | null = null;
  private nowMs = 0;
  private currentScale = NORMAL_SCALE;
  private hitStopBudget: number;
  private readonly hitStopMax: number;
  private readonly onScaleChange?: (scale: number) => void;

  constructor(options: TimeScaleControllerOptions = {}) {
    this.hitStopMax = Math.max(0, Math.floor(options.hitStopMaxPerAttempt ?? HIT_STOP_MAX_PER_ATTEMPT));
    this.hitStopBudget = this.hitStopMax;
    this.onScaleChange = options.onScaleChange;
  }

  /** Current time multiplier (0 during hit-stop, slowScale…1 during slow-mo). */
  get scale(): number {
    return this.currentScale;
  }

  /** True while a hit-stop / slow-mo envelope is running. */
  get isActive(): boolean {
    return this.plan !== null;
  }

  /** Remaining hit-stops for this attempt (diagnostics / tests). */
  get remainingHitStopBudget(): number {
    return this.hitStopBudget;
  }

  /**
   * Full-stop for `ms` (goal contact or big crash). Consumes one budget unit;
   * returns false and does nothing if the budget is exhausted (BR-006).
   */
  hitStop(ms: number = goal.hitStopMs): boolean {
    if (this.hitStopBudget <= 0) {
      return false;
    }
    this.hitStopBudget -= 1;
    this.startPlan(makeHitStopPlan(this.nowMs, ms));
    return true;
  }

  /**
   * Enter slow-motion (never budget-limited). A requested leading `hitStopMs`
   * consumes budget; if exhausted it is dropped and the slow-mo still plays.
   */
  slowMo(options: SlowMoPlanOptions = {}): void {
    let hitStopMs = options.hitStopMs ?? 0;
    if (hitStopMs > 0) {
      if (this.hitStopBudget <= 0) {
        hitStopMs = 0;
      } else {
        this.hitStopBudget -= 1;
      }
    }
    this.startPlan(makeSlowMoPlan(this.nowMs, { ...options, hitStopMs }));
  }

  /**
   * The full goal celebration (§4.3 3-1 + 3-2): hit-stop → slow-mo → recover.
   * The leading hit-stop honours the shared budget; when exhausted the slow-mo
   * portion still plays (the celebration is never fully suppressed).
   */
  goalCelebration(): void {
    const hasHitStop = this.hitStopBudget > 0;
    if (hasHitStop) {
      this.hitStopBudget -= 1;
    }
    this.startPlan(hasHitStop ? makeGoalTimeScalePlan(this.nowMs) : makeSlowMoPlan(this.nowMs, {}));
  }

  /**
   * Advance the real clock by `realDeltaMs` and return the SCALED delta to feed
   * `sim.advance`. Negative deltas are ignored (clamped to 0).
   */
  update(realDeltaMs: number): number {
    const delta = Math.max(0, realDeltaMs);
    this.nowMs += delta;
    if (this.plan !== null) {
      this.applySample(this.plan, this.nowMs);
    }
    return delta * this.currentScale;
  }

  /** Abort any envelope and snap back to normal time (e.g. tap-skip / retry). */
  cancel(): void {
    this.plan = null;
    this.setScale(NORMAL_SCALE);
  }

  /** Restore the hit-stop budget for a new level attempt (BR-006). */
  resetBudget(): void {
    this.hitStopBudget = this.hitStopMax;
  }

  private startPlan(plan: TimeScalePlan): void {
    this.plan = plan;
    this.applySample(plan, this.nowMs);
  }

  private applySample(plan: TimeScalePlan, nowMs: number): void {
    const sample = computeTimeScale(plan, nowMs);
    this.setScale(sample.scale);
    if (sample.isDone) {
      this.plan = null;
    }
  }

  private setScale(next: number): void {
    if (next !== this.currentScale) {
      this.currentScale = next;
      this.onScaleChange?.(next);
    }
  }
}

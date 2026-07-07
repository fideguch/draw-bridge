/**
 * juice-primitives — pure cores behind the goal celebration primitives (T060,
 * game_design §4.3). Phaser-free by construction: only the extracted plain
 * functions + the Phaser-free controllers are imported, so the whole suite runs
 * headless in the vitest node environment (the Phaser-facing views import Phaser
 * as a TYPE only, so importing their pure exports pulls no runtime Phaser).
 *
 * Covers the behaviours the task calls out: the time-scale state machine
 * (hit-stop full stop, phase durations, monotonic slow-mo lerp-back, budget
 * guard), reward count-up value progression + tick pitch, and the confetti /
 * star / coin parameter generators.
 */

import { describe, expect, it } from 'vitest';
import { goal } from '@tuning/TuningConstants';
import {
  computeTimeScale,
  makeGoalTimeScalePlan,
  makeHitStopPlan,
  makeSlowMoPlan,
  planDurationMs,
  slowMoZoom,
  FULL_STOP_SCALE,
  NORMAL_SCALE,
} from '@render/juice/timeScaleMath';
import { TimeScaleController } from '@render/juice/TimeScale';
import {
  coinCounterPunch,
  coinFlightSchedule,
  countUpTickPitch,
  countUpValue,
  easeOutCubic,
  RewardCountUp,
} from '@render/juice/RewardCountUp';
import { confettiCannonPieces, confettiRainPieces } from '@render/juice/Confetti';
import { starPolygon, starRevealSchedule } from '@render/juice/StarBurst';

/** Injected celebration palette (the wiring passes real theme colours). */
const TEST_PALETTE: readonly number[] = [0xff4f9a, 0xff7a1a, 0xffe14d, 0x21c46b, 0xffb300];

describe('timeScaleMath — hit-stop full stop', () => {
  it('holds scale 0 through the whole hit-stop window then returns to normal', () => {
    const plan = makeHitStopPlan(0, 100);
    expect(computeTimeScale(plan, 0).scale).toBe(FULL_STOP_SCALE);
    expect(computeTimeScale(plan, 50).scale).toBe(FULL_STOP_SCALE);
    expect(computeTimeScale(plan, 99).scale).toBe(FULL_STOP_SCALE);
    const end = computeTimeScale(plan, 100);
    expect(end.scale).toBe(NORMAL_SCALE);
    expect(end.isDone).toBe(true);
  });
});

describe('timeScaleMath — goal envelope phase durations', () => {
  const plan = makeGoalTimeScalePlan(0);
  const hitStopEnd = goal.hitStopMs;
  const holdEnd = hitStopEnd + goal.slowHoldSec * 1000;
  const recoverEnd = holdEnd + goal.slowRecoverSec * 1000;

  it('is full stop during the hit-stop, then slow scale during the hold', () => {
    expect(computeTimeScale(plan, hitStopEnd - 1).scale).toBe(FULL_STOP_SCALE);
    expect(computeTimeScale(plan, hitStopEnd).scale).toBe(goal.slowTimeScale);
    expect(computeTimeScale(plan, holdEnd - 1).scale).toBe(goal.slowTimeScale);
  });

  it('lerps back to 1.0 monotonically over the recovery window', () => {
    let previous = goal.slowTimeScale;
    for (let t = holdEnd; t <= recoverEnd; t += 5) {
      const { scale } = computeTimeScale(plan, t);
      expect(scale).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(scale).toBeGreaterThanOrEqual(goal.slowTimeScale - 1e-9);
      expect(scale).toBeLessThanOrEqual(NORMAL_SCALE + 1e-9);
      previous = scale;
    }
  });

  it('is done exactly at the end of the recovery window', () => {
    expect(computeTimeScale(plan, recoverEnd - 1).isDone).toBe(false);
    const done = computeTimeScale(plan, recoverEnd);
    expect(done.scale).toBeCloseTo(NORMAL_SCALE, 9);
    expect(done.isDone).toBe(true);
    expect(planDurationMs(plan)).toBe(recoverEnd);
  });
});

describe('timeScaleMath — slowMoZoom camera link', () => {
  it('zooms in most at full stop and back to 1.0 at normal time', () => {
    const pctZoom = slowMoZoom(FULL_STOP_SCALE, goal.slowTimeScale, 20);
    expect(pctZoom).toBeCloseTo(1.2, 9);
    expect(slowMoZoom(goal.slowTimeScale, goal.slowTimeScale, 20)).toBeCloseTo(1.2, 9);
    expect(slowMoZoom(NORMAL_SCALE, goal.slowTimeScale, 20)).toBeCloseTo(1.0, 9);
    // Midway between slow and normal → half the zoom-in.
    const mid = (goal.slowTimeScale + NORMAL_SCALE) / 2;
    expect(slowMoZoom(mid, goal.slowTimeScale, 20)).toBeCloseTo(1.1, 9);
  });
});

describe('TimeScaleController — scaled delta + budget guard', () => {
  it('returns a zeroed scaled delta during a hit-stop and full delta otherwise', () => {
    const controller = new TimeScaleController();
    expect(controller.update(16)).toBeCloseTo(16, 9); // idle → unscaled
    expect(controller.hitStop(100)).toBe(true);
    expect(controller.update(16)).toBe(0); // inside the full stop
    expect(controller.scale).toBe(FULL_STOP_SCALE);
    // Advance past the 100 ms stop → back to normal, deltas flow again.
    controller.update(100);
    expect(controller.scale).toBe(NORMAL_SCALE);
    expect(controller.update(16)).toBeCloseTo(16, 9);
  });

  it('caps hit-stops at the per-attempt budget and resetBudget restores it', () => {
    const controller = new TimeScaleController({ hitStopMaxPerAttempt: 2 });
    expect(controller.hitStop()).toBe(true);
    expect(controller.hitStop()).toBe(true);
    expect(controller.remainingHitStopBudget).toBe(0);
    expect(controller.hitStop()).toBe(false); // exhausted
    controller.resetBudget();
    expect(controller.remainingHitStopBudget).toBe(2);
    expect(controller.hitStop()).toBe(true);
  });

  it('fires onScaleChange for the camera link and cancel snaps to normal', () => {
    const scales: number[] = [];
    const controller = new TimeScaleController({ onScaleChange: (s) => scales.push(s) });
    controller.goalCelebration();
    expect(controller.scale).toBe(FULL_STOP_SCALE);
    expect(scales[0]).toBe(FULL_STOP_SCALE);
    controller.cancel();
    expect(controller.scale).toBe(NORMAL_SCALE);
    expect(scales.at(-1)).toBe(NORMAL_SCALE);
    expect(controller.isActive).toBe(false);
  });

  it('goalCelebration still plays slow-mo when the hit-stop budget is spent', () => {
    const controller = new TimeScaleController({ hitStopMaxPerAttempt: 0 });
    controller.goalCelebration();
    // No budget → no full-stop frame; opens directly on slow-mo.
    expect(controller.scale).toBe(goal.slowTimeScale);
    expect(controller.isActive).toBe(true);
  });

  it('makeSlowMoPlan with a leading hit-stop opens on a full stop', () => {
    const plan = makeSlowMoPlan(0, { hitStopMs: 80 });
    expect(computeTimeScale(plan, 0).scale).toBe(FULL_STOP_SCALE);
    expect(computeTimeScale(plan, 80).scale).toBe(goal.slowTimeScale);
  });
});

describe('RewardCountUp — value progression + tick pitch', () => {
  it('eases the value up monotonically and lands exactly on the target', () => {
    const counter = new RewardCountUp();
    counter.start(0, 150, { durationMs: 1000, tickIntervalMs: 50 });
    let previous = counter.value;
    for (let i = 0; i < 25; i++) {
      counter.update(50);
      expect(counter.value).toBeGreaterThanOrEqual(previous);
      previous = counter.value;
    }
    expect(counter.value).toBe(150);
    expect(counter.isRunning).toBe(false);
  });

  it('fires ticks on the cadence with a rising pitch, ending near 1.3', () => {
    const pitches: number[] = [];
    const counter = new RewardCountUp();
    counter.start(0, 100, {
      durationMs: 300,
      tickIntervalMs: 60,
      onTick: (_value, pitch) => pitches.push(pitch),
    });
    for (let i = 0; i < 6; i++) {
      counter.update(60);
    }
    expect(pitches.length).toBeGreaterThan(0);
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]).toBeGreaterThanOrEqual(pitches[i - 1] ?? 0);
    }
    expect(pitches.at(-1)).toBeLessThanOrEqual(1.3 + 1e-9);
  });

  it('skip() jumps to the end and reports the final value once', () => {
    const dones: number[] = [];
    const counter = new RewardCountUp();
    counter.start(0, 250, { durationMs: 1200, onDone: (v) => dones.push(v) });
    counter.update(100);
    counter.skip();
    expect(counter.value).toBe(250);
    expect(counter.isRunning).toBe(false);
    expect(dones).toEqual([250]);
    counter.skip(); // idempotent — no second onDone
    expect(dones).toEqual([250]);
  });
});

describe('RewardCountUp — pure math helpers', () => {
  it('easeOutCubic pins the endpoints and stays monotonic', () => {
    expect(easeOutCubic(0)).toBeCloseTo(0, 9);
    expect(easeOutCubic(1)).toBeCloseTo(1, 9);
    expect(easeOutCubic(-1)).toBeCloseTo(0, 9); // clamped
    expect(easeOutCubic(2)).toBeCloseTo(1, 9); // clamped
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });

  it('countUpValue is front-loaded (ease-out) and countUpTickPitch rises 1.0→1.3', () => {
    // Ease-out: halfway through time is already past halfway in value.
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50);
    expect(countUpTickPitch(0)).toBeCloseTo(1.0, 9);
    expect(countUpTickPitch(1)).toBeCloseTo(1.3, 9);
    expect(countUpTickPitch(0.5)).toBeCloseTo(1.15, 9);
  });

  it('exposes the counter punch constants (1.0→1.2→1.0 over 100 ms)', () => {
    expect(coinCounterPunch.scale).toBeCloseTo(1.2, 9);
    expect(coinCounterPunch.durationMs).toBe(100);
  });
});

describe('coinFlightSchedule — staggered radial burst', () => {
  it('produces one step per coin with an even stagger and full-circle angles', () => {
    const steps = coinFlightSchedule(20, 30);
    expect(steps).toHaveLength(20);
    expect(steps[0]).toEqual({ index: 0, delayMs: 0, radialAngle: 0 });
    expect(steps[1]?.delayMs).toBe(30);
    expect(steps[19]?.delayMs).toBe(19 * 30);
    // Angles evenly distributed over [0, 2π).
    expect(steps[10]?.radialAngle).toBeCloseTo(Math.PI, 9);
  });

  it('defaults the stagger to the goal tuning value and handles zero coins', () => {
    expect(coinFlightSchedule(0)).toEqual([]);
    expect(coinFlightSchedule(2)[1]?.delayMs).toBe(goal.coinStaggerMs);
  });
});

describe('confetti generators — §4.3 3-3 parameters', () => {
  it('cannon pieces respect the count and the 45-70° elevation band', () => {
    const rngValues = [0, 0.25, 0.5, 0.75, 0.999];
    let call = 0;
    const rng = (): number => rngValues[call++ % rngValues.length] ?? 0;
    const pieces = confettiCannonPieces(goal.confettiCannonCount, 'right', TEST_PALETTE, rng);
    expect(pieces).toHaveLength(goal.confettiCannonCount);
    for (const piece of pieces) {
      expect(piece.angleDeg).toBeGreaterThanOrEqual(45);
      expect(piece.angleDeg).toBeLessThanOrEqual(70);
      expect(piece.directionX).toBe(1);
      expect(Math.abs(piece.spinDegPerSec)).toBe(goal.confettiSpinDegPerSec);
      expect(TEST_PALETTE).toContain(piece.color);
    }
  });

  it('mirrors the horizontal direction for the left cannon', () => {
    const [piece] = confettiCannonPieces(1, 'left', TEST_PALETTE, () => 0.5);
    expect(piece?.directionX).toBe(-1);
    expect(piece?.angleDeg).toBeCloseTo(57.5, 6); // midpoint of 45-70 at rng 0.5
  });

  it('rain pieces spread across the width, staggered, spinning at the tuning rate', () => {
    const flakes = confettiRainPieces(goal.confettiRainCount, 390, TEST_PALETTE, 2500, () => 0.5);
    expect(flakes).toHaveLength(goal.confettiRainCount);
    for (const flake of flakes) {
      expect(flake.xPx).toBeGreaterThanOrEqual(0);
      expect(flake.xPx).toBeLessThanOrEqual(390);
      expect(flake.delayMs).toBeGreaterThanOrEqual(0);
      expect(Math.abs(flake.spinDegPerSec)).toBe(goal.confettiSpinDegPerSec);
    }
  });
});

describe('star generators — §4.3 3-4 sequential reveal', () => {
  it('schedules stars 250 ms (goal.starIntervalMs) apart', () => {
    const steps = starRevealSchedule(3);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.delayMs)).toEqual([0, goal.starIntervalMs, goal.starIntervalMs * 2]);
  });

  it('builds a closed 5-point star polygon (10 vertices, 20 coords)', () => {
    const points = starPolygon(28);
    expect(points).toHaveLength(20);
    // Every vertex is within the outer radius.
    for (let i = 0; i < points.length; i += 2) {
      const r = Math.hypot(points[i] ?? 0, points[i + 1] ?? 0);
      expect(r).toBeLessThanOrEqual(28 + 1e-9);
    }
  });
});

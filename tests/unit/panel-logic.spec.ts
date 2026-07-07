/**
 * panel-logic — pure debug-tuning-panel math + the runtime override registry
 * (T083). slider<->value mapping (linear + log), the p95 ring buffer, and the
 * in-place tuningOverride get/set/reset contract.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  NumberRingBuffer,
  chooseScale,
  clamp01,
  percentile,
  quantize,
  sliderToValue,
  valueToSlider,
  type SliderSpec,
} from '../../src/debug/panelMath';
import {
  TUNABLE_FIELDS,
  defaultOf,
  getTuning,
  resetAll,
  resetField,
  resetGroup,
  setTuning,
} from '../../src/debug/tuningOverride';

describe('panelMath — scale selection', () => {
  it('chooses log for wide strictly-positive ranges, linear otherwise', () => {
    expect(chooseScale(1, 1000)).toBe('log');
    expect(chooseScale(4, 8)).toBe('linear');
    expect(chooseScale(-20, -4)).toBe('linear'); // negatives can't be log
    expect(chooseScale(0, 100)).toBe('linear'); // zero low bound can't be log
  });
});

describe('panelMath — linear mapping', () => {
  const spec: SliderSpec = { min: 4, max: 8, scale: 'linear' };

  it('maps slider endpoints to range endpoints', () => {
    expect(sliderToValue(0, spec)).toBeCloseTo(4);
    expect(sliderToValue(1, spec)).toBeCloseTo(8);
    expect(sliderToValue(0.5, spec)).toBeCloseTo(6);
  });

  it('round-trips value -> slider -> value', () => {
    for (const value of [4, 5, 6.3, 7, 8]) {
      expect(sliderToValue(valueToSlider(value, spec), spec)).toBeCloseTo(value, 6);
    }
  });

  it('clamps out-of-range inputs', () => {
    expect(sliderToValue(-1, spec)).toBeCloseTo(4);
    expect(sliderToValue(2, spec)).toBeCloseTo(8);
    expect(valueToSlider(100, spec)).toBe(1);
    expect(valueToSlider(0, spec)).toBe(0);
  });
});

describe('panelMath — log mapping', () => {
  const spec: SliderSpec = { min: 1, max: 1000, scale: 'log' };

  it('is monotonic and hits the endpoints', () => {
    expect(sliderToValue(0, spec)).toBeCloseTo(1);
    expect(sliderToValue(1, spec)).toBeCloseTo(1000);
    // half-way in log space is the geometric mean (~31.6), not the arithmetic 500
    expect(sliderToValue(0.5, spec)).toBeCloseTo(Math.sqrt(1000), 4);
    expect(sliderToValue(0.25, spec)).toBeLessThan(sliderToValue(0.75, spec));
  });

  it('round-trips value -> slider -> value', () => {
    for (const value of [1, 10, 100, 500, 1000]) {
      expect(sliderToValue(valueToSlider(value, spec), spec)).toBeCloseTo(value, 4);
    }
  });

  it('rejects a log spec whose bounds are not both positive', () => {
    expect(() => sliderToValue(0.5, { min: 0, max: 100, scale: 'log' })).toThrow();
  });
});

describe('panelMath — quantization', () => {
  const spec: SliderSpec = { min: 40, max: 60, step: 1 };

  it('snaps to the step grid and clamps', () => {
    expect(quantize(50.4, spec)).toBe(50);
    expect(quantize(50.6, spec)).toBe(51);
    expect(quantize(1000, spec)).toBe(60);
    expect(sliderToValue(0.5, spec)).toBe(50);
  });
});

describe('panelMath — percentile + ring buffer', () => {
  it('nearest-rank percentile, 0 for empty', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([5], 0.95)).toBe(5);
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(samples, 0.95)).toBe(10);
    expect(percentile(samples, 0.5)).toBe(5);
  });

  it('bounds memory at capacity and computes p95 over the window', () => {
    const buffer = new NumberRingBuffer(100);
    for (let i = 1; i <= 500; i += 1) {
      buffer.push(i);
    }
    expect(buffer.size).toBe(100);
    // last 100 samples are 401..500; p95 (nearest-rank) = 495
    expect(buffer.p95()).toBe(495);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new NumberRingBuffer(0)).toThrow();
  });

  it('clamp01 bounds to [0,1]', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe('tuningOverride — in-place runtime override', () => {
  afterEach(() => {
    resetAll(); // never leak an override into another test/file
  });

  it('every registered field is readable and reset-safe', () => {
    for (const field of TUNABLE_FIELDS) {
      expect(Number.isFinite(getTuning(field.group, field.key))).toBe(true);
      expect(getTuning(field.group, field.key)).toBe(defaultOf(field.group, field.key));
    }
  });

  it('setTuning mutates the live value; resetField restores the default', () => {
    const original = getTuning('bridge', 'jointHertz');
    setTuning('bridge', 'jointHertz', 5.5);
    expect(getTuning('bridge', 'jointHertz')).toBe(5.5);
    resetField('bridge', 'jointHertz');
    expect(getTuning('bridge', 'jointHertz')).toBe(original);
  });

  it('resetGroup restores every field in the group', () => {
    const before = getTuning('camera', 'followLerp');
    setTuning('camera', 'followLerp', 0.13);
    setTuning('camera', 'traumaCrash', 0.9);
    resetGroup('camera');
    expect(getTuning('camera', 'followLerp')).toBe(before);
    expect(getTuning('camera', 'traumaCrash')).toBe(defaultOf('camera', 'traumaCrash'));
  });

  it('rejects a non-finite override', () => {
    expect(() => setTuning('physics', 'gravityY', Number.NaN)).toThrow();
  });

  it('every field tags an apply mode of live or restart', () => {
    for (const field of TUNABLE_FIELDS) {
      expect(field.apply === 'live' || field.apply === 'restart').toBe(true);
    }
  });
});

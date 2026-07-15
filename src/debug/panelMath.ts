/**
 * panelMath — pure math for the debug tuning panel (T083, FR-025).
 *
 * Two headless concerns, both unit-tested (tests/unit/panel-logic.spec.ts):
 *
 *   1. slider <-> value mapping. Each tunable declares a [min, max] range and a
 *      scale. `linear` maps the slider position proportionally; `log` maps it in
 *      log space so wide ranges (spanning >= LOG_SCALE_MIN_RATIO orders) get even
 *      resolution across the whole span instead of crowding the low end.
 *      `chooseScale` picks log automatically for wide, strictly-positive ranges.
 *
 *   2. a fixed-capacity ring buffer of per-step wall times + a nearest-rank
 *      percentile, so the panel can show the physics step-time p95 (the KPI-001
 *      device budget) over a sliding window without re-sorting an unbounded array.
 *
 * No Phaser, no DOM, no tuning imports — pure numbers in, numbers out.
 */

export type ScaleKind = 'linear' | 'log';

/**
 * A range whose max/min ratio reaches this is mapped on a log slider by
 * `chooseScale` (both bounds must be > 0). Below it a linear slider is fine.
 */
export const LOG_SCALE_MIN_RATIO = 50;

export interface SliderSpec {
  readonly min: number;
  readonly max: number;
  /** Omitted -> `chooseScale(min, max)`. */
  readonly scale?: ScaleKind;
  /** Quantization step in value space (> 0). Omitted -> continuous. */
  readonly step?: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Log scale for wide, strictly-positive ranges; linear otherwise. */
export function chooseScale(min: number, max: number): ScaleKind {
  if (min > 0 && max > 0 && max / min >= LOG_SCALE_MIN_RATIO) {
    return 'log';
  }
  return 'linear';
}

function resolvedScale(spec: SliderSpec): ScaleKind {
  return spec.scale ?? chooseScale(spec.min, spec.max);
}

function assertSpec(spec: SliderSpec): void {
  if (!Number.isFinite(spec.min) || !Number.isFinite(spec.max) || spec.min >= spec.max) {
    throw new Error(`panelMath: SliderSpec requires finite min < max (got ${spec.min}..${spec.max})`);
  }
  if (resolvedScale(spec) === 'log' && (spec.min <= 0 || spec.max <= 0)) {
    throw new Error(`panelMath: log scale requires min and max > 0 (got ${spec.min}..${spec.max})`);
  }
  if (spec.step !== undefined && !(spec.step > 0)) {
    throw new Error(`panelMath: step must be > 0 when provided (got ${spec.step})`);
  }
}

/** Snap a value to the spec's step grid (anchored at min) and clamp to range. */
export function quantize(value: number, spec: SliderSpec): number {
  const bounded = clamp(value, spec.min, spec.max);
  if (spec.step === undefined) {
    return bounded;
  }
  const snapped = spec.min + Math.round((bounded - spec.min) / spec.step) * spec.step;
  return clamp(snapped, spec.min, spec.max);
}

/** Value -> slider position in [0, 1]. Inverse of {@link sliderToValue}. */
export function valueToSlider(value: number, spec: SliderSpec): number {
  assertSpec(spec);
  const bounded = clamp(value, spec.min, spec.max);
  if (resolvedScale(spec) === 'log') {
    const lo = Math.log(spec.min);
    return clamp01((Math.log(bounded) - lo) / (Math.log(spec.max) - lo));
  }
  return clamp01((bounded - spec.min) / (spec.max - spec.min));
}

/** Slider position in [0, 1] -> value (step-quantized). Inverse of {@link valueToSlider}. */
export function sliderToValue(position: number, spec: SliderSpec): number {
  assertSpec(spec);
  const t = clamp01(position);
  let raw: number;
  if (resolvedScale(spec) === 'log') {
    const lo = Math.log(spec.min);
    raw = Math.exp(lo + t * (Math.log(spec.max) - lo));
  } else {
    raw = spec.min + t * (spec.max - spec.min);
  }
  return quantize(raw, spec);
}

/**
 * Nearest-rank percentile (p in [0, 1]) over an unsorted sample array.
 * Returns 0 for an empty input. Matches SpikeScenario.summarizeStepDurations so
 * the panel and the spike bench report the same p95 definition.
 */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const clampedP = clamp01(p);
  const rank = Math.min(sorted.length - 1, Math.ceil(clampedP * sorted.length) - 1);
  return sorted[Math.max(0, rank)] as number;
}

/**
 * Fixed-capacity numeric ring buffer: O(1) push, bounded memory. Used for the
 * per-frame physics step-time window feeding the panel's p95 readout.
 */
export class NumberRingBuffer {
  readonly capacity: number;
  private readonly data: number[] = [];
  private head = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`NumberRingBuffer: capacity must be an integer >= 1 (got ${capacity})`);
    }
    this.capacity = capacity;
  }

  push(value: number): void {
    if (this.data.length < this.capacity) {
      this.data.push(value);
    } else {
      this.data[this.head] = value;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  get size(): number {
    return this.data.length;
  }

  /** Current contents (chronological order not guaranteed — order-independent stats only). */
  toArray(): readonly number[] {
    return [...this.data];
  }

  clear(): void {
    this.data.length = 0;
    this.head = 0;
  }

  /** p95 of the current window (nearest-rank), 0 while empty. */
  p95(): number {
    return percentile(this.data, 0.95);
  }
}

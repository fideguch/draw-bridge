/**
 * render-logic — pure math behind the render building blocks (T046-T048).
 *
 * Phaser/Box2D-free by construction: only the extracted plain modules are
 * imported, so the whole suite runs headless in the vitest node environment.
 * Covers the behaviours the task calls out: stroke thinning, past-only Catmull-
 * Rom smoothing (last-2 raw), world<->pixel transform, step interpolation,
 * camera lerp convergence, trauma^2 + decay, and look-ahead proportionality/cap.
 */

import { describe, expect, it } from 'vitest';
import { buildStrokePath, shouldAppendPoint, thinByMinDistance } from '@render/draw/strokeMath';
import {
  addTrauma,
  clamp,
  computeCameraState,
  computeLookAhead,
  decayTrauma,
  lerp,
  traumaToShake,
  type CameraDirectorParams,
  type Vec2,
} from '@render/juice/cameraMath';
import { WorldToPixel } from '@render/world/worldToPixel';
import { lerpAngle, StepInterpolator } from '@render/world/StepInterpolator';

describe('strokeMath — vertex thinning (min distance)', () => {
  it('keeps a vertex only once the pointer has moved >= minDist', () => {
    expect(shouldAppendPoint({ x: 0, y: 0 }, { x: 2, y: 0 }, 3)).toBe(false);
    expect(shouldAppendPoint({ x: 0, y: 0 }, { x: 3, y: 0 }, 3)).toBe(true);
  });

  it('greedily thins a dense path to the min-distance spacing', () => {
    const points = [0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 0 }));
    const kept = thinByMinDistance(points, 3);
    expect(kept).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it('returns an empty list for no input', () => {
    expect(thinByMinDistance([], 3)).toEqual([]);
  });
});

describe('strokeMath — past-only Catmull-Rom smoothing', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 2, y: -1 },
    { x: 3, y: 3 },
    { x: 4, y: 0 },
    { x: 5, y: 1 },
  ];

  it('keeps the last two points raw (zero-latency tip)', () => {
    const path = buildStrokePath(points);
    expect(path[path.length - 1]).toEqual({ x: 5, y: 1 });
    expect(path[path.length - 2]).toEqual({ x: 4, y: 0 });
  });

  it('smooths the past (adds interpolated vertices) and preserves the start', () => {
    const path = buildStrokePath(points);
    expect(path.length).toBeGreaterThan(points.length);
    expect(path[0]).toEqual({ x: 0, y: 0 });
  });

  it('returns <= 3 points unchanged (nothing to smooth without moving the tip)', () => {
    const few = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(buildStrokePath(few)).toEqual(few);
  });
});

describe('worldToPixel — metre <-> pixel round-trip (y-up -> y-down)', () => {
  it('maps metres to world pixels with a y flip', () => {
    const transform = new WorldToPixel({ pixelsPerMeter: 32, originX: 100, originY: 400 });
    const px = transform.point({ x: 2, y: 3 });
    expect(px.x).toBeCloseTo(164, 6);
    expect(px.y).toBeCloseTo(304, 6);
  });

  it('inverts exactly', () => {
    const transform = new WorldToPixel({ pixelsPerMeter: 20, originX: 50, originY: 300 });
    const world = transform.toWorld(transform.x(4.5), transform.y(-2.25));
    expect(world.x).toBeCloseTo(4.5, 9);
    expect(world.y).toBeCloseTo(-2.25, 9);
  });

  it('rejects a non-positive scale', () => {
    expect(() => new WorldToPixel({ pixelsPerMeter: 0 })).toThrow();
  });
});

describe('StepInterpolator — fixed-step render interpolation', () => {
  it('interpolates between the previous and latest step by alpha', () => {
    const interp = new StepInterpolator();
    const first = [{ x: 0, y: 0, angle: 0 }];
    const second = [{ x: 10, y: 4, angle: 0 }];
    // First frame snaps to live.
    expect(interp.sample(0.9, () => first)[0]).toEqual({ x: 0, y: 0, angle: 0 });
    // alpha drops -> a step boundary: prev=first, curr=second, t=0.1.
    const mid = interp.sample(0.1, () => second)[0];
    expect(mid?.x).toBeCloseTo(1, 6);
    expect(mid?.y).toBeCloseTo(0.4, 6);
  });

  it('lerpAngle takes the shortest arc across ±pi', () => {
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 4);
  });
});

describe('cameraMath — follow lerp convergence', () => {
  it('a scalar lerp toward a target converges monotonically', () => {
    let value = 0;
    const target = 100;
    let previousDistance = Math.abs(target - value);
    for (let i = 0; i < 300; i++) {
      value = lerp(value, target, 0.1);
      const distance = Math.abs(target - value);
      expect(distance).toBeLessThanOrEqual(previousDistance);
      previousDistance = distance;
    }
    expect(value).toBeCloseTo(target, 3);
  });

  it('computeCameraState pulls the camera centre onto a static target', () => {
    const params: CameraDirectorParams = {
      followLerp: 0.12,
      zoomLerp: 0.1,
      lookAhead: { carLengthPx: 100, lookAheadCarLengths: 1, saturationSpeed: 10 },
      shake: { maxOffsetPx: 0, maxAngleRad: 0, freqHz: 20, seed: 1 },
      traumaDecayPerSec: 1.2,
      kickRecoverSec: 0.3,
    };
    let center: Vec2 = { x: 0, y: 0 };
    const target: Vec2 = { x: 1000, y: 500 };
    for (let i = 0; i < 400; i++) {
      const out = computeCameraState(
        {
          dt: 1 / 60,
          time: i / 60,
          center,
          target,
          velocity: { x: 0, y: 0 },
          speed: 0,
          trauma: 0,
          kick: { x: 0, y: 0 },
          zoom: 1,
          targetZoom: 1,
        },
        params,
      );
      center = out.center;
      // No shake / kick / trauma -> render centre equals the smoothed centre.
      expect(out.renderCenter).toEqual(center);
    }
    expect(center.x).toBeCloseTo(1000, 2);
    expect(center.y).toBeCloseTo(500, 2);
  });
});

describe('cameraMath — trauma^2 mapping + decay', () => {
  it('maps shake as trauma squared, clamped to [0, 1]', () => {
    expect(traumaToShake(0.5)).toBeCloseTo(0.25, 9);
    expect(traumaToShake(1)).toBeCloseTo(1, 9);
    expect(traumaToShake(1.5)).toBeCloseTo(1, 9);
    expect(traumaToShake(-1)).toBeCloseTo(0, 9);
  });

  it('adds trauma with saturation at 1', () => {
    expect(addTrauma(0.2, 0.3)).toBeCloseTo(0.5, 9);
    expect(addTrauma(0.8, 0.5)).toBeCloseTo(1, 9);
  });

  it('decays trauma linearly, never below 0', () => {
    expect(decayTrauma(1, 1.2, 0.25)).toBeCloseTo(0.7, 9);
    expect(decayTrauma(0.3, 1.2, 0.5)).toBeCloseTo(0, 9);
  });
});

describe('cameraMath — look-ahead proportionality + cap', () => {
  const params = { carLengthPx: 100, lookAheadCarLengths: 2, saturationSpeed: 10 };
  const capPx = params.carLengthPx * params.lookAheadCarLengths; // 200

  it('is zero when stationary', () => {
    expect(computeLookAhead({ x: 0, y: 0 }, 0, params)).toEqual({ x: 0, y: 0 });
  });

  it('scales linearly with speed up to the saturation speed', () => {
    const half = computeLookAhead({ x: 5, y: 0 }, 5, params);
    expect(half.x).toBeCloseTo(capPx * 0.5, 6);
    expect(half.y).toBeCloseTo(0, 6);
  });

  it('caps at the car-length limit past saturation and follows travel direction', () => {
    const fast = computeLookAhead({ x: 40, y: 0 }, 40, params);
    expect(fast.x).toBeCloseTo(capPx, 6);
    const down = computeLookAhead({ x: 0, y: -3 }, 3, params);
    expect(down.x).toBeCloseTo(0, 6);
    expect(down.y).toBeCloseTo(-capPx * 0.3, 6);
  });
});

describe('cameraMath — clamp helper', () => {
  it('clamps to the range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

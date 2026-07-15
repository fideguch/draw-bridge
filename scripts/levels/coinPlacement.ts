/**
 * Coin auto-placement along a recorded driving trajectory (round-4 coin overhaul).
 *
 * USER MANDATE: "どのステージもコインの配置が車を通った想定がされていない。絶対に
 * 取れないコインが多すぎる" — coins must lie ON the intended driving route and be
 * machine-proved collectable. This module derives each level's coins from the
 * recorded primary-ghost TRAJECTORY (the per-tick VehicleReferencePoint path,
 * GhostPlayer.recordGhostTrajectory), so coins become the route guide (genre
 * standard) instead of hand-placed decorations the car never reaches.
 *
 * COLLECTION GEOMETRY (why the offset is 0.3 m, NOT the naive 0.55 m): a coin is
 * collected when the VehicleReferencePoint — the chassis AABB CENTER — comes
 * within coin.collectRadiusM (0.5 m) of the coin center (CoinTracker). The
 * recorded trajectory already IS that center path, so a coin offset straight up
 * by 0.3 m sits at the car's roof line (chassisHalfHeight 0.25 + corner 0.08 ≈
 * 0.33 m above the center) and is swept up with ~0.2 m of radius margin. A 0.55 m
 * offset would exceed the 0.5 m radius and be UNCOLLECTABLE — the coin gate
 * (gate2) would reject it. The machine gate is the arbiter; 0.3 m is the value
 * that both reads as "floating just above the car" and passes it.
 *
 * Coins are spaced by EVEN ARC LENGTH across the interesting span (the leading
 * stationary anticipation ticks contribute zero arc length and are skipped for
 * free; the goal approach is trimmed so coins never sit inside the flag). The
 * count is preserved per level, keeping the currency economy unchanged.
 */

import type { Point } from '../../src/engine/level/LevelSchema';
import type { TrajectorySample } from '../../src/engine/replay/GhostPlayer';

/**
 * Vertical offset (m) applied to each placed coin above the reference-point path.
 * See module header: 0.3 m = car roof line, inside collectRadiusM (0.5 m).
 */
export const COIN_ROOF_OFFSET_M = 0.3;

/** Fraction of total driven arc length before the first coin (skips the launch). */
export const COIN_SPAN_START_FRAC = 0.06;

/** Fraction of total driven arc length after the last coin (clears the goal flag). */
export const COIN_SPAN_END_FRAC = 0.9;

/** Round to millimetre precision — far inside the collection margin, clean JSON. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Cumulative arc length at each trajectory vertex (cum[0] = 0). */
function cumulativeArcLength(trajectory: readonly TrajectorySample[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < trajectory.length; i++) {
    const a = trajectory[i - 1] as TrajectorySample;
    const b = trajectory[i] as TrajectorySample;
    cum.push((cum[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return cum;
}

/** Linearly interpolate the reference point at a target arc length (clamped). */
function pointAtArcLength(
  trajectory: readonly TrajectorySample[],
  cum: readonly number[],
  target: number,
): Point {
  const total = cum[cum.length - 1] as number;
  if (target <= 0) {
    const first = trajectory[0] as TrajectorySample;
    return { x: first.x, y: first.y };
  }
  if (target >= total) {
    const last = trajectory[trajectory.length - 1] as TrajectorySample;
    return { x: last.x, y: last.y };
  }
  let i = 1;
  while (i < cum.length && (cum[i] as number) < target) {
    i++;
  }
  const lo = cum[i - 1] as number;
  const hi = cum[i] as number;
  const segLen = hi - lo;
  const f = segLen > 0 ? (target - lo) / segLen : 0;
  const a = trajectory[i - 1] as TrajectorySample;
  const b = trajectory[i] as TrajectorySample;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Place `count` coins along the driving trajectory at even arc-length intervals
 * within [COIN_SPAN_START_FRAC, COIN_SPAN_END_FRAC] of the total, each lifted
 * COIN_ROOF_OFFSET_M above the reference-point path. Returns [] for count 0 or a
 * degenerate (zero-length) trajectory.
 */
export function placeCoinsAlongTrajectory(
  trajectory: readonly TrajectorySample[],
  count: number,
  offsetY: number = COIN_ROOF_OFFSET_M,
): Point[] {
  if (count <= 0 || trajectory.length < 2) {
    return [];
  }
  const cum = cumulativeArcLength(trajectory);
  const total = cum[cum.length - 1] as number;
  if (total <= 0) {
    return [];
  }
  const startLen = total * COIN_SPAN_START_FRAC;
  const endLen = total * COIN_SPAN_END_FRAC;
  const coins: Point[] = [];
  for (let k = 0; k < count; k++) {
    const target =
      count === 1 ? (startLen + endLen) / 2 : startLen + ((endLen - startLen) * k) / (count - 1);
    const base = pointAtArcLength(trajectory, cum, target);
    coins.push({ x: round3(base.x), y: round3(base.y + offsetY) });
  }
  return coins;
}

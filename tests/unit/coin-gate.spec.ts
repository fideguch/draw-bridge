/**
 * Coin gate (Gate 2.5) contract tests — the coin collection check must be a
 * MEANINGFUL guard, not a vacuous pass (learnings: vacuous-verification lesson).
 *
 * Round-4 mandate A: "絶対に取れないコインが多すぎる" — coins must lie ON the
 * intended driving route and be machine-proved collectable. The gate replays
 * each ghost, sweeps coins with the real CoinTracker rule, and requires at least
 * one route to collect EVERY coin. These tests prove:
 *   1. POSITIVE — auto-placed on-route coins pass the coin gate.
 *   2. NEGATIVE CONTROL — a single off-route coin FAILS it (proves it can fail).
 *
 * Coins are re-derived in-test (placeCoinsAlongTrajectory over the recorded
 * route) so the assertions are independent of whatever coin data is committed.
 *
 * ROUND-9 SCOPE: these cover the v1 coin gate on the shipped v1 levels (CS-1
 * keeps them green). Under v2 the coins objective is the ★2 target (BR-014) —
 * the collectability GATE itself is unchanged; v2 coin/objective gate coverage
 * lands with CS-4's level regeneration.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Level, Point } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { recordGhostTrajectory } from '@engine/replay/GhostPlayer';
import { gate2Check } from '../../scripts/gates/gate2-ghost';
import { placeCoinsAlongTrajectory } from '../../scripts/levels/coinPlacement';

const FIXTURE_ID = 'ch1-l01';

function loadRawLevel(id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`levels/${id}.json`, 'utf-8')) as Record<string, unknown>;
}

function toLevel(raw: Record<string, unknown>): Level {
  const parsed = validateLevel(raw, { filenameStem: raw['id'] as string });
  if (!parsed.ok) {
    throw new Error(`fixture ${String(raw['id'])} invalid: ${parsed.errors.join(', ')}`);
  }
  return parsed.level;
}

/** On-route coins for the fixture's primary ghost (independent of committed data). */
function onRouteCoins(level: Level, count: number): Point[] {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    throw new Error('fixture has no ghost');
  }
  const strokePts: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const recorded = recordGhostTrajectory(level, strokePts);
  expect(recorded.committed).toBe(true);
  const coins = placeCoinsAlongTrajectory(recorded.trajectory, count);
  expect(coins).toHaveLength(count);
  return coins;
}

describe('coin gate (Gate 2.5)', () => {
  const raw = loadRawLevel(FIXTURE_ID);
  const level = toLevel(raw);
  const count = 5;

  it('passes when every coin lies on the driven route (auto-placed)', () => {
    const coins = onRouteCoins(level, count);
    const { errors } = gate2Check({ json: { ...raw, coins } });
    expect(errors.filter((e) => e.includes('coin-gate'))).toEqual([]);
  });

  it('CATCHES an off-route coin: one coin flung off every route FAILS the gate', () => {
    const coins = onRouteCoins(level, count);
    const first = coins[0] as Point;
    // Fling coin 0 far above the route — unreachable by any driving line.
    const offRoute: Point[] = [{ x: first.x, y: first.y + 50 }, ...coins.slice(1)];
    const { errors } = gate2Check({ json: { ...raw, coins: offRoute } });
    const coinErrors = errors.filter((e) => e.includes('coin-gate'));
    expect(coinErrors.length).toBeGreaterThan(0);
    expect(coinErrors[0]).toContain('off every recorded route');
  });
});

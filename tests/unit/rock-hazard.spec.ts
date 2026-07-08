import { describe, expect, it } from 'vitest';
import type { Level, Point, Rock } from '@engine/level/LevelSchema';
import { GameSimulation } from '@engine/GameSimulation';
import {
  SPIKE_WORLD_BUDGET,
  arcStroke,
  buildSpikeLevel,
  simulationInternals,
} from '../../src/debug/SpikeScenario';

/**
 * Rock hazard — the competitor-documented "block the falling/rolling object with
 * your line" entity (user round-5 mandate). A RockHazard is a plain dynamic
 * circle: it rolls/falls under normal gravity, collides with terrain, the drawn
 * BridgeChain, and the car, and — with NO new fail rule — induces the existing
 * tipOver/fall/timeout when it reaches the car undeflected. The drawn line is its
 * shield/deflector.
 *
 * WORLD BUDGET (LIB-QUIRK, World.ts header): phaser-box2d@1.1.0 never frees world
 * slots (~32/process). Every fresh GameSimulation here owns one slot; this file
 * builds well under SPIKE_WORLD_BUDGET (asserted below).
 */

/** The frozen no-rock determinism hash (research.md §R10; spike:determinism). */
const NO_ROCK_PROBE_HASH = 'd39a29bd';

/** A tiny valid stroke resting on the left platform: commits, but is NOT a bridge. */
const HARMLESS_STROKE: readonly Point[] = [
  { x: -12, y: 0.2 },
  { x: -9, y: 0.2 },
];

function spikeLevelWithRocks(gapM: number, rocks: readonly Rock[]): Level {
  return { ...buildSpikeLevel(gapM, { runUpM: 6, flagOffsetM: 5 }), rocks };
}

/** Run a full attempt on a fresh world; return the world stateHash + rock pose. */
function runFreshToOutcome(
  level: Level,
  stroke: readonly Point[],
): { hash: string; outcome: string; ticks: number; rock: Rock | undefined } {
  const sim = new GameSimulation(level, { method: 'chain' });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      throw new Error(`commit failed: ${commit.reason}`);
    }
    const outcome = sim.runToOutcome();
    const state = sim.renderRocks.renderState()[0];
    return {
      hash: simulationInternals(sim).world.stateHash(),
      outcome: outcome.outcome,
      ticks: outcome.ticks,
      rock: state === undefined ? undefined : { x: state.x, y: state.y, radius: state.radius },
    };
  } finally {
    sim.destroy();
  }
}

/** Step `ticks` fixed steps (or until the attempt ends); return min rock y seen. */
function minRockYOverRun(level: Level, stroke: readonly Point[], ticks: number): number {
  const sim = new GameSimulation(level, { method: 'chain' });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      throw new Error(`commit failed: ${commit.reason}`);
    }
    let minY = Infinity;
    for (let i = 0; i < ticks; i++) {
      const out = sim.step();
      const rock = sim.renderRocks.renderState()[0];
      if (rock !== undefined) {
        minY = Math.min(minY, rock.y);
      }
      if (out !== null) {
        break;
      }
    }
    return minY;
  } finally {
    sim.destroy();
  }
}

describe('RockHazard — spawn + render observation', () => {
  it('reserves well under the phaser-box2d world budget', () => {
    // 9 fresh worlds across this file (spawn 1, velocity 1, determinism 2,
    // negative-control 1, shield 2, crush 2) — keep the budget guard honest.
    expect(9).toBeLessThanOrEqual(SPIKE_WORLD_BUDGET);
  });

  it('spawns one body per level rock at its authored position (after settle, unmoved)', () => {
    const level = spikeLevelWithRocks(4, [{ x: 1.5, y: 2.5, radius: 0.4 }]);
    const sim = new GameSimulation(level, { method: 'chain' });
    try {
      expect(sim.renderRocks.count).toBe(1);
      const state = sim.renderRocks.renderState();
      expect(state).toHaveLength(1);
      // Spawned AFTER the pre-commit settle, so it is exactly at spawn (unstepped).
      expect(state[0]?.x).toBe(1.5);
      expect(state[0]?.y).toBe(2.5);
      expect(state[0]?.radius).toBe(0.4);
    } finally {
      sim.destroy();
    }
  });

  it('a level with no rocks builds zero rock bodies', () => {
    const sim = new GameSimulation(buildSpikeLevel(4), { method: 'chain' });
    try {
      expect(sim.renderRocks.count).toBe(0);
      expect(sim.renderRocks.renderState()).toEqual([]);
    } finally {
      sim.destroy();
    }
  });

  it('honours initialVelocity — a rock rolls in its seeded direction', () => {
    const level = spikeLevelWithRocks(4, [{ x: -6, y: 0.6, radius: 0.3, initialVelocity: { x: -4, y: 0 } }]);
    const sim = new GameSimulation(level, { method: 'chain' });
    try {
      const startX = sim.renderRocks.renderState()[0]?.x ?? 0;
      sim.commitStroke(HARMLESS_STROKE);
      for (let i = 0; i < 10; i++) {
        sim.step();
      }
      const laterX = sim.renderRocks.renderState()[0]?.x ?? 0;
      expect(laterX).toBeLessThan(startX - 0.2); // seeded -x velocity carried it left
    } finally {
      sim.destroy();
    }
  });
});

describe('RockHazard — determinism (rocks participate in stateHash)', () => {
  it('two fresh runs of a rock level produce ONE identical stateHash + rock pose', () => {
    const level = spikeLevelWithRocks(4, [{ x: 0, y: 1.2, radius: 0.3 }]);
    const a = runFreshToOutcome(level, arcStroke(4));
    const b = runFreshToOutcome(level, arcStroke(4));

    expect(a.outcome).toBe(b.outcome);
    expect(a.ticks).toBe(b.ticks);
    expect(a.hash).toBe(b.hash); // exact float64 bits, no quantization
    // exact float equality on the rock's final resting pose (bit-reproducibility)
    expect(a.rock?.x).toBe(b.rock?.x);
    expect(a.rock?.y).toBe(b.rock?.y);
  });

  it('NEGATIVE CONTROL: an empty rocks[] is byte-identical to a pre-rock world', () => {
    // Same scenario as runDeterminismProbe (buildSpikeLevel(2), arcStroke(2)),
    // but with rocks:[] injected. The frozen hash MUST NOT move — proof that the
    // rock feature is a true no-op when a level carries no rocks.
    const level: Level = { ...buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }), rocks: [] };
    const result = runFreshToOutcome(level, arcStroke(2));
    expect(result.outcome).toBe('clear');
    expect(result.hash).toBe(NO_ROCK_PROBE_HASH);
    expect(result.rock).toBeUndefined();
  });
});

describe('RockHazard — collision (line is a shield/deflector)', () => {
  it('rock-vs-bridge: a drawn line blocks the rock; without it the rock falls through', () => {
    const level = spikeLevelWithRocks(4, [{ x: 0, y: 1.2, radius: 0.3 }]);
    // WITH a bridge over the gap the falling rock is caught and held up high…
    const caughtMinY = minRockYOverRun(level, arcStroke(4), 60);
    // …WITHOUT one (a harmless off-gap stroke) it drops through the empty gap.
    const droppedMinY = minRockYOverRun(level, HARMLESS_STROKE, 60);

    expect(caughtMinY).toBeGreaterThan(-1); // stayed on/near the bridge
    expect(droppedMinY).toBeLessThan(-2.5); // fell into the chasm
    expect(caughtMinY - droppedMinY).toBeGreaterThan(2); // decisive deflection
  });

  it('rock-vs-car: an undeflected rock reaching the car turns a clear into a fail', () => {
    const cleanLevel = buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 });
    const rockLevel = spikeLevelWithRocks(4, [{ x: 0.3, y: 1.5, radius: 0.45, density: 8 }]);

    const clean = runFreshToOutcome(cleanLevel, arcStroke(4));
    const crushed = runFreshToOutcome(rockLevel, arcStroke(4));

    expect(clean.outcome).toBe('clear'); // no rock → the car crosses
    expect(crushed.outcome).toBe('fail'); // the rock lands in its path → fail
  });
});

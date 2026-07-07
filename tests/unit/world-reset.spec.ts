import { describe, expect, it } from 'vitest';
import { b2Joint_IsValid } from 'phaser-box2d';
import type { Point } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import { GameSimulation } from '@engine/GameSimulation';
import { buildBridge } from '@engine/physics/BridgeChainBuilder';
import { processStroke } from '@engine/physics/StrokePipeline';
import { GhostRecorder } from '@engine/replay/GhostRecorder';
import { replayGhostSuite, runScriptedAttempt } from '@engine/replay/GhostPlayer';
import type { GhostSolution } from '@engine/level/LevelSchema';
import { buildSpikeLevel, arcStroke } from '../../src/debug/SpikeScenario';

/**
 * C1 — attempt recycling on one physics world (World.reset + GameSimulation.reset
 * + GhostPlayer batch). phaser-box2d never frees world slots (max 32/process),
 * so replaying a whole chapter in one process needs slot REUSE, not fresh slots.
 *
 * Determinism note (measured, World.reset header): a recycled slot is NOT
 * bit-identical to a fresh slot (Box2D's solver-set / id-pool ordering carries
 * over), but the effect is bounded + reproducible — tick-identical, sub-mm
 * final-position drift, comfortably inside the Gate 2 band — and an identical
 * attempt sequence yields an identical hash sequence. Fresh-slot determinism
 * (the S3 1000-run proof) never calls reset() and is unaffected.
 */

const level = buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 });
const stroke = arcStroke(2);

/** Run N reset()-recycled attempts on one world; collect hash/ticks/finalPos. */
function resetSequence(n: number): { hashes: string[]; ticks: number[]; finalPos: Point[] } {
  const world = new World();
  const simulation = new GameSimulation(level, { method: 'chain', world });
  const hashes: string[] = [];
  const ticks: number[] = [];
  const finalPos: Point[] = [];
  try {
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        simulation.reset();
      }
      const commit = simulation.commitStroke(stroke);
      expect(commit.committed).toBe(true);
      const outcome = simulation.runToOutcome();
      expect(outcome.outcome).toBe('clear');
      hashes.push(world.stateHash());
      ticks.push(outcome.ticks);
      finalPos.push(simulation.referencePoint());
    }
  } finally {
    simulation.destroy();
    world.destroy();
  }
  return { hashes, ticks, finalPos };
}

describe('World.reset — slot recycling primitives', () => {
  it('clears all tracked bodies and keeps the same slot alive for reuse', () => {
    const world = new World();
    world.createBody({ type: 'dynamic', position: { x: 0, y: 5 } });
    world.createBody({ type: 'static', position: { x: 0, y: 0 } });
    expect(world.bodyCount).toBe(2);

    world.reset();
    expect(world.bodyCount).toBe(0);
    expect(world.isDestroyed).toBe(false);

    // the SAME slot is still usable after reset
    world.createBody({ type: 'dynamic', position: { x: 1, y: 5 } });
    expect(world.bodyCount).toBe(1);
    expect(() => world.step()).not.toThrow();
    world.destroy();
  });

  it('destroys every registered joint (chain bridge) and frees its bodies', () => {
    const world = new World();
    const result = processStroke([
      { x: -3, y: 1 },
      { x: 3, y: 1 },
    ]);
    if (result.discarded) {
      expect.fail('fixture stroke must not be discarded');
    }
    const chain = buildBridge(world, result.resampled, { method: 'chain', strokeId: 1, vehicleMass: 4 });
    expect(chain.joints.length).toBeGreaterThan(0);
    expect(world.bodyCount).toBeGreaterThan(0);

    world.reset();
    expect(world.bodyCount).toBe(0);
    for (const jointId of chain.joints) {
      expect(b2Joint_IsValid(jointId)).toBe(false);
    }
    world.destroy();
  });
});

describe('GameSimulation.reset — unbounded attempts on one world (C1)', () => {
  it('serves 100 reset() attempts (>3x the 32-slot cap) with a deterministic outcome', () => {
    const { ticks, finalPos } = resetSequence(100);
    expect(ticks).toHaveLength(100);
    // macroscopic determinism: identical tick count every attempt
    expect(new Set(ticks).size).toBe(1);
    // final position stable to sub-mm across all 100 recycled attempts
    const first = finalPos[0] as Point;
    for (const p of finalPos) {
      expect(Math.hypot(p.x - first.x, p.y - first.y)).toBeLessThan(0.01);
    }
  });

  it('reproducible determinism: an identical reset() sequence yields an identical hash sequence', () => {
    // two independent worlds, same 25-attempt reset sequence -> bit-identical
    // hash sequences (drift within a sequence is deterministic, not chaotic).
    const a = resetSequence(25).hashes;
    const b = resetSequence(25).hashes;
    expect(a).toHaveLength(25);
    expect(a).toEqual(b);
  });
});

describe('GhostPlayer.replayGhostSuite — batch replay on one world (C1)', () => {
  it('replays 40 ghosts in one process (>32) with no slot exhaustion, all in-band', () => {
    // record a ghost once on a fresh world
    const recorder = new GhostRecorder();
    const recorded = runScriptedAttempt(level, stroke, {
      onTick: (tick, referencePoint) => recorder.sample(tick, referencePoint),
    });
    if (!recorded.committed || recorded.outcome !== 'clear' || recorded.starRating === null) {
      expect.fail('spike arc stroke must clear to record a ghost');
    }
    const ghost: GhostSolution = recorder.toGhostSolution({
      stroke: recorded.stroke,
      ticks: recorded.ticks,
      finalPos: recorded.finalPos,
      inkConsumed: recorded.inkConsumed,
      starRating: recorded.starRating,
    });

    // 40 replays > 32-slot cap: replayGhostSuite recycles ONE world
    const items = Array.from({ length: 40 }, () => ({ level, ghost }));
    const results = replayGhostSuite(items);

    expect(results).toHaveLength(40);
    for (const result of results) {
      expect(result.pass).toBe(true); // recycled-slot drift stays inside the Gate 2 band
      expect(result.details.comparison?.outcomeMatch).toBe(true);
    }
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GhostSolution, Level, Point } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import { GameSimulation } from '@engine/GameSimulation';

/**
 * CS-6 — runtime world-slot reuse regression (P0).
 *
 * The shipped game entered every level with a FRESH `new World()` (PlayScene is
 * re-created on a Phaser scene restart), but phaser-box2d never frees a world
 * slot (max 32/process, World.ts LIB-QUIRK). The 45-level campaign therefore
 * threw `slot limit (32/process) exhausted` at the 33rd level entry — bricking
 * progression at l27->l28 (e2e campaign.spec's original failure).
 *
 * The fix (render getSharedWorld) reuses ONE World across level entries: each
 * entry binds a GameSimulation to the shared world (ownsWorld=false) whose
 * constructor reset()s the slot to a clean slate; teardown destroy()s the sim
 * but NOT the shared world. This spec is the headless proxy for that runtime
 * loop — 50 sequential entries (well past the 32-slot cap) on ONE shared world,
 * each replaying the real l01 ghost stroke.
 *
 * Slot budget note: vitest's 'forks' pool isolates each spec FILE in its own
 * worker, so the few worlds created here (all destroyed) die with this worker.
 * This file stays well under 32 live worlds at once.
 */

const CYCLES = 50;
const CYCLE_45 = 44; // 0-based index of the 45th entry

function loadLevelWithGhost(id: string): { level: Level; stroke: Point[] } {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'levels', `${id}.json`), 'utf8'));
  const validation = validateLevel(raw);
  if (!validation.ok) {
    throw new Error(`fixture level ${id} failed validation: ${validation.errors.join('; ')}`);
  }
  const ghost: GhostSolution | undefined = validation.level.ghostSolutions[0];
  if (ghost === undefined) {
    throw new Error(`fixture level ${id} has no ghost solution`);
  }
  // Ghost strokes are stored as [x, y] tuples; commitStroke wants Point[] (same
  // conversion replayGhost does), so gameplay is identical to the headless gate.
  const stroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  return { level: validation.level, stroke };
}

interface EntryResult {
  readonly outcome: 'clear' | 'fail';
  readonly hash: string;
  readonly ticks: number;
}

/** Gate 2 macroscopic-determinism tolerance on the run tick count (per
 *  contracts/gate-pipeline.md §3 — the recycled slot is guaranteed inside it). */
const GATE2_TICK_TOLERANCE = 30;

/**
 * One render-faithful level entry: construct a GameSimulation bound to the
 * shared world (ctor reset()s the recycled slot), replay the ghost stroke to its
 * outcome, then destroy the sim (ownsWorld=false, so the world slot survives —
 * the whole point of the fix). Mirrors PlayScene.create -> teardown per entry.
 */
function enterLevel(level: Level, stroke: readonly Point[], world: World): EntryResult {
  const sim = new GameSimulation(level, { world });
  try {
    const commit = sim.commitStroke(stroke);
    expect(commit.committed).toBe(true);
    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
    }
    return { outcome: outcome.outcome, hash: world.stateHash(), ticks: outcome.ticks };
  } finally {
    sim.destroy();
  }
}

describe('CS-6 — runtime world-slot reuse (P0)', () => {
  it('serves 50 sequential level entries on ONE shared world, past the 32-slot cap, all clearing', { timeout: 30_000 }, () => {
    const { level, stroke } = loadLevelWithGhost('ch1-l01');

    // Baseline: a truly FRESH world replaying l01 once (the pre-fix per-entry
    // state). Entry 1 on the shared world must reproduce this bit-for-bit.
    const fresh = new World();
    let freshHash: string;
    try {
      freshHash = enterLevel(level, stroke, fresh).hash;
    } finally {
      fresh.destroy();
    }

    const world = new World();
    const hashes: string[] = [];
    const ticks: number[] = [];
    try {
      for (let i = 0; i < CYCLES; i++) {
        const entry = enterLevel(level, stroke, world);
        expect(entry.outcome, `entry #${i + 1} must clear`).toBe('clear');
        hashes.push(entry.hash);
        ticks.push(entry.ticks);
      }
    } finally {
      world.destroy();
    }

    expect(hashes).toHaveLength(CYCLES);
    // Entry 1 on the reused slot equals a fresh world — no reuse penalty on
    // first use (the recycled world starts empty via the ctor reset()).
    expect(hashes[0]).toBe(freshHash);
    // Entry 1 and entry 45 settle to the IDENTICAL state: l01 plays the same
    // whether it is your 1st or 45th level entry of the session (the task's
    // money-shot invariant; deterministic + machine-independent IEEE-754).
    expect(hashes[CYCLE_45]).toBe(hashes[0]);
    // Macroscopic determinism: every entry's run length stays within the Gate 2
    // ±30-tick band of entry 1 (recycled-slot drift is bounded, not chaotic — a
    // broken reset would blow past this or fail to clear). See World.reset()
    // header + contracts/gate-pipeline.md §3.
    const firstTicks = ticks[0] as number;
    for (let i = 0; i < ticks.length; i++) {
      expect(
        Math.abs((ticks[i] as number) - firstTicks),
        `entry #${i + 1} tick drift`,
      ).toBeLessThanOrEqual(GATE2_TICK_TOLERANCE);
    }
  });

  it('is reproducible: the identical 50-entry sequence on two shared worlds yields identical hash sequences', { timeout: 30_000 }, () => {
    const { level, stroke } = loadLevelWithGhost('ch1-l01');
    const runSequence = (): string[] => {
      const world = new World();
      const hashes: string[] = [];
      try {
        for (let i = 0; i < CYCLES; i++) {
          hashes.push(enterLevel(level, stroke, world).hash);
        }
      } finally {
        world.destroy();
      }
      return hashes;
    };
    const a = runSequence();
    const b = runSequence();
    expect(a).toHaveLength(CYCLES);
    // Deterministic, not chaotic: recycled-slot drift is a pure function of the
    // entry sequence, so two independent worlds match position-for-position.
    expect(a).toEqual(b);
  });
});

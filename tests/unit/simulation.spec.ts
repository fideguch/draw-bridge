import { describe, expect, it } from 'vitest';
import exampleValid from '../fixtures/levels/example-valid.json';
import type { Level, Point } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { GameSimulation } from '@engine/GameSimulation';

/**
 * GameSimulation — one-attempt engine facade (World + Terrain + Stroke ->
 * Bridge + Vehicle + StressTracker + Judge + InkBudget + coins + events).
 * GhostPlayer, the gate scripts, and PlayScene all consume THIS lifecycle:
 *
 *   construct (settle) -> commitStroke -> step()* -> outcome
 *
 * Ink choreography inside commitStroke (FR-002/FR-003):
 * - raw polyline length is decremented on commit (same-frame contract);
 * - a discarded stroke (min-length rule) refunds in full;
 * - an accepted stroke settles the account to the SIMPLIFIED arc length
 *   (the authoritative inkConsumed, = StrokePipeline totalLength).
 */

function fixtureLevel(): Level {
  const validation = validateLevel(structuredClone(exampleValid));
  if (!validation.ok) {
    throw new Error(`fixture level must validate: ${validation.errors.join(' | ')}`);
  }
  return validation.level;
}

const SCRIPTED_STROKE: readonly Point[] = [
  { x: -2, y: 0.15 },
  { x: 2, y: 0.15 },
];

describe('GameSimulation — full attempt on the fixture level', () => {
  it('draw -> launch -> clear with stars, ink accounting, and ordered events', () => {
    const level = fixtureLevel();
    const simulation = new GameSimulation(level);
    const log: string[] = [];
    simulation.events.on('strokeCommitted', (payload) => {
      log.push('strokeCommitted');
      expect(payload.length).toBeCloseTo(4, 6);
      expect(payload.segments).toBeGreaterThanOrEqual(1);
    });
    simulation.events.on('launchStarted', () => log.push('launchStarted'));
    simulation.events.on('launchReleased', () => log.push('launchReleased'));
    simulation.events.on('coinCollected', () => log.push('coinCollected'));
    simulation.events.on('cleared', () => log.push('cleared'));
    simulation.events.on('failed', () => log.push('failed'));

    expect(simulation.phase).toBe('drawing');
    expect(simulation.inkState.remaining).toBe(level.inkBudget);

    const commit = simulation.commitStroke(SCRIPTED_STROKE);
    expect(commit.committed).toBe(true);
    expect(simulation.phase).toBe('anticipation');
    expect(simulation.inkState.consumed).toBeCloseTo(4, 6);
    expect(simulation.inkState.remaining).toBeCloseTo(level.inkBudget - 4, 6);

    const outcome = simulation.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    if (outcome.outcome !== 'clear') {
      return;
    }
    expect(outcome.ticks).toBeGreaterThan(0);
    expect(outcome.inkConsumed).toBeCloseTo(4, 6);
    expect(outcome.starRating).toBe(3); // 4 m <= star3 (8)
    expect(outcome.coinsCollected).toBeGreaterThanOrEqual(1); // coins sit on the driving line
    expect(simulation.phase).toBe('ended');

    // event order: commit pair first, then release, coins during run, cleared last
    expect(log.slice(0, 3)).toEqual(['strokeCommitted', 'launchStarted', 'launchReleased']);
    expect(log[log.length - 1]).toBe('cleared');
    expect(log).not.toContain('failed');
    expect(log.filter((name) => name === 'coinCollected')).toHaveLength(outcome.coinsCollected);

    // outcome is stable after the run; extra step() calls are idempotent
    expect(simulation.step()).toEqual(outcome);
    expect(simulation.outcome).toEqual(outcome);

    simulation.destroy();
    simulation.destroy(); // idempotent
  });

  it('cleared event carries the outcome tick', () => {
    const simulation = new GameSimulation(fixtureLevel());
    let clearedTick = -1;
    simulation.events.on('cleared', ({ tick }) => {
      clearedTick = tick;
    });
    simulation.commitStroke(SCRIPTED_STROKE);
    const outcome = simulation.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    expect(clearedTick).toBe(outcome.ticks);
    simulation.destroy();
  });
});

describe('GameSimulation — ink refund and rejection (FR-002, FR-003)', () => {
  it('a below-minimum stroke is discarded with a FULL refund and the attempt continues', () => {
    const level = fixtureLevel();
    const simulation = new GameSimulation(level);

    const tiny = simulation.commitStroke([
      { x: 0, y: 0.2 },
      { x: 0.1, y: 0.2 },
    ]);
    expect(tiny.committed).toBe(false);
    if (tiny.committed) {
      return;
    }
    expect(tiny.reason).toBe('tooShort');
    expect(simulation.phase).toBe('drawing'); // still drawable
    expect(simulation.inkState.remaining).toBe(level.inkBudget); // refunded

    // the same attempt can still commit a real stroke afterwards
    const commit = simulation.commitStroke(SCRIPTED_STROKE);
    expect(commit.committed).toBe(true);
    const outcome = simulation.runToOutcome();
    expect(outcome.outcome).toBe('clear');
    simulation.destroy();
  });

  it('rejects a stroke longer than the remaining ink without consuming anything', () => {
    const level = fixtureLevel();
    const simulation = new GameSimulation(level);
    const commit = simulation.commitStroke([
      { x: -2, y: 0.2 },
      { x: 18, y: 0.2 }, // 20 m raw > 18 m budget
    ]);
    expect(commit.committed).toBe(false);
    if (commit.committed) {
      return;
    }
    expect(commit.reason).toBe('insufficientInk');
    expect(simulation.inkState.remaining).toBe(level.inkBudget);
    expect(simulation.phase).toBe('drawing');
    simulation.destroy();
  });

  it('ink capacity upgrade scales the effective budget (FR-019, BR-005)', () => {
    const simulation = new GameSimulation(fixtureLevel(), { upgrades: { inkCapacityLv: 2 } });
    expect(simulation.inkState.effectiveBudget).toBeCloseTo(21.6, 9);
    expect(simulation.inkState.zone).toBe('ok');
    simulation.destroy();
  });
});

describe('GameSimulation — invalid stroke coordinates (L1)', () => {
  it('rejects non-finite points up front as "invalidPoints" with ink untouched', () => {
    const badStrokes: readonly (readonly Point[])[] = [
      [
        { x: Number.NaN, y: 0.15 },
        { x: 2, y: 0.15 },
      ],
      [
        { x: -2, y: 0.15 },
        { x: Number.POSITIVE_INFINITY, y: 0.15 },
      ],
      [
        { x: -2, y: 0.15 },
        { x: 2, y: Number.NEGATIVE_INFINITY },
      ],
    ];
    for (const bad of badStrokes) {
      const level = fixtureLevel();
      const simulation = new GameSimulation(level);
      const commit = simulation.commitStroke(bad);
      expect(commit.committed).toBe(false);
      if (commit.committed) {
        return;
      }
      expect(commit.reason).toBe('invalidPoints');
      expect(simulation.phase).toBe('drawing'); // still drawable
      expect(simulation.inkState.remaining).toBe(level.inkBudget); // ink untouched
      expect(simulation.inkState.consumed).toBe(0);
      simulation.destroy();
    }
  });
});

describe('GameSimulation — launchReleased timing (M3)', () => {
  it('fires at the first motorized tick: currentTick inside the handler is the step tick, not one behind', () => {
    const simulation = new GameSimulation(fixtureLevel());
    let releasedAtTick = -999;
    let hasReleased = false;
    simulation.events.on('launchReleased', () => {
      releasedAtTick = simulation.currentTick;
      hasReleased = true;
    });
    simulation.commitStroke(SCRIPTED_STROKE);

    // step one tick at a time; capture the step tick in which the event fired
    let firedDuringTick = -1;
    while (simulation.outcome === null) {
      const hasReleasedBefore = hasReleased;
      simulation.step();
      if (!hasReleasedBefore && hasReleased) {
        firedDuringTick = simulation.currentTick;
        break;
      }
    }

    expect(hasReleased).toBe(true);
    expect(releasedAtTick).toBeGreaterThanOrEqual(0);
    // the handler observed the step's OWN tick — pre-fix it read the prior tick
    expect(releasedAtTick).toBe(firedDuringTick);
    simulation.destroy();
  });
});

describe('GameSimulation — reset recycles the attempt on one world (C1)', () => {
  it('reset() re-runs the fixture level to the same clear outcome without a new slot', () => {
    const level = fixtureLevel();
    const simulation = new GameSimulation(level);
    const tickOutcomes: number[] = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        simulation.reset();
      }
      expect(simulation.phase).toBe('drawing');
      expect(simulation.inkState.remaining).toBe(level.inkBudget); // fresh budget each attempt
      const commit = simulation.commitStroke(SCRIPTED_STROKE);
      expect(commit.committed).toBe(true);
      const outcome = simulation.runToOutcome();
      expect(outcome.outcome).toBe('clear');
      if (outcome.outcome === 'clear') {
        tickOutcomes.push(outcome.ticks);
      }
      expect(simulation.phase).toBe('ended');
    }
    // Recycled-slot determinism: every recycled attempt clears at essentially
    // the same tick. The firmer chain (totalFlexBudgetRad 0.22 / jointHertz 9)
    // puts this fixture's straight-stroke crossing right on a tick boundary, so
    // a recycled slot's documented sub-mm drift (World.reset header: recycled
    // slots are NOT bit-identical to a fresh slot) can shift the goal-entry tick
    // by 1 — orders of magnitude inside the Gate 2 recycled band (±30 ticks).
    // Fresh-slot determinism (the S3 1000-run stateHash contract) is unaffected.
    const tickSpread = Math.max(...tickOutcomes) - Math.min(...tickOutcomes);
    expect(tickSpread).toBeLessThanOrEqual(1); // deterministic tick outcome per recycle (±1 recycled-slot drift)
    simulation.destroy();
  });
});

describe('GameSimulation — phase guards (one stroke per attempt)', () => {
  it('step() before a committed stroke throws', () => {
    const simulation = new GameSimulation(fixtureLevel());
    expect(() => simulation.step()).toThrow(/commit/i);
    simulation.destroy();
  });

  it('a second commitStroke after solidify throws', () => {
    const simulation = new GameSimulation(fixtureLevel());
    simulation.commitStroke(SCRIPTED_STROKE);
    expect(() => simulation.commitStroke(SCRIPTED_STROKE)).toThrow(/stroke|phase/i);
    simulation.destroy();
  });
});

describe('GameSimulation — fail path (FR-008)', () => {
  it('a ledge-only stroke ends in a fall with a failed event', () => {
    const simulation = new GameSimulation(fixtureLevel());
    const failedPayloads: { cause: string; tick: number }[] = [];
    simulation.events.on('failed', ({ cause, tick }) => failedPayloads.push({ cause, tick }));

    simulation.commitStroke([
      { x: -4, y: 0.2 },
      { x: -2.5, y: 0.2 },
    ]);
    const outcome = simulation.runToOutcome();
    expect(outcome.outcome).toBe('fail');
    if (outcome.outcome !== 'fail') {
      return;
    }
    expect(outcome.cause).toBe('fall');
    expect(outcome.causeLocation.y).toBeLessThan(fixtureLevel().killY);
    expect(failedPayloads).toEqual([{ cause: 'fall', tick: outcome.ticks }]);
    expect(simulation.phase).toBe('ended');
    simulation.destroy();
  });
});

describe('GameSimulation — compound fallback (method A)', () => {
  it('runs the attempt on a rigid compound bridge (no stress/creak/break)', () => {
    const simulation = new GameSimulation(fixtureLevel(), { method: 'compound' });
    const stressEvents: string[] = [];
    simulation.events.on('creak', () => stressEvents.push('creak'));
    simulation.events.on('break', () => stressEvents.push('break'));

    const commit = simulation.commitStroke(SCRIPTED_STROKE);
    expect(commit.committed).toBe(true);
    const outcome = simulation.runToOutcome();
    expect(outcome.outcome).toBe('clear'); // rigid bridge trivially holds
    expect(stressEvents).toEqual([]); // compound has no break behavior by design
    simulation.destroy();
  });
});

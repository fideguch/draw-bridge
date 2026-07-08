import { afterAll, describe, expect, it } from 'vitest';
import exampleValid from '../fixtures/levels/example-valid.json';
import type { GhostResult, GhostSolution, Level, Point } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { DEFAULT_SAMPLE_EVERY_TICKS, GhostRecorder } from '@engine/replay/GhostRecorder';
import {
  GHOST_FINAL_POS_EPSILON_M,
  GHOST_TICK_TOLERANCE,
  HAZARD_SETTLE_EPSILON_M,
  compareToRecorded,
  replayGhost,
  runScriptedAttempt,
} from '@engine/replay/GhostPlayer';
import { World } from '@engine/physics/World';
import { arcStroke, buildSpikeLevel } from '../../src/debug/SpikeScenario';

/**
 * T028 — ghost record + replay verification (FR-015, FR-026 Gate 2 substrate).
 *
 * GhostRecorder: VehicleReferencePoint samples every sampleEveryTicks
 * (authoring default 10), final sample pinned to the outcome tick/position ->
 * produces a GhostSolution that satisfies the level schema.
 *
 * GhostPlayer: re-runs level + stroke headlessly at Lv0 upgrades and verifies
 * the Gate 2 tolerance band (contracts/gate-pipeline.md §3):
 *   outcome exact match | finalPos epsilon 0.05 m | ticks +/-30 (inclusive).
 *
 * The integration test at the bottom IS the Phase 2 checkpoint: a scripted
 * stroke on the fixture level clears deterministically, records a ghost, and
 * replays back inside the band.
 */

function fixtureLevel(): Level {
  const validation = validateLevel(structuredClone(exampleValid));
  if (!validation.ok) {
    throw new Error(`fixture level must validate: ${validation.errors.join(' | ')}`);
  }
  return validation.level;
}

/** Straight stroke across the fixture gap (x in [-1, 1]) — the L1 "any line". */
const SCRIPTED_STROKE: readonly Point[] = [
  { x: -2, y: 0.15 },
  { x: 2, y: 0.15 },
];

const CLEAR_RESULT = {
  ticks: 300,
  finalPos: { x: 10.4, y: 0.9 },
  inkConsumed: 9.6,
  starRating: 2,
} as const;

describe('GhostRecorder — grid sampling', () => {
  it('records only every sampleEveryTicks-th tick (default 10)', () => {
    const recorder = new GhostRecorder();
    expect(DEFAULT_SAMPLE_EVERY_TICKS).toBe(10);
    for (let t = 0; t <= 25; t++) {
      recorder.sample(t, { x: t, y: -t });
    }
    const ghost = recorder.toGhostSolution({ stroke: SCRIPTED_STROKE, ...CLEAR_RESULT });
    const gridSamples = ghost.samples.slice(0, -1); // last one is the pinned final sample
    expect(gridSamples.map((s) => s.t)).toEqual([0, 10, 20]);
    expect(gridSamples[1]).toEqual({ t: 10, x: 10, y: -10 });
    expect(ghost.sampleEveryTicks).toBe(10);
  });

  it('honors a custom sampleEveryTicks', () => {
    const recorder = new GhostRecorder({ sampleEveryTicks: 5 });
    for (let t = 0; t <= 11; t++) {
      recorder.sample(t, { x: 0, y: 0 });
    }
    const ghost = recorder.toGhostSolution({ stroke: SCRIPTED_STROKE, ...CLEAR_RESULT });
    expect(ghost.samples.slice(0, -1).map((s) => s.t)).toEqual([0, 5, 10]);
    expect(ghost.sampleEveryTicks).toBe(5);
  });

  it('rejects invalid sampling input (bad ticks, non-monotonic, non-finite position)', () => {
    expect(() => new GhostRecorder({ sampleEveryTicks: 0 })).toThrow();
    const recorder = new GhostRecorder();
    expect(() => recorder.sample(-1, { x: 0, y: 0 })).toThrow();
    expect(() => recorder.sample(1.5, { x: 0, y: 0 })).toThrow();
    recorder.sample(10, { x: 0, y: 0 });
    expect(() => recorder.sample(10, { x: 0, y: 0 })).toThrow(); // must strictly increase
    expect(() => recorder.sample(20, { x: Number.NaN, y: 0 })).toThrow();
  });
});

describe('GhostRecorder — toGhostSolution schema shape', () => {
  it('pins the final sample to the outcome tick/position (off-grid tick appended)', () => {
    const recorder = new GhostRecorder();
    for (let t = 0; t <= 295; t++) {
      recorder.sample(t, { x: t / 100, y: 0.5 });
    }
    const ghost = recorder.toGhostSolution({ stroke: SCRIPTED_STROKE, ...CLEAR_RESULT });
    const last = ghost.samples[ghost.samples.length - 1];
    expect(last).toEqual({ t: 300, x: 10.4, y: 0.9 });
    // grid sample at 290 kept, no duplicate at 300
    expect(ghost.samples.filter((s) => s.t === 300)).toHaveLength(1);
  });

  it('replaces the grid sample when the outcome tick lands exactly on the grid', () => {
    const recorder = new GhostRecorder();
    for (let t = 0; t <= 300; t++) {
      recorder.sample(t, { x: 0, y: 0 });
    }
    const ghost = recorder.toGhostSolution({ stroke: SCRIPTED_STROKE, ...CLEAR_RESULT });
    const at300 = ghost.samples.filter((s) => s.t === 300);
    expect(at300).toHaveLength(1);
    expect(at300[0]).toEqual({ t: 300, x: 10.4, y: 0.9 }); // exact finalPos, not the grid reading
  });

  it('produces a ghost that passes LevelSchema validation when embedded in a level', () => {
    const recorder = new GhostRecorder({ kind: '3star' });
    for (let t = 0; t <= 100; t++) {
      recorder.sample(t, { x: t / 50, y: 0.4 });
    }
    const ghost = recorder.toGhostSolution({
      stroke: SCRIPTED_STROKE,
      ticks: 100,
      finalPos: { x: 2, y: 0.4 },
      inkConsumed: 4,
      starRating: 3,
    });
    expect(ghost.kind).toBe('3star');
    expect(ghost.stroke).toEqual([
      [-2, 0.15],
      [2, 0.15],
    ]);

    const levelJson = structuredClone(exampleValid) as Record<string, unknown>;
    levelJson['ghostSolutions'] = [structuredClone(ghost)];
    const validation = validateLevel(levelJson);
    expect(validation.ok).toBe(true);
  });

  it('rejects invalid results (short stroke, bad ticks, non-positive ink)', () => {
    const recorder = new GhostRecorder();
    recorder.sample(0, { x: 0, y: 0 });
    const base = { stroke: SCRIPTED_STROKE, ...CLEAR_RESULT };
    expect(() => recorder.toGhostSolution({ ...base, stroke: [{ x: 0, y: 0 }] })).toThrow();
    expect(() => recorder.toGhostSolution({ ...base, ticks: 0 })).toThrow();
    expect(() => recorder.toGhostSolution({ ...base, inkConsumed: 0 })).toThrow();
    expect(() => recorder.toGhostSolution({ ...base, finalPos: { x: Number.NaN, y: 0 } })).toThrow();
  });
});

describe('compareToRecorded — Gate 2 tolerance band edges', () => {
  const recorded: GhostResult = {
    outcome: 'clear',
    ticks: 300,
    finalPos: { x: 10, y: 0.5 },
    inkConsumed: 4,
    starRating: 3,
  };

  it('identical replay passes with zero deltas', () => {
    const comparison = compareToRecorded(recorded, {
      outcome: 'clear',
      ticks: 300,
      finalPos: { x: 10, y: 0.5 },
    });
    expect(comparison.pass).toBe(true);
    expect(comparison.outcomeMatch).toBe(true);
    expect(comparison.finalPosDeltaM).toBe(0);
    expect(comparison.tickDelta).toBe(0);
    expect(comparison.errors).toEqual([]);
  });

  it('final position tolerance is inclusive at exactly 0.05 m', () => {
    expect(GHOST_FINAL_POS_EPSILON_M).toBe(0.05);
    // exact-representation boundary: recorded at origin, replayed exactly eps away
    const atOrigin: GhostResult = { ...recorded, finalPos: { x: 0, y: 0 } };
    const atBand = compareToRecorded(atOrigin, {
      outcome: 'clear',
      ticks: 300,
      finalPos: { x: GHOST_FINAL_POS_EPSILON_M, y: 0 },
    });
    expect(atBand.finalPosDeltaM).toBe(GHOST_FINAL_POS_EPSILON_M);
    expect(atBand.pass).toBe(true);

    const outOfBand = compareToRecorded(atOrigin, {
      outcome: 'clear',
      ticks: 300,
      finalPos: { x: 0.0501, y: 0 },
    });
    expect(outOfBand.pass).toBe(false);
    expect(outOfBand.errors.join(' ')).toMatch(/finalPos/);
  });

  it('tick tolerance is inclusive at exactly +/-30 ticks', () => {
    expect(GHOST_TICK_TOLERANCE).toBe(30);
    expect(
      compareToRecorded(recorded, { outcome: 'clear', ticks: 330, finalPos: recorded.finalPos }).pass,
    ).toBe(true);
    expect(
      compareToRecorded(recorded, { outcome: 'clear', ticks: 270, finalPos: recorded.finalPos }).pass,
    ).toBe(true);
    const outOfBand = compareToRecorded(recorded, {
      outcome: 'clear',
      ticks: 331,
      finalPos: recorded.finalPos,
    });
    expect(outOfBand.pass).toBe(false);
    expect(outOfBand.errors.join(' ')).toMatch(/tick/i);
  });

  it('outcome mismatch fails regardless of position/ticks', () => {
    const comparison = compareToRecorded(recorded, {
      outcome: 'fail',
      ticks: 300,
      finalPos: recorded.finalPos,
    });
    expect(comparison.pass).toBe(false);
    expect(comparison.outcomeMatch).toBe(false);
    expect(comparison.errors.join(' ')).toMatch(/outcome/);
  });
});

describe('compareToRecorded — dynamic-hazard settle conditional (l10 false-positive fix)', () => {
  // Recorded at origin so replayed.finalPos.x IS the Euclidean drift in meters.
  const recorded: GhostResult = {
    outcome: 'clear',
    ticks: 300,
    finalPos: { x: 0, y: 0 },
    inkConsumed: 4,
    starRating: 3,
  };

  it('widens the finalPos band to HAZARD_SETTLE_EPSILON_M for rock levels', () => {
    expect(HAZARD_SETTLE_EPSILON_M).toBe(0.5);
    expect(HAZARD_SETTLE_EPSILON_M).toBeGreaterThan(GHOST_FINAL_POS_EPSILON_M);
  });

  it('NEGATIVE CONTROL: a static level with 0.06 m drift still FAILS', () => {
    const replayed = { outcome: 'clear', ticks: 300, finalPos: { x: 0.06, y: 0 } } as const;
    // default (no options) and explicit hasDynamicHazards:false must both fail
    expect(compareToRecorded(recorded, replayed).pass).toBe(false);
    const strict = compareToRecorded(recorded, replayed, { hasDynamicHazards: false });
    expect(strict.pass).toBe(false);
    expect(strict.errors.join(' ')).toMatch(/finalPos/);
  });

  it('a rock level with 0.4 m drift + clear/clear + tick match PASSES', () => {
    const replayed = { outcome: 'clear', ticks: 318, finalPos: { x: 0.4, y: 0 } } as const; // tickDelta 18 <= 30
    const relaxed = compareToRecorded(recorded, replayed, { hasDynamicHazards: true });
    expect(relaxed.pass).toBe(true);
    expect(relaxed.finalPosDeltaM).toBeCloseTo(0.4, 9);
    expect(relaxed.tickDelta).toBe(18);
    // the SAME drift on a static level (no hazards) must fail — proves the relaxation is hazard-gated
    expect(compareToRecorded(recorded, replayed, { hasDynamicHazards: false }).pass).toBe(false);
  });

  it('the relaxation matches the measured ch1-l10 drift (0.4617 m < 0.5 m)', () => {
    // measured l10: recorded 214 vs replay 232 ticks (delta 18, in band) + 0.4617 m settle drift
    const l10Recorded: GhostResult = { ...recorded, ticks: 214 };
    const replayed = { outcome: 'clear', ticks: 232, finalPos: { x: 0.4617, y: 0 } } as const;
    expect(compareToRecorded(l10Recorded, replayed, { hasDynamicHazards: true }).pass).toBe(true);
  });

  it('NEGATIVE CONTROL: rock level beyond 0.5 m still FAILS', () => {
    const replayed = { outcome: 'clear', ticks: 300, finalPos: { x: 0.51, y: 0 } } as const;
    const cmp = compareToRecorded(recorded, replayed, { hasDynamicHazards: true });
    expect(cmp.pass).toBe(false);
    expect(cmp.errors.join(' ')).toMatch(/finalPos/);
  });

  it('NEGATIVE CONTROL: rock level with a tick regression re-applies the STRICT epsilon', () => {
    // tickDelta 31 > 30 → not tick-in-band → strict 0.05 m even with hazards
    const replayed = { outcome: 'clear', ticks: 331, finalPos: { x: 0.4, y: 0 } } as const;
    const cmp = compareToRecorded(recorded, replayed, { hasDynamicHazards: true });
    expect(cmp.pass).toBe(false);
    // both the tick AND the (now-strict) finalPos bounds are violated
    expect(cmp.errors.join(' ')).toMatch(/tick/i);
    expect(cmp.errors.join(' ')).toMatch(new RegExp(`> ${GHOST_FINAL_POS_EPSILON_M}m`));
  });

  it('NEGATIVE CONTROL: an outcome mismatch never triggers the relaxation', () => {
    // replayed FAILs → not clear → strict epsilon regardless of hazards
    const replayed = { outcome: 'fail', ticks: 300, finalPos: { x: 0.4, y: 0 } } as const;
    const cmp = compareToRecorded(recorded, replayed, { hasDynamicHazards: true });
    expect(cmp.pass).toBe(false);
    expect(cmp.errors.join(' ')).toMatch(/outcome/);
    expect(cmp.errors.join(' ')).toMatch(/finalPos/);
  });
});

describe('runScriptedAttempt — headless attempt harness', () => {
  it('fails with cause "fall" when the stroke does not span the gap', () => {
    const attempt = runScriptedAttempt(fixtureLevel(), [
      { x: -4, y: 0.2 },
      { x: -2.5, y: 0.2 },
    ]);
    expect(attempt.committed).toBe(true);
    if (!attempt.committed) {
      return;
    }
    expect(attempt.outcome).toBe('fail');
    expect(attempt.cause).toBe('fall');
    expect(attempt.starRating).toBeNull();
  });

  it('reports a discarded stroke instead of running (min-length rule, FR-003)', () => {
    const attempt = runScriptedAttempt(fixtureLevel(), [
      { x: 0, y: 0.2 },
      { x: 0.1, y: 0.2 },
    ]);
    expect(attempt.committed).toBe(false);
    if (attempt.committed) {
      return;
    }
    expect(attempt.reason).toBe('tooShort');
  });
});

describe('ghost record -> replay (Phase 2 checkpoint: FR-015 + Gate 2 substrate)', () => {
  it('scripted straight stroke clears the fixture level, records, and replays in-band', () => {
    const level = fixtureLevel();
    const recorder = new GhostRecorder();
    const attempt = runScriptedAttempt(level, SCRIPTED_STROKE, {
      onTick: (tick, referencePoint) => recorder.sample(tick, referencePoint),
    });

    expect(attempt.committed).toBe(true);
    if (!attempt.committed) {
      return;
    }
    // deterministic clear: L1 "any line works"
    expect(attempt.outcome).toBe('clear');
    expect(attempt.ticks).toBeGreaterThan(0);
    expect(attempt.inkConsumed).toBeCloseTo(4, 6); // straight 4 m stroke
    expect(attempt.starRating).toBe(3); // 4 <= star3 (8)
    if (attempt.outcome !== 'clear' || attempt.starRating === null) {
      return;
    }

    const ghost = recorder.toGhostSolution({
      stroke: attempt.stroke,
      ticks: attempt.ticks,
      finalPos: attempt.finalPos,
      inkConsumed: attempt.inkConsumed,
      starRating: attempt.starRating,
    });

    // the recorded ghost is schema-valid inside the level
    const levelJson = structuredClone(exampleValid) as Record<string, unknown>;
    levelJson['ghostSolutions'] = [structuredClone(ghost)];
    expect(validateLevel(levelJson).ok).toBe(true);

    // replay the same world from scratch: same engine => bit-stable, in-band
    const replay = replayGhost(level, ghost);
    expect(replay.pass).toBe(true);
    expect(replay.details.comparison).not.toBeNull();
    expect(replay.details.comparison?.finalPosDeltaM).toBeCloseTo(0, 9);
    expect(replay.details.comparison?.tickDelta).toBe(0);
  });

  it('a tampered recorded final position (+0.1 m) makes the replay fail', () => {
    const level = fixtureLevel();
    const recorder = new GhostRecorder();
    const attempt = runScriptedAttempt(level, SCRIPTED_STROKE, {
      onTick: (tick, referencePoint) => recorder.sample(tick, referencePoint),
    });
    if (!attempt.committed || attempt.outcome !== 'clear' || attempt.starRating === null) {
      expect.fail('scripted stroke must clear');
    }
    const ghost = recorder.toGhostSolution({
      stroke: attempt.stroke,
      ticks: attempt.ticks,
      finalPos: attempt.finalPos,
      inkConsumed: attempt.inkConsumed,
      starRating: attempt.starRating,
    });

    const tampered: GhostSolution = {
      ...ghost,
      result: {
        ...ghost.result,
        finalPos: { x: ghost.result.finalPos.x + 0.1, y: ghost.result.finalPos.y },
      },
    };
    const replay = replayGhost(level, tampered);
    expect(replay.pass).toBe(false);
    expect(replay.details.comparison?.finalPosDeltaM).toBeCloseTo(0.1, 6);
    expect(replay.details.errors.length).toBeGreaterThan(0);
  });

  it('the fixture level replays its own embedded ghost in-band (Gate 2 dry run)', () => {
    const level = fixtureLevel();
    const embedded = level.ghostSolutions[0];
    expect(embedded).toBeDefined();
    if (embedded === undefined) {
      return;
    }
    const replay = replayGhost(level, embedded);
    expect(replay.pass).toBe(true);
  });

  it('a ghost whose stroke is discarded by the pipeline fails cleanly (no crash)', () => {
    const level = fixtureLevel();
    const ghost: GhostSolution = {
      kind: 'any',
      stroke: [
        [0, 0.2],
        [0.1, 0.2],
      ],
      sampleEveryTicks: 10,
      samples: [{ t: 300, x: 10.4, y: 0.9 }],
      result: { outcome: 'clear', ticks: 300, finalPos: { x: 10.4, y: 0.9 }, inkConsumed: 0.1, starRating: 3 },
    };
    const replay = replayGhost(level, ghost);
    expect(replay.pass).toBe(false);
    expect(replay.details.replayed).toBeNull();
    expect(replay.details.errors.join(' ')).toMatch(/discard|stroke/i);
  });
});

describe('replayGhost — settle band gated on OBSERVED rock interaction (review R6 F3)', () => {
  // One recycled world for the whole block (phaser-box2d 32-slot cap, World header).
  const world = new World();
  afterAll(() => world.destroy());
  const LV0 = { inkCapacityLv: 0, engineSpeedLv: 0 } as const;

  /** Replay `stroke` once, then record a ghost whose finalPos is shifted by dx (m). */
  function ghostWithOffsetFinalPos(level: Level, stroke: readonly Point[], dx: number): GhostSolution {
    const real = runScriptedAttempt(level, stroke, { upgrades: LV0, world });
    if (!real.committed || real.outcome !== 'clear') {
      throw new Error(`setup stroke must commit and clear: ${real.committed ? real.outcome : real.reason}`);
    }
    return {
      kind: 'any',
      stroke: stroke.map((p) => [p.x, p.y] as [number, number]),
      sampleEveryTicks: 5,
      samples: [{ t: 1, x: 0, y: 0 }],
      result: {
        outcome: 'clear',
        ticks: real.ticks,
        finalPos: { x: real.finalPos.x + dx, y: real.finalPos.y },
        inkConsumed: real.inkConsumed,
        starRating: real.starRating ?? 3,
      },
    };
  }

  it('a rock that never interacts keeps the STRICT epsilon — a 0.2 m final-pos drift FAILS', () => {
    const level: Level = { ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), rocks: [{ x: 40, y: 30, radius: 0.3 }] };
    const stroke = arcStroke(4);
    const probe = runScriptedAttempt(level, stroke, { upgrades: LV0, world });
    expect(probe.committed && probe.rockContactObserved).toBe(false); // no interaction
    const ghost = ghostWithOffsetFinalPos(level, stroke, 0.2); // 0.2 m > strict 0.05 m
    expect(replayGhost(level, ghost, world).pass).toBe(false);
  });

  it('a rock resting on the bridge earns the WIDE settle band — the same 0.2 m drift PASSES', () => {
    const level: Level = { ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), rocks: [{ x: 0, y: 1.2, radius: 0.3 }] };
    const stroke = arcStroke(4);
    const probe = runScriptedAttempt(level, stroke, { upgrades: LV0, world });
    expect(probe.committed && probe.rockContactObserved).toBe(true); // rock rests on the dome
    const ghost = ghostWithOffsetFinalPos(level, stroke, 0.2); // within the 0.5 m settle band
    expect(replayGhost(level, ghost, world).pass).toBe(true);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import type { GhostSolution, Level, Point } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import { hazardRelevanceCheck } from '../../scripts/gates/hazardRelevance';
import { arcStroke, buildSpikeLevel } from '../../src/debug/SpikeScenario';

/**
 * Gate 2.6 (hazard-relevance) — round-7 "contact IS loss" model (game_plan_v5
 * §2.3). Under the round-7 rule, the car touching a rock / DangerZone is an
 * instant game over (FailCause 'hazardContact'), so the check must:
 *   - PASS when a naive baseline is KILLED by touching the hazard (it is on the
 *     path) AND the intended ghost line clears (proving zero hazard contact), and
 *   - FAIL (negative control) when the hazard is beyond the car's reach, and
 *   - FAIL when a rock overlaps the car at spawn (t=0 guard, game_plan_v5 §2.1).
 * All attempts recycle ONE World (phaser-box2d 32-slot cap).
 *
 * ROUND-9 SCOPE: v1-legacy — rock/zone relevance on the shipped levels (CS-1 keeps
 * these green). Person-relevance and the v2 objective/lazyLine-advisory gate
 * recalibration land with CS-4.
 */

const world = new World();
afterAll(() => world.destroy());

/** A ghost whose committed stroke clears the level (hazardRelevance reads .stroke). */
function ghostFor(stroke: readonly Point[]): GhostSolution {
  return {
    kind: 'any',
    stroke: stroke.map((p) => [p.x, p.y] as [number, number]),
    sampleEveryTicks: 5,
    samples: [{ t: 1, x: 0, y: 0 }],
    result: { outcome: 'clear', ticks: 1, finalPos: { x: 0, y: 0 }, inkConsumed: 1, starRating: 3 },
  };
}

function spikeLevel(gapM: number, extra: Partial<Level>): Level {
  const base = buildSpikeLevel(gapM, { runUpM: 6, flagOffsetM: 5 });
  return { ...base, ghostSolutions: [ghostFor(arcStroke(gapM))], ...extra };
}

describe('hazardRelevanceCheck — n/a', () => {
  it('is a no-op for a level with no rocks and no dangerZones', () => {
    const level = spikeLevel(4, {});
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toEqual([]);
    expect(result.report).toEqual([]);
  });
});

describe('hazardRelevanceCheck — DangerZone (contact IS loss)', () => {
  it('PASSES when a zone lies on the naive car path (idle car falls in → hazardContact)', () => {
    // The intended arc bridge keeps the car above the gap (clears, zero contact);
    // a naive/idle car falls into the gap and enters the zone → hazardContact →
    // the zone is relevant.
    const level = spikeLevel(4, {
      dangerZones: [{ x: -2.5, y: -6, width: 5, height: 4.5 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toEqual([]);
    expect(result.report.join(' ')).toContain('HAZARD-RELEVANT');
    // the ghost genuinely clears WITHOUT touching the zone (negative control)
    expect(result.report.join(' ')).toContain('ghost: clear');
  });

  it('NEGATIVE CONTROL: a zone beyond the car path FAILS the gate', () => {
    const level = spikeLevel(4, {
      dangerZones: [{ x: 100, y: 100, width: 2, height: 2 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('never intersects the car');
  });
});

describe('hazardRelevanceCheck — Rock (contact IS loss)', () => {
  it('NEGATIVE CONTROL: a rock placed beyond reach FAILS the gate (required)', () => {
    // A rock far to the right and high: it free-falls where the car never is, so
    // no baseline is killed by it → the rock does not do its job → gate error.
    const level = spikeLevel(4, {
      rocks: [{ x: 40, y: 30, radius: 0.3 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('never intersects the car');
  });
});

describe('hazardRelevanceCheck — spawn guard (game_plan_v5 §2.1)', () => {
  it('FAILS when a rock overlaps the car at spawn (t=0)', () => {
    const base = buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 });
    const level: Level = {
      ...base,
      ghostSolutions: [ghostFor(arcStroke(4))],
      // A rock sitting ON the settled car at its spawn — overlaps at t=0.
      rocks: [{ x: base.vehicleSpawn.x, y: base.vehicleSpawn.y, radius: 0.5 }],
    };
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors.some((e) => e.includes('spawn (t=0)'))).toBe(true);
  });
});

describe('hazardRelevanceCheck — PER-HAZARD attribution (review R6 F1)', () => {
  it('PASSES when TWO rocks each kill the naive baseline (both matter)', () => {
    // Two triggered rocks drop side-by-side onto the naive straight-line car —
    // both overlap the car on the (same) hazardContact fail tick, so each is
    // credited by SLOT INDEX: attribution is per-rock, not level-wide.
    const level = spikeLevel(4, {
      rocks: [
        { x: -0.3, y: 4, radius: 0.35, density: 6, triggerCarX: -2 },
        { x: 0.3, y: 4, radius: 0.35, density: 6, triggerCarX: -2 },
      ],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toEqual([]);
    const joined = result.report.join(' ');
    expect(joined).toContain('rock0'); // BOTH rocks credited
    expect(joined).toContain('rock1');
  });

  it('NEGATIVE CONTROL: a decorative SECOND rock (one of two) FAILS, naming rock[1]', () => {
    // rock[0] kills the naive car; rock[1] free-falls beyond reach. Level-wide OR
    // would have passed on rock[0] alone — per-hazard errors on the decorative one.
    const level = spikeLevel(4, {
      rocks: [
        { x: 0, y: 4, radius: 0.4, density: 6, triggerCarX: -2 }, // relevant
        { x: 40, y: 30, radius: 0.3 }, // decorative — beyond the car's reach
      ],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('rock[1]');
    expect(result.errors[0]).toContain('never intersects the car');
  });

  it('NEGATIVE CONTROL: a rock PLUS a zone — decorative rock FAILS while the zone passes', () => {
    // The reviewer's exact case: "a rock plus a zone can still contain a completely
    // decorative hazard". The zone is on the naive path (idle car falls in → hazard
    // contact); the rock is decoration → the gate errors on rock[0] but credits the zone.
    const level = spikeLevel(4, {
      dangerZones: [{ x: -2.5, y: -6, width: 5, height: 4.5 }],
      rocks: [{ x: 40, y: 30, radius: 0.3 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('rock[0]');
    expect(result.report.join(' ')).toContain('zone0'); // the zone IS attributed
  });
});

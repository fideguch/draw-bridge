import { afterAll, describe, expect, it } from 'vitest';
import type { GhostSolution, Level, Point } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import {
  HAZARD_RELEVANCE_WINDOW_TICKS,
  hazardRelevanceCheck,
  isRockContactCausal,
} from '../../scripts/gates/hazardRelevance';
import { arcStroke, buildSpikeLevel } from '../../src/debug/SpikeScenario';

/**
 * Gate 2.6 (hazard-relevance) — a rock / DangerZone that never intersects the
 * car's spatiotemporal path is decoration, not a mechanic (user round-6: "石は車が
 * 到達するまでの時間が考慮されておらず当たらない=役割を果たしてない"). The check must:
 *   - PASS when a naive baseline is harmed by the hazard (it is on the path), and
 *   - FAIL (negative control) when the hazard is beyond the car's reach.
 * All attempts recycle ONE World (phaser-box2d 32-slot cap).
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

describe('hazardRelevanceCheck — DangerZone', () => {
  it('PASSES when a zone lies on the naive car path (idle baseline falls into it)', () => {
    // The intended arc bridge keeps the car above the gap; a naive/idle car falls
    // into the gap and enters the zone → cause "hazard" → the zone is relevant.
    const level = spikeLevel(4, {
      dangerZones: [{ x: -2.5, y: -6, width: 5, height: 4.5 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toEqual([]);
    expect(result.report.join(' ')).toContain('HAZARD-RELEVANT');
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

describe('hazardRelevanceCheck — Rock', () => {
  it('NEGATIVE CONTROL: a rock placed beyond reach FAILS the gate (required)', () => {
    // A rock far to the right and high: it free-falls where the car never is, so
    // no baseline is harmed by it → the rock does not do its job → gate error.
    const level = spikeLevel(4, {
      rocks: [{ x: 40, y: 30, radius: 0.3 }],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('never intersects the car');
  });
});

describe('hazardRelevanceCheck — PER-HAZARD attribution (review R6 F1)', () => {
  it('PASSES when TWO rocks each harm a naive baseline (both matter)', () => {
    // Two triggered rocks drop side-by-side onto the naive straight-line car — each
    // is credited by SLOT INDEX, so attribution is per-rock, not level-wide.
    const level = spikeLevel(4, {
      rocks: [
        { x: -0.35, y: 4, radius: 0.35, density: 6, triggerCarX: -2 },
        { x: 0.35, y: 4, radius: 0.35, density: 6, triggerCarX: -2 },
      ],
    });
    const result = hazardRelevanceCheck(level, world);
    expect(result.errors).toEqual([]);
    expect(result.report.join(' ')).toContain('rock0,rock1'); // BOTH rocks credited
  });

  it('NEGATIVE CONTROL: a decorative SECOND rock (one of two) FAILS, naming rock[1]', () => {
    // rock[0] harms the naive car; rock[1] free-falls beyond reach. Level-wide OR
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
    // decorative hazard". The zone is on the naive path (idle car falls in); the
    // rock is decoration → the gate errors on rock[0] but still credits the zone.
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

describe('isRockContactCausal — terminal-tick coincidence rejected (review R6 F4)', () => {
  it('rejects a contact sampled AT the fail tick (delta 0 — post-fail coincidence)', () => {
    // A rock that merely overlaps in the post-fail frame of a loss caused by
    // something else must NOT be credited as causal.
    expect(isRockContactCausal(100, 100)).toBe(false);
  });

  it('accepts a contact STRICTLY BEFORE the fail tick, within the window', () => {
    expect(isRockContactCausal(99, 100)).toBe(true); // 1 tick before
    expect(isRockContactCausal(100 - HAZARD_RELEVANCE_WINDOW_TICKS, 100)).toBe(true); // window edge
  });

  it('rejects a contact older than the window, and "never touched" (-1)', () => {
    expect(isRockContactCausal(100 - HAZARD_RELEVANCE_WINDOW_TICKS - 1, 100)).toBe(false);
    expect(isRockContactCausal(-1, 100)).toBe(false);
  });
});

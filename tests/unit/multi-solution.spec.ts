import { afterAll, describe, expect, it } from 'vitest';
import type { DeclaredSolution, Level, Point, Polyline } from '@engine/level/LevelSchema';
import { SHAPE_TAGS, validateLevel } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import { applyWarnMode } from '../../scripts/gates/lib';
import {
  MULTI_SOLUTION_ALLOWLIST,
  MULTI_SOLUTION_MIN_DISTINCT_SHAPES,
  multiSolutionCheck,
} from '../../scripts/gates/multiSolution';

/**
 * Gate 8 — multi-solution proof (round-8) + the solutions[] schema (LevelSchema).
 *
 * NEGATIVE CONTROL (learnings T4): a level DECLARING a solution that does not
 * clear must FAIL the gate — and must stay a failure even under the staged
 * --warn-new-gates demotion (only the "nothing declared" case defers). The
 * positive fixture declares two distinct-shape solutions that genuinely clear
 * through the player commit path. All attempts recycle ONE World (32-slot cap).
 */

const world = new World();
afterAll(() => world.destroy());

function pl(...pts: [number, number][]): Polyline {
  return pts.map(([x, y]) => [x, y] as const);
}
function stroke(...pts: [number, number][]): Polyline {
  return pts.map(([x, y]) => [x, y] as const);
}

/** Two rim platforms bracketing a chasm (walls undercut away from the gap, like ch1-l01). */
function twoPlatforms(leftFar: number, leftRim: number, rightRim: number, rightFar: number, chasmY: number): Polyline[] {
  return [
    pl([leftFar, 0], [leftRim, 0], [leftRim - 0.2, chasmY]),
    pl([rightRim + 0.2, chasmY], [rightRim, 0], [rightFar, 0]),
  ];
}

/**
 * Minimal SCHEMA-VALID level over a NARROW 3.2 m flat gap (dummy 1-tick ghost).
 * The gap is deliberately narrow so the declared solutions clear with WIDE
 * physical margins: a marginal fixture (4 m + flat road) flipped clear/tipOver
 * on sub-mm recycled-world drift between attempt sequences — a flaky test.
 */
function buildLevel(id: string, solutions: readonly DeclaredSolution[] | undefined): Level {
  const spawn: Point = { x: -4.2, y: 0.35 };
  return {
    schemaVersion: 1,
    id,
    terrain: twoPlatforms(-6.5, -1.6, 1.6, 6.5, -4.6),
    vehicleSpawn: spawn,
    goalFlag: { x: 3.4, y: 0, width: 1, height: 2 },
    killY: -10,
    inkBudget: 40,
    starThresholds: { star2: 30, star3: 20 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [
      {
        kind: 'any',
        stroke: [
          [-2.3, 0.06],
          [2.3, 0.06],
        ],
        sampleEveryTicks: 10,
        samples: [{ t: 1, x: spawn.x, y: spawn.y }],
        result: { outcome: 'clear', ticks: 1, finalPos: { x: spawn.x, y: spawn.y }, inkConsumed: 1, starRating: 1 },
      },
    ],
    ...(solutions !== undefined ? { solutions } : {}),
  };
}

/** A straight road across the gap, 0.7 m rested on each rim — clears with margin. */
const lineSolution: DeclaredSolution = {
  shapeTag: 'line',
  stroke: stroke([-2.3, 0.06], [0, 0.05], [2.3, 0.06]),
};

/** A bowed arch over the same gap — a genuinely different shape family. */
const archSolution: DeclaredSolution = {
  shapeTag: 'arch',
  stroke: stroke([-2.3, 0.06], [-1.15, 0.32], [0, 0.42], [1.15, 0.32], [2.3, 0.06]),
};

/** A stub floating far above the gap: commits in open air, the car falls — a LIE. */
const lyingSolution: DeclaredSolution = {
  shapeTag: 'wall',
  stroke: stroke([-1, 2.5], [0, 2.45], [1, 2.5]),
};

describe('solutions[] schema (LevelSchema round-8)', () => {
  it('accepts a valid solutions[] and parses shapeTag + stroke', () => {
    const parsed = validateLevel(buildLevel('ch1-l05', [lineSolution, archSolution]));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.level.solutions?.length).toBe(2);
      expect(parsed.level.solutions?.[0]?.shapeTag).toBe('line');
    }
  });

  it('leaves solutions undefined when the key is absent (backward compatible)', () => {
    const parsed = validateLevel(buildLevel('ch1-l05', undefined));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.level.solutions).toBeUndefined();
    }
  });

  it('rejects an unknown shapeTag (fixed vocabulary)', () => {
    const bad = { ...buildLevel('ch1-l05', undefined), solutions: [{ shapeTag: 'zigzag', stroke: [[-1, 0], [1, 0]] }] };
    const parsed = validateLevel(bad);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.includes('shapeTag'))).toBe(true);
    }
  });

  it('rejects a degenerate solution stroke (< 2 points)', () => {
    const bad = { ...buildLevel('ch1-l05', undefined), solutions: [{ shapeTag: 'line', stroke: [[0, 0]] }] };
    expect(validateLevel(bad).ok).toBe(false);
  });

  it('rejects unknown keys inside a solution (additionalProperties: false)', () => {
    const bad = {
      ...buildLevel('ch1-l05', undefined),
      solutions: [{ shapeTag: 'line', stroke: [[-1, 0], [1, 0]], result: {} }],
    };
    const parsed = validateLevel(bad);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.includes('unknown key'))).toBe(true);
    }
  });

  it('SHAPE_TAGS is the round-8 vocabulary', () => {
    expect(SHAPE_TAGS).toContain('arch');
    expect(SHAPE_TAGS).toContain('hook');
    expect(SHAPE_TAGS).toContain('trapezoid');
    expect(SHAPE_TAGS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('multiSolutionCheck (Gate 8)', () => {
  it('PASSES a level whose two distinct-shape solutions both clear live', () => {
    const result = multiSolutionCheck({ json: buildLevel('ch1-l05', [lineSolution, archSolution]) }, world);
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).filter((w) => w.includes('CLEARED')).length).toBe(2);
    expect(result.isUndeclared).toBeUndefined();
  });

  it('NEGATIVE CONTROL: a DECLARED solution that does not clear FAILS, naming index + shapeTag', () => {
    const result = multiSolutionCheck({ json: buildLevel('ch1-l05', [lineSolution, lyingSolution]) }, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('did NOT clear');
    expect(result.errors.join(' ')).toContain('shapeTag="wall"');
  });

  it('NEGATIVE CONTROL stays strict under the warn flag (only "undeclared" defers)', () => {
    const result = multiSolutionCheck({ json: buildLevel('ch1-l05', [lineSolution, lyingSolution]) }, world);
    // The runner's staged-rollout branch: demote ONLY when isUndeclared.
    const runnerView = result.isUndeclared === true ? applyWarnMode(result, true) : result;
    expect(runnerView.errors.length).toBeGreaterThan(0); // still a hard failure
  });

  it('requires >= 2 DISTINCT shapeTags — two solutions of the same family fail', () => {
    const twin: DeclaredSolution = { ...lineSolution };
    const result = multiSolutionCheck({ json: buildLevel('ch1-l05', [lineSolution, twin]) }, world);
    expect(result.errors.some((e) => e.includes('distinct'))).toBe(true);
    expect(MULTI_SOLUTION_MIN_DISTINCT_SHAPES).toBe(2);
  });

  it('tutorial allowlist relaxes the distinct-shape floor to 1 (ch1-l01)', () => {
    expect(MULTI_SOLUTION_ALLOWLIST).toEqual(new Set(['ch1-l01', 'ch1-l02']));
    const result = multiSolutionCheck({ json: buildLevel('ch1-l01', [lineSolution]) }, world);
    expect(result.errors).toEqual([]);
  });

  it('UNDECLARED: no solutions[] errors with isUndeclared=true, and the warn flag demotes exactly that', () => {
    const result = multiSolutionCheck({ json: buildLevel('ch1-l05', undefined) }, world);
    expect(result.isUndeclared).toBe(true);
    expect(result.errors.length).toBe(1);
    const demoted = applyWarnMode(result, true);
    expect(demoted.errors).toEqual([]);
    expect((demoted.warnings ?? []).some((w) => w.startsWith('WARN(deferred)'))).toBe(true);
  });

  it('rejects an invalid level with a gate0 pointer instead of crashing', () => {
    const result = multiSolutionCheck({ json: { schemaVersion: 999 } }, world);
    expect(result.errors[0]).toContain('gate0-invalid');
  });
});

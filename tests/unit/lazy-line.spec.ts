import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Level, Point, Polyline } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import {
  LAZY_BOT_INK_CAPACITY_LV,
  LAZY_HEIGHT_OFFSET_M,
  LAZY_LINE_ALLOWLIST,
  LAZY_LINE_PATTERNS,
  LAZY_OVERLAP_M,
  lazyLineCheck,
  minInkLevelFor,
  runLazyLineBot,
  surfaceAnchoredStroke,
} from '../../scripts/gates/lazyLine';

/**
 * Gate 7 — lazy-line bot. ROUND-9 (BR-015): ADVISORY telemetry only. The bot still
 * plays the lazy horizontal patterns through the EXACT player commit path and
 * still correctly IDENTIFIES which ones clear, but a clear no longer FAILS the
 * level — it is surfaced as a `warnings` entry the designer reads. `errors[]` is
 * always empty (the gate always exits 0).
 *
 * DETECTION still works (runLazyLineBot reports clears); only the CONSEQUENCE
 * changed from fail -> advisory warning. All attempts recycle ONE World.
 */

const world = new World();
afterAll(() => world.destroy());

function pl(...pts: [number, number][]): Polyline {
  return pts.map(([x, y]) => [x, y] as const);
}

/** Two rim platforms bracketing a chasm (walls undercut away from the gap, like ch1-l01). */
function twoPlatforms(leftFar: number, leftRim: number, rightRim: number, rightFar: number, chasmY: number): Polyline[] {
  return [
    pl([leftFar, 0], [leftRim, 0], [leftRim - 0.2, chasmY]),
    pl([rightRim + 0.2, chasmY], [rightRim, 0], [rightFar, 0]),
  ];
}

/** Minimal SCHEMA-VALID level (dummy 1-tick ghost; the lazy bot only reads geometry/economy). */
function buildLevel(id: string, terrain: Polyline[], spawn: Point, goalX: number, killY: number): Level {
  return {
    schemaVersion: 1,
    id,
    terrain,
    vehicleSpawn: spawn,
    goalFlag: { x: goalX, y: 0, width: 1, height: 2 },
    killY,
    inkBudget: 40,
    starThresholds: { star2: 30, star3: 20 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [
      {
        kind: 'any',
        stroke: [
          [-2, 0.1],
          [2, 0.1],
        ],
        sampleEveryTicks: 10,
        samples: [{ t: 1, x: spawn.x, y: spawn.y }],
        result: { outcome: 'clear', ticks: 1, finalPos: { x: spawn.x, y: spawn.y }, inkConsumed: 1, starRating: 1 },
      },
    ],
  };
}

/** DETECTION control: a shallow flat gap — the lazy line's home turf. */
function lazyClearableLevel(id: string): Level {
  return buildLevel(id, twoPlatforms(-6.5, -2.0, 2.0, 6.5, -4.6), { x: -4.2, y: 0.35 }, 3.4, -10);
}

/** PASS control: geometry proven to defeat all patterns (frozen old-slate snapshot). */
function lazyProofLevel(): unknown {
  return JSON.parse(readFileSync('tests/fixtures/gate-levels/ch1-l08.json', 'utf-8')) as unknown;
}

describe('LAZY_LINE_PATTERNS (round-8 mandated set)', () => {
  it('contains at least the four mandated patterns plus the surface-anchored pair', () => {
    const names = LAZY_LINE_PATTERNS.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['rim-exact', 'rim-overlap', 'high', 'low', 'spawn-goal', 'spawn-goal-high']),
    );
    expect(LAZY_LINE_PATTERNS.length).toBeGreaterThanOrEqual(4);
  });

  it('pins the calibrated constants (overlap ~0.7 m, offset ±0.5 m, max-ink profile)', () => {
    expect(LAZY_OVERLAP_M).toBe(0.7);
    expect(LAZY_HEIGHT_OFFSET_M).toBe(0.5);
    expect(LAZY_BOT_INK_CAPACITY_LV).toBeGreaterThan(0); // upgraded-player affordability (header)
    expect(LAZY_LINE_ALLOWLIST).toEqual(new Set(['ch1-l01', 'ch1-l02']));
  });
});

describe('minInkLevelFor (affordability tiers)', () => {
  it('0 when the base budget already affords the line', () => {
    expect(minInkLevelFor(10, 10)).toBe(0);
  });
  it('the first upgrade level whose +10%/Lv budget covers the line', () => {
    expect(minInkLevelFor(11.4, 10)).toBe(2); // 11 < 11.4 <= 12
  });
  it('null when even max ink cannot pay', () => {
    expect(minInkLevelFor(16, 10)).toBeNull(); // 10 * 1.5 = 15 < 16
  });
});

describe('runLazyLineBot (player-faithful pattern sweep)', () => {
  it('plays every pattern and reports a disposition for each', () => {
    const results = runLazyLineBot(lazyClearableLevel('ch1-l05'), world);
    expect(results.length).toBe(LAZY_LINE_PATTERNS.length);
    for (const r of results) {
      expect(r.disposition.length).toBeGreaterThan(0);
    }
  });

  it('clears at least one pattern on the flat-gap board (the complaint reproduced)', () => {
    const results = runLazyLineBot(lazyClearableLevel('ch1-l05'), world);
    expect(results.some((r) => r.isCleared)).toBe(true);
  });
});

describe('lazyLineCheck (round-9 BR-015: advisory only)', () => {
  it('ADVISORY: a flat gap a lazy line clears PASSES (errors empty) but is REPORTED in warnings', () => {
    const { errors, warnings } = lazyLineCheck({ json: lazyClearableLevel('ch1-l05') }, world);
    expect(errors).toEqual([]); // no longer a failure
    expect((warnings ?? []).some((w) => w.includes('a straight line clears'))).toBe(true);
  });

  it('geometry that defeats every pattern PASSES, dispositions still reported (ch1-l08 fixture, +2 m rise)', () => {
    const { errors, warnings } = lazyLineCheck({ json: lazyProofLevel() }, world);
    expect(errors).toEqual([]);
    // The dispositions are still reported (designer telemetry), all non-clear.
    expect((warnings ?? []).some((w) => w.includes('-> fail') || w.includes('no-commit'))).toBe(true);
  });

  it('tutorial allowlist: a lazy-clearable ch1-l01 passes and tags the clear as sanctioned', () => {
    const { errors, warnings } = lazyLineCheck({ json: lazyClearableLevel('ch1-l01') }, world);
    expect(errors).toEqual([]);
    expect((warnings ?? []).some((w) => w.includes('sanctioned'))).toBe(true);
  });

  it('an invalid level surfaces a gate0 pointer as an advisory warning (Gate 0 owns the hard error)', () => {
    const { errors, warnings } = lazyLineCheck({ json: { schemaVersion: 999 } }, world);
    expect(errors).toEqual([]);
    expect((warnings ?? []).some((w) => w.includes('gate0-invalid'))).toBe(true);
  });
});

describe('surfaceAnchoredStroke (the screenshot 左→右 line)', () => {
  it('anchors on the ground under the spawn and under the flag, lifted a stroke-width', () => {
    const level = lazyClearableLevel('ch1-l05');
    const stroke = surfaceAnchoredStroke(level, 0, 0);
    expect(stroke).not.toBeNull();
    expect(stroke![0]!.x).toBeCloseTo(level.vehicleSpawn.x, 5);
    expect(stroke![0]!.y).toBeGreaterThan(0); // lifted above the y=0 platform surface
    expect(stroke![stroke!.length - 1]!.x).toBeCloseTo(3.9, 5); // flag center
  });

  it('returns null when an endpoint has no top-solid ground below it', () => {
    // Ceiling-only terrain (right→left winding = underside solid): nothing to anchor on.
    const level = buildLevel('ch1-l05', [pl([6, 3], [-6, 3])], { x: -4, y: 0.35 }, 3.4, -10);
    expect(surfaceAnchoredStroke(level, 0, 0)).toBeNull();
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Level, Point, Polyline } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { buildTerrainSolids, isPointInSolids } from '@engine/physics/TerrainSolids';
import { clipStrokeToSolids } from '@engine/physics/StrokeClipper';
import { GameSimulation } from '@engine/GameSimulation';
import { processStroke } from '@engine/physics/StrokePipeline';
import { World } from '@engine/physics/World';

/**
 * Round-4 bug — stroke × terrain interaction: a drawn line cannot exist INSIDE
 * solid terrain. The engine splits a stroke into OUTSIDE runs, cuts flush at the
 * surface, and commits the LONGEST run; open-air strokes pass through unchanged
 * (byte-identical — ghosts + determinism probe unaffected).
 *
 * Fixture terrain (authored winding = collision top-side; gate1 convention):
 *   - left ground   [-10,0]→[-2,0]→[-2.2,-5]   (top solid; closes DOWN)
 *   - right ground  [2.2,-5]→[2,0]→[10,0]       (top solid)
 *   - central pillar [-1,-5]→[-0.6,-0.3]→[0.6,-0.3]→[1,-5]  (plateau top at y=-0.3)
 *   - rock ceiling  [2,3]→[-2,3]                 (authored right→left; underside solid)
 */
const FIXTURE_TERRAIN: readonly Polyline[] = [
  [
    [-10, 0],
    [-2, 0],
    [-2.2, -5],
  ],
  [
    [2.2, -5],
    [2, 0],
    [10, 0],
  ],
  [
    [-1, -5],
    [-0.6, -0.3],
    [0.6, -0.3],
    [1, -5],
  ],
  [
    [2, 3],
    [-2, 3],
  ],
];
const FIXTURE_KILL_Y = -6;
const SOLIDS = buildTerrainSolids(FIXTURE_TERRAIN, FIXTURE_KILL_Y);

function isInside(x: number, y: number): boolean {
  return isPointInSolids({ x, y }, SOLIDS);
}

function arcLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Assert a kept run's BODY is outside solid. Flush endpoints sit exactly on the
 * boundary (even-odd is float-ambiguous there), so the meaningful invariant is
 * that every segment MIDPOINT — strictly off-boundary — is outside.
 */
function expectRunBodyOutside(run: readonly Point[]): void {
  for (let i = 0; i < run.length - 1; i++) {
    const a = run[i] as Point;
    const b = run[i + 1] as Point;
    expect(isInside((a.x + b.x) / 2, (a.y + b.y) / 2)).toBe(false);
  }
}

describe('TerrainSolids — point-in-solid classification', () => {
  it('a point deep below a ground surface is inside; above is outside', () => {
    expect(isInside(-5, -1)).toBe(true); // 1 m under the left platform (past skin)
    expect(isInside(-5, 0.5)).toBe(false); // above the left platform surface
  });

  it('tolerates a shallow surface graze but clips deeper penetration (skin margin)', () => {
    // The drawn line + its bridge always overlap the surface a little; the bug is
    // a line going THROUGH a plateau. Skin (SURFACE_SKIN_M 0.55) draws the line.
    expect(isInside(-5, -0.3)).toBe(false); // 0.3 m below surface → within skin
    expect(isInside(-5, -1.0)).toBe(true); // 1.0 m below surface → past skin
  });

  it('a point deep inside a plateau (below its top, within its span) is inside', () => {
    expect(isInside(0, -1.5)).toBe(true); // well below the pillar top (-0.3)
    expect(isInside(0, -0.2)).toBe(false); // above the pillar top → open air
    expect(isInside(0, 0)).toBe(false); // over the gap at rim height (bridges allowed)
    expect(isInside(1.5, -1.5)).toBe(false); // beside the pillar, in the gap
  });

  it('a ceiling makes the rock ABOVE its underside solid, bounded to its x-extent', () => {
    expect(isInside(0, 4)).toBe(true); // deep inside the overhang rock
    expect(isInside(0, 2.5)).toBe(false); // below the underside → open corridor
    // The endpoint fix: a floating overhang is NOT an infinite half-plane.
    expect(isInside(3, 4)).toBe(false); // outside the ceiling's x-extent
  });
});

describe('clipStrokeToSolids — clip behavior', () => {
  it('open-air stroke is returned UNCHANGED (byte-identical no-op)', () => {
    const arc: readonly Point[] = [
      { x: -2, y: 0.2 },
      { x: -1, y: 0.4 },
      { x: 0, y: 0.5 },
      { x: 1, y: 0.4 },
      { x: 2, y: 0.2 },
    ];
    const result = clipStrokeToSolids(arc, SOLIDS);
    expect(result.clipped).toBe(false);
    expect(result.longestRun).toBe(arc); // same reference — no float drift
    expect(result.runs).toEqual([arc]);
  });

  it('a stroke fully inside a solid yields NO usable run (rejection path)', () => {
    const buried: readonly Point[] = [
      { x: -0.4, y: -2 },
      { x: 0, y: -2.5 },
      { x: 0.4, y: -2 },
    ];
    const result = clipStrokeToSolids(buried, SOLIDS);
    expect(result.clipped).toBe(true);
    expect(result.longestRun).toHaveLength(0);
  });

  it('crossing one wall clips FLUSH at the surface (single kept run)', () => {
    const intoGround: readonly Point[] = [
      { x: -5, y: 0.5 }, // above the left platform
      { x: -3, y: -2 }, // deep below the surface → inside
    ];
    const result = clipStrokeToSolids(intoGround, SOLIDS);
    expect(result.clipped).toBe(true);
    expect(result.runs).toHaveLength(1);
    const kept = result.longestRun;
    expect(kept[0]).toEqual({ x: -5, y: 0.5 });
    expectRunBodyOutside(kept); // the kept run never passes through solid
    expect(isInside(-3, -2)).toBe(true); // ...but the clipped tail WAS inside
    const end = kept[kept.length - 1] as Point;
    expect(end.y).toBeLessThan(0.5); // descended toward the surface
    expect(end.y).toBeGreaterThan(-2); // ...and stopped before the buried end
  });

  it('a line draped over a plateau CORNER splits into two runs; longest kept', () => {
    const drapedV: readonly Point[] = [
      { x: -2, y: 0.1 }, // above the left rim
      { x: 0, y: -2 }, // driven deep through the pillar
      { x: 2, y: 0.1 }, // above the right rim
    ];
    const result = clipStrokeToSolids(drapedV, SOLIDS);
    expect(result.clipped).toBe(true);
    expect(result.runs).toHaveLength(2);
    // Neither kept flank passes through solid.
    for (const run of result.runs) {
      expectRunBodyOutside(run);
    }
    // The longest run is the longer of the two flanks.
    const longest = result.runs.reduce((a, b) => (arcLength(a) >= arcLength(b) ? a : b));
    expect(result.longestRun).toBe(longest);
  });

  it('a stroke starting INSIDE, ending outside, clips the leading part', () => {
    const outFromPillar: readonly Point[] = [
      { x: 0, y: -2 }, // buried deep in the pillar
      { x: 0, y: 0.5 }, // above the pillar top → open air
    ];
    const result = clipStrokeToSolids(outFromPillar, SOLIDS);
    expect(result.clipped).toBe(true);
    expect(result.runs).toHaveLength(1);
    expectRunBodyOutside(result.longestRun); // the kept run never passes through solid
    expect(isInside(0, -2)).toBe(true); // the clipped lead WAS inside
    expect(result.longestRun[result.longestRun.length - 1]).toEqual({ x: 0, y: 0.5 });
  });
});

describe('GameSimulation — commitStroke terrain clipping', () => {
  // Single shared world (phaser-box2d 32-slot cap): each GameSimulation({ world })
  // resets the slot on construction; the test owns/destroys the world.
  const world = new World();
  afterAll(() => world.destroy());

  function fixtureLevel(): Level {
    return {
      schemaVersion: 1,
      id: 'ch1-l01',
      terrain: FIXTURE_TERRAIN,
      vehicleSpawn: { x: -5, y: 0.6 },
      goalFlag: { x: 4, y: 0, width: 1.2, height: 2.2 },
      killY: FIXTURE_KILL_Y,
      inkBudget: 64,
      starThresholds: { star2: 48, star3: 24 },
      coins: [],
      gimmickTags: [],
      ghostSolutions: [],
    };
  }

  it('exposes isInsideTerrain matching the solid model', () => {
    const sim = new GameSimulation(fixtureLevel(), { world });
    try {
      expect(sim.isInsideTerrain({ x: 0, y: -1 })).toBe(true);
      expect(sim.isInsideTerrain({ x: 0, y: 0.5 })).toBe(false);
    } finally {
      sim.destroy();
    }
  });

  it('commits the LONGEST outside run for a plateau-penetrating stroke', () => {
    const sim = new GameSimulation(fixtureLevel(), { world });
    try {
      const result = sim.commitStroke([
        { x: -2.5, y: 0.1 },
        { x: -1, y: -0.6 },
        { x: 0, y: -1.6 },
        { x: 1, y: -0.6 },
        { x: 2.5, y: 0.1 },
      ]);
      expect(result.committed).toBe(true);
      if (result.committed) {
        // The committed line's BODY no longer passes through solid ground
        // (flush endpoints sit on the surface; check off-boundary midpoints).
        for (let i = 0; i < result.stroke.length - 1; i++) {
          const a = result.stroke[i] as Point;
          const b = result.stroke[i + 1] as Point;
          expect(sim.isInsideTerrain({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })).toBe(false);
        }
      }
    } finally {
      sim.destroy();
    }
  });

  it('falls back to the unclipped line when clipping leaves no usable run', () => {
    // Best-effort clip: a valid-length line whose clipped runs are all sub-minimum
    // (e.g. hugging concave/staircase terrain) must NOT be denied — it commits
    // unclipped rather than trapping the player in the drawing phase.
    const sim = new GameSimulation(fixtureLevel(), { world });
    try {
      const result = sim.commitStroke([
        { x: -0.4, y: -2 },
        { x: 0, y: -2.5 },
        { x: 0.4, y: -2 },
      ]);
      expect(result.committed).toBe(true); // fallback commit, not a denied draw
    } finally {
      sim.destroy();
    }
  });

  it('an open-air stroke commits identically to the unclipped pipeline', () => {
    const sim = new GameSimulation(fixtureLevel(), { world });
    try {
      const arc: Point[] = Array.from({ length: 21 }, (_, i) => {
        const x = -3 + (6 * i) / 20;
        const t = x / 3;
        return { x, y: 0.6 + 0.4 * (1 - t * t) }; // fully above the terrain
      });
      const expected = processStroke(arc);
      const result = sim.commitStroke(arc);
      expect(result.committed).toBe(true);
      expect(expected.discarded).toBe(false);
      if (result.committed && !expected.discarded) {
        expect(result.length).toBeCloseTo(expected.totalLength, 12);
        expect(result.segments).toBe(expected.segments.length);
      }
    } finally {
      sim.destroy();
    }
  });
});

describe('shipped ghosts are terrain-clip NO-OPS (Gate 2 / campaign safety)', () => {
  function loadLevels(): { name: string; level: Level }[] {
    return readdirSync('levels')
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => {
        const parsed = validateLevel(JSON.parse(readFileSync(`levels/${f}`, 'utf-8')));
        if (!parsed.ok) {
          throw new Error(`levels/${f} invalid: ${parsed.errors.join(' | ')}`);
        }
        return { name: f.replace(/\.json$/, ''), level: parsed.level };
      });
  }

  it('no recorded ghost stroke clips against its own terrain (all shipped levels)', () => {
    for (const { name, level } of loadLevels()) {
      const solids = buildTerrainSolids(level.terrain, level.killY);
      level.ghostSolutions.forEach((ghost, gi) => {
        const stroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
        const result = clipStrokeToSolids(stroke, solids);
        expect(result.clipped, `${name} ghost[${gi}] must NOT clip (would break Gate 2 / campaign)`).toBe(false);
      });
    }
  });
});

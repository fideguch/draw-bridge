import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Level, Point, Polyline } from '@engine/level/LevelSchema';
import { GameSimulation } from '@engine/GameSimulation';
import { World } from '@engine/physics/World';
import {
  ARCH_EXEMPT_IDS,
  CONTACT_CLEARANCE_M,
  MAX_UNSUPPORTED_SPAN_M,
  longestFreeSpan,
  maxUnsupportedSpan,
  measureUnsupportedSpan,
  topSolidSurfaceAt,
  unsupportedSpanCheck,
} from '../../scripts/gates/unsupportedSpan';

/**
 * Gate 5 — unsupported span (WAVE 3.5 CHAIN-SUPPORT rewrite, game_plan_v5 §8.2).
 * The 5.5 m limit bounds the DRAWN CHAIN's free spans (bridge sag/break), NOT the
 * terrain silhouette. The metric settles the ghost stroke and measures the widest
 * gap between where the SETTLED chain contacts a top-solid surface — so a tier /
 * descent that rises above the spawn→goal chord is legal as long as the drawn line
 * rests on it in short sub-spans. Tests: the pure free-span geometry (positive
 * tier + NEGATIVE 6.5 m free-hang + no-support + ceiling exclusion), the engine
 * settle path, the arch exemption, and the check on real levels.
 */

const world = new World();
afterAll(() => world.destroy());

function loadLevel(id: string): { json: unknown } {
  return { json: JSON.parse(readFileSync(join(process.cwd(), 'levels', `${id}.json`), 'utf-8')) };
}

/** Minimal schema-valid Level with a custom terrain + ghost stroke (engine tests). */
function mkLevel(terrain: Polyline[], stroke: readonly [number, number][], spawnX: number, goalX: number): Level {
  const last = stroke[stroke.length - 1]!;
  return {
    schemaVersion: 1,
    id: 'ch1-l01',
    terrain,
    vehicleSpawn: { x: spawnX, y: 0.5 },
    goalFlag: { x: goalX, y: 0, width: 1, height: 2 },
    killY: -20,
    inkBudget: 60,
    starThresholds: { star2: 40, star3: 30 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [
      {
        kind: 'any',
        stroke,
        sampleEveryTicks: 10,
        samples: [{ t: 100, x: goalX, y: 0.5 }],
        result: { outcome: 'clear', ticks: 100, finalPos: { x: goalX, y: 0.5 }, inkConsumed: 5, starRating: 3 },
      },
    ],
  };
}

describe('topSolidSurfaceAt', () => {
  it('reports the top surface of a left→right (top-solid) polyline', () => {
    const terrain: Polyline[] = [[[-5, 0], [5, 0]]];
    expect(topSolidSurfaceAt(terrain, 0)).toBe(0);
    expect(topSolidSurfaceAt(terrain, 10)).toBeNull(); // outside the x-span
  });

  it('EXCLUDES a right→left (underside-solid) ceiling — it never supports a line', () => {
    const ceiling: Polyline[] = [[[5, 3], [-5, 3]]]; // authored right→left = underside solid
    expect(topSolidSurfaceAt(ceiling, 0)).toBeNull();
  });
});

describe('longestFreeSpan (pure geometry)', () => {
  // A raised mid-tier ABOVE the spawn→goal chord — the exact shape the OLD
  // terrain-chord metric false-flagged. The chain rests on it in short sub-spans.
  const tierTerrain: Polyline[] = [
    [[-10, 0], [-3, 0], [-3.2, -5]], // left platform @0
    [[-1.2, -5], [-1, 2], [1, 2], [1.2, -5]], // raised central tier top @2 (above the chord)
    [[3.2, -5], [3, 0], [10, 0]], // right platform @0
  ];

  it('POSITIVE: a chain resting on a raised mid-tier has SHORT free spans (≤5.5 m)', () => {
    const chain: Point[] = [
      { x: -4, y: 0.1 }, { x: -3, y: 0.1 }, // on left rim
      { x: -2, y: 1.05 }, // free (over the left gap)
      { x: -1, y: 2.05 }, { x: 0, y: 2.05 }, { x: 1, y: 2.05 }, // on the raised tier
      { x: 2, y: 1.05 }, // free (over the right gap)
      { x: 3, y: 0.1 }, { x: 4, y: 0.1 }, // on right rim
    ];
    const span = longestFreeSpan(chain, tierTerrain);
    expect(span).toBeGreaterThan(2); // the rim→tier gaps are real spans, not zero
    expect(span).toBeLessThanOrEqual(MAX_UNSUPPORTED_SPAN_M);
  });

  it('NEGATIVE CONTROL: a chain free-hanging 6.5 m between two rims EXCEEDS the limit', () => {
    const terrain: Polyline[] = [
      [[-10, 0], [-3.25, 0], [-3.45, -5]], // left platform, rim @ -3.25
      [[3.45, -5], [3.25, 0], [10, 0]], // right platform, rim @ +3.25 → 6.5 m gap
    ];
    const chain: Point[] = [
      { x: -3.5, y: 0.1 }, { x: -2, y: -0.3 }, { x: 0, y: -0.5 }, { x: 2, y: -0.3 }, { x: 3.5, y: 0.1 },
    ];
    expect(longestFreeSpan(chain, terrain)).toBeGreaterThan(MAX_UNSUPPORTED_SPAN_M);
  });

  it('a chain with NO top-solid below anywhere is one end-to-end free span', () => {
    const terrain: Polyline[] = [[[-1, 5], [1, 5]]]; // a stub far from the chain
    const chain: Point[] = [{ x: -4, y: 0 }, { x: 0, y: -1 }, { x: 4, y: 0 }];
    expect(longestFreeSpan(chain, terrain)).toBeCloseTo(Math.hypot(8, 0), 1);
  });
});

describe('measureUnsupportedSpan (engine settle)', () => {
  it('NEGATIVE CONTROL: a settled straight line over a 6.5 m gap measures > 5.5 m', () => {
    // Two platforms 6.5 m apart; a near-flat line resting on both rims. The settled
    // chain hangs free across the whole gap — the physics the 5.5 m limit forbids.
    const terrain: Polyline[] = [
      [[-10, 0], [-3.25, 0], [-3.45, -6]],
      [[3.45, -6], [3.25, 0], [10, 0]],
    ];
    const stroke: [number, number][] = [[-3.6, 0.12], [0, 0.12], [3.6, 0.12]];
    const result = measureUnsupportedSpan(mkLevel(terrain, stroke, -6, 6), world);
    expect(result.committed).toBe(true);
    expect(result.span).toBeGreaterThan(MAX_UNSUPPORTED_SPAN_M);
  });

  it('POSITIVE: a settled line split by a mid-pillar stays within the limit', () => {
    // A wide gap with a central pillar at rim height → two short sub-spans.
    const terrain: Polyline[] = [
      [[-10, 0], [-3.25, 0], [-3.45, -6]],
      [[-0.7, -6], [-0.5, 0], [0.5, 0], [0.7, -6]], // central pillar top @0
      [[3.45, -6], [3.25, 0], [10, 0]],
    ];
    const stroke: [number, number][] = [[-3.6, 0.12], [-1.6, 0.0], [0, 0.02], [1.6, 0.0], [3.6, 0.12]];
    const result = measureUnsupportedSpan(mkLevel(terrain, stroke, -6, 6), world);
    expect(result.committed).toBe(true);
    expect(result.span).toBeLessThanOrEqual(MAX_UNSUPPORTED_SPAN_M);
  });

  it('F1: span is measured from the PRE-DRIVE snapshot (before the first motor step), not after', () => {
    // Review R7 F1: measureUnsupportedSpan must read the chain captured at
    // launchReleased BEFORE the first motor-driven world.step, so the first
    // motor shove/sag is NOT baked into the baseline span. Drive a sim by hand,
    // capture the launch snapshot and the post-first-step chain, and confirm the
    // gate's measured span equals longestFreeSpan of the PRE-DRIVE snapshot.
    const terrain: Polyline[] = [
      [[-10, 0], [-3.25, 0], [-3.45, -6]],
      [[3.45, -6], [3.25, 0], [10, 0]],
    ];
    const strokeRaw: [number, number][] = [[-3.6, 0.12], [0, 0.02], [3.6, 0.12]];
    const level = mkLevel(terrain, strokeRaw, -6, 6);
    const strokePts: Point[] = strokeRaw.map(([x, y]) => ({ x, y }));

    const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
    let atLaunch: readonly Point[] | null = null;
    let preDriveChain: readonly Point[] = [];
    let afterFirstStep: readonly Point[] = [];
    try {
      expect(sim.commitStroke(strokePts).committed).toBe(true);
      sim.events.on('launchReleased', () => {
        atLaunch = sim.renderChainPolyline();
      });
      let outcome = sim.outcome;
      while (sim.preDriveSettledPolyline === null && outcome === null) {
        outcome = sim.step();
      }
      expect(sim.preDriveSettledPolyline).not.toBeNull();
      expect(atLaunch).not.toBeNull();
      preDriveChain = sim.preDriveSettledPolyline!;
      afterFirstStep = sim.renderChainPolyline();
      // Captured at launchReleased, BEFORE the first world.step → == the launch snapshot.
      expect(maxNodeDelta(preDriveChain, atLaunch!)).toBe(0);
    } finally {
      sim.destroy();
    }

    // The gate (fresh sim on the same recycled world — deterministic) reports the
    // PRE-DRIVE span: exactly longestFreeSpan of the snapshot captured pre-drive.
    const measured = measureUnsupportedSpan(level, world);
    expect(measured.committed).toBe(true);
    expect(measured.span).toBeCloseTo(longestFreeSpan(preDriveChain, terrain), 6);
    // Non-vacuous: the first motor step really moved the chain, so the pre-drive
    // snapshot the gate uses is a genuinely EARLIER shape than the post-step chain
    // the old code measured (node-level delta, ~mm — deterministic).
    expect(maxNodeDelta(preDriveChain, afterFirstStep)).toBeGreaterThan(0);
  });
});

/** Max paired-node displacement (m) between two chain polylines (test helper). */
function maxNodeDelta(a: readonly Point[], b: readonly Point[]): number {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    max = Math.max(max, Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y));
  }
  return max;
}

describe('unsupportedSpanCheck', () => {
  it('the compression-arch exemption set names L16 and L21 (§8.2)', () => {
    expect(ARCH_EXEMPT_IDS.has('ch1-l16')).toBe(true);
    expect(ARCH_EXEMPT_IDS.has('ch1-l21')).toBe(true);
    expect(CONTACT_CLEARANCE_M).toBeGreaterThan(0);
  });

  it('NEGATIVE CONTROL: a synthetic wide-gap (6.5 m) level FAILS the span limit', () => {
    const terrain: Polyline[] = [
      [[-10, 0], [-3.25, 0], [-3.45, -6]],
      [[3.45, -6], [3.25, 0], [10, 0]],
    ];
    const stroke: [number, number][] = [[-3.6, 0.12], [0, 0.12], [3.6, 0.12]];
    const result = unsupportedSpanCheck({ json: mkLevel(terrain, stroke, -6, 6) }, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('unsupported-span');
  });

  it('a compact real level (ch1-l01) PASSES with the span reported as a warning', () => {
    const result = unsupportedSpanCheck(loadLevel('ch1-l01'), world);
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).join(' ')).toContain('unsupported-span');
  });

  it('maxUnsupportedSpan returns a finite ≤5.5 m span for a compact real level', () => {
    const { json } = loadLevel('ch1-l04');
    const level = json as Level;
    expect(maxUnsupportedSpan(level, world)).toBeLessThanOrEqual(MAX_UNSUPPORTED_SPAN_M);
  });
});

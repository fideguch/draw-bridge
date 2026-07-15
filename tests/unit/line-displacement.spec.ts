import { afterAll, describe, expect, it } from 'vitest';
import type { Level, Point, Polyline } from '@engine/level/LevelSchema';
import type { Aabb } from '@engine/physics/Vehicle';
import { GameSimulation } from '@engine/GameSimulation';
import { World } from '@engine/physics/World';
import {
  CAR_CONTACT_SKIN_M,
  LINE_DISPLACEMENT_MAX_M,
  lineDisplacementCheck,
  maxShoveUnderCar,
  measureLineDisplacement,
} from '../../scripts/gates/lineDisplacement';

/**
 * Gate 6 — line displacement, CAR-PATH SCOPED (round-7 F5, game_plan_v5 §9.2 +
 * orchestrator decision I2c). Snapshot the settled bridge at the car's launch, then
 * track the max node shove ONLY where the CAR rides the chain. A line the car rides
 * that sinks past 0.3 m FAILS (F5: the driven route must match the drawn route); a
 * well-anchored (mid-pillar) span stays under; a pure shield the car never touches
 * auto-passes; rock deflection away from the car is sanctioned and unmeasured.
 *
 * Fully SYNTHETIC fixtures (independent of the shipped slate, which is regenerated):
 *   • NEGATIVE CONTROL — a floppy flat road that CLEARS yet whose span sinks
 *     >0.3 m under the car → FAILS (proves the gate flags an untruthful-but-winnable
 *     road, not merely a fall). learnings T4: every pass-check carries a fail case.
 *   • POSITIVE — the same wide gap split by a mid-pillar → ridden span stays <0.3 m.
 *   • SHIELD — the car clears at a goal before ever reaching a high line → auto-pass.
 * All attempts recycle ONE World (phaser-box2d 32-slot cap).
 */

const world = new World();
afterAll(() => world.destroy());

function pl(...pts: [number, number][]): Polyline {
  return pts.map(([x, y]) => [x, y] as const);
}
function stroke(...pts: [number, number][]): Point[] {
  return pts.map(([x, y]) => ({ x, y }));
}

/** Two rim platforms bracketing a chasm (walls undercut away from the gap, like ch1-l01). */
function twoPlatforms(leftFar: number, leftRim: number, rightRim: number, rightFar: number, chasmY: number): Polyline[] {
  return [
    pl([leftFar, 0], [leftRim, 0], [leftRim - 0.2, chasmY]),
    pl([rightRim + 0.2, chasmY], [rightRim, 0], [rightFar, 0]),
  ];
}

/** Minimal SCHEMA-VALID level (dummy 1-tick ghost; measure/gate only read the stroke + geometry). */
function buildLevel(terrain: Polyline[], spawn: Point, goalX: number, killY: number, strokePts: Point[]): Level {
  return {
    schemaVersion: 1,
    id: 'ch1-l01',
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
        stroke: strokePts.map((p) => [p.x, p.y] as const),
        sampleEveryTicks: 10,
        samples: [{ t: 1, x: spawn.x, y: spawn.y }],
        result: { outcome: 'clear', ticks: 1, finalPos: { x: spawn.x, y: spawn.y }, inkConsumed: 1, starRating: 1 },
      },
    ],
  };
}

/** NEGATIVE control: a wide flat span the car rides; it sinks >0.3 m under the car. */
function floppyFlatRoad(): Level {
  return buildLevel(
    twoPlatforms(-6.5, -2.0, 2.0, 6.5, -4.6),
    { x: -4.2, y: 0.35 },
    3.4,
    -5,
    stroke([-2.3, 0.06], [0, 0.02], [2.3, 0.06]),
  );
}

/** POSITIVE control: the same wide gap split by a mid-pillar; ridden span stays <0.3 m. */
function anchoredMidPillarRoad(): Level {
  return buildLevel(
    [...twoPlatforms(-6.5, -2.7, 2.7, 6.5, -4.6), pl([-0.5, -4.6], [-0.5, 0.28], [0.5, 0.28], [0.5, -4.6])],
    { x: -4.4, y: 0.35 },
    3.8,
    -5,
    stroke([-3.0, 0.06], [-1.3, 0.05], [0, 0.32], [1.3, 0.05], [3.0, 0.06]),
  );
}

/** SHIELD: flat floor; the line sits right of the goal, so the car clears before touching it. */
function pureShield(): Level {
  return buildLevel([pl([-6, 0], [6, 0])], { x: -4, y: 0.35 }, 1.5, -6, stroke([3.5, 1.6], [4.0, 1.55], [4.5, 1.6]));
}

describe('measureLineDisplacement (car-path scoped)', () => {
  it('reports a finite car-path shove and carRodeChain=true for a road the car rides', () => {
    const result = measureLineDisplacement(floppyFlatRoad(), world);
    expect(result.committed).toBe(true);
    expect(result.carRodeChain).toBe(true);
    expect(Number.isFinite(result.maxDisplacement ?? NaN)).toBe(true);
    expect(result.maxDisplacement ?? -1).toBeGreaterThan(0);
  });

  it('reports carRodeChain=false and 0 shove for a shield the car never touches', () => {
    const result = measureLineDisplacement(pureShield(), world);
    expect(result.committed).toBe(true);
    expect(result.outcome).toBe('clear');
    expect(result.carRodeChain).toBe(false);
    expect(result.maxDisplacement).toBe(0);
  });
});

describe('lineDisplacementCheck', () => {
  it('NEGATIVE CONTROL: a floppy flat road that CLEARS but sinks >0.3 m under the car FAILS', () => {
    // Sanity: the level really is winnable — the failure is truthfulness, not a fall.
    const measured = measureLineDisplacement(floppyFlatRoad(), world);
    expect(measured.outcome).toBe('clear');
    expect(measured.maxDisplacement ?? 0).toBeGreaterThan(LINE_DISPLACEMENT_MAX_M);

    const result = lineDisplacementCheck({ json: floppyFlatRoad() }, world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('line-displacement');
    expect(result.errors[0]).toContain('UNDER THE CAR');
  });

  it('a mid-pillar-anchored span the car rides PASSES within the limit', () => {
    const result = lineDisplacementCheck({ json: anchoredMidPillarRoad() }, world);
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).join(' ')).toContain('car-path');
  });

  it('a pure shield the car never rides AUTO-PASSES (empty car-contact set)', () => {
    const result = lineDisplacementCheck({ json: pureShield() }, world);
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).join(' ')).toContain('pure shield');
  });

  it("the limit constant is the plan's 0.3 m F5 threshold", () => {
    expect(LINE_DISPLACEMENT_MAX_M).toBe(0.3);
    expect(CAR_CONTACT_SKIN_M).toBeGreaterThan(0);
  });
});

/**
 * Review R7 (F1+F2). The baseline is the SETTLED chain captured at launchReleased
 * BEFORE the first motor-driven world.step (GameSimulation.preDriveSettledPolyline),
 * and the gate measures the shove FROM THE FIRST running tick inclusive. The prior
 * code sampled the baseline AFTER the first motor step and started measuring the
 * NEXT tick, so a severe shove reaching full magnitude on the FIRST running tick was
 * baked into the baseline and never measured — it read as ~0 and passed. These are
 * the negative controls for that defect.
 */
function maxNodeDelta(a: readonly Point[], b: readonly Point[]): number {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
    if (d > max) max = d;
  }
  return max;
}

describe('first-running-tick baseline (review R7 F1/F2)', () => {
  // A drawn line resting flat (pre-drive baseline), one car window over the middle
  // node. The FIRST running tick shoves that node 0.5 m and it stays shoved.
  const preDriveBaseline: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  const carWindow: Aabb[] = [{ minX: 0.6, minY: -0.6, maxX: 1.4, maxY: 0.6 }]; // covers node idx 1
  const shovedFrame: Point[] = [{ x: 0, y: 0 }, { x: 1, y: -0.5 }, { x: 2, y: 0 }];
  const heldFrame: Point[] = [{ x: 0, y: 0 }, { x: 1, y: -0.5 }, { x: 2, y: 0 }];
  // Frames observed once the run is running, first tick first (the shove is present
  // from that first tick and persists — a sustained sag, not a later slump).
  const runningFrames = [shovedFrame, heldFrame];

  /** NEW gate behaviour: measure EVERY running frame against the pre-drive baseline. */
  function measureFromFirstTickInclusive(baseline: Point[], frames: Point[][], boxes: Aabb[]): number {
    let max = 0;
    for (const frame of frames) {
      max = Math.max(max, maxShoveUnderCar(baseline, frame, boxes).maxDisplacement);
    }
    return max;
  }
  /** OLD buggy behaviour: baseline = the FIRST running frame, then skip it and measure the rest. */
  function measureOldBaselineBaked(frames: Point[][], boxes: Aabb[]): number {
    const bakedBaseline = frames[0]!;
    let max = 0;
    for (let i = 1; i < frames.length; i++) {
      max = Math.max(max, maxShoveUnderCar(bakedBaseline, frames[i]!, boxes).maxDisplacement);
    }
    return max;
  }

  it('NEGATIVE CONTROL: a severe shove present from the FIRST running tick FAILS (pre-drive baseline, first tick measured)', () => {
    const measured = measureFromFirstTickInclusive(preDriveBaseline, runningFrames, carWindow);
    expect(measured).toBeGreaterThan(LINE_DISPLACEMENT_MAX_M); // 0.5 m > 0.3 m → the gate FAILS it
  });

  it('CONTROL: the OLD baked-in baseline (sample after 1st step, skip 1st tick) would MISS the same shove and PASS', () => {
    const buggy = measureOldBaselineBaked(runningFrames, carWindow);
    expect(buggy).toBeLessThan(LINE_DISPLACEMENT_MAX_M); // the shove is invisible → the defect this fix closes
  });

  it('F1: preDriveSettledPolyline is captured at launch BEFORE the first motor step', () => {
    const level = floppyFlatRoad();
    const strokePts: Point[] = level.ghostSolutions[0]!.stroke.map(([x, y]) => ({ x, y }));
    const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
    try {
      expect(sim.commitStroke(strokePts).committed).toBe(true);
      let atLaunch: readonly Point[] | null = null;
      sim.events.on('launchReleased', () => {
        atLaunch = sim.renderChainPolyline();
      });
      let outcome = sim.outcome;
      while (sim.preDriveSettledPolyline === null && outcome === null) {
        outcome = sim.step();
      }
      const preDrive = sim.preDriveSettledPolyline;
      expect(preDrive).not.toBeNull();
      expect(atLaunch).not.toBeNull();
      // Captured at launchReleased, BEFORE world.step → identical to the launch snapshot.
      expect(maxNodeDelta(preDrive!, atLaunch!)).toBe(0);
      // The first motor step DID move the chain (~3.8 mm here). That movement is what
      // the OLD post-step baseline baked in; the pre-drive baseline excludes it.
      expect(maxNodeDelta(preDrive!, sim.renderChainPolyline())).toBeGreaterThan(0);
    } finally {
      sim.destroy();
    }
  });
});

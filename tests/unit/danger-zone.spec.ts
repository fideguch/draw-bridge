import { describe, expect, it } from 'vitest';
import type { DangerZone, Level, Point } from '@engine/level/LevelSchema';
import { buildBridge } from '@engine/physics/BridgeChainBuilder';
import { processStroke } from '@engine/physics/StrokePipeline';
import { Terrain } from '@engine/physics/Terrain';
import { Vehicle } from '@engine/physics/Vehicle';
import { World } from '@engine/physics/World';
import { Judge } from '@engine/rules/Judge';
import { GameSimulation } from '@engine/GameSimulation';
import { car } from '@tuning/TuningConstants';
import { arcStroke, buildSpikeLevel, simulationInternals } from '../../src/debug/SpikeScenario';

/**
 * DangerZone — the axis-aligned hazard band (user round-6: "危険帯であることがUIで
 * 全くわからなかった"). The CAR (chassis or a wheel AABB) overlapping a zone fails
 * with FailCause 'hazardContact' (round-7 F1 — contact IS the loss; it BEATS clear
 * on a same-tick tie per game_plan_v5 §2.1). The drawn BridgeChain and rocks pass
 * through zones UNAFFECTED — a zone only kills the car. Zones are static and only
 * feed the Judge (no bodies), so they never perturb determinism.
 *
 * The describes below the marker are ROUND-7 v1-LEGACY (kill-only zones). The
 * round-9 v2 additions (zones ALSO forbid drawing, BR-012 / WYSIWYG commit,
 * BR-013) are the final describe block.
 */

const FLAT_GROUND = {
  terrain: [
    [
      [-20, 0],
      [20, 0],
    ],
  ],
  killY: -7,
} as const;

const SPAWN = { x: 0, y: car.wheelRadius - car.wheelOffsetY + 0.05 };
const FAR_FLAG = { x: 15, y: 0, width: 1, height: 2 } as const;

/** The frozen no-rock/no-zone determinism hash (spike:determinism). */
const NO_HAZARD_PROBE_HASH = 'd39a29bd';

function settledVehicle(world: World): Vehicle {
  new Terrain(world, FLAT_GROUND);
  const vehicle = new Vehicle(world, SPAWN);
  for (let i = 0; i < 90; i++) {
    world.step();
  }
  return vehicle;
}

function spikeLevelWithZones(gapM: number, dangerZones: readonly DangerZone[]): Level {
  return { ...buildSpikeLevel(gapM, { runUpM: 6, flagOffsetM: 5 }), dangerZones };
}

function runFreshToOutcome(
  level: Level,
  stroke: readonly Point[],
): { hash: string; outcome: string; cause?: string; ticks: number } {
  const sim = new GameSimulation(level, { method: 'chain' });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      throw new Error(`commit failed: ${commit.reason}`);
    }
    const outcome = sim.runToOutcome();
    return {
      hash: simulationInternals(sim).world.stateHash(),
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { cause: outcome.cause } : {}),
      ticks: outcome.ticks,
    };
  } finally {
    sim.destroy();
  }
}

describe('Judge — DangerZone hazard (car overlap => cause "hazardContact")', () => {
  it('fails with cause "hazardContact" when the car overlaps a zone', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // A zone straddling the settled car at spawn.
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: -2, y: 0, width: 4, height: 2 }],
    });
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('hazardContact');
      expect(Number.isFinite(outcome.causeLocation.x)).toBe(true);
      // causeLocation is the centre of the car∩zone overlap (near the car).
      expect(outcome.causeLocation.x).toBeGreaterThan(-2);
      expect(outcome.causeLocation.x).toBeLessThan(2);
    }
    world.destroy();
  });

  it('does NOT fail when no zone overlaps the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: 8, y: 0, width: 2, height: 2 }], // far from the spawn car
    });
    expect(judge.evaluate(0, vehicle)).toBeNull();
    world.destroy();
  });

  it('a zone over the BRIDGE (not the car) does NOT fail — zones only kill the car', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // A drawn bridge far to the right of the car, and a zone over that bridge.
    const stroke = processStroke([
      { x: 8, y: 1 },
      { x: 11, y: 1 },
    ]);
    if (stroke.discarded) {
      expect.fail('fixture stroke must not be discarded');
    }
    const chain = buildBridge(world, stroke.resampled, {
      method: 'chain',
      strokeId: 1,
      vehicleMass: vehicle.totalMass,
    });
    const judge = new Judge({
      goalFlag: FAR_FLAG,
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: 8, y: 0.5, width: 3, height: 1 }], // covers the bridge, NOT the car
    });
    // The bridge sits inside the zone but the car does not → no hazard fail.
    expect(judge.evaluate(0, vehicle, chain)).toBeNull();
    world.destroy();
  });

  it('hazardContact BEATS clear on the same tick (round-7 F1, game_plan_v5 §2.1)', () => {
    const world = new World();
    const vehicle = settledVehicle(world);
    // The goal flag AND a danger zone both cover the settled car. Round-7 inverts
    // the old BR-009 clear-wins tie: hazard contact is the loss and WINS. (Authoring
    // never places a hazard on the goal line, so this is a deterministic edge only.)
    const judge = new Judge({
      goalFlag: { x: -2, y: 0, width: 4, height: 2 },
      killY: FLAT_GROUND.killY,
      dangerZones: [{ x: -2, y: 0, width: 4, height: 2 }],
    });
    const outcome = judge.evaluate(0, vehicle);
    expect(outcome?.outcome).toBe('fail');
    if (outcome?.outcome === 'fail') {
      expect(outcome.cause).toBe('hazardContact');
    }
    world.destroy();
  });
});

describe('GameSimulation — DangerZone integration', () => {
  it('a zone on the driving path turns a clear into a hazard fail', () => {
    // Without a zone the arc bridge clears the 4 m gap (baseline sanity).
    const clean = runFreshToOutcome(buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), arcStroke(4));
    expect(clean.outcome).toBe('clear');

    // A zone on the right platform (before the flag) that the car must cross.
    const zoned = spikeLevelWithZones(4, [{ x: 3, y: -0.5, width: 2, height: 3 }]);
    const hazardRun = runFreshToOutcome(zoned, arcStroke(4));
    expect(hazardRun.outcome).toBe('fail');
    expect(hazardRun.cause).toBe('hazardContact');
  });
});

describe('DangerZone — determinism (zones are static, no bodies)', () => {
  it('a far, untouched zone is byte-identical to a zone-free world', () => {
    // Same scenario as the frozen determinism probe, plus a zone the car never
    // reaches. The hash MUST NOT move — zones feed only the Judge (no physics).
    const baseline = runFreshToOutcome(
      { ...buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }) },
      arcStroke(2),
    );
    const withFarZone = runFreshToOutcome(
      { ...buildSpikeLevel(2, { runUpM: 5, flagOffsetM: 3 }), dangerZones: [{ x: 100, y: 100, width: 1, height: 1 }] },
      arcStroke(2),
    );
    expect(baseline.outcome).toBe('clear');
    expect(baseline.hash).toBe(NO_HAZARD_PROBE_HASH);
    expect(withFarZone.outcome).toBe('clear');
    expect(withFarZone.hash).toBe(NO_HAZARD_PROBE_HASH); // exact float bits, unchanged
    expect(withFarZone.ticks).toBe(baseline.ticks);
  });

  it('the render-only `style` tag is physics-inert (spike-tagged == untagged)', () => {
    // A zone on the right platform the car must cross (same as the integration test).
    const geom = { x: 3, y: -0.5, width: 2, height: 3 } as const;
    const untagged = runFreshToOutcome(spikeLevelWithZones(4, [{ ...geom }]), arcStroke(4));
    const tagged = runFreshToOutcome(spikeLevelWithZones(4, [{ ...geom, style: 'zone' }]), arcStroke(4));
    // The Judge collides only the base rect — the silhouette tag changes nothing.
    expect(tagged.outcome).toBe(untagged.outcome);
    expect(tagged.cause).toBe(untagged.cause);
    expect(tagged.ticks).toBe(untagged.ticks);
    expect(tagged.hash).toBe(untagged.hash); // exact float bits
  });
});

// ── ROUND-9 v2: zones forbid drawing (BR-012) + WYSIWYG commit (BR-013) ──────────

/** A v2 spike level (schemaVersion 2 gates the new draw-block + WYSIWYG rules). */
function v2SpikeLevel(extra: Partial<Level>): Level {
  return { ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), schemaVersion: 2, ...extra };
}

/** A ground with a central raised plateau (x ∈ [-3,3], y ∈ [0,3]) — splits a line drawn through it. */
function plateauLevel(schemaVersion: 1 | 2): Level {
  return {
    schemaVersion,
    id: 'ch1-l01',
    terrain: [
      [
        [-15, 0],
        [-3, 0],
        [-3, 3],
        [3, 3],
        [3, 0],
        [15, 0],
      ],
    ],
    vehicleSpawn: { x: -10, y: 0.6 },
    goalFlag: { x: 12, y: 0, width: 1.5, height: 2.5 },
    killY: -8,
    inkBudget: 64,
    starThresholds: { star2: 48, star3: 24 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [],
  };
}

describe('GameSimulation — v2 draw-block: zones forbid drawing (BR-012)', () => {
  const ZONE = { x: -1, y: 0, width: 2, height: 3 } as const; // covers x∈[-1,1], y∈[0,3]
  const THROUGH_ZONE: Point[] = [
    { x: -3, y: 1 },
    { x: 3, y: 1 }, // passes through (0,1) — inside the zone
  ];

  it('NEGATIVE CONTROL (a): a v2 stroke entering a red rect is REJECTED pre-launch', () => {
    const sim = new GameSimulation(v2SpikeLevel({ dangerZones: [ZONE] }), { method: 'chain' });
    const commit = sim.commitStroke(THROUGH_ZONE);
    expect(commit.committed).toBe(false);
    if (!commit.committed) {
      expect(commit.reason).toBe('enteredDangerZone');
    }
    expect(sim.phase).toBe('drawing'); // still drawable
    expect(sim.inkState.remaining).toBe(sim.inkState.effectiveBudget); // no ink spent
    sim.destroy();
  });

  it('the SAME zone+stroke COMMITS on a v1 level (v1 zones only kill, never forbid drawing)', () => {
    const v1 = { ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), dangerZones: [ZONE] };
    const sim = new GameSimulation(v1, { method: 'chain' });
    const commit = sim.commitStroke(THROUGH_ZONE);
    expect(commit.committed).toBe(true);
    sim.destroy();
  });

  it('isDrawBlocked = terrain ∪ zones in v2; terrain-only in v1', () => {
    const v2 = new GameSimulation(v2SpikeLevel({ dangerZones: [ZONE] }), { method: 'chain' });
    expect(v2.isDrawBlocked({ x: 0, y: 1 })).toBe(true); // inside the zone
    expect(v2.isDrawBlocked({ x: 10, y: 6 })).toBe(false); // open air
    v2.destroy();

    const v1 = new GameSimulation({ ...buildSpikeLevel(4, { runUpM: 6, flagOffsetM: 5 }), dangerZones: [ZONE] });
    expect(v1.isDrawBlocked({ x: 0, y: 1 })).toBe(false); // v1: a zone does not block drawing
    v1.destroy();
  });
});

describe('GameSimulation — v2 WYSIWYG commit (BR-013)', () => {
  it('NEGATIVE CONTROL (b): a v2 stroke split by terrain into >1 run is REJECTED', () => {
    const sim = new GameSimulation(plateauLevel(2), { method: 'chain' });
    const commit = sim.commitStroke([
      { x: -6, y: 1.5 },
      { x: 6, y: 1.5 }, // dives through the plateau → outside runs [-6,-3] and [3,6]
    ]);
    expect(commit.committed).toBe(false);
    if (!commit.committed) {
      expect(commit.reason).toBe('splitByTerrain');
    }
    expect(sim.inkState.remaining).toBe(sim.inkState.effectiveBudget); // full refund
    sim.destroy();
  });

  it('a single-run v2 stroke (open air) COMMITS and equals the preview', () => {
    const sim = new GameSimulation(plateauLevel(2), { method: 'chain' });
    const commit = sim.commitStroke([
      { x: -13, y: 0.1 },
      { x: -5, y: 0.1 }, // entirely on the left ground — one run, no split
    ]);
    expect(commit.committed).toBe(true);
    if (commit.committed) {
      expect(commit.clipApplied).toBe(false); // no-op clip: committed == drawn
      expect(commit.usedFallback).toBe(false);
    }
    sim.destroy();
  });

  it('the SAME split stroke still COMMITS on a v1 level (round-7 longest-run kept)', () => {
    const sim = new GameSimulation(plateauLevel(1), { method: 'chain' });
    const commit = sim.commitStroke([
      { x: -6, y: 1.5 },
      { x: 6, y: 1.5 },
    ]);
    expect(commit.committed).toBe(true); // v1 keeps the longest outside run
    sim.destroy();
  });
});

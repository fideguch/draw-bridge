/**
 * Gate 2.6 — HAZARD RELEVANCE (user round-6: "石は車が到達するまでの時間が考慮され
 * ておらず当たらない=役割を果たしてない"). A rock / DangerZone that never intersects
 * the car's spatiotemporal path is decoration, not a mechanic. This gate proves,
 * for every level carrying a hazard, that the hazard actually DOES ITS JOB:
 *
 *   1. INTENDED ghost line still clears WITH the hazard live (it is defeatable).
 *   2. At least one NAIVE baseline — a player who does NOT handle the hazard — is
 *      HARMED BY THE HAZARD, proving the hazard lies on the car's path in space
 *      AND time. "Harmed" = the attempt fails with cause 'hazard' (DangerZone),
 *      OR a rock touches the car within HAZARD_RELEVANCE_WINDOW_TICKS of the fail
 *      tick (the rock contact precedes / causes the loss).
 *
 * Baselines (naive "wrong" attempts):
 *   - straight-overlap1 : the rim-to-rim straight line a player draws first
 *     (reuses Gate 3's candidate builder). Skipped when no gap rims are found.
 *   - idle-noline       : a tiny harmless air-line behind the car (no forward
 *     bridge) — the car launches, drives off / sits, and any hazard that comes
 *     TO the spawn/path hits it. Covers hazards a forward straight would shield.
 *
 * If NO baseline is harmed, the hazard is irrelevant -> NDJSON error (the
 * negative control: a rock placed beyond reach fails this gate). Determinism +
 * world budget: all attempts recycle ONE shared World (phaser-box2d 32-slot cap).
 *
 * STATUS (round-6 geometry fix). The TRIGGERED spawn mechanism
 * (`rocks[].triggerCarX`, GameSimulation.updateTriggers) times each rock's
 * fall to the car's arrival, so it INTERCEPTS the naive car instead of finishing
 * its motion during the pre-launch settle. Every rock/DangerZone level now carries
 * GEOMETRY that converts a hit into a LOSS — a PIT under the interception zone (the
 * design-atlas 側溝/落石シャフト): the shielded car rolls over the empty pit, the
 * naive car falls in with the rock. The former flat-floor shields (L4/L7/L8/L13)
 * were reshaped to restore those pits, so ALL 18 levels are HARD-ENFORCED — there is
 * no advisory allowlist. Negative controls (a hazard placed beyond reach) stay hard
 * errors.
 */

import type { Level, Point } from '../../src/engine/level/LevelSchema';
import type { RockHazard } from '../../src/engine/physics/RockHazard';
import type { Vehicle } from '../../src/engine/physics/Vehicle';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { World } from '../../src/engine/physics/World';
import { detectRims, straightCandidateStroke } from './rims';

/**
 * A rock contact must fall within this many ticks BEFORE the fail tick to count
 * as the hazard causing the loss (0.75 s at 60 Hz — a rock landing on the car
 * then the car tipping/falling a beat later). Wide enough to credit a genuine
 * knock-down, tight enough to reject a coincidental early graze followed by an
 * unrelated fall much later.
 */
export const HAZARD_RELEVANCE_WINDOW_TICKS = 45;

/** Rock-vs-car contact skin (m) added to the rock radius (AABB nearest-point test). */
const ROCK_CONTACT_SKIN_M = 0.1;

let relevanceWorld: World | undefined;
function getRelevanceWorld(): World {
  relevanceWorld ??= new World();
  return relevanceWorld;
}

export interface HazardRelevanceResult {
  readonly errors: string[];
  /** Per-baseline dispositions (interpretability, like Gate 3's warnings). */
  readonly report: string[];
}

interface HazardTrackedRun {
  readonly committed: boolean;
  readonly outcome: 'clear' | 'fail' | null;
  readonly cause?: string;
  readonly failTick: number;
  /** Last tick a rock touched the car (-1 == never). */
  readonly lastRockContactTick: number;
  readonly hasRock: boolean;
}

/** True when any LIVE rock's disc intersects any car AABB (chassis / wheels). */
function rockTouchesCar(rocks: RockHazard, vehicle: Vehicle): boolean {
  const states = rocks.renderState();
  const boxes = vehicle.occupiedAABBs();
  for (const s of states) {
    if (s.armed) {
      continue; // an armed (pre-trigger) rock has no body — it touches nothing
    }
    for (const box of boxes) {
      const nx = Math.min(Math.max(s.x, box.minX), box.maxX);
      const ny = Math.min(Math.max(s.y, box.minY), box.maxY);
      if (Math.hypot(s.x - nx, s.y - ny) <= s.radius + ROCK_CONTACT_SKIN_M) {
        return true;
      }
    }
  }
  return false;
}

/** Run one scripted attempt at Lv0, tracking rock↔car contact per tick. */
function runHazardTracked(level: Level, stroke: readonly Point[], world: World): HazardTrackedRun {
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const hasRock = sim.renderRocks.count > 0;
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return { committed: false, outcome: null, failTick: -1, lastRockContactTick: -1, hasRock };
    }
    const rocks = sim.renderRocks;
    const vehicle = sim.renderVehicle;
    let lastContact = -1;
    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
      if (hasRock && rockTouchesCar(rocks, vehicle)) {
        lastContact = sim.currentTick;
      }
    }
    return {
      committed: true,
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { cause: outcome.cause } : {}),
      failTick: outcome.ticks,
      lastRockContactTick: lastContact,
      hasRock,
    };
  } finally {
    sim.destroy();
  }
}

/** True when the run's loss is attributable to the hazard (see module header). */
function isHazardAttributable(run: HazardTrackedRun): boolean {
  if (!run.committed || run.outcome !== 'fail') {
    return false;
  }
  if (run.cause === 'hazard') {
    return true; // DangerZone kill
  }
  return (
    run.hasRock &&
    run.lastRockContactTick >= 0 &&
    run.failTick - run.lastRockContactTick <= HAZARD_RELEVANCE_WINDOW_TICKS
  );
}

/**
 * A tiny harmless air-line just BEHIND the car (opposite travel): it commits
 * (open-air, not buried) but builds no forward bridge, so the car launches and
 * drives off / sits — the "player did nothing useful" baseline. Any hazard that
 * comes to the spawn/path then hits the car.
 */
function idleStroke(level: Level): Point[] {
  const s = level.vehicleSpawn;
  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const travelSign = flagCenterX >= s.x ? 1 : -1;
  const y = s.y + 0.3;
  return [
    { x: s.x - travelSign * 3.2, y },
    { x: s.x - travelSign * 1.2, y },
  ];
}

function describeRun(run: HazardTrackedRun): string {
  if (!run.committed) {
    return 'uncommitted';
  }
  const base = run.outcome === 'fail' ? `fail/${run.cause}` : 'clear';
  const rock = run.hasRock ? ` rockContact@${run.lastRockContactTick} end@${run.failTick}` : '';
  return `${base}${rock}`;
}

/**
 * Run the hazard-relevance check for one level (n/a -> empty result). Reuses the
 * module-recycled World unless `world` is supplied (tests pass a private one).
 */
export function hazardRelevanceCheck(level: Level, world: World = getRelevanceWorld()): HazardRelevanceResult {
  const hasRocks = (level.rocks?.length ?? 0) > 0;
  const hasZones = (level.dangerZones?.length ?? 0) > 0;
  if (!hasRocks && !hasZones) {
    return { errors: [], report: [] };
  }

  const errors: string[] = [];
  const report: string[] = [];

  // (1) The intended ghost line must still clear WITH the hazard live.
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    return { errors: ['hazard-relevance: level has no ghost solution to verify against'], report };
  }
  const ghostStroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const ghostRun = runHazardTracked(level, ghostStroke, world);
  report.push(`ghost: ${describeRun(ghostRun)}`);
  if (!ghostRun.committed || ghostRun.outcome !== 'clear') {
    errors.push(
      `hazard-relevance: the intended ghost line does NOT clear with the hazard live (${describeRun(ghostRun)}) — ` +
        `the hazard is placed unfairly (blocks the solution)`,
    );
  }

  // (2) At least one naive baseline must be harmed by the hazard.
  const baselines: { tag: string; stroke: readonly Point[] }[] = [];
  const rims = detectRims(level);
  if (rims !== null) {
    baselines.push({ tag: 'straight-overlap1', stroke: straightCandidateStroke(level, rims, 1.0, 0) });
  }
  baselines.push({ tag: 'idle-noline', stroke: idleStroke(level) });

  let hasAnyAttributable = false;
  for (const baseline of baselines) {
    const run = runHazardTracked(level, baseline.stroke, world);
    const isAttributable = isHazardAttributable(run);
    hasAnyAttributable ||= isAttributable;
    report.push(`${baseline.tag}: ${describeRun(run)}${isAttributable ? ' [HAZARD-RELEVANT]' : ''}`);
  }

  if (!hasAnyAttributable) {
    errors.push(
      `hazard-relevance: NO naive baseline was harmed by the ${hasZones ? 'dangerZone' : 'rock'} within ` +
        `${HAZARD_RELEVANCE_WINDOW_TICKS} ticks — the hazard never intersects the car's spatiotemporal path ` +
        `(it does not do its job). Baselines: ${report.join(' | ')}`,
    );
  }

  return { errors, report };
}

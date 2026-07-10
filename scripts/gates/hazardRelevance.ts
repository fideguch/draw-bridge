/**
 * Gate 2.6 — HAZARD RELEVANCE (round-7 F1 "contact IS loss" model, game_plan_v5
 * §2.3). A rock / DangerZone that never touches the car is decoration, not a
 * mechanic. Under the round-7 rule the car touching ANY hazard is an immediate
 * game over (FailCause 'hazardContact'), so the old "knock-into-pit within a
 * causal window" logic collapses into a simple BOOLEAN CONTACT invariant:
 *
 *   (positive)  some NAIVE baseline (a player who does NOT handle the hazard)
 *               fails with cause 'hazardContact', and the car is TOUCHING that
 *               SPECIFIC hazard on the fail tick (contact IS the cause). Every
 *               rock (by slot index) AND every zone must be attributed this way.
 *   (negative)  the INTENDED ghost line CLEARS with the hazard live. Because any
 *               hazard contact is an instant loss, a CLEAR proves the ghost has
 *               ZERO hazard contact (game_plan_v5 §2.3 negative control) — the
 *               correct line genuinely avoids every hazard.
 *   (spawn)     no rock overlaps the car at t=0 (game_plan_v5 §2.1 spawn guard):
 *               an initial overlap would mis-fire hazardContact on tick 0.
 *
 * PER-HAZARD (review R6 F1): attribution is NOT level-wide. A level with two rocks
 * (or a rock plus a zone) errors — NAMING the decorative hazard — unless EVERY one
 * is independently touched. Because contact ends the run instantly, attribution is
 * sampled at the FAIL TICK: every hazard the car overlaps when it dies is credited
 * (side-by-side rocks that both hit the same tick are both credited).
 *
 * NEGATIVE CONTROL: a rock/zone placed beyond the car's reach is never touched by
 * any baseline, stays unattributed, and fails this gate (naming it). Determinism +
 * world budget: all attempts recycle ONE shared World (phaser-box2d 32-slot cap).
 */

import type { DangerZone, Level, Point } from '../../src/engine/level/LevelSchema';
import type { RockHazard } from '../../src/engine/physics/RockHazard';
import type { Vehicle } from '../../src/engine/physics/Vehicle';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { World } from '../../src/engine/physics/World';
import { detectRims, straightCandidateStroke } from './rims';

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
  /** Rock SLOT indices overlapping any car AABB at t=0 (spawn guard). */
  readonly spawnOverlapRocks: readonly number[];
  /** Rock SLOT indices the car is touching on a hazardContact fail tick. */
  readonly contactRocks: readonly number[];
  /** Per zone: the car overlaps THAT zone on a hazardContact fail tick. */
  readonly contactZones: readonly boolean[];
}

/**
 * Rock disc vs car AABB test — IDENTICAL to the Judge's hazardContact predicate
 * (nearest-point distance <= radius, no skin), so a rock this credits is exactly
 * one that fired (or would fire) the loss. Returns the LIVE rock slot indices in
 * contact with any car box this tick.
 */
function rockSlotsTouchingCar(rocks: RockHazard, vehicle: Vehicle): number[] {
  const states = rocks.renderState();
  const boxes = vehicle.occupiedAABBs();
  const hits: number[] = [];
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (s === undefined || s.armed) {
      continue; // an armed (pre-trigger) rock has no body — it touches nothing
    }
    for (const box of boxes) {
      const nx = Math.min(Math.max(s.x, box.minX), box.maxX);
      const ny = Math.min(Math.max(s.y, box.minY), box.maxY);
      if (Math.hypot(s.x - nx, s.y - ny) <= s.radius) {
        hits.push(i);
        break;
      }
    }
  }
  return hits;
}

/** True when an axis-aligned box overlaps the bottom-left anchored rect (as Judge). */
function aabbOverlapsRect(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  rect: DangerZone,
): boolean {
  return (
    box.minX <= rect.x + rect.width && box.maxX >= rect.x && box.minY <= rect.y + rect.height && box.maxY >= rect.y
  );
}

/** Per-zone flags: does any car AABB currently overlap that zone rect? */
function zonesOverlappingCar(zones: readonly DangerZone[], vehicle: Vehicle): boolean[] {
  const boxes = vehicle.occupiedAABBs();
  return zones.map((zone) => boxes.some((box) => aabbOverlapsRect(box, zone)));
}

/** Run one scripted attempt at Lv0, tracking spawn overlap + fail-tick hazard contact. */
function runHazardTracked(level: Level, stroke: readonly Point[], world: World): HazardTrackedRun {
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const rockCount = sim.renderRocks.count;
    const zones = level.dangerZones ?? [];
    const empty: HazardTrackedRun = {
      committed: false,
      outcome: null,
      failTick: -1,
      spawnOverlapRocks: [],
      contactRocks: [],
      contactZones: new Array<boolean>(zones.length).fill(false),
    };
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return empty;
    }
    const rocks = sim.renderRocks;
    const vehicle = sim.renderVehicle;
    // t=0 spawn guard: rocks are spawned + the car is settled, before the first
    // step — any overlap here would mis-fire hazardContact on tick 0.
    const spawnOverlapRocks = rockCount > 0 ? rockSlotsTouchingCar(rocks, vehicle) : [];

    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
    }
    // Contact IS the loss: sample which hazards the car is touching on the fail
    // tick when the cause is hazardContact (the overlap is, by definition, the
    // cause — no causal window / terminal-coincidence risk to guard).
    let contactRocks: number[] = [];
    let contactZones = new Array<boolean>(zones.length).fill(false);
    if (outcome.outcome === 'fail' && outcome.cause === 'hazardContact') {
      contactRocks = rockCount > 0 ? rockSlotsTouchingCar(rocks, vehicle) : [];
      contactZones = zonesOverlappingCar(zones, vehicle);
    }
    return {
      committed: true,
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { cause: outcome.cause } : {}),
      failTick: outcome.ticks,
      spawnOverlapRocks,
      contactRocks,
      contactZones,
    };
  } finally {
    sim.destroy();
  }
}

/**
 * A tiny harmless air-line just BEHIND the car (opposite travel): it commits
 * (open-air, not buried) but builds no forward bridge, so the car launches and
 * drives off / sits — the "player did nothing useful" baseline. Any hazard that
 * comes to the spawn/path then touches the car.
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
  const rock = run.contactRocks.length > 0 ? ` rockHit[${run.contactRocks.join(',')}]` : '';
  const zone =
    run.contactZones.length > 0
      ? ` zoneHit[${run.contactZones.map((h, i) => `${i}:${h ? 'Y' : 'n'}`).join(',')}]`
      : '';
  return `${base} end@${run.failTick}${rock}${zone}`;
}

/**
 * Run the hazard-relevance check for one level (n/a -> empty result). Reuses the
 * module-recycled World unless `world` is supplied (tests pass a private one).
 */
export function hazardRelevanceCheck(level: Level, world: World = getRelevanceWorld()): HazardRelevanceResult {
  const rocks = level.rocks ?? [];
  const zones = level.dangerZones ?? [];
  if (rocks.length === 0 && zones.length === 0) {
    return { errors: [], report: [] };
  }

  const errors: string[] = [];
  const report: string[] = [];

  // (1) The intended ghost line must CLEAR with the hazard live. Under contact =
  // loss, a clear PROVES the ghost never touches a hazard (the negative control).
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    return { errors: ['hazard-relevance: level has no ghost solution to verify against'], report };
  }
  const ghostStroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const ghostRun = runHazardTracked(level, ghostStroke, world);
  report.push(`ghost: ${describeRun(ghostRun)}`);

  // (0) Spawn guard (game_plan_v5 §2.1): no rock may overlap the car at t=0.
  for (const i of ghostRun.spawnOverlapRocks) {
    const r = rocks[i] as (typeof rocks)[number];
    errors.push(
      `hazard-relevance: rock[${i}] at (${r.x}, ${r.y}) r=${r.radius} OVERLAPS the car at spawn (t=0) — ` +
        `authoring must place every rock non-overlapping with the settled car (game_plan_v5 §2.1 spawn guard)`,
    );
  }

  if (!ghostRun.committed || ghostRun.outcome !== 'clear') {
    errors.push(
      `hazard-relevance: the intended ghost line does NOT clear with the hazard live (${describeRun(ghostRun)}) — ` +
        `it either grazes a hazard (contact = instant loss) or the hazard unfairly blocks the solution`,
    );
  }

  // (2) EVERY rock AND EVERY zone must be TOUCHED by SOME naive baseline (per-hazard).
  const baselines: { tag: string; stroke: readonly Point[] }[] = [];
  const rims = detectRims(level);
  if (rims !== null) {
    baselines.push({ tag: 'straight-overlap1', stroke: straightCandidateStroke(level, rims, 1.0, 0) });
  }
  baselines.push({ tag: 'idle-noline', stroke: idleStroke(level) });

  const rockAttributed = new Array<boolean>(rocks.length).fill(false);
  const zoneAttributed = new Array<boolean>(zones.length).fill(false);
  for (const baseline of baselines) {
    const run = runHazardTracked(level, baseline.stroke, world);
    const harmed: string[] = [];
    if (run.committed && run.outcome === 'fail' && run.cause === 'hazardContact') {
      for (const i of run.contactRocks) {
        rockAttributed[i] = true;
        harmed.push(`rock${i}`);
      }
      for (let i = 0; i < zones.length; i++) {
        if (run.contactZones[i] === true) {
          zoneAttributed[i] = true;
          harmed.push(`zone${i}`);
        }
      }
    }
    report.push(`${baseline.tag}: ${describeRun(run)}${harmed.length > 0 ? ` HAZARD-RELEVANT ${harmed.join(',')}` : ''}`);
  }

  // (3) Name every hazard NO baseline could touch — it is decoration, not a mechanic.
  for (let i = 0; i < rocks.length; i++) {
    if (!rockAttributed[i]) {
      const r = rocks[i] as (typeof rocks)[number];
      errors.push(
        `hazard-relevance: rock[${i}] at (${r.x}, ${r.y}) r=${r.radius}` +
          `${r.triggerCarX !== undefined ? ` trigger@${r.triggerCarX}` : ''} never touched (=killed) a naive baseline — ` +
          `it never intersects the car's spatiotemporal path (decorative hazard). Baselines: ${report.join(' | ')}`,
      );
    }
  }
  for (let i = 0; i < zones.length; i++) {
    if (!zoneAttributed[i]) {
      const z = zones[i] as DangerZone;
      errors.push(
        `hazard-relevance: dangerZone[${i}] rect (x=${z.x}, y=${z.y}, w=${z.width}, h=${z.height}) never touched a ` +
          `naive baseline — it never intersects the car's spatiotemporal path (decorative hazard). ` +
          `Baselines: ${report.join(' | ')}`,
      );
    }
  }

  return { errors, report };
}

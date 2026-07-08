/**
 * Gate 2.6 — HAZARD RELEVANCE (user round-6: "石は車が到達するまでの時間が考慮され
 * ておらず当たらない=役割を果たしてない"). A rock / DangerZone that never intersects
 * the car's spatiotemporal path is decoration, not a mechanic. This gate proves,
 * for every level carrying a hazard, that the hazard actually DOES ITS JOB:
 *
 *   1. INTENDED ghost line still clears WITH the hazard live (it is defeatable).
 *   2. EVERY INDIVIDUAL hazard — each rock AND each dangerZone — is attributable:
 *      some NAIVE baseline (a player who does NOT handle it) is HARMED BY THAT
 *      SPECIFIC hazard, proving it lies on the car's path in space AND time.
 *      "Harmed" =
 *        - rock[i]  : that rock (tracked by SLOT INDEX) touches the car within
 *                     HAZARD_RELEVANCE_WINDOW_TICKS STRICTLY BEFORE the fail tick
 *                     (its contact precedes / causes the loss), or
 *        - zone[i]  : the attempt fails with cause 'hazard' AND the car overlaps
 *                     THAT zone rect on the fail tick (the overlap IS the cause).
 *
 * PER-HAZARD (review R6 F1): attribution is NOT level-wide. A level with two rocks
 * (or a rock plus a zone) errors — NAMING the decorative hazard — unless EVERY one
 * is independently harmed. `rockContactSlots()` tracks WHICH rock touched (by slot
 * index); `zonesOverlappingCar()` tracks WHICH zone the car entered.
 *
 * PRE-JUDGEMENT SAMPLING (review R6 F4): rock contact is sampled ONLY on
 * NON-TERMINAL ticks (a tick that did not itself declare the outcome), and
 * `isRockContactCausal` additionally requires the contact tick STRICTLY BEFORE the
 * fail tick. A rock that merely overlaps in the post-fail frame of a loss caused by
 * something else (terminal-tick coincidence) is therefore never credited. Zone
 * attribution has no such risk — a zone kill is, by definition, caused by the
 * overlap on the very tick the judge fails 'hazard', so it is sampled there.
 *
 * Baselines (naive "wrong" attempts):
 *   - straight-overlap1 : the rim-to-rim straight line a player draws first
 *     (reuses Gate 3's candidate builder). Skipped when no gap rims are found.
 *   - idle-noline       : a tiny harmless air-line behind the car (no forward
 *     bridge) — the car launches, drives off / sits, and any hazard that comes
 *     TO the spawn/path hits it. Covers hazards a forward straight would shield.
 *
 * If ANY hazard is unattributed the gate emits an NDJSON error naming it (the
 * negative control: a rock/zone placed beyond reach fails this gate). Determinism +
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

import type { DangerZone, Level, Point } from '../../src/engine/level/LevelSchema';
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

/**
 * True when a rock contact CAUSED the loss (review R6 F4). The contact tick must
 * be STRICTLY BEFORE the fail tick (`ticksBeforeFail >= 1`) — a contact sampled at
 * the terminal tick (delta 0) is rejected as a possible post-fail coincidence —
 * and within HAZARD_RELEVANCE_WINDOW_TICKS so a genuine early graze followed by an
 * unrelated fall much later does not count. Pure + exported for direct unit tests.
 */
export function isRockContactCausal(lastContactTick: number, failTick: number): boolean {
  if (lastContactTick < 0) {
    return false;
  }
  const ticksBeforeFail = failTick - lastContactTick;
  return ticksBeforeFail >= 1 && ticksBeforeFail <= HAZARD_RELEVANCE_WINDOW_TICKS;
}

interface HazardTrackedRun {
  readonly committed: boolean;
  readonly outcome: 'clear' | 'fail' | null;
  readonly cause?: string;
  readonly failTick: number;
  /** Per rock SLOT: last NON-TERMINAL tick that rock touched the car (-1 == never). */
  readonly rockLastContactTick: readonly number[];
  /** Per zone: the car overlapped THAT zone on the (hazard) fail tick. */
  readonly zoneHitAtFail: readonly boolean[];
}

/** Slot indices of every LIVE rock whose disc intersects any car AABB this tick. */
function rockContactSlots(rocks: RockHazard, vehicle: Vehicle): number[] {
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
      if (Math.hypot(s.x - nx, s.y - ny) <= s.radius + ROCK_CONTACT_SKIN_M) {
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

/** Run one scripted attempt at Lv0, tracking per-rock + per-zone hazard contact. */
function runHazardTracked(level: Level, stroke: readonly Point[], world: World): HazardTrackedRun {
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const rockCount = sim.renderRocks.count;
    const zones = level.dangerZones ?? [];
    const rockLastContactTick = new Array<number>(rockCount).fill(-1);
    let zoneHitAtFail = new Array<boolean>(zones.length).fill(false);
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return { committed: false, outcome: null, failTick: -1, rockLastContactTick, zoneHitAtFail };
    }
    const rocks = sim.renderRocks;
    const vehicle = sim.renderVehicle;
    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
      // F4: sample rock contact ONLY on NON-terminal ticks — a contact detected on
      // the very tick the loss is declared (post-fail state) is never recorded, so
      // rockLastContactTick is guaranteed strictly before the fail tick.
      if (outcome === null && rockCount > 0) {
        for (const i of rockContactSlots(rocks, vehicle)) {
          rockLastContactTick[i] = sim.currentTick;
        }
      }
    }
    // Zone attribution: a zone kill IS caused by the overlap on the fail tick, so
    // sample which zone(s) the car occupies there when cause is 'hazard' (no
    // terminal-coincidence risk — the overlap is definitionally the cause).
    if (outcome.outcome === 'fail' && outcome.cause === 'hazard' && zones.length > 0) {
      zoneHitAtFail = zonesOverlappingCar(zones, vehicle);
    }
    return {
      committed: true,
      outcome: outcome.outcome,
      ...(outcome.outcome === 'fail' ? { cause: outcome.cause } : {}),
      failTick: outcome.ticks,
      rockLastContactTick,
      zoneHitAtFail,
    };
  } finally {
    sim.destroy();
  }
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
  const rock =
    run.rockLastContactTick.length > 0
      ? ` rockContact[${run.rockLastContactTick.map((t, i) => `${i}@${t}`).join(',')}] end@${run.failTick}`
      : '';
  const zone =
    run.zoneHitAtFail.length > 0
      ? ` zoneHit[${run.zoneHitAtFail.map((h, i) => `${i}:${h ? 'Y' : 'n'}`).join(',')}]`
      : '';
  return `${base}${rock}${zone}`;
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

  // (2) EVERY rock AND EVERY zone must be harmed by SOME naive baseline (per-hazard).
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
    if (run.committed && run.outcome === 'fail') {
      for (let i = 0; i < rocks.length; i++) {
        if (isRockContactCausal(run.rockLastContactTick[i] ?? -1, run.failTick)) {
          rockAttributed[i] = true;
          harmed.push(`rock${i}`);
        }
      }
      if (run.cause === 'hazard') {
        for (let i = 0; i < zones.length; i++) {
          if (run.zoneHitAtFail[i] === true) {
            zoneAttributed[i] = true;
            harmed.push(`zone${i}`);
          }
        }
      }
    }
    report.push(`${baseline.tag}: ${describeRun(run)}${harmed.length > 0 ? ` HAZARD-RELEVANT ${harmed.join(',')}` : ''}`);
  }

  // (3) Name every hazard NO baseline could harm — it is decoration, not a mechanic.
  for (let i = 0; i < rocks.length; i++) {
    if (!rockAttributed[i]) {
      const r = rocks[i] as (typeof rocks)[number];
      errors.push(
        `hazard-relevance: rock[${i}] at (${r.x}, ${r.y}) r=${r.radius}` +
          `${r.triggerCarX !== undefined ? ` trigger@${r.triggerCarX}` : ''} never harmed a naive baseline within ` +
          `${HAZARD_RELEVANCE_WINDOW_TICKS} ticks — it never intersects the car's spatiotemporal path ` +
          `(decorative hazard). Baselines: ${report.join(' | ')}`,
      );
    }
  }
  for (let i = 0; i < zones.length; i++) {
    if (!zoneAttributed[i]) {
      const z = zones[i] as DangerZone;
      errors.push(
        `hazard-relevance: dangerZone[${i}] rect (x=${z.x}, y=${z.y}, w=${z.width}, h=${z.height}) never harmed a ` +
          `naive baseline — it never intersects the car's spatiotemporal path (decorative hazard). ` +
          `Baselines: ${report.join(' | ')}`,
      );
    }
  }

  return { errors, report };
}

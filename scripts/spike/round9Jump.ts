/**
 * Spike R9-JUMP — launch-ramp jump feasibility (round-9 fun decision 4, T0).
 *
 * Round-7 measured "ramp jump infeasible" across 15 configs. This RE-MEASURES it
 * precisely with the headless engine: can the powered car go ballistic off a
 * PLAYER-DRAWN ramp and clear a person-sized obstacle (1.3 m wide x 1.7 m tall)
 * standing on flat ground beyond the ramp?
 *
 * Method (player-faithful — the ramp is the committed stroke, run through the
 * real commit + physics path; NO hand-tuning of any physics constant):
 *   - Terrain: flat ground, or a descent (from +1.5 / +3 m) feeding a flat.
 *   - Stroke: a supported lead-in resting on the ground, kinking up into a ramp
 *     of angle theta over length L (the drawn launch ramp).
 *   - Sweep: approach {flat 2/4/6 m, descent 1.5 m, descent 3 m} x angle
 *     {10,20,30 deg} x rampLen {1.5,2.5,3.5 m} = 45 configs (>= 15 required).
 *   - Record the car's occupied-AABB trajectory; measure apex, peak airborne
 *     clearance beyond the ramp, and whether a 1.3x1.7 person AABB placed at
 *     swept distances beyond the ramp top is CLEARED (car AABB stays entirely
 *     above the person during the whole x-overlap, and passes it).
 *
 * All 45 attempts recycle ONE physics World (phaser-box2d 32-slot cap, World.ts).
 *
 * Run:  npx vite-node scripts/spike/round9Jump.ts      (writes a Markdown table)
 */

import { writeFileSync } from 'node:fs';
import { b2Body_ComputeAABB } from 'phaser-box2d';
import type { Level, Point } from '@engine/level/LevelSchema';
import { GameSimulation } from '@engine/GameSimulation';
import { World } from '@engine/physics/World';
import { simulationInternals } from '../../src/debug/SpikeScenario';
import { car, person } from '@tuning/TuningConstants';

const GROUND_Y = 0;
const REST_Y = car.wheelRadius - car.wheelOffsetY + 0.05; // settled chassis-centre height on flat ground
const RAMP_BASE_X = 0; // the ramp's foot (kink from lead-in to incline)
const LEAD_IN_M = 2.5; // flat stroke resting on the ground to anchor the ramp base
const STROKE_BASE_Y = 0.05; // the lead-in sits a hair above the ground surface
const RECORD_TICK_CAP = 420; // ~7 s: descent approach + launch + flight + land, before any timeout
const PERSON_TOP_Y = GROUND_Y + 2 * person.halfHeight; // 1.7 m
const PERSON_HALF_W = person.halfWidth; // 0.65 m

interface ApproachSpec {
  readonly label: string;
  /** Flat run-up before the lead-in (m). */
  readonly runUpM: number;
  /** Descent drop height feeding the flat (m); 0 == pure flat. */
  readonly descentM: number;
}

const APPROACHES: readonly ApproachSpec[] = [
  { label: 'flat-2m', runUpM: 2, descentM: 0 },
  { label: 'flat-4m', runUpM: 4, descentM: 0 },
  { label: 'flat-6m', runUpM: 6, descentM: 0 },
  { label: 'descent-1.5m', runUpM: 3, descentM: 1.5 },
  { label: 'descent-3m', runUpM: 4, descentM: 3 },
];
const ANGLES_DEG = [10, 20, 30] as const;
const RAMP_LENGTHS_M = [1.5, 2.5, 3.5] as const;

interface Frame {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly refY: number;
}

/** Build a flat-or-descent level whose ramp foot sits at RAMP_BASE_X on flat ground. */
function buildLevel(approach: ApproachSpec): { level: Level; spawn: Point } {
  const leadStartX = RAMP_BASE_X - LEAD_IN_M;
  const flatStartX = leadStartX - approach.runUpM;
  let terrain: Point[][];
  let spawn: Point;
  if (approach.descentM <= 0) {
    terrain = [
      [
        { x: flatStartX - 4, y: GROUND_Y },
        { x: 200, y: GROUND_Y },
      ],
    ];
    spawn = { x: flatStartX, y: REST_Y };
  } else {
    // A flat top, a GENTLE descent of descentM (<= ~25 deg so the car survives it),
    // then the flat that feeds the ramp.
    const descentLen = Math.max(4, approach.descentM * 2.2);
    const topX = flatStartX - descentLen;
    terrain = [
      [
        { x: topX - 4, y: approach.descentM },
        { x: topX, y: approach.descentM },
        { x: flatStartX, y: GROUND_Y },
        { x: 200, y: GROUND_Y },
      ],
    ];
    spawn = { x: topX - 2, y: approach.descentM + REST_Y };
  }
  const level: Level = {
    schemaVersion: 1,
    id: 'ch1-l01',
    terrain: terrain.map((line) => line.map(({ x, y }) => [x, y] as const)),
    vehicleSpawn: spawn,
    goalFlag: { x: 200, y: 40, width: 1, height: 1 }, // unreachable — never ends the run
    killY: -50,
    inkBudget: 500,
    starThresholds: { star2: 400, star3: 200 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [],
  };
  return { level, spawn };
}

/** The drawn ramp stroke: supported lead-in -> incline of `angleDeg` over `lengthM`. */
function rampStroke(angleDeg: number, lengthM: number): Point[] {
  const theta = (angleDeg * Math.PI) / 180;
  const topX = RAMP_BASE_X + lengthM * Math.cos(theta);
  const topY = STROKE_BASE_Y + lengthM * Math.sin(theta);
  return [
    { x: RAMP_BASE_X - LEAD_IN_M, y: STROKE_BASE_Y },
    { x: RAMP_BASE_X, y: STROKE_BASE_Y },
    { x: topX, y: topY },
  ];
}

/** Union AABB (chassis + wheels) of the car this tick. */
function carFrame(sim: GameSimulation): Frame {
  const vehicle = simulationInternals(sim).vehicle;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  for (const bodyId of [vehicle.chassisId, vehicle.wheelIds[0], vehicle.wheelIds[1]]) {
    const aabb = b2Body_ComputeAABB(bodyId);
    minX = Math.min(minX, aabb.lowerBoundX);
    maxX = Math.max(maxX, aabb.upperBoundX);
    minY = Math.min(minY, aabb.lowerBoundY);
  }
  return { minX, maxX, minY, refY: vehicle.referencePoint().y };
}

/** True when a person standing at foot-x `px` is fully cleared by the flight. */
function clearsPerson(frames: readonly Frame[], px: number): boolean {
  const left = px - PERSON_HALF_W;
  const right = px + PERSON_HALF_W;
  let hasApproached = false;
  let hasPassed = false;
  let overlapFrames = 0;
  for (const f of frames) {
    if (f.maxX < left) hasApproached = true;
    if (f.minX > right) hasPassed = true;
    const isXOverlapping = f.maxX >= left && f.minX <= right;
    if (isXOverlapping) {
      overlapFrames++;
      if (f.minY <= PERSON_TOP_Y) {
        return false; // the car body dipped into the person's silhouette
      }
    }
  }
  return hasApproached && hasPassed && overlapFrames > 0;
}

interface ConfigResult {
  readonly approach: string;
  readonly angleDeg: number;
  readonly rampLenM: number;
  readonly committed: boolean;
  readonly apexAboveGroundM: number;
  readonly peakAirBottomM: number;
  readonly clearMinDistM: number | null;
  readonly clearMaxDistM: number | null;
  readonly clearCount: number;
}

function runConfig(world: World, approach: ApproachSpec, angleDeg: number, rampLenM: number): ConfigResult {
  const { level } = buildLevel(approach);
  const sim = new GameSimulation(level, { world, method: 'chain' });
  try {
    const commit = sim.commitStroke(rampStroke(angleDeg, rampLenM));
    if (!commit.committed) {
      return {
        approach: approach.label, angleDeg, rampLenM, committed: false,
        apexAboveGroundM: 0, peakAirBottomM: 0, clearMinDistM: null, clearMaxDistM: null, clearCount: 0,
      };
    }
    const rampTopX = RAMP_BASE_X + rampLenM * Math.cos((angleDeg * Math.PI) / 180);
    const frames: Frame[] = [];
    let apex = 0; // peak car reference height, measured only PAST the ramp foot (ignore descent spawn)
    let peakAirBottom = 0;
    for (let t = 0; t < RECORD_TICK_CAP; t++) {
      if (sim.step() !== null) break; // ended (shouldn't on flat ground within the cap)
      const f = carFrame(sim);
      frames.push(f);
      if (f.minX > RAMP_BASE_X) {
        apex = Math.max(apex, f.refY);
      }
      if (f.minX > rampTopX) {
        peakAirBottom = Math.max(peakAirBottom, f.minY); // clearance height beyond the ramp
      }
    }
    // Sweep person foot placements just beyond the ramp top (0.5 .. 5 m).
    const clears: number[] = [];
    for (let d = 0.5; d <= 5.0001; d += 0.25) {
      if (clearsPerson(frames, rampTopX + d)) clears.push(Number(d.toFixed(2)));
    }
    return {
      approach: approach.label, angleDeg, rampLenM, committed: true,
      apexAboveGroundM: Number((apex - GROUND_Y).toFixed(2)),
      peakAirBottomM: Number(peakAirBottom.toFixed(2)),
      clearMinDistM: clears.length > 0 ? (clears[0] as number) : null,
      clearMaxDistM: clears.length > 0 ? (clears[clears.length - 1] as number) : null,
      clearCount: clears.length,
    };
  } finally {
    sim.destroy();
  }
}

function main(): void {
  const world = new World();
  const results: ConfigResult[] = [];
  try {
    for (const approach of APPROACHES) {
      for (const angleDeg of ANGLES_DEG) {
        for (const rampLenM of RAMP_LENGTHS_M) {
          results.push(runConfig(world, approach, angleDeg, rampLenM));
        }
      }
    }
  } finally {
    world.destroy();
  }

  const feasible = results.filter((r) => r.committed && r.clearCount > 0);
  const rows = results
    .map(
      (r) =>
        `| ${r.approach} | ${r.angleDeg} | ${r.rampLenM} | ${r.committed ? 'yes' : 'NO'} | ` +
        `${r.apexAboveGroundM} | ${r.peakAirBottomM} | ` +
        `${r.clearMinDistM ?? '-'} | ${r.clearMaxDistM ?? '-'} | ${r.clearCount} |`,
    )
    .join('\n');

  const verdict =
    feasible.length > 0
      ? `FEASIBLE — ${feasible.length}/${results.length} configs clear a 1.3x1.7 m person on the landing path.`
      : `INFEASIBLE — 0/${results.length} configs cleared a person (peak airborne clearance ` +
        `${Math.max(...results.map((r) => r.peakAirBottomM)).toFixed(2)} m < person top ${PERSON_TOP_Y} m).`;

  const md =
    `# Spike R9-JUMP — launch-ramp jump feasibility (round-9 T0)\n\n` +
    `Player-faithful re-measure of round-7's "ramp jump infeasible" (15 configs).\n` +
    `The ramp is the committed stroke, run through the real commit + physics path.\n` +
    `NO physics constant was hand-tuned. Person AABB = ${2 * person.halfWidth} m wide x ` +
    `${2 * person.halfHeight} m tall on flat ground.\n\n` +
    `- \`apex\` = peak car reference height above ground (m).\n` +
    `- \`airBottom\` = peak height of the car AABB BOTTOM beyond the ramp top (m) — the clearance a jump offers.\n` +
    `- \`clearMin/Max\` = nearest/farthest person foot-distance beyond the ramp top that is fully cleared (m); \`n\` = count.\n\n` +
    `**VERDICT: ${verdict}**\n\n` +
    `| approach | angle(deg) | rampLen(m) | committed | apex(m) | airBottom(m) | clearMin(m) | clearMax(m) | n |\n` +
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;

  writeFileSync('.fable/spike-round9-jump.md', md);
  process.stdout.write(md);
  process.stdout.write(`\nwrote .fable/spike-round9-jump.md (${results.length} configs)\n`);
}

main();

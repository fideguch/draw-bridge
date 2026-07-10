/**
 * Gate 6 — LINE DISPLACEMENT (round-7 F5, game_plan_v5 §9.2). "線が車に押されてズレる"
 * (V4-5) is caught mechanically — but scoped to CAR-PATH TRUTHFULNESS only.
 *
 * ── WHY CAR-PATH SCOPED (orchestrator decision, round-7 I2c) ──────────────────
 * F5's truthfulness goal is that "the route the CAR drives matches the atlas" —
 * the drawn line the wheels actually ride must not sag/shove away from the shape
 * the player drew. It is NOT a claim about every chain node at every instant.
 *
 * The v5 slate leans on shield / catch / dome mechanics where a rock STRIKES the
 * drawn line and deflects it 1.8–4.4 m BY DESIGN (§7 ETA table) — that is the
 * intended physics, and the car is nowhere near that part of the line when it
 * happens. A whole-chain max-displacement metric would flag those sanctioned
 * deflections as failures. So we measure displacement ONLY where and when the CAR
 * traverses the chain:
 *
 *   settled snapshot   := the chain shape the instant the car launches (settled
 *                         through anticipation, car not yet on it), then
 *   per running tick   := for each chain node inside the CAR's contact window
 *                         (its occupied AABBs + a small skin), compare that node's
 *                         LIVE position to its settled position and bound the max.
 *
 * Consequences (all intended):
 *   • Rock-impact deflection AWAY from the car's contact window is UNBOUNDED —
 *     it is the shield/catch/dome mechanic (game_plan_v5 §2.2 / §8.2).
 *   • Pure-shield levels where the car never rides the line (it drives the ground
 *     under a roof) auto-pass: the car-contact set is empty, so maxDisplacement 0.
 *   • A ROAD/seal/dome-dual level whose line SINKS >0.3 m under the car still
 *     FAILS — that is a line the car rides drifting from the drawn route (F5).
 *
 * The floor is LINE_DISPLACEMENT_MAX_M. NEGATIVE CONTROL (learnings T4): a floppy
 * road whose flat span sags past the limit under the car FAILS; an anchored arch
 * on the same gap passes; a high shield the car never touches auto-passes
 * (line-displacement.spec.ts drives all three directly).
 *
 * ROLLOUT (§3.6): STRICT by default; CI passes lib.WARN_NEW_GATES_FLAG until the
 * 28-slate lands.
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { GameSimulation } from '../../src/engine/GameSimulation';
import type { Aabb } from '../../src/engine/physics/Vehicle';
import { World } from '../../src/engine/physics/World';
import {
  applyWarnMode,
  hasWarnNewGatesFlag,
  parseCliOptions,
  resolveLevelFiles,
  runGate,
} from './lib';

/** Max settled→driven chain node displacement (m) UNDER THE CAR before it reads as "pushed" (§9.2). */
export const LINE_DISPLACEMENT_MAX_M = 0.3;

/**
 * Contact skin (m) added around each car AABB when deciding whether a chain node
 * is in the car's contact window. The car rides ON the chain (wheels on top), so a
 * ridden node sits ~bridge.capsuleRadius (0.12 m) below the wheel-AABB bottom; a
 * skin a touch above that robustly captures the node the car is actually driving
 * on (and its immediate contact-window neighbours) as the span flexes, WITHOUT
 * reaching a shield line held well above the car or a rock-shoved segment slumped
 * far below / off to the side. It never touches physics (pure observation).
 */
export const CAR_CONTACT_SKIN_M = 0.25;

let displacementWorld: World | undefined;
function getDisplacementWorld(): World {
  displacementWorld ??= new World();
  return displacementWorld;
}

/** True when `node` lies inside any car AABB expanded by CAR_CONTACT_SKIN_M. */
function nodeInCarWindow(node: Point, boxes: readonly Aabb[]): boolean {
  for (const b of boxes) {
    if (
      node.x >= b.minX - CAR_CONTACT_SKIN_M &&
      node.x <= b.maxX + CAR_CONTACT_SKIN_M &&
      node.y >= b.minY - CAR_CONTACT_SKIN_M &&
      node.y <= b.maxY + CAR_CONTACT_SKIN_M
    ) {
      return true;
    }
  }
  return false;
}

export interface LineDisplacementResult {
  /**
   * Max settled→driven displacement (m) of any chain node WHILE the car rode it.
   * 0 when the car never touches the chain (pure shield). null when the ghost
   * stroke does not commit / build a chain.
   */
  readonly maxDisplacement: number | null;
  readonly committed: boolean;
  readonly outcome: 'clear' | 'fail' | null;
  /** True once any chain node entered the car's contact window (the car rode the line). */
  readonly carRodeChain: boolean;
  readonly reason?: string;
}

/**
 * Run the primary ghost and measure the max settled→driven chain displacement
 * SCOPED TO THE CAR'S CONTACT WINDOW (see file header). Exported for direct unit
 * tests (a caller may pass a private recycled world).
 */
export function measureLineDisplacement(
  level: Level,
  world: World = getDisplacementWorld(),
): LineDisplacementResult {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    return { maxDisplacement: null, committed: false, outcome: null, carRodeChain: false, reason: 'no-ghost' };
  }
  const stroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return { maxDisplacement: null, committed: false, outcome: null, carRodeChain: false, reason: commit.reason };
    }
    let settled: readonly Point[] | null = null;
    let maxDisplacement = 0;
    let hasCarRidden = false;
    let outcome = sim.outcome;
    while (outcome === null) {
      outcome = sim.step();
      // Snapshot the SETTLED shape the first running tick (post-anticipation
      // settle, pre-drive), then, as the car crosses, measure the shove ONLY at
      // nodes inside the car's contact window (car-path truthfulness — header).
      if (settled === null && sim.phase === 'running') {
        settled = sim.renderChainPolyline();
      } else if (settled !== null) {
        const now = sim.renderChainPolyline();
        const carBoxes = sim.renderVehicle.occupiedAABBs();
        const n = Math.min(settled.length, now.length);
        for (let i = 0; i < n; i++) {
          const node = now[i]!;
          if (!nodeInCarWindow(node, carBoxes)) {
            continue;
          }
          hasCarRidden = true;
          const anchor = settled[i]!;
          const disp = Math.hypot(node.x - anchor.x, node.y - anchor.y);
          if (disp > maxDisplacement) {
            maxDisplacement = disp;
          }
        }
      }
    }
    return {
      maxDisplacement,
      committed: true,
      outcome: outcome.outcome,
      carRodeChain: hasCarRidden,
      ...(outcome.outcome === 'fail' ? { reason: outcome.cause } : {}),
    };
  } finally {
    sim.destroy();
  }
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function lineDisplacementCheck(
  loaded: { json: unknown },
  world?: World,
): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const result = measureLineDisplacement(parsed.level, world);
  if (!result.committed || result.maxDisplacement === null) {
    return {
      errors: [`line-displacement: primary ghost did not build a bridge to measure (${result.reason ?? 'unknown'})`],
    };
  }
  // Pure-shield level: the car never rides the drawn line (it drives the ground
  // under a roof / catch), so there is no car-path shove to bound — auto-pass.
  if (!result.carRodeChain) {
    return { errors: [], warnings: ['line-displacement: car never rides the line (pure shield) — car-path shove n/a'] };
  }
  if (result.maxDisplacement > LINE_DISPLACEMENT_MAX_M) {
    return {
      errors: [
        `line-displacement: chain shove UNDER THE CAR ${round2(result.maxDisplacement)}m > limit ` +
          `${LINE_DISPLACEMENT_MAX_M}m (game_plan_v5 §9.2 F5) — anchor the ridden span (rim / mid-pillar / ledge). ` +
          `(rock deflection away from the car is sanctioned and NOT measured.)`,
      ],
    };
  }
  return {
    errors: [],
    warnings: [`line-displacement (car-path) ${round2(result.maxDisplacement)}m <= ${LINE_DISPLACEMENT_MAX_M}m`],
  };
}

export function runLineDisplacementGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const isWarnMode = hasWarnNewGatesFlag(argv);
  return runGate(6, resolveLevelFiles(levelsGlob), isQuiet, (loaded) =>
    applyWarnMode(lineDisplacementCheck(loaded), isWarnMode),
  );
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runLineDisplacementGate(process.argv.slice(2)));
}

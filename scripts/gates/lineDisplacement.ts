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
 *   settled snapshot   := the chain shape the instant the car launches, captured
 *                         at launchReleased BEFORE the first motor-driven world.step
 *                         (settled through anticipation, car not yet on it, no motor
 *                         shove yet — GameSimulation.preDriveSettledPolyline), then
 *   per running tick   := for each chain node inside the CAR's contact window
 *                         (its occupied AABBs + a small skin), compare that node's
 *                         LIVE position to its settled position and bound the max —
 *                         starting with the FIRST running tick (review R7 F1+F2:
 *                         the first motor shove is neither baked into the baseline
 *                         nor skipped, so a severe one-tick shove is caught).
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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Aabb } from '../../src/engine/physics/Vehicle';
import { World } from '../../src/engine/physics/World';
import { EXIT_CONFIG, EXIT_FAIL, EXIT_PASS, parseCliOptions, resolveLevelFiles, runGate } from './lib';

/**
 * Max levels measured per PROCESS. Each level burns one phaser-box2d world slot
 * (never freed — 32/process cap, World header), so a >30-level slate is measured
 * in CHILD-PROCESS CHUNKS of this size with FRESH worlds (drift-free). 24 leaves
 * ample headroom under 32 for the sim's incidental worlds.
 */
export const DISPLACEMENT_CHUNK_MAX = 24;

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

export interface CarWindowShove {
  /** Max settled→live displacement (m) of any chain node inside the car window. */
  readonly maxDisplacement: number;
  /** True when at least one node was inside the car window this frame. */
  readonly hasCarContact: boolean;
}

/**
 * Per-frame reducer: the max displacement (m) of any chain node whose LIVE
 * position (`now`) lies inside the car's contact window, measured against the
 * `settled` (pre-drive) baseline. Index i pairs the same capsule endpoint in both
 * polylines. Pure — the gate calls it every running tick FROM THE FIRST inclusive,
 * so a severe shove on the first running tick is caught, not skipped (review R7
 * F2). Exported so the negative control can drive it with synthetic frames.
 */
export function maxShoveUnderCar(
  settled: readonly Point[],
  now: readonly Point[],
  carBoxes: readonly Aabb[],
): CarWindowShove {
  let maxDisplacement = 0;
  let hasCarContact = false;
  const n = Math.min(settled.length, now.length);
  for (let i = 0; i < n; i++) {
    const node = now[i]!;
    if (!nodeInCarWindow(node, carBoxes)) {
      continue;
    }
    hasCarContact = true;
    const anchor = settled[i]!;
    const disp = Math.hypot(node.x - anchor.x, node.y - anchor.y);
    if (disp > maxDisplacement) {
      maxDisplacement = disp;
    }
  }
  return { maxDisplacement, hasCarContact };
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
      // BASELINE = the SETTLED, PRE-DRIVE chain captured at launchReleased, BEFORE
      // the first motor-driven world.step (review R7 / F1+F2). Measuring from here
      // counts the FIRST running tick's shove inclusive; the previous code sampled
      // the baseline AFTER the first running step, baking that first motor shove
      // into the baseline AND skipping the first tick — a severe one-tick shove
      // (even one that rebounds) went unmeasured. Once the baseline exists, measure
      // the shove ONLY at nodes inside the car's contact window (car-path
      // truthfulness — header), STARTING with the tick that established it.
      settled ??= sim.preDriveSettledPolyline;
      if (settled === null) {
        continue; // still in anticipation — no pre-drive baseline captured yet
      }
      const shove = maxShoveUnderCar(settled, sim.renderChainPolyline(), sim.renderVehicle.occupiedAABBs());
      if (shove.hasCarContact) {
        hasCarRidden = true;
      }
      if (shove.maxDisplacement > maxDisplacement) {
        maxDisplacement = shove.maxDisplacement;
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
  // ROUND-9 (CS-4a): measure each level on a FRESH world. Displacement is compared
  // to a FIXED bound (0.3 m), so — unlike Gate 2, which compares to recorded
  // samples taken in the SAME shared-world sequence and is therefore self-cancelling
  // — this gate must be DRIFT-FREE (a recycled slot's Box2D residual swung a
  // high-bridge sag 0.06 → 0.38 m, measured CS-4b). CS-4b (>30-level slate) keeps
  // fresh-world accuracy and instead dodges the 32-slot cap by CHUNKING the CLI
  // across child processes (runLineDisplacementGate) — each child measures ≤ the
  // cap with fresh worlds.
  const ownWorld = world ?? new World();
  try {
    const result = measureLineDisplacement(parsed.level, ownWorld);
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
  } finally {
    // Only destroy a world WE created (a caller-supplied recycled world is theirs).
    if (world === undefined) {
      ownWorld.destroy();
    }
  }
}

// Round-7 rollout COMPLETE: the 28-slate passes this gate strictly, so it no
// longer reads --warn-new-gates (the flag now belongs to the round-8 gates 7-8;
// demoting THIS gate again would let a size/span/displacement regression slip
// through CI as a warning).
export function runLineDisplacementGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);

  // CHILD mode: the parent handed us an explicit, cap-safe file list. Measure
  // exactly those with fresh worlds (the normal runGate path).
  const filesArg = argv.find((a) => a.startsWith('--files='));
  if (filesArg !== undefined) {
    const files = filesArg.slice('--files='.length).split(',').filter((f) => f.length > 0);
    return runGate(6, files, isQuiet, (loaded) => lineDisplacementCheck(loaded));
  }

  // PARENT mode: a fresh world per level overruns the 32-slot cap on a >30-level
  // slate, so CHUNK the files across child processes (each ≤ DISPLACEMENT_CHUNK_MAX,
  // fresh worlds → drift-free). Aggregate: pass iff every child passed. Small
  // slates run inline (no fork).
  const files = resolveLevelFiles(levelsGlob);
  if (files.length <= DISPLACEMENT_CHUNK_MAX) {
    return runGate(6, files, isQuiet, (loaded) => lineDisplacementCheck(loaded));
  }
  const scriptPath = fileURLToPath(import.meta.url);
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const started = Date.now();
  let worst = EXIT_PASS;
  let passed = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i += DISPLACEMENT_CHUNK_MAX) {
    const chunk = files.slice(i, i + DISPLACEMENT_CHUNK_MAX);
    const childArgs = [scriptPath, '--', `--files=${chunk.join(',')}`, ...(isQuiet ? ['--quiet'] : [])];
    const res = spawnSync(viteNode, childArgs, { encoding: 'utf-8' });
    // Forward every per-level line; fold the child's chunk summary into ours.
    for (const line of (res.stdout ?? '').split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const obj = JSON.parse(line) as { summary?: boolean; passed?: number; failed?: number };
        if (obj.summary === true) {
          passed += obj.passed ?? 0;
          failed += obj.failed ?? 0;
          continue; // suppress the per-chunk summary; the parent emits one combined
        }
      } catch {
        /* not JSON — fall through and forward verbatim */
      }
      process.stdout.write(line + '\n');
    }
    if (res.stderr) process.stderr.write(res.stderr);
    const code = res.status ?? EXIT_CONFIG;
    if (code === EXIT_CONFIG) worst = EXIT_CONFIG;
    else if (code === EXIT_FAIL && worst !== EXIT_CONFIG) worst = EXIT_FAIL;
  }
  process.stdout.write(
    JSON.stringify({ gate: 6, summary: true, total: files.length, passed, failed, durationMs: Date.now() - started }) + '\n',
  );
  return failed > 0 ? EXIT_FAIL : worst;
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runLineDisplacementGate(process.argv.slice(2)));
}

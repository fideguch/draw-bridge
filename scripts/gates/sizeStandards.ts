/**
 * Gate 4 — STAGE SIZE STANDARDS (round-7 F2, game_plan_v5 §3). "車とゴールが近すぎ /
 * ステージ面積が狭い" was the user's 3rd repeat; the fix is to MACHINE-ENFORCE a
 * per-difficulty-tier floor on the three size metrics (plus vertical usage) so a
 * future "genre density" over-correction can never re-shrink the boards (§3.6):
 *
 *   - W_win  (readable window diagonal, m): the frame the player reads at a glance.
 *   - L_path (course length, m): the ACTUAL driven distance (primary ghost path arc
 *     length) — the felt "car↔goal closeness" is really "the drive is short".
 *   - D_sg   (spawn→goal straight separation, m): the linear "farness".
 *   - span_y (readable window vertical extent, m) + ratio (H/W): vertical usage,
 *     since portrait makes horizontal scarce and vertical plentiful (§3.5).
 *
 * Each level's tier (S/M/L/XL) comes from SIZE_CLASS_BY_ID (§3.3 / §5.2 slate). A
 * metric below its tier floor is an error naming the metric, the value, and the
 * floor. The floors are the plan's exact numbers (incl. the B2 D_sg 10.8 / L19 D_sg
 * 12.0 fixes, which sit above the S/XL floors below).
 *
 * ROLLOUT (§3.6): STRICT by default. The current 18 levels predate these standards
 * and WILL violate them — CI runs `--warn-new-gates` until the 28-slate lands, then
 * drops the flag (see lib.WARN_NEW_GATES_FLAG). NEGATIVE CONTROL: a shrunk level
 * fails; a padded one passes (sizeStandards.spec.ts).
 */
import { validateLevel, type Level } from '../../src/engine/level/LevelSchema';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

export type SizeClass = 'S' | 'M' | 'L' | 'XL';

interface SizeFloor {
  readonly wWin: number;
  readonly lPath: number;
  readonly dSg: number;
  readonly spanY: number;
  readonly ratio: number;
}

/* eslint-disable @typescript-eslint/naming-convention -- S/M/L/XL are domain tier codes (game_plan_v5 §3.3) */
/** Per-tier floors (game_plan_v5 §3.3). */
export const TIER_FLOORS: Record<SizeClass, SizeFloor> = {
  S: { wWin: 16, lPath: 10, dSg: 10, spanY: 3, ratio: 0.7 },
  M: { wWin: 20, lPath: 11, dSg: 10, spanY: 5, ratio: 0.7 },
  L: { wWin: 20, lPath: 11.5, dSg: 11, spanY: 6, ratio: 0.7 },
  XL: { wWin: 22, lPath: 14, dSg: 12, spanY: 8, ratio: 0.8 },
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Level id -> difficulty tier (game_plan_v5 §3.3 / §5.2, full 28-slate). The 18
 * current levels (l01-l15, b1-b3) are a subset; l16-l23 / b4-b5 are forward-looking
 * so the gate is ready the moment I2 lands them.
 */
export const SIZE_CLASS_BY_ID: Record<string, SizeClass> = {
  'ch1-l01': 'S', 'ch1-b1': 'S', 'ch1-b2': 'S', 'ch1-b3': 'S',
  'ch1-l02': 'M', 'ch1-l03': 'M', 'ch1-l04': 'M', 'ch1-l05': 'M', 'ch1-l06': 'M', 'ch1-l09': 'M', 'ch1-b5': 'M',
  'ch1-l07': 'L', 'ch1-l08': 'L', 'ch1-l10': 'L', 'ch1-l11': 'L', 'ch1-l12': 'L', 'ch1-l13': 'L',
  'ch1-l14': 'L', 'ch1-l15': 'L', 'ch1-l16': 'L', 'ch1-b4': 'L',
  'ch1-l17': 'XL', 'ch1-l18': 'XL', 'ch1-l19': 'XL', 'ch1-l20': 'XL', 'ch1-l21': 'XL', 'ch1-l22': 'XL', 'ch1-l23': 'XL',
};

// Readable-window framing constants — MIRROR src/render/scenes/play/levelFraming.ts
// (kept local so this headless gate never imports the Phaser render layer). If the
// framing policy there changes, mirror it here (both cite game_plan_v5 §3.2).
const PLAY_PAD_X_M = 2.0;
const PIT_VIEW_DEPTH_M = 3.0;
const DRAW_HEADROOM_M = 1.5;

export interface SizeMetrics {
  readonly wWin: number;
  readonly lPath: number;
  readonly dSg: number;
  readonly spanY: number;
  readonly ratio: number;
}

/** Straight distance spawn → goal-flag center. */
function spawnGoalSeparation(level: Level): number {
  const goalCx = level.goalFlag.x + level.goalFlag.width / 2;
  const goalCy = level.goalFlag.y + level.goalFlag.height / 2;
  return Math.hypot(goalCx - level.vehicleSpawn.x, goalCy - level.vehicleSpawn.y);
}

/** Arc length of the primary ghost's recorded reference-point samples (driven path). */
function coursePathLength(level: Level): number {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined || ghost.samples.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 1; i < ghost.samples.length; i++) {
    const a = ghost.samples[i - 1]!;
    const b = ghost.samples[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * The readable window (width, height) — the frame the game fits the level into,
 * mirroring levelFraming.levelContentBounds: horizontal = spawn↔flag padded;
 * vertical = terrain-in-window + spawn + goal + coins, floored to a capped pit view
 * and topped with draw headroom.
 */
function readableWindow(level: Level): { width: number; height: number } {
  const flagLeft = level.goalFlag.x;
  const flagRight = level.goalFlag.x + level.goalFlag.width;
  const minX = Math.min(level.vehicleSpawn.x, flagLeft) - PLAY_PAD_X_M;
  const maxX = Math.max(level.vehicleSpawn.x, flagRight) + PLAY_PAD_X_M;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let lowestRimY = Number.POSITIVE_INFINITY;
  for (const polyline of level.terrain) {
    for (const [x, y] of polyline) {
      if (x >= minX && x <= maxX) {
        maxY = Math.max(maxY, y);
        minY = Math.min(minY, y);
        lowestRimY = Math.min(lowestRimY, y);
      }
    }
  }
  const extendY = (y: number): void => {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  extendY(level.goalFlag.y);
  extendY(level.goalFlag.y + level.goalFlag.height);
  extendY(level.vehicleSpawn.y);
  for (const coin of level.coins) {
    if (coin.x >= minX && coin.x <= maxX) {
      extendY(coin.y);
    }
  }
  const surfaceY = Number.isFinite(lowestRimY) ? lowestRimY : level.vehicleSpawn.y;
  // Show enough pit to read the hazard, capped — never the full killY depth.
  minY = Math.min(minY, surfaceY - PIT_VIEW_DEPTH_M);
  maxY += DRAW_HEADROOM_M;
  return { width: Math.max(maxX - minX, 1e-3), height: Math.max(maxY - minY, 1e-3) };
}

/** Compute the four size metrics + the aspect ratio for a level (exported for tests). */
export function computeSizeMetrics(level: Level): SizeMetrics {
  const win = readableWindow(level);
  return {
    wWin: Math.hypot(win.width, win.height),
    lPath: coursePathLength(level),
    dSg: spawnGoalSeparation(level),
    spanY: win.height,
    ratio: win.height / win.width,
  };
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function sizeStandardsCheck(loaded: { json: unknown }): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  const tier = SIZE_CLASS_BY_ID[level.id];
  if (tier === undefined) {
    return {
      errors: [],
      warnings: [`size-standards: no size tier mapped for ${level.id} (add it to SIZE_CLASS_BY_ID) — skipped`],
    };
  }
  const floor = TIER_FLOORS[tier];
  const m = computeSizeMetrics(level);
  const errors: string[] = [];
  const below = (name: string, value: number, min: number): void => {
    if (value < min) {
      errors.push(`size-standards[${tier}]: ${name} ${round1(value)}m < floor ${min}m (game_plan_v5 §3.3)`);
    }
  };
  below('W_win', m.wWin, floor.wWin);
  below('L_path', m.lPath, floor.lPath);
  below('D_sg', m.dSg, floor.dSg);
  below('span_y', m.spanY, floor.spanY);
  below('ratio(H/W)', m.ratio, floor.ratio);
  const warnings = [
    `size[${tier}] W_win=${round1(m.wWin)} L_path=${round1(m.lPath)} D_sg=${round1(m.dSg)} span_y=${round1(m.spanY)} ratio=${round1(m.ratio)}`,
  ];
  return { errors, warnings };
}

// Round-7 rollout COMPLETE: the 28-slate passes this gate strictly, so it no
// longer reads --warn-new-gates (the flag now belongs to the round-8 gates 7-8;
// demoting THIS gate again would let a size regression slip through CI as a warning).
export function runSizeStandardsGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  return runGate(4, resolveLevelFiles(levelsGlob), isQuiet, (loaded) => sizeStandardsCheck(loaded));
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runSizeStandardsGate(process.argv.slice(2)));
}

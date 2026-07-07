/**
 * Gate 1 — static level validity (no simulation).
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §1
 * Checks: inkBudget > 0; vehicleSpawn rests above terrain (vertical ray down
 * from the spawn hits a terrain segment); goalFlag placement (vertical ray
 * down from the flag rect's center hits terrain).
 * Non-blocking warning: ink budget vs straight-span length factor (legend
 * value provisional per game_design §6 — emitted as `warnings`, never fails).
 */
import { validateLevel, type Level, type Polyline } from '../../src/engine/level/LevelSchema';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

/** y of the highest terrain surface directly below (x, y); null when no segment spans x below y. */
export function terrainYBelow(terrain: readonly Polyline[], x: number, y: number): number | null {
  let best: number | null = null;
  for (const polyline of terrain) {
    for (let i = 0; i + 1 < polyline.length; i++) {
      const a = polyline[i]!;
      const b = polyline[i + 1]!;
      const [ax, ay] = a;
      const [bx, by] = b;
      const minX = Math.min(ax, bx);
      const maxX = Math.max(ax, bx);
      if (x < minX || x > maxX) continue;
      const t = maxX === minX ? 0 : (x - ax) / (bx - ax);
      const segY = ay + t * (by - ay);
      if (segY <= y && (best === null || segY > best)) best = segY;
    }
  }
  return best;
}

/** Provisional ink-sufficiency factor: budget should cover ~1.2x the direct span (warning only). */
const INK_SPAN_WARN_FACTOR = 1.2;

export function gate1Check(loaded: { json: unknown }): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level: Level = parsed.level;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(level.inkBudget > 0)) {
    errors.push(`inkBudget must be > 0 (got ${level.inkBudget})`);
  }

  const spawnGround = terrainYBelow(level.terrain, level.vehicleSpawn.x, level.vehicleSpawn.y);
  if (spawnGround === null) {
    errors.push(`vehicleSpawn (${level.vehicleSpawn.x}, ${level.vehicleSpawn.y}) has no terrain below it`);
  }

  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const flagTopY = level.goalFlag.y + level.goalFlag.height;
  const flagGround = terrainYBelow(level.terrain, flagCenterX, flagTopY);
  if (flagGround === null) {
    errors.push(`goalFlag center (${flagCenterX}, ${flagTopY}) has no terrain below it`);
  }

  const span = Math.hypot(
    flagCenterX - level.vehicleSpawn.x,
    level.goalFlag.y - level.vehicleSpawn.y,
  );
  if (level.inkBudget < span * INK_SPAN_WARN_FACTOR) {
    warnings.push(
      `inkBudget ${level.inkBudget} < ${INK_SPAN_WARN_FACTOR}x direct span ${span.toFixed(1)} — verify clearability via Gate 2 ghost (non-blocking)`,
    );
  }

  return { errors, warnings };
}

export function runGate1(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const files = resolveLevelFiles(levelsGlob);
  return runGate(1, files, isQuiet, gate1Check);
}

// vite-node strips the script path from argv — top-level CLI execution (see gate0).
process.exit(runGate1(process.argv.slice(2)));

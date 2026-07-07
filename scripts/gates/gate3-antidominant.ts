/**
 * Gate 3 — straight-line bot MUST FAIL on every level tagged `anti-dominant`.
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §5.
 * Untagged levels no-op pass. For tagged levels the bot draws the single
 * straight rim-to-rim segment plus height variants {0, +0.5, +1.0} m; ink
 * clamp counts over-budget candidates as failed (`infeasible(budget)`); the
 * gate passes iff EVERY candidate fails.
 */
import { validateLevel, type Level, type Point, type Polyline } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

/**
 * One recycled world for ALL bot candidates across the run — a fresh world per
 * candidate exhausts the 32-slot cap at ~6 anti-dominant levels x 6+ simulated
 * candidates (levels agent hit this empirically). Bot verdicts only need the
 * outcome (fail/clear), well within recycled-slot macroscopic determinism.
 */
let botWorld: World | undefined;
function getBotWorld(): World {
  botWorld ??= new World();
  return botWorld;
}

/** Rim detection Δx (contract §5 initial value). */
const RIM_PROBE_DX = 0.2;
/** Candidate endpoint height offsets in meters (contract §5 initial set). */
const HEIGHT_OFFSETS = [0, 0.5, 1.0] as const;
/**
 * Overlap extensions (m) beyond each rim along x (contract §5 "calibratable"):
 * exact rim-to-rim strokes have ZERO platform overlap and slide into the gap
 * on every geometry (empirically verified — the unanchored chain needs rim
 * overlap to bear load), which made the bot vacuously fail everywhere. Real
 * players draw straight lines THROUGH the rims, so the dominant-strategy
 * approximation must include overlapped straights.
 */
const OVERLAP_EXTENSIONS = [0, 1.0, 2.0] as const;

/** True when some terrain segment covers x-range (x, x+dx] (or [x-dx, x) when dx<0). */
function terrainCoversX(terrain: readonly Polyline[], x: number, dx: number): boolean {
  const lo = Math.min(x + dx, x) + 1e-9;
  const hi = Math.max(x + dx, x) - 1e-9;
  for (const polyline of terrain) {
    for (let i = 0; i + 1 < polyline.length; i++) {
      const ax = polyline[i]![0];
      const bx = polyline[i + 1]![0];
      if (Math.max(ax, bx) >= lo + 1e-9 && Math.min(ax, bx) <= hi - 1e-9) return true;
    }
  }
  return false;
}

/**
 * A = spawn-side rim: terrain vertex nearest beyond the spawn in travel
 * direction (+x towards the flag) with no terrain within Δx on its +x side.
 * B = goal-side rim: symmetric on the flag side (-x probe).
 */
export function detectRims(level: Level): { rimA: Point; rimB: Point } | null {
  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const travelSign = flagCenterX >= level.vehicleSpawn.x ? 1 : -1;
  const vertices: Point[] = [];
  for (const polyline of level.terrain) {
    for (const [x, y] of polyline) vertices.push({ x, y });
  }
  const spawnSide = vertices
    .filter((v) => (v.x - level.vehicleSpawn.x) * travelSign >= 0)
    .filter((v) => !terrainCoversX(level.terrain, v.x, RIM_PROBE_DX * travelSign))
    .sort((a, b) => (a.x - b.x) * travelSign);
  const goalSide = vertices
    .filter((v) => (flagCenterX - v.x) * travelSign >= 0)
    .filter((v) => !terrainCoversX(level.terrain, v.x, -RIM_PROBE_DX * travelSign))
    .sort((a, b) => (b.x - a.x) * travelSign);
  const rimA = spawnSide[0];
  const rimB = goalSide[0];
  if (!rimA || !rimB) return null;
  return { rimA, rimB };
}

export function gate3Check(loaded: { json: unknown }): { errors: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  if (!level.gimmickTags.includes('anti-dominant')) {
    return { errors: [] };
  }

  const rims = detectRims(level);
  if (!rims) {
    return { errors: ['anti-dominant level but rim detection found no gap rims'] };
  }

  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const travelSign = flagCenterX >= level.vehicleSpawn.x ? 1 : -1;
  const errors: string[] = [];
  for (const offset of HEIGHT_OFFSETS) {
    for (const overlap of OVERLAP_EXTENSIONS) {
      const a: Point = { x: rims.rimA.x - travelSign * overlap, y: rims.rimA.y + offset };
      const b: Point = { x: rims.rimB.x + travelSign * overlap, y: rims.rimB.y + offset };
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > level.inkBudget) {
        // infeasible(budget) — counts as a failed attempt (economy layer defense).
        continue;
      }
      // Two interior points keep the resampler direction stable on long segments.
      const stroke: Point[] = [a, lerpPoint(a, b, 1 / 3), lerpPoint(a, b, 2 / 3), b];
      const result = runScriptedAttempt(level, stroke, { world: getBotWorld() });
      if (result.committed && result.outcome === 'clear') {
        errors.push(
          `straight-line bot CLEARED at offset +${offset}m overlap ${overlap}m (ticks ${result.ticks}) — anti-dominant contract violated`,
        );
      }
    }
  }
  return { errors };
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  const { levelsGlob, isQuiet } = parseCliOptions(process.argv.slice(2));
  process.exit(runGate(3, resolveLevelFiles(levelsGlob), isQuiet, gate3Check));
}

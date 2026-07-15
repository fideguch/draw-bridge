/**
 * Gate 1 — static level validity (no simulation).
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §1
 * Checks: inkBudget > 0; vehicleSpawn rests above terrain (vertical ray down
 * from the spawn hits a terrain segment); goalFlag placement (vertical ray
 * down from the flag rect's center hits terrain); WINDING / collision-side
 * (each polyline's authored winding makes its functional face solid).
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

// ── winding / collision-side validation ────────────────────────────────────────
// phaser-box2d chain shapes are ONE-SIDED; the solid face is set by the authored
// winding (Terrain.ts reverses each polyline internally). Empirically anchored
// (tests/unit/terrain.spec.ts + scripts/probe/terrain-probe.ts, validated with a
// reversed-winding negative control): the solid-side outward normal of an authored
// segment a→b is (-dy, dx) rotated +90° CCW, so its VERTICAL component is dx:
//   dx > 0 (authored left→right)  ⇒ TOP face solid  (drive surface / plateau top)
//   dx < 0 (authored right→left)  ⇒ UNDERSIDE solid (ceiling / overhang lip)
// A drive surface authored right→left, or a ceiling authored left→right, is a
// GHOST from its functional side — the exact "判定がない地形" class the user hit.
// This static check classifies each segment's REQUIRED side from geometry and
// asserts the winding provides it. It is deliberately CONSERVATIVE: only clear
// top-drive-surface and 2-point-ceiling segments are asserted; steep inner faces
// (chasm walls, stair risers, pillar/spike flanks) are left to the dynamic probe.

/** |topY - midY| within this ⇒ the segment IS the top surface at its midpoint x. */
const TOP_SURFACE_EPS_M = 0.06;
/** Segments steeper than this are walls/inner faces, not asserted here. */
const DRIVE_SLOPE_MAX_DEG = 55;

/**
 * Winding / collision-side errors for a level's terrain. A 2-point polyline is a
 * ceiling/overhang (underside solid); every other polyline's topmost, gently
 * sloped segments are drive surfaces (top solid).
 */
export function windingErrors(terrain: readonly Polyline[]): string[] {
  const errors: string[] = [];
  terrain.forEach((polyline, pIdx) => {
    const isCeiling = polyline.length === 2;
    for (let i = 0; i + 1 < polyline.length; i++) {
      const [ax, ay] = polyline[i]!;
      const [bx, by] = polyline[i + 1]!;
      const dx = bx - ax;
      const dy = by - ay;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const slopeDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;

      if (isCeiling) {
        // Underside must be solid ⇒ authored right→left ⇒ dx < 0.
        if (!(dx < 0)) {
          errors.push(
            `terrain[${pIdx}] ceiling seg ${i} authored left→right (dx=${dx.toFixed(2)}); underside will be a GHOST — author right→left so the underside is solid`,
          );
        }
        continue;
      }

      // Drive surface = topmost terrain at the midpoint x, gently sloped.
      const topY = terrainYBelow(terrain, mx, my + 0.5);
      const isTop = topY !== null && Math.abs(topY - my) <= TOP_SURFACE_EPS_M;
      if (!isTop || slopeDeg > DRIVE_SLOPE_MAX_DEG) continue;

      // Top face must be solid ⇒ authored left→right ⇒ dx > 0.
      if (!(dx > 0)) {
        errors.push(
          `terrain[${pIdx}] drive-surface seg ${i} at (${mx.toFixed(2)}, ${my.toFixed(2)}) authored right→left (dx=${dx.toFixed(2)}); top face will be a GHOST — author left→right so the top is solid`,
        );
      }
    }
  });
  return errors;
}

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

  // WINDING / collision-side: each polyline's functional face must be solid.
  errors.push(...windingErrors(level.terrain));

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
if (!process.env['VITEST']) {
  process.exit(runGate1(process.argv.slice(2)));
}

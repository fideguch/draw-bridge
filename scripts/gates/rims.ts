/**
 * Shared gap-rim detection + straight-candidate builder (side-effect free).
 *
 * Extracted from gate3-antidominant.ts so BOTH Gate 3 (straight-line dominance
 * bot) AND Gate 2.6 (hazard-relevance) can build the SAME "naive straight line a
 * player would draw" without either gate importing the other's CLI module (whose
 * top-level `process.exit` would fire on import outside vitest). Pure geometry +
 * the Level types; no engine world, no CLI.
 */

import type { Level, Point, Polyline } from '../../src/engine/level/LevelSchema';

/** Rim detection Δx (contract §5 initial value). */
export const RIM_PROBE_DX = 0.2;

/** True when some terrain segment covers x-range (x, x+dx] (or [x-dx, x) when dx<0). */
export function terrainCoversX(terrain: readonly Polyline[], x: number, dx: number): boolean {
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

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Highest TOP-SOLID terrain surface y at x, or null when no top-solid feature
 * spans x. Only polylines authored left→right (net dx ≥ 0 ⇒ top solid, the
 * TerrainSolids convention) can bear a car or a chain — a ceiling / overhang
 * (net dx < 0) is underside-solid and is excluded. Shared by Gate 5
 * (unsupported span: chain support contacts) and Gate 7 (lazy line: the ground
 * surface a lazy player anchors their stroke on). Lives here (pure geometry,
 * no CLI) so gates can share it without importing each other's self-exiting
 * CLI modules.
 */
export function topSolidSurfaceAt(terrain: readonly Polyline[], x: number): number | null {
  let best: number | null = null;
  for (const polyline of terrain) {
    if (polyline.length < 2) continue;
    const first = polyline[0]!;
    const last = polyline[polyline.length - 1]!;
    if (last[0] - first[0] < 0) continue; // underside-solid (ceiling) — never a support
    for (let i = 0; i + 1 < polyline.length; i++) {
      const [ax, ay] = polyline[i]!;
      const [bx, by] = polyline[i + 1]!;
      const minX = Math.min(ax, bx);
      const maxX = Math.max(ax, bx);
      if (x < minX || x > maxX) continue;
      const t = bx === ax ? 0 : (x - ax) / (bx - ax);
      const segY = ay + t * (by - ay);
      if (best === null || segY > best) best = segY;
    }
  }
  return best;
}

/**
 * The dominant-strategy straight stroke: a rim-to-rim line extended `overlap` m
 * onto each platform and raised `offset` m, with two interior points so the
 * resampler keeps direction stable on long segments (Gate 3 §5 candidate).
 */
export function straightCandidateStroke(
  level: Level,
  rims: { rimA: Point; rimB: Point },
  overlap: number,
  offset: number,
): Point[] {
  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const travelSign = flagCenterX >= level.vehicleSpawn.x ? 1 : -1;
  const a: Point = { x: rims.rimA.x - travelSign * overlap, y: rims.rimA.y + offset };
  const b: Point = { x: rims.rimB.x + travelSign * overlap, y: rims.rimB.y + offset };
  return [a, lerpPoint(a, b, 1 / 3), lerpPoint(a, b, 2 / 3), b];
}

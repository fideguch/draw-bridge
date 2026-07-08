/**
 * TerrainSolids — closed solid polygons per terrain polyline, for a cheap,
 * deterministic point-in-solid test used by stroke clipping (round-4 bug:
 * "線が引けない土台があります" — lines must not lie across / through solids).
 *
 * SOLID-SIDE MODEL (identical convention to scripts/gates/gate1-static.ts
 * `windingErrors`, empirically anchored by tests/unit/terrain.spec.ts +
 * scripts/probe/terrain-probe.ts with a reversed-winding negative control):
 * phaser-box2d chain shapes are ONE-SIDED; the authored winding picks the solid
 * face. For a level polyline (BEFORE Terrain.ts reverses it for Box2D) the solid
 * mass sits on the (dy, -dx) side of each edge a→b, so the VERTICAL component of
 * the solid normal is -dx:
 *   net dx >= 0 (authored left→right) ⇒ TOP solid   (ground / plateau / pillar / spike)
 *   net dx <  0 (authored right→left) ⇒ UNDERSIDE solid (ceiling / overhang lip)
 *
 * Each open terrain polyline is CLOSED into a simple filled polygon by dropping
 * both endpoints to a closure plane on the solid side: a floor plane well below
 * everything for top-solid features, a sky plane well above everything for
 * underside-solid (ceiling) features. This turns:
 *   - ground/plateau surfaces into the filled earth beneath them,
 *   - pillars/spikes into their filled interior (their own base seals the shape),
 *   - ceilings/overhangs into the filled rock ABOVE the underside line, correctly
 *     BOUNDED to the ceiling's own x-extent (a floating overhang does not become
 *     an infinite half-plane — the endpoint fix).
 *
 * Pure geometry: no Box2D, deterministic (exact float compares), input never
 * mutated. Built once per level (GameSimulation.build) and reused for every
 * commit + the live-preview isInsideTerrain predicate.
 */

import type { Point, Polyline } from '../level/LevelSchema';

/** A closed, simple solid polygon (CCW or CW — even-odd test is winding-agnostic). */
export interface SolidPolygon {
  readonly vertices: readonly Point[];
}

/** All terrain solids of one level. */
export interface TerrainSolids {
  readonly polygons: readonly SolidPolygon[];
}

/**
 * Distance (world m) the closure planes sit beyond the terrain extent. Large
 * enough that no drawable stroke can pass on the far side of a plane (so an
 * overhang column reads as solid up to any height a player could draw), finite
 * for determinism. Structural constant, NOT a game-feel tunable (like
 * SEGMENT_COUNT_MIN / ATTEMPT_SETTLE_TICKS it lives with its module).
 */
const CLOSURE_MARGIN_M = 100;

/**
 * SURFACE SKIN (world m): the solid boundary is pushed this far INTO the terrain
 * before testing, so a stroke may graze / rest just under a surface (the drawn
 * line and its solidified bridge always overlap the terrain skin a little) while
 * genuine THROUGH-plateau penetration deeper than the skin still clips.
 *
 * Measured, NOT hand-tuned: across all 18 shipped levels the deepest a recorded
 * ghost's RDP-simplified stroke dips below a surface (a legitimate corner drape
 * where the bridge rests on the outer edge) is 0.4304 m (ch1-l14 stair descent).
 * 0.55 sits above that so EVERY shipped ghost stays a byte-identical clip no-op
 * (Gate 2 / campaign safe, no re-record), yet the shallowest shipped plateau is
 * ~3 m tall so the skin never hollows a feature — a line laid across a plateau
 * clips as soon as it sinks past the skin. Re-derive if a re-record changes the
 * ghost graze budget (probe: scripts/probe compares ghost strokes vs surfaces).
 */
export const SURFACE_SKIN_M = 0.55;

/**
 * SOLID-CONSTRUCTION SANITY BOUNDS (review F3 hardening). The solid-side model
 * infers the collision face from the whole polyline's net dx (module header).
 * That inference — and the close-to-a-plane construction — is only well-defined
 * for a polyline that has a clear horizontal span and an unambiguous net
 * direction. Two authored shapes break it, so we FAIL LOUD at construction
 * (authoring / gate time) instead of silently building a wrong or degenerate
 * solid:
 *   - DEGENERATE: horizontal extent below MIN_SOLID_WIDTH_M closes into a
 *     zero-width / zero-area sliver (a vertical line has no interior to test).
 *   - AMBIGUOUS: |net dx| below AMBIGUOUS_NET_DX_M while the polyline spans more
 *     than AMBIGUOUS_VERTICAL_EXTENT_M vertically is a near-vertical / mixed
 *     wall whose functional face the net-dx rule cannot pick — it could close on
 *     the wrong side.
 * Calibration: across all 18 shipped levels the tightest real feature (a pillar)
 * has |net dx| = hExtent = 1.6 m — ~16x the ambiguity bound and ~32x the width
 * bound, so no shipped level trips these (verified: npm run gates / campaign).
 * Structural constants (like SURFACE_SKIN_M), not game-feel tunables.
 */
const MIN_SOLID_WIDTH_M = 0.05;
const AMBIGUOUS_NET_DX_M = 0.1;
const AMBIGUOUS_VERTICAL_EXTENT_M = 1.0;

/**
 * Throw if `polyline` cannot form a well-defined one-sided solid (see the
 * SOLID-CONSTRUCTION SANITY BOUNDS). `label` identifies the offender
 * (level id + polyline index) so the failure is actionable at authoring/gate time.
 */
function assertConstructibleSolid(polyline: Polyline, label: string): void {
  if (polyline.length < 2) {
    throw new Error(`TerrainSolids: ${label} has < 2 vertices — cannot form a solid`);
  }
  const first = polyline[0] as readonly [number, number];
  const last = polyline[polyline.length - 1] as readonly [number, number];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of polyline) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const hExtent = maxX - minX;
  const vExtent = maxY - minY;
  const netDx = Math.abs(last[0] - first[0]);
  if (hExtent < MIN_SOLID_WIDTH_M) {
    throw new Error(
      `TerrainSolids: ${label} is degenerate — horizontal extent ${hExtent.toFixed(3)}m < ` +
        `${MIN_SOLID_WIDTH_M}m closes into a zero-width/area solid; widen the base or split the feature`,
    );
  }
  if (netDx < AMBIGUOUS_NET_DX_M && vExtent > AMBIGUOUS_VERTICAL_EXTENT_M) {
    throw new Error(
      `TerrainSolids: ${label} has an ambiguous solid side — |net dx| ${netDx.toFixed(3)}m < ` +
        `${AMBIGUOUS_NET_DX_M}m over ${vExtent.toFixed(3)}m of vertical extent (near-vertical/mixed wall); ` +
        `the net-dx face rule cannot pick the solid side — bias the endpoints or split into functional faces`,
    );
  }
}

/** Build the closed solid polygon for one authored polyline (skin pre-applied). */
function closePolyline(polyline: Polyline, floorY: number, skyY: number, skinM: number): SolidPolygon {
  const first = polyline[0] as readonly [number, number];
  const last = polyline[polyline.length - 1] as readonly [number, number];
  // net dx >= 0 → top solid → close DOWN; net dx < 0 → underside solid → close UP.
  const isSolidBelow = last[0] - first[0] >= 0;
  const planeY = isSolidBelow ? floorY : skyY;
  // Push the surface INTO the solid by the skin (down for top-solid, up for
  // underside-solid) so surface grazes are tolerated (see SURFACE_SKIN_M).
  const skinShift = isSolidBelow ? -skinM : skinM;
  const vertices: Point[] = polyline.map(([x, y]) => ({ x, y: y + skinShift }));
  vertices.push({ x: last[0], y: planeY });
  vertices.push({ x: first[0], y: planeY });
  return { vertices };
}

/**
 * Build every terrain polyline's closed solid polygon. `killY` (already below
 * the lowest terrain vertex) anchors the floor plane so the earth extends past
 * the fall line. `skinM` (default SURFACE_SKIN_M) lets tests exercise the raw
 * geometry with no tolerance. `levelId` (optional) names the level in the
 * degeneracy-guard error messages (review F3). Throws on a degenerate or
 * ambiguous polyline (see assertConstructibleSolid) — fail at authoring/gate
 * time, never silently build a wrong solid.
 */
export function buildTerrainSolids(
  terrain: readonly Polyline[],
  killY: number,
  skinM: number = SURFACE_SKIN_M,
  levelId?: string,
): TerrainSolids {
  const idPrefix = levelId !== undefined ? `${levelId} ` : '';
  terrain.forEach((polyline, index) => {
    assertConstructibleSolid(polyline, `${idPrefix}polyline[${index}]`);
  });
  let minY = killY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const polyline of terrain) {
    for (const [, y] of polyline) {
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }
  const floorY = minY - CLOSURE_MARGIN_M;
  const skyY = maxY + CLOSURE_MARGIN_M;
  return { polygons: terrain.map((polyline) => closePolyline(polyline, floorY, skyY, skinM)) };
}

/**
 * Even-odd ray-cast point-in-polygon (ray toward +x). Boundary points are
 * treated as OUTSIDE, so a stroke resting flush on a surface stays valid.
 */
export function isPointInPolygon(point: Point, vertices: readonly Point[]): boolean {
  const n = vertices.length;
  let isInside = false;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const vi = vertices[i] as Point;
    const vj = vertices[j] as Point;
    const isStraddling = vi.y > point.y !== vj.y > point.y;
    if (isStraddling) {
      const xCross = ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
      if (point.x < xCross) {
        isInside = !isInside;
      }
    }
  }
  return isInside;
}

/** True when `point` lies inside ANY terrain solid. */
export function isPointInSolids(point: Point, solids: TerrainSolids): boolean {
  for (const polygon of solids.polygons) {
    if (isPointInPolygon(point, polygon.vertices)) {
      return true;
    }
  }
  return false;
}

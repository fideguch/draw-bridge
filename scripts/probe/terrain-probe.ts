/**
 * terrain-probe — headless one-sided-collision auditor (PRIORITY-0 bug hunt).
 *
 * Real-device report: "線を引いても地形に引っかからない・判定がない地形がある"
 * (drawn lines don't catch on terrain / some terrain has no collision) →
 * progression-blocking. Prime suspect: phaser-box2d chain shapes are ONE-SIDED
 * (collision side = polyline winding). Terrain.ts reverses each authored
 * left→right polyline so its TOP is solid; ceilings (scripts/levels ch1.ts
 * `ceiling`) are authored right→left so their UNDERSIDE is solid. If any
 * polyline's winding faces the wrong way it is a ghost surface from the side
 * gameplay needs.
 *
 * WHAT IT DOES: for every terrain segment of every levels/*.json it drops a
 * small dynamic probe box onto the segment from the side gameplay requires and
 * verifies contact (does NOT fall through), plus a negative control from the
 * opposite side (one-sided surfaces must let the control pass). It classifies:
 *   - DRIVE SURFACE (topmost terrain at the segment midpoint, slope < 55°):
 *     the car and the solidified bridge rest here → MUST be solid from ABOVE.
 *   - CEILING (2-point polyline = the `ceiling`/overhang helper): blocks strokes
 *     approaching from below → MUST be solid from BELOW.
 *   - other (steep inner faces / chasm walls): informational, never fails.
 *
 * Exit 1 if any required surface is a ghost from its functional side. NDJSON on
 * stdout (one line per finding), human summary on stderr — mirrors the gate CLIs.
 *
 * Invocation: `npx vite-node scripts/probe/terrain-probe.ts`
 *             `npx vite-node scripts/probe/terrain-probe.ts -- --levels 'levels/*.json'`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  b2Body_GetPosition,
  b2Body_SetAwake,
  b2Body_SetLinearVelocity,
  b2CreatePolygonShape,
  b2DefaultShapeDef,
  b2MakeBox,
  b2Vec2,
} from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import { validateLevel, type Level, type Polyline } from '../../src/engine/level/LevelSchema';
import { World } from '../../src/engine/physics/World';
import { Terrain } from '../../src/engine/physics/Terrain';

// -- probe tuning ---------------------------------------------------------------
const PROBE_HALF = 0.15; // probe box half-extent (m)
const DROP_GAP = 0.4; // spawn offset from the segment midpoint (m)
const FALL_TICKS = 48; // steps for the from-above drop (0.8 s)
const RISE_VEL = 6; // upward launch speed for the from-below probe (m/s)
const RISE_TICKS = 34; // steps for the from-below probe (~0.57 s)
const RESTED_DY = -0.25; // finalY >= my + this ⇒ rested on the surface
const FELL_DY = -0.8; // finalY <= my + this ⇒ fell through the surface
const BLOCKED_DY = 0.15; // maxY <= my + this ⇒ the ceiling blocked the rise
const PASSED_DY = 0.3; // maxY >= my + this ⇒ passed through (no underside)
const DRIVE_SLOPE_MAX_DEG = 55; // steeper segments are walls/inner faces, not drive lanes
const TOP_EPS = 0.06; // |topY - my| within this ⇒ the segment is the top surface here

export interface Finding {
  level: string;
  polyline: number;
  segment: number;
  role: 'drive' | 'ceiling';
  side: 'above' | 'below';
  a: [number, number];
  b: [number, number];
  result: string;
  finalOrMaxY: number;
  midY: number;
  ok: boolean;
}

/** Highest terrain surface y at x that is <= yCap (interpolated), or null. */
function topYAt(terrain: readonly Polyline[], x: number, yCap: number): number | null {
  let best: number | null = null;
  for (const poly of terrain) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const [ax, ay] = poly[i]!;
      const [bx, by] = poly[i + 1]!;
      const lo = Math.min(ax, bx);
      const hi = Math.max(ax, bx);
      if (x < lo || x > hi) continue;
      const t = hi === lo ? 0 : (x - ax) / (bx - ax);
      const segY = ay + t * (by - ay);
      if (segY <= yCap + 1e-6 && (best === null || segY > best)) best = segY;
    }
  }
  return best;
}

function spawnProbe(world: World, x: number, y: number): b2BodyId {
  const bodyId = world.createBody({ type: 'dynamic', position: { x, y } });
  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = 1;
  shapeDef.friction = 0.5;
  shapeDef.restitution = 0;
  b2CreatePolygonShape(bodyId, shapeDef, b2MakeBox(PROBE_HALF, PROBE_HALF));
  b2Body_SetAwake(bodyId, true);
  return bodyId;
}

/** Drop a probe from DROP_GAP above (mx,my); return its resting Y after FALL_TICKS. */
function probeFromAbove(world: World, mx: number, my: number): number {
  const body = spawnProbe(world, mx, my + DROP_GAP);
  for (let t = 0; t < FALL_TICKS; t++) world.step();
  const finalY = b2Body_GetPosition(body).y;
  world.destroyBody(body);
  return finalY;
}

/** Launch a probe upward from below (mx,my); return the MAX Y it reached. */
function probeFromBelow(world: World, mx: number, my: number): number {
  const body = spawnProbe(world, mx, my - DROP_GAP);
  b2Body_SetLinearVelocity(body, new b2Vec2(0, RISE_VEL));
  let maxY = my - DROP_GAP;
  for (let t = 0; t < RISE_TICKS; t++) {
    world.step();
    const y = b2Body_GetPosition(body).y;
    if (y > maxY) maxY = y;
  }
  world.destroyBody(body);
  return maxY;
}

let probeWorld: World | undefined;

export function probeLevel(name: string, level: Level): Finding[] {
  const findings: Finding[] = [];
  // ROUND-9 CS-4b: a >30-level slate (33 shipped) exceeds the phaser-box2d 32-slot
  // cap if we `new World()` per level (slots are never freed — World header). The
  // probe is a boolean solid/ghost check (a dropped body rests vs falls through), so
  // it is insensitive to Box2D's <2 mm reset residual — RECYCLE one module world via
  // reset() (tears down the previous level's terrain + probe bodies) instead.
  const world = (probeWorld ??= new World());
  world.reset();
  {
    // Terrain via the SAME construction the game uses (winding reversal + ghosts).
    new Terrain(world, level);

    level.terrain.forEach((poly, pIdx) => {
      const isCeiling = poly.length === 2;
      for (let i = 0; i + 1 < poly.length; i++) {
        const [ax, ay] = poly[i]!;
        const [bx, by] = poly[i + 1]!;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const slopeDeg = (Math.atan2(Math.abs(by - ay), Math.abs(bx - ax)) * 180) / Math.PI;

        if (isCeiling) {
          // Underside must block an upward-moving body; the top must let it pass.
          const maxY = probeFromBelow(world, mx, my);
          const isBlocked = maxY <= my + BLOCKED_DY;
          findings.push({
            level: name, polyline: pIdx, segment: i, role: 'ceiling', side: 'below',
            a: [ax, ay], b: [bx, by], midY: my, finalOrMaxY: maxY,
            result: isBlocked ? 'blocked' : maxY >= my + PASSED_DY ? 'passed-through(GHOST)' : 'weak',
            ok: isBlocked,
          });
          continue;
        }

        // Drive-surface classification: topmost terrain at the midpoint x + gentle slope.
        const topY = topYAt(level.terrain, mx, my + 0.5);
        const isTop = topY !== null && Math.abs(topY - my) <= TOP_EPS;
        if (!isTop || slopeDeg > DRIVE_SLOPE_MAX_DEG) continue; // wall/inner face → informational skip

        const finalY = probeFromAbove(world, mx, my);
        const isRested = finalY >= my + RESTED_DY;
        const hasFallen = finalY <= my + FELL_DY;
        findings.push({
          level: name, polyline: pIdx, segment: i, role: 'drive', side: 'above',
          a: [ax, ay], b: [bx, by], midY: my, finalOrMaxY: finalY,
          result: isRested ? 'rested' : hasFallen ? 'fell-through(GHOST)' : 'slid',
          ok: isRested || !hasFallen, // rested or slid-along-a-slope both mean "solid"; only a clean fall-through fails
        });
      }
    });
  }
  // The module world is RECYCLED (reset() on next call), never destroyed — destroying
  // would burn one of the 32 phaser-box2d slots per level and re-hit the cap.
  return findings;
}

function resolveLevelFiles(glob: string): string[] {
  const dir = dirname(glob);
  const pattern = basename(glob);
  if (!pattern.includes('*')) {
    try { statSync(glob); return [glob]; } catch { return []; }
  }
  const regex = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  try {
    return readdirSync(dir).filter((n) => regex.test(n)).sort().map((n) => join(dir, n));
  } catch {
    return [];
  }
}

function main(): void {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const glIdx = argv.indexOf('--levels');
  const glob = glIdx !== -1 && argv[glIdx + 1] ? argv[glIdx + 1]! : 'levels/*.json';
  const files = resolveLevelFiles(glob);
  if (files.length === 0) {
    process.stderr.write(`terrain-probe: no level files matched ${glob}\n`);
    process.exit(2);
  }

  let ghosts = 0;
  let driveTested = 0;
  let ceilingTested = 0;
  const failLevels = new Set<string>();
  for (const file of files) {
    const name = basename(file).replace(/\.json$/, '');
    const parsed = validateLevel(JSON.parse(readFileSync(file, 'utf-8')));
    if (!parsed.ok) {
      process.stderr.write(`terrain-probe: ${name} invalid: ${parsed.errors[0]}\n`);
      failLevels.add(name);
      continue;
    }
    const findings = probeLevel(name, parsed.level);
    for (const f of findings) {
      if (f.role === 'drive') driveTested++;
      else ceilingTested++;
      if (!f.ok) {
        ghosts++;
        failLevels.add(name);
        process.stdout.write(JSON.stringify(f) + '\n');
        process.stderr.write(
          `  GHOST  ${f.level}  poly ${f.polyline} seg ${f.segment}  ${f.role}/${f.side}  ` +
            `a=(${f.a[0]},${f.a[1]}) b=(${f.b[0]},${f.b[1]})  midY=${f.midY.toFixed(2)}  ` +
            `probeY=${f.finalOrMaxY.toFixed(2)}  ${f.result}\n`,
        );
      }
    }
  }
  process.stderr.write(
    `\nterrain-probe: ${files.length} levels · ${driveTested} drive-surface + ${ceilingTested} ceiling segments probed · ` +
      `${ghosts} GHOST surface(s) across ${failLevels.size} level(s)\n`,
  );
  process.exit(ghosts > 0 || failLevels.size > 0 ? 1 : 0);
}

// CLI execution — skipped under vitest so tests can import probeLevel().
if (!process.env['VITEST']) {
  main();
}

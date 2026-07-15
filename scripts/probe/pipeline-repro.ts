/**
 * pipeline-repro — headless model of the REAL input pipeline's stroke deviation.
 *
 * The gates commit the EXACT ghost polyline; the real game re-derives the stroke
 * from thinned pointer events (StrokeInput samples points ≥ minVertexDistancePx
 * apart along the drawn path, then commitStroke RDP-re-simplifies + resamples).
 * Net effect ≈ resampling the ghost at the thinning spacing before commit. The
 * campaign E2E showed ch1-l10 TIMES OUT (car stuck) through this path while it
 * clears headless — this script reproduces that headlessly so a fix can iterate
 * without the 2-minute browser loop. It replays each ghost re-sampled at a spread
 * of vertex spacings and reports the outcome + how far the car got.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';

/** Resample a polyline at ~`spacing` m arc-length (models StrokeInput thinning). */
function resampleAt(points: readonly Point[], spacing: number): Point[] {
  const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    acc += seg;
    if (acc >= spacing) {
      out.push({ x: b.x, y: b.y });
      acc = 0;
    }
  }
  const last = points[points.length - 1]!;
  const tail = out[out.length - 1]!;
  if (tail.x !== last.x || tail.y !== last.y) out.push({ x: last.x, y: last.y });
  return out;
}

const SPACINGS = [0, 0.12, 0.15, 0.18, 0.22, 0.28] as const; // 0 = exact ghost

function main(): void {
  const only = process.argv.slice(2).filter((a) => a !== '--');
  const files = readdirSync('levels')
    .filter((f) => f.endsWith('.json'))
    .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
    .sort();
  const world = new World();
  try {
    for (const f of files) {
      const parsed = validateLevel(JSON.parse(readFileSync(`levels/${f}`, 'utf-8')));
      if (!parsed.ok) continue;
      const level: Level = parsed.level;
      const ghost = level.ghostSolutions[0]!.stroke.map(([x, y]) => ({ x, y }));
      const flagX = level.goalFlag.x + level.goalFlag.width / 2;
      const parts = SPACINGS.map((sp) => {
        const stroke = sp === 0 ? ghost : resampleAt(ghost, sp);
        const r = runScriptedAttempt(level, stroke, { world });
        if (!r.committed) return `${sp}:discard`;
        const tag = r.outcome === 'clear' ? 'CLR' : (r.cause ?? 'fail').slice(0, 4);
        const dx = (r.finalPos.x - flagX).toFixed(1);
        return `${sp || 'exact'}:${tag}(t${r.ticks},Δflag${dx})`;
      });
      process.stdout.write(`${f.replace(/\.json$/, '').padEnd(9)} ${parts.join('  ')}\n`);
    }
  } finally {
    world.destroy();
  }
}

main();

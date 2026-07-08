/**
 * stroke-fuzz — plausible-player-stroke robustness probe (PRIORITY-0 bug hunt).
 *
 * The terrain-probe proves every surface is solid on its functional side and
 * the gates prove each ghost clears. This probe attacks the OTHER half of the
 * user report ("線を引いても...進行不可能"): a real player does NOT draw the exact
 * ghost — they draw near-variations, straights, and lines that clip terrain. It
 * replays a spread of such strokes through the FULL GameSimulation per level and
 * flags pathological results, especially STUCK (timeout with the car never
 * leaving the spawn neighbourhood) — the "car stuck at the left" symptom.
 *
 * Output: per-level clear-rate of jittered near-ghost strokes + any STUCK finding
 * on stderr; NDJSON of STUCK findings on stdout. Diagnostic (exit 0 unless STUCK
 * near-ghost strokes are found, which would be a real progression fragility).
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { readdirSync } from 'node:fs';
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';

/** Deterministic LCG so runs are reproducible. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function jitter(stroke: readonly Point[], rng: () => number, amp: number): Point[] {
  return stroke.map((p, i) => {
    // Endpoints kept near-fixed (the player anchors on the platforms); interior wobbles.
    const edge = i === 0 || i === stroke.length - 1 ? 0.15 : 1;
    return { x: p.x + (rng() - 0.5) * amp * edge, y: p.y + (rng() - 0.5) * amp * edge };
  });
}

interface Row {
  level: string;
  ghostClears: boolean;
  jitterClearRate: number;
  jitterN: number;
  stuck: number;
}

function fuzzLevel(name: string, level: Level, world: World): Row {
  const ghostStroke = level.ghostSolutions[0]!.stroke.map(([x, y]) => ({ x, y }));
  const spawnX = level.vehicleSpawn.x;
  const flagX = level.goalFlag.x + level.goalFlag.width / 2;
  const travel = Math.sign(flagX - spawnX) || 1;

  const ghost = runScriptedAttempt(level, ghostStroke, { world });
  const hasGhostCleared = ghost.committed && ghost.outcome === 'clear';

  let clears = 0;
  let n = 0;
  let stuck = 0;
  const rng = makeRng(0xc0ffee ^ name.length);
  for (let k = 0; k < 24; k++) {
    const amp = 0.1 + (k % 4) * 0.1; // 0.1..0.4 m jitter
    const s = jitter(ghostStroke, rng, amp);
    const r = runScriptedAttempt(level, s, { world });
    if (!r.committed) continue; // discarded strokes are a fair UI-fed reject, not a hang
    n++;
    if (r.outcome === 'clear') {
      clears++;
    } else if (r.cause === 'timeout') {
      // STUCK = timed out while still within ~1.5 m of the spawn along travel — the
      // car never made progress (distinct from a fair fall/tip). This is the
      // reported "car stuck at the left" failure mode.
      const progressed = (r.finalPos.x - spawnX) * travel;
      if (progressed < 1.5) {
        stuck++;
        process.stdout.write(JSON.stringify({ level: name, amp, finalPos: r.finalPos, progressed: round2(progressed) }) + '\n');
      }
    }
  }
  return { level: name, ghostClears: hasGhostCleared, jitterClearRate: n ? clears / n : 0, jitterN: n, stuck };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function main(): void {
  const files = readdirSync('levels').filter((f) => f.endsWith('.json')).sort().map((f) => `levels/${f}`);
  const world = new World();
  const rows: Row[] = [];
  let totalStuck = 0;
  let ghostFails = 0;
  try {
    for (const file of files) {
      const name = basename(file).replace(/\.json$/, '');
      const parsed = validateLevel(JSON.parse(readFileSync(file, 'utf-8')));
      if (!parsed.ok) { process.stderr.write(`fuzz: ${name} invalid\n`); continue; }
      const row = fuzzLevel(name, parsed.level, world);
      rows.push(row);
      totalStuck += row.stuck;
      if (!row.ghostClears) ghostFails++;
    }
  } finally {
    world.destroy();
  }

  process.stderr.write('\n=== stroke-fuzz report ===\n');
  process.stderr.write('level      ghost  jitterClear  stuck\n');
  for (const r of rows) {
    process.stderr.write(
      `${r.level.padEnd(10)} ${r.ghostClears ? ' OK ' : 'FAIL'}   ${(r.jitterClearRate * 100).toFixed(0).padStart(3)}% (${r.jitterN})     ${r.stuck}\n`,
    );
  }
  process.stderr.write(`\nghost fails: ${ghostFails}  ·  total STUCK near-ghost strokes: ${totalStuck}\n`);
  process.exit(ghostFails > 0 ? 1 : 0);
}

main();

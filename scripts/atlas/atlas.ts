/**
 * Level atlas builder library (round-4 deliverable B) — side-effect free.
 *
 * Renders ALL 18 Chapter-1 levels into ONE self-contained static HTML page
 * (.fable/atlas/index.html) so the PM can inspect, per level and in campaign
 * order: terrain, spawn car, goal flag, the intended STROKE, the driven
 * TRAJECTORY, and every coin's on-route placement + collection order. Each
 * level's route + coin collection is re-derived from the real engine so the page
 * reflects exactly what the coin gate proves.
 *
 * This module only EXPORTS buildAtlas() — the runnable entry is build-atlas.ts
 * (`npm run atlas`) and authoring.ts imports it for the optional `--atlas` flag.
 *
 * World budget: ONE recycled World for all 18 re-sims (phaser-box2d 32-slot cap,
 * World header) — reset per level, destroyed at the end.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Level, Point } from '../../src/engine/level/LevelSchema';
import { validateLevel } from '../../src/engine/level/LevelSchema';
import { collectCoinsAlongTrajectory, recordGhostTrajectory } from '../../src/engine/replay/GhostPlayer';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { World } from '../../src/engine/physics/World';
import { CH1_SOURCES } from '../levels/ch1';
import { CHAPTER1_MANIFEST } from '../levels/manifest';
import type { LevelSource } from '../levels/ch1';
import { renderLevelCard, type CardData, type RockPath } from './levelCard';

function polylineLength(pts: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Point;
    const b = pts[i] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function loadLevel(id: string, levelsDir: string): Level {
  const raw = readFileSync(join(levelsDir, `${id}.json`), 'utf-8');
  const parsed = validateLevel(JSON.parse(raw) as unknown, { filenameStem: id });
  if (!parsed.ok) {
    throw new Error(`atlas: ${id}.json failed validation:\n  - ${parsed.errors.join('\n  - ')}`);
  }
  return parsed.level;
}

/**
 * Re-drive the ghost through GameSimulation and record every rock's per-tick
 * centre — the falling/rolling arc the drawn line has to shield/deflect (the
 * point of the shield levels). Mirrors recordGhostTrajectory's harness but reads
 * the live RockHazard (renderRocks), which the trajectory recorder's onTick does
 * not expose. A classic rock spawns AT run start (post-settle) at its authored
 * position; a TRIGGERED rock stays ARMED at its spawn (renderState reports the
 * spawn pose while armed) until the car reaches triggerCarX, then falls — so the
 * recorded path shows the spawn dwell followed by the timed drop/roll. The first
 * sample is the spawn and the last is the final resting/exit point.
 * Deterministic + reuses the caller's recycled world (32-slot cap discipline).
 */
function recordRockPaths(level: Level, strokePts: readonly Point[], world: World): RockPath[] {
  if ((level.rocks ?? []).length === 0) return [];
  const simulation = new GameSimulation(level, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
    world,
  });
  try {
    const rocks = simulation.renderRocks;
    const count = rocks.count;
    const points: Point[][] = Array.from({ length: count }, () => []);
    const capture = (): void => {
      const states = rocks.renderState();
      for (let i = 0; i < count; i++) {
        const s = states[i];
        if (s !== undefined) points[i]?.push({ x: s.x, y: s.y });
      }
    };
    capture(); // spawn snapshot (run start, before the first step)
    const commit = simulation.commitStroke(strokePts);
    if (commit.committed) {
      let outcome = simulation.outcome;
      while (outcome === null) {
        outcome = simulation.step();
        capture();
      }
    }
    const radii = rocks.radii;
    return points.map((pts, i) => {
      const triggerCarX = level.rocks?.[i]?.triggerCarX;
      return {
        points: pts,
        radius: radii[i] ?? 0,
        ...(triggerCarX !== undefined ? { triggerCarX } : {}),
      };
    });
  } finally {
    simulation.destroy();
  }
}

/**
 * Re-drive the ghost and snapshot the SETTLED bridge-chain shape (capsule-centre
 * polyline read from the engine) at the CAR-LAUNCH tick and again at MID-CROSSING
 * (round-6 physical-truth atlas). The launch snapshot is the settled-but-unloaded
 * bridge — the physically-real "correct line" (it cannot lie inside solids); the
 * mid snapshot shows how far the car shoves it. Deterministic + reuses the
 * recycled world. Returns empty polylines when the stroke does not commit.
 */
function recordSettledChain(
  level: Level,
  strokePts: readonly Point[],
  world: World,
): { launch: Point[]; mid: Point[] } {
  const simulation = new GameSimulation(level, {
    upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
    world,
  });
  try {
    const commit = simulation.commitStroke(strokePts);
    if (!commit.committed) return { launch: [], mid: [] };
    // Launch tick: step through the anticipation countdown until the car starts
    // running, then snapshot the settled (unloaded) chain shape.
    let outcome = simulation.outcome;
    while (simulation.phase === 'anticipation' && outcome === null) {
      outcome = simulation.step();
    }
    const launch = simulation.renderChainPolyline();
    // Mid-crossing tick: step until the car reference point passes the midpoint
    // between spawn and goal (travel direction), then snapshot the shoved chain.
    const spawnX = level.vehicleSpawn.x;
    const goalX = level.goalFlag.x + level.goalFlag.width / 2;
    const midX = (spawnX + goalX) / 2;
    const travelSign = goalX >= spawnX ? 1 : -1;
    let mid: Point[] = [];
    while (outcome === null) {
      outcome = simulation.step();
      if (mid.length === 0 && (simulation.referencePoint().x - midX) * travelSign >= 0) {
        mid = simulation.renderChainPolyline();
      }
    }
    if (mid.length === 0) mid = simulation.renderChainPolyline(); // fallback: last shape
    return { launch, mid };
  } finally {
    simulation.destroy();
  }
}

/** Re-derive the primary ghost's driven route + coin collection order. */
function cardDataFor(level: Level, design: string, world: World): CardData {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    throw new Error(`atlas: ${level.id} has no ghost solution`);
  }
  const strokePts: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const recorded = recordGhostTrajectory(level, strokePts, world);
  // Fall back to the stored playback samples if the re-sim somehow discards.
  const trajectory: Point[] = recorded.committed
    ? recorded.trajectory.map((s) => ({ x: s.x, y: s.y }))
    : ghost.samples.map((s) => ({ x: s.x, y: s.y }));

  const collection = collectCoinsAlongTrajectory(
    recorded.committed ? recorded.trajectory : ghost.samples,
    level.coins,
  );
  const coinOrder: (number | null)[] = level.coins.map(() => null);
  collection.events.forEach((event, order) => {
    coinOrder[event.index] = order + 1;
  });

  const settled = recordSettledChain(level, strokePts, world);

  return {
    level,
    design,
    strokePts,
    settledChainLaunch: settled.launch,
    settledChainMid: settled.mid,
    trajectory,
    coinOrder,
    rockPaths: recordRockPaths(level, strokePts, world),
    strokeLen: polylineLength(strokePts),
    inkConsumed: ghost.result.inkConsumed,
  };
}

function legend(levelCount: number): string {
  return `<section class="legend">
  <h1>InkBridge — 全${levelCount}ステージ ルート&コイン アトラス</h1>
  <p>各ステージの「安定後の橋（描いた線が物理で落ち着いた本当の形）」「実走トラジェクトリ」「コインの配置と獲得順」を確認できます。実線は<b>描いた生ストロークではなく、エンジンで発進時に安定させた橋チェーンの形</b>です（安定後の橋は物理的に地面へ潜れないため、地面貫通の嘘が出ません）。薄い線は走行中に車へ押されてズレた同じ橋です。</p>
  <ul class="keys">
    <li><span class="sw car"></span>スタート車両</li>
    <li><span class="sw goal"></span>ゴール旗 / 判定ゾーン</li>
    <li><span class="sw ink"></span>安定後の橋（発進時の実形状＝正解の線）</li>
    <li><span class="sw shove"></span>押されズレ（走行中の橋の形）</li>
    <li><span class="sw traj"></span>走行路（車体中心の軌跡）</li>
    <li><span class="sw hazard"></span>危険地帯（触れると失敗・赤ハッチ）</li>
    <li><span class="sw coin"></span>コイン（番号=獲得順、全て金=100%回収）</li>
    <li><span class="sw miss"></span>未回収コイン（×印・本来ゼロ）</li>
    <li><span class="sw rockpath"></span>岩の軌道（○=開始位置 / 灰円=最終位置・矢印=進行方向）</li>
    <li><span class="tag ad">直線封じ</span>= anti-dominant（直線ではクリア不能）</li>
  </ul>
</section>`;
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
    background: #f4f1ea; color: #23201a; padding: 20px; }
  .legend { max-width: 1180px; margin: 0 auto 22px; background: #fff; border: 1px solid #e0d9c8;
    border-radius: 12px; padding: 18px 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .legend h1 { font-size: 20px; margin: 0 0 8px; }
  .legend p { font-size: 13px; line-height: 1.7; margin: 0 0 12px; color: #4a463d; }
  .keys { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0; padding: 0; font-size: 12.5px; }
  .keys li { display: flex; align-items: center; gap: 7px; }
  .sw { width: 20px; height: 12px; border-radius: 3px; display: inline-block; flex: 0 0 auto; }
  .sw.car { background: #1c6fb4; }
  .sw.goal { background: #2f9e44; }
  .sw.ink { background: #1f2d5a; height: 5px; border-radius: 3px; }
  .sw.shove { background: repeating-linear-gradient(90deg, #8a93c4 0 4px, transparent 4px 7px); height: 5px; }
  .sw.traj { background: repeating-linear-gradient(90deg, #f08c00 0 5px, transparent 5px 9px); height: 5px; }
  .sw.hazard { background: repeating-linear-gradient(45deg, #ff3b30 0 3px, #c42a24 3px 6px); opacity: 0.7; border: 1px solid #e0352b; }
  .sw.coin { background: #f5b301; border: 1px solid #a9760a; border-radius: 50%; width: 14px; height: 14px; }
  .sw.miss { background: #e03131; clip-path: polygon(20% 0,50% 30%,80% 0,100% 20%,70% 50%,100% 80%,80% 100%,50% 70%,20% 100%,0 80%,30% 50%,0 20%); }
  .sw.rockpath { background: repeating-linear-gradient(90deg, #6f6a78 0 2px, transparent 2px 6px); height: 5px; }
  .tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; font-weight: 700; }
  .tag.ad { background: #ffe3e3; color: #c92a2a; }
  .grid { max-width: 1180px; margin: 0 auto; display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px; }
  .card { background: #fff; border: 1px solid #e0d9c8; border-radius: 12px; padding: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
  .card-head h2 { font-size: 16px; margin: 0 0 3px; display: flex; align-items: center; gap: 8px; }
  .card-head .design { font-size: 11.5px; color: #6a655a; margin: 0 0 10px; line-height: 1.4; min-height: 30px; }
  svg.map { width: 100%; height: auto; max-height: 340px; background: #eaf2fb;
    border: 1px solid #dfe6ef; border-radius: 8px; display: block; }
  .stats { display: flex; flex-wrap: wrap; gap: 5px 12px; font-size: 11.5px; margin-top: 10px; color: #4a463d; }
  .stats b { color: #23201a; }
  .stats .coins.ok b { color: #2f9e44; }
  .stats .coins.bad b { color: #e03131; }
`;

/** Build the atlas HTML and write it to .fable/atlas/index.html. Returns the path. */
export function buildAtlas(projectRoot: string = process.cwd()): string {
  const levelsDir = join(projectRoot, 'levels');
  // Render in CAMPAIGN ORDER (scripts/levels/manifest.ts) — the ONE chapter slate
  // — restricted to slots that have BOTH an authoring source and a shipped JSON.
  // Today that is the shipped 18 in slate order; it auto-scales to 28 as content
  // lands, with no edit here.
  const sourceById = new Map<string, LevelSource>(CH1_SOURCES.map((src) => [src.id, src]));
  const orderedSources: LevelSource[] = CHAPTER1_MANIFEST.map((entry) => sourceById.get(entry.id)).filter(
    (src): src is LevelSource => src !== undefined && existsSync(join(levelsDir, `${src.id}.json`)),
  );

  const world = new World();
  let cards: string[];
  try {
    cards = orderedSources.map((src) => {
      const level = loadLevel(src.id, levelsDir);
      return renderLevelCard(cardDataFor(level, src.design, world));
    });
  } finally {
    world.destroy();
  }

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>InkBridge ルート&コイン アトラス</title>
<style>${STYLE}</style>
</head>
<body>
${legend(cards.length)}
<div class="grid">
${cards.join('\n')}
</div>
</body>
</html>
`;

  const outDir = join(projectRoot, '.fable', 'atlas');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'index.html');
  writeFileSync(outPath, html, 'utf-8');
  return outPath;
}

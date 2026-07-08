/**
 * Atlas level card — pure SVG renderer for ONE level (round-4 deliverable B).
 *
 * USER MANDATE: "各ステージの正解ルートとコイン獲得ルートをまとめてローカルの
 * ウェブで表示して見せて。コインの配置と車、ゴールの配置、想定ルートを私が全
 * ステージ確認する". Each card draws, in world coordinates (y-up, manually
 * flipped to SVG y-down so nothing — including text — is mirrored):
 *   - terrain (filled ground + rock lips / overhangs)
 *   - the killY line, the spawn car, the goal flag
 *   - the intended STROKE (ink polyline, thick)
 *   - the driven TRAJECTORY (dashed line through the recorded reference point)
 *   - coins (gold dots labelled with collection order; a red X marks any coin
 *     the route misses — after the T2 auto-placement there should be none)
 *
 * No external assets: every colour is inline, the SVG is embedded in the page.
 */

import type { Level, Point } from '../../src/engine/level/LevelSchema';

/**
 * One rock hazard's recorded MOTION over the ghost run (round-5 shield atlas).
 * `points[0]` is the authored spawn (run start, drawn hollow), the last point is
 * the final resting/exit position (drawn as the solid rock disc). The whole path
 * is the falling/rolling arc the drawn line has to shield or deflect.
 */
export interface RockPath {
  /** Per-tick centre positions (world m): first = spawn, last = final. */
  readonly points: readonly Point[];
  /** Rock radius (world m). */
  readonly radius: number;
}

export interface CardData {
  readonly level: Level;
  /** Archetype / design label from the level source. */
  readonly design: string;
  /** The intended ink stroke (primary ghost). */
  readonly strokePts: readonly Point[];
  /** The driven reference-point path (per-tick). */
  readonly trajectory: readonly Point[];
  /** Per-coin collection order (1-based) along the route, or null if missed. */
  readonly coinOrder: readonly (number | null)[];
  /** Per-rock recorded trajectory (same order as level.rocks; empty when none). */
  readonly rockPaths: readonly RockPath[];
  /** Raw stroke polyline length (m). */
  readonly strokeLen: number;
  /** Ink consumed by the primary ghost (m). */
  readonly inkConsumed: number;
}

const COLORS = {
  ground: '#d8c6a0',
  groundEdge: '#6f5a35',
  rockLip: '#7a6444',
  killY: '#e03131',
  carBody: '#1c6fb4',
  wheel: '#1a1a1a',
  goalZone: 'rgba(47,158,68,0.16)',
  goalPole: '#555',
  goalFlag: '#2f9e44',
  ink: '#1f2d5a',
  trajectory: '#f08c00',
  coin: '#f5b301',
  coinEdge: '#a9760a',
  coinLabel: '#3a2a00',
  coinMissed: '#e03131',
  rock: '#7b7683',
  rockEdge: '#3f3b46',
  rockLabel: '#f2f0f5',
  rockPath: '#6f6a78',
  rockArrow: '#403c48',
} as const;

function fmt(n: number): number {
  return Math.round(n * 1000) / 1000;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boundsOf(data: CardData): Bounds {
  const { level } = data;
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number): void => {
    xs.push(x);
    ys.push(y);
  };
  for (const line of level.terrain) {
    for (const [x, y] of line) add(x, y);
  }
  add(level.vehicleSpawn.x - 0.9, level.vehicleSpawn.y - 0.5);
  add(level.vehicleSpawn.x + 0.9, level.vehicleSpawn.y + 0.5);
  add(level.goalFlag.x, level.goalFlag.y);
  add(level.goalFlag.x + level.goalFlag.width, level.goalFlag.y + level.goalFlag.height);
  for (const c of level.coins) add(c.x, c.y);
  // Rock MOTION drives the shield levels: bound the full recorded arc (spawn ->
  // final) plus radius so neither the drop/roll path nor the discs get clipped.
  for (const rp of data.rockPaths) {
    for (const p of rp.points) {
      add(p.x - rp.radius, p.y - rp.radius);
      add(p.x + rp.radius, p.y + rp.radius);
    }
  }
  for (const p of data.strokePts) add(p.x, p.y);
  for (const p of data.trajectory) add(p.x, p.y);
  // killY is a required element; keep the drop visible but bounded so the deep
  // chasm never squashes the playfield (cap the shown depth 2.5 m below terrain).
  const lowestTerrain = Math.min(...level.terrain.flatMap((l) => l.map(([, y]) => y)));
  add(0, Math.max(level.killY, lowestTerrain - 2.5));
  const pad = 0.6;
  return {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minY: Math.min(...ys) - pad,
    maxY: Math.max(...ys) + pad,
  };
}

/** Build a coordinate projector (world y-up -> SVG y-down, no mirror). */
function projector(b: Bounds): (x: number, y: number) => [number, number] {
  return (x, y) => [fmt(x), fmt(b.maxY - y)];
}

function polyPoints(pts: readonly Point[], proj: (x: number, y: number) => [number, number]): string {
  return pts.map((p) => proj(p.x, p.y).join(',')).join(' ');
}

/** A terrain overhang: a short 2-point segment sitting high above the floor. */
function isCeiling(line: Level['terrain'][number], b: Bounds): boolean {
  if (line.length !== 2) return false;
  const lowestPointY = Math.min(...line.map(([, y]) => y));
  return lowestPointY > b.minY + 2;
}

function renderTerrain(data: CardData, b: Bounds, proj: (x: number, y: number) => [number, number]): string {
  const parts: string[] = [];
  for (const line of data.level.terrain) {
    if (isCeiling(line, b)) {
      // Rock lip / overhang: a thick underside bar, not filled ground.
      parts.push(
        `<polyline points="${polyPoints(
          line.map(([x, y]) => ({ x, y })),
          proj,
        )}" fill="none" stroke="${COLORS.rockLip}" stroke-width="0.34" stroke-linecap="round"/>`,
      );
      continue;
    }
    // Ground / obstacle: fill the surface polyline down to the view floor.
    const surface = line.map(([x, y]) => proj(x, y).join(','));
    const first = line[0] as readonly [number, number];
    const last = line[line.length - 1] as readonly [number, number];
    const floorY = fmt(b.maxY - b.minY);
    const poly = [...surface, `${fmt(last[0])},${floorY}`, `${fmt(first[0])},${floorY}`].join(' ');
    parts.push(`<polygon points="${poly}" fill="${COLORS.ground}" stroke="none"/>`);
    parts.push(
      `<polyline points="${polyPoints(
        line.map(([x, y]) => ({ x, y })),
        proj,
      )}" fill="none" stroke="${COLORS.groundEdge}" stroke-width="0.1" stroke-linejoin="round"/>`,
    );
  }
  return parts.join('\n');
}

function renderKillY(data: CardData, b: Bounds, proj: (x: number, y: number) => [number, number]): string {
  const [x1, y] = proj(b.minX, data.level.killY);
  const [x2] = proj(b.maxX, data.level.killY);
  if (data.level.killY < b.minY) return ''; // capped out of view
  return (
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${COLORS.killY}" stroke-width="0.07" ` +
    `stroke-dasharray="0.4 0.3" opacity="0.85"/>` +
    `<text x="${fmt(b.minX + 0.15)}" y="${fmt(y - 0.15)}" font-size="0.42" fill="${COLORS.killY}">killY</text>`
  );
}

function renderCar(data: CardData, proj: (x: number, y: number) => [number, number]): string {
  const s = data.level.vehicleSpawn;
  const [cx, cyTop] = proj(s.x - 0.75, s.y + 0.25);
  const [, wheelY] = proj(s.x, s.y - 0.28);
  const [rearX] = proj(s.x - 0.5, s.y);
  const [frontX] = proj(s.x + 0.5, s.y);
  return (
    `<rect x="${cx}" y="${cyTop}" width="1.5" height="0.5" rx="0.12" fill="${COLORS.carBody}" opacity="0.92"/>` +
    `<circle cx="${rearX}" cy="${wheelY}" r="0.22" fill="${COLORS.wheel}"/>` +
    `<circle cx="${frontX}" cy="${wheelY}" r="0.22" fill="${COLORS.wheel}"/>`
  );
}

function renderGoal(data: CardData, proj: (x: number, y: number) => [number, number]): string {
  const g = data.level.goalFlag;
  const [zx, zyTop] = proj(g.x, g.y + g.height);
  const [poleX, poleTop] = proj(g.x, g.y + g.height);
  const [, poleBottom] = proj(g.x, g.y);
  const [tipX, tipY] = proj(g.x + 0.9, g.y + g.height - 0.35);
  const [, flagBottomY] = proj(g.x, g.y + g.height - 0.7);
  return (
    `<rect x="${zx}" y="${zyTop}" width="${fmt(g.width)}" height="${fmt(g.height)}" fill="${COLORS.goalZone}" stroke="${COLORS.goalFlag}" stroke-width="0.04" stroke-dasharray="0.2 0.2"/>` +
    `<line x1="${poleX}" y1="${poleTop}" x2="${poleX}" y2="${poleBottom}" stroke="${COLORS.goalPole}" stroke-width="0.08"/>` +
    `<polygon points="${poleX},${poleTop} ${tipX},${tipY} ${poleX},${flagBottomY}" fill="${COLORS.goalFlag}"/>`
  );
}

function renderRoutes(data: CardData, proj: (x: number, y: number) => [number, number]): string {
  const parts: string[] = [];
  if (data.trajectory.length >= 2) {
    parts.push(
      `<polyline points="${polyPoints(data.trajectory, proj)}" fill="none" stroke="${COLORS.trajectory}" ` +
        `stroke-width="0.08" stroke-dasharray="0.28 0.2" stroke-linecap="round" opacity="0.9"/>`,
    );
  }
  if (data.strokePts.length >= 2) {
    parts.push(
      `<polyline points="${polyPoints(data.strokePts, proj)}" fill="none" stroke="${COLORS.ink}" ` +
        `stroke-width="0.13" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  return parts.join('\n');
}

/** Unit travel direction at the path end (last segment longer than eps), or null. */
function endDirection(pts: readonly Point[]): Point | null {
  const final = pts[pts.length - 1];
  if (final === undefined) return null;
  for (let i = pts.length - 2; i >= 0; i--) {
    const prev = pts[i];
    if (prev === undefined) continue;
    const dx = final.x - prev.x;
    const dy = final.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.12) return { x: dx / len, y: dy / len };
  }
  return null;
}

/** A small filled arrowhead poking out of the final disc along travel direction. */
function rockArrow(
  final: Point,
  dir: Point,
  radius: number,
  proj: (x: number, y: number) => [number, number],
): string {
  const base = radius + 0.02; // sit just outside the disc rim
  const len = 0.34;
  const wing = 0.19;
  const perp = { x: -dir.y, y: dir.x };
  const tip = { x: final.x + dir.x * (base + len), y: final.y + dir.y * (base + len) };
  const b1 = { x: final.x + dir.x * base + perp.x * wing, y: final.y + dir.y * base + perp.y * wing };
  const b2 = { x: final.x + dir.x * base - perp.x * wing, y: final.y + dir.y * base - perp.y * wing };
  const at = (p: Point): string => proj(p.x, p.y).join(',');
  return `<polygon points="${at(tip)} ${at(b1)} ${at(b2)}" fill="${COLORS.rockArrow}"/>`;
}

/**
 * Rock hazards: the recorded MOTION of each rock — a dotted grey polyline from
 * the spawn (hollow circle) through the fall/roll to its final position, an
 * arrowhead showing the exit direction, and the solid rock disc + 岩 label at
 * the final resting/exit point. This is the whole point of the shield levels:
 * the drawn line has to catch or deflect this arc.
 */
function renderRocks(data: CardData, proj: (x: number, y: number) => [number, number]): string {
  return data.rockPaths
    .map((rp) => {
      const pts = rp.points;
      const start = pts[0];
      const final = pts[pts.length - 1];
      if (start === undefined || final === undefined) return '';
      const parts: string[] = [];
      // Dotted grey path (falling/rolling arc).
      if (pts.length >= 2) {
        parts.push(
          `<polyline points="${polyPoints(pts, proj)}" fill="none" stroke="${COLORS.rockPath}" ` +
            `stroke-width="0.07" stroke-dasharray="0.04 0.2" stroke-linecap="round" opacity="0.9"/>`,
        );
      }
      // Hollow spawn marker.
      const [sx, sy] = proj(start.x, start.y);
      parts.push(
        `<circle cx="${sx}" cy="${sy}" r="${fmt(rp.radius)}" fill="none" stroke="${COLORS.rockPath}" ` +
          `stroke-width="0.06" stroke-dasharray="0.14 0.1" opacity="0.85"/>`,
      );
      // Exit-direction arrowhead (skip when the rock never really moved).
      const dir = endDirection(pts);
      if (dir !== null) parts.push(rockArrow(final, dir, rp.radius, proj));
      // Solid rock disc at the final resting/exit position + hazard label.
      const [fx, fy] = proj(final.x, final.y);
      const labelSize = Math.min(0.6, Math.max(0.28, rp.radius * 0.9));
      parts.push(
        `<circle cx="${fx}" cy="${fy}" r="${fmt(rp.radius)}" fill="${COLORS.rock}" stroke="${COLORS.rockEdge}" stroke-width="0.08"/>`,
      );
      parts.push(
        `<text x="${fx}" y="${fmt(fy + labelSize * 0.35)}" font-size="${fmt(labelSize)}" font-weight="700" text-anchor="middle" fill="${COLORS.rockLabel}">岩</text>`,
      );
      return parts.join('\n');
    })
    .join('\n');
}

function renderCoins(data: CardData, proj: (x: number, y: number) => [number, number]): string {
  return data.level.coins
    .map((c, i) => {
      const [x, y] = proj(c.x, c.y);
      const order = data.coinOrder[i];
      if (order === null || order === undefined) {
        // Missed coin — the failure the atlas exists to surface (should be none).
        return (
          `<g stroke="${COLORS.coinMissed}" stroke-width="0.12" stroke-linecap="round">` +
          `<line x1="${fmt(x - 0.22)}" y1="${fmt(y - 0.22)}" x2="${fmt(x + 0.22)}" y2="${fmt(y + 0.22)}"/>` +
          `<line x1="${fmt(x - 0.22)}" y1="${fmt(y + 0.22)}" x2="${fmt(x + 0.22)}" y2="${fmt(y - 0.22)}"/></g>`
        );
      }
      return (
        `<circle cx="${x}" cy="${y}" r="0.27" fill="${COLORS.coin}" stroke="${COLORS.coinEdge}" stroke-width="0.05"/>` +
        `<text x="${x}" y="${fmt(y + 0.14)}" font-size="0.36" font-weight="700" text-anchor="middle" fill="${COLORS.coinLabel}">${order}</text>`
      );
    })
    .join('\n');
}

/** Render the level's SVG map (no surrounding HTML). */
export function renderLevelSvg(data: CardData): string {
  const b = boundsOf(data);
  const proj = projector(b);
  const w = fmt(b.maxX - b.minX);
  const h = fmt(b.maxY - b.minY);
  const body = [
    renderTerrain(data, b, proj),
    renderKillY(data, b, proj),
    renderGoal(data, proj),
    renderRoutes(data, proj),
    renderRocks(data, proj),
    renderCar(data, proj),
    renderCoins(data, proj),
  ].join('\n');
  return (
    `<svg class="map" viewBox="${fmt(b.minX)} 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${data.level.id} route map">\n${body}\n</svg>`
  );
}

/** Render a full level card: header + SVG map + stats footer (日本語 labels). */
export function renderLevelCard(data: CardData): string {
  const { level } = data;
  const collected = data.coinOrder.filter((o) => o !== null).length;
  const total = level.coins.length;
  const bonus = level.bonusMultiplier !== undefined ? ` · ボーナス x${level.bonusMultiplier}` : '';
  const ad = level.gimmickTags.includes('anti-dominant') ? ' · <span class="tag ad">直線封じ</span>' : '';
  const coinClass = collected === total ? 'ok' : 'bad';
  return `<article class="card">
  <div class="card-head">
    <h2>${level.id}${ad}</h2>
    <p class="design">${escapeHtml(data.design)}</p>
  </div>
  ${renderLevelSvg(data)}
  <div class="stats">
    <span>インク予算 <b>${fmt(level.inkBudget)}</b></span>
    <span>消費 <b>${fmt(data.inkConsumed)}</b></span>
    <span>線長 <b>${fmt(data.strokeLen)}m</b></span>
    <span>★3 &lt;<b>${fmt(level.starThresholds.star3)}</b></span>
    <span>★2 &lt;<b>${fmt(level.starThresholds.star2)}</b></span>
    <span class="coins ${coinClass}">コイン <b>${collected}/${total}</b></span>${bonus ? `<span>${bonus}</span>` : ''}
  </div>
</article>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

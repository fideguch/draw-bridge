/**
 * Spike — round-8 feasibility sweep (designs/fun_cards_v6.md).
 *
 * Measures the "要スパイク測定" claims + codex CRITICAL physics hypotheses on the
 * REAL headless engine, player-faithful (GameSimulation.commitStroke lifecycle:
 * clip → solidify → anticipation settle → pre-drive settled baseline → motor run
 * → Judge), at Lv0 ink/speed (BR-004 canonical dynamics). LEVELS/GATES/ENGINE ARE
 * NOT TOUCHED — this builds SYNTHETIC levels matching each card's coordinates and
 * runs them; no levels/*.json is read or written.
 *
 * Run:
 *   npx vite-node scripts/spike/round8Feasibility.ts            # all sections
 *   npx vite-node scripts/spike/round8Feasibility.ts -- --json  # NDJSON rows
 *
 * WORLD BUDGET (phaser-box2d@1.1.0 leaks world slots, 32/process): this script
 * creates exactly ONE World and RECYCLES it for every attempt (GameSimulation
 * resets a passed-in world in its constructor and never destroys it), so it stays
 * at 1 slot no matter how many measurements run.
 *
 * IMPORT DISCIPLINE: scripts/gates/lazyLine.ts and lineDisplacement.ts run a
 * top-level `process.exit` on import outside vitest — so we DO NOT import them.
 * The two small helpers we need (surfaceAnchoredStroke, minInkLevelFor) are
 * re-implemented here verbatim from lazyLine.ts; rims.ts + patterns.ts are pure.
 */

import type { Level, Point, Polyline, Rock } from '../../src/engine/level/LevelSchema';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { arch, p, spline } from '../levels/patterns';
import { detectRims, straightCandidateStroke, topSolidSurfaceAt } from '../gates/rims';
import { economy } from '../../src/tuning/TuningConstants';

const isJsonMode = process.argv.includes('--json');

// ── ONE recycled world for the whole run (32-slot cap discipline) ───────────────
const world = new World();

// ── re-implemented lazy-line helpers (verbatim from scripts/gates/lazyLine.ts) ──
const LAZY_OVERLAP_M = 0.7;
const LAZY_SURFACE_LIFT_M = 0.06;
const LAZY_BOT_INK_CAPACITY_LV = economy.maxUpgradeLevel;

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** The screenshot lazy line: spawn-surface → goal-surface, lifted + overlapped. */
function surfaceAnchoredStroke(level: Level, overlap: number, offset: number): Point[] | null {
  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const spawnSurfaceY = topSolidSurfaceAt(level.terrain, level.vehicleSpawn.x);
  const goalSurfaceY = topSolidSurfaceAt(level.terrain, flagCenterX);
  if (spawnSurfaceY === null || goalSurfaceY === null) return null;
  const a: Point = { x: level.vehicleSpawn.x, y: spawnSurfaceY + LAZY_SURFACE_LIFT_M + offset };
  const b: Point = { x: flagCenterX, y: goalSurfaceY + LAZY_SURFACE_LIFT_M + offset };
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return null;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const aExt: Point = { x: a.x - ux * overlap, y: a.y - uy * overlap };
  const bExt: Point = { x: b.x + ux * overlap, y: b.y + uy * overlap };
  return [aExt, lerp(aExt, bExt, 1 / 3), lerp(aExt, bExt, 2 / 3), bExt];
}

function rawStrokeLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    total += Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);
  }
  return total;
}

/** Min ink-capacity level whose effective budget affords rawLength, else null. */
function minInkLevelFor(rawLength: number, levelInkBudget: number): number | null {
  for (let lv = 0; lv <= LAZY_BOT_INK_CAPACITY_LV; lv++) {
    if (rawLength <= levelInkBudget * (1 + (lv * economy.inkPerLevelPct) / 100)) return lv;
  }
  return null;
}

// ── synthetic level builder ─────────────────────────────────────────────────────

interface LevelSpec {
  readonly terrain: readonly Polyline[];
  readonly spawn: Point;
  readonly flag: Point; // flag surface anchor (x, surfaceY)
  readonly rocks?: readonly Rock[];
  readonly inkBudget?: number;
}

function pl(...pts: readonly Point[]): [number, number][] {
  return pts.map((q) => [q.x, q.y]);
}

/** twoPlatforms clone (independent left/right rim heights). */
function gap(leftFar: number, leftRim: number, leftY: number, rightRim: number, rightY: number, rightFar: number, chasmY: number): Polyline[] {
  return [
    [[leftFar, leftY], [leftRim, leftY], [leftRim - 0.2, chasmY]],
    [[rightRim + 0.2, chasmY], [rightRim, rightY], [rightFar, rightY]],
  ];
}

/** Narrow flat-top pillar (top solid). */
function pillar(cx: number, topY: number, chasmY: number, halfTop = 0.5, halfBase = 0.9): Polyline {
  return [[cx - halfBase, chasmY], [cx - halfTop, topY], [cx + halfTop, topY], [cx + halfBase, chasmY]];
}

function buildLevel(spec: LevelSpec): Level {
  const minTerrainY = Math.min(...spec.terrain.flatMap((line) => line.map(([, y]) => y)));
  const killY = minTerrainY - 3;
  return {
    schemaVersion: 1,
    id: 'ch1-l01', // schema-shaped placeholder — synthetic levels never hit Gate 0
    terrain: spec.terrain,
    vehicleSpawn: spec.spawn,
    goalFlag: { x: spec.flag.x, y: spec.flag.y, width: 1.2, height: 2.2 },
    killY,
    inkBudget: spec.inkBudget ?? 9999,
    starThresholds: { star2: 9000, star3: 8000 },
    coins: [],
    gimmickTags: [],
    ghostSolutions: [],
    ...(spec.rocks !== undefined ? { rocks: spec.rocks } : {}),
  };
}

// ── instrumented run (player-faithful commit path + per-tick observation) ───────

interface Obs {
  readonly committed: boolean;
  readonly reason?: string;
  readonly outcome?: 'clear' | 'fail';
  readonly cause?: string;
  readonly ticks: number;
  readonly clip: boolean;
  readonly fallback: boolean;
  readonly rockContact: boolean;
  readonly breakCount: number;
  /** lowest chain node y at any tick, whole chain. */
  readonly chainMinY: number;
  /** lowest chain node y within [pillarXMin,pillarXMax] across the run (S3). */
  readonly minYAtPillar: number;
  /** settled apex (max chain y) in the apex window at the pre-drive baseline (S1). */
  readonly settledApexY: number;
  /** min of (apex-window max y) across the driven run — apex droop (S1). */
  readonly drivenApexMinY: number;
  /** min car↔rock center distance while the rock is live (S2). */
  readonly minCarRockDist: number;
  readonly minCarRockTick: number;
  /** first tick the rock is no longer armed (spawned), else -1 (S2). */
  readonly rockLaunchTick: number;
  /** first tick the car reference-x reaches probeX, else -1 (S2). */
  readonly carProbeTick: number;
  readonly finalX: number;
}

interface InstrumentOpts {
  readonly upgrades?: { inkCapacityLv?: number; engineSpeedLv?: number };
  readonly pillarXMin?: number;
  readonly pillarXMax?: number;
  readonly apexXMin?: number;
  readonly apexXMax?: number;
  readonly carProbeX?: number;
}

function instrument(level: Level, strokePoints: readonly Point[], opts: InstrumentOpts = {}): Obs {
  const sim = new GameSimulation(level, { upgrades: opts.upgrades ?? { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  let breakCount = 0;
  sim.events.on('break', () => {
    breakCount++;
  });
  try {
    const commit = sim.commitStroke(strokePoints.map((q) => ({ x: q.x, y: q.y })));
    if (!commit.committed) {
      return blankObs(false, { reason: commit.reason, breakCount });
    }
    const pMin = opts.pillarXMin ?? Number.POSITIVE_INFINITY;
    const pMax = opts.pillarXMax ?? Number.NEGATIVE_INFINITY;
    const aMin = opts.apexXMin ?? -0.8;
    const aMax = opts.apexXMax ?? 0.8;
    let chainMinY = Number.POSITIVE_INFINITY;
    let minYAtPillar = Number.POSITIVE_INFINITY;
    let settledApexY = Number.NaN;
    let drivenApexMinY = Number.POSITIVE_INFINITY;
    let minDist = Number.POSITIVE_INFINITY;
    let minDistTick = -1;
    let launchTick = -1;
    let carProbeTick = -1;
    let out = sim.outcome;
    while (out === null) {
      out = sim.step();
      const t = sim.currentTick;
      // settled apex from the pre-drive baseline (captured at launchReleased).
      if (Number.isNaN(settledApexY)) {
        const settled = sim.preDriveSettledPolyline;
        if (settled !== null) {
          settledApexY = apexInWindow(settled, aMin, aMax);
        }
      }
      const chain = sim.renderChainPolyline();
      for (const n of chain) {
        if (n.y < chainMinY) chainMinY = n.y;
        if (n.x >= pMin && n.x <= pMax && n.y < minYAtPillar) minYAtPillar = n.y;
      }
      const apexNow = apexInWindow(chain, aMin, aMax);
      if (apexNow < drivenApexMinY) drivenApexMinY = apexNow;
      const car = sim.referencePoint();
      if (opts.carProbeX !== undefined && carProbeTick < 0 && car.x >= opts.carProbeX) carProbeTick = t;
      const rocks = sim.renderRocks.renderState();
      if (rocks.length > 0) {
        const r = rocks[0]!;
        if (!r.armed) {
          if (launchTick < 0) launchTick = t;
          const d = Math.hypot(car.x - r.x, car.y - r.y);
          if (d < minDist) {
            minDist = d;
            minDistTick = t;
          }
        }
      }
    }
    return {
      committed: true,
      outcome: out.outcome,
      ...(out.outcome === 'fail' ? { cause: out.cause } : {}),
      ticks: out.ticks,
      clip: commit.clipApplied,
      fallback: commit.usedFallback,
      rockContact: sim.rockContactObserved,
      breakCount,
      chainMinY,
      minYAtPillar,
      settledApexY,
      drivenApexMinY,
      minCarRockDist: minDist,
      minCarRockTick: minDistTick,
      rockLaunchTick: launchTick,
      carProbeTick,
      finalX: sim.referencePoint().x,
    };
  } finally {
    sim.destroy();
  }
}

function blankObs(committed: boolean, extra: Partial<Obs>): Obs {
  return {
    committed,
    ticks: 0,
    clip: false,
    fallback: false,
    rockContact: false,
    breakCount: 0,
    chainMinY: Number.NaN,
    minYAtPillar: Number.NaN,
    settledApexY: Number.NaN,
    drivenApexMinY: Number.NaN,
    minCarRockDist: Number.NaN,
    minCarRockTick: -1,
    rockLaunchTick: -1,
    carProbeTick: -1,
    finalX: Number.NaN,
    ...extra,
  };
}

function apexInWindow(poly: readonly Point[], xMin: number, xMax: number): number {
  let best = Number.NEGATIVE_INFINITY;
  for (const n of poly) {
    if (n.x >= xMin && n.x <= xMax && n.y > best) best = n.y;
  }
  return best === Number.NEGATIVE_INFINITY ? Number.NaN : best;
}

function verdict(o: Obs): string {
  if (!o.committed) return `no-commit(${o.reason})`;
  if (o.fallback) return `FALLBACK(unclipped)`;
  return `${o.outcome}${o.cause ? `/${o.cause}` : ''}`;
}

function num(n: number, d = 2): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

function printAligned(rows: readonly (readonly string[])[]): void {
  const widths: number[] = [];
  for (const row of rows) row.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, c.length)));
  for (const row of rows) console.log(row.map((c, i) => c.padEnd(widths[i] as number)).join('  '));
}

// ════════════════════════════════════════════════════════════════════════════════
// S0 — flat overlapped line self-support span limit (calibrates 張力限界 for ALL S1/S3)
// ════════════════════════════════════════════════════════════════════════════════

function runS0(): void {
  console.log('\n=== S0: flat overlapped line — self-support span limit (rims y0, valley -6, Lv0) ===');
  console.log('the span at which a FLAT lazy line stops self-supporting = the gap floor a level needs to defeat one');
  const header = ['span', 'verdict', 'ticks', 'breaks', 'chainMinY', 'apexSag'];
  const lines: string[][] = [];
  for (const span of [4.5, 5.0, 5.5, 6.0, 6.4, 7.0, 7.5]) {
    const half = span / 2;
    const level = buildLevel({ terrain: gap(-half - 6, -half, 0, half, 0, half + 6, -6), spawn: p(-half - 3, 0.35), flag: p(half + 3, 0) });
    const stroke = [p(-half - 0.7, 0.06), p(-half * 0.5, 0.06), p(half * 0.5, 0.06), p(half + 0.7, 0.06)];
    const o = instrument(level, stroke, { apexXMin: -1, apexXMax: 1 });
    const apexSag = Number.isFinite(o.settledApexY) && Number.isFinite(o.drivenApexMinY) ? o.settledApexY - o.drivenApexMinY : Number.NaN;
    lines.push([`${span}m`, verdict(o), String(o.ticks), String(o.breakCount), num(o.chainMinY), num(apexSag)]);
    if (isJsonMode) console.log(JSON.stringify({ section: 'S0', span, ...o }));
  }
  printAligned([header, ...lines]);
}

// ════════════════════════════════════════════════════════════════════════════════
// S1 — compression arch feasibility (codex CRITICAL-1)
// ════════════════════════════════════════════════════════════════════════════════

interface ArchCfg {
  readonly id: string;
  readonly lx: number;
  readonly ly: number;
  readonly rx: number;
  readonly ry: number;
  readonly bow: number;
  readonly valley: number;
  readonly note: string;
}

/** Arch stroke drawn WITH realistic platform overlap (unanchored chain needs it). */
function archWithOverlap(c: ArchCfg, bow: number, overlap = 0.8): Point[] {
  const core = arch(c.lx, c.ly, c.rx, c.ry, bow);
  return [p(c.lx - overlap, c.ly), ...core, p(c.rx + overlap, c.ry)];
}

function archLevel(c: ArchCfg): Level {
  const leftSurf = c.ly - 0.06;
  const rightSurf = c.ry - 0.06;
  return buildLevel({
    terrain: gap(c.lx - 6, c.lx, leftSurf, c.rx, rightSurf, c.rx + 6, c.valley),
    spawn: p(c.lx - 3, leftSurf + 0.35),
    flag: p(c.rx + 3, rightSurf),
  });
}

const S1_CONFIGS: readonly ArchCfg[] = [
  { id: 'l03', lx: -3.2, ly: 0.04, rx: 3.2, ry: 0.04, bow: 0.42, valley: -5.5, note: 'span6.4 shallow arch' },
  { id: 'l04', lx: -3.0, ly: 0.78, rx: 3.0, ry: 0.78, bow: 0.5, valley: -3.4, note: 'span6.0 spike-floor' },
  { id: 'l08', lx: -3.7, ly: 0.92, rx: 3.7, ry: 0.92, bow: 1.0, valley: -4.6, note: 'span7.4 ARCH_EXEMPT' },
  { id: 'l15', lx: -3.0, ly: 0.42, rx: 3.0, ry: 0.42, bow: 1.0, valley: -5.2, note: 'span6.0 twin-valley' },
  { id: 'l20', lx: -3.4, ly: 2.2, rx: 3.4, ry: 2.2, bow: 0.9, valley: -6.8, note: 'span6.8 dish-arch' },
  { id: 'b1', lx: -2.2, ly: 0.42, rx: 2.4, ry: 0.22, bow: 1.45, valley: -4.4, note: 'span4.6 bow1.45 asym' },
  // control: shipped, working l16 dome (span 7.2) — calibrates the rig.
  { id: 'l16*', lx: -3.6, ly: 1.02, rx: 3.6, ry: 1.02, bow: 1.35, valley: -5.6, note: 'CONTROL shipped dome' },
];

interface ArchRow {
  readonly cfg: ArchCfg;
  readonly bow: number;
  readonly obs: Obs;
}

function runS1(): ArchRow[] {
  const rows: ArchRow[] = [];
  for (const c of S1_CONFIGS) {
    const level = archLevel(c);
    for (const bow of [c.bow - 0.15, c.bow, c.bow + 0.15]) {
      const obs = instrument(level, archWithOverlap(c, bow), { apexXMin: -1.0, apexXMax: 1.0 });
      rows.push({ cfg: c, bow, obs });
    }
  }
  return rows;
}

function runS1L23(): ArchRow[] {
  // l23 M-字 sag (二山sag): two humps over a valley, dips to 1.02 at center.
  const ctrl = [p(-3.1, 0.82), p(-1.3, 1.42), p(0, 1.02), p(1.3, 1.42), p(3.1, 0.82)];
  const level = buildLevel({
    terrain: gap(-9, -3.1, 0.76, 3.1, 0.76, 9, -6.0),
    spawn: p(-6, 1.1),
    flag: p(6, 0.76),
  });
  const cfg: ArchCfg = { id: 'l23', lx: -3.1, ly: 0.82, rx: 3.1, ry: 0.82, bow: 0.6, valley: -6.0, note: 'span6.2 M-sag' };
  // sweep the center dip: shallower/base/deeper M.
  const rows: ArchRow[] = [];
  for (const dip of [0.85, 1.02, 1.19]) {
    const ctrlD = ctrl.map((q, i) => (i === 2 ? p(0, dip) : q));
    const stroke = [p(-3.9, 0.82), ...spline(ctrlD), p(3.9, 0.82)];
    rows.push({ cfg: { ...cfg, bow: dip }, bow: dip, obs: instrument(level, stroke, { apexXMin: -0.5, apexXMax: 0.5 }) });
  }
  return rows;
}

function reportS1(rows: readonly ArchRow[]): void {
  console.log('\n=== S1: compression-arch feasibility (span×bow sweep, Lv0, overlap 0.8m) ===');
  const header = ['id', 'note', 'bow', 'verdict', 'ticks', 'breaks', 'settledApex', 'drivenApexMin', 'apexSag', 'chainMinY'];
  const lines = rows.map((r) => {
    const o = r.obs;
    const apexSag = Number.isFinite(o.settledApexY) && Number.isFinite(o.drivenApexMinY) ? o.settledApexY - o.drivenApexMinY : Number.NaN;
    return [
      r.cfg.id,
      r.cfg.note,
      num(r.bow),
      verdict(o),
      String(o.ticks),
      String(o.breakCount),
      num(o.settledApexY),
      num(o.drivenApexMinY),
      num(apexSag),
      num(o.chainMinY),
    ];
  });
  printAligned([header, ...lines]);
  if (isJsonMode) rows.forEach((r) => console.log(JSON.stringify({ section: 'S1', id: r.cfg.id, bow: r.bow, ...r.obs })));
}

// ════════════════════════════════════════════════════════════════════════════════
// S2 — rolling-rock timing window (codex CRITICAL-2)
// ════════════════════════════════════════════════════════════════════════════════

interface RockScene {
  readonly id: string;
  readonly terrain: readonly Polyline[];
  readonly spawn: Point;
  readonly flag: Point;
  readonly rocks: readonly Rock[];
  readonly probeX: number; // the danger x whose car-arrival we time
  /** Overhead-drop height for the drop+trigger fallback variant (card §S2 fallback). */
  readonly dropY: number;
  readonly strokes: readonly { readonly tag: string; readonly points: Point[] }[];
}

function levelOf(s: RockScene, rocks: readonly Rock[] | undefined): Level {
  return buildLevel({ terrain: s.terrain, spawn: s.spawn, flag: s.flag, ...(rocks !== undefined ? { rocks } : {}) });
}

function buildS2(): RockScene[] {
  const scenes: RockScene[] = [];

  // l06 — climb + mid-pillar + rolling rock into the valley lane. 谷5.4 右棚+1.4.
  {
    const terrain = [...gap(-8, -2.7, 0.4, 2.7, 1.4, 8, -5.2), pillar(0, -0.4, -5.2, 0.5, 0.9)];
    const noRockLevel = buildLevel({ terrain, spawn: p(-5, 0.75), flag: p(5, 1.4) });
    scenes.push({
      id: 'l06',
      terrain,
      spawn: p(-5, 0.75),
      flag: p(5, 1.4),
      rocks: [{ x: 2.4, y: -1.9, radius: 0.5, initialVelocity: { x: -1.2, y: 0 }, triggerCarX: -0.5 }],
      probeX: 2.4,
      dropY: 2.2,
      strokes: [
        { tag: 'naive-sg', points: surfaceAnchoredStroke(noRockLevel, LAZY_OVERLAP_M, 0) ?? [] },
        { tag: 'sol1-hook', points: spline([p(-2.7, 0.4), p(-1.3, -0.15), p(0, -0.4), p(1.2, 0.2), p(2.7, 1.4)]) },
        { tag: 'sol2-arch', points: arch(-2.7, 0.42, 2.7, 1.4, 0.45) },
      ],
    });
  }

  // l13 — deep valley + mid-pillar, then two-step climb to a high goal; rock drops
  // onto the step when the car reaches x≈2.9 (drop, no initial velocity).
  {
    const terrain: Polyline[] = [
      [[-9, 0.4], [-2.7, 0.4], [-2.5, -5.0]],
      pillar(0, 0.08, -5.0, 0.5, 0.9),
      [[2.5, -5.0], [2.7, 0.4], [3.9, 0.4], [4.1, 0.9], [5.3, 0.9], [5.5, 1.6], [9, 1.6]],
    ];
    const noRockLevel = buildLevel({ terrain, spawn: p(-5, 0.75), flag: p(7, 1.6) });
    scenes.push({
      id: 'l13',
      terrain,
      spawn: p(-5, 0.75),
      flag: p(7, 1.6),
      rocks: [{ x: 4.5, y: 2.2, radius: 0.5, triggerCarX: 2.9 }],
      probeX: 4.5,
      dropY: 3.0,
      strokes: [
        { tag: 'naive-sg', points: surfaceAnchoredStroke(noRockLevel, LAZY_OVERLAP_M, 0) ?? [] },
        { tag: 'sol1-sag', points: spline([p(-2.7, 0.4), p(0, 0.08), p(2.7, 0.4)]) },
        { tag: 'sol2-arch', points: arch(-2.7, 0.42, 2.7, 0.42, 0.2) },
      ],
    });
  }

  // l14 — deep valley crossing to a long upper deck, high far goal; rock triggers
  // when the car reaches the deck (x≈2.7) and rolls left toward the near edge.
  {
    const terrain: Polyline[] = [
      [[-9, 0.4], [-2.7, 0.4], [-2.5, -5.0]],
      pillar(0, 0.08, -5.0, 0.5, 0.9),
      [[2.5, -5.0], [2.7, 0.4], [9, 0.4]],
    ];
    const noRockLevel = buildLevel({ terrain, spawn: p(-5, 0.75), flag: p(6.5, 0.4) });
    scenes.push({
      id: 'l14',
      terrain,
      spawn: p(-5, 0.75),
      flag: p(6.5, 0.4),
      rocks: [{ x: 2.2, y: -1.95, radius: 0.5, initialVelocity: { x: -1.5, y: 0 }, triggerCarX: 2.7 }],
      probeX: 2.7,
      dropY: 2.2,
      strokes: [
        { tag: 'naive-sg', points: surfaceAnchoredStroke(noRockLevel, LAZY_OVERLAP_M, 0) ?? [] },
        { tag: 'sol1-sag', points: spline([p(-2.7, 0.4), p(0, 0.08), p(2.7, 0.4)]) },
        { tag: 'sol2-trap', points: spline([p(-2.7, 0.4), p(-1.3, 0.28), p(0, 0.2), p(1.3, 0.28), p(2.7, 0.4)]) },
      ],
    });
  }

  // l20 — deep valley, tall central island (top 1.05); rock rolls the island's back
  // (lane y≈1.5) leftward when the car mounts the island (x≈0). 谷6.8.
  {
    const terrain = [...gap(-9, -3.4, 2.2, 3.4, 2.2, 9, -6.8), pillar(0, 1.05, -6.8, 0.6, 1.2)];
    const noRockLevel = buildLevel({ terrain, spawn: p(-6, 2.55), flag: p(6, 2.2) });
    scenes.push({
      id: 'l20',
      terrain,
      spawn: p(-6, 2.55),
      flag: p(6, 2.2),
      rocks: [{ x: 2.6, y: 1.5, radius: 0.5, initialVelocity: { x: -2.2, y: 0 }, triggerCarX: 0 }],
      probeX: 0,
      dropY: 3.4,
      strokes: [
        { tag: 'naive-sg', points: surfaceAnchoredStroke(noRockLevel, LAZY_OVERLAP_M, 0) ?? [] },
        { tag: 'sol1-sag', points: spline([p(-3.4, 2.2), p(-1.8, 1.35), p(0, 1.05), p(1.8, 1.35), p(3.4, 2.2)]) },
        { tag: 'sol2-arch', points: arch(-3.4, 2.2, 3.4, 2.2, 0.9) },
      ],
    });
  }

  return scenes;
}

function reportS2(scenes: readonly RockScene[]): void {
  console.log('\n=== S2: rolling-rock timing window (naive vs declared solutions, Lv0) ===');
  console.log('noRock = same stroke, rock removed (attributes failure: rock vs terrain-repro). rockHit = live rock touched car/bridge.');
  console.log('minDist = closest car↔rock centre distance (m); launchT = rock spawn tick; carT@probe = car reaches danger x.');
  const header = ['id', 'stroke', 'verdict(rock)', 'noRock', 'ticks', 'rockHit', 'launchT', 'minDist', 'minDistT', 'carT@probe'];
  const lines: string[][] = [];
  for (const s of scenes) {
    const rocked = levelOf(s, s.rocks);
    const bare = levelOf(s, undefined);
    for (const st of s.strokes) {
      const o = instrument(rocked, st.points, { carProbeX: s.probeX });
      const ctrl = instrument(bare, st.points, {});
      lines.push([
        s.id,
        st.tag,
        verdict(o),
        verdict(ctrl),
        String(o.ticks),
        o.rockContact ? 'YES' : 'no',
        String(o.rockLaunchTick),
        num(o.minCarRockDist),
        String(o.minCarRockTick),
        String(o.carProbeTick),
      ]);
      if (isJsonMode) console.log(JSON.stringify({ section: 'S2', id: s.id, stroke: st.tag, rock: o, noRock: verdict(ctrl) }));
    }
    lines.push(new Array(header.length).fill(''));
  }
  printAligned([header, ...lines]);
}

/**
 * S2b — the card's FALLBACK: replace the rolling rock with an OVERHEAD DROP
 * (triggerCarX = danger x, rock spawned directly above the car's arrival, no
 * initial velocity). A clean drop should hit the naive/first-intended line the
 * instant the car is under it. Tests whether drop+trigger creates a genuine
 * "car present ⇒ hit" interception the rolling variant failed to produce.
 */
function reportS2Drop(scenes: readonly RockScene[]): void {
  console.log('\n=== S2b: drop+trigger fallback (overhead drop at car arrival) ===');
  const header = ['id', 'stroke', 'verdict', 'ticks', 'rockHit', 'launchT', 'minDist', 'minDistT', 'carT@probe'];
  const lines: string[][] = [];
  for (const s of scenes) {
    const dropRock: Rock = { x: s.probeX, y: s.dropY, radius: 0.5, triggerCarX: s.probeX };
    const dropLevel = levelOf(s, [dropRock]);
    for (const st of s.strokes.slice(0, 2)) {
      const o = instrument(dropLevel, st.points, { carProbeX: s.probeX });
      lines.push([
        s.id,
        st.tag,
        verdict(o),
        String(o.ticks),
        o.rockContact ? 'YES' : 'no',
        String(o.rockLaunchTick),
        num(o.minCarRockDist),
        String(o.minCarRockTick),
        String(o.carProbeTick),
      ]);
      if (isJsonMode) console.log(JSON.stringify({ section: 'S2b', id: s.id, stroke: st.tag, ...o }));
    }
    lines.push(new Array(header.length).fill(''));
  }
  printAligned([header, ...lines]);
}

// ════════════════════════════════════════════════════════════════════════════════
// S3 — pillar-biting life/death difference (codex MEDIUM-6)
// ════════════════════════════════════════════════════════════════════════════════

interface PillarScene {
  readonly id: string;
  readonly level: Level;
  readonly pillarTopY: number;
  readonly pillarXMin: number;
  readonly pillarXMax: number;
  readonly intended: { readonly tag: string; readonly points: Point[] };
}

function buildS3(): PillarScene[] {
  const scenes: PillarScene[] = [];

  // l05 — mid-pillar top -0.5 (rim y0.4 → 0.9m below rim). 谷5.6. rock on ledge.
  {
    const terrain = [...gap(-8, -2.8, 0.4, 2.8, 0.4, 8, -5.6), pillar(0, -0.5, -5.6, 0.5, 0.9)];
    const level = buildLevel({
      terrain,
      spawn: p(-5, 0.75),
      flag: p(5, 0.4),
      rocks: [{ x: 1.6, y: -2.4, radius: 0.5 }],
    });
    scenes.push({
      id: 'l05',
      level,
      pillarTopY: -0.5,
      pillarXMin: -0.5,
      pillarXMax: 0.5,
      intended: { tag: 'sag-deepV', points: spline([p(-2.8, 0.4), p(-1.4, -0.2), p(0, -0.5), p(1.4, -0.2), p(2.8, 0.4)]) },
    });
  }

  // l18 — mid-pillar top 0.68 over a DEEP pit (-8.0); high-left → low-right descent.
  {
    const terrain: Polyline[] = [
      [[-9, 1.4], [-2.7, 1.4], [-2.5, -8.0]],
      pillar(0, 0.68, -8.0, 0.5, 0.9),
      [[2.5, -8.0], [2.7, 0.2], [9, 0.2]],
    ];
    const level = buildLevel({
      terrain,
      spawn: p(-5, 1.75),
      flag: p(6, 0.2),
      rocks: [{ x: -1.7, y: -7.55, radius: 0.5 }],
    });
    scenes.push({
      id: 'l18',
      level,
      pillarTopY: 0.68,
      pillarXMin: -0.5,
      pillarXMax: 0.5,
      intended: { tag: 'sag-descent', points: spline([p(-2.7, 1.42), p(-1.35, 0.94), p(0, 0.68), p(1.35, 0.46), p(2.7, 0.22)]) },
    });
  }

  return scenes;
}

function reportS3(scenes: readonly PillarScene[]): void {
  console.log('\n=== S3: pillar-biting — lazy natural sag vs intended deep-sag reach ===');
  console.log('minYAtPillar = lowest chain node y within the pillar x-window over the run; pillarTop = support height');
  const header = ['id', 'stroke', 'verdict', 'ticks', 'clip', 'pillarTop', 'minYAtPillar', 'gapToPillar', 'reaches?'];
  const lines: string[][] = [];
  for (const s of scenes) {
    const rims = detectRims(s.level);
    const lazyStrokes: { tag: string; points: Point[] }[] = [];
    if (rims) {
      lazyStrokes.push({ tag: 'lazy-rimExact', points: straightCandidateStroke(s.level, rims, 0, 0) });
      lazyStrokes.push({ tag: 'lazy-rimOver', points: straightCandidateStroke(s.level, rims, LAZY_OVERLAP_M, 0) });
      lazyStrokes.push({ tag: 'lazy-high', points: straightCandidateStroke(s.level, rims, LAZY_OVERLAP_M, 0.5) });
      lazyStrokes.push({ tag: 'lazy-low', points: straightCandidateStroke(s.level, rims, LAZY_OVERLAP_M, -0.5) });
    }
    const sg = surfaceAnchoredStroke(s.level, LAZY_OVERLAP_M, 0);
    if (sg) lazyStrokes.push({ tag: 'lazy-spawnGoal', points: sg });
    const sgh = surfaceAnchoredStroke(s.level, LAZY_OVERLAP_M, 0.5);
    if (sgh) lazyStrokes.push({ tag: 'lazy-sgHigh', points: sgh });
    const all = [...lazyStrokes, s.intended];
    for (const st of all) {
      const o = instrument(s.level, st.points, { pillarXMin: s.pillarXMin, pillarXMax: s.pillarXMax });
      const gapTo = Number.isFinite(o.minYAtPillar) ? o.minYAtPillar - s.pillarTopY : Number.NaN;
      const reaches = Number.isFinite(gapTo) ? (gapTo <= 0.12 ? 'YES' : 'no') : '—';
      lines.push([
        s.id,
        st.tag,
        verdict(o),
        String(o.ticks),
        o.clip ? 'clip' : '-',
        num(s.pillarTopY),
        num(o.minYAtPillar),
        num(gapTo),
        reaches,
      ]);
      if (isJsonMode) console.log(JSON.stringify({ section: 'S3', id: s.id, stroke: st.tag, pillarTop: s.pillarTopY, ...o }));
    }
    lines.push(['', '', '', '', '', '', '', '', '']);
  }
  printAligned([header, ...lines]);
}

// ════════════════════════════════════════════════════════════════════════════════
// S4 — ink-budget kill margin (codex HIGH-4)
// ════════════════════════════════════════════════════════════════════════════════

const FEEL_FACTOR = { generous: 3.0, standard: 2.5, tight: 2.0 } as const;

interface InkScene {
  readonly id: string;
  readonly level: Level;
  readonly feel: keyof typeof FEEL_FACTOR;
  readonly solutions: readonly { readonly tag: string; readonly points: Point[] }[];
}

function buildS4(): InkScene[] {
  const scenes: InkScene[] = [];

  // l07 — long descent, narrow (4.2m) valley, tight budget. spawn→goal course ~13m.
  {
    const terrain: Polyline[] = [
      [[-9, 1.4], [-2.1, 1.4], [-1.9, -4.6]],
      pillar(0, 0.0, -4.6, 0.5, 0.9),
      [[1.9, -4.6], [2.1, -0.4], [9, -0.4]],
    ];
    const level = buildLevel({ terrain, spawn: p(-7, 1.75), flag: p(7, -0.4) });
    scenes.push({
      id: 'l07',
      level,
      feel: 'tight',
      solutions: [
        { tag: 'ramp', points: spline([p(-2.1, 1.4), p(-0.7, 0.5), p(0.7, -0.1), p(2.1, -0.4)]) },
        { tag: 'trapezoid', points: spline([p(-2.1, 1.4), p(-1.0, 0.55), p(1.0, 0.0), p(2.1, -0.4)]) },
      ],
    });
  }

  // l18 — deep pit descent (same geometry as S3-l18). tight budget.
  {
    const terrain: Polyline[] = [
      [[-9, 1.4], [-2.7, 1.4], [-2.5, -8.0]],
      pillar(0, 0.68, -8.0, 0.5, 0.9),
      [[2.5, -8.0], [2.7, 0.2], [9, 0.2]],
    ];
    const level = buildLevel({ terrain, spawn: p(-5, 1.75), flag: p(6, 0.2) });
    scenes.push({
      id: 'l18',
      level,
      feel: 'tight',
      solutions: [
        { tag: 'sag', points: spline([p(-2.7, 1.42), p(-1.35, 0.94), p(0, 0.68), p(1.35, 0.46), p(2.7, 0.22)]) },
        { tag: 'trapezoid', points: spline([p(-2.7, 1.42), p(-0.8, 0.68), p(0.8, 0.66), p(2.7, 0.22)]) },
      ],
    });
  }

  return scenes;
}

function reportS4(scenes: readonly InkScene[]): void {
  console.log('\n=== S4: ink-budget kill margin (spawn-goal vs budget×1.5) ===');
  console.log('tightInk = min solution ink; budget = max(feel×tightInk, maxRaw×1.08, star2×1.1); kill needs spawnGoalRaw > budget×1.5');
  const header = ['id', 'feel', 'sol-inks', 'tightInk', 'maxRaw', 'budget', 'budget×1.5', 'spawnGoalRaw', 'killMargin', 'sgMinInkLv', 'kill?'];
  const lines: string[][] = [];
  for (const s of scenes) {
    const inks: number[] = [];
    const raws: number[] = [];
    const solInkStrs: string[] = [];
    for (const sol of s.solutions) {
      const r = runScriptedAttempt(s.level, sol.points, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
      const rawLen = rawStrokeLength(sol.points);
      raws.push(rawLen);
      if (r.committed && r.outcome === 'clear') {
        inks.push(r.inkConsumed);
        solInkStrs.push(`${sol.tag}=${r.inkConsumed.toFixed(2)}`);
      } else {
        solInkStrs.push(`${sol.tag}=${r.committed ? `FAIL(${r.committed && r.outcome === 'fail' ? r.cause : '?'})` : `nc(${(r as { reason?: string }).reason})`}`);
      }
      if (isJsonMode) console.log(JSON.stringify({ section: 'S4', id: s.id, stroke: sol.tag, committed: r.committed, outcome: r.committed ? r.outcome : null, ink: r.committed && r.outcome === 'clear' ? r.inkConsumed : null, rawLen }));
    }
    const tightInk = inks.length > 0 ? Math.min(...inks) : Number.NaN;
    const maxRaw = Math.max(...raws);
    const star2 = tightInk * 1.35;
    const budget = Number.isFinite(tightInk)
      ? Math.max(tightInk * FEEL_FACTOR[s.feel], maxRaw * 1.08, star2 * 1.1)
      : Number.NaN;
    const sg = surfaceAnchoredStroke(s.level, LAZY_OVERLAP_M, 0);
    const sgRaw = sg ? rawStrokeLength(sg) : Number.NaN;
    const budget15 = budget * 1.5;
    const killMargin = sgRaw - budget15;
    const sgMinInkLv = Number.isFinite(sgRaw) && Number.isFinite(budget) ? minInkLevelFor(sgRaw, budget) : null;
    lines.push([
      s.id,
      s.feel,
      solInkStrs.join(' '),
      num(tightInk),
      num(maxRaw),
      num(budget),
      num(budget15),
      num(sgRaw),
      num(killMargin),
      sgMinInkLv === null ? 'null' : String(sgMinInkLv),
      sgMinInkLv === null ? 'YES(killed)' : `no(@Lv${sgMinInkLv})`,
    ]);
  }
  printAligned([header, ...lines]);
}

// ════════════════════════════════════════════════════════════════════════════════

function main(): void {
  console.log(`spike round-8 feasibility — node ${process.version}, ONE recycled world, Lv0 player-faithful`);
  try {
    runS0();
    reportS1([...runS1(), ...runS1L23()]);
    const s2 = buildS2();
    reportS2(s2);
    reportS2Drop(s2);
    reportS3(buildS3());
    reportS4(buildS4());
  } finally {
    world.destroy();
  }
  console.log('\nDONE');
}

main();

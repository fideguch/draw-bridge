/**
 * Levels-as-code authoring pipeline (T086-T088).
 *
 * Declarative per-level SOURCES live in scripts/levels/ch1.ts (geometry +
 * candidate solution strokes as data). This script turns each source into a
 * gate-passing levels/<id>.json by:
 *
 *   1. MEASURE pass — run every candidate stroke at Lv0 through the real engine
 *      (runScriptedAttempt) on a provisional wide-budget level. Ink consumption
 *      (= simplified arc length) and the raw stroke length are pure functions of
 *      the stroke, so this pass is budget-independent; it just proves the stroke
 *      CLEARS and yields the numbers the thresholds are derived from.
 *   2. DERIVE — star3 = tightRefInk x 1.10, star2 = tightRefInk x 1.35
 *      (research/11 §3.3 minimal-solution-relative stars), inkBudget from the
 *      per-level "ink feel" (generous 3.0 / standard 2.5 / tight 2.0) but never
 *      below what every candidate needs to commit. Explicit src.inkBudget wins
 *      (the >=1.8x geometry-can't-defeat-a-straight escape hatch). Ordering
 *      0 < star3 < star2 <= budget is asserted (validateLevel re-checks it).
 *   3. RECORD pass — re-run each stroke against the FINAL level, sampling the
 *      VehicleReferencePoint every 10 ticks + a final sample at the outcome tick
 *      (validator requires last-sample == result). '3star' strokes must replay
 *      at 3 stars. The committed SIMPLIFIED polyline is what persists as
 *      GhostSolution.stroke (RDP is idempotent, so Gate 2's re-simplify rebuilds
 *      the identical bridge).
 *   4. VALIDATE + EMIT — validateLevel(level, { filenameStem: id }) must pass;
 *      write levels/<id>.json.
 *
 * Determinism / world budget: phaser-box2d never frees world slots (max 32 /
 * process), so every attempt runs on ONE recycled World (World header;
 * GhostPlayer.replayGhostSuite pattern). Recycled-slot drift is sub-mm and
 * tick-identical — inside the Gate 2 band — and ink/stars are pure functions of
 * the stroke, so the recorded result matches Gate 2's recycled replay.
 *
 * Fail-loud: any stroke that does not commit+clear (or a '3star' stroke that
 * does not 3-star, or a broken threshold ordering) prints the level/stroke and
 * its outcome+cause and exits 1 — this is the authoring iteration loop.
 *
 * Invocation (npm-free): `npx vite-node scripts/levels/authoring.ts`
 *                        `npx vite-node scripts/levels/authoring.ts -- --only ch1-l05`
 * Regeneration after TuningConstants change = rerun this script.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GhostSample, GhostSolution, Level, Point } from '../../src/engine/level/LevelSchema';
import { validateLevel } from '../../src/engine/level/LevelSchema';
import { collectCoinsAlongTrajectory, runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import type { TrajectorySample } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { COIN_ROOF_OFFSET_M, placeCoinsAlongTrajectory } from './coinPlacement';
import { buildAtlas } from '../atlas/atlas';
import { CH1_SOURCES } from './ch1';
import type { LevelSource, StrokeSource } from './ch1';

/** Ghost sampling cadence (ticks). Matches the fixture + FR-026 playback. */
const SAMPLE_EVERY_TICKS = 10;

/**
 * inkBudget = feelFactor x tight-reference ink (research/11 §3.2 v3 policy).
 * RAISED from the shipped 2.6/2.0/1.5 to answer the #1 device complaint
 * ("初期インクが少なすぎてステージが単純"): every board now lets the player draw
 * ~2-3x the minimal solution, so shaping the bridge creatively is possible.
 * Straight-line dominance is defeated by GEOMETRY + Gate 3, never by ink
 * starvation. The tight floor is 2.0x (never back to 1.5x).
 */
const FEEL_FACTOR: Record<LevelSource['inkFeel'], number> = {
  generous: 3.0, // Tutorial (L1-L2) / Bonus (B1-B3) / breathers — draw lavishly
  standard: 2.5, // mid-game main line — room to try curves; efficiency -> stars
  tight: 2.0, // late-game / Boss — precision rewarded but still creative-feasible
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function rawLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

interface MeasuredStroke {
  readonly source: StrokeSource;
  readonly index: number;
  readonly inkConsumed: number;
  readonly rawLen: number;
}

interface RecordedGhost {
  readonly ghost: GhostSolution;
  readonly source: StrokeSource;
  /** Dense per-tick VehicleReferencePoint path — the coin auto-placement route. */
  readonly trajectory: readonly TrajectorySample[];
}

/** A provisional level for the MEASURE pass — budget wide so nothing is rejected. */
function provisionalLevel(src: LevelSource): Level {
  return finalizeLevel(src, 9999, { star2: 9500, star3: 9000 }, []);
}

/**
 * Assemble a Level object (no validation) from a source + economy + ghosts.
 * `coins` defaults to the source coins (used by the MEASURE/RECORD passes, where
 * coins are inert to physics); emitLevel passes the auto-placed route coins.
 */
function finalizeLevel(
  src: LevelSource,
  inkBudget: number,
  starThresholds: { star2: number; star3: number },
  ghostSolutions: readonly GhostSolution[],
  coins: readonly Point[] = src.coins,
): Level {
  return {
    schemaVersion: 1,
    id: src.id,
    terrain: src.terrain,
    vehicleSpawn: src.vehicleSpawn,
    goalFlag: src.goalFlag,
    killY: src.killY,
    inkBudget,
    starThresholds,
    coins,
    gimmickTags: src.gimmickTags,
    ghostSolutions,
    ...(src.maxTicks !== undefined ? { maxTicks: src.maxTicks } : {}),
    ...(src.bonusMultiplier !== undefined ? { bonusMultiplier: src.bonusMultiplier } : {}),
  };
}

function fail(message: string): never {
  process.stderr.write(`\nAUTHORING FAILURE: ${message}\n`);
  process.exit(1);
}

/** MEASURE pass: prove every stroke clears; collect ink + raw length. */
function measure(src: LevelSource, world: World): MeasuredStroke[] {
  const level = provisionalLevel(src);
  return src.strokes.map((source, index) => {
    const attempt = runScriptedAttempt(level, source.points, {
      upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
      world,
    });
    if (!attempt.committed) {
      fail(`${src.id} stroke[${index}] "${source.role}" did not commit (reason: ${attempt.reason})`);
    }
    if (attempt.outcome !== 'clear') {
      fail(
        `${src.id} stroke[${index}] "${source.role}" did NOT clear — outcome=${attempt.outcome} cause=${attempt.cause ?? '?'} ticks=${attempt.ticks} finalPos=(${attempt.finalPos.x.toFixed(2)}, ${attempt.finalPos.y.toFixed(2)})`,
      );
    }
    return { source, index, inkConsumed: attempt.inkConsumed, rawLen: rawLength(source.points) };
  });
}

/** Pick the ink reference: the '3star' stroke, else the least-ink clearing stroke. */
function referenceInk(measured: readonly MeasuredStroke[]): number {
  const threeStar = measured.find((m) => m.source.kind === '3star');
  if (threeStar !== undefined) {
    return threeStar.inkConsumed;
  }
  return Math.min(...measured.map((m) => m.inkConsumed));
}

function deriveEconomy(
  src: LevelSource,
  measured: readonly MeasuredStroke[],
): { inkBudget: number; starThresholds: { star2: number; star3: number } } {
  const tightInk = referenceInk(measured);
  const maxRawLen = Math.max(...measured.map((m) => m.rawLen));

  // INK POLICY v3 (research/11 §3): the anti-dominant TIGHT-BUDGET override is
  // GONE. Every level's clear budget is feelFactor x the minimal-solution ink
  // (generous 3.0 / standard 2.5 / tight 2.0), so even the tightest board lets
  // the player draw ~2x the minimal solution. Straight-line dominance is now
  // defeated purely by GEOMETRY + Gate 3 (a raised bank sag, a wall, a spike, a
  // low ceiling, a deep pit), never by ink starvation. Stars are minimal-solution
  // relative (Happy Glass "less is better"): gold star3 <= min x 1.10, silver
  // star2 <= min x 1.35, bronze = clear within budget. AD boards now carry a
  // kind:'3star' reference ghost so Gate 2 asserts the gold target on every
  // level (the efficiency axis, previously dead on AD boards, is now live).
  //
  // ESCAPE HATCH: a rare board where geometry alone cannot fail every overlapped
  // straight (research §1.3) may pin a local budget via src.inkBudget — kept
  // >= 1.8x min so it never reverts to ink starvation.
  const defaultStars = { star3: round2(tightInk * 1.1), star2: round2(tightInk * 1.35) };
  let inkBudget: number;
  let starThresholds: { star2: number; star3: number };
  if (src.inkBudget !== undefined || src.starThresholds !== undefined) {
    inkBudget = round2(src.inkBudget ?? tightInk * FEEL_FACTOR[src.inkFeel]);
    starThresholds = src.starThresholds ?? defaultStars;
  } else {
    starThresholds = defaultStars;
    inkBudget = round2(
      Math.max(
        tightInk * FEEL_FACTOR[src.inkFeel],
        maxRawLen * 1.08, // every candidate must commit (raw length <= budget)
        starThresholds.star2 * 1.1, // keep star2 strictly below budget with headroom
      ),
    );
  }

  if (!(starThresholds.star3 > 0 && starThresholds.star3 < starThresholds.star2 && starThresholds.star2 <= inkBudget)) {
    fail(
      `${src.id} bad economy ordering: 0 < star3(${starThresholds.star3}) < star2(${starThresholds.star2}) <= inkBudget(${inkBudget}) violated (tightInk=${round2(tightInk)}, maxRaw=${round2(maxRawLen)})`,
    );
  }
  return { inkBudget, starThresholds };
}

/**
 * RECORD pass: re-run each stroke on the final level, capturing ghost samples.
 *
 * Records on the SHARED `recordWorld` in the EXACT order Gate 2 replays ghosts:
 * levels sorted by id, ghosts in stroke order, ONE attempt per ghost. Gate 2's
 * worldA sees precisely this sequence (one run1 per ghost, sorted files), and an
 * identical attempt sequence yields an identical result sequence across
 * independent recycled worlds (World.reset determinism note). So each recorded
 * result equals Gate 2's replay at the same sequence position — delta ~0, deep
 * inside the +/-30 tick / 0.05 m band, no matter the level's dynamics. This
 * requires the FULL set to be authored together in sorted order (a single
 * `--only` recording would sit at sequence position 0 and drift from Gate 2).
 */
function record(src: LevelSource, level: Level, recordWorld: World): RecordedGhost[] {
  return src.strokes.map((source, index) => {
    const samples: GhostSample[] = [];
    const trajectory: TrajectorySample[] = [];
    const attempt = runScriptedAttempt(level, source.points, {
      upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
      world: recordWorld,
      onTick: (t, referencePoint) => {
        // Dense per-tick capture drives coin auto-placement; onTick is a pure
        // observer, so this leaves the recorded run bit-identical to Gate 2's.
        trajectory.push({ t, x: referencePoint.x, y: referencePoint.y });
        if (t % SAMPLE_EVERY_TICKS === 0) {
          samples.push({ t, x: referencePoint.x, y: referencePoint.y });
        }
      },
    });
    if (!attempt.committed) {
      fail(`${src.id} stroke[${index}] "${source.role}" did not commit on final level (reason: ${attempt.reason})`);
    }
    if (attempt.outcome !== 'clear' || attempt.starRating === null) {
      fail(`${src.id} stroke[${index}] "${source.role}" did not clear on final level (outcome=${attempt.outcome})`);
    }
    if (source.kind === '3star' && attempt.starRating !== 3) {
      fail(
        `${src.id} stroke[${index}] "${source.role}" is kind:"3star" but replayed at ${attempt.starRating} stars ` +
          `(ink ${attempt.inkConsumed.toFixed(3)} vs star3 ${level.starThresholds.star3})`,
      );
    }
    // Final sample pins last-sample == result (validator's beyond-schema check).
    samples.push({ t: attempt.ticks, x: attempt.finalPos.x, y: attempt.finalPos.y });

    const ghost: GhostSolution = {
      kind: source.kind,
      stroke: attempt.stroke.map((p): readonly [number, number] => [p.x, p.y]),
      sampleEveryTicks: SAMPLE_EVERY_TICKS,
      samples,
      result: {
        outcome: 'clear',
        ticks: attempt.ticks,
        finalPos: attempt.finalPos,
        inkConsumed: attempt.inkConsumed,
        starRating: attempt.starRating,
      },
    };
    return { ghost, source, trajectory };
  });
}

interface LevelReport {
  readonly id: string;
  readonly design: string;
  readonly inkFeel: string;
  readonly inkBudget: number;
  readonly star2: number;
  readonly star3: number;
  readonly antiDominant: boolean;
  /** Coins auto-placed on the route / total, proven collected by the primary ghost. */
  readonly coins: number;
  readonly ghosts: readonly {
    readonly kind: string;
    readonly role: string;
    readonly ticks: number;
    readonly ink: number;
    readonly stars: number;
  }[];
}

interface PreparedLevel {
  readonly src: LevelSource;
  readonly inkBudget: number;
  readonly starThresholds: { star2: number; star3: number };
}

/** Phase 1: prove every stroke clears and derive the ink economy (no recording). */
function prepareLevel(src: LevelSource, measureWorld: World): PreparedLevel {
  const measured = measure(src, measureWorld);
  const { inkBudget, starThresholds } = deriveEconomy(src, measured);
  return { src, inkBudget, starThresholds };
}

/**
 * Phase 2: record ghosts (on the Gate-2-order recordWorld), validate, and emit.
 * Called in sorted id order so recordWorld's sequence mirrors Gate 2's worldA.
 */
function emitLevel(prepared: PreparedLevel, recordWorld: World, outDir: string): LevelReport {
  const { src, inkBudget, starThresholds } = prepared;
  // Coins are inert to physics (CoinTracker only OBSERVES the reference point),
  // so the record pass runs on the source coins and yields the driving route.
  const levelForRecording = finalizeLevel(src, inkBudget, starThresholds, []);
  const recorded = record(src, levelForRecording, recordWorld);

  // Auto-place coins ON the primary (canonical, index-0) ghost's driven route
  // and machine-prove the same route sweeps up every one (mandate A). The count
  // is preserved so the currency economy is unchanged.
  const primary = recorded[0];
  if (primary === undefined) {
    fail(`${src.id} has no recorded ghost to derive the coin route from`);
  }
  const routeCoins = placeCoinsAlongTrajectory(primary.trajectory, src.coins.length);
  const collection = collectCoinsAlongTrajectory(primary.trajectory, routeCoins);
  if (collection.collectedCount !== routeCoins.length) {
    fail(
      `${src.id} coin auto-placement left ${routeCoins.length - collection.collectedCount}/${routeCoins.length} coin(s) UNCOLLECTED on the primary ghost route ` +
        `(offset ${COIN_ROOF_OFFSET_M}m vs collectRadius — recalibrate placement)`,
    );
  }

  const level = finalizeLevel(src, inkBudget, starThresholds, recorded.map((r) => r.ghost), routeCoins);

  const validation = validateLevel(level, { filenameStem: src.id });
  if (!validation.ok) {
    fail(`${src.id} validateLevel rejected the emitted level:\n  - ${validation.errors.join('\n  - ')}`);
  }

  writeFileSync(join(outDir, `${src.id}.json`), JSON.stringify(level, null, 2) + '\n', 'utf-8');

  return {
    id: src.id,
    design: src.design,
    inkFeel: src.inkFeel,
    inkBudget,
    star2: starThresholds.star2,
    star3: starThresholds.star3,
    antiDominant: src.gimmickTags.includes('anti-dominant'),
    coins: routeCoins.length,
    ghosts: recorded.map((r) => ({
      kind: r.ghost.kind,
      role: r.source.role,
      ticks: r.ghost.result.ticks,
      ink: round2(r.ghost.result.inkConsumed),
      stars: r.ghost.result.starRating,
    })),
  };
}

function parseOnly(argv: readonly string[]): string | undefined {
  const idx = argv.indexOf('--only');
  if (idx !== -1 && argv[idx + 1] !== undefined) {
    return argv[idx + 1];
  }
  const inline = argv.find((a) => a.startsWith('--only='));
  return inline?.slice('--only='.length);
}

function printReport(reports: readonly LevelReport[]): void {
  process.stderr.write('\n=== Chapter 1 authoring report ===\n');
  process.stderr.write('id        feel      budget  star2  star3  AD  coins  ghosts\n');
  for (const r of reports) {
    const ghosts = r.ghosts
      .map((g) => `${g.kind}[${g.role}] t=${g.ticks} ink=${g.ink} ${g.stars}★`)
      .join('  |  ');
    process.stderr.write(
      `${r.id.padEnd(9)} ${r.inkFeel.padEnd(9)} ${String(r.inkBudget).padStart(6)} ` +
        `${String(r.star2).padStart(6)} ${String(r.star3).padStart(6)}  ${r.antiDominant ? 'Y' : '.'}   ` +
        `${String(r.coins).padStart(4)}   ${ghosts}\n`,
    );
  }
  const totalCoins = reports.reduce((sum, r) => sum + r.coins, 0);
  process.stderr.write(
    `\n${reports.length} level(s) emitted to levels/ — ${totalCoins} coins auto-placed on-route (100% collectable).\n`,
  );
}

function main(): void {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const only = parseOnly(argv);
  const sources = only !== undefined ? CH1_SOURCES.filter((s) => s.id === only) : CH1_SOURCES;
  if (sources.length === 0) {
    fail(`no level source matched ${only !== undefined ? `--only ${only}` : '(all)'}`);
  }

  if (only !== undefined) {
    process.stderr.write(
      `NOTE: --only records at sequence position 0; Gate 2 replays at the real ` +
        `position, so single-level emits can drift. Re-run WITHOUT --only for the final artifact.\n`,
    );
  }

  const outDir = join(process.cwd(), 'levels');
  mkdirSync(outDir, { recursive: true });

  // Phase 1: measure + derive economy on one recycled world (any order).
  const measureWorld = new World();
  let prepared: PreparedLevel[];
  try {
    prepared = sources.map((src) => prepareLevel(src, measureWorld));
  } finally {
    measureWorld.destroy();
  }

  // Phase 2: record + emit in Gate-2 order (sorted by id) on a dedicated world
  // that sees ONLY the record attempts — reproducing Gate 2 worldA's sequence.
  const sorted = [...prepared].sort((a, b) => (a.src.id < b.src.id ? -1 : a.src.id > b.src.id ? 1 : 0));
  const recordWorld = new World();
  try {
    const reports = sorted.map((p) => emitLevel(p, recordWorld, outDir));
    printReport(reports);
  } finally {
    recordWorld.destroy();
  }

  // Optional: regenerate the route/coin atlas in the same flow (--atlas). Runs
  // AFTER the record/emit worlds are destroyed so the atlas owns a clean slot.
  if (argv.includes('--atlas')) {
    const atlasPath = buildAtlas();
    process.stderr.write(`\natlas regenerated: ${atlasPath}\n`);
  }
}

main();

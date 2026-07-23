/**
 * Gate 7 — LAZY-LINE BOT.
 *
 * ROUND-9 RECALIBRATION (BR-015, fun decision 2 + designer comment 3): this gate
 * is now **ADVISORY telemetry only** — it ALWAYS exits 0 and NEVER fails a level.
 * A physically valid one-stroke clear (including a horizontal line) is a
 * legitimate win; level difficulty must come from terrain/hazard GEOMETRY, never
 * from a gate that outlaws the straight line. The round-8 pass/fail semantics
 * (below) are retired. The bot is KEPT because the per-level, per-pattern
 * dispositions it logs are exactly the telemetry the designer reads to decide
 * whether a level's concept is holding (e.g. an elevation/climb level should NOT
 * be clearable by a flat line — that is a geometry bug the designer fixes by
 * raising terrain, not a gate the code enforces).
 *
 * ROUND-8 ORIGIN (retained for context): the user's complaint VERBATIM,
 * 「全28面が横一本線でクリアできる」— every board fell to ONE lazy horizontal
 * stroke, and gates 0-6 never noticed (Goodhart failure of the proxy metrics).
 * Round-8 made a clearing pattern a hard FAIL; round-9 (BR-015) demotes that to
 * advisory logging after the fun overhaul reframed free solutions as legitimate.
 *
 * PATTERNS (the round-8 mandated four + two surface-anchored, see the T4
 * calibration note below): rim-exact / rim-overlap / high / low anchor on the
 * detected gap rims (Gate 3's machinery); spawn-goal / spawn-goal-high anchor
 * on the TOP-SOLID GROUND under the car and under the flag — the exact
 * "左→右に一本引く" line in the user's screenshots. The surface pair exists
 * because rim detection reads pit-floor rims on tier/pillar boards (a line no
 * lazy player draws), which made the rim-only bot pass vacuously — the same
 * learnings-T4 accident class this gate is meant to bury.
 *
 * INK PROFILE: candidates run at MAX ink upgrade (LAZY_BOT_INK_CAPACITY_LV).
 * The ink upgrade scales InkBudget.effectiveBudget ONLY — a committed stroke
 * builds the identical bridge at every ink level — so one ink-maxed run covers
 * the lazy strategy for EVERY upgrade tier a real player can reach. (The
 * user's device proof ran upgraded; a Lv0-only bot rejected 12/28 boards as
 * "insufficientInk" and passed them vacuously — measured 2026-07-11.) Engine
 * speed stays Lv0: it DOES alter dynamics, and Lv0 is the canonical replay
 * profile (BR-004); a speed-upgraded lazy sweep is future hardening. Each
 * disposition also reports the MINIMUM ink level that affords the line.
 *
 * PLAYER-FAITHFUL (learnings round-4: "ゲート候補も同じcommit経路を通す"): every
 * candidate goes through runScriptedAttempt -> GameSimulation.commitStroke —
 * terrain clip, predominantly-outside fallback, solidify, anticipation settle,
 * pre-drive settled baseline, motor run, Judge — the EXACT lifecycle a real
 * player's stroke drives. No shortcut simulation. INTEGRITY ASSERTION,
 * mirroring Gate 3: a candidate must never commit UNCLIPPED THROUGH terrain
 * (the F1 fallback) — the render layer stops a live stroke at the terrain
 * surface, so a fallback commit is a line no player could draw; it fails the
 * gate loudly instead of silently coloring the verdict.
 *
 * TUTORIAL ALLOWLIST: L1-L2 teach "draw a line, release, drive" — a lazy line
 * clearing THERE is the intended lesson. Under the round-9 advisory model every
 * level passes regardless, so the allowlist now only TAGS its clears as
 * `sanctioned` in the telemetry (vs a plain advisory note elsewhere).
 *
 * ROUND-9 SEMANTICS (BR-015): every level PASSES. `lazyLineCheck` returns an
 * empty `errors[]` unconditionally; every finding (a clearing pattern, the
 * per-pattern dispositions, a bot-integrity note) is surfaced as a `warnings`
 * entry + stderr line the designer reads. Nothing here can fail the build.
 *
 * BOT COVERAGE (lazy-line.spec.ts): the bot still PLAYS every pattern through the
 * exact player commit path and correctly identifies which ones clear — that
 * detection capability is unchanged; only its CONSEQUENCE (advisory, not fail) is.
 */
import { validateLevel, type Level, type Point } from '../../src/engine/level/LevelSchema';
import { runScriptedAttempt } from '../../src/engine/replay/GhostPlayer';
import { World } from '../../src/engine/physics/World';
import { economy } from '@tuning/TuningConstants';
import { detectRims, lerpPoint, straightCandidateStroke, topSolidSurfaceAt } from './rims';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

/** Gate number in the pipeline report (gates 0-6 are taken). */
export const LAZY_LINE_GATE_NUMBER = 7;

/**
 * Horizontal overlap (m) the lazy bot extends past each anchor. ~0.7 m is the
 * mandated "casual player drags a bit onto each platform" approximation
 * (round-8 spec); it also matches the anchoring L1's own road stroke uses.
 */
export const LAZY_OVERLAP_M = 0.7;

/**
 * Vertical offset (m) for the high/low pattern variants: a lazy line drawn a
 * touch above or below the anchor height. ±0.5 m spans the sloppy-drag band
 * without leaving the "one horizontal stroke" strategy.
 */
export const LAZY_HEIGHT_OFFSET_M = 0.5;

/**
 * Lift (m) of a surface-anchored stroke above the ground it starts/ends on —
 * a player physically cannot draw AT the surface (the live stroke stops at the
 * terrain boundary), so the lazy line floats a stroke-width above it. Matches
 * the ~0.04-0.06 m lift every shipped ghost stroke uses.
 */
export const LAZY_SURFACE_LIFT_M = 0.06;

/**
 * Ink-capacity level the bot draws with — the MAX a player can buy (see the
 * header: ink scales affordability only, never physics, so max ink covers all
 * tiers in one run). Engine speed stays Lv0 (canonical dynamics, BR-004).
 */
export const LAZY_BOT_INK_CAPACITY_LV = economy.maxUpgradeLevel;

/** How a pattern anchors its endpoints: gap rims (Gate 3) or ground surfaces. */
export type LazyAnchorKind = 'rim' | 'surface';

export interface LazyLinePattern {
  readonly name: string;
  readonly anchor: LazyAnchorKind;
  /** Extension (m) past each anchor along the line direction. */
  readonly overlapM: number;
  /** Vertical offset (m) added to both anchor endpoints. */
  readonly offsetM: number;
}

/**
 * The lazy-line pattern set: the four round-8 mandated rim patterns (exact
 * rim-to-rim, ~0.7 m overlapped, high, low) plus the two surface-anchored
 * spawn→goal lines (see header — the screenshot strategy, immune to pit-rim
 * mis-anchoring). All are variants of ONE straight stroke.
 */
export const LAZY_LINE_PATTERNS: readonly LazyLinePattern[] = [
  { name: 'rim-exact', anchor: 'rim', overlapM: 0, offsetM: 0 },
  { name: 'rim-overlap', anchor: 'rim', overlapM: LAZY_OVERLAP_M, offsetM: 0 },
  { name: 'high', anchor: 'rim', overlapM: LAZY_OVERLAP_M, offsetM: LAZY_HEIGHT_OFFSET_M },
  { name: 'low', anchor: 'rim', overlapM: LAZY_OVERLAP_M, offsetM: -LAZY_HEIGHT_OFFSET_M },
  { name: 'spawn-goal', anchor: 'surface', overlapM: LAZY_OVERLAP_M, offsetM: 0 },
  { name: 'spawn-goal-high', anchor: 'surface', overlapM: LAZY_OVERLAP_M, offsetM: LAZY_HEIGHT_OFFSET_M },
];

/**
 * Tutorial levels where a lazy line clearing is the INTENDED first lesson
 * (real shipped ids, round-8 spec). Their lazy clears are sanctioned warnings.
 */
export const LAZY_LINE_ALLOWLIST: ReadonlySet<string> = new Set(['ch1-l01', 'ch1-l02']);

/**
 * One recycled world for ALL lazy candidates across the run — 28 levels x 6
 * patterns = 168 attempts would exhaust the phaser-box2d 32-slot cap many
 * times over with fresh worlds (World header). Verdicts only need the outcome,
 * well within recycled-slot macroscopic determinism (Gate 3 precedent).
 */
let lazyWorld: World | undefined;
function getLazyWorld(): World {
  lazyWorld ??= new World();
  return lazyWorld;
}

/**
 * The straight spawn→goal stroke: ground surface under the car to ground
 * surface under the flag center, lifted a stroke-width, extended `overlap` m
 * past both ends and raised `offset` m — the screenshot lazy line. null when
 * either end has no top-solid ground below it (nothing to anchor on).
 */
export function surfaceAnchoredStroke(level: Level, overlap: number, offset: number): Point[] | null {
  const flagCenterX = level.goalFlag.x + level.goalFlag.width / 2;
  const spawnSurfaceY = topSolidSurfaceAt(level.terrain, level.vehicleSpawn.x);
  const goalSurfaceY = topSolidSurfaceAt(level.terrain, flagCenterX);
  if (spawnSurfaceY === null || goalSurfaceY === null) {
    return null;
  }
  const a: Point = { x: level.vehicleSpawn.x, y: spawnSurfaceY + LAZY_SURFACE_LIFT_M + offset };
  const b: Point = { x: flagCenterX, y: goalSurfaceY + LAZY_SURFACE_LIFT_M + offset };
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) {
    return null;
  }
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const aExt: Point = { x: a.x - ux * overlap, y: a.y - uy * overlap };
  const bExt: Point = { x: b.x + ux * overlap, y: b.y + uy * overlap };
  // Two interior points keep the resampler direction stable on long segments.
  return [aExt, lerpPoint(aExt, bExt, 1 / 3), lerpPoint(aExt, bExt, 2 / 3), bExt];
}

/** Build the pattern's stroke, or null when its anchors do not exist. */
function buildPatternStroke(
  level: Level,
  pattern: LazyLinePattern,
  rims: { rimA: Point; rimB: Point } | null,
): Point[] | null {
  if (pattern.anchor === 'rim') {
    return rims === null ? null : straightCandidateStroke(level, rims, pattern.overlapM, pattern.offsetM);
  }
  return surfaceAnchoredStroke(level, pattern.overlapM, pattern.offsetM);
}

/** Raw polyline arc length (m) — what commitStroke charges against the budget. */
function rawStrokeLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    total += Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);
  }
  return total;
}

/**
 * The minimum ink-capacity level whose effective budget affords `rawLength`,
 * or null when even LAZY_BOT_INK_CAPACITY_LV cannot pay for it. 0 == the base
 * (Lv0) budget already affords the line.
 */
export function minInkLevelFor(rawLength: number, levelInkBudget: number): number | null {
  for (let lv = 0; lv <= LAZY_BOT_INK_CAPACITY_LV; lv++) {
    if (rawLength <= levelInkBudget * (1 + (lv * economy.inkPerLevelPct) / 100)) {
      return lv;
    }
  }
  return null;
}

/** Result of playing one lazy pattern through the player commit path. */
export interface LazyPatternResult {
  readonly pattern: LazyLinePattern;
  /** Gate-3-style commit disposition (clean / clipped / fallback / rejected / skipped). */
  readonly disposition: string;
  readonly isCleared: boolean;
  /** True when the F1 fallback committed the UNCLIPPED line (integrity breach). */
  readonly usedFallback: boolean;
  /** Outcome ticks when the attempt committed. */
  readonly ticks?: number;
  /** Minimum ink-capacity level affording this line (0 = Lv0; null = never). */
  readonly minInkLv: number | null;
}

/** Play one pattern; pure function of (level, stroke) on the recycled world. */
function playPattern(level: Level, pattern: LazyLinePattern, stroke: Point[], world: World): LazyPatternResult {
  const minInkLv = minInkLevelFor(rawStrokeLength(stroke), level.inkBudget);
  const result = runScriptedAttempt(level, stroke, {
    // MAX ink (affordability-only, header) + Lv0 speed (canonical dynamics).
    upgrades: { inkCapacityLv: LAZY_BOT_INK_CAPACITY_LV, engineSpeedLv: 0 },
    world,
  });
  if (!result.committed) {
    return {
      pattern,
      disposition: `rejected(${result.reason}) -> no-commit`,
      isCleared: false,
      usedFallback: false,
      minInkLv,
    };
  }
  const commitKind = result.usedFallback
    ? 'fallback(UNCLIPPED-through-terrain)'
    : result.clipApplied
      ? 'clipped'
      : 'clean';
  return {
    pattern,
    disposition: `${commitKind} -> ${result.outcome}${minInkLv === null ? '' : ` @inkLv${minInkLv}`}`,
    isCleared: result.outcome === 'clear',
    usedFallback: result.usedFallback,
    ticks: result.ticks,
    minInkLv,
  };
}

/**
 * Play every lazy pattern on a level through the EXACT player commit path.
 * Exported for the unit tests and the redesign worklist report.
 */
export function runLazyLineBot(level: Level, world: World = getLazyWorld()): LazyPatternResult[] {
  const rims = detectRims(level);
  return LAZY_LINE_PATTERNS.map((pattern) => {
    const stroke = buildPatternStroke(level, pattern, rims);
    if (stroke === null) {
      return {
        pattern,
        disposition: `skipped(no-${pattern.anchor}-anchor)`,
        isCleared: false,
        usedFallback: false,
        minInkLv: null,
      };
    }
    return playPattern(level, pattern, stroke, world);
  });
}

/**
 * ROUND-9 (BR-015): ADVISORY ONLY. Always returns an empty `errors[]` (the level
 * always passes); every finding is a `warnings` entry the designer reads. The bot
 * still plays every pattern and reports which ones clear — it is telemetry, not a
 * gate. A flat line clearing a FLAT bridge level is fine; a flat line clearing an
 * elevation/climb level is a GEOMETRY note for the designer (fix by raising the
 * goal terrain), surfaced here but never failing the build.
 */
export function lazyLineCheck(
  loaded: { json: unknown },
  world?: World,
): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    // A malformed level is Gate 0's failure, not this advisory gate's — surface a
    // pointer as a warning so the pipeline's blocking gates own the hard error.
    return { errors: [], warnings: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  const results = runLazyLineBot(level, world);

  const warnings: string[] = [];
  const isAllowlisted = LAZY_LINE_ALLOWLIST.has(level.id);
  for (const r of results) {
    logDisposition(level.id, r, warnings);
    if (r.usedFallback) {
      // Bot-integrity note (a fallback commit is a line no player could draw) —
      // advisory: it colours the bot's own verdict, not the level's validity.
      warnings.push(`lazy-line ADVISORY: bot committed UNCLIPPED THROUGH terrain (F1 fallback) at "${r.pattern.name}"`);
    }
    if (!r.isCleared) {
      continue;
    }
    const clearTag =
      `"${r.pattern.name}" (overlap ${r.pattern.overlapM}m, offset ${r.pattern.offsetM >= 0 ? '+' : ''}${r.pattern.offsetM}m, ` +
      `ticks ${r.ticks ?? '?'}, needs inkLv>=${r.minInkLv ?? '?'})`;
    warnings.push(
      isAllowlisted
        ? `lazy-line: tutorial allowlist ${level.id} — a straight line clears at ${clearTag} (sanctioned lesson)`
        : `lazy-line ADVISORY: a straight line clears ${level.id} at ${clearTag} — acceptable for a flat bridge level; a GEOMETRY bug only if this level's concept needs elevation (BR-015: fix by terrain, never by a blocker)`,
    );
  }
  return { errors: [], warnings };
}

/**
 * Record a pattern's disposition: a `warnings` entry on the gate line (the
 * redesign worklist) plus a compact stderr line outside vitest (stdout stays
 * NDJSON-only per the gate output discipline).
 */
function logDisposition(levelId: string, r: LazyPatternResult, warnings: string[]): void {
  const line = `${r.pattern.name}: ${r.disposition}`;
  warnings.push(line);
  if (!process.env['VITEST']) {
    process.stderr.write(`gate7 ${levelId} lazy ${line}\n`);
  }
}

export function runLazyLineGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  // ROUND-9 (BR-015): advisory only — lazyLineCheck never returns errors, so this
  // gate always exits 0. The --warn-new-gates flag is no longer consulted here.
  return runGate(LAZY_LINE_GATE_NUMBER, resolveLevelFiles(levelsGlob), isQuiet, (loaded) =>
    lazyLineCheck(loaded),
  );
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runLazyLineGate(process.argv.slice(2)));
}

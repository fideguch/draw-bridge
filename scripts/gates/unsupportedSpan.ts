/**
 * Gate 5 — UNSUPPORTED SPAN (round-7, game_plan_v5 §8.2). A tension line (flat span
 * / sag / hung rope) can only hold across ~5.5 m of gap before the joints break
 * (breakForceFactor=10, segmentLength=0.8). This gate measures the widest gap the
 * drawn line must bridge WITHOUT terrain support and fails a level whose longest
 * unsupported span exceeds the limit — the machine form of "分割・多点支持せよ".
 *
 * METRIC. Scan x across the spawn↔goal range at SCAN_STEP_M. The local RIM reference
 * is the straight line from the spawn-ground surface to the goal-ground surface. A
 * sample x is UNSUPPORTED when the terrain top there is ABSENT, or lies more than
 * SUPPORT_DROP_M below that rim line (a pit). A pillar / mid-ledge that rises to
 * within SUPPORT_DROP_M of the rim SPLITS the gap into shorter supported sub-spans
 * (so L3's combed pillars read ~2.2 m, not the full comb width). The metric is the
 * longest contiguous unsupported run (m).
 *
 * ARCH EXEMPTION (§8.2). A COMPRESSION arch/dome routes load axially and holds past
 * 5.5 m (L16 ~6.2 m, L21 ~7.0 m), so ARCH_EXEMPT_IDS are reported as a WARNING with
 * a break-test reminder instead of an error (the break test — not this static gate —
 * proves "正解アーチ=非破断 / naive 平線=破断").
 *
 * ROLLOUT (§3.6): STRICT by default; CI passes lib.WARN_NEW_GATES_FLAG until the
 * 28-slate lands. NEGATIVE CONTROL: a 6 m flat gap fails; a 4 m gap passes; a wide
 * gap with a mid-pillar passes (unsupportedSpan.spec.ts).
 */
import { validateLevel, type Level, type Polyline } from '../../src/engine/level/LevelSchema';
import {
  applyWarnMode,
  hasWarnNewGatesFlag,
  parseCliOptions,
  resolveLevelFiles,
  runGate,
} from './lib';

/** Max unsupported TENSION span (m) — physics limit (game_plan_v5 §8.2). */
export const MAX_UNSUPPORTED_SPAN_M = 5.5;
/** A terrain top this far below the rim line (m) reads as a pit, not support. */
const SUPPORT_DROP_M = 0.8;
/** Horizontal scan resolution (m). */
const SCAN_STEP_M = 0.1;

/** Compression arches/domes exceed 5.5 m by design — verified by break test (§8.2). */
export const ARCH_EXEMPT_IDS: ReadonlySet<string> = new Set(['ch1-l16', 'ch1-l21']);

/** y of the highest terrain surface at or below (x, y); null when none spans x below y. */
function terrainYBelow(terrain: readonly Polyline[], x: number, y: number): number | null {
  let best: number | null = null;
  for (const polyline of terrain) {
    for (let i = 0; i + 1 < polyline.length; i++) {
      const [ax, ay] = polyline[i]!;
      const [bx, by] = polyline[i + 1]!;
      const minX = Math.min(ax, bx);
      const maxX = Math.max(ax, bx);
      if (x < minX || x > maxX) continue;
      const t = maxX === minX ? 0 : (x - ax) / (bx - ax);
      const segY = ay + t * (by - ay);
      if (segY <= y && (best === null || segY > best)) best = segY;
    }
  }
  return best;
}

/**
 * Longest contiguous unsupported horizontal span (m) the drawn line must bridge.
 * Exported for direct unit tests.
 */
export function maxUnsupportedSpan(level: Level): number {
  const spawnGround = terrainYBelow(level.terrain, level.vehicleSpawn.x, level.vehicleSpawn.y) ?? level.vehicleSpawn.y;
  const goalCx = level.goalFlag.x + level.goalFlag.width / 2;
  const goalGround = terrainYBelow(level.terrain, goalCx, level.goalFlag.y + level.goalFlag.height) ?? level.goalFlag.y;

  const x0 = Math.min(level.vehicleSpawn.x, goalCx);
  const x1 = Math.max(level.vehicleSpawn.x, goalCx);
  const span = x1 - x0;
  if (span <= 0) {
    return 0;
  }
  // Straight rim reference from spawn-ground to goal-ground across the span.
  const rimAt = (x: number): number => {
    const t = (x - level.vehicleSpawn.x) / (goalCx - level.vehicleSpawn.x || 1);
    return spawnGround + t * (goalGround - spawnGround);
  };

  let longest = 0;
  let runStartX: number | null = null;
  for (let x = x0; x <= x1 + 1e-9; x += SCAN_STEP_M) {
    const rim = rimAt(x);
    const surf = terrainYBelow(level.terrain, x, rim + 0.05);
    const isUnsupported = surf === null || surf < rim - SUPPORT_DROP_M;
    if (isUnsupported) {
      if (runStartX === null) runStartX = x;
      longest = Math.max(longest, x - runStartX);
    } else {
      runStartX = null;
    }
  }
  return longest;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function unsupportedSpanCheck(loaded: { json: unknown }): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  const span = maxUnsupportedSpan(level);
  if (span <= MAX_UNSUPPORTED_SPAN_M) {
    return { errors: [], warnings: [`unsupported-span ${round1(span)}m <= ${MAX_UNSUPPORTED_SPAN_M}m`] };
  }
  if (ARCH_EXEMPT_IDS.has(level.id)) {
    return {
      errors: [],
      warnings: [
        `unsupported-span ${round1(span)}m > ${MAX_UNSUPPORTED_SPAN_M}m but ${level.id} is a COMPRESSION arch ` +
          `(§8.2 arch exemption) — verify non-breakage via the break test, not this static gate`,
      ],
    };
  }
  return {
    errors: [
      `unsupported-span: longest unsupported tension span ${round1(span)}m > limit ${MAX_UNSUPPORTED_SPAN_M}m ` +
        `(game_plan_v5 §8.2) — add a mid-pillar / ledge to split it, or make it a compression arch`,
    ],
  };
}

export function runUnsupportedSpanGate(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const isWarnMode = hasWarnNewGatesFlag(argv);
  return runGate(5, resolveLevelFiles(levelsGlob), isQuiet, (loaded) =>
    applyWarnMode(unsupportedSpanCheck(loaded), isWarnMode),
  );
}

// CLI execution — skipped under vitest so tests can import the check function.
if (!process.env['VITEST']) {
  process.exit(runUnsupportedSpanGate(process.argv.slice(2)));
}

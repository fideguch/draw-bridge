/**
 * Gate 5 — UNSUPPORTED SPAN (round-7, game_plan_v5 §8.2; CHAIN-SUPPORT rewrite).
 * A tension line (flat span / sag / hung rope) can only hold across ~5.5 m of gap
 * before the joints break (breakForceFactor=10, segmentLength=0.8). This gate
 * fails a level whose drawn bridge has a FREE SPAN longer than that limit — the
 * machine form of "分割・多点支持せよ".
 *
 * ── WHY CHAIN-SUPPORT, NOT TERRAIN-CHORD (WAVE 3.5 gate-defect fix) ────────────
 * The 5.5 m limit bounds the DRAWN CHAIN's free spans (bridge sag / break), NOT
 * the terrain silhouette. The old metric scanned the terrain top against the
 * straight spawn→goal chord and flagged any terrain that ROSE ABOVE that chord as
 * "unsupported" (terrainYBelow returns null above the low rim line). That made
 * every tier / descent / shaft / raised-mid-road level read as one giant span and
 * forced 5 of 6 wave-3 levels to collapse into near-identical deep-floor sags
 * (the exact 似て非なるステージ complaint). Terrain shape is irrelevant here except
 * WHERE THE CHAIN TOUCHES IT.
 *
 * METRIC (engine settle snapshot, mirrors lineDisplacement.ts / atlas). Commit the
 * primary ghost stroke, settle it through the anticipation countdown (car not yet
 * on it), and read the SETTLED chain polyline (renderChainPolyline — capsule-centre
 * nodes; a settled chain physically cannot lie inside solids). A chain node is
 * SUPPORTED when it rests within CONTACT_CLEARANCE_M of a TOP-SOLID terrain surface
 * directly below it (rim / pillar / ledge / tier); otherwise it hangs FREE. The
 * metric is the longest straight-line gap between consecutive support contacts
 * (leading / trailing overhangs and a wholly-unsupported chain are measured too).
 *
 * ARCH EXEMPTION (§8.2). A COMPRESSION arch/dome routes load axially and holds past
 * 5.5 m (L16 ~6.2 m, L21 ~7.0 m) with only its two end anchors, so ARCH_EXEMPT_IDS
 * are reported as a WARNING with a break-test reminder instead of an error (the
 * break test — not this static gate — proves "正解アーチ=非破断 / naive 平線=破断").
 *
 * ROLLOUT (§3.6): STRICT by default; CI passes lib.WARN_NEW_GATES_FLAG until the
 * 28-slate lands. NEGATIVE CONTROL: a settled chain free-hanging 6 m over a pit
 * FAILS; a chain resting on a raised mid-tier (short sub-spans) PASSES even though
 * the tier rises above the spawn→goal chord (unsupported-span.spec.ts).
 */
import { validateLevel, type Level, type Point, type Polyline } from '../../src/engine/level/LevelSchema';
import { GameSimulation } from '../../src/engine/GameSimulation';
import { World } from '../../src/engine/physics/World';
import { bridge } from '@tuning/TuningConstants';
import {
  applyWarnMode,
  hasWarnNewGatesFlag,
  parseCliOptions,
  resolveLevelFiles,
  runGate,
} from './lib';

/** Max unsupported TENSION span (m) — physics limit (game_plan_v5 §8.2). */
export const MAX_UNSUPPORTED_SPAN_M = 5.5;

/**
 * A settled chain node counts as SUPPORTED when its capsule rests within this
 * clearance (m) of a top-solid surface directly below it. A resting capsule centre
 * sits ~bridge.capsuleRadius (0.12 m) above the surface; the extra margin absorbs
 * settle jitter and RDP node placement, while a node hanging over a pit (no
 * top-solid below, or one metres down) stays FREE. Calibrated against all 13
 * settled chains (scripts/probe/span-contact.ts): every real rim/pillar contact
 * gaps ≤0.28 m, every free node gaps ≥0.5 m or has no support below — a wide
 * separation, so the exact value is not sensitive. Structural constant.
 */
export const CONTACT_CLEARANCE_M = bridge.capsuleRadius + 0.23; // 0.35 m

/**
 * How far a chain node may sit BELOW a top-solid surface and still read as a
 * contact (m). A settled capsule rests ~capsuleRadius ABOVE the surface, but where
 * overlapping features give a higher interpolated surface than the one actually
 * bearing the node, a real contact measures slightly negative (min −0.23 across the
 * 13 settled chains). This lower bound keeps those while rejecting a node metres
 * below a tall feature it clearly is not resting on. Structural constant.
 */
export const CONTACT_BELOW_M = 0.5;

/** Compression arches/domes exceed 5.5 m by design — verified by break test (§8.2). */
export const ARCH_EXEMPT_IDS: ReadonlySet<string> = new Set(['ch1-l16', 'ch1-l21']);

let spanWorld: World | undefined;
function getSpanWorld(): World {
  spanWorld ??= new World();
  return spanWorld;
}

/**
 * Highest TOP-SOLID terrain surface y at x, or null when no top-solid feature
 * spans x. Only polylines authored left→right (net dx ≥ 0 ⇒ top solid, the
 * TerrainSolids convention) can bear a chain — a ceiling / overhang (net dx < 0)
 * is underside-solid and never supports a line resting on it, so it is excluded.
 */
export function topSolidSurfaceAt(terrain: readonly Polyline[], x: number): number | null {
  let best: number | null = null;
  for (const polyline of terrain) {
    if (polyline.length < 2) continue;
    const first = polyline[0]!;
    const last = polyline[polyline.length - 1]!;
    if (last[0] - first[0] < 0) continue; // underside-solid (ceiling) — never a support
    for (let i = 0; i + 1 < polyline.length; i++) {
      const [ax, ay] = polyline[i]!;
      const [bx, by] = polyline[i + 1]!;
      const minX = Math.min(ax, bx);
      const maxX = Math.max(ax, bx);
      if (x < minX || x > maxX) continue;
      const t = bx === ax ? 0 : (x - ax) / (bx - ax);
      const segY = ay + t * (by - ay);
      if (best === null || segY > best) best = segY;
    }
  }
  return best;
}

/** True when the settled chain node rests on a top-solid surface (rim/pillar/tier). */
function isSupported(node: Point, terrain: readonly Polyline[]): boolean {
  const surf = topSolidSurfaceAt(terrain, node.x);
  if (surf === null) return false;
  const gap = node.y - surf;
  // Resting ON the surface: within contact clearance above, tolerating a small dip
  // below (overlapping-feature interpolation); a node far below is not a contact.
  return gap <= CONTACT_CLEARANCE_M && gap >= -CONTACT_BELOW_M;
}

/** Euclidean distance between two chain nodes (m). */
function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Fine-sample step (m) along the settled chain when classifying support. The
 * settled chain has few coarse nodes (RDP + SEGMENT_COUNT_MIN), so a short
 * platform lip the chain overhangs (L1's ~0.7 m of rest each side of a 4.4 m gap)
 * can fall BETWEEN two nodes and go undetected — making a 4.4 m gap read as the
 * full 5.8 m stroke width. Sampling finely along the polyline arc detects the
 * contact wherever the chain actually lies on the lip, so the metric measures the
 * true unsupported gap independent of node resolution. Structural constant.
 */
const SAMPLE_STEP_M = 0.15;

/** Interpolate the chain polyline into fine samples (≤SAMPLE_STEP_M apart along arc). */
function resampleAlongArc(chain: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i]!;
    const b = chain[i + 1]!;
    const steps = Math.max(1, Math.ceil(dist(a, b) / SAMPLE_STEP_M));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(chain[chain.length - 1]!);
  return out;
}

/**
 * Longest free (unsupported) span (m) of a settled chain polyline: the widest
 * straight-line gap between consecutive support CONTACTS along the chain, including
 * a leading / trailing overhang (chain end unsupported) and a wholly-unsupported
 * chain (end-to-end). The chain is fine-sampled along its arc so a contact on a
 * short platform lip is detected regardless of the coarse node spacing (see
 * SAMPLE_STEP_M). Pure geometry — exported for direct unit tests.
 */
export function longestFreeSpan(chain: readonly Point[], terrain: readonly Polyline[]): number {
  if (chain.length < 2) return 0;
  const samples = resampleAlongArc(chain);
  const n = samples.length;
  const supportIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isSupported(samples[i]!, terrain)) supportIdx.push(i);
  }
  // No support anywhere → the whole chain is one free span (fails unless exempt).
  if (supportIdx.length === 0) {
    return dist(samples[0]!, samples[n - 1]!);
  }
  let longest = 0;
  // Leading overhang: from the first sample to the first support contact.
  const firstSup = supportIdx[0]!;
  if (firstSup > 0) longest = Math.max(longest, dist(samples[0]!, samples[firstSup]!));
  // Trailing overhang: from the last support contact to the last sample.
  const lastSup = supportIdx[supportIdx.length - 1]!;
  if (lastSup < n - 1) longest = Math.max(longest, dist(samples[lastSup]!, samples[n - 1]!));
  // Interior free spans: the gap between each consecutive pair of support contacts.
  for (let k = 0; k + 1 < supportIdx.length; k++) {
    longest = Math.max(longest, dist(samples[supportIdx[k]!]!, samples[supportIdx[k + 1]!]!));
  }
  return longest;
}

export interface SpanMeasurement {
  /** Longest free span (m). 0 / meaningless when the stroke did not commit. */
  readonly span: number;
  readonly committed: boolean;
  /** Uncommitted reason (StrokeDiscardReason) when committed === false. */
  readonly reason?: string;
}

/**
 * Settle the primary ghost stroke and measure its longest free span from the
 * SETTLED chain snapshot (the chain shape the instant the car launches, before it
 * loads the bridge — same moment lineDisplacement.ts / the atlas snapshot). Reuses
 * the module-recycled World unless one is supplied (tests pass a private one).
 */
export function measureUnsupportedSpan(level: Level, world: World = getSpanWorld()): SpanMeasurement {
  const ghost = level.ghostSolutions[0];
  if (ghost === undefined) {
    return { span: 0, committed: false, reason: 'no-ghost' };
  }
  const stroke: Point[] = ghost.stroke.map(([x, y]) => ({ x, y }));
  const sim = new GameSimulation(level, { upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 }, world });
  try {
    const commit = sim.commitStroke(stroke);
    if (!commit.committed) {
      return { span: 0, committed: false, reason: commit.reason };
    }
    // Settle through the anticipation countdown; snapshot the settled (unloaded)
    // chain the instant the car starts running (atlas.recordSettledChain pattern).
    let outcome = sim.outcome;
    while (sim.phase === 'anticipation' && outcome === null) {
      outcome = sim.step();
    }
    const chain = sim.renderChainPolyline();
    return { span: longestFreeSpan(chain, level.terrain), committed: true };
  } finally {
    sim.destroy();
  }
}

/**
 * Longest free span (m) of the primary ghost's settled chain. Exported for direct
 * unit tests; returns POSITIVE_INFINITY when the stroke does not commit (an
 * unmeasurable bridge fails the gate loudly).
 */
export function maxUnsupportedSpan(level: Level, world?: World): number {
  const m = measureUnsupportedSpan(level, world);
  return m.committed ? m.span : Number.POSITIVE_INFINITY;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function unsupportedSpanCheck(
  loaded: { json: unknown },
  world?: World,
): { errors: string[]; warnings?: string[] } {
  const parsed = validateLevel(loaded.json);
  if (!parsed.ok) {
    return { errors: [`gate0-invalid level (run gate0 first): ${parsed.errors[0] ?? 'unknown'}`] };
  }
  const level = parsed.level;
  const measured = measureUnsupportedSpan(level, world);
  if (!measured.committed) {
    return {
      errors: [
        `unsupported-span: primary ghost did not build a bridge to measure (${measured.reason ?? 'unknown'})`,
      ],
    };
  }
  const span = measured.span;
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
      `unsupported-span: longest free (unsupported) chain span ${round1(span)}m > limit ${MAX_UNSUPPORTED_SPAN_M}m ` +
        `(game_plan_v5 §8.2) — rest the drawn line on a mid-pillar / ledge / tier to split it, or make it a compression arch`,
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

/**
 * editorState — pure level-draft state for the in-game editor (T082, FR-024).
 *
 * A headless, immutable model of the level under construction: every operation
 * returns a NEW draft (no mutation), so EditorScene can keep an undo-friendly
 * history and the whole module is unit-testable with no Phaser/DOM (see
 * tests/unit/editor-logic.spec.ts).
 *
 * The draft mirrors the Level contract (LevelSchema) field-for-field, plus a
 * single recorded ghost slot. `draftToLevelJson` derives the exact JSON the
 * game ships; `validateDraft` runs it through the SAME validateLevel the loader
 * and Gate 0 use — so the editor's save gate is the shipping contract, not a
 * private re-implementation. A draft with no recorded ghost fails validation on
 * the ghostSolutions rule (FR-024: no solution, no save).
 *
 * Coordinates: world metres, y-up — identical to Level JSON and the engine.
 */

import type {
  GhostSolution,
  GimmickTag,
  Level,
  LevelValidation,
  Point,
  Rect,
} from '@engine/level/LevelSchema';
import { BONUS_LEVEL_ID_PATTERN, validateLevel } from '@engine/level/LevelSchema';

export interface StarThresholdsDraft {
  readonly star2: number;
  readonly star3: number;
}

/** Mutable-shaped but always replaced wholesale — never edited in place. */
export interface EditorDraft {
  readonly id: string;
  readonly terrain: readonly (readonly Point[])[];
  readonly vehicleSpawn: Point;
  readonly goalFlag: Rect;
  readonly killY: number;
  readonly inkBudget: number;
  readonly starThresholds: StarThresholdsDraft;
  readonly coins: readonly Point[];
  readonly gimmickTags: readonly GimmickTag[];
  /** Recorded clear from testplay, or null (blocks save until present). */
  readonly ghost: GhostSolution | null;
  readonly maxTicks?: number;
  /** Present only on bonus ids (ch1-b*); mirrors the schema rule. */
  readonly bonusMultiplier?: number;
}

/** Default bonus reward multiplier when a bonus id is selected (schema range 5-10). */
export const DEFAULT_BONUS_MULTIPLIER = 6;

/** The FR-024 save-gate error validateLevel emits when no ghost is recorded. */
export const NO_GHOST_ERROR_PREFIX = 'ghostSolutions:';

function isBonusId(id: string): boolean {
  return BONUS_LEVEL_ID_PATTERN.test(id);
}

/**
 * A ready-to-testplay starter: a single gap between two platforms, spawn on the
 * left, goal on the right — clearable with one arched stroke, so the author can
 * immediately testplay to record the first ghost. Mirrors the canonical fixture
 * geometry (tests/fixtures/levels/example-valid.json) minus the ghost.
 */
export function createStarterDraft(id: string): EditorDraft {
  const base: EditorDraft = {
    id,
    terrain: [
      [
        { x: -10, y: 0 },
        { x: -1, y: 0 },
        { x: -1.2, y: -5 },
      ],
      [
        { x: 1.2, y: -5 },
        { x: 1, y: 0 },
        { x: 14, y: 0 },
      ],
    ],
    vehicleSpawn: { x: -8, y: 0.6 },
    goalFlag: { x: 10, y: 0, width: 1.5, height: 2.5 },
    killY: -7,
    inkBudget: 18,
    starThresholds: { star2: 12, star3: 8 },
    coins: [],
    gimmickTags: [],
    ghost: null,
  };
  return withIdConstraints(base, id);
}

/** Change the level id, re-applying the bonusMultiplier presence rule. */
export function setId(draft: EditorDraft, id: string): EditorDraft {
  return withIdConstraints(draft, id);
}

/** Add/remove bonusMultiplier so it exists iff `id` is a bonus id (schema rule). */
function withIdConstraints(draft: EditorDraft, id: string): EditorDraft {
  if (isBonusId(id)) {
    return { ...draft, id, bonusMultiplier: draft.bonusMultiplier ?? DEFAULT_BONUS_MULTIPLIER };
  }
  const { bonusMultiplier: _drop, ...rest } = draft;
  return { ...rest, id };
}

// ── terrain vertex editing ────────────────────────────────────────────────────

/** Append a vertex to the polyline at `polylineIndex` (out-of-range -> no-op). */
export function addVertex(draft: EditorDraft, polylineIndex: number, point: Point): EditorDraft {
  const line = draft.terrain[polylineIndex];
  if (line === undefined) {
    return draft;
  }
  const terrain = draft.terrain.map((existing, index) =>
    index === polylineIndex ? [...existing, point] : existing,
  );
  return { ...draft, terrain };
}

/** Move an existing vertex to a new position (out-of-range -> no-op). */
export function moveVertex(
  draft: EditorDraft,
  polylineIndex: number,
  vertexIndex: number,
  point: Point,
): EditorDraft {
  const line = draft.terrain[polylineIndex];
  if (line === undefined || line[vertexIndex] === undefined) {
    return draft;
  }
  const terrain = draft.terrain.map((existing, index) =>
    index === polylineIndex ? existing.map((v, i) => (i === vertexIndex ? point : v)) : existing,
  );
  return { ...draft, terrain };
}

/**
 * Delete a vertex. A polyline emptied by the deletion is dropped entirely so no
 * zero-point polyline lingers in the draft (out-of-range -> no-op).
 */
export function deleteVertex(
  draft: EditorDraft,
  polylineIndex: number,
  vertexIndex: number,
): EditorDraft {
  const line = draft.terrain[polylineIndex];
  if (line === undefined || line[vertexIndex] === undefined) {
    return draft;
  }
  const terrain = draft.terrain
    .map((existing, index) =>
      index === polylineIndex ? existing.filter((_v, i) => i !== vertexIndex) : existing,
    )
    .filter((existing) => existing.length > 0);
  return { ...draft, terrain };
}

/** Start a new polyline (optionally seeded with its first vertex). */
export function startNewPolyline(draft: EditorDraft, firstPoint?: Point): EditorDraft {
  const line: Point[] = firstPoint === undefined ? [] : [firstPoint];
  return { ...draft, terrain: [...draft.terrain, line] };
}

// ── entities ──────────────────────────────────────────────────────────────────

export function setVehicleSpawn(draft: EditorDraft, point: Point): EditorDraft {
  return { ...draft, vehicleSpawn: { x: point.x, y: point.y } };
}

export function setGoalFlag(draft: EditorDraft, rect: Rect): EditorDraft {
  return { ...draft, goalFlag: { ...rect } };
}

/** Move the goal flag's bottom-left anchor, keeping its width/height. */
export function moveGoalFlag(draft: EditorDraft, point: Point): EditorDraft {
  return { ...draft, goalFlag: { ...draft.goalFlag, x: point.x, y: point.y } };
}

export function setKillY(draft: EditorDraft, killY: number): EditorDraft {
  return { ...draft, killY };
}

export function addCoin(draft: EditorDraft, point: Point): EditorDraft {
  return { ...draft, coins: [...draft.coins, { x: point.x, y: point.y }] };
}

export function removeCoinAt(draft: EditorDraft, index: number): EditorDraft {
  if (draft.coins[index] === undefined) {
    return draft;
  }
  return { ...draft, coins: draft.coins.filter((_coin, i) => i !== index) };
}

// ── economy / tags ──────────────────────────────────────────────────────────────

export function setInkBudget(draft: EditorDraft, inkBudget: number): EditorDraft {
  return { ...draft, inkBudget };
}

/** Nudge the ink budget by `delta`, floored at 0 (stepper control). */
export function stepInkBudget(draft: EditorDraft, delta: number): EditorDraft {
  return { ...draft, inkBudget: Math.max(0, draft.inkBudget + delta) };
}

export function setStarThresholds(draft: EditorDraft, thresholds: StarThresholdsDraft): EditorDraft {
  return { ...draft, starThresholds: { star2: thresholds.star2, star3: thresholds.star3 } };
}

export function stepStar2(draft: EditorDraft, delta: number): EditorDraft {
  return setStarThresholds(draft, { ...draft.starThresholds, star2: Math.max(0, draft.starThresholds.star2 + delta) });
}

export function stepStar3(draft: EditorDraft, delta: number): EditorDraft {
  return setStarThresholds(draft, { ...draft.starThresholds, star3: Math.max(0, draft.starThresholds.star3 + delta) });
}

/** Toggle an anti-dominant (or future) gimmick tag on/off (unique set). */
export function toggleGimmick(draft: EditorDraft, tag: GimmickTag): EditorDraft {
  const has = draft.gimmickTags.includes(tag);
  const gimmickTags = has ? draft.gimmickTags.filter((t) => t !== tag) : [...draft.gimmickTags, tag];
  return { ...draft, gimmickTags };
}

// ── ghost slot ──────────────────────────────────────────────────────────────────

export function setGhost(draft: EditorDraft, ghost: GhostSolution): EditorDraft {
  return { ...draft, ghost };
}

export function clearGhost(draft: EditorDraft): EditorDraft {
  return { ...draft, ghost: null };
}

// ── derivation + validation ──────────────────────────────────────────────────────

/**
 * Derive the shipping Level JSON (a plain, possibly-invalid object). Points
 * become {x, y}, terrain vertices become [x, y] pairs, and the recorded ghost
 * (if any) becomes ghostSolutions[0]. bonusMultiplier / maxTicks are emitted
 * only when present, matching the schema's additionalProperties rules.
 */
export function draftToLevelJson(draft: EditorDraft): Record<string, unknown> {
  const json: Record<string, unknown> = {
    schemaVersion: 1,
    id: draft.id,
    terrain: draft.terrain.map((line) => line.map((point): [number, number] => [point.x, point.y])),
    vehicleSpawn: { x: draft.vehicleSpawn.x, y: draft.vehicleSpawn.y },
    goalFlag: { ...draft.goalFlag },
    killY: draft.killY,
    inkBudget: draft.inkBudget,
    starThresholds: { star2: draft.starThresholds.star2, star3: draft.starThresholds.star3 },
    coins: draft.coins.map((coin) => ({ x: coin.x, y: coin.y })),
    gimmickTags: [...draft.gimmickTags],
    ghostSolutions: draft.ghost === null ? [] : [draft.ghost],
  };
  if (draft.maxTicks !== undefined) {
    json['maxTicks'] = draft.maxTicks;
  }
  if (draft.bonusMultiplier !== undefined) {
    json['bonusMultiplier'] = draft.bonusMultiplier;
  }
  return json;
}

/**
 * Build a typed Level for the engine (testplay). ghostSolutions carries the
 * recorded ghost or is empty — GameSimulation never reads ghostSolutions, so an
 * empty one is fine for running a testplay to RECORD the first ghost. Call only
 * when canTestplay(draft) is true (geometry/economy already schema-valid).
 */
export function draftToLevel(draft: EditorDraft): Level {
  return {
    schemaVersion: 1,
    id: draft.id,
    terrain: draft.terrain.map((line) => line.map((point): readonly [number, number] => [point.x, point.y])),
    vehicleSpawn: { x: draft.vehicleSpawn.x, y: draft.vehicleSpawn.y },
    goalFlag: { ...draft.goalFlag },
    killY: draft.killY,
    inkBudget: draft.inkBudget,
    starThresholds: { star2: draft.starThresholds.star2, star3: draft.starThresholds.star3 },
    coins: draft.coins.map((coin) => ({ x: coin.x, y: coin.y })),
    gimmickTags: [...draft.gimmickTags],
    ghostSolutions: draft.ghost === null ? [] : [draft.ghost],
    ...(draft.maxTicks !== undefined ? { maxTicks: draft.maxTicks } : {}),
    ...(draft.bonusMultiplier !== undefined ? { bonusMultiplier: draft.bonusMultiplier } : {}),
  };
}

/** Run the draft through the shipping validator (the editor's save gate). */
export function validateDraft(draft: EditorDraft): LevelValidation {
  return validateLevel(draftToLevelJson(draft), { filenameStem: draft.id });
}

/** True when the draft (geometry + economy + recorded ghost) is shippable. */
export function canSave(draft: EditorDraft): boolean {
  return validateDraft(draft).ok;
}

/**
 * Validation errors EXCLUDING the "no ghost recorded" one — the set that must
 * be clear before a testplay can even run (you record the ghost by testplaying,
 * so its absence is not a reason to block testplay, but bad geometry is).
 */
export function testplayBlockers(draft: EditorDraft): readonly string[] {
  const result = validateDraft(draft);
  if (result.ok) {
    return [];
  }
  return result.errors.filter((error) => !error.startsWith(NO_GHOST_ERROR_PREFIX));
}

/** A draft can be testplayed once its geometry/economy validate (ghost aside). */
export function canTestplay(draft: EditorDraft): boolean {
  return testplayBlockers(draft).length === 0;
}

// ── import ────────────────────────────────────────────────────────────────────────

/** Turn a validated Level back into an editable draft (import / load existing). */
export function draftFromLevel(level: Level): EditorDraft {
  const draft: EditorDraft = {
    id: level.id,
    terrain: level.terrain.map((line) => line.map(([x, y]) => ({ x, y }))),
    vehicleSpawn: { x: level.vehicleSpawn.x, y: level.vehicleSpawn.y },
    goalFlag: { ...level.goalFlag },
    killY: level.killY,
    inkBudget: level.inkBudget,
    starThresholds: { star2: level.starThresholds.star2, star3: level.starThresholds.star3 },
    coins: level.coins.map((coin) => ({ x: coin.x, y: coin.y })),
    gimmickTags: [...level.gimmickTags],
    ghost: level.ghostSolutions[0] ?? null,
    ...(level.maxTicks !== undefined ? { maxTicks: level.maxTicks } : {}),
    ...(level.bonusMultiplier !== undefined ? { bonusMultiplier: level.bonusMultiplier } : {}),
  };
  return draft;
}

export type DraftParseResult =
  | { readonly ok: true; readonly draft: EditorDraft }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Parse + validate imported JSON text into a draft (import textarea path). */
export function draftFromJson(text: string): DraftParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    return { ok: false, errors: [`invalid JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const result = validateLevel(parsed);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }
  return { ok: true, draft: draftFromLevel(result.level) };
}

// ── geometry picking (scene hit-testing, kept pure + testable) ──────────────────────

export interface VertexRef {
  readonly polylineIndex: number;
  readonly vertexIndex: number;
  readonly distance: number;
}

/**
 * Nearest terrain vertex to `target` within `maxDistance` (world metres), or
 * null. Drives drag-to-move and long-press-to-delete hit testing.
 */
export function nearestVertex(draft: EditorDraft, target: Point, maxDistance: number): VertexRef | null {
  let best: VertexRef | null = null;
  draft.terrain.forEach((line, polylineIndex) => {
    line.forEach((vertex, vertexIndex) => {
      const distance = Math.hypot(vertex.x - target.x, vertex.y - target.y);
      if (distance <= maxDistance && (best === null || distance < best.distance)) {
        best = { polylineIndex, vertexIndex, distance };
      }
    });
  });
  return best;
}

/** Index of the nearest coin within `maxDistance`, or -1 (tap-to-remove). */
export function nearestCoinIndex(draft: EditorDraft, target: Point, maxDistance: number): number {
  let bestIndex = -1;
  let bestDistance = maxDistance;
  draft.coins.forEach((coin, index) => {
    const distance = Math.hypot(coin.x - target.x, coin.y - target.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

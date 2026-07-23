/**
 * LevelSchema — runtime types + validation for level JSON.
 *
 * Single source of truth shared by the game loader and Gate 0
 * (contracts/level-schema.md; scripts/gates/gate0-schema.mjs imports this
 * module). Implements JSON Schema constraints AND the beyond-schema code
 * checks (killY below terrain, star ordering, ghost sample consistency,
 * filename <-> id match, finiteness guards). The leaf parsers live in
 * ./LevelSchemaParse (extracted round-9 for the 800-line bound); this module
 * owns the type vocabulary, the section validators, and the validateLevel
 * orchestrator.
 *
 * VERSION GATING (round-9): schemaVersion 1 AND 2 both load. v1 keeps round-7
 * semantics (spike danger styles tolerated, star2+star3 ink thresholds) so the
 * 28 shipped levels stay green until CS-4 regenerates them as v2. v2 adds
 * persons + objective, narrows danger styles to 'zone', and drops the ink-based
 * star2. The version-specific rules are isolated in the section validators and
 * clearly marked TRANSITIONAL.
 *
 * Coordinates: world meters, y-up.
 */

import {
  checkUnknownKeys,
  isFiniteNumber,
  isInt,
  isRecord,
  parseDangerZone,
  parseDeclaredSolution,
  parseGhostSolution,
  parseObjective,
  parsePerson,
  parsePoint,
  parsePolyline,
  parseRect,
  parseRock,
} from './LevelSchemaParse';

/** First shipped level schema version (the version new v1 tools still write). */
export const CURRENT_LEVEL_SCHEMA_VERSION = 1;

/** Schema versions the loader accepts (round-9 adds 2 alongside legacy 1). */
export type LevelSchemaVersion = 1 | 2;
export const SUPPORTED_LEVEL_SCHEMA_VERSIONS: readonly LevelSchemaVersion[] = [1, 2];

/** `ch1-l01`..`ch1-l40` / `ch1-b1`..`ch1-b5` (conventions §3, round-9 40-slate). */
export const LEVEL_ID_PATTERN = /^ch1-(l(0[1-9]|[1-3][0-9]|40)|b[1-5])$/;

/** Bonus levels require `bonusMultiplier`; normal levels forbid it. */
export const BONUS_LEVEL_ID_PATTERN = /^ch1-b[1-5]$/;

/** maxTicks floor: 1 s at the fixed 60 Hz step — below this a level cannot be played. */
export const MIN_MAX_TICKS = 60;

/**
 * Minimum polyline segment length (world meters): consecutive vertices closer
 * than this (incl. exact duplicates) are a degenerate authoring error — they
 * add no geometry and can produce zero-length terrain chain / ghost stroke
 * segments. 0.01 m = 1 cm, far below any intentional level feature.
 */
export const POLYLINE_MIN_SEGMENT_M = 0.01;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Rock hazard radius bounds (world meters). A rock below ROCK_MIN_RADIUS_M is a
 * degenerate speck; above ROCK_MAX_RADIUS_M it dwarfs the car/level. Both are
 * authoring guards, not tunables (they bound the schema, not the physics feel).
 */
export const ROCK_MIN_RADIUS_M = 0.1;
export const ROCK_MAX_RADIUS_M = 5;

/**
 * A rolling/falling rock hazard placed in a level (optional `rocks[]`). Spawns as
 * a dynamic circle at {x, y} with the given `radius`; `density` overrides the
 * TuningConstants default; `initialVelocity` (m/s) seeds a roll/throw. Absent
 * `rocks` == a level with no rocks (fully backward compatible).
 *
 * TRIGGERED SPAWN (`triggerCarX`, optional): when present, the rock's body is NOT
 * created at run start — it is deterministically created the tick the car's
 * VehicleReferencePoint.x FIRST reaches `triggerCarX` (GameSimulation.step ->
 * RockHazard.updateTriggers). This synchronises the rock's fall/roll with the
 * car's arrival so a naive line is genuinely intercepted (user round-6). Before
 * the trigger the rock is ARMED (drawn as a translucent warning at its spawn, not
 * yet physical — it has no body, so it contributes nothing to the state hash and
 * touches nothing). Absent `triggerCarX` == the classic spawn-at-run-start rock.
 */
export interface Rock {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly density?: number;
  readonly initialVelocity?: Point;
  readonly triggerCarX?: number;
}

/** Bottom-left anchored rectangle (y-up). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * DangerZone VISUAL style (render-only). `zone` = a plain red hazard band — the
 * ONLY style since round-9 (designer ban on saw-tooth silhouettes; the legacy
 * `spike`/`spikeDown` values were removed once every shipped level regenerated
 * as v2 — CS-4c). The tag is INERT to physics/Judge (the engine always collides
 * the base rect regardless of style), so it never moves the hash. Absent == `zone`.
 */
export type DangerStyle = 'zone';

/** Allowed `style` values (all schema versions — spikes removed game-wide, round-9). */
export const DANGER_STYLES: readonly DangerStyle[] = ['zone'];

/** Alias kept for the version-gated v2 validation call sites. */
export const V2_DANGER_STYLES: readonly DangerStyle[] = DANGER_STYLES;

/**
 * A DangerZone hazard band (optional `dangerZones[]`): an axis-aligned,
 * bottom-left anchored rectangle plus an optional render-only `style` tag. The
 * CAR (chassis or a wheel) overlapping a zone fails with FailCause
 * 'hazardContact' (Judge; contact IS the loss and BEATS clear on a same-tick tie
 * per BR-009). Bridge segments and rocks passing through a zone are UNAFFECTED.
 *
 * ROUND-9 v2 (BR-012): zones also BLOCK DRAWING — a stroke may not enter a zone
 * rect (draw predicate = terrain ∪ dangerZones). That predicate lives in
 * GameSimulation (v2 only); the geometry here is unchanged.
 */
export interface DangerZone extends Rect {
  /** Render-only silhouette tag (physics-inert). Absent == 'zone'. */
  readonly style?: DangerStyle;
}

/** `[x, y]` vertex pair as stored in level JSON polylines. */
export type PolylinePoint = readonly [number, number];

/** Ordered vertex list, >= 2 points. Vertex order = collision top-side winding. */
export type Polyline = readonly PolylinePoint[];

export type GimmickTag = 'anti-dominant';

/**
 * Shape family of a declared solution stroke (round-8 multi-solution gate).
 * Fixed vocabulary — Gate 8 requires >= 2 DISTINCT tags per level.
 */
export type ShapeTag =
  | 'line'
  | 'arch'
  | 'hook'
  | 'trapezoid'
  | 'angle'
  | 'pillar'
  | 'wall'
  | 'sag'
  | 'ramp';

/** Allowed `shapeTag` values (validation vocabulary). */
export const SHAPE_TAGS: readonly ShapeTag[] = [
  'line',
  'arch',
  'hook',
  'trapezoid',
  'angle',
  'pillar',
  'wall',
  'sag',
  'ramp',
];

/**
 * One author-DECLARED alternative solution (optional `solutions[]`, round-8).
 * Unlike a GhostSolution it carries NO recorded result: the stroke is a RAW
 * authored polyline that Gate 8 PLAYS live through the exact player commit path.
 */
export interface DeclaredSolution {
  /** Shape family of this solution's stroke (SHAPE_TAGS vocabulary). */
  readonly shapeTag: ShapeTag;
  /** Raw authored stroke (world m) — replayed by Gate 8, never hand-recorded. */
  readonly stroke: Polyline;
}

/**
 * Level objective TYPE (round-9 v2, BR-014). `coins` = collect all level coins;
 * `noBreak` = finish the run with zero BridgeChain segment breaks. Drives the ★2
 * star and the results-screen objective label. Absent objective ⇒ ★2 defaults to
 * 'coins' (GameSimulation).
 */
export type ObjectiveType = 'coins' | 'noBreak';

/** Allowed `objective.type` values (validation vocabulary). */
export const OBJECTIVE_TYPES: readonly ObjectiveType[] = ['coins', 'noBreak'];

/** A level objective (round-9 v2): the ★2 target. */
export interface Objective {
  readonly type: ObjectiveType;
}

/**
 * A Person NPC obstacle center point (round-9 v2 `persons[]`, BR-011). Dimensions
 * come from TuningConstants (`person.halfWidth`/`halfHeight` ≈ 1.3×1.7 m); the
 * Judge derives the static AABB the CAR must avoid (chassis or wheel overlap ⇒
 * FailCause 'personContact', same priority tier as hazardContact). The drawn
 * BridgeChain is unaffected by persons. Persons live only in v2 levels.
 */
export type Person = Point;

export type GhostKind = 'any' | '3star';

export interface GhostSample {
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

export interface GhostResult {
  readonly outcome: 'clear';
  readonly ticks: number;
  readonly finalPos: Point;
  readonly inkConsumed: number;
  readonly starRating: 1 | 2 | 3;
}

export interface GhostSolution {
  readonly kind: GhostKind;
  /** Committed stroke (post-simplify, pre-resample), world meters. */
  readonly stroke: Polyline;
  readonly sampleEveryTicks: number;
  /** VehicleReferencePoint position samples — playback data, never input replay. */
  readonly samples: readonly GhostSample[];
  readonly result: GhostResult;
}

/**
 * Ink-length star thresholds. `star3` is the ★3 ink margin in BOTH schema
 * versions. `star2` is the ink-based ★2 threshold — LOAD-BEARING for v1, but
 * TRANSITIONAL for v2: v2 stars are objective-based (BR-014), so a v2 level need
 * not author star2 and StarRating v2 ignores it; validateLevel synthesizes a
 * placeholder (= inkBudget) so this type stays total and every existing consumer
 * (render/editor/atlas) keeps compiling untouched. Remove `star2` here once all
 * consumers are v2-aware.
 */
export interface StarThresholds {
  readonly star2: number;
  readonly star3: number;
}

export interface Level {
  readonly schemaVersion: LevelSchemaVersion;
  readonly id: string;
  readonly terrain: readonly Polyline[];
  readonly vehicleSpawn: Point;
  readonly goalFlag: Rect;
  readonly killY: number;
  readonly inkBudget: number;
  readonly starThresholds: StarThresholds;
  readonly coins: readonly Point[];
  readonly gimmickTags: readonly GimmickTag[];
  readonly ghostSolutions: readonly GhostSolution[];
  readonly maxTicks?: number;
  readonly bonusMultiplier?: number;
  /** Rolling/falling rock hazards (optional; absent == none). */
  readonly rocks?: readonly Rock[];
  /** DangerZone hazard bands — car overlap => 'hazardContact' (optional; absent == none). */
  readonly dangerZones?: readonly DangerZone[];
  /** Declared alternative solutions Gate 8 plays live (optional; absent == none, round-8). */
  readonly solutions?: readonly DeclaredSolution[];
  /** Person NPC obstacles — car overlap => 'personContact' (round-9 v2 only; absent == none). */
  readonly persons?: readonly Person[];
  /** ★2 objective (round-9 v2 only; absent ⇒ 'coins'). */
  readonly objective?: Objective;
}

export type LevelValidation =
  | { readonly ok: true; readonly level: Level }
  | { readonly ok: false; readonly errors: readonly string[] };

export interface ValidateLevelOptions {
  /** When provided, Gate 0 filename <-> id check: `id` must equal this stem. */
  readonly filenameStem?: string;
}

const LEVEL_KEYS = new Set([
  'schemaVersion',
  'id',
  'terrain',
  'vehicleSpawn',
  'goalFlag',
  'killY',
  'inkBudget',
  'starThresholds',
  'coins',
  'gimmickTags',
  'ghostSolutions',
  'maxTicks',
  'bonusMultiplier',
  'rocks',
  'dangerZones',
  'solutions',
  'persons',
  'objective',
]);

const GIMMICK_TAGS: readonly GimmickTag[] = ['anti-dominant'];

// -- validateLevel section helpers -----------------------------------------------
// validateLevel is a thin orchestrator over these; each helper owns one field
// group, pushes its own errors, and returns the parsed bundle (or undefined when
// a required member is missing). Call order preserves the original error order.

interface GeometryParts {
  readonly terrain: readonly Polyline[];
  readonly vehicleSpawn: Point;
  readonly goalFlag: Rect;
  readonly killY: number;
}

interface EconomyParts {
  readonly inkBudget: number;
  readonly starThresholds: StarThresholds;
}

interface CollectibleParts {
  readonly coins: readonly Point[];
  readonly gimmickTags: readonly GimmickTag[];
}

interface OptionalParts {
  readonly maxTicks?: number;
  readonly bonusMultiplier?: number;
  readonly rocks?: readonly Rock[];
  readonly dangerZones?: readonly DangerZone[];
  readonly solutions?: readonly DeclaredSolution[];
  readonly persons?: readonly Person[];
  readonly objective?: Objective;
}

/** schemaVersion must be a supported version (1 or 2). Returns it, or undefined. */
function validateSchemaVersion(json: Record<string, unknown>, errors: string[]): LevelSchemaVersion | undefined {
  const version = json['schemaVersion'];
  if (version === 1 || version === 2) {
    return version;
  }
  errors.push('schemaVersion: expected 1 or 2');
  return undefined;
}

/** id pattern + optional filename match. Returns the id (or undefined). */
function validateId(
  json: Record<string, unknown>,
  options: ValidateLevelOptions | undefined,
  errors: string[],
): string | undefined {
  const id = json['id'];
  if (typeof id !== 'string' || !LEVEL_ID_PATTERN.test(id)) {
    errors.push('id: expected pattern ch1-l01..ch1-l40 / ch1-b1..ch1-b5');
    return undefined;
  }
  if (options?.filenameStem !== undefined && options.filenameStem !== id) {
    errors.push(`id: "${id}" does not match filename stem "${options.filenameStem}"`);
  }
  return id;
}

/** terrain polylines + vehicleSpawn + goalFlag + killY (below lowest terrain y). */
function validateGeometry(json: Record<string, unknown>, errors: string[]): GeometryParts | undefined {
  const rawTerrain = json['terrain'];
  let terrain: Polyline[] | undefined;
  if (!Array.isArray(rawTerrain) || rawTerrain.length < 1) {
    errors.push('terrain: expected an array of >= 1 polylines');
  } else {
    terrain = [];
    for (const [i, polyline] of rawTerrain.entries()) {
      const parsed = parsePolyline(polyline, `terrain[${i}]`, errors);
      if (parsed === undefined) {
        terrain = undefined;
        break;
      }
      terrain.push(parsed);
    }
  }

  const vehicleSpawn = parsePoint(json['vehicleSpawn'], 'vehicleSpawn', errors);
  const goalFlag = parseRect(json['goalFlag'], 'goalFlag', errors);

  const killY = json['killY'];
  let killYValue: number | undefined;
  if (!isFiniteNumber(killY)) {
    errors.push('killY: expected a finite number');
  } else {
    killYValue = killY;
    if (terrain !== undefined) {
      const minTerrainY = Math.min(...terrain.flatMap((line) => line.map(([, y]) => y)));
      if (killY >= minTerrainY) {
        errors.push(`killY: ${killY} must be strictly below the lowest terrain vertex y (${minTerrainY})`);
      }
    }
  }

  if (terrain === undefined || vehicleSpawn === undefined || goalFlag === undefined || killYValue === undefined) {
    return undefined;
  }
  return { terrain, vehicleSpawn, goalFlag, killY: killYValue };
}

/**
 * inkBudget > 0 + starThresholds. v1: 0 < star3 < star2 <= inkBudget (unchanged).
 * v2 (BR-014, TRANSITIONAL): stars are objective-based, so only star3 is required
 * (0 < star3 <= inkBudget); star2 is optional and, when absent, synthesized as
 * inkBudget to keep the StarThresholds type total — StarRating v2 ignores it.
 */
function validateEconomy(
  json: Record<string, unknown>,
  schemaVersion: LevelSchemaVersion,
  errors: string[],
): EconomyParts | undefined {
  const inkBudget = json['inkBudget'];
  const hasValidInk = isFiniteNumber(inkBudget) && inkBudget > 0;
  if (!hasValidInk) {
    errors.push('inkBudget: expected a number > 0');
  }

  const rawThresholds = json['starThresholds'];
  let starThresholds: StarThresholds | undefined;
  if (!isRecord(rawThresholds)) {
    errors.push('starThresholds: expected an object {star2, star3}');
  } else if (schemaVersion === 2) {
    starThresholds = validateStarThresholdsV2(rawThresholds, inkBudget, errors);
  } else {
    starThresholds = validateStarThresholdsV1(rawThresholds, inkBudget, errors);
  }

  if (!hasValidInk || starThresholds === undefined) {
    return undefined;
  }
  return { inkBudget, starThresholds };
}

/** v1 ink thresholds: 0 < star3 < star2 <= inkBudget (round-7 semantics, unchanged). */
function validateStarThresholdsV1(
  rawThresholds: Record<string, unknown>,
  inkBudget: unknown,
  errors: string[],
): StarThresholds | undefined {
  checkUnknownKeys(rawThresholds, new Set(['star2', 'star3']), 'starThresholds', errors);
  const { star2, star3 } = rawThresholds;
  if (!isFiniteNumber(star2) || !isFiniteNumber(star3) || star3 <= 0 || star2 <= 0) {
    errors.push('starThresholds: star2 and star3 must be numbers > 0');
    return undefined;
  }
  if (star3 >= star2) {
    errors.push(`starThresholds: star3 (${star3}) must be < star2 (${star2})`);
    return undefined;
  }
  if (isFiniteNumber(inkBudget) && star2 > inkBudget) {
    errors.push(`starThresholds: star2 (${star2}) must be <= inkBudget (${inkBudget})`);
    return undefined;
  }
  return { star2, star3 };
}

/** v2 ink thresholds (BR-014): only star3 is load-bearing; star2 is synthesized. */
function validateStarThresholdsV2(
  rawThresholds: Record<string, unknown>,
  inkBudget: unknown,
  errors: string[],
): StarThresholds | undefined {
  checkUnknownKeys(rawThresholds, new Set(['star2', 'star3']), 'starThresholds', errors);
  const before = errors.length;
  const { star2: rawStar2, star3 } = rawThresholds;
  if (!isFiniteNumber(star3) || star3 <= 0) {
    errors.push('starThresholds: star3 must be a number > 0');
  } else if (isFiniteNumber(inkBudget) && star3 > inkBudget) {
    errors.push(`starThresholds: star3 (${star3}) must be <= inkBudget (${inkBudget})`);
  }
  // star2 is no longer ink-based; tolerate it if present, else synthesize inkBudget.
  let star2 = isFiniteNumber(inkBudget) ? inkBudget : (star3 as number);
  if (rawStar2 !== undefined) {
    if (!isFiniteNumber(rawStar2) || rawStar2 <= 0) {
      errors.push('starThresholds: star2 must be a number > 0 when present');
    } else {
      star2 = rawStar2;
    }
  }
  if (errors.length > before) {
    return undefined;
  }
  return { star2, star3: star3 as number };
}

/** coins (may be empty) + gimmickTags (vocabulary, unique). */
function validateCoinsAndTags(json: Record<string, unknown>, errors: string[]): CollectibleParts | undefined {
  const rawCoins = json['coins'];
  let coins: Point[] | undefined;
  if (!Array.isArray(rawCoins)) {
    errors.push('coins: expected an array of {x, y} points (may be empty)');
  } else {
    coins = [];
    for (const [i, entry] of rawCoins.entries()) {
      const point = parsePoint(entry, `coins[${i}]`, errors);
      if (point !== undefined) {
        coins.push(point);
      }
    }
  }

  const rawTags = json['gimmickTags'];
  let gimmickTags: GimmickTag[] | undefined;
  if (!Array.isArray(rawTags)) {
    errors.push('gimmickTags: expected an array (may be empty)');
  } else {
    gimmickTags = [];
    for (const [i, tag] of rawTags.entries()) {
      if (!GIMMICK_TAGS.includes(tag as GimmickTag)) {
        errors.push(`gimmickTags[${i}]: unknown tag "${String(tag)}" (vocabulary: ${GIMMICK_TAGS.join(', ')})`);
      } else if (gimmickTags.includes(tag as GimmickTag)) {
        errors.push(`gimmickTags[${i}]: duplicate tag "${String(tag)}" (uniqueItems)`);
      } else {
        gimmickTags.push(tag as GimmickTag);
      }
    }
  }

  if (coins === undefined || gimmickTags === undefined) {
    return undefined;
  }
  return { coins, gimmickTags };
}

/** ghostSolutions (>= 1 recorded clear, FR-024). */
function validateGhosts(json: Record<string, unknown>, errors: string[]): GhostSolution[] | undefined {
  const rawGhosts = json['ghostSolutions'];
  if (!Array.isArray(rawGhosts) || rawGhosts.length < 1) {
    errors.push('ghostSolutions: expected an array of >= 1 ghost solutions (FR-024: no level without a recorded clear)');
    return undefined;
  }
  const ghostSolutions: GhostSolution[] = [];
  for (const [i, ghost] of rawGhosts.entries()) {
    const parsed = parseGhostSolution(ghost, `ghostSolutions[${i}]`, errors);
    if (parsed !== undefined) {
      ghostSolutions.push(parsed);
    }
  }
  return ghostSolutions;
}

/**
 * Optional maxTicks + bonusMultiplier + rocks[] + dangerZones[] + solutions[]
 * (all additive/absent == none), plus the round-9 v2-only persons[] + objective.
 * A present-but-invalid entry pushes errors so validateLevel fails the level; an
 * absent one leaves the field unset (byte-identical to a level without it).
 */
function validateOptionalFields(
  json: Record<string, unknown>,
  rawId: unknown,
  schemaVersion: LevelSchemaVersion,
  errors: string[],
): OptionalParts {
  const parts: {
    maxTicks?: number;
    bonusMultiplier?: number;
    rocks?: readonly Rock[];
    dangerZones?: readonly DangerZone[];
    solutions?: readonly DeclaredSolution[];
    persons?: readonly Person[];
    objective?: Objective;
  } = {};

  const maxTicks = json['maxTicks'];
  if (maxTicks !== undefined && (!isInt(maxTicks) || maxTicks < MIN_MAX_TICKS)) {
    errors.push(`maxTicks: expected an integer >= ${MIN_MAX_TICKS}`);
  } else if (isInt(maxTicks)) {
    parts.maxTicks = maxTicks;
  }

  const bonusMultiplier = json['bonusMultiplier'];
  const isBonusLevel = typeof rawId === 'string' && BONUS_LEVEL_ID_PATTERN.test(rawId);
  if (isBonusLevel) {
    if (!isFiniteNumber(bonusMultiplier) || bonusMultiplier < 5 || bonusMultiplier > 10) {
      errors.push('bonusMultiplier: required on bonus levels (ch1-b*), range 5-10');
    } else {
      parts.bonusMultiplier = bonusMultiplier;
    }
  } else if (bonusMultiplier !== undefined) {
    errors.push('bonusMultiplier: forbidden on non-bonus levels');
  }

  const rawRocks = json['rocks'];
  if (rawRocks !== undefined) {
    if (!Array.isArray(rawRocks)) {
      errors.push('rocks: expected an array of rock objects (may be empty, or omit the key)');
    } else {
      const rocks: Rock[] = [];
      for (const [i, entry] of rawRocks.entries()) {
        const parsed = parseRock(entry, `rocks[${i}]`, errors);
        if (parsed !== undefined) {
          rocks.push(parsed);
        }
      }
      parts.rocks = rocks;
    }
  }

  // dangerZones[] — the allowed `style` set is VERSION-GATED (round-9): v2 permits
  // only 'zone'; v1 tolerates the deprecated spike styles for legacy load.
  const allowedStyles = schemaVersion === 2 ? V2_DANGER_STYLES : DANGER_STYLES;
  const rawZones = json['dangerZones'];
  if (rawZones !== undefined) {
    if (!Array.isArray(rawZones)) {
      errors.push('dangerZones: expected an array of {x, y, width, height, style?} rects (may be empty, or omit the key)');
    } else {
      const zones: DangerZone[] = [];
      for (const [i, entry] of rawZones.entries()) {
        const parsed = parseDangerZone(entry, `dangerZones[${i}]`, errors, allowedStyles);
        if (parsed !== undefined) {
          zones.push(parsed);
        }
      }
      parts.dangerZones = zones;
    }
  }

  const rawSolutions = json['solutions'];
  if (rawSolutions !== undefined) {
    if (!Array.isArray(rawSolutions)) {
      errors.push('solutions: expected an array of {shapeTag, stroke} objects (may be empty, or omit the key)');
    } else {
      const solutions: DeclaredSolution[] = [];
      for (const [i, entry] of rawSolutions.entries()) {
        const parsed = parseDeclaredSolution(entry, `solutions[${i}]`, errors);
        if (parsed !== undefined) {
          solutions.push(parsed);
        }
      }
      parts.solutions = solutions;
    }
  }

  parseVersionGatedFields(json, schemaVersion, parts, errors);
  return parts;
}

/** persons[] + objective — round-9 v2-only fields (rejected on a v1 level). */
function parseVersionGatedFields(
  json: Record<string, unknown>,
  schemaVersion: LevelSchemaVersion,
  parts: { persons?: readonly Person[]; objective?: Objective },
  errors: string[],
): void {
  const rawPersons = json['persons'];
  if (rawPersons !== undefined) {
    if (schemaVersion !== 2) {
      errors.push('persons: only valid in schemaVersion 2 levels');
    } else if (!Array.isArray(rawPersons)) {
      errors.push('persons: expected an array of {x, y} points (may be empty, or omit the key)');
    } else {
      const persons: Person[] = [];
      for (const [i, entry] of rawPersons.entries()) {
        const parsed = parsePerson(entry, `persons[${i}]`, errors);
        if (parsed !== undefined) {
          persons.push(parsed);
        }
      }
      parts.persons = persons;
    }
  }

  const rawObjective = json['objective'];
  if (rawObjective !== undefined) {
    if (schemaVersion !== 2) {
      errors.push('objective: only valid in schemaVersion 2 levels');
    } else {
      const parsed = parseObjective(rawObjective, 'objective', errors);
      if (parsed !== undefined) {
        parts.objective = parsed;
      }
    }
  }
}

/**
 * Validate arbitrary parsed JSON against the level contract.
 * Never throws; collects every detectable error into `errors`. Thin orchestrator
 * over the field-group helpers above (each owns one section of the contract).
 */
export function validateLevel(json: unknown, options?: ValidateLevelOptions): LevelValidation {
  const errors: string[] = [];
  if (!isRecord(json)) {
    return { ok: false, errors: ['level: expected a JSON object'] };
  }
  checkUnknownKeys(json, LEVEL_KEYS, 'level', errors);

  const schemaVersion = validateSchemaVersion(json, errors);
  const id = validateId(json, options, errors);
  const geometry = validateGeometry(json, errors);
  // Parse downstream against the declared version (default 1 when it is invalid, so
  // we still collect every other error); the assembly below fails on the version.
  const version = schemaVersion ?? 1;
  const economy = validateEconomy(json, version, errors);
  const collectibles = validateCoinsAndTags(json, errors);
  const ghostSolutions = validateGhosts(json, errors);
  const optionals = validateOptionalFields(json, json['id'], version, errors);

  if (
    errors.length > 0 ||
    schemaVersion === undefined ||
    id === undefined ||
    geometry === undefined ||
    economy === undefined ||
    collectibles === undefined ||
    ghostSolutions === undefined
  ) {
    return { ok: false, errors };
  }

  const level: Level = {
    schemaVersion,
    id,
    terrain: geometry.terrain,
    vehicleSpawn: geometry.vehicleSpawn,
    goalFlag: geometry.goalFlag,
    killY: geometry.killY,
    inkBudget: economy.inkBudget,
    starThresholds: economy.starThresholds,
    coins: collectibles.coins,
    gimmickTags: collectibles.gimmickTags,
    ghostSolutions,
    ...optionals,
  };
  return { ok: true, level };
}

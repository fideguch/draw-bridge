/**
 * LevelSchema — runtime types + validation for level JSON.
 *
 * Single source of truth shared by the game loader and Gate 0
 * (contracts/level-schema.md; scripts/gates/gate0-schema.mjs imports this
 * module). Implements JSON Schema constraints AND the beyond-schema code
 * checks (killY below terrain, star ordering, ghost sample consistency,
 * filename <-> id match, finiteness guards).
 *
 * Coordinates: world meters, y-up. schemaVersion current = 1.
 */

export const CURRENT_LEVEL_SCHEMA_VERSION = 1;

/** `ch1-l01`..`ch1-l15` / `ch1-b1`..`ch1-b3` (conventions §3). */
export const LEVEL_ID_PATTERN = /^ch1-(l(0[1-9]|1[0-5])|b[1-3])$/;

/** Bonus levels require `bonusMultiplier`; normal levels forbid it. */
export const BONUS_LEVEL_ID_PATTERN = /^ch1-b[1-3]$/;

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
 * `rocks` == a level with no rocks (fully backward compatible, schemaVersion 1).
 */
export interface Rock {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly density?: number;
  readonly initialVelocity?: Point;
}

/** Bottom-left anchored rectangle (y-up). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** `[x, y]` vertex pair as stored in level JSON polylines. */
export type PolylinePoint = readonly [number, number];

/** Ordered vertex list, >= 2 points. Vertex order = collision top-side winding. */
export type Polyline = readonly PolylinePoint[];

export type GimmickTag = 'anti-dominant';

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

export interface StarThresholds {
  readonly star2: number;
  readonly star3: number;
}

export interface Level {
  readonly schemaVersion: typeof CURRENT_LEVEL_SCHEMA_VERSION;
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
]);

const ROCK_KEYS = new Set(['x', 'y', 'radius', 'density', 'initialVelocity']);

const GHOST_KEYS = new Set(['kind', 'stroke', 'sampleEveryTicks', 'samples', 'result']);
const RESULT_KEYS = new Set(['outcome', 'ticks', 'finalPos', 'inkConsumed', 'starRating']);
const GIMMICK_TAGS: readonly GimmickTag[] = ['anti-dominant'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function checkUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path}: unknown key "${key}" (additionalProperties: false)`);
    }
  }
}

function parsePoint(value: unknown, path: string, errors: string[]): Point | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object {x, y}`);
    return undefined;
  }
  checkUnknownKeys(value, new Set(['x', 'y']), path, errors);
  if (!isFiniteNumber(value['x']) || !isFiniteNumber(value['y'])) {
    errors.push(`${path}: x and y must be finite numbers`);
    return undefined;
  }
  return { x: value['x'], y: value['y'] };
}

function parseRect(value: unknown, path: string, errors: string[]): Rect | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object {x, y, width, height}`);
    return undefined;
  }
  checkUnknownKeys(value, new Set(['x', 'y', 'width', 'height']), path, errors);
  const { x, y, width, height } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    errors.push(`${path}: x, y, width, height must be finite numbers`);
    return undefined;
  }
  if (width <= 0 || height <= 0) {
    errors.push(`${path}: width and height must be > 0`);
    return undefined;
  }
  return { x, y, width, height };
}

function parseRock(value: unknown, path: string, errors: string[]): Rock | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected a rock object {x, y, radius, density?, initialVelocity?}`);
    return undefined;
  }
  checkUnknownKeys(value, ROCK_KEYS, path, errors);
  const before = errors.length;

  if (!isFiniteNumber(value['x']) || !isFiniteNumber(value['y'])) {
    errors.push(`${path}: x and y must be finite numbers`);
  }
  const radius = value['radius'];
  if (!isFiniteNumber(radius) || radius < ROCK_MIN_RADIUS_M || radius > ROCK_MAX_RADIUS_M) {
    errors.push(`${path}.radius: expected a number in ${ROCK_MIN_RADIUS_M}..${ROCK_MAX_RADIUS_M} m`);
  }
  const density = value['density'];
  if (density !== undefined && (!isFiniteNumber(density) || density <= 0)) {
    errors.push(`${path}.density: expected a number > 0 when present`);
  }
  let initialVelocity: Point | undefined;
  const rawVelocity = value['initialVelocity'];
  if (rawVelocity !== undefined) {
    initialVelocity = parsePoint(rawVelocity, `${path}.initialVelocity`, errors);
  }

  if (errors.length > before) {
    return undefined;
  }
  return {
    x: value['x'] as number,
    y: value['y'] as number,
    radius: radius as number,
    ...(density !== undefined ? { density: density as number } : {}),
    ...(initialVelocity !== undefined ? { initialVelocity } : {}),
  };
}

function parsePolyline(value: unknown, path: string, errors: string[]): Polyline | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    errors.push(`${path}: expected an array of >= 2 [x, y] points`);
    return undefined;
  }
  const points: PolylinePoint[] = [];
  for (const [i, entry] of value.entries()) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isFiniteNumber(entry[0]) || !isFiniteNumber(entry[1])) {
      errors.push(`${path}[${i}]: expected an [x, y] pair of finite numbers`);
      return undefined;
    }
    const point: PolylinePoint = [entry[0], entry[1]];
    const previous = points[points.length - 1];
    if (previous !== undefined) {
      const segmentLength = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
      if (segmentLength < POLYLINE_MIN_SEGMENT_M) {
        errors.push(
          `${path}[${i}]: degenerate segment (${segmentLength.toFixed(4)} m < ${POLYLINE_MIN_SEGMENT_M} m) — consecutive points must not duplicate or near-coincide`,
        );
        return undefined;
      }
    }
    points.push(point);
  }
  return points;
}

function parseGhostSolution(value: unknown, path: string, errors: string[]): GhostSolution | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected a ghost solution object`);
    return undefined;
  }
  checkUnknownKeys(value, GHOST_KEYS, path, errors);
  const before = errors.length;

  const kind = value['kind'];
  if (kind !== 'any' && kind !== '3star') {
    errors.push(`${path}.kind: expected "any" | "3star"`);
  }

  const stroke = parsePolyline(value['stroke'], `${path}.stroke`, errors);

  const sampleEveryTicks = value['sampleEveryTicks'];
  if (!isInt(sampleEveryTicks) || sampleEveryTicks < 1) {
    errors.push(`${path}.sampleEveryTicks: expected an integer >= 1`);
  }

  const samples: GhostSample[] = [];
  const rawSamples = value['samples'];
  if (!Array.isArray(rawSamples) || rawSamples.length < 1) {
    errors.push(`${path}.samples: expected an array of >= 1 {t, x, y} samples`);
  } else {
    for (const [i, sample] of rawSamples.entries()) {
      if (!isRecord(sample)) {
        errors.push(`${path}.samples[${i}]: expected an object {t, x, y}`);
        continue;
      }
      checkUnknownKeys(sample, new Set(['t', 'x', 'y']), `${path}.samples[${i}]`, errors);
      const { t, x, y } = sample;
      if (!isInt(t) || t < 0 || !isFiniteNumber(x) || !isFiniteNumber(y)) {
        errors.push(`${path}.samples[${i}]: t must be an integer >= 0, x/y finite numbers`);
        continue;
      }
      samples.push({ t, x, y });
    }
  }

  const result = parseGhostResult(value['result'], `${path}.result`, errors);

  if (errors.length > before || stroke === undefined || result === undefined) {
    return undefined;
  }

  // Beyond-schema check: last sample must agree with the recorded result.
  const last = samples[samples.length - 1];
  if (last !== undefined && (last.t !== result.ticks || last.x !== result.finalPos.x || last.y !== result.finalPos.y)) {
    errors.push(`${path}: last sample {t: ${last.t}, x: ${last.x}, y: ${last.y}} is inconsistent with result.ticks/finalPos`);
    return undefined;
  }

  return {
    kind: kind as GhostKind,
    stroke,
    sampleEveryTicks: sampleEveryTicks as number,
    samples,
    result,
  };
}

function parseGhostResult(value: unknown, path: string, errors: string[]): GhostResult | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected a result object`);
    return undefined;
  }
  checkUnknownKeys(value, RESULT_KEYS, path, errors);
  const before = errors.length;

  if (value['outcome'] !== 'clear') {
    errors.push(`${path}.outcome: must be "clear" (ghosts are recorded clears)`);
  }
  if (!isInt(value['ticks']) || (value['ticks'] as number) < 1) {
    errors.push(`${path}.ticks: expected an integer >= 1`);
  }
  const finalPos = parsePoint(value['finalPos'], `${path}.finalPos`, errors);
  if (!isFiniteNumber(value['inkConsumed']) || (value['inkConsumed'] as number) <= 0) {
    errors.push(`${path}.inkConsumed: expected a number > 0`);
  }
  const starRating = value['starRating'];
  if (starRating !== 1 && starRating !== 2 && starRating !== 3) {
    errors.push(`${path}.starRating: expected 1 | 2 | 3`);
  }

  if (errors.length > before || finalPos === undefined) {
    return undefined;
  }
  return {
    outcome: 'clear',
    ticks: value['ticks'] as number,
    finalPos,
    inkConsumed: value['inkConsumed'] as number,
    starRating: starRating as 1 | 2 | 3,
  };
}

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
}

/** schemaVersion const + id pattern + optional filename match. Returns the id. */
function validateIdentity(
  json: Record<string, unknown>,
  options: ValidateLevelOptions | undefined,
  errors: string[],
): string | undefined {
  if (json['schemaVersion'] !== CURRENT_LEVEL_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected const ${CURRENT_LEVEL_SCHEMA_VERSION}`);
  }
  const id = json['id'];
  if (typeof id !== 'string' || !LEVEL_ID_PATTERN.test(id)) {
    errors.push('id: expected pattern ch1-l01..ch1-l15 / ch1-b1..ch1-b3');
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

/** inkBudget > 0 + starThresholds (0 < star3 < star2 <= inkBudget). */
function validateEconomy(json: Record<string, unknown>, errors: string[]): EconomyParts | undefined {
  const inkBudget = json['inkBudget'];
  const hasValidInk = isFiniteNumber(inkBudget) && inkBudget > 0;
  if (!hasValidInk) {
    errors.push('inkBudget: expected a number > 0');
  }

  const rawThresholds = json['starThresholds'];
  let starThresholds: StarThresholds | undefined;
  if (!isRecord(rawThresholds)) {
    errors.push('starThresholds: expected an object {star2, star3}');
  } else {
    checkUnknownKeys(rawThresholds, new Set(['star2', 'star3']), 'starThresholds', errors);
    const { star2, star3 } = rawThresholds;
    if (!isFiniteNumber(star2) || !isFiniteNumber(star3) || star3 <= 0 || star2 <= 0) {
      errors.push('starThresholds: star2 and star3 must be numbers > 0');
    } else if (star3 >= star2) {
      errors.push(`starThresholds: star3 (${star3}) must be < star2 (${star2})`);
    } else if (isFiniteNumber(inkBudget) && star2 > inkBudget) {
      errors.push(`starThresholds: star2 (${star2}) must be <= inkBudget (${inkBudget})`);
    } else {
      starThresholds = { star2, star3 };
    }
  }

  if (!hasValidInk || starThresholds === undefined) {
    return undefined;
  }
  return { inkBudget, starThresholds };
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
 * Optional maxTicks (>= MIN_MAX_TICKS) + bonusMultiplier (iff bonus id, 5-10) +
 * rocks[] (absent == none). A present-but-invalid rocks entry pushes errors so
 * validateLevel fails the whole level; an absent `rocks` leaves parts.rocks unset
 * so the assembled Level has NO rocks key (byte-identical to pre-rock levels).
 */
function validateOptionalFields(json: Record<string, unknown>, rawId: unknown, errors: string[]): OptionalParts {
  const parts: { maxTicks?: number; bonusMultiplier?: number; rocks?: readonly Rock[] } = {};

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

  return parts;
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

  const id = validateIdentity(json, options, errors);
  const geometry = validateGeometry(json, errors);
  const economy = validateEconomy(json, errors);
  const collectibles = validateCoinsAndTags(json, errors);
  const ghostSolutions = validateGhosts(json, errors);
  const optionals = validateOptionalFields(json, json['id'], errors);

  if (
    errors.length > 0 ||
    id === undefined ||
    geometry === undefined ||
    economy === undefined ||
    collectibles === undefined ||
    ghostSolutions === undefined
  ) {
    return { ok: false, errors };
  }

  const level: Level = {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
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

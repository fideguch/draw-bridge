/**
 * LevelSchemaParse — pure field-level parsers + guards for LevelSchema.
 *
 * Extracted from LevelSchema.ts (round-9) to keep both files under the 800-line
 * bound. These are the leaf parsers (`parseX` returns a typed value or pushes
 * errors); LevelSchema.ts keeps the section validators + validateLevel
 * orchestrator that call them. Behaviour is byte-for-byte identical to the
 * pre-extraction inline versions — same error strings, same order — plus the
 * round-9 additions (version-gated danger styles, persons, objective).
 *
 * Every function is pure: never throws, never mutates its input, and touches the
 * shared vocab consts only inside its body (so the value import from LevelSchema
 * is resolved lazily at validate time, not at module load — no init-order hazard).
 */

import type {
  DangerStyle,
  DangerZone,
  DeclaredSolution,
  GhostKind,
  GhostResult,
  GhostSolution,
  Objective,
  ObjectiveType,
  Point,
  Polyline,
  PolylinePoint,
  Rect,
  Rock,
  ShapeTag,
} from './LevelSchema';
import {
  OBJECTIVE_TYPES,
  POLYLINE_MIN_SEGMENT_M,
  ROCK_MAX_RADIUS_M,
  ROCK_MIN_RADIUS_M,
  SHAPE_TAGS,
} from './LevelSchema';

const SOLUTION_KEYS = new Set(['shapeTag', 'stroke']);
const ROCK_KEYS = new Set(['x', 'y', 'radius', 'density', 'initialVelocity', 'triggerCarX']);
const GHOST_KEYS = new Set(['kind', 'stroke', 'sampleEveryTicks', 'samples', 'result']);
const RESULT_KEYS = new Set(['outcome', 'ticks', 'finalPos', 'inkConsumed', 'starRating']);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function checkUnknownKeys(
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

export function parsePoint(value: unknown, path: string, errors: string[]): Point | undefined {
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

export function parseRect(value: unknown, path: string, errors: string[]): Rect | undefined {
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

/**
 * A DangerZone: a Rect plus an optional render-only `style` tag. `allowedStyles`
 * is version-gated by the caller (round-9): v1 accepts zone/spike/spikeDown for
 * legacy tolerance; v2 accepts only 'zone' (spikes are removed game-wide). Absent
 * `style` yields a zone with NO style key (byte-identical to a pre-style zone).
 */
export function parseDangerZone(
  value: unknown,
  path: string,
  errors: string[],
  allowedStyles: readonly DangerStyle[],
): DangerZone | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object {x, y, width, height, style?}`);
    return undefined;
  }
  checkUnknownKeys(value, new Set(['x', 'y', 'width', 'height', 'style']), path, errors);
  const before = errors.length;
  const { x, y, width, height } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    errors.push(`${path}: x, y, width, height must be finite numbers`);
  } else if (width <= 0 || height <= 0) {
    errors.push(`${path}: width and height must be > 0`);
  }
  const style = value['style'];
  if (style !== undefined && !allowedStyles.includes(style as DangerStyle)) {
    errors.push(`${path}.style: expected one of ${allowedStyles.join(' | ')} when present`);
  }
  if (errors.length > before) {
    return undefined;
  }
  return {
    x: x as number,
    y: y as number,
    width: width as number,
    height: height as number,
    ...(style !== undefined ? { style: style as DangerStyle } : {}),
  };
}

export function parseRock(value: unknown, path: string, errors: string[]): Rock | undefined {
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
  const triggerCarX = value['triggerCarX'];
  if (triggerCarX !== undefined && !isFiniteNumber(triggerCarX)) {
    errors.push(`${path}.triggerCarX: expected a finite number when present (the car-x that spawns the rock)`);
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
    ...(triggerCarX !== undefined ? { triggerCarX: triggerCarX as number } : {}),
  };
}

/**
 * A DeclaredSolution: `shapeTag` from SHAPE_TAGS + a raw stroke polyline (round-8).
 * Reuses parsePolyline so a declared stroke obeys the same geometry rules.
 */
export function parseDeclaredSolution(value: unknown, path: string, errors: string[]): DeclaredSolution | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object {shapeTag, stroke}`);
    return undefined;
  }
  checkUnknownKeys(value, SOLUTION_KEYS, path, errors);
  const before = errors.length;
  const shapeTag = value['shapeTag'];
  if (!SHAPE_TAGS.includes(shapeTag as ShapeTag)) {
    errors.push(`${path}.shapeTag: expected one of ${SHAPE_TAGS.join(' | ')}`);
  }
  const stroke = parsePolyline(value['stroke'], `${path}.stroke`, errors);
  if (errors.length > before || stroke === undefined) {
    return undefined;
  }
  return { shapeTag: shapeTag as ShapeTag, stroke };
}

/**
 * A Person NPC obstacle (round-9, v2-only `persons[]`): the AABB centre point.
 * Dimensions come from TuningConstants (Judge derives the rect); the level JSON
 * carries only {x, y}. Reuses parsePoint for the finiteness / shape guard.
 */
export function parsePerson(value: unknown, path: string, errors: string[]): Point | undefined {
  return parsePoint(value, path, errors);
}

/** A level objective (round-9, v2-only): `{ type: 'coins' | 'noBreak' }`. */
export function parseObjective(value: unknown, path: string, errors: string[]): Objective | undefined {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object {type}`);
    return undefined;
  }
  checkUnknownKeys(value, new Set(['type']), path, errors);
  const type = value['type'];
  if (!OBJECTIVE_TYPES.includes(type as ObjectiveType)) {
    errors.push(`${path}.type: expected one of ${OBJECTIVE_TYPES.join(' | ')}`);
    return undefined;
  }
  return { type: type as ObjectiveType };
}

export function parsePolyline(value: unknown, path: string, errors: string[]): Polyline | undefined {
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

export function parseGhostSolution(value: unknown, path: string, errors: string[]): GhostSolution | undefined {
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

  const samples: { t: number; x: number; y: number }[] = [];
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

export function parseGhostResult(value: unknown, path: string, errors: string[]): GhostResult | undefined {
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

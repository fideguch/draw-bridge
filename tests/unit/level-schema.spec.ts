import { describe, expect, it } from 'vitest';
import type { Level, LevelValidation } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { loadLevel } from '@engine/level/LevelLoader';
import exampleValid from '../fixtures/levels/example-valid.json';

/**
 * T010 — level schema validation (contracts/level-schema.md is the source of
 * truth; the fixture is the contract §3 minimal example verbatim).
 */

type MutableLevelJson = Record<string, unknown>;

function cloneFixture(): MutableLevelJson {
  return structuredClone(exampleValid) as MutableLevelJson;
}

/** Clone the fixture reshaped into a valid bonus level (ch1-b1). */
function cloneBonusFixture(): MutableLevelJson {
  const json = cloneFixture();
  json['id'] = 'ch1-b1';
  json['bonusMultiplier'] = 6;
  return json;
}

function expectOk(result: LevelValidation): Level {
  if (!result.ok) {
    expect.fail(`expected ok but got errors: ${result.errors.join(' | ')}`);
  }
  return result.level;
}

function expectErrors(result: LevelValidation): readonly string[] {
  if (result.ok) {
    expect.fail('expected validation errors but result was ok');
  }
  expect(result.errors.length).toBeGreaterThan(0);
  return result.errors;
}

describe('validateLevel — accepts the contract example', () => {
  it('validates the minimal example level from contracts/level-schema.md §3', () => {
    const level = expectOk(validateLevel(cloneFixture()));
    expect(level.schemaVersion).toBe(1);
    expect(level.id).toBe('ch1-l01');
    expect(level.terrain).toHaveLength(2);
    expect(level.terrain[0]?.[0]).toEqual([-10, 0]);
    expect(level.vehicleSpawn).toEqual({ x: -8, y: 0.6 });
    expect(level.goalFlag).toEqual({ x: 10, y: 0, width: 1.5, height: 2.5 });
    expect(level.killY).toBe(-7);
    expect(level.inkBudget).toBe(18);
    expect(level.starThresholds).toEqual({ star2: 12, star3: 8 });
    expect(level.coins).toHaveLength(3);
    expect(level.gimmickTags).toEqual([]);
    expect(level.ghostSolutions).toHaveLength(1);
    expect(level.ghostSolutions[0]?.kind).toBe('any');
    expect(level.ghostSolutions[0]?.result.starRating).toBe(3); // genuine recorded ghost (T029)
    expect(level.maxTicks).toBeUndefined();
    expect(level.bonusMultiplier).toBeUndefined();
  });

  it('accepts a valid bonus level (ch1-b1 with bonusMultiplier)', () => {
    const level = expectOk(validateLevel(cloneBonusFixture()));
    expect(level.id).toBe('ch1-b1');
    expect(level.bonusMultiplier).toBe(6);
  });

  it('accepts optional maxTicks and gimmickTags vocabulary', () => {
    const json = cloneFixture();
    json['maxTicks'] = 1200;
    json['gimmickTags'] = ['anti-dominant'];
    const level = expectOk(validateLevel(json));
    expect(level.maxTicks).toBe(1200);
    expect(level.gimmickTags).toEqual(['anti-dominant']);
  });

  it('accepts star2 === inkBudget (star2 <= inkBudget boundary)', () => {
    const json = cloneFixture();
    json['starThresholds'] = { star2: 18, star3: 8 };
    expectOk(validateLevel(json));
  });
});

describe('validateLevel — required fields', () => {
  const requiredKeys = [
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
  ] as const;

  it.each(requiredKeys)('rejects a level missing %s', (key) => {
    const json = cloneFixture();
    delete json[key];
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain(key);
  });

  it('rejects non-object input', () => {
    expectErrors(validateLevel(null));
    expectErrors(validateLevel('ch1-l01'));
    expectErrors(validateLevel([1, 2, 3]));
  });

  it('rejects unknown top-level keys (additionalProperties: false)', () => {
    const json = cloneFixture();
    json['stageName'] = 'nope';
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('stageName');
  });
});

describe('validateLevel — schemaVersion / id', () => {
  it('rejects schemaVersion !== 1', () => {
    const json = cloneFixture();
    json['schemaVersion'] = 2;
    expectErrors(validateLevel(json));
  });

  it.each(['ch1-l00', 'ch1-l16', 'ch1-l1', 'ch2-l01', 'ch1-b4', 'ch1-b01'])(
    'rejects malformed id %s',
    (id) => {
      const json = cloneFixture();
      json['id'] = id;
      const errors = expectErrors(validateLevel(json));
      expect(errors.join('\n')).toContain('id');
    },
  );

  it('rejects id/filename mismatch when filenameStem is provided', () => {
    const errors = expectErrors(validateLevel(cloneFixture(), { filenameStem: 'ch1-l02' }));
    expect(errors.join('\n')).toContain('filename');
  });

  it('accepts a matching filenameStem', () => {
    expectOk(validateLevel(cloneFixture(), { filenameStem: 'ch1-l01' }));
  });
});

describe('validateLevel — geometry and numbers', () => {
  it('rejects a terrain polyline with fewer than 2 points', () => {
    const json = cloneFixture();
    json['terrain'] = [[[-10, 0]]];
    expectErrors(validateLevel(json));
  });

  it('rejects empty terrain', () => {
    const json = cloneFixture();
    json['terrain'] = [];
    expectErrors(validateLevel(json));
  });

  it('rejects non-finite terrain coordinates (NaN guard)', () => {
    const json = cloneFixture();
    json['terrain'] = [
      [
        [Number.NaN, 0],
        [10, 0],
      ],
    ];
    expectErrors(validateLevel(json));
  });

  it('rejects a terrain polyline with consecutive duplicate points (M4)', () => {
    const json = cloneFixture();
    json['terrain'] = [
      [
        [-10, 0],
        [-10, 0], // exact duplicate — degenerate zero-length segment
        [-1, 0],
      ],
    ];
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toMatch(/degenerate/i);
  });

  it('rejects a terrain segment shorter than the 0.01 m epsilon (M4)', () => {
    const json = cloneFixture();
    json['terrain'] = [
      [
        [0, 0],
        [0.005, 0], // 5 mm < 0.01 m epsilon
        [5, 0],
      ],
    ];
    expectErrors(validateLevel(json));
  });

  it('accepts a terrain segment exactly at the 0.01 m epsilon (inclusive boundary, M4)', () => {
    const json = cloneFixture();
    json['terrain'] = [
      [
        [0, 0],
        [0.01, 0], // exactly the epsilon — allowed
        [5, 0],
      ],
    ];
    expectOk(validateLevel(json)); // killY -7 stays below the flat terrain (min y 0)
  });

  it('rejects a ghost stroke with a degenerate (near-duplicate) segment (M4)', () => {
    const json = cloneFixture();
    const ghosts = json['ghostSolutions'] as MutableLevelJson[];
    (ghosts[0] as MutableLevelJson)['stroke'] = [
      [-2, 0.15],
      [-2, 0.15], // duplicate stroke vertex
      [2, 0.15],
    ];
    expectErrors(validateLevel(json));
  });

  it('rejects killY not strictly below the lowest terrain vertex', () => {
    const json = cloneFixture();
    json['killY'] = -5; // fixture terrain min y is -5 → must be strictly below
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('killY');
  });

  it('rejects inkBudget <= 0', () => {
    const json = cloneFixture();
    json['inkBudget'] = 0;
    expectErrors(validateLevel(json));
  });

  it('rejects a goalFlag with non-positive width', () => {
    const json = cloneFixture();
    json['goalFlag'] = { x: 10, y: 0, width: 0, height: 2.5 };
    expectErrors(validateLevel(json));
  });

  it('rejects maxTicks below 60', () => {
    const json = cloneFixture();
    json['maxTicks'] = 59;
    expectErrors(validateLevel(json));
  });
});

describe('validateLevel — starThresholds (0 < star3 < star2 <= inkBudget)', () => {
  it('rejects star3 >= star2', () => {
    const json = cloneFixture();
    json['starThresholds'] = { star2: 8, star3: 8 };
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('star');
  });

  it('rejects star2 > inkBudget', () => {
    const json = cloneFixture();
    json['starThresholds'] = { star2: 19, star3: 8 };
    expectErrors(validateLevel(json));
  });

  it('rejects non-positive star3', () => {
    const json = cloneFixture();
    json['starThresholds'] = { star2: 12, star3: 0 };
    expectErrors(validateLevel(json));
  });
});

describe('validateLevel — ghostSolutions', () => {
  it('rejects an empty ghostSolutions array (minItems 1)', () => {
    const json = cloneFixture();
    json['ghostSolutions'] = [];
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('ghostSolutions');
  });

  it('rejects a ghost with an unknown kind', () => {
    const json = cloneFixture();
    const ghosts = json['ghostSolutions'] as MutableLevelJson[];
    (ghosts[0] as MutableLevelJson)['kind'] = '2star';
    expectErrors(validateLevel(json));
  });

  it('rejects a ghost whose last sample disagrees with result.finalPos/ticks', () => {
    const json = cloneFixture();
    const ghosts = json['ghostSolutions'] as MutableLevelJson[];
    (ghosts[0] as MutableLevelJson)['result'] = {
      outcome: 'clear',
      ticks: 299,
      finalPos: { x: 10.4, y: 0.9 },
      inkConsumed: 9.6,
      starRating: 2,
    };
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('sample');
  });

  it('rejects a ghost with outcome other than clear', () => {
    const json = cloneFixture();
    const ghosts = json['ghostSolutions'] as MutableLevelJson[];
    const result = (ghosts[0] as MutableLevelJson)['result'] as MutableLevelJson;
    result['outcome'] = 'fail';
    expectErrors(validateLevel(json));
  });
});

describe('validateLevel — bonusMultiplier iff bonus id', () => {
  it('rejects bonusMultiplier on a normal level (ch1-l01)', () => {
    const json = cloneFixture();
    json['bonusMultiplier'] = 6;
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('bonusMultiplier');
  });

  it('rejects a bonus level (ch1-b1) without bonusMultiplier', () => {
    const json = cloneBonusFixture();
    delete json['bonusMultiplier'];
    const errors = expectErrors(validateLevel(json));
    expect(errors.join('\n')).toContain('bonusMultiplier');
  });

  it.each([4.9, 10.1])('rejects bonusMultiplier out of range 5-10 (%f)', (value) => {
    const json = cloneBonusFixture();
    json['bonusMultiplier'] = value;
    expectErrors(validateLevel(json));
  });
});

describe('validateLevel — optional rocks[] hazards', () => {
  it('a level with NO rocks key is valid and has no rocks (backward compatible)', () => {
    const level = expectOk(validateLevel(cloneFixture()));
    expect(level.rocks).toBeUndefined();
    expect(level.schemaVersion).toBe(1); // additive optional field: version unchanged
  });

  it('accepts a present-but-empty rocks array (no rocks)', () => {
    const json = cloneFixture();
    json['rocks'] = [];
    const level = expectOk(validateLevel(json));
    expect(level.rocks).toEqual([]);
  });

  it('accepts a full rock (radius + density + initialVelocity)', () => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 1, y: 3, radius: 0.4, density: 5, initialVelocity: { x: -2, y: 0 } }];
    const level = expectOk(validateLevel(json));
    expect(level.rocks).toHaveLength(1);
    expect(level.rocks?.[0]).toEqual({ x: 1, y: 3, radius: 0.4, density: 5, initialVelocity: { x: -2, y: 0 } });
  });

  it('accepts a minimal rock (only x, y, radius)', () => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 0, y: 2, radius: 0.5 }];
    const level = expectOk(validateLevel(json));
    expect(level.rocks?.[0]).toEqual({ x: 0, y: 2, radius: 0.5 });
    expect(level.rocks?.[0]?.density).toBeUndefined();
    expect(level.rocks?.[0]?.initialVelocity).toBeUndefined();
  });

  it.each([0.05, 6])('rejects an out-of-range rock radius (%f)', (radius) => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 0, y: 2, radius }];
    expectErrors(validateLevel(json));
  });

  it.each([0, -3])('rejects a non-positive rock density (%f)', (density) => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 0, y: 2, radius: 0.4, density }];
    expectErrors(validateLevel(json));
  });

  it('rejects a non-finite initialVelocity component', () => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 0, y: 2, radius: 0.4, initialVelocity: { x: 1, y: Number.POSITIVE_INFINITY } }];
    expectErrors(validateLevel(json));
  });

  it('rejects an unknown key inside a rock (additionalProperties: false)', () => {
    const json = cloneFixture();
    json['rocks'] = [{ x: 0, y: 2, radius: 0.4, bounce: true }];
    expectErrors(validateLevel(json));
  });

  it('rejects rocks that is not an array', () => {
    const json = cloneFixture();
    json['rocks'] = { x: 0, y: 2, radius: 0.4 };
    expectErrors(validateLevel(json));
  });
});

describe('loadLevel — parse + validate + typed Level', () => {
  it('loads a valid level from JSON text', () => {
    const level = expectOk(loadLevel(JSON.stringify(exampleValid)));
    expect(level.id).toBe('ch1-l01');
  });

  it('returns errors (not throws) on malformed JSON text', () => {
    const errors = expectErrors(loadLevel('{ not json'));
    expect(errors.join('\n').toLowerCase()).toContain('parse');
  });

  it('returns validation errors for schema-invalid JSON text', () => {
    const json = cloneFixture();
    delete json['killY'];
    expectErrors(loadLevel(JSON.stringify(json)));
  });

  it('forwards filenameStem to validation', () => {
    expectErrors(loadLevel(JSON.stringify(exampleValid), { filenameStem: 'ch1-l02' }));
  });
});

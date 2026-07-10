import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { validateLevel } from '@engine/level/LevelSchema';
import { World } from '@engine/physics/World';
import {
  LINE_DISPLACEMENT_MAX_M,
  lineDisplacementCheck,
  measureLineDisplacement,
} from '../../scripts/gates/lineDisplacement';

/**
 * Gate 6 — line displacement (round-7 F5, game_plan_v5 §9.2). Snapshot the settled
 * bridge at the car's launch, then track the max node shove as the car drives. A
 * well-anchored line barely moves; a floppy one drifts past the limit. All attempts
 * recycle ONE World (phaser-box2d 32-slot cap). Real shipped levels are the
 * fixtures: a badly-shoved one is the negative control, an anchored one passes.
 */

const world = new World();
afterAll(() => world.destroy());

function loadJson(id: string): { json: unknown } {
  return { json: JSON.parse(readFileSync(join(process.cwd(), 'levels', `${id}.json`), 'utf-8')) };
}

describe('measureLineDisplacement', () => {
  it('returns a finite max-shove metric for a shipped level', () => {
    const parsed = validateLevel(loadJson('ch1-l02').json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = measureLineDisplacement(parsed.level, world);
    expect(result.committed).toBe(true);
    expect(result.maxDisplacement).not.toBeNull();
    expect(Number.isFinite(result.maxDisplacement ?? NaN)).toBe(true);
    expect(result.maxDisplacement ?? -1).toBeGreaterThanOrEqual(0);
  });
});

describe('lineDisplacementCheck', () => {
  it('NEGATIVE CONTROL: a badly-shoved shipped line (ch1-l12) FAILS the limit', () => {
    const result = lineDisplacementCheck(loadJson('ch1-l12'), world);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('line-displacement');
  });

  it('a well-anchored shipped line (ch1-l02) PASSES within the limit', () => {
    const result = lineDisplacementCheck(loadJson('ch1-l02'), world);
    expect(result.errors).toEqual([]);
    expect((result.warnings ?? []).join(' ')).toContain('line-displacement');
  });

  it('the limit constant is the plan\'s 0.3 m F5 threshold', () => {
    expect(LINE_DISPLACEMENT_MAX_M).toBe(0.3);
  });
});

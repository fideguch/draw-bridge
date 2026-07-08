/**
 * terrain-winding — PRIORITY-0 regression guard for one-sided terrain collision.
 *
 * Real-device report (2026-07-08): "線を引いても地形に引っかからない・判定がない地形が
 * ある → 進行不可能" (drawn lines don't catch / some terrain has no collision). Prime
 * suspect: phaser-box2d chain shapes are ONE-SIDED and the recent 18-level
 * redesign (762f69d) added plateaus, ceilings, overhangs, spikes, stairs and a
 * wall — any polyline whose winding faces the wrong way is a ghost surface.
 *
 * This suite pins BOTH defenses, each with a NON-VACUOUS negative control
 * (learnings.md §A2: "a passing check must also FAIL on bad input"):
 *   1. DYNAMIC — scripts/probe/terrain-probe drops a body onto every drive
 *      surface / ceiling and verifies it is solid from its functional side.
 *   2. STATIC — scripts/gates/gate1 windingErrors classifies each polyline's
 *      required side from geometry and asserts the authored winding provides it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateLevel, type Level, type Polyline } from '@engine/level/LevelSchema';
import { probeLevel } from '../../scripts/probe/terrain-probe';
import { windingErrors } from '../../scripts/gates/gate1-static';

function loadLevels(): { name: string; level: Level }[] {
  return readdirSync('levels')
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const parsed = validateLevel(JSON.parse(readFileSync(`levels/${f}`, 'utf-8')));
      if (!parsed.ok) throw new Error(`levels/${f} invalid: ${parsed.errors.join(' | ')}`);
      return { name: f.replace(/\.json$/, ''), level: parsed.level };
    });
}

/** Reverse every polyline's winding — the exact defect the guards must catch. */
function reverseWinding(terrain: readonly Polyline[]): Polyline[] {
  return terrain.map((pl) => [...pl].reverse());
}

const LEVELS = loadLevels();

describe('terrain winding — static Gate 1 collision-side check', () => {
  it('reports zero winding errors across all 18 shipped levels', () => {
    for (const { name, level } of LEVELS) {
      const errors = windingErrors(level.terrain);
      expect(errors, `${name}: ${errors.join(' | ')}`).toEqual([]);
    }
  });

  it('NEGATIVE CONTROL: a reversed-winding drive surface is flagged (guard is not vacuous)', () => {
    // ch1-l03 has a flat-topped central pillar (a plateau drive surface).
    const l03 = LEVELS.find((l) => l.name === 'ch1-l03')!;
    const broken = reverseWinding(l03.level.terrain);
    const errors = windingErrors(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toMatch(/GHOST/);
  });

  it('NEGATIVE CONTROL: a reversed (left→right) ceiling is flagged', () => {
    // ch1-l09 carries a rock ceiling (2-point polyline, underside solid).
    const l09 = LEVELS.find((l) => l.name === 'ch1-l09')!;
    const broken = reverseWinding(l09.level.terrain);
    const errors = windingErrors(broken);
    expect(errors.some((e) => e.includes('ceiling'))).toBe(true);
  });
});

describe('terrain winding — dynamic collision probe', () => {
  it('every drive surface is solid from above and every ceiling from below (all 18 levels)', () => {
    for (const { name, level } of LEVELS) {
      const ghosts = probeLevel(name, level).filter((f) => !f.ok);
      expect(
        ghosts,
        `${name} ghost surfaces: ${ghosts.map((g) => `poly${g.polyline}/seg${g.segment}(${g.result})`).join(', ')}`,
      ).toEqual([]);
    }
  });

  it('NEGATIVE CONTROL: reversed winding turns a plateau top into a detected ghost', () => {
    const l03 = LEVELS.find((l) => l.name === 'ch1-l03')!;
    const broken: Level = { ...l03.level, terrain: reverseWinding(l03.level.terrain) };
    const ghosts = probeLevel('ch1-l03-reversed', broken).filter((f) => !f.ok);
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.some((g) => g.result.includes('GHOST'))).toBe(true);
  });
});

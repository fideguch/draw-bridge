/**
 * Gate 3 contract tests — the straight-line bot must be a MEANINGFUL
 * dominance check, not a vacuous pass.
 *
 * Regression guard for the zero-overlap bug: exact rim-to-rim strokes have no
 * platform overlap and slide into every gap, so a bot limited to them "fails"
 * everywhere and Gate 3 passes vacuously. The calibrated candidate set adds
 * overlap extensions {0, 1, 2} m (contract gate-pipeline.md §5, calibratable).
 *
 * ROUND-9 SCOPE: v1-legacy — the anti-dominant bot on the shipped v1 fixtures
 * (CS-1 keeps it green). Under BR-015 (free solutions) lazyLine/anti-dominance
 * become advisory; that gate-policy recalibration is CS-4's, not CS-1's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gate3Check } from '../../scripts/gates/gate3-antidominant';

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/gate-levels/${name}.json`, 'utf-8')) as unknown;
}

describe('gate 3 anti-dominant bot', () => {
  it('passes a genuinely anti-dominant level (ch1-l08: +2m rise defeats all 9 straight candidates)', () => {
    const { errors } = gate3Check({ json: loadFixture('ch1-l08') });
    expect(errors).toEqual([]);
  });

  it('no-ops on untagged levels', () => {
    const { errors } = gate3Check({ json: loadFixture('ch1-l01') });
    expect(errors).toEqual([]);
  });

  it('CATCHES dominance: a flat gap tagged anti-dominant must fail (overlapped straights clear it)', () => {
    const flat = loadFixture('ch1-l01') as Record<string, unknown>;
    const tagged = { ...flat, gimmickTags: ['anti-dominant'] };
    const { errors } = gate3Check({ json: tagged });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('straight-line bot CLEARED');
  });
});

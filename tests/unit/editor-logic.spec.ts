/**
 * editor-logic — pure editorState draft ops + the FR-024 save gate (T082).
 *
 * The editor's save gate IS the shipping validator (validateLevel): a draft
 * without a recorded ghost must fail on the ghostSolutions rule; the same draft
 * WITH the canonical fixture's recorded ghost must pass. Geometry/economy edits
 * round-trip through draftToLevelJson without corrupting the level.
 */

import { describe, expect, it } from 'vitest';
import exampleValid from '../fixtures/levels/example-valid.json';
import type { Level } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import {
  addVertex,
  canSave,
  clearGhost,
  createStarterDraft,
  deleteVertex,
  draftFromLevel,
  draftToLevel,
  draftToLevelJson,
  moveVertex,
  nearestCoinIndex,
  nearestVertex,
  removeCoinAt,
  addCoin,
  setId,
  startNewPolyline,
  stepInkBudget,
  testplayBlockers,
  toggleGimmick,
  validateDraft,
} from '../../src/editor/editorState';

function exampleLevel(): Level {
  const result = validateLevel(exampleValid);
  if (!result.ok) {
    throw new Error(`fixture example-valid.json is invalid: ${result.errors.join(', ')}`);
  }
  return result.level;
}

describe('editorState — terrain vertex editing', () => {
  it('adds a vertex to the active polyline', () => {
    const base = startNewPolyline(createStarterDraft('ch1-l01'), { x: 0, y: 0 });
    const lineIndex = base.terrain.length - 1;
    const next = addVertex(base, lineIndex, { x: 1, y: 2 });
    expect(next.terrain[lineIndex]).toHaveLength(2);
    expect(next.terrain[lineIndex]?.[1]).toEqual({ x: 1, y: 2 });
    // immutability: the original draft is untouched
    expect(base.terrain[lineIndex]).toHaveLength(1);
  });

  it('moves an existing vertex without touching its neighbours', () => {
    const draft = createStarterDraft('ch1-l01');
    const moved = moveVertex(draft, 0, 1, { x: 99, y: -3 });
    expect(moved.terrain[0]?.[1]).toEqual({ x: 99, y: -3 });
    expect(moved.terrain[0]?.[0]).toEqual(draft.terrain[0]?.[0]);
  });

  it('deletes a vertex and drops a polyline emptied by the deletion', () => {
    const oneVertexLine = startNewPolyline(createStarterDraft('ch1-l01'), { x: 5, y: 5 });
    const lineCount = oneVertexLine.terrain.length;
    const after = deleteVertex(oneVertexLine, lineCount - 1, 0);
    expect(after.terrain).toHaveLength(lineCount - 1);
  });

  it('nearestVertex finds the closest handle within range, null otherwise', () => {
    const draft = createStarterDraft('ch1-l01');
    const near = nearestVertex(draft, { x: -10.05, y: 0.05 }, 0.5);
    expect(near).not.toBeNull();
    expect(near?.polylineIndex).toBe(0);
    expect(near?.vertexIndex).toBe(0);
    expect(nearestVertex(draft, { x: 1000, y: 1000 }, 0.5)).toBeNull();
  });
});

describe('editorState — coins', () => {
  it('adds and removes coins by nearest index', () => {
    const withCoin = addCoin(createStarterDraft('ch1-l01'), { x: 0, y: 1 });
    expect(withCoin.coins).toHaveLength(1);
    const idx = nearestCoinIndex(withCoin, { x: 0.1, y: 1.1 }, 0.5);
    expect(idx).toBe(0);
    expect(removeCoinAt(withCoin, idx).coins).toHaveLength(0);
  });
});

describe('editorState — id constraints', () => {
  it('adds bonusMultiplier for bonus ids and strips it for normal ids', () => {
    const bonus = setId(createStarterDraft('ch1-l01'), 'ch1-b1');
    expect(bonus.id).toBe('ch1-b1');
    expect(bonus.bonusMultiplier).toBeGreaterThanOrEqual(5);
    const normal = setId(bonus, 'ch1-l02');
    expect(normal.bonusMultiplier).toBeUndefined();
  });

  it('toggles the anti-dominant gimmick tag as a unique set', () => {
    const on = toggleGimmick(createStarterDraft('ch1-l01'), 'anti-dominant');
    expect(on.gimmickTags).toEqual(['anti-dominant']);
    expect(toggleGimmick(on, 'anti-dominant').gimmickTags).toEqual([]);
  });
});

describe('editorState — draft <-> Level round-trip', () => {
  it('round-trips the fixture through draftFromLevel -> draftToLevelJson -> validateLevel', () => {
    const draft = draftFromLevel(exampleLevel());
    const result = validateLevel(draftToLevelJson(draft));
    expect(result.ok).toBe(true);
  });

  it('draftToLevel produces an engine-ready Level equal in geometry to the fixture', () => {
    const original = exampleLevel();
    const rebuilt = draftToLevel(draftFromLevel(original));
    expect(rebuilt.terrain).toEqual(original.terrain);
    expect(rebuilt.vehicleSpawn).toEqual(original.vehicleSpawn);
    expect(rebuilt.goalFlag).toEqual(original.goalFlag);
    expect(rebuilt.inkBudget).toBe(original.inkBudget);
    expect(rebuilt.ghostSolutions).toHaveLength(1);
  });
});

describe('editorState — FR-024 save gate', () => {
  it('BLOCKS save when no ghost is recorded, with the ghostSolutions error', () => {
    const draft = clearGhost(draftFromLevel(exampleLevel()));
    const result = validateDraft(draft);
    expect(canSave(draft)).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.startsWith('ghostSolutions:'))).toBe(true);
    }
  });

  it('ALLOWS save once the recorded ghost is present (fixture geometry)', () => {
    const draft = draftFromLevel(exampleLevel());
    expect(draft.ghost).not.toBeNull();
    expect(canSave(draft)).toBe(true);
    expect(validateDraft(draft).ok).toBe(true);
  });

  it('allows testplay on valid geometry even before a ghost exists (you record it by testplaying)', () => {
    const noGhost = clearGhost(draftFromLevel(exampleLevel()));
    expect(testplayBlockers(noGhost)).toEqual([]);
  });

  it('reports geometry blockers (excluding the ghost) when geometry is broken', () => {
    // killY above the terrain is a real geometry error that must block testplay.
    const broken = clearGhost(draftFromLevel(exampleLevel()));
    const withBadKillY = { ...broken, killY: 100 };
    expect(testplayBlockers(withBadKillY).length).toBeGreaterThan(0);
  });
});

describe('editorState — economy steppers', () => {
  it('nudges inkBudget and floors at 0', () => {
    const draft = createStarterDraft('ch1-l01');
    expect(stepInkBudget(draft, 5).inkBudget).toBe(draft.inkBudget + 5);
    expect(stepInkBudget(draft, -100000).inkBudget).toBe(0);
  });
});

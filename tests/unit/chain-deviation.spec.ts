import { describe, expect, it } from 'vitest';
import { GameSimulation } from '@engine/GameSimulation';
import { arcStroke, buildSpikeLevel } from '../../src/debug/SpikeScenario';

/**
 * QG-6 — chainMidDeviationM shape-fidelity probe (game-feel rebuild 2026-07-08).
 *
 * The dev hook exposes this as bridgeMidDeviationM to prove, on real devices,
 * that a solidified stroke keeps the shape the player drew (the "line reverts to
 * straight" fix) and that the firm flex budget holds that shape under settling
 * rather than collapsing rope-like. It is the perpendicular deviation (m) of the
 * live chain midpoint from the chord joining the two bridge endpoints.
 */
describe('GameSimulation.chainMidDeviationM — QG-6 shape fidelity', () => {
  it('is 0 before any stroke is solidified', () => {
    const level = buildSpikeLevel(2);
    const sim = new GameSimulation(level, { method: 'chain' });
    try {
      expect(sim.chainMidDeviationM()).toBe(0);
    } finally {
      sim.destroy();
    }
  });

  it('a solidified arc (apex 0.55m) holds its bow: >= 0.35m at commit, >= 0.3m after settling', () => {
    const level = buildSpikeLevel(2);
    const sim = new GameSimulation(level, { method: 'chain' });
    try {
      // A firm short arch over a 2m gap (1m overlap each side, ~0.55m bow).
      const commit = sim.commitStroke(arcStroke(2, { bowM: 0.55, overlapM: 1.0, baseY: 0.05 }));
      expect(commit.committed).toBe(true);

      // Immediately after commit the chain sits at the drawn shape — the mid
      // deviation reflects the ~0.55 m bow (>= 0.35 leaves generous slack).
      const atCommit = sim.chainMidDeviationM();
      expect(atCommit).toBeGreaterThanOrEqual(0.35);

      // 60 settle ticks: a firm bridge sags a little but holds most of the bow.
      for (let i = 0; i < 60; i++) {
        sim.step();
      }
      const afterSettle = sim.chainMidDeviationM();
      expect(afterSettle).toBeGreaterThanOrEqual(0.3);
    } finally {
      sim.destroy();
    }
  });
});

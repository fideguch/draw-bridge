import { describe, expect, it } from 'vitest';
import { InkBudget } from '@engine/rules/InkBudget';
import { rateStars, rateStarsV2 } from '@engine/rules/StarRating';
import { economy, ink } from '@tuning/TuningConstants';

/**
 * T026 — ink budget + star rating (FR-002, FR-007, FR-019).
 *
 * InkBudget: effective budget = level.inkBudget x (1 + inkCapacityLv x
 * economy.inkPerLevelPct/100) — a REAL multiplier per BR-005 (base ink clears
 * all levels; the upgrade genuinely extends it). consume/refund/zone/canDraw.
 *
 * Zone boundaries (documented contract, ink.warnYellowRatio/warnRedRatio):
 * - 'ok'       : remaining ratio  > 0.5      (bar white/normal)
 * - 'low'      : 0.2 <= ratio <= 0.5         (bar turns yellow AT 50%)
 * - 'critical' : ratio < 0.2                 (bar turns red strictly BELOW 20%)
 *
 * Star boundaries (data-model §1.6, both INCLUSIVE — less ink = better):
 * - consumed <= star3            -> 3 (== star3 still 3 stars)
 * - star3 < consumed <= star2    -> 2 (== star2 still 2 stars)
 * - consumed > star2             -> 1 (star1 on ANY clear per FR-007)
 */

const LEVEL_BUDGET = 18; // matches tests/fixtures/levels/example-valid.json
const THRESHOLDS = { star2: 12, star3: 8 } as const;

describe('InkBudget — effective budget (FR-002, FR-019, BR-005)', () => {
  it('Lv0 effective budget equals the level inkBudget', () => {
    const budget = new InkBudget({ levelInkBudget: LEVEL_BUDGET });
    expect(budget.effectiveBudget).toBe(LEVEL_BUDGET);
    expect(budget.remaining).toBe(LEVEL_BUDGET);
    expect(budget.consumed).toBe(0);
    expect(budget.ratio).toBe(1);
    expect(budget.canDraw).toBe(true);
  });

  it('inkCapacityLv is a REAL multiplier: Lv2 = x(1 + 2 x 10%)', () => {
    const budget = new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: 2 });
    expect(budget.effectiveBudget).toBeCloseTo(
      LEVEL_BUDGET * (1 + 2 * (economy.inkPerLevelPct / 100)),
      12,
    );
    expect(budget.effectiveBudget).toBeCloseTo(21.6, 12);
  });

  it('Lv5 (economy.maxUpgradeLevel) = x1.5', () => {
    const budget = new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: economy.maxUpgradeLevel });
    expect(budget.effectiveBudget).toBeCloseTo(27, 12);
  });

  it('rejects invalid inkCapacityLv (negative, fractional, above cap)', () => {
    expect(() => new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: -1 })).toThrow();
    expect(() => new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: 1.5 })).toThrow();
    expect(
      () => new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: economy.maxUpgradeLevel + 1 }),
    ).toThrow();
  });

  it('rejects invalid levelInkBudget (zero, negative, non-finite)', () => {
    expect(() => new InkBudget({ levelInkBudget: 0 })).toThrow();
    expect(() => new InkBudget({ levelInkBudget: -3 })).toThrow();
    expect(() => new InkBudget({ levelInkBudget: Number.NaN })).toThrow();
  });
});

describe('InkBudget — consume / refund (FR-002, FR-003)', () => {
  it('consume decrements remaining and returns the amount consumed', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    expect(budget.consume(4)).toBe(4);
    expect(budget.remaining).toBe(6);
    expect(budget.consumed).toBe(4);
  });

  it('consume clamps to remaining; canDraw turns false at empty', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(9.5);
    expect(budget.consume(2)).toBeCloseTo(0.5, 12); // only 0.5 left
    expect(budget.remaining).toBe(0);
    expect(budget.canDraw).toBe(false);
    expect(budget.consume(1)).toBe(0); // nothing left to consume
  });

  it('refund restores remaining and reduces consumed (min-length discard, FR-003)', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(3);
    expect(budget.refund(3)).toBe(3);
    expect(budget.remaining).toBe(10);
    expect(budget.consumed).toBe(0);
    expect(budget.zone).toBe('ok');
  });

  it('refund clamps to consumed — remaining never exceeds the effective budget', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(2);
    expect(budget.refund(5)).toBe(2); // only 2 were ever consumed
    expect(budget.remaining).toBe(10);
  });

  it('rejects negative or non-finite consume/refund amounts', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    expect(() => budget.consume(-1)).toThrow();
    expect(() => budget.consume(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => budget.refund(-1)).toThrow();
    expect(() => budget.refund(Number.NaN)).toThrow();
  });
});

describe('InkBudget — zone thresholds at exact boundaries (FR-002)', () => {
  it('ratio just above 50% is ok', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(4.9); // remaining 5.1 -> ratio 0.51
    expect(budget.zone).toBe('ok');
  });

  it('ratio exactly at ink.warnYellowRatio (50%) is low — bar turns yellow AT the mark', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(5); // remaining 5 -> ratio 0.5 exactly
    expect(budget.ratio).toBeCloseTo(ink.warnYellowRatio, 12);
    expect(budget.zone).toBe('low');
  });

  it('ratio exactly at ink.warnRedRatio (20%) is still low — critical is strictly below', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(8); // remaining 2 -> ratio 0.2 exactly
    expect(budget.ratio).toBeCloseTo(ink.warnRedRatio, 12);
    expect(budget.zone).toBe('low');
  });

  it('ratio just below 20% is critical', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(8.1); // remaining 1.9 -> ratio 0.19
    expect(budget.zone).toBe('critical');
  });

  it('empty budget is critical', () => {
    const budget = new InkBudget({ levelInkBudget: 10 });
    budget.consume(10);
    expect(budget.zone).toBe('critical');
  });
});

describe('rateStars (FR-007, data-model §1.6)', () => {
  it('3 stars when consumed is strictly under star3', () => {
    expect(rateStars(5, THRESHOLDS)).toBe(3);
  });

  it('3 stars at exactly star3 (inclusive boundary)', () => {
    expect(rateStars(THRESHOLDS.star3, THRESHOLDS)).toBe(3);
  });

  it('2 stars just above star3', () => {
    expect(rateStars(THRESHOLDS.star3 + 0.001, THRESHOLDS)).toBe(2);
  });

  it('2 stars at exactly star2 (inclusive boundary)', () => {
    expect(rateStars(THRESHOLDS.star2, THRESHOLDS)).toBe(2);
  });

  it('1 star above star2 — any clear earns at least one star', () => {
    expect(rateStars(THRESHOLDS.star2 + 0.001, THRESHOLDS)).toBe(1);
    expect(rateStars(1000, THRESHOLDS)).toBe(1);
  });

  it('thresholds compare raw consumption, unscaled by upgrades (data-model §1.6)', () => {
    // A player with ink upgrades still needs the same absolute consumption for stars.
    const budget = new InkBudget({ levelInkBudget: LEVEL_BUDGET, inkCapacityLv: 5 });
    budget.consume(THRESHOLDS.star3);
    expect(rateStars(budget.consumed, THRESHOLDS)).toBe(3);
  });

  it('rejects negative or non-finite consumption', () => {
    expect(() => rateStars(-1, THRESHOLDS)).toThrow();
    expect(() => rateStars(Number.NaN, THRESHOLDS)).toThrow();
  });
});

describe('rateStarsV2 — objective-based stars (round-9 BR-014)', () => {
  const STAR3 = 8;

  it('★1 = cleared but objective NOT met (any ink)', () => {
    expect(rateStarsV2(false, 1, STAR3)).toBe(1);
    expect(rateStarsV2(false, 100, STAR3)).toBe(1);
  });

  it('★2 = objective met but over the ink margin', () => {
    expect(rateStarsV2(true, STAR3 + 0.001, STAR3)).toBe(2);
    expect(rateStarsV2(true, 50, STAR3)).toBe(2);
  });

  it('★3 = objective met AND within the ink margin (inclusive at star3)', () => {
    expect(rateStarsV2(true, STAR3, STAR3)).toBe(3);
    expect(rateStarsV2(true, 2, STAR3)).toBe(3);
  });

  it('rejects negative or non-finite consumption', () => {
    expect(() => rateStarsV2(true, -1, STAR3)).toThrow();
    expect(() => rateStarsV2(true, Number.NaN, STAR3)).toThrow();
  });
});

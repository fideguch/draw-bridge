import { describe, expect, it } from 'vitest';
import { shouldOfferInkUpsell, type InkUpsellInputs } from '@render/scenes/play/inkUpsell';

/**
 * Ink-upsell decision (round-7 migration, game_plan_v5 §4 / DESIGN.md §8.4).
 * Migrated off the pre-round-7 cause==='fall' key: the upsell now fires on a
 * user-facing loss (hazardContact/tipOver/timeout) OR ≥2 consecutive out-of-world
 * failsafe resets in one level, keeping the ≥90%-ink + headroom conditions.
 */

/** A base case that passes the ink + headroom conditions (consumed = 92% of budget). */
function base(overrides: Partial<InkUpsellInputs> = {}): InkUpsellInputs {
  return {
    cause: 'hazardContact',
    consecutiveFailsafeResets: 0,
    consumed: 9.2,
    effectiveBudget: 10,
    inkCapacityLevel: 0,
    maxUpgradeLevel: 3,
    ...overrides,
  };
}

describe('shouldOfferInkUpsell — branch A: user-facing fail', () => {
  it.each(['hazardContact', 'tipOver', 'timeout'] as const)(
    'offers on user-facing cause %s when ink ~spent + headroom',
    (cause) => {
      expect(shouldOfferInkUpsell(base({ cause }))).toBe(true);
    },
  );

  it('does NOT offer on a single failsafe reset (fall) — that is silent-reset', () => {
    expect(shouldOfferInkUpsell(base({ cause: 'fall', consecutiveFailsafeResets: 1 }))).toBe(false);
  });

  it('does NOT offer on divergence with fewer than 2 resets', () => {
    expect(shouldOfferInkUpsell(base({ cause: 'divergence', consecutiveFailsafeResets: 1 }))).toBe(false);
  });
});

describe('shouldOfferInkUpsell — branch B: repeated failsafe resets', () => {
  it('offers after ≥2 consecutive failsafe resets (fall) with ink ~spent + headroom', () => {
    expect(shouldOfferInkUpsell(base({ cause: 'fall', consecutiveFailsafeResets: 2 }))).toBe(true);
  });

  it('offers on divergence too once the streak reaches 2', () => {
    expect(shouldOfferInkUpsell(base({ cause: 'divergence', consecutiveFailsafeResets: 3 }))).toBe(true);
  });

  it('does NOT count the streak for a non-failsafe cause', () => {
    // timeout is user-facing, so it offers via branch A regardless of the streak;
    // but a hypothetical non-failsafe cause never uses the streak branch.
    expect(shouldOfferInkUpsell(base({ cause: 'timeout', consecutiveFailsafeResets: 5 }))).toBe(true);
  });
});

describe('shouldOfferInkUpsell — ink + headroom conditions (both branches)', () => {
  it('does NOT offer when ink is under 90% consumed', () => {
    expect(shouldOfferInkUpsell(base({ consumed: 8.9, effectiveBudget: 10 }))).toBe(false);
  });

  it('offers exactly at the 90% consumed boundary', () => {
    expect(shouldOfferInkUpsell(base({ consumed: 9.0, effectiveBudget: 10 }))).toBe(true);
  });

  it('does NOT offer when the ink axis is maxed out (no headroom)', () => {
    expect(shouldOfferInkUpsell(base({ inkCapacityLevel: 3, maxUpgradeLevel: 3 }))).toBe(false);
  });

  it('does NOT offer with a non-positive effective budget', () => {
    expect(shouldOfferInkUpsell(base({ consumed: 0, effectiveBudget: 0 }))).toBe(false);
  });

  it('repeated-failsafe branch still requires the ink condition', () => {
    expect(
      shouldOfferInkUpsell(base({ cause: 'fall', consecutiveFailsafeResets: 3, consumed: 5, effectiveBudget: 10 })),
    ).toBe(false);
  });
});

/**
 * format.ts — small display formatters shared by the meta screens.
 */

/**
 * Group a coin balance with thousands separators (e.g. 1250 → "1,250").
 * Truncates to an integer; coin balances are always non-negative integers
 * (SaveData invariant), but this stays defensive for display.
 */
export function formatCoins(value: number): string {
  return Math.trunc(value).toLocaleString('en-US');
}

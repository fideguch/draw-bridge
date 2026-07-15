/**
 * resetConfirm.ts — the type-to-confirm logic for the progress-reset modal
 * (SC-008 / FR-020, trust pattern P5 "適切な摩擦").
 *
 * APPROACH — in-canvas character sequence (not a DOM input): the second confirm
 * modal shows the target string「リセット」and four character buttons in a
 * shuffled order; the player must tap リ→セ→ッ→ト in order. A single wrong tap
 * clears the sequence, so the execute button only activates on an exact match of
 * the frozen string. This was chosen over a DOM `<input>` overlay because:
 *   - It renders inside the Phaser canvas → immune to the letterbox/scale offset
 *     that makes an absolutely-positioned DOM input unreliable on mobile.
 *   - It needs no katakana IME switch (friction without an input-method trap).
 *   - The reducer below is a pure function → unit-testable without Phaser.
 */

import { t } from '@render/i18n';

/**
 * The exact string the player must reproduce to reset progress. Resolved at CALL
 * time (never module-load) so it follows the device locale — see i18n/index.ts.
 */
export function resetWord(): string {
  return t('settings.resetWord');
}

/** The individual tappable characters (shuffled for display in the scene). */
export function resetChars(): readonly string[] {
  return Array.from(resetWord());
}

/**
 * Append a tapped character to the in-progress sequence. Returns the new
 * sequence when it remains a prefix of the target, or '' when the tap breaks the
 * order (forcing an exact-order restart). Pure — never mutates its input.
 */
export function appendConfirmChar(current: string, char: string, target: string): string {
  const next = current + char;
  return target.startsWith(next) ? next : '';
}

/** True once the typed sequence exactly equals the target (execute may enable). */
export function isConfirmComplete(current: string, target: string): boolean {
  return current === target;
}

import type { HapticEvent, HapticsInterface } from '../interfaces';

/**
 * Browser HapticsInterface over `navigator.vibrate` (amplitude-only
 * approximation). Where vibrate is unsupported, `isAvailable` is false and
 * `impact` no-ops. Never throws (FR-022).
 *
 * The event → duration mapping is a coarse web fallback; the rich iOS/Android
 * generator mapping lives in CapacitorHaptics (contract §3 table).
 */
const VIBRATE_PATTERN: Record<HapticEvent, number | number[]> = {
  confirm: 10,
  launch: 20,
  land: 30,
  coin: 8,
  creak: 6, // overridden by intensity when provided
  starSequence: [10, 40, 20, 40, 30], // light → medium → heavy
  inkDepleted: [20, 40, 20], // double-click warning
};

export class WebHaptics implements HapticsInterface {
  impact(kind: HapticEvent, intensity?: number): void {
    if (!this.isAvailable()) return;
    const pattern =
      kind === 'creak' && intensity !== undefined
        ? Math.round(4 + Math.max(0, Math.min(1, intensity)) * 16)
        : VIBRATE_PATTERN[kind];
    try {
      navigator.vibrate(pattern);
    } catch {
      // swallow — haptics failures never block progress (FR-022)
    }
  }

  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }
}

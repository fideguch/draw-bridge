import type { HapticEvent, HapticsInterface } from '../interfaces';

/**
 * Haptics terminator for devices/environments without vibration hardware
 * (contracts/platform-interfaces.md §5). `isAvailable` is false and `impact`
 * no-ops without throwing.
 */
export class NoopHaptics implements HapticsInterface {
  impact(_kind: HapticEvent, _intensity?: number): void {
    // no-op
  }

  isAvailable(): boolean {
    return false;
  }
}

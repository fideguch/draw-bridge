import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticEvent, HapticsInterface } from '../interfaces';

/**
 * Native HapticsInterface over `@capacitor/haptics` (contract §3 table).
 *
 * Event → feedback mapping (iOS impact generators / Android maps internally):
 *   confirm → Light, launch → Medium, land → Heavy, coin → Light,
 *   creak → intensity-scaled Light/Medium, starSequence → ascending Light/
 *   Medium/Heavy (driven per beat by the render HapticsRouter via `intensity`),
 *   inkDepleted → notification(Warning).
 *
 * Android composition-fallback note (documented behavior): the contract's
 * `areAllPrimitivesSupported()` capability check with all-or-nothing
 * amplitude fallback targets the raw Android VibrationEffect primitive API
 * (PRIMITIVE_TICK / LOW_TICK / composition). `@capacitor/haptics` v7 exposes
 * only impact styles + notification + vibrate and maps those to reasonable
 * native feedback across API levels itself, so no partially-silent event set
 * arises. The richer primitive-composition path is deferred to v1.1 (needs a
 * custom native plugin). For v1.0, impact styles are the mapping.
 *
 * `impact()` never throws (FR-022): the underlying async calls are swallowed.
 */
export class CapacitorHaptics implements HapticsInterface {
  impact(kind: HapticEvent, intensity?: number): void {
    switch (kind) {
      case 'confirm':
      case 'coin':
        this.fireImpact(ImpactStyle.Light);
        return;
      case 'launch':
        this.fireImpact(ImpactStyle.Medium);
        return;
      case 'land':
        this.fireImpact(ImpactStyle.Heavy);
        return;
      case 'creak':
        this.fireImpact((intensity ?? 0) >= 0.8 ? ImpactStyle.Medium : ImpactStyle.Light);
        return;
      case 'starSequence':
        this.fireImpact(this.ascendingStyle(intensity));
        return;
      case 'inkDepleted':
        this.swallow(Haptics.notification({ type: NotificationType.Warning }));
        return;
      default:
        return;
    }
  }

  isAvailable(): boolean {
    // Native shell always provides a Haptics engine; the `haptics: false`
    // settings gate lives above this interface (a HapticsRouter). Absent
    // vibration hardware is handled internally by the plugin as a no-op.
    return true;
  }

  private ascendingStyle(intensity?: number): ImpactStyle {
    if (intensity === undefined) return ImpactStyle.Heavy;
    if (intensity <= 0.34) return ImpactStyle.Light;
    if (intensity <= 0.67) return ImpactStyle.Medium;
    return ImpactStyle.Heavy;
  }

  private fireImpact(style: ImpactStyle): void {
    this.swallow(Haptics.impact({ style }));
  }

  private swallow(promise: Promise<void>): void {
    void promise.catch(() => {
      // haptics failures never block progress (FR-022)
    });
  }
}

import { describe, expect, it } from 'vitest';
import { EngineEvents } from '@engine/EngineEvents';
import { HapticsRouter } from '@render/juice/HapticsRouter';
import type { HapticEvent, HapticsInterface } from '@platform/interfaces';
import { coin, haptic } from '@tuning/TuningConstants';

/**
 * T056 — HapticsRouter: Engine events + UI moments → HapticsInterface calls,
 * gated by the settings toggle (FR-014, contracts/platform-interfaces.md §3).
 *
 * Verified against a recording fake HapticsInterface and a REAL EngineEvents
 * instance (import allowed: render → engine): mapping-table correctness, coin
 * thinning (1st fires / 2nd,3rd skip), disabled → zero calls, and clean
 * subscribe/unsubscribe lifecycle.
 */

interface Impact {
  readonly kind: HapticEvent;
  readonly intensity?: number;
}

class RecordingHaptics implements HapticsInterface {
  readonly calls: Impact[] = [];
  impact(kind: HapticEvent, intensity?: number): void {
    this.calls.push({ kind, intensity });
  }
  isAvailable(): boolean {
    return true;
  }
  kinds(): HapticEvent[] {
    return this.calls.map((c) => c.kind);
  }
}

function setup(options?: ConstructorParameters<typeof HapticsRouter>[2]): {
  events: EngineEvents;
  haptics: RecordingHaptics;
  router: HapticsRouter;
} {
  const events = new EngineEvents();
  const haptics = new RecordingHaptics();
  const router = new HapticsRouter(haptics, events, options);
  router.attach();
  return { events, haptics, router };
}

const POS = { x: 0, y: 0 } as const;

describe('HapticsRouter — engine-event mapping table', () => {
  it('strokeCommitted → confirm', () => {
    const { events, haptics } = setup();
    events.emit('strokeCommitted', { length: 3, segments: 6 });
    expect(haptics.calls).toEqual([{ kind: 'confirm', intensity: undefined }]);
  });

  it('launchReleased → launch', () => {
    const { events, haptics } = setup();
    events.emit('launchReleased');
    expect(haptics.kinds()).toEqual(['launch']);
  });

  it('creak → creak with stress-proportional intensity', () => {
    const { events, haptics } = setup();
    events.emit('creak', { jointIndex: 2, stress: 0.72 });
    expect(haptics.calls).toEqual([{ kind: 'creak', intensity: 0.72 }]);
  });

  it('break → weak burst of two light (confirm) pulses', () => {
    const { events, haptics } = setup();
    events.emit('break', { jointIndex: 1, position: POS });
    expect(haptics.kinds()).toEqual(['confirm', 'confirm']);
  });
});

describe('HapticsRouter — UI-moment mapping', () => {
  it('onLanding → land', () => {
    const { haptics, router } = setup();
    router.onLanding();
    expect(haptics.kinds()).toEqual(['land']);
  });

  it('onInkEmpty → inkDepleted', () => {
    const { haptics, router } = setup();
    router.onInkEmpty();
    expect(haptics.kinds()).toEqual(['inkDepleted']);
  });

  it('starBeat(0,1,2) → starSequence ascending light→medium→heavy', () => {
    const { haptics, router } = setup();
    router.starBeat(0);
    router.starBeat(1);
    router.starBeat(2);
    expect(haptics.calls).toEqual([
      { kind: 'starSequence', intensity: haptic.confirmStrength },
      { kind: 'starSequence', intensity: haptic.launchStrength },
      { kind: 'starSequence', intensity: haptic.landStrength },
    ]);
    // strictly ascending
    const intensities = haptics.calls.map((c) => c.intensity ?? 0);
    expect(intensities[1]).toBeGreaterThan(intensities[0] ?? 0);
    expect(intensities[2]).toBeGreaterThan(intensities[1] ?? 0);
  });

  it('starBeat clamps out-of-range indices to the heavy end', () => {
    const { haptics, router } = setup();
    router.starBeat(9);
    expect(haptics.calls).toEqual([{ kind: 'starSequence', intensity: haptic.landStrength }]);
  });
});

describe('HapticsRouter — coin thinning (1 per coin.hapticThinning)', () => {
  it('fires on the 1st pickup and every Nth after, skipping the rest', () => {
    const { events, haptics } = setup();
    const total = coin.hapticThinning * 2; // two full groups
    for (let i = 0; i < total; i++) {
      events.emit('coinCollected', { index: i, position: POS });
    }
    // N=3 → fires on pickups 1 and 4 only
    expect(haptics.kinds()).toEqual(['coin', 'coin']);
  });

  it('the 2nd and 3rd pickups in a group are silent (N=3)', () => {
    const { events, haptics } = setup({ coinThinning: 3 });
    events.emit('coinCollected', { index: 0, position: POS }); // fires
    expect(haptics.calls).toHaveLength(1);
    events.emit('coinCollected', { index: 1, position: POS }); // silent
    events.emit('coinCollected', { index: 2, position: POS }); // silent
    expect(haptics.calls).toHaveLength(1);
    events.emit('coinCollected', { index: 3, position: POS }); // fires
    expect(haptics.calls).toHaveLength(2);
  });
});

describe('HapticsRouter — settings toggle', () => {
  it('disabled at construction → zero calls for every event and hook', () => {
    const { events, haptics, router } = setup({ enabled: false });
    events.emit('strokeCommitted', { length: 1, segments: 2 });
    events.emit('launchReleased');
    events.emit('creak', { jointIndex: 0, stress: 0.9 });
    events.emit('break', { jointIndex: 0, position: POS });
    events.emit('coinCollected', { index: 0, position: POS });
    router.onLanding();
    router.onInkEmpty();
    router.starBeat(0);
    expect(haptics.calls).toEqual([]);
    expect(router.isEnabled).toBe(false);
  });

  it('setEnabled(false) stops subsequent calls at runtime', () => {
    const { events, haptics, router } = setup();
    events.emit('launchReleased');
    router.setEnabled(false);
    events.emit('launchReleased');
    router.onLanding();
    expect(haptics.kinds()).toEqual(['launch']);
  });
});

describe('HapticsRouter — subscription lifecycle', () => {
  const ENGINE_EVENTS = ['strokeCommitted', 'launchReleased', 'creak', 'break', 'coinCollected'] as const;

  it('subscribes to each routed engine event on attach', () => {
    const events = new EngineEvents();
    const router = new HapticsRouter(new RecordingHaptics(), events);
    for (const name of ENGINE_EVENTS) {
      expect(events.listenerCount(name)).toBe(0);
    }
    router.attach();
    for (const name of ENGINE_EVENTS) {
      expect(events.listenerCount(name)).toBe(1);
    }
  });

  it('detach removes every listener; re-attach is idempotent', () => {
    const events = new EngineEvents();
    const haptics = new RecordingHaptics();
    const router = new HapticsRouter(haptics, events);
    router.attach();
    router.attach(); // idempotent — no double subscription
    for (const name of ENGINE_EVENTS) {
      expect(events.listenerCount(name)).toBe(1);
    }
    router.detach();
    for (const name of ENGINE_EVENTS) {
      expect(events.listenerCount(name)).toBe(0);
    }
    // after detach the router no longer reacts
    events.emit('launchReleased');
    expect(haptics.calls).toEqual([]);
  });
});

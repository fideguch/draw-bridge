import { describe, expect, it } from 'vitest';
import { EngineEvents } from '@engine/EngineEvents';
import type { EngineEventMap } from '@engine/EngineEvents';
import { CoinTracker } from '@engine/rules/CoinTracker';
import { coin } from '@tuning/TuningConstants';

/**
 * T030 — typed engine event bus + coin collection (constitution IV: one-way
 * Engine -> observers; FR-009 substrate).
 *
 * EngineEvents: tiny typed pub/sub (no Node EventEmitter). Payloads are
 * compile-checked against EngineEventMap; wrong payloads/names are
 * @ts-expect-error'd below and enforced by `tsc --noEmit` in the build.
 *
 * CoinTracker collection rule (documented decision): a coin is collected the
 * first tick the VehicleReferencePoint comes within coin.collectRadiusM
 * (inclusive) of the coin center. The reference point is chosen over a
 * chassis-AABB overlap because it is the UL's single judgement point
 * (data-model §1.4), deterministic, and needs no contact-event plumbing.
 * Each coin collects at most once per attempt.
 */

describe('EngineEvents — subscription lifecycle', () => {
  it('delivers typed payloads to subscribers', () => {
    const events = new EngineEvents();
    const received: EngineEventMap['strokeCommitted'][] = [];
    events.on('strokeCommitted', (payload) => received.push(payload));
    events.emit('strokeCommitted', { length: 4.2, segments: 7 });
    expect(received).toEqual([{ length: 4.2, segments: 7 }]);
  });

  it('calls multiple listeners in subscription order', () => {
    const events = new EngineEvents();
    const order: string[] = [];
    events.on('creak', () => order.push('first'));
    events.on('creak', () => order.push('second'));
    events.emit('creak', { jointIndex: 3, stress: 0.7 });
    expect(order).toEqual(['first', 'second']);
  });

  it('off removes a listener; removing an unknown listener is a no-op', () => {
    const events = new EngineEvents();
    let calls = 0;
    const listener = (): void => {
      calls++;
    };
    events.on('launchStarted', listener);
    events.off('launchStarted', listener);
    events.off('launchStarted', () => undefined); // never registered
    events.emit('launchStarted');
    expect(calls).toBe(0);
  });

  it('on returns an unsubscribe function', () => {
    const events = new EngineEvents();
    let calls = 0;
    const unsubscribe = events.on('launchReleased', () => {
      calls++;
    });
    events.emit('launchReleased');
    unsubscribe();
    events.emit('launchReleased');
    expect(calls).toBe(1);
  });

  it('once fires exactly once', () => {
    const events = new EngineEvents();
    let calls = 0;
    events.once('coinCollected', () => {
      calls++;
    });
    events.emit('coinCollected', { index: 0, position: { x: 1, y: 2 } });
    events.emit('coinCollected', { index: 1, position: { x: 2, y: 2 } });
    expect(calls).toBe(1);
  });

  it('emitting with no listeners is a no-op', () => {
    const events = new EngineEvents();
    expect(() => events.emit('cleared', { tick: 300 })).not.toThrow();
    expect(() =>
      events.emit('failed', { cause: 'fall', position: { x: 0, y: -8 }, tick: 120 }),
    ).not.toThrow();
  });

  it('listeners added during an emit do not receive the current event', () => {
    const events = new EngineEvents();
    let lateCalls = 0;
    events.on('cleared', () => {
      events.on('cleared', () => {
        lateCalls++;
      });
    });
    events.emit('cleared', { tick: 1 });
    expect(lateCalls).toBe(0);
    events.emit('cleared', { tick: 2 });
    expect(lateCalls).toBe(1);
  });

  it('rejects invalid payload shapes and event names at compile time', () => {
    const events = new EngineEvents();
    // @ts-expect-error — strokeCommitted payload requires {length, segments}
    events.emit('strokeCommitted', { length: 1 });
    // @ts-expect-error — unknown event name
    events.on('notAnEvent', () => undefined);
    // @ts-expect-error — payload-less event must not carry a payload
    events.emit('launchStarted', { anything: true });
    // @ts-expect-error — payload-carrying event requires its payload
    events.emit('cleared');
    expect(true).toBe(true);
  });
});

describe('CoinTracker — collection in a mini scene (FR-009)', () => {
  const COINS = [
    { x: -1, y: 0.8 },
    { x: 0, y: 0.8 },
    { x: 1, y: 0.8 },
  ] as const;

  it('collects a coin when the reference point comes within coin.collectRadiusM', () => {
    const tracker = new CoinTracker(COINS);
    expect(tracker.update({ x: -5, y: 0.5 })).toEqual([]);
    const collected = tracker.update({ x: -1, y: 0.8 - coin.collectRadiusM / 2 });
    expect(collected).toEqual([0]);
    expect(tracker.collectedCount).toBe(1);
    expect(tracker.isCollected(0)).toBe(true);
    expect(tracker.isCollected(1)).toBe(false);
  });

  it('the radius boundary is inclusive (distance exactly collectRadiusM collects)', () => {
    const tracker = new CoinTracker([{ x: 0, y: 0 }]);
    expect(tracker.update({ x: coin.collectRadiusM, y: 0 })).toEqual([0]);
  });

  it('just outside the radius does not collect', () => {
    const tracker = new CoinTracker([{ x: 0, y: 0 }]);
    expect(tracker.update({ x: coin.collectRadiusM + 0.001, y: 0 })).toEqual([]);
    expect(tracker.collectedCount).toBe(0);
  });

  it('never double-collects: staying inside the radius reports the coin once', () => {
    const tracker = new CoinTracker([{ x: 0, y: 0 }]);
    expect(tracker.update({ x: 0, y: 0 })).toEqual([0]);
    expect(tracker.update({ x: 0.01, y: 0 })).toEqual([]);
    expect(tracker.update({ x: 0, y: 0 })).toEqual([]);
    expect(tracker.collectedCount).toBe(1);
  });

  it('a sweep across the scene collects each coin exactly once', () => {
    const tracker = new CoinTracker(COINS);
    const newlyCollected: number[] = [];
    // drive the reference point left -> right at bridge height, 0.05 m steps
    for (let x = -3; x <= 3; x += 0.05) {
      newlyCollected.push(...tracker.update({ x, y: 0.5 }));
    }
    expect(newlyCollected).toEqual([0, 1, 2]);
    expect(tracker.collectedCount).toBe(3);
    expect(tracker.total).toBe(3);
  });

  it('rejects non-finite coin positions', () => {
    expect(() => new CoinTracker([{ x: Number.NaN, y: 0 }])).toThrow();
  });
});

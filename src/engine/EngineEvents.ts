/**
 * EngineEvents — tiny typed pub/sub for one-way Engine -> observers
 * (constitution IV). No Node EventEmitter dependency: the engine stays
 * headless and browser/Node agnostic.
 *
 * Event vocabulary (payloads in EngineEventMap):
 * - strokeCommitted : stroke solidified (FR-003)         {length, segments}
 * - launchStarted   : anticipation began (FR-005)        (no payload)
 * - launchReleased  : motor engaged (FR-005)             (no payload)
 * - creak           : joint in the creak band (FR-006)   {jointIndex, stress}
 * - break           : joint broke (FR-006)               {jointIndex, position}
 * - coinCollected   : coin picked up (FR-009)            {index, position}
 * - cleared         : attempt cleared (FR-007)           {tick} — stars/ink
 *                     enrichment lives on the outcome object, not the event
 * - failed          : attempt failed (FR-008)            {cause, position, tick}
 *
 * Semantics:
 * - emit() calls the listeners subscribed at emit time, in subscription
 *   order; listeners added during an emit only see LATER events.
 * - once() listeners are deregistered before their callback runs (re-entrant
 *   emits cannot double-fire them).
 * - Listener exceptions propagate to the emitter (engine internals must not
 *   swallow errors); render-side observers are responsible for their own
 *   error isolation.
 */

import type { Point } from './level/LevelSchema';
import type { FailCause } from './rules/Judge';

export interface EngineEventMap {
  readonly strokeCommitted: { readonly length: number; readonly segments: number };
  readonly launchStarted: void;
  readonly launchReleased: void;
  readonly creak: { readonly jointIndex: number; readonly stress: number };
  readonly break: { readonly jointIndex: number; readonly position: Point };
  readonly coinCollected: { readonly index: number; readonly position: Point };
  readonly cleared: { readonly tick: number };
  readonly failed: { readonly cause: FailCause; readonly position: Point; readonly tick: number };
}

export type EngineEventName = keyof EngineEventMap;

type Listener<K extends EngineEventName> = (payload: EngineEventMap[K]) => void;

/** Payload-less events take no emit argument; others require exactly one. */
type EmitArgs<K extends EngineEventName> = EngineEventMap[K] extends void
  ? []
  : [payload: EngineEventMap[K]];

interface Registration {
  readonly listener: (payload: unknown) => void;
  readonly once: boolean;
}

export class EngineEvents {
  private readonly registry = new Map<EngineEventName, Registration[]>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends EngineEventName>(event: K, listener: Listener<K>): () => void {
    this.register(event, listener, false);
    return () => this.off(event, listener);
  }

  /** Subscribe for exactly one delivery. Returns an unsubscribe function. */
  once<K extends EngineEventName>(event: K, listener: Listener<K>): () => void {
    this.register(event, listener, true);
    return () => this.off(event, listener);
  }

  /** Remove a previously registered listener (no-op when absent). */
  off<K extends EngineEventName>(event: K, listener: Listener<K>): void {
    const registrations = this.registry.get(event);
    if (registrations === undefined) {
      return;
    }
    const index = registrations.findIndex((registration) => registration.listener === listener);
    if (index !== -1) {
      registrations.splice(index, 1);
    }
  }

  /** Emit to the listeners registered at call time (see class header). */
  emit<K extends EngineEventName>(event: K, ...args: EmitArgs<K>): void {
    const registrations = this.registry.get(event);
    if (registrations === undefined || registrations.length === 0) {
      return;
    }
    const snapshot = [...registrations];
    // once-listeners deregister BEFORE running: re-entrant emits stay single-fire
    const remaining = registrations.filter((registration) => !registration.once);
    this.registry.set(event, remaining);
    for (const registration of snapshot) {
      registration.listener(args[0]);
    }
  }

  /** Number of live listeners for an event (diagnostics/tests). */
  listenerCount(event: EngineEventName): number {
    return this.registry.get(event)?.length ?? 0;
  }

  private register<K extends EngineEventName>(event: K, listener: Listener<K>, once: boolean): void {
    const registrations = this.registry.get(event) ?? [];
    registrations.push({ listener: listener as (payload: unknown) => void, once });
    this.registry.set(event, registrations);
  }
}

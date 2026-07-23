/**
 * sharedWorld.ts — ONE physics World reused across every level entry (CS-6 P0).
 *
 * WHY: phaser-box2d never frees a world slot (b2DestroyWorld reassigns a local,
 * not the global slot), hard-capping at 32 World instances per process
 * (src/engine/physics/World.ts LIB-QUIRK). PlayScene enters a level via a Phaser
 * scene restart, and creating a fresh `new World()` per entry meant the 33rd
 * level entry in one app session threw `slot limit (32/process) exhausted` — the
 * 45-level campaign deterministically bricked at the l27->l28 transition.
 *
 * FIX: a single World is get-or-created ONCE and parked on `game.registry`
 * (which survives scene restarts, exactly like the SERVICES_KEY port in
 * services.ts). Every GameSimulation is bound to it (ownsWorld=false); the
 * constructor reset()s the slot to a clean slate on entry and teardown's
 * sim.destroy() leaves the shared world untouched. One slot serves the whole
 * session. The World.reset() header proves the recycled slot stays inside the
 * Gate 2 determinism band, so per-level gameplay is unchanged.
 */

import Phaser from 'phaser';
import { World } from '@engine/physics/World';

/** Registry key holding the process-wide reused physics World. */
export const SHARED_WORLD_KEY = 'sharedPhysicsWorld';

/**
 * Return the process-wide physics World, creating (and parking on the game
 * registry) exactly one on first call. Reused across every scene restart so
 * level entries never consume a fresh phaser-box2d slot. Self-heals if the
 * parked world was ever destroyed (never happens in the runtime, where every
 * sim binds it with ownsWorld=false).
 */
export function getSharedWorld(scene: Phaser.Scene): World {
  const registry = scene.registry;
  const existing = registry.get(SHARED_WORLD_KEY) as World | undefined;
  if (existing !== undefined && !existing.isDestroyed) {
    return existing;
  }
  const world = new World();
  registry.set(SHARED_WORLD_KEY, world);
  return world;
}

import { describe, expect, it } from 'vitest';
import { World } from '@engine/physics/World';

/**
 * C1 — phaser-box2d 32-slot cap guard (World.ts LIB-QUIRK).
 *
 * b2CreateWorld silently returns an invalid b2WorldId(0,0) once all 32 process
 * slots are in use (b2DestroyWorld never frees one), which would later blow up
 * deep in the vendor with an opaque TypeError. World's constructor validates
 * the id and throws a clear, actionable error instead.
 *
 * DEDICATED FILE: this test intentionally exhausts all 32 slots and cannot free
 * them (the whole point of the quirk). Vitest's default pool ('forks',
 * isolate: true) runs each spec file in its own worker process, so the 32
 * leaked slots die with this worker and never starve another file. Nothing else
 * in this file may create a World.
 */

describe('World — 32-slot cap guard (C1)', () => {
  it('throws a clear slot-limit error at the 33rd creation instead of a vendor crash', () => {
    const worlds: World[] = [];
    let caught: unknown;
    try {
      // 33 attempts: slots 1..32 succeed, the 33rd hits the exhausted pool.
      for (let i = 0; i < 33; i++) {
        worlds.push(new World());
      }
    } catch (error) {
      caught = error;
    }

    // exactly 32 succeeded (this is the only World creator in this process)
    expect(worlds).toHaveLength(32);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('slot limit (32/process)');
    // the message must point the reader at the reset() reuse escape hatch
    expect((caught as Error).message).toMatch(/reset\(\)/);
    // slots cannot be reclaimed (destroy never frees one) — process isolation
    // discards this worker's 32 slots; do not attempt cleanup.
  });
});

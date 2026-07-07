import { describe, expect, it } from 'vitest';
import {
  b2DestroyJoint,
  b2Joint_GetConstraintForce,
  b2Joint_GetConstraintTorque,
} from 'phaser-box2d';

/**
 * T002 smoke test (research R2): the stress/break pipeline depends on these
 * Box2D v3 joint APIs being present in the phaser-box2d JS port.
 * Export names verified against node_modules/phaser-box2d/dist/PhaserBox2D.js.
 */
describe('phaser-box2d dependency surface', () => {
  it('exports b2DestroyJoint (joint break on stress > 1.0)', () => {
    expect(b2DestroyJoint).toBeTypeOf('function');
  });

  it('exports b2Joint_GetConstraintForce (stress raw |F| term)', () => {
    expect(b2Joint_GetConstraintForce).toBeTypeOf('function');
  });

  it('exports b2Joint_GetConstraintTorque (stress raw |t| term)', () => {
    expect(b2Joint_GetConstraintTorque).toBeTypeOf('function');
  });
});

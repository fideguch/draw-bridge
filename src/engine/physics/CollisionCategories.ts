/**
 * CollisionCategories — Box2D filter category bits shared across the engine.
 *
 * Structural constants (bit layout), NOT tunables — they never move to
 * TuningConstants. Terrain keeps the phaser-box2d default category (1) set by
 * b2DefaultChainDef, so it is mirrored here rather than assigned.
 *
 * Orphan debris handling (FR-006): StressTracker strips CATEGORY_VEHICLE from
 * a fragment's maskBits so debris stops colliding with the car but still lands
 * on terrain (game_design §3.2 "残骸によるハマり防止").
 */

/** Static terrain chains (= phaser-box2d default filter category). */
export const CATEGORY_TERRAIN = 0x0001;

/** Drawn bridge segments (chain and compound methods). */
export const CATEGORY_BRIDGE = 0x0002;

/** Vehicle chassis + wheels. */
export const CATEGORY_VEHICLE = 0x0004;

/**
 * Rolling/falling rock hazards (RockHazard). A distinct category so future
 * filtering (e.g. debris that should ignore rocks) stays expressible; rocks
 * themselves collide with EVERYTHING (terrain + bridge + vehicle + each other)
 * via MASK_ALL, which is the "block falling/rolling objects with your line"
 * mechanic — the drawn BridgeChain is a shield/deflector for them.
 */
export const CATEGORY_ROCK = 0x0008;

/** Collide with everything (b2Filter default maskBits width). */
export const MASK_ALL = 0xffff;

/** Debris mask: everything except the vehicle. */
export const MASK_NO_VEHICLE = MASK_ALL & ~CATEGORY_VEHICLE;

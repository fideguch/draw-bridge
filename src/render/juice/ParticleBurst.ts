/**
 * ParticleBurst — one small, reusable ballistic particle emitter shared by the
 * mandatory drawing/launch/break juice (T057-T059, game_design §4.1 1-8 pen
 * dust, §4.2 2-1 wheel-spin smoke, §4.2 2-2 release dust burst, §4.2 2-6/2-8
 * creak dust + break debris).
 *
 * Presentation only and THEME-FREE: every emit() is handed a colour so the
 * module imports no theme value and pulls no Phaser at value level (Phaser is a
 * TYPE-only import, matching Confetti/StarBurst). Each particle is a plain
 * Rectangle animated by a proxy tween that integrates vx/vy under optional
 * gravity and fades alpha 1→0 over its life, then destroys itself — good enough
 * for dust/smoke/debris and cheap to sweep on teardown.
 */

import type Phaser from 'phaser';

export interface ParticleBurstOptions {
  readonly depth?: number;
  /** Downward accel in px/s² (0 for floaty dust, high for falling debris). */
  readonly gravityPx?: number;
  readonly lifeMsMin?: number;
  readonly lifeMsMax?: number;
  readonly sizePxMin?: number;
  readonly sizePxMax?: number;
  /** RNG in [0,1). Defaults to Math.random. Injectable for tests. */
  readonly rng?: () => number;
}

export interface EmitOptions {
  readonly count: number;
  readonly color: number;
  readonly speedPxMin?: number;
  readonly speedPxMax?: number;
  /** Centre emission direction in radians (screen space, +x right, +y down). */
  readonly dirRad?: number;
  /** Half-spread around dirRad in radians. Defaults to π (full circle). */
  readonly spreadRad?: number;
}

const DEFAULT_LIFE_MIN_MS = 200;
const DEFAULT_LIFE_MAX_MS = 500;
const DEFAULT_SIZE_MIN_PX = 2;
const DEFAULT_SIZE_MAX_PX = 6;
const DEFAULT_SPEED_MIN_PX = 30;
const DEFAULT_SPEED_MAX_PX = 120;

export class ParticleBurst {
  private readonly scene: Phaser.Scene;
  private readonly options: ParticleBurstOptions;
  private readonly rng: () => number;
  private readonly particles: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, options: ParticleBurstOptions = {}) {
    this.scene = scene;
    this.options = options;
    this.rng = options.rng ?? Math.random;
  }

  /** Spawn `count` particles from (xPx, yPx) with the given emission cone. */
  emit(xPx: number, yPx: number, emit: EmitOptions): void {
    const count = Math.max(0, Math.floor(emit.count));
    const dir = emit.dirRad ?? 0;
    const spread = emit.spreadRad ?? Math.PI;
    const isFullCircle = emit.dirRad === undefined;
    const speedMin = emit.speedPxMin ?? DEFAULT_SPEED_MIN_PX;
    const speedMax = emit.speedPxMax ?? DEFAULT_SPEED_MAX_PX;
    const gravity = this.options.gravityPx ?? 0;
    const lifeMin = this.options.lifeMsMin ?? DEFAULT_LIFE_MIN_MS;
    const lifeMax = this.options.lifeMsMax ?? DEFAULT_LIFE_MAX_MS;
    const sizeMin = this.options.sizePxMin ?? DEFAULT_SIZE_MIN_PX;
    const sizeMax = this.options.sizePxMax ?? DEFAULT_SIZE_MAX_PX;

    for (let i = 0; i < count; i++) {
      const angle = isFullCircle ? this.rng() * Math.PI * 2 : dir + (this.rng() * 2 - 1) * spread;
      const speed = speedMin + this.rng() * (speedMax - speedMin);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const lifeMs = lifeMin + this.rng() * (lifeMax - lifeMin);
      const size = sizeMin + this.rng() * (sizeMax - sizeMin);
      this.spawn(xPx, yPx, vx, vy, gravity, lifeMs, size, emit.color);
    }
  }

  destroy(): void {
    for (const particle of this.particles) {
      this.scene.tweens.killTweensOf(particle);
      particle.destroy();
    }
    this.particles.length = 0;
  }

  private spawn(
    x0: number,
    y0: number,
    vx: number,
    vy: number,
    gravity: number,
    lifeMs: number,
    size: number,
    fill: number,
  ): void {
    const rect = this.scene.add.rectangle(x0, y0, size, size, fill);
    if (this.options.depth !== undefined) {
      rect.setDepth(this.options.depth);
    }
    this.particles.push(rect);
    const proxy = { t: 0 };
    const totalSec = lifeMs / 1000;
    this.scene.tweens.add({
      targets: proxy,
      t: totalSec,
      duration: lifeMs,
      ease: 'Linear',
      onUpdate: () => {
        const t = proxy.t;
        rect.setPosition(x0 + vx * t, y0 + vy * t + 0.5 * gravity * t * t);
        rect.setAlpha(Math.max(0, 1 - t / totalSec));
      },
      onComplete: () => this.remove(rect),
    });
  }

  private remove(rect: Phaser.GameObjects.Rectangle): void {
    const index = this.particles.indexOf(rect);
    if (index >= 0) {
      this.particles.splice(index, 1);
    }
    this.scene.tweens.killTweensOf(rect);
    rect.destroy();
  }
}

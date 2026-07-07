/**
 * StarBurstView — the goal star sequence (拍4, T060, game_design §4.3 3-4).
 *
 * Presentation only and THEME-FREE: colours (star gold, ink border) are injected
 * through the constructor so this module imports no Phaser value and stays
 * headless-importable — the wiring passes theme tokens (e.g. color.star /
 * color.inkBorder). The pure reveal schedule + star polygon are unit-tested
 * without a scene.
 *
 * Stars reveal one at a time goal.starIntervalMs apart; each pops scale
 * 0 → 1.3 → 1.0 over goal.starPopMs with an ease-out-back and emits an expanding
 * shockwave ring. An injected `onBeat(index)` fires per star so the wiring plays
 * the C-E-G arpeggio (+ cymbal on the 3rd) and the ascending
 * light→medium→heavy haptic — this module never touches the audio / haptic
 * services (callback injection, matching HapticsRouter's presentation-pure
 * precedent). `skip()` completes every remaining star instantly (tap-skip,
 * §4.4 X-3).
 */

import type Phaser from 'phaser';
import { goal } from '@tuning/TuningConstants';

/**
 * TODO(tuning): §4.3 3-4 fixes the pop overshoot at scale 1.3 and adds a
 * shockwave ring, neither of which has a TuningConstants field (goal.starPopMs
 * is only the duration; coin.popScale 1.3 belongs to the coin pickup). Local
 * provisionals until the goal group carries them.
 */
const STAR_POP_OVERSHOOT_SCALE = 1.3;
const STAR_SETTLE_SCALE = 1.0;
const STAR_RADIUS_PX = 28;
const STAR_GAP_PX = 76;
const SHOCKWAVE_MAX_RADIUS_PX = 64;
const SHOCKWAVE_MS = 320;

export interface Vec2Px {
  readonly x: number;
  readonly y: number;
}

export interface StarRevealStep {
  readonly index: number;
  /** Real-ms delay before star `index` pops. */
  readonly delayMs: number;
}

/** Sequential reveal schedule: star i pops at i * intervalMs. Pure. */
export function starRevealSchedule(
  count: number,
  intervalMs: number = goal.starIntervalMs,
): StarRevealStep[] {
  const n = Math.max(0, Math.floor(count));
  const steps: StarRevealStep[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({ index: i, delayMs: i * intervalMs });
  }
  return steps;
}

/** Five-point star polygon points centred on (0, 0) at `radius`. Pure. */
export function starPolygon(radius: number): number[] {
  const points: number[] = [];
  const inner = radius * 0.5;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return points;
}

export interface StarBurstViewOptions {
  /** Filled star colour (0xRRGGBB) — the wiring passes color.star. */
  readonly filledColor: number;
  /** Outline colour — the wiring passes color.inkBorder. */
  readonly borderColor: number;
  /** Shockwave ring colour. Defaults to `filledColor`. */
  readonly shockwaveColor?: number;
  readonly depth?: number;
  readonly starRadiusPx?: number;
}

export interface ShowStarsOptions {
  /** Called when star `index` pops (arpeggio + ascending haptic). */
  readonly onBeat?: (index: number) => void;
}

export class StarBurstView {
  private readonly scene: Phaser.Scene;
  private readonly viewOptions: StarBurstViewOptions;
  private readonly stars: Phaser.GameObjects.Graphics[] = [];
  private readonly rings: Phaser.GameObjects.Graphics[] = [];
  // Each shockwave is driven by a proxy tween (targets a {r,a} object, NOT the
  // ring), so killTweensOf(ring) cannot reach it — the handle is tracked here and
  // stopped explicitly on clear() so a skip/replay leaves no orphan tween drawing
  // into a destroyed ring.
  private readonly ringTweens = new Map<Phaser.GameObjects.Graphics, Phaser.Tweens.Tween>();
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private onBeat?: (index: number) => void;
  private revealedCount = 0;
  private totalCount = 0;

  constructor(scene: Phaser.Scene, options: StarBurstViewOptions) {
    this.scene = scene;
    this.viewOptions = options;
  }

  /**
   * Reveal `count` (1-3) stars sequentially at `anchor`, popping each with a
   * shockwave and firing `onBeat(i)`. Restarts cleanly if called again.
   */
  showStars(count: 1 | 2 | 3, anchor: Vec2Px, options: ShowStarsOptions = {}): void {
    this.clear();
    this.onBeat = options.onBeat;
    this.totalCount = count;
    this.revealedCount = 0;
    const radius = this.viewOptions.starRadiusPx ?? STAR_RADIUS_PX;
    const first = anchor.x - ((count - 1) * STAR_GAP_PX) / 2;

    for (const step of starRevealSchedule(count)) {
      const x = first + step.index * STAR_GAP_PX;
      const star = this.addStar(x, anchor.y, radius);
      this.timers.push(
        this.scene.time.delayedCall(step.delayMs, () => this.popStar(step.index, star, x, anchor.y, radius)),
      );
    }
  }

  /** Complete every remaining star instantly (tap-skip). */
  skip(): void {
    for (const timer of this.timers) {
      timer.remove(false);
    }
    this.timers.length = 0;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (star === undefined) {
        continue;
      }
      this.scene.tweens.killTweensOf(star);
      star.setScale(STAR_SETTLE_SCALE).setVisible(true);
      if (i >= this.revealedCount) {
        this.onBeat?.(i);
      }
    }
    this.revealedCount = this.totalCount;
  }

  destroy(): void {
    this.clear();
  }

  private popStar(index: number, star: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
    this.revealedCount = Math.max(this.revealedCount, index + 1);
    star.setVisible(true);
    this.scene.tweens.add({
      targets: star,
      scale: STAR_POP_OVERSHOOT_SCALE,
      duration: goal.starPopMs * 0.6,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: star,
          scale: STAR_SETTLE_SCALE,
          duration: goal.starPopMs * 0.4,
          ease: 'Quad.Out',
        });
      },
    });
    this.spawnShockwave(x, y, radius);
    this.onBeat?.(index);
  }

  private addStar(x: number, y: number, radius: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.setPosition(x, y).setScale(0).setVisible(false);
    if (this.viewOptions.depth !== undefined) {
      graphics.setDepth(this.viewOptions.depth);
    }
    graphics.fillStyle(this.viewOptions.filledColor, 1);
    graphics.lineStyle(2, this.viewOptions.borderColor, 1);
    const points = starPolygon(radius);
    graphics.beginPath();
    graphics.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i < points.length; i += 2) {
      graphics.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    this.stars.push(graphics);
    return graphics;
  }

  private spawnShockwave(x: number, y: number, radius: number): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    if (this.viewOptions.depth !== undefined) {
      ring.setDepth(this.viewOptions.depth - 1);
    }
    this.rings.push(ring);
    const ringColor = this.viewOptions.shockwaveColor ?? this.viewOptions.filledColor;
    const proxy = { r: radius * 0.5, a: 0.6 };
    const tween = this.scene.tweens.add({
      targets: proxy,
      r: SHOCKWAVE_MAX_RADIUS_PX,
      a: 0,
      duration: SHOCKWAVE_MS,
      ease: 'Quad.Out',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(3, ringColor, proxy.a);
        ring.strokeCircle(0, 0, proxy.r);
      },
      onComplete: () => this.removeRing(ring),
    });
    this.ringTweens.set(ring, tween);
  }

  private removeRing(ring: Phaser.GameObjects.Graphics): void {
    const index = this.rings.indexOf(ring);
    if (index >= 0) {
      this.rings.splice(index, 1);
    }
    this.ringTweens.delete(ring);
    ring.destroy();
  }

  private clear(): void {
    for (const timer of this.timers) {
      timer.remove(false);
    }
    this.timers.length = 0;
    for (const star of this.stars) {
      this.scene.tweens.killTweensOf(star);
      star.destroy();
    }
    this.stars.length = 0;
    for (const ring of this.rings) {
      this.ringTweens.get(ring)?.stop();
      this.scene.tweens.killTweensOf(ring);
      ring.destroy();
    }
    this.rings.length = 0;
    this.ringTweens.clear();
    this.revealedCount = 0;
    this.totalCount = 0;
  }
}

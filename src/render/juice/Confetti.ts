/**
 * ConfettiCelebration — the 2-stage goal confetti (拍3, T060, game_design §4.3
 * 3-3). Presentation only, and deliberately THEME-FREE: colours are injected as
 * a `palette` (the GoalSequence wiring passes 4-5 festive theme colours, e.g.
 * [color.goalFlag, color.carBody, color.coin, color.uiPrimary, color.stressMid])
 * so this module imports no Phaser value and stays headless-importable (the pure
 * generators below unit-test without a scene; importing theme would drag Phaser
 * in via theme.ts's value import). The pop-sound stagger is surfaced through the
 * `onCannonFire` callback so audio stays in the wiring.
 *
 * Stage 1 — two side cannons at the goal, each firing goal.confettiCannonCount
 * pieces up-and-outward at 45-70° (§4.3 spread ~30°). Stage 2 — after a 0.3 s
 * delay, goal.confettiRainCount pieces rain from the top over ~2-3 s. Every
 * piece spins ±goal.confettiSpinDegPerSec, sways, and falls under
 * goal.confettiGravityScale gravity.
 *
 * The ballistic path is animated with a proxy tween integrating a simple gravity
 * model in onUpdate — good enough for paper confetti, and it keeps the pieces as
 * plain Rectangles that stop()/destroy() can sweep.
 */

import type Phaser from 'phaser';
import { goal } from '@tuning/TuningConstants';

/**
 * TODO(tuning): §4.3 3-3 confetti geometry that has no TuningConstants field.
 * The `goal` group owns the counts/gravity/spin; these pixel/degree/timing
 * provisionals are local until the tuning panel (FR-025) covers them.
 */
const CONFETTI_CANNON_MIN_ANGLE_DEG = 45;
const CONFETTI_CANNON_MAX_ANGLE_DEG = 70;
const CONFETTI_CANNON_POP_STAGGER_MS = 50;
const CONFETTI_RAIN_DELAY_MS = 300;
const CONFETTI_CANNON_SPEED_PX = 620;
const CONFETTI_BASE_GRAVITY_PX = 1400;
const CONFETTI_SWAY_AMPLITUDE_PX = 22;
const CONFETTI_PIECE_MIN_PX = 8;
const CONFETTI_PIECE_MAX_PX = 14;

export interface Vec2Px {
  readonly x: number;
  readonly y: number;
}

export interface ConfettiPiece {
  /** Launch elevation in degrees, always within [45, 70] (§4.3). */
  readonly angleDeg: number;
  /** Horizontal launch direction: -1 (left) or +1 (right). */
  readonly directionX: number;
  readonly speedPxPerSec: number;
  /** Spin rate; sign randomised, magnitude goal.confettiSpinDegPerSec. */
  readonly spinDegPerSec: number;
  /** Colour drawn from the injected palette (0xRRGGBB). */
  readonly color: number;
  /** Phase offset so pieces sway out of lockstep. */
  readonly swayPhase: number;
  readonly sizePx: number;
}

export interface ConfettiRainPiece {
  /** Horizontal spawn x in px (0..width). */
  readonly xPx: number;
  /** Stagger before this flake starts falling (spread across the rain). */
  readonly delayMs: number;
  readonly spinDegPerSec: number;
  readonly color: number;
  readonly swayPhase: number;
  readonly sizePx: number;
}

type Rng = () => number;

function pick(palette: readonly number[], rng: Rng): number {
  if (palette.length === 0) {
    return 0;
  }
  return palette[Math.floor(rng() * palette.length) % palette.length] ?? palette[0] ?? 0;
}

// ── pure generators ───────────────────────────────────────────────────────────

/**
 * Pieces for one side cannon. Elevation is uniform in [45, 70]; `side` sets the
 * outward horizontal direction; colour is drawn from `palette`. Pure —
 * headless-tested for count / angle bounds.
 */
export function confettiCannonPieces(
  count: number,
  side: 'left' | 'right',
  palette: readonly number[],
  rng: Rng = Math.random,
): ConfettiPiece[] {
  const n = Math.max(0, Math.floor(count));
  const directionX = side === 'left' ? -1 : 1;
  const span = CONFETTI_CANNON_MAX_ANGLE_DEG - CONFETTI_CANNON_MIN_ANGLE_DEG;
  const sizeSpan = CONFETTI_PIECE_MAX_PX - CONFETTI_PIECE_MIN_PX;
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < n; i++) {
    pieces.push({
      angleDeg: CONFETTI_CANNON_MIN_ANGLE_DEG + rng() * span,
      directionX,
      speedPxPerSec: CONFETTI_CANNON_SPEED_PX * (0.75 + rng() * 0.5),
      spinDegPerSec: goal.confettiSpinDegPerSec * (rng() < 0.5 ? -1 : 1),
      color: pick(palette, rng),
      swayPhase: rng() * Math.PI * 2,
      sizePx: CONFETTI_PIECE_MIN_PX + rng() * sizeSpan,
    });
  }
  return pieces;
}

/** Top-rain flakes spread across `widthPx`, staggered over the fall window. */
export function confettiRainPieces(
  count: number,
  widthPx: number,
  palette: readonly number[],
  fallMs: number = goal.confettiRainFallMs,
  rng: Rng = Math.random,
): ConfettiRainPiece[] {
  const n = Math.max(0, Math.floor(count));
  const sizeSpan = CONFETTI_PIECE_MAX_PX - CONFETTI_PIECE_MIN_PX;
  const flakes: ConfettiRainPiece[] = [];
  for (let i = 0; i < n; i++) {
    flakes.push({
      xPx: rng() * widthPx,
      delayMs: rng() * fallMs * 0.6,
      spinDegPerSec: goal.confettiSpinDegPerSec * (rng() < 0.5 ? -1 : 1),
      color: pick(palette, rng),
      swayPhase: rng() * Math.PI * 2,
      sizePx: CONFETTI_PIECE_MIN_PX + rng() * sizeSpan,
    });
  }
  return flakes;
}

// ── Phaser-facing celebration ─────────────────────────────────────────────────

export interface ConfettiCelebrationOptions {
  /** Festive colours (0xRRGGBB) — the wiring passes 4-5 theme colours. */
  readonly palette: readonly number[];
  readonly depth?: number;
  readonly rng?: Rng;
  /** Screen width for the rain spread. Defaults to the camera width. */
  readonly widthPx?: number;
  /** Fall distance before cleanup. Defaults to the camera height. */
  readonly heightPx?: number;
  /** Fired per cannon (0 then 1, CONFETTI_CANNON_POP_STAGGER_MS apart) for SFX. */
  readonly onCannonFire?: (sideIndex: number) => void;
}

export class ConfettiCelebration {
  private readonly scene: Phaser.Scene;
  private readonly options: ConfettiCelebrationOptions;
  private readonly rng: Rng;
  private readonly palette: readonly number[];
  private readonly pieces: Phaser.GameObjects.Rectangle[] = [];
  // The ballistic path is driven by a proxy tween (targets a {t} object, NOT the
  // rect), so killTweensOf(piece) cannot reach it — each handle is tracked here
  // and stopped explicitly on stop()/destroy() so a tap-skip/replay leaves no
  // orphan tween mutating a destroyed piece.
  private readonly ballisticTweens = new Map<Phaser.GameObjects.Rectangle, Phaser.Tweens.Tween>();
  private isStopped = false;

  constructor(scene: Phaser.Scene, options: ConfettiCelebrationOptions) {
    this.scene = scene;
    this.options = options;
    this.rng = options.rng ?? Math.random;
    this.palette = options.palette;
  }

  /** Fire both side cannons from `positions` ([left, right]) with a pop stagger. */
  fireCannons(positions: readonly Vec2Px[]): void {
    if (this.isStopped) {
      return;
    }
    const sides: Array<'left' | 'right'> = ['left', 'right'];
    positions.slice(0, 2).forEach((origin, sideIndex) => {
      const side = sides[sideIndex] ?? 'left';
      for (const piece of confettiCannonPieces(goal.confettiCannonCount, side, this.palette, this.rng)) {
        this.spawnCannonPiece(origin, piece);
      }
    });
    // Pop SFX ×2, left then right, 50 ms apart (§4.3): audio via the callback.
    this.options.onCannonFire?.(0);
    if (positions.length > 1) {
      this.scene.time.delayedCall(CONFETTI_CANNON_POP_STAGGER_MS, () => {
        // A fast tap-skip between the two pops must not fire a late pop SFX.
        if (this.isStopped) {
          return;
        }
        this.options.onCannonFire?.(1);
      });
    }
  }

  /** Start the top rain after `delayMs` (default 0.3 s, §4.3). */
  startRain(delayMs: number = CONFETTI_RAIN_DELAY_MS): void {
    if (this.isStopped) {
      return;
    }
    this.scene.time.delayedCall(delayMs, () => {
      if (this.isStopped) {
        return;
      }
      const width = this.options.widthPx ?? this.scene.scale.width;
      for (const flake of confettiRainPieces(goal.confettiRainCount, width, this.palette, goal.confettiRainFallMs, this.rng)) {
        this.spawnRainPiece(flake);
      }
    });
  }

  /** Stop spawning and fade existing pieces (tap-skip). */
  stop(): void {
    this.isStopped = true;
    for (const piece of this.pieces) {
      this.ballisticTweens.get(piece)?.stop();
      this.scene.tweens.killTweensOf(piece);
      this.scene.tweens.add({ targets: piece, alpha: 0, duration: 150, onComplete: () => piece.destroy() });
    }
    this.ballisticTweens.clear();
    this.pieces.length = 0;
  }

  destroy(): void {
    this.isStopped = true;
    for (const piece of this.pieces) {
      this.ballisticTweens.get(piece)?.stop();
      this.scene.tweens.killTweensOf(piece);
      piece.destroy();
    }
    this.ballisticTweens.clear();
    this.pieces.length = 0;
  }

  private spawnCannonPiece(origin: Vec2Px, piece: ConfettiPiece): void {
    const rect = this.addRect(origin.x, origin.y, piece.sizePx, piece.color);
    const rad = (piece.angleDeg * Math.PI) / 180;
    const vx = Math.cos(rad) * piece.speedPxPerSec * piece.directionX;
    const vy = -Math.sin(rad) * piece.speedPxPerSec;
    const gravity = CONFETTI_BASE_GRAVITY_PX * goal.confettiGravityScale;
    const fall = this.options.heightPx ?? this.scene.scale.height;
    this.animateBallistic(rect, origin, vx, vy, gravity, piece.spinDegPerSec, piece.swayPhase, fall);
  }

  private spawnRainPiece(flake: ConfettiRainPiece): void {
    const rect = this.addRect(flake.xPx, -flake.sizePx, flake.sizePx, flake.color);
    const gravity = CONFETTI_BASE_GRAVITY_PX * goal.confettiGravityScale;
    const fall = this.options.heightPx ?? this.scene.scale.height;
    this.scene.tweens.add({
      targets: rect,
      delay: flake.delayMs,
      alpha: 0,
      duration: goal.confettiRainFallMs,
      onComplete: () => this.removePiece(rect),
    });
    this.animateBallistic(
      rect,
      { x: flake.xPx, y: -flake.sizePx },
      0,
      0,
      gravity,
      flake.spinDegPerSec,
      flake.swayPhase,
      fall + flake.sizePx,
    );
  }

  private animateBallistic(
    rect: Phaser.GameObjects.Rectangle,
    origin: Vec2Px,
    vx: number,
    vy: number,
    gravity: number,
    spinDegPerSec: number,
    swayPhase: number,
    fallPx: number,
  ): void {
    // Integrate y = y0 + vy*t + 0.5*g*t^2 until the piece drops `fallPx` below
    // the origin; x adds a gentle sway. A proxy tween carries the elapsed time.
    const proxy = { t: 0 };
    const totalT = Math.max(0.2, (vy + Math.sqrt(vy * vy + 2 * gravity * fallPx)) / gravity);
    const tween = this.scene.tweens.add({
      targets: proxy,
      t: totalT,
      duration: totalT * 1000,
      ease: 'Linear',
      onUpdate: () => {
        const t = proxy.t;
        const sway = Math.sin(t * 6 + swayPhase) * CONFETTI_SWAY_AMPLITUDE_PX;
        rect.setPosition(origin.x + vx * t + sway, origin.y + vy * t + 0.5 * gravity * t * t);
        rect.setAngle(rect.angle + spinDegPerSec * (1 / 60));
      },
      onComplete: () => this.removePiece(rect),
    });
    this.ballisticTweens.set(rect, tween);
  }

  private addRect(x: number, y: number, size: number, fill: number): Phaser.GameObjects.Rectangle {
    const rect = this.scene.add.rectangle(x, y, size, size * 0.6, fill);
    if (this.options.depth !== undefined) {
      rect.setDepth(this.options.depth);
    }
    this.pieces.push(rect);
    return rect;
  }

  private removePiece(rect: Phaser.GameObjects.Rectangle): void {
    const index = this.pieces.indexOf(rect);
    if (index >= 0) {
      this.pieces.splice(index, 1);
    }
    this.ballisticTweens.delete(rect);
    this.scene.tweens.killTweensOf(rect);
    rect.destroy();
  }
}

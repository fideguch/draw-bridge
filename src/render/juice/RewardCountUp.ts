/**
 * RewardCountUp + CoinBurstFlight — the goal reward tally (拍5) and coin
 * burst→collect (T060, game_design §4.3 3-5 / 3-6).
 *
 * `RewardCountUp` is a Phaser-free, update-driven state machine: the wiring
 * feeds it frame deltas and it eases the displayed value 0→amount over
 * goal.countUpSec with an ease-out curve, firing `onTick(value, pitch)` on the
 * goal.tickSoundIntervalMs cadence with a rising pitch (§4.3 "チック音…ピッチ
 * 1.0→1.3 上昇"). `skip()` jumps to the end (tap-skip, §4.4 X-3). Keeping it pure
 * makes value progression and tick pitch headless-testable.
 *
 * `CoinBurstFlight` is the Phaser-facing half (type-only Phaser import so this
 * module still imports headless): coins explode radially then fly to the counter
 * on a per-coin stagger, each calling `onArrive(i)` so the wiring plays the
 * semitone-up chime + counter punch (callback injection keeps this presentation-
 * pure, matching HapticsRouter's precedent). The pure flight schedule is
 * extracted so it unit-tests without a scene.
 */

import type Phaser from 'phaser';
import { goal } from '@tuning/TuningConstants';
import { clamp, lerp } from './cameraMath';

/**
 * TODO(tuning): §4.3 3-5 fixes the tick pitch sweep at 1.0→1.3 but no
 * TuningConstants field carries it (goal.tickSoundIntervalMs is only the
 * cadence). Local until the goal group gains a tickPitchMin/Max.
 */
const COUNTUP_TICK_PITCH_MIN = 1.0;
const COUNTUP_TICK_PITCH_MAX = 1.3;

/**
 * TODO(tuning): §4.3 3-6 fixes the counter punch at scale 1.0→1.2→1.0 over
 * 100 ms; no TuningConstants field exists (coin.popScale 1.3 is the pickup pop,
 * a different moment). Local until a goal.coinCounterPunch* is added.
 */
const COIN_COUNTER_PUNCH_SCALE = 1.2;
const COIN_COUNTER_PUNCH_MS = 100;

/**
 * TODO(tuning): radial burst reach/size for the coin explosion (§4.3 3-6 gives
 * counts/flight timing via the goal group but not the explode geometry). Local
 * pixel provisionals until the tuning panel covers them.
 */
const COIN_BURST_REACH_PX = 90;
const COIN_BURST_SIZE_PX = 14;
const COIN_BURST_EXPLODE_MS = 160;

// ── pure count-up math ────────────────────────────────────────────────────────

/** Ease-out cubic on [0, 1] — fast then decelerating (§4.3 3-5 ease-out). */
export function easeOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  const inv = 1 - c;
  return 1 - inv * inv * inv;
}

/** Eased displayed value between `from` and `to` at linear `progress` [0, 1]. */
export function countUpValue(from: number, to: number, progress: number): number {
  return lerp(from, to, easeOutCubic(progress));
}

/** Rising tick pitch across the count-up (1.0 → 1.3 by default, §4.3 3-5). */
export function countUpTickPitch(
  progress: number,
  minPitch: number = COUNTUP_TICK_PITCH_MIN,
  maxPitch: number = COUNTUP_TICK_PITCH_MAX,
): number {
  return lerp(minPitch, maxPitch, clamp(progress, 0, 1));
}

/** Counter punch scale/duration (1.0→1.2→1.0 over 100 ms) for the wiring. */
export const coinCounterPunch = {
  scale: COIN_COUNTER_PUNCH_SCALE,
  durationMs: COIN_COUNTER_PUNCH_MS,
} as const;

// ── pure coin-flight schedule ─────────────────────────────────────────────────

export interface CoinFlightStep {
  readonly index: number;
  /** Real-ms delay before this coin begins its flight to the counter. */
  readonly delayMs: number;
  /** Radial explode direction (radians), evenly distributed. */
  readonly radialAngle: number;
}

/**
 * Per-coin flight schedule: a staggered delay (goal.coinStaggerMs apart) plus an
 * even radial explode angle. Pure so counts/stagger are headless-testable.
 */
export function coinFlightSchedule(
  nCoins: number,
  staggerMs: number = goal.coinStaggerMs,
): CoinFlightStep[] {
  const count = Math.max(0, Math.floor(nCoins));
  const steps: CoinFlightStep[] = [];
  for (let i = 0; i < count; i++) {
    steps.push({ index: i, delayMs: i * staggerMs, radialAngle: (i / count) * Math.PI * 2 });
  }
  return steps;
}

// ── RewardCountUp (pure, update-driven) ───────────────────────────────────────

export interface RewardCountUpOptions {
  /** Count-up duration in ms. Defaults to goal.countUpSec. */
  readonly durationMs?: number;
  /** Tick-sound cadence in ms. Defaults to goal.tickSoundIntervalMs. */
  readonly tickIntervalMs?: number;
  /** Fired on each tick with the current displayed value + rising pitch. */
  readonly onTick?: (value: number, pitch: number) => void;
  /** Fired once when the tally reaches `to` (naturally or via skip()). */
  readonly onDone?: (finalValue: number) => void;
}

export class RewardCountUp {
  private from = 0;
  private to = 0;
  private durationMs = goal.countUpSec * 1000;
  private tickIntervalMs = goal.tickSoundIntervalMs;
  private elapsedMs = 0;
  private nextTickAtMs = 0;
  private isActiveFlag = false;
  private onTick?: (value: number, pitch: number) => void;
  private onDone?: (finalValue: number) => void;

  /** Begin counting `from`→`to`. Restarts cleanly if already running. */
  start(from: number, to: number, options: RewardCountUpOptions = {}): void {
    this.from = from;
    this.to = to;
    this.durationMs = Math.max(0, options.durationMs ?? goal.countUpSec * 1000);
    this.tickIntervalMs = Math.max(1, options.tickIntervalMs ?? goal.tickSoundIntervalMs);
    this.onTick = options.onTick;
    this.onDone = options.onDone;
    this.elapsedMs = 0;
    this.nextTickAtMs = 0;
    this.isActiveFlag = true;
  }

  get isRunning(): boolean {
    return this.isActiveFlag;
  }

  /** Progress in [0, 1] (linear time; the value curve eases this). */
  get progress(): number {
    return this.durationMs <= 0 ? 1 : clamp(this.elapsedMs / this.durationMs, 0, 1);
  }

  /** Current displayed (integer) value. */
  get value(): number {
    return Math.round(countUpValue(this.from, this.to, this.progress));
  }

  /** Advance by `deltaMs`, firing ticks on cadence and onDone at the end. */
  update(deltaMs: number): void {
    if (!this.isActiveFlag) {
      return;
    }
    this.elapsedMs += Math.max(0, deltaMs);
    const tickCeil = Math.min(this.elapsedMs, this.durationMs);
    while (this.isActiveFlag && this.nextTickAtMs <= tickCeil) {
      const p = this.durationMs <= 0 ? 1 : clamp(this.nextTickAtMs / this.durationMs, 0, 1);
      this.onTick?.(Math.round(countUpValue(this.from, this.to, p)), countUpTickPitch(p));
      this.nextTickAtMs += this.tickIntervalMs;
    }
    if (this.elapsedMs >= this.durationMs) {
      this.finish();
    }
  }

  /** Jump to the final value immediately (tap-skip). */
  skip(): void {
    if (!this.isActiveFlag) {
      return;
    }
    this.elapsedMs = this.durationMs;
    this.finish();
  }

  private finish(): void {
    this.isActiveFlag = false;
    this.onDone?.(this.to);
  }
}

// ── CoinBurstFlight (Phaser-facing) ───────────────────────────────────────────

export interface CoinBurstOptions {
  /** Coin count. Defaults to goal.coinBurstCount. */
  readonly count?: number;
  /** Per-coin flight duration in ms. Defaults to goal.coinFlightSec. */
  readonly flightMs?: number;
  /** Stagger between coins in ms. Defaults to goal.coinStaggerMs. */
  readonly staggerMs?: number;
  /** Called as each coin reaches the counter (semitone chime + punch). */
  readonly onArrive?: (index: number) => void;
  readonly depth?: number;
}

export interface CoinBurstColors {
  /** Coin fill (0xRRGGBB) — the wiring passes color.coin. */
  readonly coinColor: number;
  /** Coin outline — the wiring passes color.coinStroke. */
  readonly strokeColor: number;
}

export class CoinBurstFlight {
  private readonly scene: Phaser.Scene;
  private readonly colors: CoinBurstColors;
  private readonly coins: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene, colors: CoinBurstColors) {
    this.scene = scene;
    this.colors = colors;
  }

  /**
   * Explode `count` coins radially from `fromPx`, then fly each to `toPx` on a
   * staggered ease-in, calling `onArrive(i)` per landing (§4.3 3-6).
   */
  burst(fromPx: Vec2Px, toPx: Vec2Px, options: CoinBurstOptions = {}): void {
    const flightMs = (options.flightMs ?? goal.coinFlightSec * 1000);
    const schedule = coinFlightSchedule(options.count ?? goal.coinBurstCount, options.staggerMs);
    for (const step of schedule) {
      this.launchCoin(step, fromPx, toPx, flightMs, options);
    }
  }

  destroy(): void {
    for (const coin of this.coins) {
      this.scene.tweens.killTweensOf(coin);
      coin.destroy();
    }
    this.coins.length = 0;
  }

  private launchCoin(
    step: CoinFlightStep,
    fromPx: Vec2Px,
    toPx: Vec2Px,
    flightMs: number,
    options: CoinBurstOptions,
  ): void {
    const graphics = this.scene.add.graphics();
    if (options.depth !== undefined) {
      graphics.setDepth(options.depth);
    }
    graphics.setPosition(fromPx.x, fromPx.y);
    this.drawCoin(graphics);
    this.coins.push(graphics);

    const explodeX = fromPx.x + Math.cos(step.radialAngle) * COIN_BURST_REACH_PX;
    const explodeY = fromPx.y + Math.sin(step.radialAngle) * COIN_BURST_REACH_PX;
    // Stage 1: radial explode. Stage 2 (after the stagger): fly to the counter.
    this.scene.tweens.add({
      targets: graphics,
      x: explodeX,
      y: explodeY,
      duration: COIN_BURST_EXPLODE_MS,
      ease: 'Quad.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: graphics,
          x: toPx.x,
          y: toPx.y,
          duration: flightMs,
          delay: step.delayMs,
          ease: 'Quad.In',
          onComplete: () => {
            options.onArrive?.(step.index);
            graphics.setVisible(false);
          },
        });
      },
    });
  }

  private drawCoin(graphics: Phaser.GameObjects.Graphics): void {
    const r = COIN_BURST_SIZE_PX / 2;
    graphics.fillStyle(this.colors.coinColor, 1);
    graphics.fillCircle(0, 0, r);
    graphics.lineStyle(2, this.colors.strokeColor, 1);
    graphics.strokeCircle(0, 0, r);
  }
}

interface Vec2Px {
  readonly x: number;
  readonly y: number;
}

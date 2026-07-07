/**
 * GoalSequence — the goal 5-beat celebration orchestrator (T060, game_design
 * §4.3; AC-5). Runs on 'cleared' and drives, in order:
 *
 *   拍1-2  hit-stop → slow-mo → recover (TimeScaleController.goalCelebration);
 *          the controller's onScaleChange (wired in PlayScene) mirrors the scale
 *          onto the camera zoom via slowMoZoom(), and its SCALED delta feeds
 *          sim.advance so the (already-ended) physics + camera slow together.
 *   拍3    Confetti — two cannons at the goal flag + a delayed top rain.
 *   拍4    Stars — StarBurstView pops the earned stars one at a time, each firing
 *          the C-E-G arpeggio (+ cymbal on the 3rd) and the ascending haptic.
 *   拍5    Reward count-up + a coin burst that flies into the overlay coin
 *          counter (tick pitch 1.0→1.3, semitone chime + counter punch on land).
 *   then   the ResultOverlay Replay/Next buttons; Next activates after
 *          goal.nextActivateDelaySec with a pulse.
 *
 * ── Camera-zoom vs dev-hook constraint (documented choice) ───────────────────
 * The level is framed at camera zoom 1 so world-pixel == screen-pixel and the
 * E2E world↔screen round-trip is exact. Rather than add a second camera, the
 * celebration zooms the ONE main camera ONLY during the hit-stop/slow-mo window
 * (no hook-critical interaction happens then) and restores zoom to EXACTLY 1
 * (setZoomImmediate) at the moment the results panel is revealed — BEFORE any
 * button is shown, before Next can activate, and before the play state flips to
 * 'result'. Because the panel + stars + coin flight are only ever shown at zoom
 * 1, every screen-space UI target is undistorted; only WORLD-space effects
 * (confetti, coin-burst source) play during the zoom, and those are placed in
 * world-pixel space so the main camera zooms them correctly.
 *
 * Every beat is tap-skippable (§4.4 X-3): a tap anywhere calls skip(), which
 * snaps time back to normal, reveals the panel immediately, and fast-forwards
 * confetti/stars/count-up to their end — Next still activates on its own timer.
 */

import type Phaser from 'phaser';
import type { WorldToPixel } from '@render/world/worldToPixel';
import type { CameraDirector } from '@render/juice/CameraDirector';
import type { TimeScaleController } from '@render/juice/TimeScale';
import { ConfettiCelebration } from '@render/juice/Confetti';
import { StarBurstView } from '@render/juice/StarBurst';
import { RewardCountUp, CoinBurstFlight } from '@render/juice/RewardCountUp';
import { setDevResultNextReady } from '@render/devhook';
import { color } from '@render/ui/theme';
import { camera as cameraTuning, goal } from '@tuning/TuningConstants';
import type { AttemptJuice } from '@render/ui/services';
import type { ResultOverlay } from './ResultOverlay';

/** Celebration draw depths (above the overlay scrim 2000 / buttons 2001). */
const DEPTH = { confetti: 2100, stars: 2150, coinBurst: 2200, skipCatcher: 2500 } as const;
/** Horizontal offset of each confetti cannon from the flag centre (world px). */
const CANNON_OFFSET_PX = 40;

export interface GoalCelebrationData {
  readonly stars: 1 | 2 | 3;
  readonly coins: number;
  readonly hasNext: boolean;
  readonly onReplay: () => void;
  readonly onNext: () => void;
}

export interface GoalSequenceDeps {
  readonly scene: Phaser.Scene;
  readonly director: CameraDirector;
  readonly timeScale: TimeScaleController;
  readonly overlay: ResultOverlay;
  readonly juice: AttemptJuice;
  /** World metres → world pixels (camera zooms these; not screen px). */
  readonly transform: WorldToPixel;
  /** Goal flag centre in world metres (confetti + coin-burst anchor). */
  readonly flagWorldCenter: { readonly x: number; readonly y: number };
  /** Festive confetti colours (0xRRGGBB). */
  readonly confettiPalette: readonly number[];
  /** Flip the play state to 'result' (dev hook + tempo) at panel reveal. */
  readonly markResultState: () => void;
}

export class GoalSequence {
  private readonly deps: GoalSequenceDeps;
  private readonly stars: StarBurstView;
  private readonly countUp = new RewardCountUp();
  private confetti: ConfettiCelebration | null = null;
  private coinBurst: CoinBurstFlight | null = null;
  private skipCatcher: Phaser.GameObjects.Rectangle | null = null;
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  private data: GoalCelebrationData | null = null;
  private revealed = false;
  private active = false;

  constructor(deps: GoalSequenceDeps) {
    this.deps = deps;
    this.stars = new StarBurstView(deps.scene, {
      filledColor: color.star,
      borderColor: color.inkBorder,
      depth: DEPTH.stars,
    });
  }

  /** Begin the celebration (called from PlayScene on a real clear). */
  start(data: GoalCelebrationData): void {
    this.reset();
    this.data = data;
    this.active = true;
    setDevResultNextReady(false);

    // 拍1-2: hit-stop → slow-mo → recover (camera zoom via PlayScene onScaleChange).
    this.deps.timeScale.goalCelebration();
    this.deps.director.addTrauma(cameraTuning.traumaGoal);
    this.deps.juice.duckBgm();

    // Full-screen tap catcher until the panel appears (then the scrim skips).
    const width = this.deps.scene.scale.width;
    const height = this.deps.scene.scale.height;
    this.skipCatcher = this.deps.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.skipCatcher)
      .setInteractive({ useHandCursor: false });
    this.skipCatcher.on('pointerdown', () => this.skip());

    // 拍3: confetti as the slow-mo settles; 拍4-5 + panel after the envelope.
    this.schedule(goal.hitStopMs, () => this.fireConfetti());
    this.schedule(this.envelopeMs(), () => this.revealPanel());
  }

  /** Advance the reward count-up (real frame delta — celebration is real-time). */
  update(realDeltaMs: number): void {
    if (this.active) {
      this.countUp.update(realDeltaMs);
    }
  }

  /** Tap-skip: snap time to normal, reveal the panel, fast-forward every beat. */
  skip(): void {
    if (!this.active) {
      return;
    }
    this.deps.timeScale.cancel();
    this.clearTimers();
    if (!this.revealed) {
      this.revealPanel();
    }
    this.confetti?.stop();
    this.stars.skip();
    this.countUp.skip();
    this.coinBurst?.destroy();
    this.coinBurst = null;
  }

  /** Tear down for restart / next / shutdown. Restores time + zoom + Next flag. */
  reset(): void {
    this.active = false;
    this.revealed = false;
    this.data = null;
    setDevResultNextReady(false);
    this.clearTimers();
    this.skipCatcher?.destroy();
    this.skipCatcher = null;
    this.confetti?.destroy();
    this.confetti = null;
    this.coinBurst?.destroy();
    this.coinBurst = null;
    this.stars.destroy();
  }

  destroy(): void {
    this.reset();
  }

  // ── beats ────────────────────────────────────────────────────────────────

  private fireConfetti(): void {
    const flag = this.deps.transform.point(this.deps.flagWorldCenter);
    this.confetti = new ConfettiCelebration(this.deps.scene, {
      palette: this.deps.confettiPalette,
      depth: DEPTH.confetti,
      widthPx: this.deps.scene.scale.width,
      heightPx: this.deps.scene.scale.height,
      onCannonFire: (side) => this.deps.juice.goalConfettiPop(side),
    });
    this.confetti.fireCannons([
      { x: flag.x - CANNON_OFFSET_PX, y: flag.y },
      { x: flag.x + CANNON_OFFSET_PX, y: flag.y },
    ]);
    this.confetti.startRain();
  }

  private revealPanel(): void {
    if (this.revealed) {
      return;
    }
    this.revealed = true;
    // Zoom back to EXACTLY 1 before any screen-space UI / Next / 'result' state.
    this.deps.director.setZoomImmediate(1);
    this.skipCatcher?.destroy();
    this.skipCatcher = null;
    this.deps.markResultState();

    const data = this.data;
    if (data === null) {
      return;
    }
    this.deps.overlay.showClearShell({
      hasNext: data.hasNext,
      onReplay: data.onReplay,
      onNext: data.onNext,
      onSkip: () => this.skip(),
    });

    // 拍4: sequential stars with arpeggio + ascending haptic.
    const starsAnchor = { x: this.deps.scene.scale.width / 2, y: this.deps.scene.scale.height * 0.42 - 150 };
    this.stars.showStars(data.stars, starsAnchor, { onBeat: (index) => this.deps.juice.goalStarBeat(index) });

    // 拍5: reward count-up + coin burst into the overlay counter.
    this.startReward(data.coins);

    // Next activates after the tempo delay, then pulses (§4.3 3-7).
    this.schedule(goal.nextActivateDelaySec * 1000, () => {
      this.deps.overlay.activateNext();
      setDevResultNextReady(true);
    });
  }

  private startReward(coins: number): void {
    if (coins <= 0) {
      this.deps.overlay.setCoinDisplay(0);
      this.deps.juice.unduckBgm();
      return;
    }
    const counterPos = this.deps.overlay.coinCounterScreenPos();
    const fromPx = this.deps.transform.point(this.deps.flagWorldCenter);

    this.countUp.start(0, coins, {
      onTick: (value) => {
        this.deps.overlay.setCoinDisplay(value);
        this.deps.juice.goalCountTick(this.countUp.progress);
      },
      onDone: (finalValue) => {
        this.deps.overlay.setCoinDisplay(finalValue);
        this.deps.juice.unduckBgm();
      },
    });

    this.coinBurst = new CoinBurstFlight(this.deps.scene, {
      coinColor: color.coin,
      strokeColor: color.coinStroke,
    });
    this.coinBurst.burst(fromPx, counterPos, {
      depth: DEPTH.coinBurst,
      onArrive: (index) => {
        this.deps.juice.goalCoinArrive(index);
        this.deps.overlay.punchCoinCounter();
      },
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private envelopeMs(): number {
    return goal.hitStopMs + goal.slowHoldSec * 1000 + goal.slowRecoverSec * 1000;
  }

  private schedule(delayMs: number, callback: () => void): void {
    this.timers.push(this.deps.scene.time.delayedCall(delayMs, callback));
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      timer.remove(false);
    }
    this.timers.length = 0;
  }
}

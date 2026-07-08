/**
 * GoalSequence — the goal 5-beat celebration orchestrator (T060, game_design
 * §4.3; AC-5). Runs on 'cleared' and drives, in order:
 *
 *   IMPACT (t=0, impact-first overhaul 2026-07-08, research 10): every punch
 *          layer fires at once — hit-stop→slow-mo→recover, camera trauma 0.5 +
 *          zoom-kick, cream screen flash, confetti cannons + center burst, and a
 *          clear stinger + THUD (juice.goalImpact). Confetti was pulled from
 *          schedule(hitStopMs) to t=0 so it lands ON the cut.
 *   拍1-2  hit-stop → slow-mo → recover (TimeScaleController.goalCelebration);
 *          the controller's onScaleChange (wired in PlayScene) mirrors the scale
 *          onto the camera zoom via slowMoZoom(), and its SCALED delta feeds
 *          sim.advance so the (already-ended) physics + camera slow together.
 *   拍3    Confetti — two cannons at the goal flag + a delayed top rain.
 *   拍4    Stars — StarBurstView pops the earned stars one at a time, each firing
 *          the C-E-G arpeggio (+ cymbal on the 3rd) and the ascending haptic.
 *   拍5    Reward count-up + a coin burst that flies into the overlay coin
 *          counter (tick pitch 1.0→1.3, semitone chime + counter punch on land).
 *   then   the ResultOverlay Replay/Next buttons; Next is DECOUPLED from the
 *          afterglow — it activates goal.nextActivateDelaySec (0.3 s) after the
 *          panel with a scale-in pop + pulse, so it is tappable ~0.9 s from the
 *          clear tick (≤1 s, user directive 2026-07-08) while stars / coins /
 *          confetti / sunburst keep playing behind the active panel.
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
import { ParticleBurst } from '@render/juice/ParticleBurst';
import { RewardCountUp, CoinBurstFlight } from '@render/juice/RewardCountUp';
import { setDevResultNextReady } from '@render/devhook';
import { color } from '@render/ui/theme';
import { camera as cameraTuning, goal } from '@tuning/TuningConstants';
import type { AttemptJuice } from '@render/ui/services';
import type { ResultOverlay } from './ResultOverlay';

/**
 * Celebration draw depths (above the overlay scrim/sunburst/content 2000-2003).
 * `flash` (L1) sits above the confetti so the impact reads as a full-screen
 * punch; the skipCatcher stays on top so a tap anywhere still skips.
 */
const DEPTH = { confetti: 2100, stars: 2150, coinBurst: 2200, flash: 2300, skipCatcher: 2500 } as const;
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
  private centerBurst: ParticleBurst | null = null;
  private coinBurst: CoinBurstFlight | null = null;
  private skipCatcher: Phaser.GameObjects.Rectangle | null = null;
  private flashRect: Phaser.GameObjects.Rectangle | null = null;
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  private data: GoalCelebrationData | null = null;
  private revealed = false;
  private nextActivated = false;
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

    // IMPACT at t=0 (research 10 §4/§6.1): fire every punch layer simultaneously
    // so the clear reads as one big "切断面" hit — hit-stop→slow-mo→recover
    // envelope, trauma 0.5, camera zoom-kick, cream screen flash, confetti
    // cannons + center burst, clear stinger + THUD haptic. (Confetti was pulled
    // 100 ms earlier — from schedule(hitStopMs) to t=0 — so it lands on impact.)
    this.deps.timeScale.goalCelebration();
    this.deps.director.addTrauma(cameraTuning.traumaGoal);
    this.deps.director.zoomKick(goal.zoomKickPct, goal.zoomKickRecoverMs);
    this.deps.juice.duckBgm();
    this.deps.juice.goalImpact();
    this.fireFlash();
    this.fireConfetti();

    // Full-screen tap catcher until the panel appears (then the scrim skips).
    const width = this.deps.scene.scale.width;
    const height = this.deps.scene.scale.height;
    this.skipCatcher = this.deps.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.skipCatcher)
      .setInteractive({ useHandCursor: false });
    this.skipCatcher.on('pointerdown', () => this.skip());

    // Panel (+ stars / count-up / coins, and the decoupled Next timer) after the
    // now-600 ms envelope. Afterglow keeps playing behind the active panel.
    this.schedule(this.envelopeMs(), () => this.revealPanel());
  }

  /** L1 screen flash (impact "切断面" punch): a cream full-screen fade 0.45→0. */
  private fireFlash(): void {
    const scene = this.deps.scene;
    const width = scene.scale.width;
    const height = scene.scale.height;
    const rect = scene.add
      .rectangle(width / 2, height / 2, width, height, color.inkLine, goal.flashPeakAlpha)
      .setScrollFactor(0)
      .setDepth(DEPTH.flash);
    this.flashRect = rect;
    scene.tweens.add({
      targets: rect,
      alpha: 0,
      duration: goal.flashMs,
      ease: 'Quad.Out',
      onComplete: () => {
        rect.destroy();
        if (this.flashRect === rect) {
          this.flashRect = null;
        }
      },
    });
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
    // A tap means "proceed": make Next live immediately. This ALSO repairs the
    // case where the panel was already revealed — clearTimers() above dropped the
    // pending Next-activation timer, and revealPanel() (which re-arms it) is
    // skipped, so without this the button would never activate. Idempotent.
    this.activateNextNow();
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
    this.nextActivated = false;
    this.data = null;
    setDevResultNextReady(false);
    this.clearTimers();
    // Codex R2 HIGH-2: an early Replay (before the count-up finished) left the
    // BGM ducked forever — every exit path must finish the count-up and unduck.
    this.countUp.skip();
    this.deps.juice.unduckBgm();
    this.skipCatcher?.destroy();
    this.skipCatcher = null;
    if (this.flashRect !== null) {
      this.deps.scene.tweens.killTweensOf(this.flashRect);
      this.flashRect.destroy();
      this.flashRect = null;
    }
    this.confetti?.destroy();
    this.confetti = null;
    this.centerBurst?.destroy();
    this.centerBurst = null;
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

    // L5 center burst: a full-circle spray straight out of the flag in the
    // festive palette, so the goal point has a "主役" one-shot at impact. World-
    // pixel space (like the confetti) so the celebration zoom carries it.
    this.centerBurst?.destroy();
    this.centerBurst = new ParticleBurst(this.deps.scene, {
      depth: DEPTH.confetti,
      gravityPx: 0,
      lifeMsMin: goal.burstLifeMinMs,
      lifeMsMax: goal.burstLifeMaxMs,
    });
    const palette = this.deps.confettiPalette;
    const perColor = Math.ceil(goal.centerBurstCount / Math.max(1, palette.length));
    for (const pieceColor of palette) {
      this.centerBurst.emit(flag.x, flag.y, {
        count: perColor,
        color: pieceColor,
        speedPxMin: goal.centerBurstSpeedMinPx,
        speedPxMax: goal.centerBurstSpeedMaxPx,
      });
    }
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
    // Next is now tappable DURING the afterglow (decoupled, user directive
    // 2026-07-08), i.e. while the reward count-up is still ticking. Tapping
    // Replay/Next must therefore FIRST finalize the celebration (skip() snaps the
    // count-up to its final value and stops it) so no queued count-up tick writes
    // into the coin Text after the scene tears it down on transition — that race
    // otherwise throws inside Text.setText (null texture) and wedges the scene.
    this.deps.overlay.showClearShell({
      hasNext: data.hasNext,
      onReplay: () => {
        this.skip();
        data.onReplay();
      },
      onNext: () => {
        this.skip();
        data.onNext();
      },
      onSkip: () => this.skip(),
    });

    // 拍4: sequential stars with arpeggio + ascending haptic.
    const starsAnchor = { x: this.deps.scene.scale.width / 2, y: this.deps.scene.scale.height * 0.42 - 150 };
    this.stars.showStars(data.stars, starsAnchor, { onBeat: (index) => this.deps.juice.goalStarBeat(index) });

    // 拍5: reward count-up + coin burst into the overlay counter.
    this.startReward(data.coins);

    // Next activates after the (decoupled) tempo delay, then pulses (§4.3 3-7).
    this.schedule(goal.nextActivateDelaySec * 1000, () => this.activateNextNow());
  }

  /** Enable Next + flip the dev-ready flag. Idempotent (timer or tap-skip). */
  private activateNextNow(): void {
    if (this.nextActivated) {
      return;
    }
    this.nextActivated = true;
    this.deps.overlay.activateNext();
    setDevResultNextReady(true);
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

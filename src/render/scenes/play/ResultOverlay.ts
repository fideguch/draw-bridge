/**
 * ResultOverlay — the clear / fail result surface. The clear path is the "shell"
 * the Phase 6 GoalSequence (T060) drives: a scrim + title + coin counter +
 * Replay / Next buttons. The celebration BEATS (hit-stop, confetti, sequential
 * stars, reward count-up, coin burst) live in GoalSequence, which calls back into
 * this shell to move the coin counter (setCoinDisplay / punchCoinCounter) and to
 * activate Next when the sequence completes (activateNext). A tap on the scrim
 * skips the whole sequence (onSkip → GoalSequence.skip()).
 *
 * Fail keeps its own self-contained path: dim + cause hint + Retry (§4.4 X-3
 * "失敗は暗転+短い残念音のみ"). Buttons carry the E2E dev ids (result-replay /
 * result-next / result-retry) and are pinned with setScrollFactor(0) so their
 * screen rects are camera-immune (the dev hook resolves buttonRect from container
 * x/y — see devhook.ts).
 */

import Phaser from 'phaser';
import type { FailCause } from '@engine/rules/Judge';
import { Button } from '@render/ui/Button';
import { borderedCircle } from '@render/ui/fillShapes';
import type { GameServices } from '@render/ui/services';
import { color, layout, makeTextStyle, scrim, stroke, type } from '@render/ui/theme';
import { coinCounterPunch } from '@render/juice/RewardCountUp';
import { SunburstView } from '@render/juice/SunburstView';
import { goal } from '@tuning/TuningConstants';

/**
 * Depths above the HUD (InkBarView sits at 1000). The clear shell layers, back to
 * front: scrim → sunburst rays (L8) → content (title / coin) → buttons. The
 * GoalSequence confetti / coin-burst sit above all of these (2100+).
 */
const SCRIM_DEPTH = 2000;
const SUNBURST_DEPTH = 2001;
const OVERLAY_DEPTH = 2002;
const OVERLAY_BUTTON_DEPTH = 2003;

export interface ClearShellData {
  readonly hasNext: boolean;
  readonly onReplay: () => void;
  readonly onNext: () => void;
  /** Tap-anywhere skip of the running celebration (§4.4 X-3). */
  readonly onSkip: () => void;
}

export interface FailOverlayData {
  readonly cause: FailCause;
  readonly onRetry: () => void;
}

const FAIL_HINT: Record<FailCause, string> = {
  fall: '橋が落ちてしまった',
  tipOver: '車がひっくり返ってしまった',
  timeout: '時間切れ',
  divergence: 'もう一度ためそう',
};

export class ResultOverlay {
  private readonly scene: Phaser.Scene;
  private readonly services: GameServices;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private coinText: Phaser.GameObjects.Text | null = null;
  private coinTextPos = { x: 0, y: 0 };
  private nextButton: Button | null = null;
  private sunburst: SunburstView | null = null;
  private skipHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, services: GameServices) {
    this.scene = scene;
    this.services = services;
  }

  get isShown(): boolean {
    return this.objects.length > 0;
  }

  /**
   * Clear shell: scrim + "クリア！" + coin counter (0) + Replay(enabled) +
   * Next(disabled). The GoalSequence owns the celebration timing and drives the
   * counter / Next activation through the methods below.
   */
  showClearShell(data: ClearShellData): void {
    this.hide();
    const cx = layout.width / 2;
    const panelY = layout.height * 0.42;

    this.skipHandler = data.onSkip;
    this.addScrim(goal.scrimFadeInMs); // L9: dim fades in to stage the panel

    // L8 sunburst rays radiating from behind the title cluster (above the scrim,
    // below the content). Centred on the title/stars so the convergence sits
    // behind the focal text.
    this.sunburst = new SunburstView(this.scene, { color: color.star, depth: SUNBURST_DEPTH });
    this.sunburst.show(cx, panelY - layout.ui(40), Math.max(layout.width, layout.height));

    // L7 title "クリア！" scale-bounce (Back.Out pop → Quad.Out settle) — no more
    // limp static reveal.
    const title = this.scene.add
      .text(cx, panelY - layout.ui(96), 'クリア！', makeTextStyle(type.display, color.textInverse))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    title.setScale(0);
    this.scene.tweens.add({
      targets: title,
      scale: goal.titlePopScale,
      duration: goal.titlePopMs * 0.6,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: title,
          scale: 1,
          duration: goal.titlePopMs * 0.4,
          ease: 'Quad.Out',
        });
      },
    });
    this.track(title);
    this.addCoinCounter(cx, panelY + layout.ui(40));

    const replay = this.makeButton({
      x: cx - layout.ui(92),
      y: panelY + layout.ui(128),
      label: 'Replay',
      variant: 'secondary',
      devId: 'result-replay',
      onClick: data.onReplay,
    });
    const next = this.makeButton({
      x: cx + layout.ui(92),
      y: panelY + layout.ui(128),
      label: data.hasNext ? 'つぎへ' : '一覧へ',
      variant: 'primary',
      devId: 'result-next',
      onClick: data.onNext,
    });
    this.track(replay);
    this.track(next);
    this.nextButton = next;
    next.setEnabled(false);
  }

  /** Fail result: dim + cause hint + Retry (self-contained, no celebration). */
  showFail(data: FailOverlayData): void {
    this.hide();
    const cx = layout.width / 2;
    const panelY = layout.height * 0.4;

    this.addScrim();
    this.track(
      this.scene.add.text(cx, panelY - layout.ui(40), 'ざんねん', makeTextStyle(type.h1, color.textInverse)).setOrigin(0.5),
    );
    this.track(
      this.scene.add
        .text(cx, panelY + layout.ui(8), FAIL_HINT[data.cause], makeTextStyle(type.body, color.textInverse))
        .setOrigin(0.5),
    );
    this.track(
      this.makeButton({
        x: cx,
        y: panelY + layout.ui(84),
        label: 'Retry',
        variant: 'primary',
        devId: 'result-retry',
        onClick: data.onRetry,
      }),
    );
  }

  /** Screen (game-px) position of the coin counter (CoinBurstFlight target). */
  coinCounterScreenPos(): { x: number; y: number } {
    return { ...this.coinTextPos };
  }

  /** Update the coin counter display (driven by the reward count-up). */
  setCoinDisplay(value: number): void {
    this.coinText?.setText(String(Math.max(0, Math.round(value))));
  }

  /** Punch the coin counter (1.0→1.2→1.0) as a coin lands (§4.3 3-6). */
  punchCoinCounter(): void {
    const text = this.coinText;
    if (text === null) {
      return;
    }
    this.scene.tweens.killTweensOf(text);
    text.setScale(1);
    this.scene.tweens.add({
      targets: text,
      scale: coinCounterPunch.scale,
      duration: coinCounterPunch.durationMs * 0.5,
      ease: 'Quad.Out',
      yoyo: true,
    });
  }

  /**
   * Enable Next with a scale-in pop (L13, 0.9→1.0 Back.Out) then its ±5% pulse
   * (§4.3 3-7). The pop draws the eye to the freshly-tappable button now that it
   * arrives early (~0.9 s from clear) instead of after the whole celebration.
   */
  activateNext(): void {
    const next = this.nextButton;
    if (next === null) {
      return;
    }
    next.setEnabled(true);
    this.scene.tweens.killTweensOf(next);
    next.setScale(goal.nextPopScale);
    this.scene.tweens.add({
      targets: next,
      scale: 1,
      duration: goal.nextPopMs,
      ease: 'Back.Out',
      onComplete: () => this.startNextPulse(next),
    });
  }

  /** The steady ±5% breathing pulse that follows the Next scale-in pop. */
  private startNextPulse(next: Button): void {
    this.scene.tweens.add({
      targets: next,
      scale: 1 + goal.nextPulseScalePct / 100,
      duration: goal.nextPulsePeriodSec * 1000,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Tear down the overlay (called on restart / next / scene shutdown). */
  hide(): void {
    this.skipHandler = null;
    this.coinText = null;
    this.nextButton = null;
    this.sunburst?.destroy();
    this.sunburst = null;
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects = [];
  }

  destroy(): void {
    this.hide();
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private addScrim(fadeInMs = 0): void {
    const rect = this.scene.add
      .rectangle(layout.width / 2, layout.height / 2, layout.width, layout.height, scrim.color, scrim.alpha)
      .setScrollFactor(0)
      .setDepth(SCRIM_DEPTH)
      .setInteractive({ useHandCursor: false });
    rect.on('pointerup', () => this.skipHandler?.());
    // L9: the clear path fades the dim in (alpha 0 → scrim.alpha) to stage the
    // panel; fail keeps its instant dim (fadeInMs 0). Alpha never gates the hit
    // area, so tap-skip works throughout the fade.
    if (fadeInMs > 0) {
      rect.setAlpha(0);
      this.scene.tweens.add({ targets: rect, alpha: scrim.alpha, duration: fadeInMs, ease: 'Quad.Out' });
    }
    this.track(rect);
  }

  private addCoinCounter(cx: number, y: number): void {
    const icon = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH);
    borderedCircle(icon, cx - layout.ui(26), y, layout.ui(12), {
      fill: color.coin,
      border: color.coinStroke,
      borderWidth: stroke.ui,
    });
    this.track(icon);

    this.coinTextPos = { x: cx - layout.ui(6), y };
    this.coinText = this.scene.add
      .text(cx - layout.ui(6), y, '0', makeTextStyle(type.h2, color.textInverse))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    this.track(this.coinText);
  }

  private makeButton(options: {
    x: number;
    y: number;
    label: string;
    variant: 'primary' | 'secondary';
    devId: string;
    onClick: () => void;
  }): Button {
    const button = new Button(this.scene, {
      x: options.x,
      y: options.y,
      width: 160,
      height: 56,
      label: options.label,
      variant: options.variant,
      services: this.services,
      devId: options.devId,
      // Defer one tick: every result action tears this overlay down (restart /
      // scene change), so running it inline would destroy the button DURING its
      // own pointerup dispatch. delayedCall(0) lets the dispatch finish first.
      onClick: () => this.scene.time.delayedCall(0, options.onClick),
    });
    button.setScrollFactor(0).setDepth(OVERLAY_BUTTON_DEPTH);
    return button;
  }

  private track(object: Phaser.GameObjects.GameObject): void {
    this.objects.push(object);
  }
}

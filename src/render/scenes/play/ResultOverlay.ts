/**
 * ResultOverlay — the interim clear / fail result surface (T045; the Phase 6
 * GoalSequence T060 5-beat celebration replaces the clear path).
 *
 * Clear: scrim + stars (from the outcome), a simple coin count-up, and Replay /
 * Next buttons — Next is disabled until goal.nextActivateDelaySec then pulses
 * (tempo contract, composition spec §Tempo). Fail: a dimming scrim, a cause
 * hint, and Retry. Every overlay is tap-skippable (tapping the scrim fast-
 * forwards the clear intro and enables Next immediately).
 *
 * Buttons carry the E2E dev ids (result-replay / result-next / result-retry) and
 * are pinned with setScrollFactor(0) so their screen rects are camera-immune
 * (the dev hook resolves buttonRect from container x/y — see devhook.ts).
 */

import Phaser from 'phaser';
import type { FailCause } from '@engine/rules/Judge';
import { Button } from '@render/ui/Button';
import type { GameServices } from '@render/ui/services';
import { color, makeTextStyle, radius, safeArea, scrim, screen, space, type } from '@render/ui/theme';
import { goal } from '@tuning/TuningConstants';

/** Depths above the HUD (InkBarView sits at 1000). */
const OVERLAY_DEPTH = 2000;
const OVERLAY_BUTTON_DEPTH = 2001;
const MAX_STARS = 3;
const STAR_GAP = 56;

export interface ClearOverlayData {
  readonly stars: 1 | 2 | 3;
  readonly coins: number;
  readonly hasNext: boolean;
  readonly onReplay: () => void;
  readonly onNext: () => void;
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
  private coinTween: Phaser.Tweens.Tween | null = null;
  private nextTimer: Phaser.Time.TimerEvent | null = null;
  private coinValue = 0;
  private coinTarget = 0;
  private coinText: Phaser.GameObjects.Text | null = null;
  private nextButton: Button | null = null;
  private skipHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, services: GameServices) {
    this.scene = scene;
    this.services = services;
  }

  get isShown(): boolean {
    return this.objects.length > 0;
  }

  /** Clear result: stars + coin count-up + Replay/Next (tap-skippable). */
  showClear(data: ClearOverlayData): void {
    this.hide();
    const cx = screen.width / 2;
    const panelY = screen.height * 0.38;

    this.addScrim();
    this.track(
      this.scene.add
        .text(cx, panelY - 96, 'クリア！', makeTextStyle(type.display, color.textInverse))
        .setOrigin(0.5),
    );
    this.drawStars(cx, panelY - 24, data.stars);
    this.addCoinRow(cx, panelY + 44, data.coins);

    const replay = this.makeButton({
      x: cx - 92,
      y: panelY + 132,
      label: 'リプレイ',
      variant: 'secondary',
      devId: 'result-replay',
      onClick: data.onReplay,
    });
    const next = this.makeButton({
      x: cx + 92,
      y: panelY + 132,
      label: data.hasNext ? 'つぎへ' : '一覧へ',
      variant: 'primary',
      devId: 'result-next',
      onClick: data.onNext,
    });
    this.track(replay);
    this.track(next);
    this.nextButton = next;
    next.setEnabled(false);

    // Next activates after the tempo delay, then pulses (composition spec §Tempo).
    this.skipHandler = (): void => this.finishClearIntro();
    this.nextTimer = this.scene.time.delayedCall(goal.nextActivateDelaySec * 1000, () =>
      this.activateNext(),
    );
  }

  /** Fail result: dim + cause hint + Retry. */
  showFail(data: FailOverlayData): void {
    this.hide();
    const cx = screen.width / 2;
    const panelY = screen.height * 0.4;

    this.addScrim();
    this.track(
      this.scene.add.text(cx, panelY - 40, 'ざんねん', makeTextStyle(type.h1, color.textInverse)).setOrigin(0.5),
    );
    this.track(
      this.scene.add
        .text(cx, panelY + 8, FAIL_HINT[data.cause], makeTextStyle(type.body, color.textInverse))
        .setOrigin(0.5),
    );
    this.track(
      this.makeButton({
        x: cx,
        y: panelY + 84,
        label: 'もういちど',
        variant: 'primary',
        devId: 'result-retry',
        onClick: data.onRetry,
      }),
    );
  }

  /** Tear down the overlay (called on restart / next / scene shutdown). */
  hide(): void {
    this.coinTween?.remove();
    this.coinTween = null;
    this.nextTimer?.remove(false);
    this.nextTimer = null;
    this.skipHandler = null;
    this.coinText = null;
    this.nextButton = null;
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

  private addScrim(): void {
    const rect = this.scene.add
      .rectangle(screen.width / 2, screen.height / 2, screen.width, screen.height, scrim.color, scrim.alpha)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive({ useHandCursor: false });
    rect.on('pointerup', () => this.skipHandler?.());
    this.track(rect);
  }

  private addCoinRow(cx: number, y: number, coins: number): void {
    this.coinTarget = coins;
    this.coinValue = 0;
    const icon = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH);
    icon.fillStyle(color.coin, 1);
    icon.fillCircle(cx - 26, y, 12);
    icon.lineStyle(2, color.coinStroke, 1);
    icon.strokeCircle(cx - 26, y, 12);
    this.track(icon);

    this.coinText = this.scene.add
      .text(cx - 6, y, '0', makeTextStyle(type.h2, color.textInverse))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    this.track(this.coinText);

    if (coins <= 0) {
      return;
    }
    const counter = { value: 0 };
    this.coinTween = this.scene.tweens.add({
      targets: counter,
      value: coins,
      duration: goal.countUpSec * 1000,
      ease: 'Quad.Out',
      onUpdate: () => {
        this.coinValue = Math.round(counter.value);
        this.coinText?.setText(String(this.coinValue));
      },
    });
  }

  private drawStars(cx: number, y: number, earned: number): void {
    for (let i = 0; i < MAX_STARS; i += 1) {
      const isEarned = i < earned;
      const star = this.scene.add
        .text((i - 1) * STAR_GAP + cx, y, isEarned ? '★' : '☆', makeTextStyle({ size: 44, bold: true }, isEarned ? color.star : color.starEmpty))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH);
      this.track(star);
      if (isEarned) {
        star.setScale(0);
        this.scene.tweens.add({
          targets: star,
          scale: 1,
          delay: i * goal.starIntervalMs,
          duration: goal.starPopMs,
          ease: 'Back.Out',
        });
      }
    }
  }

  /** Fast-forward the clear intro (tap-to-skip): finish count-up + enable Next. */
  private finishClearIntro(): void {
    if (this.coinTween !== null) {
      this.coinTween.remove();
      this.coinTween = null;
      this.coinValue = this.coinTarget;
      this.coinText?.setText(String(this.coinTarget));
    }
    if (this.nextTimer !== null) {
      this.nextTimer.remove(false);
      this.nextTimer = null;
      this.activateNext();
    }
  }

  private activateNext(): void {
    const next = this.nextButton;
    if (next === null) {
      return;
    }
    next.setEnabled(true);
    this.scene.tweens.add({
      targets: next,
      scale: 1 + goal.nextPulseScalePct / 100,
      duration: goal.nextPulsePeriodSec * 1000,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
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

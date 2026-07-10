/**
 * ResultOverlay — the clear / fail result surface. The clear path is the "shell"
 * the GoalSequence drives: a scrim + title + reward coin count-up + a top-right
 * balance pill + Replay / Next + a 強化 link (DESIGN.md §6.4). The celebration
 * BEATS live in GoalSequence, which calls back into this shell to move the reward
 * counter (setCoinDisplay / punchCoinCounter) and activate Next.
 *
 * Fail keeps its own self-contained path: dim + cause hint + Retry (primary L),
 * plus a レベル選択 link and — ONLY when ink shortage caused the fall (§8.4) — a
 * contextual 「インクを増やす」 premium button into the 強化 ink axis. A tap on the
 * scrim skips the clear celebration (onSkip → GoalSequence.skip()).
 *
 * Buttons carry the E2E dev ids and are pinned with setScrollFactor(0) so their
 * screen rects are camera-immune.
 */

import Phaser from 'phaser';
import type { FailCause } from '@engine/rules/Judge';
import { Button } from '@render/ui/Button';
import type { ButtonVariant } from '@render/ui/Button';
import type { IconName } from '@render/ui/icons';
import { CoinCounter } from '@render/ui/CoinCounter';
import { borderedCircle } from '@render/ui/fillShapes';
import type { GameServices } from '@render/ui/services';
import { color, layout, makeTextStyle, margin, scrim, space, stroke, type } from '@render/ui/theme';
import { coinCounterPunch } from '@render/juice/RewardCountUp';
import { SunburstView } from '@render/juice/SunburstView';
import { goal } from '@tuning/TuningConstants';

/**
 * Depths above the HUD. The clear shell layers, back to front: scrim → sunburst
 * rays (L8) → content (title / coin) → buttons. The GoalSequence confetti /
 * coin-burst sit above all of these (2100+).
 */
const SCRIM_DEPTH = 2000;
const SUNBURST_DEPTH = 2001;
const OVERLAY_DEPTH = 2002;
const OVERLAY_BUTTON_DEPTH = 2003;

/** Result 2-choice M-narrow (DESIGN.md §4.1 allowed exception, 148×52). */
const CHOICE_WIDTH_DESIGN = 148;
const CHOICE_HEIGHT_DESIGN = 52;

export interface ClearShellData {
  readonly hasNext: boolean;
  readonly onReplay: () => void;
  readonly onNext: () => void;
  /** Back to the Hub grid (レベル選択 link, DESIGN.md §6.4). */
  readonly onLevels: () => void;
  /** Post-reward 強化 link (DESIGN.md §9 — coins just went up). */
  readonly onUpgrade: () => void;
  /** Tap-anywhere skip of the running celebration (§4.4 X-3). */
  readonly onSkip: () => void;
}

export interface FailOverlayData {
  readonly cause: FailCause;
  readonly onRetry: () => void;
  /** Back to the Hub grid (レベル選択 link, DESIGN.md §6.4). */
  readonly onLevels: () => void;
  /** Subdued 強化 entry when the ink upsell does NOT apply (DESIGN.md §9). */
  readonly onUpgrade: () => void;
  /** Present only when ink shortage caused the fall (§8.4) → 強化 ink axis. */
  readonly onUpgradeInk?: () => void;
}

/**
 * Fail-cause hints. `hazardContact` (round-7 F1) is the unified rock / spike /
 * DangerZone contact death — worded generically ("危険物に当たった") because a
 * single cause covers all three hazard kinds (a rock-specific "岩に…" would be
 * wrong on the ~7 pure spike/zone levels). `fall` and `divergence` are failsafes
 * (isFailsafeReset) routed to a silent reset, so their entries are never shown —
 * kept only to satisfy the exhaustive Record<FailCause, string>.
 */
const FAIL_HINT: Record<FailCause, string> = {
  fall: 'もう一度ためそう',
  tipOver: '車がひっくり返ってしまった',
  timeout: '時間切れ',
  divergence: 'もう一度ためそう',
  hazardContact: '危険物に当たってしまった',
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
   * Clear shell: scrim + "クリア！" + reward counter (0) + balance pill +
   * レベル選択 / Replay / Next / 強化. The GoalSequence owns the celebration
   * timing and drives the counter / Next activation through the methods below.
   */
  showClearShell(data: ClearShellData): void {
    this.hide();
    const cx = layout.width / 2;
    const panelY = layout.height * 0.42;

    this.skipHandler = data.onSkip;
    this.addScrim(goal.scrimFadeInMs); // L9: dim fades in to stage the panel
    this.addTopChrome({ onLevels: data.onLevels, withBalancePill: true });

    // L8 sunburst rays behind the title cluster (above the scrim, below content).
    this.sunburst = new SunburstView(this.scene, { color: color.star, depth: SUNBURST_DEPTH });
    this.sunburst.show(cx, panelY - layout.ui(40), Math.max(layout.width, layout.height));

    // L7 title "クリア！" scale-bounce (Back.Out pop → Quad.Out settle).
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
        this.scene.tweens.add({ targets: title, scale: 1, duration: goal.titlePopMs * 0.4, ease: 'Quad.Out' });
      },
    });
    this.track(title);
    this.addRewardCounter(cx, panelY + layout.ui(40));

    const replay = this.makeButton({
      x: cx - layout.ui(80),
      y: panelY + layout.ui(128),
      width: CHOICE_WIDTH_DESIGN,
      height: CHOICE_HEIGHT_DESIGN,
      label: 'Replay',
      variant: 'secondary',
      devId: 'result-replay',
      onClick: data.onReplay,
    });
    const next = this.makeButton({
      x: cx + layout.ui(80),
      y: panelY + layout.ui(128),
      width: CHOICE_WIDTH_DESIGN,
      height: CHOICE_HEIGHT_DESIGN,
      label: data.hasNext ? 'つぎへ' : '一覧へ',
      variant: 'primary',
      devId: 'result-next',
      onClick: data.onNext,
    });
    this.track(replay);
    this.track(next);
    this.nextButton = next;
    next.setEnabled(false);

    // Post-reward 強化 link (原則7: coins just went up = 欲しさが立つ点).
    // textInverse: this ghost sits on the dark scrim (WCAG AA, DESIGN.md §3.1).
    this.track(
      this.makeButton({
        x: cx,
        y: panelY + layout.ui(190),
        size: 'S',
        label: '強化',
        icon: 'coin',
        variant: 'ghost',
        textColor: color.textInverse,
        devId: 'result-upgrade',
        onClick: data.onUpgrade,
      }),
    );
  }

  /** Fail result: dim + cause hint + Retry (primary L) + contextual ink upsell. */
  showFail(data: FailOverlayData): void {
    this.hide();
    const cx = layout.width / 2;
    const panelY = layout.height * 0.4;

    this.addScrim();
    this.addTopChrome({ onLevels: data.onLevels, withBalancePill: false });
    // Title/hint must layer ABOVE the scrim (default depth 0 sat UNDER it and
    // washed the text out — 2026-07-08 own-eyes review).
    this.track(
      this.scene.add
        .text(cx, panelY - layout.ui(40), 'ざんねん', makeTextStyle(type.h1, color.textInverse))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH),
    );
    this.track(
      this.scene.add
        .text(cx, panelY + layout.ui(8), FAIL_HINT[data.cause], makeTextStyle(type.body, color.textInverse))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH),
    );
    this.track(
      this.makeButton({
        x: cx,
        y: panelY + layout.ui(84),
        size: 'L',
        label: 'Retry',
        icon: 'restart',
        variant: 'primary',
        devId: 'result-retry',
        onClick: data.onRetry,
      }),
    );

    // Contextual upsell — the missing thing, offered at the moment of lack
    // (§8.4); otherwise a subdued ghost 強化 entry (DESIGN.md §9).
    if (data.onUpgradeInk !== undefined) {
      const onUpgradeInk = data.onUpgradeInk;
      this.track(
        this.makeButton({
          x: cx,
          y: panelY + layout.ui(160),
          size: 'M',
          label: 'インクを増やす',
          icon: 'ink',
          variant: 'premium',
          devId: 'result-ink',
          onClick: onUpgradeInk,
        }),
      );
    } else {
      this.track(
        this.makeButton({
          x: cx,
          y: panelY + layout.ui(156),
          size: 'S',
          label: '強化',
          icon: 'coin',
          variant: 'ghost',
          textColor: color.textInverse, // ghost on the dark scrim (WCAG AA)
          devId: 'result-upgrade',
          onClick: data.onUpgrade,
        }),
      );
    }
  }

  /** Screen (game-px) position of the reward counter (CoinBurstFlight target). */
  coinCounterScreenPos(): { x: number; y: number } {
    return { ...this.coinTextPos };
  }

  /** Update the reward counter display (driven by the reward count-up). */
  setCoinDisplay(value: number): void {
    this.coinText?.setText(String(Math.max(0, Math.round(value))));
  }

  /** Punch the reward counter (1.0→1.2→1.0) as a coin lands (§4.3 3-6). */
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
   * Enable Next with a scale-in pop (0.9→1.0 Back.Out) then its ±5% pulse. The
   * pop draws the eye to the freshly-tappable button (~0.9 s from clear).
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
    if (fadeInMs > 0) {
      rect.setAlpha(0);
      this.scene.tweens.add({ targets: rect, alpha: scrim.alpha, duration: fadeInMs, ease: 'Quad.Out' });
    }
    this.track(rect);
  }

  /** Top-left レベル選択 ghost + optional top-right balance pill (DESIGN.md §6.4). */
  private addTopChrome(opts: { onLevels: () => void; withBalancePill: boolean }): void {
    const topRowY = layout.safe.top + layout.ui(space.space4 + 22);
    this.track(
      this.makeButton({
        x: layout.safe.left + layout.ui(margin + 62),
        y: topRowY,
        size: 'S',
        label: 'レベル選択',
        variant: 'ghost',
        textColor: color.textInverse, // ghost on the dark scrim (WCAG AA, §3.1)
        devId: 'result-levels',
        onClick: opts.onLevels,
      }),
    );
    if (opts.withBalancePill) {
      const pill = new CoinCounter(
        this.scene,
        layout.width - layout.safe.right - layout.ui(margin),
        topRowY,
        this.services.getBalance(),
      );
      pill.setScrollFactor(0).setDepth(OVERLAY_BUTTON_DEPTH);
      this.track(pill);
    }
  }

  /** The centred reward count-up (獲得コイン): a coin glyph + the counting number. */
  private addRewardCounter(cx: number, y: number): void {
    const icon = this.scene.add.graphics().setScrollFactor(0).setDepth(OVERLAY_DEPTH);
    borderedCircle(icon, cx - layout.ui(26), y, layout.ui(12), {
      fill: color.coin,
      border: color.coinStroke,
      borderWidth: stroke.ui,
    });
    this.track(icon);

    this.coinTextPos = { x: cx - layout.ui(6), y };
    this.coinText = this.scene.add
      .text(cx - layout.ui(6), y, '0', makeTextStyle(type.display, color.textInverse))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    this.track(this.coinText);
  }

  private makeButton(options: {
    x: number;
    y: number;
    size?: 'L' | 'M' | 'S';
    width?: number;
    height?: number;
    label: string;
    variant: ButtonVariant;
    icon?: IconName;
    textColor?: number;
    devId: string;
    onClick: () => void;
  }): Button {
    const button = new Button(this.scene, {
      x: options.x,
      y: options.y,
      ...(options.size !== undefined ? { size: options.size } : {}),
      ...(options.width !== undefined ? { width: options.width } : {}),
      ...(options.height !== undefined ? { height: options.height } : {}),
      label: options.label,
      variant: options.variant,
      ...(options.icon !== undefined ? { icon: options.icon, iconSize: 20 } : {}),
      ...(options.textColor !== undefined ? { textColor: options.textColor } : {}),
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

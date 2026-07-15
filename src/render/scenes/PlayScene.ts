/**
 * PlayScene — the playable draw → launch → judge loop (T045, T049; AC-4).
 *
 * Lifecycle (game_design §2, composition spec .fable/playscene-composition-spec.md):
 *   create(levelId) → load+validate level JSON → GameSimulation → frame the whole
 *   level into the portrait viewport at zoom 1 (levelFraming; keeps the HUD and
 *   the dev-hook button rects camera-immune) → Drawing.
 *
 *   Drawing:      StrokeInput → live StrokeRenderer + InkBar preview (ink gated).
 *   commitStroke: Drawing → Anticipation, the live line becomes a physicalised
 *                 BridgeRenderer; the engine runs the launch on advance().
 *   Update loop:  a fixed-step accumulator drives sim.step() N times per frame and
 *                 renders every body at the leftover interpolation alpha.
 *   Result:       clear → interim ResultOverlay (stars/coins/Replay/Next) + economy
 *                 credit; fail → dim + cause hint + Retry, EXCEPT the divergence
 *                 AND the round-7 out-of-world `fall` failsafe, which both silently
 *                 reset (isFailsafeReset, ≤1 s — killY is now minY-6, so a designed
 *                 pit loss surfaces as tipOver / hazardContact, never `fall`).
 *
 * Restart (T049): the HUD ↺ button and the overlay Replay/Retry all run one
 * `restartAttempt()` — sim.reset() + rebuilt world renderers + Drawing, with NO
 * scene restart and NO asset reload, so it completes well under the 1 s contract.
 *
 * Engine → juice: SFX + haptics are wired through the services port
 * (attachEngineJuice) because `render → meta` / `render → platform-impl` are
 * forbidden; camera kick/trauma, bridge stress tint, and coin pops live here.
 */

import Phaser from 'phaser';
import type { Level, Point } from '@engine/level/LevelSchema';
import { validateLevel } from '@engine/level/LevelSchema';
import { GameSimulation } from '@engine/GameSimulation';
import type { AttemptOutcome, CommitDiscardReason, UpgradeLevels } from '@engine/GameSimulation';
import { isFailsafeReset } from '@engine/rules/Judge';
import type { FailCause } from '@engine/rules/Judge';
import { BridgeRenderer } from '@render/world/BridgeRenderer';
import { CoinRenderer } from '@render/world/CoinRenderer';
import { DangerZoneRenderer } from '@render/world/DangerZoneRenderer';
import { FlagRenderer } from '@render/world/FlagRenderer';
import { PersonRenderer } from '@render/world/PersonRenderer';
import { RockRenderer } from '@render/world/RockRenderer';
import { TerrainRenderer } from '@render/world/TerrainRenderer';
import { VehicleRenderer } from '@render/world/VehicleRenderer';
import { WorldToPixel } from '@render/world/worldToPixel';
import { StrokeInput } from '@render/draw/StrokeInput';
import { StrokeRenderer } from '@render/draw/StrokeRenderer';
import { InkBarView } from '@render/draw/InkBarView';
import { CameraDirector } from '@render/juice/CameraDirector';
import { clamp, type Vec2 } from '@render/juice/cameraMath';
import { TimeScaleController } from '@render/juice/TimeScale';
import { slowMoZoom } from '@render/juice/timeScaleMath';
import { ParticleBurst } from '@render/juice/ParticleBurst';
import { SpeedLines, speedLineIntensity } from '@render/juice/SpeedLines';
import { playCommitPop } from '@render/juice/CommitPop';
import { Button } from '@render/ui/Button';
import { fillRing } from '@render/ui/fillShapes';
import { CHAPTER1_TILES } from '@render/ui/levelCatalog';
import { getServices } from '@render/ui/services';
import type { AttemptJuice, GameServices } from '@render/ui/services';
import { getSharedWorld } from '@render/ui/sharedWorld';
import { t } from '@render/i18n';
import { color, layout, LAYOUT_EVENT, makeTextStyle, margin, space, type } from '@render/ui/theme';
import { camera as cameraTuning, car, draw, economy, launch, physics, speedLines as speedLinesTuning } from '@tuning/TuningConstants';
import { setBridgeMidDeviation, setDevPlayState, setDevResultNextReady, setDevStrokePointCount, setWorldToGame } from '@render/devhook';
import type { DevHookPlayState } from '@render/devhook';
import { framingFor, type FramingViewport } from './play/levelFraming';
import { worldViewportRect } from './play/playViewport';
import { shouldOfferInkUpsell as shouldOfferInkUpsellDecision } from './play/inkUpsell';
import { DrawRejectToast } from './play/DrawRejectToast';
import { PauseOverlay } from './play/PauseOverlay';
import { ResultOverlay } from './play/ResultOverlay';
import { GoalSequence } from './play/GoalSequence';
import type { ClearObjectiveInfo } from './play/ResultOverlay';

/** Eager glob of every shipped level JSON (Vite inlines these at build). */
const LEVEL_JSON = import.meta.glob('/levels/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

/** Draw-order layers (world below the HUD below the overlay). */
const DEPTH = {
  terrain: 1,
  danger: 2,
  persons: 2.5,
  flag: 3,
  coins: 4,
  bridge: 5,
  rocks: 6,
  vehicle: 7,
  stroke: 8,
  hud: 1500,
} as const;
/** Draw-reject toast depth: above the world/ink bar, below the HUD buttons. */
const TOAST_DEPTH = DEPTH.hud - 100;

/** Frame-time clamp so a stalled tab cannot spiral the fixed-step loop (ms). */
const MAX_FRAME_MS = 100;
/** Cap steps per frame (paired with the clamp above) to bound catch-up work. */
const MAX_STEPS_PER_FRAME = 6;
/** Festive confetti palette (§4.3 3-3) — injected into ConfettiCelebration. */
const CONFETTI_PALETTE: readonly number[] = [
  color.goalFlag,
  color.carBody,
  color.coin,
  color.uiPrimary,
  color.stressMid,
];
/** Draw-scrub SFX cadence (ms) — re-triggers the pen loop while the finger moves. */
const DRAW_SOUND_CADENCE_MS = 110;
/** Engine-hum SFX cadence (ms) while running. */
const ENGINE_SOUND_CADENCE_MS = 140;
/** Anticipation rev SFX + wheel-smoke cadence (ms). */
const REV_CADENCE_MS = 80;
/** Finger speed (px/s) that saturates the draw-scrub volume/pitch + dust rate. */
const DRAW_TIP_MAX_SPEED_PX = 1500;
/** Fail-cause camera pan-and-mark hold before the Retry overlay (ms). */
const FAIL_MARK_MS = 500;

/*
 * TODO(tuning): promote to TuningConstants. The mandatory pen/launch/debris
 * ParticleBurst envelopes (life/size/gravity px) have no TuningConstants field
 * yet; these local provisionals mirror the Confetti.ts precedent until the
 * tuning panel (FR-025) covers them.
 */
const PEN_DUST_LIFE_MIN_MS = 200;
const PEN_DUST_LIFE_MAX_MS = 450;
const PEN_DUST_SIZE_MIN_PX = 2;
const PEN_DUST_SIZE_MAX_PX = 6;
const LAUNCH_DUST_GRAVITY_PX = 200;
const LAUNCH_DUST_LIFE_MIN_MS = 300;
const LAUNCH_DUST_LIFE_MAX_MS = 600;
const LAUNCH_DUST_SIZE_MIN_PX = 3;
const LAUNCH_DUST_SIZE_MAX_PX = 8;
const DEBRIS_GRAVITY_PX = 900;
const DEBRIS_LIFE_MIN_MS = 400;
const DEBRIS_LIFE_MAX_MS = 800;
const DEBRIS_SIZE_MIN_PX = 3;
const DEBRIS_SIZE_MAX_PX = 7;

type PlayStateTag = DevHookPlayState['state'];

function levelPath(levelId: string): string {
  return `/levels/${levelId}.json`;
}

/** Raw polyline arc length in world metres (live ink preview + gate). */
function rawPolylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export class PlayScene extends Phaser.Scene {
  private levelId = 'ch1-l01';
  private services!: GameServices;
  private level: Level | null = null;
  private sim: GameSimulation | null = null;
  private transform!: WorldToPixel;
  private director!: CameraDirector;
  private timeScale!: TimeScaleController;
  private goalSequence!: GoalSequence;
  private penDust!: ParticleBurst;
  private launchDust!: ParticleBurst;
  private debris!: ParticleBurst;
  private speedLines!: SpeedLines;

  private terrain: TerrainRenderer | null = null;
  private danger: DangerZoneRenderer | null = null;
  private persons: PersonRenderer | null = null;
  private coins: CoinRenderer | null = null;
  private flag: FlagRenderer | null = null;
  private rocks: RockRenderer | null = null;
  private vehicle: VehicleRenderer | null = null;
  private bridge: BridgeRenderer | null = null;
  private strokeRenderer: StrokeRenderer | null = null;
  private drawRejectToast: DrawRejectToast | null = null;
  private inkBar: InkBarView | null = null;
  private strokeInput: StrokeInput | null = null;
  private overlay: ResultOverlay | null = null;
  private hudRestart: Button | null = null;
  private hudPause: Button | null = null;
  private levelLabel: Phaser.GameObjects.Text | null = null;
  private pauseOverlay: PauseOverlay | null = null;
  /** True while the pause menu freezes stepping (2026-07-08 nav feedback). */
  private isPausedByUser = false;

  private playState: PlayStateTag = null;
  private outcomeHandled = false;
  /**
   * Consecutive out-of-world FAILSAFE resets (cause 'fall'/'divergence') in THIS
   * level, un-broken by a clear or a user-facing fail (round-7 ink-upsell migration,
   * game_plan_v5 §4). Reset to 0 on any surfaced outcome; the field re-inits to 0
   * on scene restart, so it is per-level. ≥2 signals a repeated "bridge didn't reach".
   */
  private consecutiveFailsafeResets = 0;
  /** Set in teardown() so deferred async work (dev-tool import) can no-op. */
  private isTornDown = false;
  private accumulatorSec = 0;
  private lastAlpha = 0;
  private strokeVertices: Point[] = [];
  private hasFiredDepleted = false;
  private juice: AttemptJuice | null = null;
  private readonly cameraJuiceUnsubs: Array<() => void> = [];
  // Set from the live layout in create() (game px). The camera follows this fixed
  // centre so the framed overview never scrolls (SC-003).
  private centerPx: Vec2 = { x: 0, y: 0 };

  // Continuous-juice cadence clocks + a last-tip sample for the draw scrub speed.
  private drawSoundAtMs = 0;
  private engineSoundAtMs = 0;
  private revAtMs = 0;
  private creakDustAtMs = 0;
  private anticipationElapsedMs = 0;
  private lastTip: { x: number; y: number; ms: number } | null = null;
  private launchReleased = false;
  private readonly maxCarSpeed = car.motorSpeedBase * car.wheelRadius;

  constructor() {
    super('Play');
  }

  init(data: { readonly levelId?: string }): void {
    this.levelId = data.levelId ?? 'ch1-l01';
  }

  /** Wall time of the latest stepSimulation call (TuningPanel FR-025 readout). */
  private lastStepMs = 0;

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    // Dev-only tuning panel (FR-025) — tree-shaken from release builds.
    // boundaries exception: render->debug is forbidden for production code; this
    // is a DEV-guarded dynamic import of a dev tool overlay (.fable/decisions.md).
    if (import.meta.env.DEV) {
      // eslint-disable-next-line boundaries/dependencies
      void import('../../debug/TuningPanel').then((m) => {
        // The import resolves a frame or more later; if the scene has already
        // shut down (fast navigation) skip the attach so we don't bind a torn-down
        // scene's input/update.
        if (this.isTornDown || this.scene?.isActive?.() === false) {
          return;
        }
        m.attach(this, {
          statsProvider: () => ({
            fps: this.game.loop.actualFps,
            stepTimeMs: this.lastStepMs,
            bodyCount: this.sim?.renderChain?.bodies.length ?? 0,
          }),
        });
      });
    }

    const level = this.loadLevel(this.levelId);
    if (level === null) {
      return; // loud error scene already drawn
    }
    this.level = level;
    this.centerPx = { x: layout.width / 2, y: layout.height / 2 };
    this.transform = new WorldToPixel(framingFor(level, this.framingViewport()));
    // Bind to the ONE process-wide World (CS-6): phaser-box2d never frees a
    // world slot (32/process cap, World.ts LIB-QUIRK), so a fresh `new World()`
    // per scene-restart level entry threw at the 33rd entry and bricked the
    // 45-level campaign. The shared world is reset()-recycled by the ctor
    // (ownsWorld=false), so teardown's sim.destroy() leaves it alive to reuse.
    this.sim = new GameSimulation(level, {
      world: getSharedWorld(this),
      upgrades: this.readUpgrades(),
    });

    const cam = this.cameras.main;
    cam.setScroll(0, 0);
    cam.setZoom(1);
    this.director = new CameraDirector(this, { pixelsPerMeter: this.transform.pixelsPerMeter });
    this.director.reset(this.centerPx);
    // Static framed overview (SC-003): follow a fixed centre so juice kick/shake
    // nudge the camera without scrolling away from the whole-level view.
    this.director.follow(() => this.centerPx);
    // Goal slow-mo → camera zoom link (§4.3 3-2): the controller mirrors its time
    // scale onto the main camera zoom; GoalSequence restores zoom 1 at reveal.
    this.timeScale = new TimeScaleController({
      onScaleChange: (scale) => this.director.zoomTo(slowMoZoom(scale)),
    });

    this.penDust = new ParticleBurst(this, {
      depth: DEPTH.stroke,
      lifeMsMin: PEN_DUST_LIFE_MIN_MS,
      lifeMsMax: PEN_DUST_LIFE_MAX_MS,
      sizePxMin: PEN_DUST_SIZE_MIN_PX,
      sizePxMax: PEN_DUST_SIZE_MAX_PX,
    });
    this.launchDust = new ParticleBurst(this, {
      depth: DEPTH.vehicle - 1,
      gravityPx: LAUNCH_DUST_GRAVITY_PX,
      lifeMsMin: LAUNCH_DUST_LIFE_MIN_MS,
      lifeMsMax: LAUNCH_DUST_LIFE_MAX_MS,
      sizePxMin: LAUNCH_DUST_SIZE_MIN_PX,
      sizePxMax: LAUNCH_DUST_SIZE_MAX_PX,
    });
    this.debris = new ParticleBurst(this, {
      depth: DEPTH.bridge + 1,
      gravityPx: DEBRIS_GRAVITY_PX,
      lifeMsMin: DEBRIS_LIFE_MIN_MS,
      lifeMsMax: DEBRIS_LIFE_MAX_MS,
      sizePxMin: DEBRIS_SIZE_MIN_PX,
      sizePxMax: DEBRIS_SIZE_MAX_PX,
    });
    this.speedLines = new SpeedLines(this, { widthPx: layout.width, heightPx: layout.height, color: color.inkLine, depth: DEPTH.hud - 1 });

    this.buildWorldRenderers();
    this.strokeRenderer = new StrokeRenderer(this, {
      transform: this.transform,
      depth: DEPTH.stroke,
      // Live clip preview (BR-013 WYSIWYG): the line stops at terrain AND red
      // zones exactly like the commit predicate (round-4 bug + round-9 parity).
      isDrawBlocked: (point) => this.sim?.isDrawBlocked(point) ?? false,
    });
    this.inkBar = this.makeInkBar();
    this.overlay = new ResultOverlay(this, this.services);
    this.drawRejectToast = new DrawRejectToast(this, { depth: TOAST_DEPTH });
    this.strokeInput = new StrokeInput(this, {
      transform: this.transform,
      camera: cam,
      canDraw: () => this.canDraw(),
      callbacks: {
        onStrokeStart: (point) => this.onStrokeStart(point),
        onStrokePoint: (point) => this.onStrokePoint(point),
        onStrokeEnd: (points) => this.commitStroke(points),
      },
    });
    this.buildHudRestart();
    this.buildHudPause();
    this.buildLevelLabel();

    // SFX + haptics (composition-root owned) bound to this attempt's event bus.
    this.juice = this.services.attachEngineJuice(this.sim.events);
    this.attachCameraJuice();
    this.goalSequence = new GoalSequence({
      scene: this,
      director: this.director,
      timeScale: this.timeScale,
      overlay: this.overlay,
      juice: this.juice,
      transform: this.transform,
      flagWorldCenter: this.flagWorldCenter(level),
      confettiPalette: CONFETTI_PALETTE,
      markResultState: () => this.setPlayState('result'),
    });

    setWorldToGame((wx, wy) => this.worldToGame(wx, wy));
    setBridgeMidDeviation(() => this.sim?.chainMidDeviationM() ?? NaN);
    this.beginDrawing();
    this.subscribeLayout();
  }

  /**
   * The world-viewport RECT the level is framed into (round-9 CS-3, playViewport).
   * The rect reserves the HUD band + bottom restart band and applies per-edge
   * safe insets (NEVER a uniform margin — 2026-07-08 device bug). Version-gated:
   * v1 levels keep the pre-round-9 full-area rect (framing unchanged), v2 levels
   * get the reduced portrait-stage rect. `layout` structurally satisfies the
   * ViewportLayout snapshot (width/height/safe/ui) playViewport reads.
   */
  private framingViewport(): FramingViewport {
    return worldViewportRect(layout, this.level?.schemaVersion ?? 1);
  }

  /**
   * Re-anchor on a device resize (iOS address-bar / rotation). Portrait is locked
   * natively, so this is a small height delta: recompute the fixed centre + framing,
   * rebuild the transform-bound world renderers, and re-place the HUD — WITHOUT
   * resetting the running attempt (the sim state is untouched).
   */
  private subscribeLayout(): void {
    const onLayout = (): void => this.relayout();
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(LAYOUT_EVENT, onLayout));
  }

  private relayout(): void {
    if (this.sim === null || this.level === null || this.isTornDown) {
      return;
    }
    this.centerPx = { x: layout.width / 2, y: layout.height / 2 };
    this.transform = new WorldToPixel(framingFor(this.level, this.framingViewport()));
    this.director.reset(this.centerPx);
    this.director.follow(() => this.centerPx);
    this.director.setZoomImmediate(this.cameras.main.zoom);
    // World renderers + stroke/ink views are bound to the transform — rebuild them.
    this.buildWorldRenderers();
    if (this.sim.renderChain !== null && this.playState !== 'drawing') {
      this.bridge?.destroy();
      this.bridge = new BridgeRenderer(this, this.sim.renderChain, this.transform, {
        stressTracker: this.sim.renderStressTracker ?? undefined,
        depth: DEPTH.bridge,
      });
    }
    this.strokeRenderer?.destroy();
    this.strokeRenderer = new StrokeRenderer(this, {
      transform: this.transform,
      depth: DEPTH.stroke,
      // Live clip preview (BR-013 WYSIWYG): matches the commit predicate exactly.
      isDrawBlocked: (point) => this.sim?.isDrawBlocked(point) ?? false,
    });
    this.inkBar?.destroy();
    this.inkBar = this.makeInkBar();
    this.inkBar.update(this.sim.inkState.ratio, this.sim.inkState.zone);
    this.strokeInput?.setTransform(this.transform);
    this.buildHudRestart();
    this.buildHudPause();
    this.buildLevelLabel();
    if (this.playState !== 'drawing') {
      this.levelLabel?.setAlpha(0); // stay hidden mid-run after a relayout
    }
  }

  /** Goal flag centre in world metres (confetti + coin-burst anchor). */
  private flagWorldCenter(level: Level): { x: number; y: number } {
    return { x: level.goalFlag.x + level.goalFlag.width / 2, y: level.goalFlag.y + level.goalFlag.height / 2 };
  }

  /** The running simulation. Throws if accessed with no active attempt. */
  private get activeSim(): GameSimulation {
    if (this.sim === null) {
      throw new Error('PlayScene: no active simulation');
    }
    return this.sim;
  }

  /** The loaded level. Throws if accessed before a level is loaded. */
  private get activeLevel(): Level {
    if (this.level === null) {
      throw new Error('PlayScene: no active level');
    }
    return this.level;
  }

  update(_time: number, delta: number): void {
    if (this.sim === null) {
      return;
    }
    if (this.isPausedByUser) {
      // Frozen mid-attempt: no stepping, no juice — the overlay's own input
      // still runs (scene-level update keeps processing input).
      this.publishDevState();
      return;
    }
    const clamped = Math.min(delta, MAX_FRAME_MS);
    // Feed the scaled delta to the fixed-step sim; onScaleChange drives the zoom.
    const scaledMs = this.timeScale.update(clamped);
    const stepStarted = performance.now();
    this.stepSimulation(scaledMs);
    this.lastStepMs = performance.now() - stepStarted;
    this.renderFrame();
    this.updateRunJuice(clamped);
    this.goalSequence.update(clamped);
    this.director.update(clamped);
    this.publishDevState();
  }

  /** Anticipation rev + wheel smoke, running engine hum + speed lines (real dt). */
  private updateRunJuice(deltaMs: number): void {
    const sim = this.activeSim;
    const now = this.time.now;
    if (sim.phase === 'anticipation') {
      this.anticipationElapsedMs += deltaMs;
      if (now - this.revAtMs >= REV_CADENCE_MS) {
        this.revAtMs = now;
        const progress = clamp(this.anticipationElapsedMs / (launch.anticipationSec * 1000), 0, 1);
        this.juice?.revTick(progress);
        this.emitWheelSmoke(2);
      }
    } else if (sim.phase === 'running') {
      const speedRatio = clamp((this.vehicle?.chassisSpeed() ?? 0) / this.maxCarSpeed, 0, 1);
      if (now - this.engineSoundAtMs >= ENGINE_SOUND_CADENCE_MS) {
        this.engineSoundAtMs = now;
        this.juice?.engineHum(speedRatio);
      }
      this.speedLines.update(speedLineIntensity(speedRatio, speedLinesTuning.thresholdRatio));
    } else {
      this.speedLines.update(0);
    }
  }

  // ── level loading ─────────────────────────────────────────────────────────

  private loadLevel(levelId: string): Level | null {
    const raw = LEVEL_JSON[levelPath(levelId)];
    if (raw === undefined) {
      this.showLoadError(levelId, [`level file not found: ${levelPath(levelId)}`]);
      return null;
    }
    const result = validateLevel(raw, { filenameStem: levelId });
    if (!result.ok) {
      this.showLoadError(levelId, result.errors);
      return null;
    }
    return result.level;
  }

  private showLoadError(levelId: string, errors: readonly string[]): void {
    console.error('PlayScene: level load failed', levelId, errors);
    this.add
      .text(layout.width / 2, layout.height * 0.4, t('play.loadFailed'), makeTextStyle(type.h2, color.uiDanger))
      .setOrigin(0.5);
    this.add
      .text(layout.width / 2, layout.height * 0.4 + layout.ui(space.space8), levelId, makeTextStyle(type.body, color.textSecondary))
      .setOrigin(0.5);
    new Button(this, {
      x: layout.width / 2,
      y: layout.height * 0.4 + layout.ui(space.space8 * 2),
      size: 'M',
      label: t('nav.backToLevels'),
      variant: 'primary',
      services: this.services,
      onClick: () => this.scene.start('Hub'),
    });
    setDevPlayState({ state: null, tick: 0, outcome: null });
  }

  // ── renderers ──────────────────────────────────────────────────────────────

  private buildWorldRenderers(): void {
    this.terrain?.destroy();
    this.danger?.destroy();
    this.persons?.destroy();
    this.coins?.destroy();
    this.flag?.destroy();
    this.rocks?.destroy();
    this.vehicle?.destroy();
    this.bridge?.destroy();
    this.bridge = null;

    const level = this.activeLevel;
    const sim = this.activeSim;
    this.terrain = new TerrainRenderer(this, level, this.transform, { depth: DEPTH.terrain });
    // DangerZone bands sit just above terrain, below the flag/coins/car so the
    // hazard reads as a marked patch of ground the car must avoid.
    this.danger = new DangerZoneRenderer(this, level.dangerZones ?? [], this.transform, { depth: DEPTH.danger });
    // Person NPC obstacles (round-9 BR-011, v2 levels only) — absent on v1.
    this.persons = new PersonRenderer(this, level.persons ?? [], this.transform, { depth: DEPTH.persons });
    this.flag = new FlagRenderer(this, level.goalFlag, this.transform, { depth: DEPTH.flag });
    this.coins = new CoinRenderer(this, level.coins, this.transform, {
      events: sim.events,
      depth: DEPTH.coins,
    });
    this.rocks = new RockRenderer(this, sim.renderRocks, this.transform, { depth: DEPTH.rocks });
    this.vehicle = new VehicleRenderer(this, sim.renderVehicle, this.transform, { depth: DEPTH.vehicle });
  }

  /**
   * The HUD InkGauge (DESIGN.md §4.7). Star-threshold ticks come from the level's
   * star thresholds ÷ effective ink budget: a tick sits at the REMAINING ratio
   * where consumption would still earn that star (consumed ≤ threshold ⇔
   * remaining ≥ effective − threshold).
   */
  private makeInkBar(): InkBarView {
    const markers: number[] = [];
    const sim = this.sim;
    const level = this.level;
    if (sim !== null && level !== null) {
      const eff = sim.inkState.effectiveBudget;
      if (eff > 0) {
        const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
        markers.push(clamp01((eff - level.starThresholds.star3) / eff)); // ★3 tick
        markers.push(clamp01((eff - level.starThresholds.star2) / eff)); // ★2 tick
      }
    }
    // Directly under the LEVEL label (DESIGN.md §6.2 anchor map).
    return new InkBarView(this, { markers, y: layout.safe.top + layout.ui(72) });
  }

  /**
   * LEVEL label — top centre, aligned with the pause row (DESIGN.md §4.7/§6.2).
   * Fades out over 150 ms as the launch anticipation starts (running HUD is
   * restart-only, FR-005); beginDrawing restores it.
   */
  private buildLevelLabel(): void {
    this.levelLabel?.destroy();
    const tileLabel = CHAPTER1_TILES.find((tile) => tile.id === this.levelId)?.label ?? this.levelId;
    this.levelLabel = this.add
      .text(layout.width / 2, layout.safe.top + layout.ui(space.space4 + 22), `LEVEL ${tileLabel}`, makeTextStyle(type.h2, color.textPrimary))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
  }

  /** 150 ms fade of the LEVEL label at launch (走行HUDはリスタートのみ, FR-005). */
  private fadeOutLevelLabel(): void {
    if (this.levelLabel === null) {
      return;
    }
    this.tweens.killTweensOf(this.levelLabel);
    this.tweens.add({ targets: this.levelLabel, alpha: 0, duration: 150, ease: 'Quad.Out' });
  }

  private buildHudPause(): void {
    this.hudPause?.destroy();
    this.hudPause = new Button(this, {
      x: layout.safe.left + layout.ui(margin + 22),
      y: layout.safe.top + layout.ui(space.space4 + 22),
      size: 'iconM',
      label: '',
      icon: 'pause',
      variant: 'secondary',
      services: this.services,
      devId: 'hud-pause',
      onClick: () => this.openPause(),
    });
    this.hudPause.setScrollFactor(0).setDepth(DEPTH.hud);
  }

  private openPause(): void {
    const sim = this.sim;
    if (sim === null || this.isPausedByUser) {
      return;
    }
    if (sim.phase !== 'drawing' && sim.phase !== 'anticipation' && sim.phase !== 'running') {
      return; // result/celebration own their flow — no pause on top
    }
    this.isPausedByUser = true;
    this.strokeInput?.disable();
    this.pauseOverlay ??= new PauseOverlay(this, this.services);
    this.pauseOverlay.show({
      onResume: () => this.closePause(),
      onRetry: () => {
        this.closePause();
        this.restartAttempt();
      },
      onUpgrade: () => {
        this.closePause();
        // 全画面導線 (DESIGN.md §9): back returns to a fresh attempt of this level.
        this.scene.start('Upgrade', { returnScene: 'Play', returnData: { levelId: this.levelId } });
      },
      onLevels: () => {
        this.closePause();
        this.scene.start('Hub');
      },
    });
  }

  private closePause(): void {
    this.pauseOverlay?.hide();
    this.isPausedByUser = false;
    if (this.sim?.phase === 'drawing') {
      this.strokeInput?.enable();
    }
  }

  private buildHudRestart(): void {
    this.hudRestart?.destroy();
    // iconL (56×56) in the bottom-right thumb zone (DESIGN.md §4.7/§6.2).
    this.hudRestart = new Button(this, {
      x: layout.width - layout.safe.right - layout.ui(margin + 28),
      y: layout.height - layout.safe.bottom - layout.ui(margin + 28),
      size: 'iconL',
      label: '',
      icon: 'restart',
      variant: 'secondary',
      services: this.services,
      devId: 'hud-restart',
      onClick: () => this.restartAttempt(),
    });
    this.hudRestart.setScrollFactor(0).setDepth(DEPTH.hud);
  }

  // ── drawing phase ────────────────────────────────────────────────────────

  private beginDrawing(): void {
    const sim = this.activeSim;
    this.outcomeHandled = false;
    this.accumulatorSec = 0;
    this.lastAlpha = 0;
    this.strokeVertices = [];
    this.hasFiredDepleted = false;
    this.lastTip = null;
    this.launchReleased = false;
    this.anticipationElapsedMs = 0;
    this.strokeRenderer?.clear();
    this.overlay?.hide();
    this.goalSequence.reset();
    this.timeScale.cancel();
    this.timeScale.resetBudget();
    this.speedLines.update(0);
    this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
    if (this.levelLabel !== null) {
      this.tweens.killTweensOf(this.levelLabel);
      this.levelLabel.setAlpha(1); // restored for the fresh drawing phase
    }
    this.director.reset(this.centerPx);
    this.director.follow(() => this.centerPx);
    this.director.setZoomImmediate(1);
    setDevResultNextReady(false);
    setDevStrokePointCount(0);
    this.strokeInput?.enable();
    this.setPlayState('drawing');
  }

  private canDraw(): boolean {
    const sim = this.sim;
    if (sim === null || sim.phase !== 'drawing') {
      return false;
    }
    return rawPolylineLength(this.strokeVertices) < sim.inkState.remaining;
  }

  private onStrokeStart(point: Point): void {
    this.strokeVertices = [point];
    this.hasFiredDepleted = false;
    this.lastTip = null;
    setDevStrokePointCount(1);
    this.redrawStroke();
  }

  private onStrokePoint(point: Point): void {
    this.strokeVertices.push(point);
    setDevStrokePointCount(this.strokeVertices.length);
    this.emitDrawJuice(point);
    this.redrawStroke();
    if (!this.canDraw() && !this.hasFiredDepleted) {
      this.hasFiredDepleted = true;
      this.inkBar?.playDepletedFeedback();
      this.services.uiHaptic();
    }
  }

  /** Pen dust (§4.1 1-8) + speed-modulated draw-scrub SFX (§4.1 1-4) at the tip. */
  private emitDrawJuice(point: Point): void {
    const tip = this.transform.point(point);
    const now = this.time.now;
    let speed01 = 0.5;
    if (this.lastTip !== null) {
      const dt = Math.max(1, now - this.lastTip.ms);
      const distPx = Math.hypot(tip.x - this.lastTip.x, tip.y - this.lastTip.y);
      speed01 = clamp((distPx / dt) * 1000 / DRAW_TIP_MAX_SPEED_PX, 0, 1);
    }
    this.lastTip = { x: tip.x, y: tip.y, ms: now };
    // 2-5 particles/frame, speed-proportional (§4.1 1-8).
    this.penDust.emit(tip.x, tip.y, { count: 2 + Math.round(speed01 * 3), color: color.inkLine });
    if (now - this.drawSoundAtMs >= DRAW_SOUND_CADENCE_MS) {
      this.drawSoundAtMs = now;
      this.juice?.drawScrub(speed01);
    }
  }

  private redrawStroke(): void {
    const sim = this.activeSim;
    const consumed = rawPolylineLength(this.strokeVertices);
    const remaining = Math.max(0, sim.inkState.remaining - consumed);
    const ratio = remaining / sim.inkState.effectiveBudget;
    this.strokeRenderer?.redraw(this.strokeVertices, ratio);
    this.inkBar?.update(ratio);
  }

  private commitStroke(points: readonly Point[]): void {
    const sim = this.sim;
    if (sim === null || sim.phase !== 'drawing') {
      return;
    }
    const result = sim.commitStroke(points);
    this.strokeRenderer?.clear();
    setDevStrokePointCount(0);
    const committedPixels = points.map((p) => this.transform.point(p));
    this.strokeVertices = [];
    if (!result.committed) {
      // Discarded (too short / invalid / not enough ink / BR-012 zone / BR-013
      // split): refund, nudge, stay — the cleared stroke is instantly redrawable.
      this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
      this.inkBar?.playDepletedFeedback();
      this.showRejectToast(result.reason);
      return;
    }
    this.strokeInput?.disable();
    // Confirm pop (§4.1 1-6): scale 1.0→1.06→1.0 flash of the committed line.
    playCommitPop(this, committedPixels, {
      color: color.inkLine,
      lineWidthPx: (draw.lineWidthScreenPct / 100) * layout.width,
      depth: DEPTH.stroke,
    });
    const chain = sim.renderChain;
    if (chain !== null) {
      this.bridge = new BridgeRenderer(this, chain, this.transform, {
        stressTracker: sim.renderStressTracker ?? undefined,
        depth: DEPTH.bridge,
      });
    }
    // Anticipation squash (§4.2 2-1) begins the moment the line solidifies.
    this.anticipationElapsedMs = 0;
    this.vehicle?.playAnticipation();
    this.fadeOutLevelLabel(); // running HUD is restart-only (FR-005)
    this.setPlayState('anticipation');
  }

  /**
   * Dedicated toast for the round-9 v2 pre-launch rejections (BR-012
   * `enteredDangerZone` / BR-013 `splitByTerrain`) — the ONLY additional
   * feedback beyond the existing ink-bar nudge (already shown for every
   * rejection reason above). Other reasons (tooShort / insufficientInk / ...)
   * keep the pre-existing silent-nudge behavior unchanged.
   */
  private showRejectToast(reason: CommitDiscardReason): void {
    if (reason === 'enteredDangerZone') {
      this.drawRejectToast?.show(t('draw.rejectDangerZone'));
    } else if (reason === 'splitByTerrain') {
      this.drawRejectToast?.show(t('draw.rejectSplit'));
    }
  }

  // ── run loop ───────────────────────────────────────────────────────────────

  private stepSimulation(deltaMs: number): void {
    const sim = this.activeSim;
    const phase = sim.phase;
    if (phase === 'drawing' || phase === 'ended') {
      return;
    }
    this.accumulatorSec += Math.max(0, deltaMs) / 1000;
    let steps = 0;
    while (this.accumulatorSec >= physics.fixedDt && steps < MAX_STEPS_PER_FRAME && sim.phase !== 'ended') {
      sim.step();
      this.accumulatorSec -= physics.fixedDt;
      steps += 1;
    }
    this.lastAlpha = clamp(this.accumulatorSec / physics.fixedDt, 0, 1);
    if (sim.phase === 'ended' && !this.outcomeHandled) {
      this.handleOutcome();
    }
  }

  private renderFrame(): void {
    const alpha = this.lastAlpha;
    this.danger?.update(alpha);
    this.bridge?.update(alpha);
    this.rocks?.update(alpha);
    this.vehicle?.update(alpha);
    this.flag?.update(alpha);
    if (this.playState === 'anticipation' || this.playState === 'running') {
      const sim = this.activeSim;
      this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
    }
  }

  private handleOutcome(): void {
    const sim = this.activeSim;
    const outcome = sim.outcome;
    if (outcome === null) {
      return;
    }
    this.outcomeHandled = true;
    this.strokeInput?.disable();
    this.speedLines.update(0);
    if (outcome.outcome === 'fail' && isFailsafeReset(outcome)) {
      this.consecutiveFailsafeResets += 1;
      // ≥2 consecutive out-of-world failsafe resets in one level = an invisible
      // "bridge didn't reach" loop; when ink is ~spent and still upgradable, break
      // the loop and surface a real fail cause instead of resetting silently again
      // (round-7 loop-break heuristic; round-9 drops the ink-upsell BUTTON from
      // the fail surface, but the underlying "stop resetting silently" signal is
      // still worth surfacing — shouldOfferInkUpsell is now used ONLY for this).
      if (this.shouldOfferInkUpsell(outcome.cause)) {
        this.consecutiveFailsafeResets = 0;
        this.setPlayState('result');
        this.showFailWithCause(outcome);
        return;
      }
      this.restartAttempt(); // solver failsafe — silent instant reset (≤1 s)
      return;
    }
    this.consecutiveFailsafeResets = 0;
    if (outcome.outcome === 'clear') {
      // GoalSequence owns the goal trauma + zoom + 'result' state at panel reveal.
      this.startGoalCelebration(outcome);
    } else {
      this.setPlayState('result');
      this.showFailWithCause(outcome);
    }
  }

  /**
   * ★2/★3 condition lines for the clear panel (round-9 BR-014). v2-only: v1
   * levels never carry `objective` and must NOT read the synthesized-transitional
   * `starThresholds.star2` (PQG amendment) — omit the block entirely for them, so
   * the panel falls back to its pre-round-9 layout (stars only).
   */
  private clearObjectiveInfo(outcome: Extract<AttemptOutcome, { outcome: 'clear' }>): ClearObjectiveInfo | undefined {
    const level = this.level;
    if (level === null || level.schemaVersion !== 2) {
      return undefined;
    }
    return {
      type: level.objective?.type ?? 'coins',
      objectiveMet: outcome.objectiveMet ?? false,
      star3Met: outcome.inkConsumed <= level.starThresholds.star3,
    };
  }

  /** T060 clear path: credit first (BR-003), celebrate with the REAL total. */
  private startGoalCelebration(outcome: Extract<AttemptOutcome, { outcome: 'clear' }>): void {
    const nextId = this.nextLevelId();
    const objective = this.clearObjectiveInfo(outcome);
    // Credit BEFORE the celebration so the count-up shows exactly what the
    // player received (clear reward + first-clear pickups — Codex R2 HIGH-1):
    // displaying raw pickups made rewards look duplicated on replays.
    void this.services
      .creditLevelResult({
        levelId: this.levelId,
        starRating: outcome.starRating,
        collectedCoins: outcome.coinsCollected,
        ...(this.level?.bonusMultiplier !== undefined ? { bonusMultiplier: this.level.bonusMultiplier } : {}),
      })
      .then((credit) => {
        this.goalSequence.start({
          stars: outcome.starRating,
          coins: credit.totalCredited,
          hasNext: nextId !== null,
          onReplay: () => this.restartAttempt(),
          onNext: () => this.goToNext(),
          onLevels: () => this.scene.start('Hub'),
          onUpgrade: () =>
            this.scene.start('Upgrade', { returnScene: 'Play', returnData: { levelId: this.levelId } }),
          ...(objective !== undefined ? { objective } : {}),
        });
      });
  }

  /**
   * T061 fail path (round-9: retry must be tappable IMMEDIATELY, BR-002 <=1s —
   * no gating input on presentation). The overlay is shown right away; a brief
   * camera pan-to-cause + pulsing marker ring (§4.2 2-8 "折れ口ハイライト" / FR-008
   * cause highlight) keep playing BEHIND it. The fail surface no longer offers
   * any 強化/upsell entry (round-9 designer ban on meta/upsell UI inside the
   * fail->retry loop) — 強化 stays reachable from the clear result and
   * level-select screens only.
   */
  private showFailWithCause(outcome: Extract<AttemptOutcome, { outcome: 'fail' }>): void {
    const causePx = this.transform.point(outcome.causeLocation);
    this.director.follow(() => causePx); // lerp-pan toward the cause point (continues behind the overlay)
    this.spawnFailMarker(causePx);
    this.overlay?.showFail({
      cause: outcome.cause,
      onRetry: () => this.restartAttempt(),
      onLevels: () => this.scene.start('Hub'),
    });
  }

  /**
   * Silent-failsafe-loop-break gate (round-7 origin, game_plan_v5 §4; round-9
   * NARROWED: it no longer decides whether to show an ink-upsell BUTTON — that
   * entry point was removed from the fail surface entirely — it ONLY decides
   * whether ≥2 consecutive out-of-world failsafe resets should break out to a
   * real (silent-reset-free) fail overlay instead of resetting again invisibly.
   * Fires on either signal that "the bridge couldn't reach on this ink":
   *   A. a USER-FACING fail — hazardContact / tipOver / timeout / personContact
   *      (the causes that surface a fail overlay; `fall`/`divergence` silent-reset
   *      instead), OR
   *   B. ≥2 consecutive out-of-world FAILSAFE resets in one level (a repeated
   *      invisible "bridge didn't reach" — this.consecutiveFailsafeResets),
   * AND (both branches):
   *   - consumed ≥ 90% of the effective ink budget, AND
   *   - the ink-capacity axis still has upgrade headroom.
   */
  private shouldOfferInkUpsell(cause: FailCause): boolean {
    const sim = this.sim;
    if (sim === null) {
      return false;
    }
    return shouldOfferInkUpsellDecision({
      cause,
      consecutiveFailsafeResets: this.consecutiveFailsafeResets,
      consumed: sim.inkState.consumed,
      effectiveBudget: sim.inkState.effectiveBudget,
      inkCapacityLevel: this.services.getUpgradeLevel('inkCapacity'),
      maxUpgradeLevel: economy.maxUpgradeLevel,
    });
  }

  /** A pulsing highlight ring at the fail cause (fades over FAIL_MARK_MS). */
  private spawnFailMarker(px: { x: number; y: number }): void {
    const ring = this.add.graphics().setDepth(DEPTH.hud - 1);
    const proxy = { r: 8, a: 0.9 };
    this.tweens.add({
      targets: proxy,
      r: 56,
      a: 0,
      duration: FAIL_MARK_MS,
      ease: 'Quad.Out',
      onUpdate: () => {
        ring.clear();
        // Fill-only expanding ring (annulus) — no strokeCircle (research §3).
        const thickness = layout.ui(4);
        fillRing(ring, px.x, px.y, proxy.r, Math.max(0, proxy.r - thickness), color.stressHigh, proxy.a);
      },
      onComplete: () => ring.destroy(),
    });
  }

  /** T049 restart: one path for HUD ↺, Replay, and Retry — no scene restart. */
  private restartAttempt(): void {
    const sim = this.sim;
    if (sim === null) {
      return;
    }
    sim.reset();
    this.buildWorldRenderers();
    this.beginDrawing();
  }

  private goToNext(): void {
    const nextId = this.nextLevelId();
    if (nextId !== null && LEVEL_JSON[levelPath(nextId)] !== undefined) {
      this.scene.start('Play', { levelId: nextId });
    } else {
      this.scene.start('Hub');
    }
  }

  private nextLevelId(): string | null {
    const index = CHAPTER1_TILES.findIndex((tile) => tile.id === this.levelId);
    if (index < 0 || index >= CHAPTER1_TILES.length - 1) {
      return null;
    }
    return CHAPTER1_TILES[index + 1]?.id ?? null;
  }

  // ── camera juice + dev hook ─────────────────────────────────────────────────

  private attachCameraJuice(): void {
    const sim = this.activeSim;
    this.cameraJuiceUnsubs.push(
      sim.events.on('launchReleased', () => {
        this.launchReleased = true;
        this.director.launchKick({ x: 1, y: 0 }); // car always travels +x → kick -x
        this.director.addTrauma(cameraTuning.traumaLaunch);
        this.vehicle?.playRelease(); // release stretch (§4.2 2-2)
        this.emitLaunchDust(); // 10-20 dust burst at the rear (§4.2 2-2)
      }),
      sim.events.on('break', (payload) => {
        this.director.addTrauma(cameraTuning.traumaCrash);
        const px = this.transform.point(payload.position); // break debris (§4.2 2-8)
        this.debris.emit(px.x, px.y, { count: 12, color: color.inkBorder, speedPxMin: 60, speedPxMax: 220 });
      }),
      // Creak-band dust (§4.2 2-6 channel c): stress puffs at the load point. The
      // creak event has no position, so the vehicle reference point (where the
      // load concentrates) anchors it; throttled so it does not spam per-tick.
      sim.events.on('creak', () => {
        const now = this.time.now;
        if (now - this.creakDustAtMs < 90) {
          return;
        }
        this.creakDustAtMs = now;
        const ref = this.activeSim.referencePoint();
        const px = this.transform.point({ x: ref.x, y: ref.y });
        this.debris.emit(px.x, px.y, { count: 2, color: color.stressMid, speedPxMin: 15, speedPxMax: 45 });
      }),
    );
  }

  /** Wheel-spin smoke behind the car during the anticipation rev (§4.2 2-1). */
  private emitWheelSmoke(count: number): void {
    const ref = this.activeSim.referencePoint();
    const px = this.transform.point({ x: ref.x, y: ref.y });
    this.launchDust.emit(px.x, px.y, {
      count,
      color: color.starEmpty,
      dirRad: Math.PI * 0.85, // back-left and slightly up
      spreadRad: 0.5,
      speedPxMin: 20,
      speedPxMax: 70,
    });
  }

  /** 10-20 dust burst kicked back at the launch release (§4.2 2-2). */
  private emitLaunchDust(): void {
    const ref = this.activeSim.referencePoint();
    const px = this.transform.point({ x: ref.x, y: ref.y });
    this.launchDust.emit(px.x, px.y, {
      count: launch.dustCount,
      color: color.starEmpty,
      dirRad: Math.PI * 0.9,
      spreadRad: 0.7,
      speedPxMin: 80,
      speedPxMax: 240,
    });
  }

  /** World metres → GAME (canvas) pixels through the camera (dev-hook contract). */
  private worldToGame(worldX: number, worldY: number): { x: number; y: number } {
    const pixel = this.transform.point({ x: worldX, y: worldY });
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    return {
      x: (pixel.x - cam.scrollX) * zoom + cam.centerX * (1 - zoom),
      y: (pixel.y - cam.scrollY) * zoom + cam.centerY * (1 - zoom),
    };
  }

  private publishDevState(): void {
    // Follow the sim's phase while playing; explicit states own drawing/result.
    if (this.playState === 'anticipation' || this.playState === 'running') {
      const phase = this.activeSim.phase;
      if (phase === 'running') {
        this.playState = 'running';
      } else if (phase === 'anticipation') {
        this.playState = 'anticipation';
      }
      this.syncHudVisibility();
    }
    setDevPlayState({ state: this.playState, tick: this.currentTick(), outcome: this.outcomeTag() });
  }

  private currentTick(): number {
    return this.sim?.currentTick ?? 0;
  }

  private outcomeTag(): DevHookPlayState['outcome'] {
    const outcome = this.sim?.outcome ?? null;
    if (outcome === null) {
      return null;
    }
    // The divergence failsafe is silent — never surface it as a real outcome.
    if (outcome.outcome === 'fail' && isFailsafeReset(outcome)) {
      return null;
    }
    return outcome.outcome;
  }

  private setPlayState(state: PlayStateTag): void {
    this.playState = state;
    this.syncHudVisibility();
    setDevPlayState({ state, tick: this.currentTick(), outcome: this.outcomeTag() });
  }

  /**
   * HUD visibility per phase (DESIGN.md §4.7): pause shows only while DRAWING
   * (the run HUD is restart-only), and BOTH hide behind the result overlays so
   * the overlay's own controls (Retry / Replay / レベル選択) are unambiguous.
   */
  private syncHudVisibility(): void {
    this.hudPause?.setVisible(this.playState === 'drawing');
    this.hudRestart?.setVisible(this.playState !== 'result');
  }

  private readUpgrades(): UpgradeLevels {
    return {
      inkCapacityLv: this.services.getUpgradeLevel('inkCapacity'),
      engineSpeedLv: this.services.getUpgradeLevel('engineSpeed'),
    };
  }

  private teardown(): void {
    this.isTornDown = true;
    setWorldToGame(null);
    setBridgeMidDeviation(null);
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.isPausedByUser = false;
    setDevResultNextReady(false);
    setDevStrokePointCount(0);
    this.juice?.detach();
    this.juice = null;
    for (const unsubscribe of this.cameraJuiceUnsubs) {
      unsubscribe();
    }
    this.cameraJuiceUnsubs.length = 0;
    this.goalSequence?.destroy();
    this.penDust?.destroy();
    this.launchDust?.destroy();
    this.debris?.destroy();
    this.speedLines?.destroy();
    this.strokeInput?.destroy();
    this.strokeRenderer?.destroy();
    this.inkBar?.destroy();
    this.overlay?.destroy();
    this.terrain?.destroy();
    this.danger?.destroy();
    this.coins?.destroy();
    this.flag?.destroy();
    this.rocks?.destroy();
    this.vehicle?.destroy();
    this.bridge?.destroy();
    this.director?.destroy();
    this.sim?.destroy();
    this.sim = null;
  }
}

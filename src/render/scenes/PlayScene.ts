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
 *                 failsafe which silently resets (isFailsafeReset, ≤1 s).
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
import type { AttemptOutcome, UpgradeLevels } from '@engine/GameSimulation';
import { isFailsafeReset } from '@engine/rules/Judge';
import { BridgeRenderer } from '@render/world/BridgeRenderer';
import { CoinRenderer } from '@render/world/CoinRenderer';
import { FlagRenderer } from '@render/world/FlagRenderer';
import { TerrainRenderer } from '@render/world/TerrainRenderer';
import { VehicleRenderer } from '@render/world/VehicleRenderer';
import { WorldToPixel } from '@render/world/worldToPixel';
import { StrokeInput } from '@render/draw/StrokeInput';
import { StrokeRenderer } from '@render/draw/StrokeRenderer';
import { InkBarView } from '@render/draw/InkBarView';
import { CameraDirector } from '@render/juice/CameraDirector';
import { clamp, type Vec2 } from '@render/juice/cameraMath';
import { Button } from '@render/ui/Button';
import { CHAPTER1_TILES } from '@render/ui/levelCatalog';
import { getServices } from '@render/ui/services';
import type { GameServices } from '@render/ui/services';
import { color, makeTextStyle, safeArea, screen, space, type } from '@render/ui/theme';
import { camera as cameraTuning, physics } from '@tuning/TuningConstants';
import { setDevPlayState, setWorldToGame } from '@render/devhook';
import type { DevHookPlayState } from '@render/devhook';
import { framingFor } from './play/levelFraming';
import { ResultOverlay } from './play/ResultOverlay';

/** Eager glob of every shipped level JSON (Vite inlines these at build). */
const LEVEL_JSON = import.meta.glob('/levels/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

/** Draw-order layers (world below the HUD below the overlay). */
const DEPTH = { terrain: 1, flag: 2, coins: 3, bridge: 4, vehicle: 5, stroke: 6, hud: 1500 } as const;

/** Viewport inset for the level-fit framing (px). */
const FRAME_MARGIN_PX = 40;
/** Frame-time clamp so a stalled tab cannot spiral the fixed-step loop (ms). */
const MAX_FRAME_MS = 100;
/** Cap steps per frame (paired with the clamp above) to bound catch-up work. */
const MAX_STEPS_PER_FRAME = 6;

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

  private terrain: TerrainRenderer | null = null;
  private coins: CoinRenderer | null = null;
  private flag: FlagRenderer | null = null;
  private vehicle: VehicleRenderer | null = null;
  private bridge: BridgeRenderer | null = null;
  private strokeRenderer: StrokeRenderer | null = null;
  private inkBar: InkBarView | null = null;
  private strokeInput: StrokeInput | null = null;
  private overlay: ResultOverlay | null = null;
  private hudRestart: Button | null = null;

  private playState: PlayStateTag = null;
  private outcomeHandled = false;
  private accumulatorSec = 0;
  private lastAlpha = 0;
  private strokePoints: Point[] = [];
  private hasFiredDepleted = false;
  private detachJuice: (() => void) | null = null;
  private readonly cameraJuiceUnsubs: Array<() => void> = [];
  private readonly centerPx: Vec2 = { x: screen.width / 2, y: screen.height / 2 };

  constructor() {
    super('Play');
  }

  init(data: { readonly levelId?: string }): void {
    this.levelId = data.levelId ?? 'ch1-l01';
  }

  create(): void {
    this.services = getServices(this);
    this.cameras.main.setBackgroundColor(color.sky);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    const level = this.loadLevel(this.levelId);
    if (level === null) {
      return; // loud error scene already drawn
    }
    this.level = level;
    this.transform = new WorldToPixel(
      framingFor(level, { width: screen.width, height: screen.height, margin: FRAME_MARGIN_PX }),
    );
    this.sim = new GameSimulation(level, { upgrades: this.readUpgrades() });

    const cam = this.cameras.main;
    cam.setScroll(0, 0);
    cam.setZoom(1);
    this.director = new CameraDirector(this, { pixelsPerMeter: this.transform.pixelsPerMeter });
    this.director.reset(this.centerPx);
    // Static framed overview (SC-003): follow a fixed centre so juice kick/shake
    // nudge the camera without scrolling away from the whole-level view.
    this.director.follow(() => this.centerPx);

    this.buildWorldRenderers();
    this.strokeRenderer = new StrokeRenderer(this, { transform: this.transform, depth: DEPTH.stroke });
    this.inkBar = new InkBarView(this);
    this.overlay = new ResultOverlay(this, this.services);
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

    // SFX + haptics (composition-root owned) bound to this attempt's event bus.
    this.detachJuice = this.services.attachEngineJuice(this.sim.events);
    this.attachCameraJuice();

    setWorldToGame((wx, wy) => this.worldToGame(wx, wy));
    this.beginDrawing();
  }

  update(_time: number, delta: number): void {
    if (this.sim === null) {
      return;
    }
    this.stepSimulation(delta);
    this.renderFrame();
    this.director.update(delta);
    this.publishDevState();
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
      .text(screen.width / 2, screen.height * 0.4, 'レベルを読み込めませんでした', makeTextStyle(type.h2, color.uiDanger))
      .setOrigin(0.5);
    this.add
      .text(screen.width / 2, screen.height * 0.4 + space.space8, levelId, makeTextStyle(type.body, color.textSecondary))
      .setOrigin(0.5);
    new Button(this, {
      x: screen.width / 2,
      y: screen.height * 0.4 + space.space8 * 2,
      width: 200,
      height: 56,
      label: '一覧へもどる',
      variant: 'primary',
      services: this.services,
      onClick: () => this.scene.start('LevelSelect'),
    });
    setDevPlayState({ state: null, tick: 0, outcome: null });
  }

  // ── renderers ──────────────────────────────────────────────────────────────

  private buildWorldRenderers(): void {
    this.terrain?.destroy();
    this.coins?.destroy();
    this.flag?.destroy();
    this.vehicle?.destroy();
    this.bridge?.destroy();
    this.bridge = null;

    const level = this.level as Level;
    const sim = this.sim as GameSimulation;
    this.terrain = new TerrainRenderer(this, level, this.transform, { depth: DEPTH.terrain });
    this.flag = new FlagRenderer(this, level.goalFlag, this.transform, { depth: DEPTH.flag });
    this.coins = new CoinRenderer(this, level.coins, this.transform, {
      events: sim.events,
      depth: DEPTH.coins,
    });
    this.vehicle = new VehicleRenderer(this, sim.renderVehicle, this.transform, { depth: DEPTH.vehicle });
  }

  private buildHudRestart(): void {
    this.hudRestart = new Button(this, {
      x: screen.width - safeArea.margin - 22,
      y: safeArea.top + space.space4 + 22,
      width: 44,
      height: 44,
      label: '↺',
      variant: 'secondary',
      fontSize: type.h2.size,
      services: this.services,
      devId: 'hud-restart',
      onClick: () => this.restartAttempt(),
    });
    this.hudRestart.setScrollFactor(0).setDepth(DEPTH.hud);
  }

  // ── drawing phase ────────────────────────────────────────────────────────

  private beginDrawing(): void {
    const sim = this.sim as GameSimulation;
    this.outcomeHandled = false;
    this.accumulatorSec = 0;
    this.lastAlpha = 0;
    this.strokePoints = [];
    this.hasFiredDepleted = false;
    this.strokeRenderer?.clear();
    this.overlay?.hide();
    this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
    this.director.reset(this.centerPx);
    this.strokeInput?.enable();
    this.setPlayState('drawing');
  }

  private canDraw(): boolean {
    const sim = this.sim;
    if (sim === null || sim.phase !== 'drawing') {
      return false;
    }
    return rawPolylineLength(this.strokePoints) < sim.inkState.remaining;
  }

  private onStrokeStart(point: Point): void {
    this.strokePoints = [point];
    this.hasFiredDepleted = false;
    this.redrawStroke();
  }

  private onStrokePoint(point: Point): void {
    this.strokePoints.push(point);
    this.redrawStroke();
    if (!this.canDraw() && !this.hasFiredDepleted) {
      this.hasFiredDepleted = true;
      this.inkBar?.playDepletedFeedback();
      this.services.uiHaptic();
    }
  }

  private redrawStroke(): void {
    const sim = this.sim as GameSimulation;
    const consumed = rawPolylineLength(this.strokePoints);
    const remaining = Math.max(0, sim.inkState.remaining - consumed);
    const ratio = remaining / sim.inkState.effectiveBudget;
    this.strokeRenderer?.redraw(this.strokePoints, ratio);
    this.inkBar?.update(ratio);
  }

  private commitStroke(points: readonly Point[]): void {
    const sim = this.sim;
    if (sim === null || sim.phase !== 'drawing') {
      return;
    }
    const result = sim.commitStroke(points);
    this.strokeRenderer?.clear();
    this.strokePoints = [];
    if (!result.committed) {
      // Discarded (too short / invalid / not enough ink): refund, nudge, stay.
      this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
      this.inkBar?.playDepletedFeedback();
      return;
    }
    this.strokeInput?.disable();
    const chain = sim.renderChain;
    if (chain !== null) {
      this.bridge = new BridgeRenderer(this, chain, this.transform, {
        stressTracker: sim.renderStressTracker ?? undefined,
        depth: DEPTH.bridge,
      });
    }
    this.setPlayState('anticipation');
  }

  // ── run loop ───────────────────────────────────────────────────────────────

  private stepSimulation(delta: number): void {
    const sim = this.sim as GameSimulation;
    const phase = sim.phase;
    if (phase === 'drawing' || phase === 'ended') {
      return;
    }
    this.accumulatorSec += Math.min(delta, MAX_FRAME_MS) / 1000;
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
    this.bridge?.update(alpha);
    this.vehicle?.update(alpha);
    this.flag?.update(alpha);
    if (this.playState === 'anticipation' || this.playState === 'running') {
      const sim = this.sim as GameSimulation;
      this.inkBar?.update(sim.inkState.ratio, sim.inkState.zone);
    }
  }

  private handleOutcome(): void {
    const sim = this.sim as GameSimulation;
    const outcome = sim.outcome;
    if (outcome === null) {
      return;
    }
    this.outcomeHandled = true;
    this.strokeInput?.disable();
    if (outcome.outcome === 'fail' && isFailsafeReset(outcome)) {
      this.restartAttempt(); // solver failsafe — silent instant reset (≤1 s)
      return;
    }
    this.setPlayState('result');
    if (outcome.outcome === 'clear') {
      this.director.addTrauma(cameraTuning.traumaGoal);
      this.showClear(outcome);
    } else {
      this.overlay?.showFail({ cause: outcome.cause, onRetry: () => this.restartAttempt() });
    }
  }

  private showClear(outcome: Extract<AttemptOutcome, { outcome: 'clear' }>): void {
    const nextId = this.nextLevelId();
    this.overlay?.showClear({
      stars: outcome.starRating,
      coins: outcome.coinsCollected,
      hasNext: nextId !== null,
      onReplay: () => this.restartAttempt(),
      onNext: () => this.goToNext(),
    });
    // Persist coins + bestStars (BR-003); a later LevelSelect visit reads fresh.
    void this.services.creditLevelResult({
      levelId: this.levelId,
      starRating: outcome.starRating,
      collectedCoins: outcome.coinsCollected,
      ...(this.level?.bonusMultiplier !== undefined ? { bonusMultiplier: this.level.bonusMultiplier } : {}),
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
      this.scene.start('LevelSelect');
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
    const sim = this.sim as GameSimulation;
    this.cameraJuiceUnsubs.push(
      sim.events.on('launchReleased', () => {
        this.director.launchKick({ x: 1, y: 0 }); // car always travels +x → kick -x
        this.director.addTrauma(cameraTuning.traumaLaunch);
      }),
      sim.events.on('break', () => this.director.addTrauma(cameraTuning.traumaCrash)),
    );
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
      const phase = (this.sim as GameSimulation).phase;
      if (phase === 'running') {
        this.playState = 'running';
      } else if (phase === 'anticipation') {
        this.playState = 'anticipation';
      }
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
    setDevPlayState({ state, tick: this.currentTick(), outcome: this.outcomeTag() });
  }

  private readUpgrades(): UpgradeLevels {
    return {
      inkCapacityLv: this.services.getUpgradeLevel('inkCapacity'),
      engineSpeedLv: this.services.getUpgradeLevel('engineSpeed'),
    };
  }

  private teardown(): void {
    setWorldToGame(null);
    this.detachJuice?.();
    this.detachJuice = null;
    for (const unsubscribe of this.cameraJuiceUnsubs) {
      unsubscribe();
    }
    this.cameraJuiceUnsubs.length = 0;
    this.strokeInput?.destroy();
    this.strokeRenderer?.destroy();
    this.inkBar?.destroy();
    this.overlay?.destroy();
    this.terrain?.destroy();
    this.coins?.destroy();
    this.flag?.destroy();
    this.vehicle?.destroy();
    this.bridge?.destroy();
    this.director?.destroy();
    this.sim?.destroy();
    this.sim = null;
  }
}

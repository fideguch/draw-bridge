/**
 * SpikeScene — S2 visual credibility check (T035, research.md §R10).
 *
 * Dev-only Phaser scene (route: `?spike=1` in main.ts, `import.meta.env.DEV`
 * guarded — tree-shaken from release builds). Renders the S1 bench scenario
 * with bare Graphics primitives: terrain lines, bridge capsules with a
 * white -> yellow -> red stress tint, car box + wheels, goal flag, killY line.
 * No juice by design — this scene exists to eyeball:
 *   - load sag credibility (S1 pass criterion "visible load sag")
 *   - break credibility (segments separate without exploding)
 *   - capsule x wheel contact popping (S2, unmerged upstream PR #24)
 *
 * Controls: 1-9 select a scenario, M toggles chain/compound, R restarts.
 * HUD: fps, physics step p50/p95/max (sliding window), outcome, break count.
 *
 * WORLD BUDGET (LIB-QUIRK, World.ts header): each (re)start consumes a world
 * slot; at SPIKE_WORLD_BUDGET the scene hard-reloads the page, preserving the
 * selected scenario in the query string.
 *
 * Device measurement (S1 gatekeeper step): run this scene inside the
 * Capacitor shell via dev-server live reload — procedure in quickstart.md §8.
 */

import Phaser from 'phaser';
import { b2Body_GetPosition, b2Body_GetRotation } from 'phaser-box2d';
import type { b2BodyId } from 'phaser-box2d';
import type { GameSimulation } from '@engine/GameSimulation';
import type { Point } from '@engine/level/LevelSchema';
import type { PhysicsMethod } from '@engine/physics/BridgeChainBuilder';
import { GameSimulation as Simulation } from '@engine/GameSimulation';
import { bridge, physics } from '@tuning/TuningConstants';
import {
  SPIKE_WORLD_BUDGET,
  applyTuningOverrides,
  arcStroke,
  buildSpikeLevel,
  forcedSegmentLength,
  restoreTuning,
  simulationInternals,
  summarizeStepDurations,
} from './SpikeScenario';
import type { SimulationInternals, TuningSnapshot } from './SpikeScenario';

interface SpikeSceneScenario {
  readonly label: string;
  readonly gapM: number;
  /** null = natural N from the calibrated segmentLength. */
  readonly forceSegmentCount: number | null;
}

/** Keys 1-9. Gaps cover the S1 matrix; N covers natural + forced sizes. */
const SCENARIOS: readonly SpikeSceneScenario[] = [
  { label: '1: gap 2m, natural N', gapM: 2, forceSegmentCount: null },
  { label: '2: gap 2m, N=16', gapM: 2, forceSegmentCount: 16 },
  { label: '3: gap 4m, natural N', gapM: 4, forceSegmentCount: null },
  { label: '4: gap 4m, N=16', gapM: 4, forceSegmentCount: 16 },
  { label: '5: gap 4m, N=24', gapM: 4, forceSegmentCount: 24 },
  { label: '6: gap 6m, natural N', gapM: 6, forceSegmentCount: null },
  { label: '7: gap 6m, N=16', gapM: 6, forceSegmentCount: 16 },
  { label: '8: gap 6m, N=24', gapM: 6, forceSegmentCount: 24 },
  { label: '9: gap 6m, N=32', gapM: 6, forceSegmentCount: 32 },
];

const PX_PER_METER = 34;
const STEP_WINDOW = 300;
const MAX_FRAME_DELTA_MS = 100; // spiral-of-death clamp (render-side duty, World.ts header)

const COLOR_TERRAIN = 0x8a929e;
const COLOR_BRIDGE = 0xffffff;
const COLOR_CREAK = 0xffe066;
const COLOR_BREAK = 0xff3b30;
const COLOR_CAR = 0x4da3ff;
const COLOR_WHEEL = 0xd0d6de;
const COLOR_FLAG = 0x37d67a;
const COLOR_KILLY = 0x772222;

/** Worlds created by this page (module-level: survives scene restarts). */
let worldsCreatedThisPage = 0;

function stressTint(stress: number): number {
  if (stress < bridge.creakBandMin) {
    return COLOR_BRIDGE;
  }
  const t = Math.min(1, (stress - bridge.creakBandMin) / (1 - bridge.creakBandMin));
  const from = Phaser.Display.Color.ValueToColor(COLOR_CREAK);
  const to = Phaser.Display.Color.ValueToColor(COLOR_BREAK);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
}

export class SpikeScene extends Phaser.Scene {
  private simulation: GameSimulation | null = null;
  private internals: SimulationInternals | null = null;
  private tuningSnapshot: TuningSnapshot | null = null;
  private scenarioIndex = 0;
  private method: PhysicsMethod = 'chain';
  private segmentLocals: { a: Point; b: Point }[] = [];
  private accumulatorMs = 0;
  private stepDurationsMs: number[] = [];
  private breakCount = 0;
  private outcomeLabel = 'running';
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super('Spike');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.hud = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '11px', color: '#e8ecf1' })
      .setDepth(10);

    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get('s') ?? '6');
    this.scenarioIndex = Number.isInteger(requested) && requested >= 1 && requested <= SCENARIOS.length ? requested - 1 : 5;
    this.method = params.get('m') === 'compound' ? 'compound' : 'chain';

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= SCENARIOS.length) {
        this.scenarioIndex = digit - 1;
        this.startScenario();
      } else if (event.key === 'm' || event.key === 'M') {
        this.method = this.method === 'chain' ? 'compound' : 'chain';
        this.startScenario();
      } else if (event.key === 'r' || event.key === 'R') {
        this.startScenario();
      }
    });
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownScenario());

    this.startScenario();
  }

  override update(_time: number, deltaMs: number): void {
    this.stepSimulation(deltaMs);
    this.draw();
  }

  // -- scenario lifecycle ----------------------------------------------------------

  private startScenario(): void {
    this.teardownScenario();
    if (worldsCreatedThisPage >= SPIKE_WORLD_BUDGET) {
      this.reloadPreservingScenario(); // LIB-QUIRK world-slot leak — see header
      return;
    }
    worldsCreatedThisPage++;

    const scenario = SCENARIOS[this.scenarioIndex] as SpikeSceneScenario;
    const stroke = arcStroke(scenario.gapM);
    this.tuningSnapshot = applyTuningOverrides(
      scenario.forceSegmentCount !== null
        ? { segmentLength: forcedSegmentLength(stroke, scenario.forceSegmentCount) }
        : {},
    );

    this.simulation = new Simulation(buildSpikeLevel(scenario.gapM), { method: this.method });
    this.internals = simulationInternals(this.simulation);
    this.breakCount = 0;
    this.outcomeLabel = 'running';
    this.accumulatorMs = 0;
    this.stepDurationsMs = [];
    this.simulation.events.on('break', () => {
      this.breakCount++;
    });

    const commit = this.simulation.commitStroke(stroke);
    if (!commit.committed) {
      this.outcomeLabel = `stroke discarded: ${commit.reason}`;
      return;
    }
    this.captureSegmentLocals();
  }

  private teardownScenario(): void {
    this.simulation?.destroy();
    this.simulation = null;
    this.internals = null;
    if (this.tuningSnapshot !== null) {
      restoreTuning(this.tuningSnapshot);
      this.tuningSnapshot = null;
    }
  }

  private reloadPreservingScenario(): void {
    const url = new URL(window.location.href);
    url.searchParams.set('spike', '1');
    url.searchParams.set('s', String(this.scenarioIndex + 1));
    url.searchParams.set('m', this.method);
    window.location.href = url.toString();
  }

  /** Capsule endpoints in each body's local frame (identity rotation at build). */
  private captureSegmentLocals(): void {
    const chain = this.internals?.chain;
    this.segmentLocals = [];
    if (!chain) {
      return;
    }
    for (let i = 0; i < chain.segments.length; i++) {
      const segment = chain.segments[i] as { a: Point; b: Point };
      const bodyId = (chain.method === 'chain' ? chain.bodies[i] : chain.bodies[0]) as b2BodyId;
      const base = b2Body_GetPosition(bodyId);
      this.segmentLocals.push({
        a: { x: segment.a.x - base.x, y: segment.a.y - base.y },
        b: { x: segment.b.x - base.x, y: segment.b.y - base.y },
      });
    }
  }

  // -- fixed-step drive --------------------------------------------------------------

  private stepSimulation(deltaMs: number): void {
    const simulation = this.simulation;
    if (simulation === null || simulation.phase === 'drawing' || simulation.phase === 'ended') {
      return;
    }
    this.accumulatorMs += Math.min(deltaMs, MAX_FRAME_DELTA_MS);
    const fixedMs = physics.fixedDt * 1000;
    while (this.accumulatorMs >= fixedMs && simulation.outcome === null) {
      const start = performance.now();
      const outcome = simulation.step();
      this.stepDurationsMs.push(performance.now() - start);
      this.accumulatorMs -= fixedMs;
      if (outcome !== null) {
        this.outcomeLabel =
          outcome.outcome === 'clear' ? `CLEAR in ${outcome.ticks} ticks` : `FAIL: ${outcome.cause} @ tick ${outcome.ticks}`;
      }
    }
    if (this.stepDurationsMs.length > STEP_WINDOW) {
      this.stepDurationsMs.splice(0, this.stepDurationsMs.length - STEP_WINDOW);
    }
  }

  // -- rendering -----------------------------------------------------------------------

  private worldToScreen(point: Point): { x: number; y: number } {
    const camera = this.simulation?.referencePoint() ?? { x: 0, y: 0 };
    return {
      x: (point.x - camera.x) * PX_PER_METER + this.scale.width / 2,
      y: (camera.y - point.y) * PX_PER_METER + this.scale.height / 2,
    };
  }

  private draw(): void {
    const simulation = this.simulation;
    const internals = this.internals;
    this.graphics.clear();
    if (simulation === null || internals === null) {
      this.drawHud();
      return;
    }
    this.drawTerrain();
    this.drawBridge();
    this.drawCar();
    this.drawHud();
  }

  private drawTerrain(): void {
    const scenario = SCENARIOS[this.scenarioIndex] as SpikeSceneScenario;
    const level = buildSpikeLevel(scenario.gapM);
    this.graphics.lineStyle(2, COLOR_TERRAIN, 1);
    for (const polyline of level.terrain) {
      this.graphics.beginPath();
      polyline.forEach(([x, y], index) => {
        const p = this.worldToScreen({ x, y });
        if (index === 0) {
          this.graphics.moveTo(p.x, p.y);
        } else {
          this.graphics.lineTo(p.x, p.y);
        }
      });
      this.graphics.strokePath();
    }
    // goal flag
    const flagBase = this.worldToScreen({ x: level.goalFlag.x, y: level.goalFlag.y });
    const flagTop = this.worldToScreen({ x: level.goalFlag.x, y: level.goalFlag.y + level.goalFlag.height });
    this.graphics.lineStyle(2, COLOR_FLAG, 1);
    this.graphics.lineBetween(flagBase.x, flagBase.y, flagTop.x, flagTop.y);
    this.graphics.fillStyle(COLOR_FLAG, 1);
    this.graphics.fillTriangle(flagTop.x, flagTop.y, flagTop.x, flagTop.y + 12, flagTop.x + 18, flagTop.y + 6);
    // killY line
    const killLeft = this.worldToScreen({ x: -30, y: level.killY });
    const killRight = this.worldToScreen({ x: 30, y: level.killY });
    this.graphics.lineStyle(1, COLOR_KILLY, 1);
    this.graphics.lineBetween(killLeft.x, killLeft.y, killRight.x, killRight.y);
  }

  private drawBridge(): void {
    const chain = this.internals?.chain;
    const tracker = this.internals?.stressTracker ?? null;
    if (!chain) {
      return;
    }
    const radiusPx = bridge.capsuleRadius * PX_PER_METER;
    for (let i = 0; i < this.segmentLocals.length; i++) {
      const local = this.segmentLocals[i] as { a: Point; b: Point };
      const bodyId = (chain.method === 'chain' ? chain.bodies[i] : chain.bodies[0]) as b2BodyId;
      const position = b2Body_GetPosition(bodyId);
      const rotation = b2Body_GetRotation(bodyId);
      const transform = (p: Point): { x: number; y: number } =>
        this.worldToScreen({
          x: position.x + rotation.c * p.x - rotation.s * p.y,
          y: position.y + rotation.s * p.x + rotation.c * p.y,
        });
      const a = transform(local.a);
      const b = transform(local.b);
      // stress of the segment = max of its incident joints (chain method only)
      let stress = 0;
      if (tracker !== null && chain.method === 'chain') {
        for (const jointIndex of [i - 1, i]) {
          if (jointIndex >= 0 && jointIndex < chain.joints.length) {
            stress = Math.max(stress, tracker.isBroken(jointIndex) ? 1 : tracker.stressAt(jointIndex));
          }
        }
      }
      const tint = stressTint(stress);
      this.graphics.lineStyle(radiusPx * 2, tint, 1);
      this.graphics.lineBetween(a.x, a.y, b.x, b.y);
      this.graphics.fillStyle(tint, 1);
      this.graphics.fillCircle(a.x, a.y, radiusPx);
      this.graphics.fillCircle(b.x, b.y, radiusPx);
    }
  }

  private drawCar(): void {
    const internals = this.internals;
    if (internals === null) {
      return;
    }
    const vehicle = internals.vehicle;
    const chassisPos = b2Body_GetPosition(vehicle.chassisId);
    const chassisRot = b2Body_GetRotation(vehicle.chassisId);
    const halfW = 0.75;
    const halfH = 0.25;
    const corners: Point[] = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];
    this.graphics.lineStyle(2, COLOR_CAR, 1);
    this.graphics.beginPath();
    corners.forEach((corner, index) => {
      const world = {
        x: chassisPos.x + chassisRot.c * corner.x - chassisRot.s * corner.y,
        y: chassisPos.y + chassisRot.s * corner.x + chassisRot.c * corner.y,
      };
      const p = this.worldToScreen(world);
      if (index === 0) {
        this.graphics.moveTo(p.x, p.y);
      } else {
        this.graphics.lineTo(p.x, p.y);
      }
    });
    this.graphics.closePath();
    this.graphics.strokePath();

    for (const wheelId of vehicle.wheelIds) {
      const wheelPos = b2Body_GetPosition(wheelId);
      const wheelRot = b2Body_GetRotation(wheelId);
      const center = this.worldToScreen({ x: wheelPos.x, y: wheelPos.y });
      const radiusPx = 0.3 * PX_PER_METER;
      this.graphics.lineStyle(2, COLOR_WHEEL, 1);
      this.graphics.strokeCircle(center.x, center.y, radiusPx);
      // spoke shows true wheel rotation (S2: rotation synced to contact, no popping)
      this.graphics.lineBetween(
        center.x,
        center.y,
        center.x + wheelRot.c * radiusPx,
        center.y - wheelRot.s * radiusPx,
      );
    }
  }

  private drawHud(): void {
    const scenario = SCENARIOS[this.scenarioIndex] as SpikeSceneScenario;
    const timing = summarizeStepDurations(this.stepDurationsMs);
    const segments = this.internals?.chain?.segments.length ?? 0;
    this.maybeReportStats(scenario.label, timing, segments);
    this.hud.setText(
      [
        `SPIKE S2 — ${scenario.label}  [method ${this.method}, N=${segments}]`,
        `fps ${this.game.loop.actualFps.toFixed(0)}  step p50 ${timing.p50Ms.toFixed(2)}ms  p95 ${timing.p95Ms.toFixed(2)}ms  max ${timing.maxMs.toFixed(2)}ms (${timing.samples})`,
        `outcome: ${this.outcomeLabel}  breaks: ${this.breakCount}  worlds ${worldsCreatedThisPage}/${SPIKE_WORLD_BUDGET}`,
        `keys: 1-9 scenario | M method | R restart`,
      ].join('\n'),
    );
  }

  /**
   * ?report=1 (dev builds only): POST the HUD numbers to the vite dev server's
   * /__devicestats sink every ~2s — the AC-9 real-device 60fps evidence path
   * (quickstart §8). Fire-and-forget; failures never disturb the scene.
   */
  private lastReportAt = 0;
  private maybeReportStats(
    scenarioLabel: string,
    timing: { p50Ms: number; p95Ms: number; maxMs: number; samples: number },
    segments: number,
  ): void {
    if (new URLSearchParams(window.location.search).get('report') !== '1') return;
    const now = performance.now();
    if (now - this.lastReportAt < 2000) return;
    this.lastReportAt = now;
    void fetch('/__devicestats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ua: navigator.userAgent,
        scenario: scenarioLabel,
        method: this.method,
        segments,
        fps: Number(this.game.loop.actualFps.toFixed(1)),
        p50Ms: Number(timing.p50Ms.toFixed(3)),
        p95Ms: Number(timing.p95Ms.toFixed(3)),
        maxMs: Number(timing.maxMs.toFixed(3)),
        samples: timing.samples,
        outcome: this.outcomeLabel,
      }),
    }).catch(() => undefined);
  }
}

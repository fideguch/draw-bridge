/**
 * EditorScene — in-game level editor (T082, FR-024, SC-009). Dev builds only.
 *
 * The INTERACTIVE counterpart to scripts/levels/authoring.ts: instead of
 * declaring geometry as code, the Level Author edits it live and records a
 * ghost by testplaying — but both paths reuse the SAME engine (runScriptedAttempt
 * + GhostRecorder) and the SAME shipping validator (validateLevel via
 * editorState), so an editor-authored level is byte-compatible with a
 * script-authored one.
 *
 * Split of concerns:
 *   - Phaser canvas: the world view (bare-Graphics render à la SpikeScene),
 *     pointer-based terrain/entity editing, camera pan (right-drag) / zoom
 *     (wheel), and the testplay stroke (the shared StrokeInput).
 *   - DOM control panel: tool selector, id selector, ink/star steppers, gimmick
 *     toggle, and the New-polyline / Testplay / Save / Import / Load actions.
 *     (A DOM overlay is the sanctioned dev-tool UI; it also keeps the editor
 *     free of the GameServices/Button composition dependency.)
 *
 * Save gate (FR-024): Save runs validateDraft — blocked, with the validator's
 * error list shown, unless the draft validates INCLUDING a recorded clear ghost.
 * Export = file download + clipboard copy of the exact authoring JSON.
 *
 * WIRING IS DEFERRED (composition owns main.ts): the composition root registers
 * this scene under an import.meta.env.DEV dynamic import (tree-shaken from
 * release). Entry: scene key 'Editor'.
 */

import Phaser from 'phaser';
import type { GhostSolution, Level, Point } from '@engine/level/LevelSchema';
import { runScriptedAttempt } from '@engine/replay/GhostPlayer';
import { GhostRecorder } from '@engine/replay/GhostRecorder';
import { World } from '@engine/physics/World';
import { WorldToPixel } from '@render/world/worldToPixel';
import { StrokeInput } from '@render/draw/StrokeInput';
import { CHAPTER1_TILES } from '@render/ui/levelCatalog';
import { bridge, car } from '@tuning/TuningConstants';
import { color } from '@render/ui/theme';
import type { EditorDraft } from './editorState';
import {
  addCoin,
  addVertex,
  canSave,
  clearGhost,
  createStarterDraft,
  deleteVertex,
  draftFromJson,
  draftToLevel,
  draftToLevelJson,
  moveVertex,
  nearestCoinIndex,
  nearestVertex,
  removeCoinAt,
  setGhost,
  setGoalFlag,
  setId,
  setKillY,
  setVehicleSpawn,
  startNewPolyline,
  stepInkBudget,
  stepStar2,
  stepStar3,
  testplayBlockers,
  toggleGimmick,
  validateDraft,
} from './editorState';
import { exportLevelJson, showImportOverlay } from './editorExport';

/** Existing shipped levels for the "Load" action. */
const LEVEL_JSON = import.meta.glob('/levels/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

const VALID_IDS: readonly string[] = CHAPTER1_TILES.map((tile) => tile.id);

type EditorTool = 'terrain' | 'spawn' | 'goal' | 'coin' | 'killY' | 'testplay';

const FRAME_MARGIN_PX = 60;
const PICK_RADIUS_PX = 14;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const GHOST_SAMPLE_EVERY_TICKS = 10;
const VERTEX_HANDLE_PX = 5;

export class EditorScene extends Phaser.Scene {
  private draft: EditorDraft = createStarterDraft('ch1-l01');
  private transform!: WorldToPixel;
  private gfx!: Phaser.GameObjects.Graphics;
  private strokeInput: StrokeInput | null = null;
  private testWorld: World | null = null;

  private tool: EditorTool = 'terrain';
  private activePolyline = 0;
  private idIndex = 0;

  // pointer interaction state
  private isPanning = false;
  private isDraggingVertex = false;
  private isDraggingGoal = false;
  private dragVertex: { polylineIndex: number; vertexIndex: number } | null = null;
  private goalAnchor: Point | null = null;
  private lastPointer: { x: number; y: number } | null = null;

  // testplay preview
  private ghostPreview: readonly Point[] = [];
  private testStroke: readonly Point[] = [];

  // DOM control panel
  private panel: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private idLabelEl: HTMLElement | null = null;
  private econLabelEl: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private gimmickCheckbox: HTMLInputElement | null = null;
  /** Aborted on scene shutdown so an open import overlay tears its backdrop down. */
  private importAbort: AbortController | null = null;

  constructor() {
    super('Editor');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(color.sky);
    this.gfx = this.add.graphics();
    this.testWorld = new World();

    this.rebuildTransform();
    this.installPointer();
    this.buildPanel();

    this.strokeInput = new StrokeInput(this, {
      transform: this.transform,
      camera: this.cameras.main,
      canDraw: () => this.tool === 'testplay',
      callbacks: { onStrokeEnd: (points) => this.runTestplay(points) },
    });

    this.selectTool('terrain');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.refreshPanel();
  }

  update(): void {
    this.redraw();
  }

  // ── coordinate framing ──────────────────────────────────────────────────────────

  private rebuildTransform(): void {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const points: Point[] = [
      ...this.draft.terrain.flat(),
      this.draft.vehicleSpawn,
      { x: this.draft.goalFlag.x, y: this.draft.goalFlag.y },
      { x: this.draft.goalFlag.x + this.draft.goalFlag.width, y: this.draft.goalFlag.y + this.draft.goalFlag.height },
      ...this.draft.coins,
      { x: this.draft.vehicleSpawn.x, y: this.draft.killY },
    ];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const ppm = Math.min((viewW - 2 * FRAME_MARGIN_PX) / worldW, (viewH - 2 * FRAME_MARGIN_PX) / worldH);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.transform = new WorldToPixel({
      pixelsPerMeter: Math.max(1, ppm),
      originX: viewW / 2 - centerX * Math.max(1, ppm),
      originY: viewH / 2 + centerY * Math.max(1, ppm),
    });
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(viewW / 2, viewH / 2);
  }

  private pointerWorld(pointer: Phaser.Input.Pointer): Point {
    const worldPixel = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return this.transform.toWorld(worldPixel.x, worldPixel.y);
  }

  /** Vertex/coin pick radius in world metres at the current zoom. */
  private pickRadiusWorld(): number {
    return PICK_RADIUS_PX / (this.transform.pixelsPerMeter * this.cameras.main.zoom);
  }

  // ── pointer editing ───────────────────────────────────────────────────────────────

  private installPointer(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('wheel', this.onWheel, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Right button: delete a vertex under the cursor (terrain), else pan.
    if (pointer.rightButtonDown()) {
      if (this.tool === 'terrain') {
        const hit = nearestVertex(this.draft, this.pointerWorld(pointer), this.pickRadiusWorld());
        if (hit !== null) {
          this.setDraft(deleteVertex(this.draft, hit.polylineIndex, hit.vertexIndex));
          return;
        }
      }
      this.isPanning = true;
      this.lastPointer = { x: pointer.x, y: pointer.y };
      return;
    }
    if (this.tool === 'testplay') {
      return; // StrokeInput owns the pointer
    }
    const world = this.pointerWorld(pointer);
    switch (this.tool) {
      case 'terrain':
        this.onTerrainDown(world);
        break;
      case 'spawn':
        this.setDraft(setVehicleSpawn(this.draft, world));
        break;
      case 'goal':
        this.goalAnchor = world;
        this.isDraggingGoal = true;
        break;
      case 'coin':
        this.onCoinDown(world);
        break;
      case 'killY':
        this.setDraft(setKillY(this.draft, world.y));
        this.isDraggingVertex = true; // reuse flag: drag to slide the killY line
        break;
    }
  }

  private onTerrainDown(world: Point): void {
    const hit = nearestVertex(this.draft, world, this.pickRadiusWorld());
    if (hit !== null) {
      this.dragVertex = { polylineIndex: hit.polylineIndex, vertexIndex: hit.vertexIndex };
      this.activePolyline = hit.polylineIndex;
      this.isDraggingVertex = true;
      return;
    }
    if (this.draft.terrain[this.activePolyline] === undefined) {
      this.setDraft(startNewPolyline(this.draft, world));
      this.activePolyline = this.draft.terrain.length - 1;
      return;
    }
    this.setDraft(addVertex(this.draft, this.activePolyline, world));
  }

  private onCoinDown(world: Point): void {
    const index = nearestCoinIndex(this.draft, world, this.pickRadiusWorld());
    this.setDraft(index >= 0 ? removeCoinAt(this.draft, index) : addCoin(this.draft, world));
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPanning && this.lastPointer !== null) {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.scrollX -= (pointer.x - this.lastPointer.x) / zoom;
      this.cameras.main.scrollY -= (pointer.y - this.lastPointer.y) / zoom;
      this.lastPointer = { x: pointer.x, y: pointer.y };
      return;
    }
    if (!pointer.isDown) {
      return;
    }
    const world = this.pointerWorld(pointer);
    if (this.isDraggingVertex && this.dragVertex !== null) {
      this.setDraft(moveVertex(this.draft, this.dragVertex.polylineIndex, this.dragVertex.vertexIndex, world));
    } else if (this.tool === 'killY' && this.isDraggingVertex) {
      this.setDraft(setKillY(this.draft, world.y));
    } else if (this.isDraggingGoal && this.goalAnchor !== null) {
      this.setDraft(setGoalFlag(this.draft, rectFrom(this.goalAnchor, world)));
    }
  }

  private onPointerUp(): void {
    this.isPanning = false;
    this.isDraggingVertex = false;
    this.isDraggingGoal = false;
    this.dragVertex = null;
    this.goalAnchor = null;
    this.lastPointer = null;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(pointer.x, pointer.y);
    const zoom = Phaser.Math.Clamp(cam.zoom * (1 - dy * 0.001), MIN_ZOOM, MAX_ZOOM);
    cam.setZoom(zoom);
    const after = cam.getWorldPoint(pointer.x, pointer.y);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  // ── testplay + ghost recording ────────────────────────────────────────────────────

  private runTestplay(points: readonly Point[]): void {
    const blockers = testplayBlockers(this.draft);
    if (blockers.length > 0) {
      this.setStatus(`Fix geometry before testplay:\n- ${blockers.slice(0, 4).join('\n- ')}`, true);
      return;
    }
    const level: Level = draftToLevel(this.draft);
    const recorder = new GhostRecorder({ sampleEveryTicks: GHOST_SAMPLE_EVERY_TICKS, kind: 'any' });
    const attempt = runScriptedAttempt(level, points, {
      upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
      ...(this.testWorld !== null ? { world: this.testWorld } : {}),
      onTick: (tick, referencePoint) => recorder.sample(tick, referencePoint),
    });
    this.testStroke = points.map((p) => ({ x: p.x, y: p.y }));

    if (!attempt.committed) {
      this.ghostPreview = [];
      this.setStatus(`Testplay: stroke discarded (${attempt.reason})`, true);
      return;
    }
    if (attempt.outcome !== 'clear' || attempt.starRating === null) {
      this.ghostPreview = [];
      this.setStatus(`Testplay: FAIL (${attempt.cause ?? 'no clear'}) at tick ${attempt.ticks} — no ghost recorded`, true);
      return;
    }
    const ghost: GhostSolution = recorder.toGhostSolution({
      stroke: attempt.stroke,
      ticks: attempt.ticks,
      finalPos: attempt.finalPos,
      inkConsumed: attempt.inkConsumed,
      starRating: attempt.starRating,
    });
    this.ghostPreview = ghost.samples.map((sample) => ({ x: sample.x, y: sample.y }));
    this.setDraft(setGhost(this.draft, ghost));
    this.setStatus(
      `Testplay CLEAR — ${attempt.ticks} ticks, ${attempt.starRating}★, ink ${attempt.inkConsumed.toFixed(2)}. Ghost recorded — Save enabled.`,
      false,
    );
  }

  // ── draft mutation ──────────────────────────────────────────────────────────────────

  private setDraft(next: EditorDraft): void {
    this.draft = next;
    this.refreshPanel();
  }

  private loadExisting(): void {
    const raw = LEVEL_JSON[`/levels/${this.draft.id}.json`];
    if (raw === undefined) {
      this.setStatus(`No shipped level for ${this.draft.id}`, true);
      return;
    }
    const parsed = draftFromJson(JSON.stringify(raw));
    if (!parsed.ok) {
      this.setStatus(`Load failed:\n- ${parsed.errors.join('\n- ')}`, true);
      return;
    }
    this.draft = parsed.draft;
    this.activePolyline = Math.max(0, this.draft.terrain.length - 1);
    this.ghostPreview = [];
    this.testStroke = [];
    this.rebuildTransform();
    this.setStatus(`Loaded ${this.draft.id} (${this.draft.ghost === null ? 'no ghost' : 'ghost present'})`, false);
    this.refreshPanel();
  }

  private async importLevel(): Promise<void> {
    this.importAbort?.abort();
    this.importAbort = new AbortController();
    const text = await showImportOverlay({ signal: this.importAbort.signal });
    this.importAbort = null;
    if (text === null) {
      return;
    }
    const parsed = draftFromJson(text);
    if (!parsed.ok) {
      this.setStatus(`Import rejected:\n- ${parsed.errors.slice(0, 6).join('\n- ')}`, true);
      return;
    }
    this.draft = parsed.draft;
    this.idIndex = Math.max(0, VALID_IDS.indexOf(this.draft.id));
    this.activePolyline = Math.max(0, this.draft.terrain.length - 1);
    this.ghostPreview = [];
    this.testStroke = [];
    this.rebuildTransform();
    this.setStatus(`Imported ${this.draft.id}`, false);
    this.refreshPanel();
  }

  private async saveLevel(): Promise<void> {
    const result = validateDraft(this.draft);
    if (!result.ok) {
      this.setStatus(`Save BLOCKED — invalid level:\n- ${result.errors.join('\n- ')}`, true);
      return;
    }
    const hasCopied = await exportLevelJson(this.draft.id, draftToLevelJson(this.draft));
    this.setStatus(`Saved ${this.draft.id}.json (downloaded${hasCopied ? ' + copied to clipboard' : ''}).`, false);
  }

  private cycleId(delta: number): void {
    this.idIndex = (this.idIndex + delta + VALID_IDS.length) % VALID_IDS.length;
    const id = VALID_IDS[this.idIndex] as string;
    // Changing id invalidates a ghost recorded under the old filename stem.
    this.setDraft(clearGhost(setId(this.draft, id)));
  }

  private selectTool(tool: EditorTool): void {
    this.tool = tool;
    if (tool === 'testplay') {
      this.strokeInput?.enable();
    } else {
      this.strokeInput?.disable();
    }
    this.refreshPanel();
  }

  // ── rendering (bare Graphics, SpikeScene style) ────────────────────────────────────

  private redraw(): void {
    const gfx = this.gfx;
    gfx.clear();
    this.drawTerrain(gfx);
    this.drawKillY(gfx);
    this.drawGoal(gfx);
    this.drawCoins(gfx);
    this.drawSpawn(gfx);
    this.drawGhostPreview(gfx);
  }

  private worldPx(point: Point): { x: number; y: number } {
    return this.transform.point(point);
  }

  private drawTerrain(gfx: Phaser.GameObjects.Graphics): void {
    gfx.lineStyle(2, color.terrainStroke, 1);
    this.draft.terrain.forEach((line, lineIndex) => {
      if (line.length >= 2) {
        gfx.beginPath();
        line.forEach((vertex, i) => {
          const px = this.worldPx(vertex);
          if (i === 0) {
            gfx.moveTo(px.x, px.y);
          } else {
            gfx.lineTo(px.x, px.y);
          }
        });
        gfx.strokePath();
      }
      const isActive = lineIndex === this.activePolyline;
      gfx.fillStyle(isActive ? color.goalFlag : color.coinStroke, 1);
      for (const vertex of line) {
        const px = this.worldPx(vertex);
        gfx.fillCircle(px.x, px.y, VERTEX_HANDLE_PX);
      }
    });
  }

  private drawKillY(gfx: Phaser.GameObjects.Graphics): void {
    const cam = this.cameras.main;
    const left = this.transform.toWorld(cam.getWorldPoint(0, 0).x, 0).x;
    const right = this.transform.toWorld(cam.getWorldPoint(this.scale.width, 0).x, 0).x;
    const a = this.worldPx({ x: left - 5, y: this.draft.killY });
    const b = this.worldPx({ x: right + 5, y: this.draft.killY });
    gfx.lineStyle(2, color.uiDanger, 0.8);
    gfx.lineBetween(a.x, a.y, b.x, b.y);
  }

  private drawGoal(gfx: Phaser.GameObjects.Graphics): void {
    const flag = this.draft.goalFlag;
    const bottomLeft = this.worldPx({ x: flag.x, y: flag.y });
    const topRight = this.worldPx({ x: flag.x + flag.width, y: flag.y + flag.height });
    gfx.lineStyle(2, color.goalFlag, 1);
    gfx.strokeRect(bottomLeft.x, topRight.y, topRight.x - bottomLeft.x, bottomLeft.y - topRight.y);
  }

  private drawCoins(gfx: Phaser.GameObjects.Graphics): void {
    gfx.fillStyle(color.coin, 1);
    gfx.lineStyle(1, color.coinStroke, 1);
    for (const coin of this.draft.coins) {
      const px = this.worldPx(coin);
      const radius = 0.3 * this.transform.pixelsPerMeter;
      gfx.fillCircle(px.x, px.y, radius);
      gfx.strokeCircle(px.x, px.y, radius);
    }
  }

  private drawSpawn(gfx: Phaser.GameObjects.Graphics): void {
    const px = this.worldPx(this.draft.vehicleSpawn);
    const halfW = car.chassisHalfWidth * this.transform.pixelsPerMeter;
    const halfH = car.chassisHalfHeight * this.transform.pixelsPerMeter;
    gfx.lineStyle(2, color.carBody, 1);
    gfx.strokeRect(px.x - halfW, px.y - halfH, halfW * 2, halfH * 2);
    gfx.lineBetween(px.x, px.y - halfH, px.x, px.y - halfH - 12);
  }

  private drawGhostPreview(gfx: Phaser.GameObjects.Graphics): void {
    if (this.testStroke.length >= 2) {
      gfx.lineStyle(Math.max(2, bridge.capsuleRadius * this.transform.pixelsPerMeter), color.inkLine, 0.7);
      this.strokePath(gfx, this.testStroke);
    }
    if (this.ghostPreview.length >= 2) {
      gfx.lineStyle(2, color.uiPrimary, 0.9);
      this.strokePath(gfx, this.ghostPreview);
    }
  }

  private strokePath(gfx: Phaser.GameObjects.Graphics, points: readonly Point[]): void {
    gfx.beginPath();
    points.forEach((point, i) => {
      const px = this.worldPx(point);
      if (i === 0) {
        gfx.moveTo(px.x, px.y);
      } else {
        gfx.lineTo(px.x, px.y);
      }
    });
    gfx.strokePath();
  }

  // ── DOM control panel ──────────────────────────────────────────────────────────────

  private buildPanel(): void {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      zIndex: '99998',
      width: '250px',
      padding: '10px',
      background: 'rgba(16,18,22,0.92)',
      color: '#e8ecf1',
      font: '11px/1.4 monospace',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    } satisfies Partial<CSSStyleDeclaration>);

    const header = document.createElement('div');
    header.textContent = 'LEVEL EDITOR';
    header.style.fontWeight = 'bold';
    panel.appendChild(header);

    // id selector
    const idRow = document.createElement('div');
    idRow.style.margin = '8px 0';
    idRow.appendChild(this.button('<', () => this.cycleId(-1)));
    this.idLabelEl = document.createElement('span');
    Object.assign(this.idLabelEl.style, { margin: '0 8px', display: 'inline-block', minWidth: '70px', textAlign: 'center' });
    idRow.appendChild(this.idLabelEl);
    idRow.appendChild(this.button('>', () => this.cycleId(1)));
    idRow.appendChild(this.button('Load', () => this.loadExisting()));
    panel.appendChild(idRow);

    // tools
    const toolRow = document.createElement('div');
    toolRow.style.margin = '6px 0';
    (['terrain', 'spawn', 'goal', 'coin', 'killY', 'testplay'] as const).forEach((tool) => {
      const button = this.button(tool, () => this.selectTool(tool));
      button.dataset['tool'] = tool;
      button.style.margin = '2px';
      toolRow.appendChild(button);
    });
    panel.appendChild(toolRow);

    panel.appendChild(this.button('+ new polyline', () => {
      this.setDraft(startNewPolyline(this.draft));
      this.activePolyline = this.draft.terrain.length - 1;
    }));

    // economy steppers
    this.econLabelEl = document.createElement('div');
    this.econLabelEl.style.margin = '8px 0 4px';
    panel.appendChild(this.econLabelEl);
    panel.appendChild(this.stepperRow('ink', (d) => this.setDraft(stepInkBudget(this.draft, d)), [1, 5]));
    panel.appendChild(this.stepperRow('star2', (d) => this.setDraft(stepStar2(this.draft, d)), [1, 5]));
    panel.appendChild(this.stepperRow('star3', (d) => this.setDraft(stepStar3(this.draft, d)), [1, 5]));

    // gimmick toggle
    const gimmickRow = document.createElement('label');
    gimmickRow.style.display = 'block';
    gimmickRow.style.margin = '6px 0';
    this.gimmickCheckbox = document.createElement('input');
    this.gimmickCheckbox.type = 'checkbox';
    this.gimmickCheckbox.addEventListener('change', () => this.setDraft(toggleGimmick(this.draft, 'anti-dominant')));
    gimmickRow.append(this.gimmickCheckbox, document.createTextNode(' anti-dominant'));
    panel.appendChild(gimmickRow);

    // actions
    const actionRow = document.createElement('div');
    actionRow.style.margin = '8px 0';
    this.saveButton = this.button('Save / Export', () => void this.saveLevel());
    this.saveButton.style.width = '100%';
    actionRow.appendChild(this.saveButton);
    actionRow.appendChild(this.button('Import', () => void this.importLevel()));
    panel.appendChild(actionRow);

    // status
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      marginTop: '8px',
      padding: '6px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '4px',
      whiteSpace: 'pre-wrap',
      minHeight: '32px',
    });
    panel.appendChild(this.statusEl);

    document.body.appendChild(panel);
    this.panel = panel;
  }

  private stepperRow(label: string, apply: (delta: number) => void, steps: readonly [number, number]): HTMLElement {
    const row = document.createElement('div');
    row.style.margin = '3px 0';
    const [small, big] = steps;
    row.appendChild(this.button(`-${big}`, () => apply(-big)));
    row.appendChild(this.button(`-${small}`, () => apply(-small)));
    const name = document.createElement('span');
    name.textContent = ` ${label} `;
    row.appendChild(name);
    row.appendChild(this.button(`+${small}`, () => apply(small)));
    row.appendChild(this.button(`+${big}`, () => apply(big)));
    return row;
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    Object.assign(button.style, {
      cursor: 'pointer',
      margin: '1px',
      background: 'rgba(255,255,255,0.1)',
      color: '#e8ecf1',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px',
      font: '10px monospace',
      padding: '2px 6px',
    });
    button.addEventListener('click', onClick);
    return button;
  }

  private refreshPanel(): void {
    if (this.idLabelEl !== null) {
      this.idLabelEl.textContent = this.draft.id;
    }
    if (this.econLabelEl !== null) {
      const t = this.draft.starThresholds;
      this.econLabelEl.textContent = `ink ${this.draft.inkBudget}  ★3<${t.star3}  ★2<${t.star2}`;
    }
    if (this.gimmickCheckbox !== null) {
      this.gimmickCheckbox.checked = this.draft.gimmickTags.includes('anti-dominant');
    }
    if (this.panel !== null) {
      for (const button of Array.from(this.panel.querySelectorAll<HTMLButtonElement>('button[data-tool]'))) {
        button.style.outline = button.dataset['tool'] === this.tool ? '2px solid #21c46b' : 'none';
      }
    }
    if (this.saveButton !== null) {
      const isSavable = canSave(this.draft);
      this.saveButton.disabled = !isSavable;
      this.saveButton.style.opacity = isSavable ? '1' : '0.5';
      this.saveButton.title = isSavable ? 'validateLevel passes' : 'Testplay to record a solution (no ghost = no save)';
    }
  }

  private setStatus(text: string, isError: boolean): void {
    if (this.statusEl !== null) {
      this.statusEl.textContent = text;
      this.statusEl.style.color = isError ? '#ff8a80' : '#a5ffb0';
    }
  }

  // ── teardown ─────────────────────────────────────────────────────────────────────────

  private teardown(): void {
    this.importAbort?.abort();
    this.importAbort = null;
    this.strokeInput?.destroy();
    this.strokeInput = null;
    this.testWorld?.destroy();
    this.testWorld = null;
    this.panel?.remove();
    this.panel = null;
  }
}

/** Bottom-left-anchored (y-up) rect spanning two world points, min 0.5 m size. */
function rectFrom(a: Point, b: Point): { x: number; y: number; width: number; height: number } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0.5, Math.abs(b.x - a.x)),
    height: Math.max(0.5, Math.abs(b.y - a.y)),
  };
}

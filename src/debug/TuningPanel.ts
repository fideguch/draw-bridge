/**
 * TuningPanel — dev-only live tuning overlay (T083, FR-025, SC-010).
 *
 * A DOM overlay (toggle key `D`) of grouped sliders over every curated
 * TuningConstants field (tuningOverride.TUNABLE_FIELDS), plus a live readout of
 * fps / physics step-time p95 / body count — the KPI-001 device budget probe.
 *
 * Slider<->value mapping and the p95 ring buffer are the pure panelMath
 * functions (unit-tested); this file is the thin Phaser/DOM shell. Each slider
 * is badged 'live' or 'restart' from its field's apply mode so the author knows
 * whether a change needs a fresh testplay to take effect. Per-group and global
 * reset-to-defaults restore the authored values.
 *
 * WIRING IS DEFERRED (composition owns main.ts): the composition root attaches
 * this under an `import.meta.env.DEV` dynamic import and passes the real stats
 * provider (fps from the Phaser loop, step-time from the sim step wall clock,
 * body count from the physics world). See the module header of tuningOverride.ts
 * for why this is tree-shaken from release builds.
 */

import type Phaser from 'phaser';
import { NumberRingBuffer, sliderToValue, valueToSlider, type SliderSpec } from './panelMath';
import {
  TUNABLE_FIELDS,
  fieldsForGroup,
  getTuning,
  resetAll,
  resetGroup,
  setTuning,
  tuningGroupNames,
  type TunableField,
  type TuningGroupName,
} from './tuningOverride';

/** Per-frame stats the composition root feeds in (all instantaneous). */
export interface PanelStats {
  readonly fps: number;
  /** Wall time of the most recent physics step in ms (fed into the p95 window). */
  readonly stepTimeMs: number;
  /** Live physics body count. */
  readonly bodyCount: number;
}

export type StatsProvider = () => PanelStats;

export interface TuningPanelOptions {
  /** Supplies fps / step-time / body-count each frame (composition-wired). */
  readonly statsProvider?: StatsProvider;
  /** Phaser key name to toggle the panel. Default 'D'. */
  readonly toggleKey?: string;
  /** Step-time window size for the p95 readout. Default 300. */
  readonly stepWindow?: number;
}

const SLIDER_RESOLUTION = 1000;

function specForField(field: TunableField): SliderSpec {
  return field.step === undefined
    ? { min: field.min, max: field.max }
    : { min: field.min, max: field.max, step: field.step };
}

function formatValue(value: number): string {
  return Math.abs(value) >= 100 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3);
}

interface SliderRow {
  readonly field: TunableField;
  readonly input: HTMLInputElement;
  readonly valueLabel: HTMLElement;
}

export class TuningPanel {
  private readonly scene: Phaser.Scene;
  private readonly statsProvider: StatsProvider | undefined;
  private readonly toggleKey: string;
  private readonly stepWindow: NumberRingBuffer;
  private readonly rows: SliderRow[] = [];

  private root: HTMLElement | null = null;
  private statsLabel: HTMLElement | null = null;
  private isVisible = false;
  private isAttached = false;

  constructor(scene: Phaser.Scene, options?: TuningPanelOptions) {
    this.scene = scene;
    this.statsProvider = options?.statsProvider;
    this.toggleKey = options?.toggleKey ?? 'D';
    this.stepWindow = new NumberRingBuffer(options?.stepWindow ?? 300);
  }

  /** Bind the toggle key + per-frame stats pump. Idempotent. */
  attach(): this {
    if (this.isAttached) {
      return this;
    }
    this.isAttached = true;
    this.scene.input.keyboard?.on(`keydown-${this.toggleKey}`, this.onToggle, this);
    this.scene.events.on('update', this.onSceneUpdate, this);
    this.scene.events.once('shutdown', this.detach, this);
    this.scene.events.once('destroy', this.detach, this);
    return this;
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    if (this.root === null) {
      this.root = this.buildDom();
      document.body.appendChild(this.root);
    }
    this.syncFromTuning();
    this.root.style.display = 'block';
    this.isVisible = true;
  }

  hide(): void {
    if (this.root !== null) {
      this.root.style.display = 'none';
    }
    this.isVisible = false;
  }

  get visible(): boolean {
    return this.isVisible;
  }

  detach(): void {
    if (!this.isAttached) {
      return;
    }
    this.isAttached = false;
    this.scene.input.keyboard?.off(`keydown-${this.toggleKey}`, this.onToggle, this);
    this.scene.events.off('update', this.onSceneUpdate, this);
    if (this.root !== null) {
      this.root.remove();
      this.root = null;
    }
    this.rows.length = 0;
    this.statsLabel = null;
    this.isVisible = false;
  }

  // ── frame pump ────────────────────────────────────────────────────────────────

  private onToggle(): void {
    this.toggle();
  }

  private onSceneUpdate(): void {
    const stats = this.statsProvider?.();
    if (stats !== undefined) {
      this.stepWindow.push(stats.stepTimeMs);
    }
    if (this.isVisible && this.statsLabel !== null) {
      const fps = stats?.fps ?? 0;
      const bodies = stats?.bodyCount ?? 0;
      this.statsLabel.textContent = `fps ${fps.toFixed(0)}   step p95 ${this.stepWindow.p95().toFixed(2)}ms   bodies ${bodies}`;
    }
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────────

  private buildDom(): HTMLElement {
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      zIndex: '99999',
      width: '320px',
      maxHeight: '92vh',
      overflowY: 'auto',
      padding: '10px',
      background: 'rgba(16,18,22,0.92)',
      color: '#e8ecf1',
      font: '11px/1.4 monospace',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    } satisfies Partial<CSSStyleDeclaration>);

    const header = document.createElement('div');
    header.textContent = 'TUNING (D to toggle)';
    Object.assign(header.style, { fontWeight: 'bold', marginBottom: '6px' });
    root.appendChild(header);

    this.statsLabel = document.createElement('div');
    Object.assign(this.statsLabel.style, {
      marginBottom: '8px',
      padding: '4px 6px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '4px',
    });
    this.statsLabel.textContent = 'fps —   step p95 —   bodies —';
    root.appendChild(this.statsLabel);

    for (const group of tuningGroupNames()) {
      root.appendChild(this.buildGroup(group));
    }

    const resetAllButton = this.makeButton('reset ALL to defaults', () => {
      resetAll();
      this.syncFromTuning();
    });
    resetAllButton.style.marginTop = '8px';
    resetAllButton.style.width = '100%';
    root.appendChild(resetAllButton);

    return root;
  }

  private buildGroup(group: TuningGroupName): HTMLElement {
    const section = document.createElement('div');
    section.style.margin = '8px 0';

    const title = document.createElement('div');
    title.textContent = group;
    Object.assign(title.style, {
      textTransform: 'uppercase',
      opacity: '0.7',
      borderBottom: '1px solid rgba(255,255,255,0.15)',
      marginBottom: '4px',
    });
    const resetButton = this.makeButton('reset', () => {
      resetGroup(group);
      this.syncFromTuning();
    });
    Object.assign(resetButton.style, { float: 'right', fontSize: '10px', padding: '0 6px' });
    title.appendChild(resetButton);
    section.appendChild(title);

    for (const field of fieldsForGroup(group)) {
      section.appendChild(this.buildRow(field));
    }
    return section;
  }

  private buildRow(field: TunableField): HTMLElement {
    const spec = specForField(field);
    const row = document.createElement('div');
    row.style.margin = '5px 0';

    const label = document.createElement('div');
    const badge = field.apply === 'live' ? 'live' : 'restart';
    label.innerHTML =
      `<span>${field.label}</span> ` +
      `<span style="opacity:0.5">[${field.min}..${field.max}]</span> ` +
      `<span style="opacity:0.6;font-size:10px">(${badge})</span>`;
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(SLIDER_RESOLUTION);
    input.step = '1';
    input.style.width = '210px';
    input.style.verticalAlign = 'middle';

    const valueLabel = document.createElement('span');
    Object.assign(valueLabel.style, { marginLeft: '8px', minWidth: '54px', display: 'inline-block' });

    input.addEventListener('input', () => {
      const value = sliderToValue(Number(input.value) / SLIDER_RESOLUTION, spec);
      setTuning(field.group, field.key, value);
      valueLabel.textContent = formatValue(value);
    });

    row.appendChild(input);
    row.appendChild(valueLabel);
    this.rows.push({ field, input, valueLabel });
    return row;
  }

  private makeButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    Object.assign(button.style, {
      cursor: 'pointer',
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

  /** Pull every slider + value label back from the live TuningConstants values. */
  private syncFromTuning(): void {
    for (const row of this.rows) {
      const value = getTuning(row.field.group, row.field.key);
      row.input.value = String(Math.round(valueToSlider(value, specForField(row.field)) * SLIDER_RESOLUTION));
      row.valueLabel.textContent = formatValue(value);
    }
  }
}

/** Attach a tuning panel to a scene (dev-only entry; wiring deferred). */
export function attach(scene: Phaser.Scene, options?: TuningPanelOptions): TuningPanel {
  return new TuningPanel(scene, options).attach();
}

/** Exposed so the panel and callers agree on the tunable set. */
export { TUNABLE_FIELDS };

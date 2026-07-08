/**
 * layout.ts — the ONE dynamic source of the play surface geometry (research
 * 08_mobile_quality §1/§2.3). Replaces the two duplicated 390×844 constants
 * (old main.ts DESIGN_WIDTH/HEIGHT + theme.ts `screen`) with a live object that
 * reflects the real device.
 *
 * Rendering model (Phaser 4 has NO DPR handling — research §2):
 * - The canvas backing store is sized in DEVICE pixels (Scale.NONE, width/height
 *   = cssSize × DPR, zoom = 1/DPR). So GAME pixels == DEVICE pixels.
 * - `width` / `height` are that live game-pixel size — use them for centring,
 *   edge anchoring and full-bleed backgrounds.
 * - `ui(n)` converts a 390-design unit to game px: n × designScale × dpr, so the
 *   390-design vocabulary survives on every device AND renders 1:1 crisp.
 * - `safe.*` are the safe-area insets in game px (probe CSS px × dpr).
 *
 * This object is a live singleton: `updateLayout()` mutates it on boot and on
 * every resize (main.ts), then a game-wide LAYOUT_EVENT lets scenes re-anchor.
 * Mutation (rather than replacement) keeps the `ui` closure + every `layout`
 * reference valid — it is device state, read fresh, not app model state.
 */

/** 390×844pt design basis (ui_design_brief §1). The single source of truth. */
export const DESIGN = { width: 390, height: 844 } as const;

/** Screen-edge margin token (design px, ui_design_brief §6.0). */
export const DESIGN_MARGIN = 16;

/** Game-wide event scenes subscribe to for re-anchoring after a resize. */
export const LAYOUT_EVENT = 'layout';

/** DPR is capped so a 4x+ display does not quadruple the fill-rate cost (research §2.2). */
const MAX_DPR = 3;
/** uiScale clamp so the 390 vocabulary neither shrinks nor balloons on edge devices. */
const UI_SCALE_MIN = 0.9;
const UI_SCALE_MAX = 1.6;

export interface SafeInsets {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Layout {
  /** Live game-pixel (= device-pixel) canvas width. */
  width: number;
  /** Live game-pixel canvas height. */
  height: number;
  /** Effective devicePixelRatio (capped at MAX_DPR). */
  dpr: number;
  /** clamp(cssWidth / 390, 0.9, 1.6) — how much the 390 vocabulary is scaled in CSS space. */
  designScale: number;
  /** Safe-area insets in game px. */
  safe: SafeInsets;
  /** Convert a 390-design unit to game px (crisp: n × designScale × dpr). */
  ui(designUnits: number): number;
}

export const layout: Layout = {
  width: DESIGN.width,
  height: DESIGN.height,
  dpr: 1,
  designScale: 1,
  safe: { top: 0, bottom: 0, left: 0, right: 0 },
  ui(designUnits: number): number {
    return designUnits * this.designScale * this.dpr;
  },
};

/**
 * Live alias for the legacy `screen.width/height` contract (BridgeRenderer,
 * StrokeRenderer read it for DPR-proportional world line widths). Because it is
 * the SAME object, `screen.width` always reads the current game-pixel size.
 */
export const screen: { readonly width: number; readonly height: number } = layout;

/** Recompute the live layout from the current game size + probed safe insets. */
export function updateLayout(gameWidth: number, gameHeight: number, dpr: number, cssInsets: SafeInsets): void {
  if (import.meta.env.DEV) {
    // Device-debug handle: CDP sessions read the live layout when diagnosing
    // WebView-only sizing bugs (no production exposure).
    // eslint-disable-next-line @typescript-eslint/naming-convention -- dev-hook global
    (window as unknown as { __layout?: Layout }).__layout = layout;
  }
  layout.width = gameWidth;
  layout.height = gameHeight;
  layout.dpr = dpr;
  const cssWidth = gameWidth / dpr;
  layout.designScale = clamp(cssWidth / DESIGN.width, UI_SCALE_MIN, UI_SCALE_MAX);
  layout.safe = {
    top: cssInsets.top * dpr,
    bottom: cssInsets.bottom * dpr,
    left: cssInsets.left * dpr,
    right: cssInsets.right * dpr,
  };
}

/** devicePixelRatio capped at MAX_DPR (research §2.2). */
export function effectiveDpr(): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(raw, MAX_DPR);
}

/**
 * Read the safe-area insets from the hidden CSS probe (research §1.3). env()
 * cannot be read directly from JS, so index.html paints them onto a probe
 * element's padding and we read the resolved computed values (CSS px).
 */
export function readSafeAreaInsets(): SafeInsets {
  if (typeof document === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const el = document.getElementById('safe-probe');
  if (el === null) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

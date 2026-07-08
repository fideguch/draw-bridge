/**
 * theme.ts — design tokens from ui_design_brief.md Section 2/3 as typed constants
 * (T069-T072, NFR-010: no magic numbers scattered in scenes).
 *
 * Colors are stored Phaser-native (0xRRGGBB numbers) since Graphics fill/stroke
 * take numbers; `toCssColor` derives the '#rrggbb' string a Text style needs, so
 * each color has a single source of truth.
 *
 * DPR-native layout (research 08_mobile_quality §2.3): the canvas backing store
 * is DEVICE pixels, so all UI geometry is expressed as `layout.ui(designUnit)`.
 * `stroke`/`radius` are live getters that ui-scale on read (so world + UI line
 * widths and corners stay DPR-crisp with zero per-call-site scaling), and
 * `makeTextStyle` ui-scales the font size. Positions/extents come from the live
 * `layout` (re-exported here) — see src/render/ui/layout.ts.
 */

import Phaser from 'phaser';
import { layout } from './layout';

export {
  layout,
  screen,
  DESIGN,
  DESIGN_MARGIN as margin,
  LAYOUT_EVENT,
} from './layout';
export type { SafeInsets } from './layout';

/** Color palette (ui_design_brief §3.1). Phaser-native 0xRRGGBB. */
export const color = {
  // world
  sky: 0xa8e4ff,
  cloud: 0xffffff,
  terrainFill: 0xa06a3f,
  terrainGrass: 0x6bd24b,
  terrainStroke: 0x4a2e17,
  inkLine: 0xf8f5ec,
  inkBorder: 0x2b2440,
  stressMid: 0xffb300,
  stressHigh: 0xff3b30,
  goalFlag: 0xff4f9a,
  carBody: 0xff7a1a,
  coin: 0xffe14d,
  coinStroke: 0x8c6d1f,
  star: 0xffe14d,
  starEmpty: 0xc9c6d9,
  // ui
  uiPrimary: 0x21c46b,
  uiPrimaryShadow: 0x178c4b,
  uiDanger: 0xff3b30,
  uiDangerShadow: 0xb32820,
  uiDisabled: 0xc9c6d9,
  uiDisabledShadow: 0x9d9ab0,
  uiSurface: 0xffffff,
  textPrimary: 0x1e1b33,
  textSecondary: 0x6e6a8a,
  textInverse: 0xffffff,
} as const;

/** Sky color as a '#rrggbb' string (index.html / camera background — no dark flash). */
export const skyCssColor = '#a8e4ff';

/** Modal / result scrim — rgba(20,18,43,0.6) (ui_design_brief §3.1 colorUiSurfaceDim). */
export const scrim = { color: 0x14122b, alpha: 0.6 } as const;

/** Spacing (4pt grid, ui_design_brief §3.3). Design px — scale through layout.ui(). */
export const space = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space6: 24,
  space8: 32,
  space12: 48,
} as const;

/** Radius (ui_design_brief §3.4), live getters → game px (DPR-crisp corners). */
const RADIUS_DESIGN = { s: 8, m: 12, l: 20, full: 999 } as const;
export const radius = {
  get s(): number {
    return layout.ui(RADIUS_DESIGN.s);
  },
  get m(): number {
    return layout.ui(RADIUS_DESIGN.m);
  },
  get l(): number {
    return layout.ui(RADIUS_DESIGN.l);
  },
  get full(): number {
    return layout.ui(RADIUS_DESIGN.full);
  },
};

/** Stroke widths (ui_design_brief §3.4), live getters → game px (DPR-crisp lines). */
const STROKE_DESIGN = { game: 3, ui: 2 } as const;
export const stroke = {
  get game(): number {
    return layout.ui(STROKE_DESIGN.game);
  },
  get ui(): number {
    return layout.ui(STROKE_DESIGN.ui);
  },
};

/** Button hard-shadow offset (design px, ui_design_brief §3.4 shadowButton). */
export const shadowOffsetY = 4;

/** Minimum touch target (design px, ui_design_brief §4, WCAG). */
export const minTouchTarget = 44;

export interface TypeToken {
  readonly size: number;
  readonly bold: boolean;
}

/** Typography scale (ui_design_brief §3.2). Sizes are design px (ui-scaled in makeTextStyle). */
export const type = {
  display: { size: 40, bold: true },
  h1: { size: 28, bold: true },
  h2: { size: 22, bold: true },
  button: { size: 18, bold: true },
  hudNumeral: { size: 18, bold: true },
  body: { size: 16, bold: false },
  caption: { size: 13, bold: false },
} as const satisfies Record<string, TypeToken>;

/**
 * Rounded-gothic stack, ordered for CJK roundness (ui_design_brief §3.2, research
 * §5). No CDN/bundled webfont (NFR-012 / ≤300 KB budget not spent), so we lean on
 * the platform rounded faces: "Hiragino Maru Gothic ProN" ships on iOS and is the
 * free rounded Japanese face (research §5 "iOS = free rounded Japanese"); "M PLUS
 * Rounded 1c" / "Hiragino Sans" cover other platforms, then the system fallbacks.
 * BootScene awaits document.fonts.ready before routing to Home so the first text
 * bakes at settled metrics (no FOUT shift).
 */
export const fontFamily =
  '"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic UI", -apple-system, system-ui, sans-serif';

/** App metadata shown on the settings screen (SC-008). */
export const appInfo = {
  version: '1.0.0',
  title: 'InkBridge（仮）',
  credits: 'InkBridge（仮）\n企画・開発: InkBridge Team',
} as const;

/** 0xRRGGBB → '#rrggbb' for Phaser Text color strings. */
export function toCssColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/**
 * Build a Phaser Text style from a type token + color (keeps scenes declarative).
 * The font size is ui-scaled to game px so glyphs bake at the device resolution
 * and render 1:1 crisp (research §4.1 — Text.resolution left at the default 1).
 */
export function makeTextStyle(
  token: TypeToken,
  colorValue: number,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily,
    fontSize: `${Math.round(layout.ui(token.size))}px`,
    fontStyle: token.bold ? 'bold' : 'normal',
    color: toCssColor(colorValue),
    ...extra,
  };
}

/**
 * renderColors — stress/ink colour mapping shared by the stroke + bridge
 * renderers (T046/T047). Pure (imports only the theme tokens + tuning), so it
 * stays headless and keeps every colour decision in one place (NFR-010).
 *
 * Stress tint (ui_design_brief §3.1 / game_design §8.1): below creakBandMin the
 * line is base ink; then a two-segment linear ramp
 *   colorInkLine (0.6) -> colorStressMid (0.8) -> colorStressHigh (1.0).
 *
 * Ink zone tint (FR-002): the live stroke shifts colour with remaining ink —
 * ok = ink line, low = yellow, critical = red — matching InkBudget.zone and the
 * ink bar so the two read as the same resource.
 */

import type { InkZone } from '@engine/rules/InkBudget';
import { color } from '@render/ui/theme';
import { bridge, ink } from '@tuning/TuningConstants';

/** Linear blend of two 0xRRGGBB colours (t in [0, 1]). */
export function lerpColor(from: number, to: number, t: number): number {
  const clampT = Math.min(Math.max(t, 0), 1);
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;
  const r = Math.round(fromR + (toR - fromR) * clampT);
  const g = Math.round(fromG + (toG - fromG) * clampT);
  const b = Math.round(fromB + (toB - fromB) * clampT);
  return (r << 16) | (g << 8) | b;
}

/**
 * Stress (0..1) -> tint. Base ink below creakBandMin, then ink->mid across
 * [creakBandMin, 0.8] and mid->high across [0.8, 1.0].
 */
export function stressColor(stress: number): number {
  const low = bridge.creakBandMin;
  const mid = 0.8; // ui_design_brief §3.1: colorStressMid is the stress-0.8 interpolant
  if (stress <= low) {
    return color.inkLine;
  }
  if (stress <= mid) {
    return lerpColor(color.inkLine, color.stressMid, (stress - low) / (mid - low));
  }
  return lerpColor(color.stressMid, color.stressHigh, Math.min((stress - mid) / (1 - mid), 1));
}

/** Ink zone from remaining ratio (mirrors InkBudget.zone boundaries). */
export function inkZoneOf(ratio: number): InkZone {
  if (ratio > ink.warnYellowRatio) {
    return 'ok';
  }
  return ratio >= ink.warnRedRatio ? 'low' : 'critical';
}

/** Ink zone -> stroke colour (ok = ink line, low = yellow, critical = red). */
export function inkZoneColor(zone: InkZone): number {
  switch (zone) {
    case 'ok':
      return color.inkLine;
    case 'low':
      return color.stressMid;
    case 'critical':
      return color.stressHigh;
  }
}

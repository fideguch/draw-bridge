/**
 * audioMath — pure conversions shared by the audio foundation (T055).
 * No side effects, no Web Audio dependency: trivially unit-testable.
 */

import { coin } from '@tuning/TuningConstants';

/**
 * Decibel → linear amplitude gain (gain = 10^(dB/20)).
 * Used by BGM ducking: audio.bgmDuckDb (-7.5 dB) → ~0.42 linear.
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Semitone offset → playbackRate multiplier.
 * One semitone = coin.semitoneRatio (×1.0595) per game_design §4.2 (the coin
 * pitch ladder); kept as the single source so the ladder and any other
 * pitch-shifted SFX agree.
 */
export function semitonesToRate(semitones: number, ratio: number = coin.semitoneRatio): number {
  return Math.pow(ratio, semitones);
}

/** Clamp helper (avoids a magic-laden inline min/max chain). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

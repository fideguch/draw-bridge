/**
 * audioMath — pure conversions shared by the audio foundation (T055).
 * No side effects, no Web Audio dependency: trivially unit-testable.
 */

import { coin, draw, engine } from '@tuning/TuningConstants';

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

/** Linear playbackRate multiplier → semitone offset (inverse of semitonesToRate). */
export function rateToSemitones(rate: number, ratio: number = coin.semitoneRatio): number {
  return Math.log(Math.max(rate, 1e-6)) / Math.log(ratio);
}

export interface ToneModulation {
  /** Per-voice volume in [0,1]. */
  readonly volume: number;
  /** Pitch offset in semitones (fed to SfxPlayer.play). */
  readonly pitchSemitones: number;
}

/**
 * Draw-loop scrub mapping (game_design §4.1 1-4): draw speed [0,1] →
 * volume draw.loopVolumeMin..Max and pitch draw.loopPitchMin..Max (converted to
 * semitones). Pure so the mapping unit-tests headless.
 */
export function drawScrubModulation(speed01: number): ToneModulation {
  const s = clamp(speed01, 0, 1);
  const rate = draw.loopPitchMin + (draw.loopPitchMax - draw.loopPitchMin) * s;
  return {
    volume: draw.loopVolumeMin + (draw.loopVolumeMax - draw.loopVolumeMin) * s,
    pitchSemitones: rateToSemitones(rate),
  };
}

/**
 * Engine-hum mapping (game_design §4.2 2-5): speed ratio [0,1] → a pitch that
 * rises 1.0→engine.pitchMax quantised to engine.gearStep "gear" bands, and a
 * volume that grows with speed. Pure (gear quantisation is the testable part).
 */
export function engineHumModulation(speedRatio01: number): ToneModulation {
  const s = clamp(speedRatio01, 0, 1);
  const rawRate = 1 + (engine.pitchMax - 1) * s;
  // Snap the rate to gear-step bands above the 1.0 base (0.25-step "gears").
  const stepped = 1 + Math.round((rawRate - 1) / engine.gearStep) * engine.gearStep;
  return {
    volume: 0.25 + 0.35 * s,
    pitchSemitones: rateToSemitones(stepped),
  };
}

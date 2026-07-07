/**
 * SfxSynth — procedural SFX generation (T055, NFR-013 program-first).
 *
 * There are NO audio asset files in this project. Every sound effect is
 * synthesised into an `AudioBufferLike` at startup from oscillators + noise +
 * envelopes. Quality here is intentionally placeholder-grade: what matters is
 * that the STRUCTURE (one buffer per game moment, keyed, ≤0.5 s except the
 * loopable draw sound) is in place so juice wiring (T057+) has something to
 * play. Real sound design iterates later by tuning the exposed `params` — the
 * synthesis math stays; only the numbers move.
 *
 * Each generator takes an AudioContextLike (real or fake) so it renders into a
 * buffer the context owns, and returns that buffer. Deterministic-noise is not
 * required (buffers are not asserted sample-by-sample), so Math.random seeds the
 * noise; envelope/oscillator shape is what carries the character.
 */

import { draw } from '@tuning/TuningConstants';
import type { AudioBufferLike, AudioContextLike } from './WebAudioTypes';

/** Stable keys for the synthesised library (SfxPlayer plays by key). */
export const SFX = {
  drawLoop: 'drawLoop',
  commitPop: 'commitPop',
  launchBurst: 'launchBurst',
  creak: 'creak',
  crack: 'crack',
  coinChime: 'coinChime',
  starC: 'starC',
  starE: 'starE',
  starG: 'starG',
  countTick: 'countTick',
  sadFail: 'sadFail',
  confettiPop: 'confettiPop',
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];

const TWO_PI = Math.PI * 2;

/** Equal-tempered concert pitches (Hz) for the goal star arpeggio (C-E-G). */
const NOTE_HZ = { c5: 523.25, e5: 659.25, g5: 783.99 } as const;

interface MonoBuffer {
  readonly buffer: AudioBufferLike;
  readonly data: Float32Array;
  readonly sampleRate: number;
}

function createMono(ctx: AudioContextLike, durationSec: number): MonoBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(durationSec * sampleRate));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  return { buffer, data: buffer.getChannelData(0), sampleRate };
}

/**
 * Linear attack/release envelope in [0, 1] for time `t` within `duration`.
 * Keeps clicks out of the buffer edges (a raw start/stop pops).
 */
function attackRelease(t: number, duration: number, attackSec: number, releaseSec: number): number {
  if (t < attackSec) {
    return attackSec <= 0 ? 1 : t / attackSec;
  }
  const releaseStart = duration - releaseSec;
  if (t > releaseStart) {
    return releaseSec <= 0 ? 1 : Math.max(0, (duration - t) / releaseSec);
  }
  return 1;
}

/** White noise in [-1, 1]. */
function noise(): number {
  return Math.random() * 2 - 1;
}

// ── Generators ──────────────────────────────────────────────────────────────

export interface ToneParams {
  readonly durationSec?: number;
  readonly freqHz?: number;
  readonly amplitude?: number;
}

/** Draw loop — filtered (one-pole low-pass) noise, loopable pen/marker hiss. */
export function drawLoop(
  ctx: AudioContextLike,
  params: { readonly durationSec?: number; readonly cutoff?: number; readonly amplitude?: number } = {},
): AudioBufferLike {
  const duration = params.durationSec ?? 0.4;
  const cutoff = params.cutoff ?? 0.15; // one-pole coefficient (0..1)
  const amplitude = params.amplitude ?? 0.35;
  const { buffer, data } = createMono(ctx, duration);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last += cutoff * (noise() - last);
    data[i] = last * amplitude;
  }
  return buffer;
}

/** Commit pop — short "コトッ" click (line solidifies). */
export function commitPop(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.09;
  const freq = params.freqHz ?? 240;
  const amplitude = params.amplitude ?? 0.6;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.004, duration - 0.004);
    data[i] = Math.sin(TWO_PI * freq * t) * env * amplitude;
  }
  return buffer;
}

/** Launch burst — bass-weighted "発進" thump (Vlambeer: add bass). */
export function launchBurst(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.22;
  const freq = params.freqHz ?? 90;
  const amplitude = params.amplitude ?? 0.8;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.006, duration - 0.02);
    const body = Math.sin(TWO_PI * freq * t);
    const grit = noise() * 0.15 * env;
    data[i] = (body * env + grit) * amplitude;
  }
  return buffer;
}

/** Creak — pitched noise (bridge under stress). */
export function creak(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.18;
  const freq = params.freqHz ?? 180;
  const amplitude = params.amplitude ?? 0.4;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.02, 0.06);
    last += 0.3 * (noise() - last);
    const tone = Math.sin(TWO_PI * freq * t);
    data[i] = (tone * 0.5 + last * 0.5) * env * amplitude;
  }
  return buffer;
}

/** Crack — snap when a joint breaks. */
export function crack(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.12;
  const amplitude = params.amplitude ?? 0.7;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.001, duration - 0.002);
    data[i] = noise() * env * env * amplitude;
  }
  return buffer;
}

/** Coin chime — sine fundamental + one bright harmonic, bell-like decay. */
export function coinChime(
  ctx: AudioContextLike,
  params: { readonly durationSec?: number; readonly freqHz?: number; readonly amplitude?: number } = {},
): AudioBufferLike {
  const duration = params.durationSec ?? 0.18;
  const freq = params.freqHz ?? 880;
  const amplitude = params.amplitude ?? 0.5;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 18); // fast exponential decay
    const fundamental = Math.sin(TWO_PI * freq * t);
    const harmonic = Math.sin(TWO_PI * freq * 2 * t) * 0.4;
    data[i] = (fundamental + harmonic) * env * amplitude;
  }
  return buffer;
}

/** One goal-star arpeggio note (0 → C, 1 → E, 2 → G). */
export function starNote(ctx: AudioContextLike, note: number, params: ToneParams = {}): AudioBufferLike {
  const freqs = [NOTE_HZ.c5, NOTE_HZ.e5, NOTE_HZ.g5];
  const freq = params.freqHz ?? freqs[Math.min(Math.max(note, 0), freqs.length - 1)] ?? NOTE_HZ.c5;
  const duration = params.durationSec ?? 0.26;
  const amplitude = params.amplitude ?? 0.5;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.01, 0.12);
    const tone = Math.sin(TWO_PI * freq * t) + Math.sin(TWO_PI * freq * 2 * t) * 0.25;
    data[i] = tone * env * amplitude;
  }
  return buffer;
}

/** Count-up tick — very short click for the reward tally. */
export function countTick(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.03;
  const freq = params.freqHz ?? 1200;
  const amplitude = params.amplitude ?? 0.4;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 120);
    data[i] = Math.sin(TWO_PI * freq * t) * env * amplitude;
  }
  return buffer;
}

/** Sad fail — short descending "残念" tone (failure is lightest-weight, BR-007). */
export function sadFail(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.4;
  const startFreq = params.freqHz ?? 320;
  const amplitude = params.amplitude ?? 0.4;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = attackRelease(t, duration, 0.02, 0.2);
    const freq = startFreq * (1 - 0.4 * (t / duration)); // glide down
    data[i] = Math.sin(TWO_PI * freq * t) * env * amplitude;
  }
  return buffer;
}

/** Confetti pop — bright short "ポンッ". */
export function confettiPop(ctx: AudioContextLike, params: ToneParams = {}): AudioBufferLike {
  const duration = params.durationSec ?? 0.1;
  const freq = params.freqHz ?? 660;
  const amplitude = params.amplitude ?? 0.5;
  const { buffer, data, sampleRate } = createMono(ctx, duration);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 40);
    const tone = Math.sin(TWO_PI * freq * t);
    data[i] = (tone * 0.7 + noise() * 0.3) * env * amplitude;
  }
  return buffer;
}

/**
 * Build the full SFX library once (call at scene start after the context is
 * resumable). `loopFadeMs`/draw-loop params reference TuningConstants where a
 * canonical value exists; the rest are provisional placeholder tunings.
 */
export function buildSfxLibrary(ctx: AudioContextLike): Map<SfxKey, AudioBufferLike> {
  // draw.loopFadeMs is applied at playback (fade in/out), not baked into the
  // buffer; referenced here to keep the loop's tuning discoverable.
  void draw.loopFadeMs;
  return new Map<SfxKey, AudioBufferLike>([
    [SFX.drawLoop, drawLoop(ctx)],
    [SFX.commitPop, commitPop(ctx)],
    [SFX.launchBurst, launchBurst(ctx)],
    [SFX.creak, creak(ctx)],
    [SFX.crack, crack(ctx)],
    [SFX.coinChime, coinChime(ctx)],
    [SFX.starC, starNote(ctx, 0)],
    [SFX.starE, starNote(ctx, 1)],
    [SFX.starG, starNote(ctx, 2)],
    [SFX.countTick, countTick(ctx)],
    [SFX.sadFail, sadFail(ctx)],
    [SFX.confettiPop, confettiPop(ctx)],
  ]);
}

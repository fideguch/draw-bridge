/**
 * SfxPlayer — plays synthesised SFX buffers through the AudioBus (T055).
 *
 * Features (game_design §4.1, §4.2; NFR-014 / §4.4 X-4):
 * - Per-play ±draw.pitchRandomPct (±5%) base-pitch randomization so repeated
 *   SFX never sound machine-gunned. RNG is injectable for deterministic tests.
 * - Coin pitch ladder: each rapid pickup climbs +1 semitone (×coin.semitoneRatio
 *   playbackRate), capped at coin.semitoneMax (+12), reset after a
 *   coin.comboResetSec (1.25 s) gap. Clock is injectable for deterministic tests.
 * - Voice capping is delegated to AudioBus.acquireVoice (≤3 per key).
 *
 * The player owns no browser assumptions: buffers come pre-built from SfxSynth
 * and the AudioContext comes from the bus.
 */

import { coin, draw } from '@tuning/TuningConstants';
import type { AudioBus } from './AudioBus';
import { clamp, semitonesToRate } from './audioMath';
import type { AudioBufferLike, AudioBufferSourceNodeLike, Clock, RandomSource } from './WebAudioTypes';

export interface SfxPlayerOptions {
  /** RNG in [0, 1). Defaults to Math.random. Inject for deterministic tests. */
  readonly random?: RandomSource;
  /** Clock in seconds (monotonic). Defaults to performance-like Date.now()/1000. */
  readonly now?: Clock;
  /** ±percent base-pitch randomization. Defaults to draw.pitchRandomPct. */
  readonly pitchRandomPct?: number;
}

export interface PlayOptions {
  /** Additional pitch offset in semitones (e.g. the coin ladder step). */
  readonly pitchSemitones?: number;
  /** Per-voice volume in [0, 1]. Defaults to 1. */
  readonly volume?: number;
  /** Loop the buffer (draw loop). Defaults to false. */
  readonly loop?: boolean;
}

export class SfxPlayer {
  private readonly bus: AudioBus;
  private readonly buffers: ReadonlyMap<string, AudioBufferLike>;
  private readonly random: RandomSource;
  private readonly now: Clock;
  private readonly pitchRandomPct: number;

  private coinLadderStep = 0;
  private lastCoinTime = Number.NEGATIVE_INFINITY;

  constructor(
    bus: AudioBus,
    buffers: ReadonlyMap<string, AudioBufferLike>,
    options: SfxPlayerOptions = {},
  ) {
    this.bus = bus;
    this.buffers = buffers;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? ((): number => Date.now() / 1000);
    this.pitchRandomPct = options.pitchRandomPct ?? draw.pitchRandomPct;
  }

  /**
   * Play a synthesised SFX by key. Returns the created source (undefined if the
   * key is unknown). Applies ±pitchRandomPct base randomization multiplied by
   * any `pitchSemitones` offset.
   */
  play(key: string, options: PlayOptions = {}): AudioBufferSourceNodeLike | undefined {
    const buffer = this.buffers.get(key);
    if (buffer === undefined) {
      return undefined;
    }
    const ctx = this.bus.context;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = this.rollPitch(options.pitchSemitones ?? 0);

    const volumeGain = ctx.createGain();
    volumeGain.gain.value = clamp(options.volume ?? 1, 0, 1);
    source.connect(volumeGain);
    volumeGain.connect(this.bus.sfxDestination);

    this.bus.acquireVoice(key, source);
    source.start();
    return source;
  }

  /**
   * Advance the coin pitch ladder and return the current step in semitones.
   * Fresh ladder (first ever, or a gap > coin.comboResetSec) → 0 (base pitch);
   * each rapid subsequent call → +1 semitone up to coin.semitoneMax.
   *
   * Call this once per collected coin, then pass the result to
   * `play(coinKey, { pitchSemitones })`.
   */
  nextCoinPitch(): number {
    const t = this.now();
    const gap = t - this.lastCoinTime;
    if (gap > coin.comboResetSec) {
      this.coinLadderStep = 0;
    } else {
      this.coinLadderStep = Math.min(this.coinLadderStep + 1, coin.semitoneMax);
    }
    this.lastCoinTime = t;
    return this.coinLadderStep;
  }

  /** Current ladder step without advancing it (diagnostics/tests). */
  get coinPitchStep(): number {
    return this.coinLadderStep;
  }

  private rollPitch(semitones: number): number {
    const spread = this.pitchRandomPct / 100;
    const jitter = 1 + (this.random() * 2 - 1) * spread;
    return jitter * semitonesToRate(semitones);
  }
}

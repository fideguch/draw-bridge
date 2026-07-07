/**
 * AudioBus — thin adapter over Web Audio (T055).
 *
 * Responsibilities (game_design §4, §8.5; NFR-014):
 * - Owns the master → {sfx, bgm} gain graph, wired to the context destination.
 * - First-user-gesture resume(): browsers start the context 'suspended'; the
 *   first pointer gesture must resume() it exactly once.
 * - BGM ducking: duck()/unduck() ramp the BGM bus so the goal SFX cut through
 *   (audio.bgmDuckDb -7.5 dB over audio.bgmDuckAttackSec 0.2 s).
 * - Per-SFX-type voice cap: ≤ audio.maxSameSfxVoices (3) simultaneous sources
 *   per key; a new voice past the cap stops the oldest (NFR-014 / §4.4 X-4).
 *
 * Phaser is intentionally NOT referenced: pass `() => new AudioContext()` (or
 * Phaser.Sound's context) as the factory in real code, or a FakeAudioContext in
 * tests. The bus never assumes a browser.
 */

import { audio } from '@tuning/TuningConstants';
import { dbToGain } from './audioMath';
import type {
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from './WebAudioTypes';

export interface AudioBusOptions {
  /** Max simultaneous voices per SFX key. Defaults to audio.maxSameSfxVoices. */
  readonly maxVoicesPerKey?: number;
}

export class AudioBus {
  private readonly ctx: AudioContextLike;
  private readonly master: GainNodeLike;
  private readonly sfx: GainNodeLike;
  private readonly bgm: GainNodeLike;
  private readonly maxVoicesPerKey: number;
  private readonly voices = new Map<string, AudioBufferSourceNodeLike[]>();
  private hasResumed = false;

  constructor(contextFactory: () => AudioContextLike, options: AudioBusOptions = {}) {
    this.ctx = contextFactory();
    this.maxVoicesPerKey = Math.max(1, Math.floor(options.maxVoicesPerKey ?? audio.maxSameSfxVoices));

    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.bgm = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx.connect(this.master);
    this.bgm.connect(this.master);
  }

  get context(): AudioContextLike {
    return this.ctx;
  }

  /** SFX sources connect here (post per-voice volume gain). */
  get sfxDestination(): GainNodeLike {
    return this.sfx;
  }

  /** BGM source connects here; ducking automates this node's gain. */
  get bgmDestination(): GainNodeLike {
    return this.bgm;
  }

  get masterGain(): GainNodeLike {
    return this.master;
  }

  /** Whether resume() has already run (first-gesture unlock is idempotent). */
  get isResumed(): boolean {
    return this.hasResumed;
  }

  /**
   * Resume the context on the first user gesture. Idempotent: only the first
   * call reaches the underlying context (browsers require a gesture to unlock
   * audio; calling once is enough). Failures are swallowed — audio never blocks
   * gameplay.
   */
  resume(): void {
    if (this.hasResumed) {
      return;
    }
    this.hasResumed = true;
    void Promise.resolve(this.ctx.resume()).catch(() => {
      // resume() can reject if invoked outside a gesture; ignore — the next
      // real gesture path (Phaser input) will have unlocked it anyway.
    });
  }

  /**
   * Duck the BGM bus (attenuate) so foreground SFX stand out.
   * @param db Attenuation in decibels (negative). Defaults to audio.bgmDuckDb.
   * @param attackSec Ramp time. Defaults to audio.bgmDuckAttackSec.
   */
  duck(db: number = audio.bgmDuckDb, attackSec: number = audio.bgmDuckAttackSec): void {
    this.rampBgm(dbToGain(db), attackSec);
  }

  /** Restore the BGM bus to unity gain over `releaseSec`. */
  unduck(releaseSec: number = audio.bgmDuckAttackSec): void {
    this.rampBgm(1, releaseSec);
  }

  private rampBgm(target: number, seconds: number): void {
    const now = this.ctx.currentTime;
    const gain = this.bgm.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + Math.max(0, seconds));
  }

  /**
   * Register a freshly created SFX source under `key`, enforcing the per-key
   * voice cap. If the cap is already reached, the oldest voice is stopped and
   * dropped before the new one is tracked. Sources self-remove on `onended`.
   */
  acquireVoice(key: string, source: AudioBufferSourceNodeLike): void {
    const list = this.voices.get(key) ?? [];
    while (list.length >= this.maxVoicesPerKey) {
      const oldest = list.shift();
      oldest?.stop();
    }
    list.push(source);
    this.voices.set(key, list);
    source.onended = (): void => {
      const current = this.voices.get(key);
      if (current === undefined) {
        return;
      }
      const index = current.indexOf(source);
      if (index !== -1) {
        current.splice(index, 1);
      }
    };
  }

  /** Live voice count for a key (diagnostics/tests). */
  activeVoiceCount(key: string): number {
    return this.voices.get(key)?.length ?? 0;
  }
}

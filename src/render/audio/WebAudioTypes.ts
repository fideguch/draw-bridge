/**
 * WebAudioTypes — the minimal structural subset of the Web Audio API that the
 * audio foundation actually touches (T055).
 *
 * Why a hand-written subset instead of lib.dom's `AudioContext`:
 * - The engine/render split forbids a hard Phaser or browser dependency here so
 *   the audio graph is unit-testable in the Node test environment (vitest
 *   `environment: 'node'`) with a hand-rolled fake — no jsdom, no headless
 *   Chrome. A real `AudioContext` (raw, or Phaser.Sound's) satisfies these
 *   interfaces at the call site; tests satisfy them with a FakeAudioContext.
 * - Only the members we use are declared. Real nodes carry a superset, so they
 *   remain assignable where we accept these types.
 *
 * NFR-013 (program-first, no audio asset files) drives the buffer-synthesis
 * path: SFX are procedurally rendered into `AudioBufferLike`s at startup.
 */

/** Subset of AudioParam used for gain/pitch automation. */
export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  cancelScheduledValues(startTime: number): void;
}

/** Any node that can be a connection target. */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

/** Rendered SFX payload — one or more channels of PCM samples. */
export interface AudioBufferLike {
  readonly length: number;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  readonly playbackRate: AudioParamLike;
  loop: boolean;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  /** 'suspended' until the first user gesture resumes the context. */
  readonly state: string;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike;
  createOscillator(): OscillatorNodeLike;
  resume(): Promise<void>;
}

/** Deterministic seams (injected for test determinism). */
export type RandomSource = () => number;
export type Clock = () => number;

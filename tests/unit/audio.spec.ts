import { describe, expect, it } from 'vitest';
import { AudioBus } from '@render/audio/AudioBus';
import { SfxPlayer } from '@render/audio/SfxPlayer';
import type { SfxPlayerOptions } from '@render/audio/SfxPlayer';
import { buildSfxLibrary, SFX } from '@render/audio/SfxSynth';
import { dbToGain, semitonesToRate } from '@render/audio/audioMath';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
} from '@render/audio/WebAudioTypes';
import { audio, coin, draw } from '@tuning/TuningConstants';

/**
 * T055 — audio foundation (AudioBus / SfxPlayer / SfxSynth).
 *
 * The whole graph runs against a FakeAudioContext (no jsdom / no browser): the
 * fake records createGain/createBufferSource/createBuffer/createOscillator and
 * exposes the gain/pitch AudioParam call logs so ducking automation, the voice
 * cap, pitch randomization, the coin ladder, and first-gesture resume are all
 * unit-verifiable.
 */

// ── Fakes ─────────────────────────────────────────────────────────────────────

interface ParamCall {
  readonly method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'cancelScheduledValues';
  readonly value: number;
  readonly time: number;
}

class FakeAudioParam implements AudioParamLike {
  value: number;
  readonly calls: ParamCall[] = [];
  constructor(initial = 1) {
    this.value = initial;
  }
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ method: 'setValueAtTime', value, time });
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ method: 'linearRampToValueAtTime', value, time });
  }
  cancelScheduledValues(time: number): void {
    this.calls.push({ method: 'cancelScheduledValues', value: Number.NaN, time });
  }
}

class FakeGainNode implements GainNodeLike {
  readonly gain = new FakeAudioParam(1);
  readonly connectedTo: AudioNodeLike[] = [];
  connect(destination: AudioNodeLike): void {
    this.connectedTo.push(destination);
  }
}

class FakeBufferSource implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  readonly playbackRate = new FakeAudioParam(1);
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  readonly connectedTo: AudioNodeLike[] = [];
  connect(destination: AudioNodeLike): void {
    this.connectedTo.push(destination);
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}

class FakeOscillator implements OscillatorNodeLike {
  type = 'sine';
  readonly frequency = new FakeAudioParam(440);
  readonly connectedTo: AudioNodeLike[] = [];
  connect(destination: AudioNodeLike): void {
    this.connectedTo.push(destination);
  }
  start(): void {
    /* recorded via createOscillator count only */
  }
  stop(): void {
    /* no-op */
  }
}

class FakeAudioBuffer implements AudioBufferLike {
  readonly length: number;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  private readonly channels: Float32Array[];
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channel: number): Float32Array {
    return this.channels[channel] ?? new Float32Array(this.length);
  }
}

class FakeAudioContext implements AudioContextLike {
  currentTime = 0;
  sampleRate = 48000;
  state = 'suspended';
  readonly destination: AudioNodeLike = new FakeGainNode();
  resumeCalls = 0;
  oscillatorCalls = 0;
  bufferCalls = 0;
  createGain(): GainNodeLike {
    return new FakeGainNode();
  }
  createBufferSource(): AudioBufferSourceNodeLike {
    return new FakeBufferSource();
  }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike {
    this.bufferCalls += 1;
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }
  createOscillator(): OscillatorNodeLike {
    this.oscillatorCalls += 1;
    return new FakeOscillator();
  }
  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

// ── AudioBus ──────────────────────────────────────────────────────────────────

describe('AudioBus — graph + first-gesture resume', () => {
  it('wires master → destination and sfx/bgm → master at construction', () => {
    const ctx = new FakeAudioContext();
    const bus = new AudioBus(() => ctx);
    expect((bus.masterGain as FakeGainNode).connectedTo).toContain(ctx.destination);
    expect((bus.sfxDestination as FakeGainNode).connectedTo).toContain(bus.masterGain);
    expect((bus.bgmDestination as FakeGainNode).connectedTo).toContain(bus.masterGain);
  });

  it('resumes the context exactly once across repeated gestures', () => {
    const ctx = new FakeAudioContext();
    const bus = new AudioBus(() => ctx);
    expect(bus.isResumed).toBe(false);
    bus.resume();
    bus.resume();
    bus.resume();
    expect(ctx.resumeCalls).toBe(1);
    expect(bus.isResumed).toBe(true);
  });
});

describe('AudioBus — BGM ducking automation (audio group)', () => {
  it('duck() ramps BGM gain toward audio.bgmDuckDb over the attack window', () => {
    const ctx = new FakeAudioContext();
    ctx.currentTime = 3;
    const bus = new AudioBus(() => ctx);
    bus.duck();
    const gain = bus.bgmDestination.gain as FakeAudioParam;
    const ramp = gain.calls.find((c) => c.method === 'linearRampToValueAtTime');
    expect(gain.calls[0]?.method).toBe('cancelScheduledValues');
    expect(ramp?.value).toBeCloseTo(dbToGain(audio.bgmDuckDb), 5);
    expect(ramp?.time).toBeCloseTo(3 + audio.bgmDuckAttackSec, 5);
    expect(gain.value).toBeCloseTo(dbToGain(audio.bgmDuckDb), 5);
  });

  it('unduck() ramps BGM gain back to unity', () => {
    const ctx = new FakeAudioContext();
    ctx.currentTime = 10;
    const bus = new AudioBus(() => ctx);
    bus.duck();
    bus.unduck(0.3);
    const gain = bus.bgmDestination.gain as FakeAudioParam;
    const lastRamp = gain.calls.filter((c) => c.method === 'linearRampToValueAtTime').at(-1);
    expect(lastRamp?.value).toBeCloseTo(1, 5);
    expect(lastRamp?.time).toBeCloseTo(10 + 0.3, 5);
    expect(gain.value).toBeCloseTo(1, 5);
  });
});

describe('AudioBus — per-key voice cap (NFR-014, ≤ audio.maxSameSfxVoices)', () => {
  it('stops the oldest voice when a new one exceeds the cap', () => {
    const ctx = new FakeAudioContext();
    const bus = new AudioBus(() => ctx);
    const sources = Array.from({ length: audio.maxSameSfxVoices + 1 }, () => new FakeBufferSource());
    for (const source of sources) {
      bus.acquireVoice('commitPop', source);
    }
    expect(sources[0]?.stopped).toBe(true);
    expect(sources.slice(1).every((s) => !s.stopped)).toBe(true);
    expect(bus.activeVoiceCount('commitPop')).toBe(audio.maxSameSfxVoices);
  });

  it('a voice self-removes from the pool on ended', () => {
    const ctx = new FakeAudioContext();
    const bus = new AudioBus(() => ctx);
    const source = new FakeBufferSource();
    bus.acquireVoice('coin', source);
    expect(bus.activeVoiceCount('coin')).toBe(1);
    source.onended?.();
    expect(bus.activeVoiceCount('coin')).toBe(0);
  });

  it('caps independently per key', () => {
    const ctx = new FakeAudioContext();
    const bus = new AudioBus(() => ctx);
    for (let i = 0; i < 5; i++) {
      bus.acquireVoice('a', new FakeBufferSource());
      bus.acquireVoice('b', new FakeBufferSource());
    }
    expect(bus.activeVoiceCount('a')).toBe(audio.maxSameSfxVoices);
    expect(bus.activeVoiceCount('b')).toBe(audio.maxSameSfxVoices);
  });
});

// ── SfxPlayer ───────────────────────────────────────────────────────────────

function makePlayer(
  ctx: FakeAudioContext,
  options: SfxPlayerOptions = {},
): { bus: AudioBus; player: SfxPlayer } {
  const bus = new AudioBus(() => ctx);
  const library = buildSfxLibrary(ctx);
  const player = new SfxPlayer(bus, library, options);
  return { bus, player };
}

describe('SfxPlayer — ±pitchRandomPct base randomization (injected RNG)', () => {
  it('random()=0.5 → no shift (playbackRate 1.0)', () => {
    const ctx = new FakeAudioContext();
    const { player } = makePlayer(ctx, { random: () => 0.5 });
    const source = player.play(SFX.commitPop);
    expect(source?.playbackRate.value).toBeCloseTo(1, 5);
  });

  it('random()=0 → −pitchRandomPct, random()=1 → +pitchRandomPct', () => {
    const spread = draw.pitchRandomPct / 100;
    const low = makePlayer(new FakeAudioContext(), { random: () => 0 }).player.play(SFX.commitPop);
    const high = makePlayer(new FakeAudioContext(), { random: () => 1 }).player.play(SFX.commitPop);
    expect(low?.playbackRate.value).toBeCloseTo(1 - spread, 5);
    expect(high?.playbackRate.value).toBeCloseTo(1 + spread, 5);
  });

  it('applies pitchSemitones on top of the base jitter', () => {
    const ctx = new FakeAudioContext();
    const { player } = makePlayer(ctx, { random: () => 0.5 });
    const source = player.play(SFX.coinChime, { pitchSemitones: 4 });
    expect(source?.playbackRate.value).toBeCloseTo(semitonesToRate(4), 5);
  });

  it('returns undefined for an unknown key and plays a known key', () => {
    const ctx = new FakeAudioContext();
    const { player } = makePlayer(ctx, { random: () => 0.5 });
    expect(player.play('does-not-exist')).toBeUndefined();
    expect((player.play(SFX.launchBurst) as FakeBufferSource | undefined)?.started).toBe(true);
  });
});

describe('SfxPlayer — coin pitch ladder (game_design §4.2)', () => {
  it('climbs +1 semitone per rapid pickup, caps at coin.semitoneMax, resets after the gap', () => {
    let clock = 0;
    const ctx = new FakeAudioContext();
    const { player } = makePlayer(ctx, { now: () => clock });

    expect(player.nextCoinPitch()).toBe(0); // fresh ladder
    clock += 0.1;
    expect(player.nextCoinPitch()).toBe(1);
    clock += 0.1;
    expect(player.nextCoinPitch()).toBe(2);

    // keep climbing rapidly well past the cap
    for (let i = 0; i < 20; i++) {
      clock += 0.1;
      player.nextCoinPitch();
    }
    expect(player.coinPitchStep).toBe(coin.semitoneMax);

    // silence longer than the reset window → back to base
    clock += coin.comboResetSec + 0.01;
    expect(player.nextCoinPitch()).toBe(0);
  });

  it('feeds the ladder step into playbackRate for the coin chime', () => {
    let clock = 0;
    const ctx = new FakeAudioContext();
    const { player } = makePlayer(ctx, { now: () => clock, random: () => 0.5 });
    player.nextCoinPitch(); // 0
    clock += 0.1;
    const step = player.nextCoinPitch(); // 1
    const source = player.play(SFX.coinChime, { pitchSemitones: step });
    expect(source?.playbackRate.value).toBeCloseTo(semitonesToRate(1), 5);
  });
});

describe('SfxSynth — program-first library (NFR-013)', () => {
  it('builds one buffer per keyed moment with no asset files', () => {
    const ctx = new FakeAudioContext();
    const library = buildSfxLibrary(ctx);
    expect(library.size).toBe(Object.keys(SFX).length);
    expect(library.has(SFX.drawLoop)).toBe(true);
    expect(ctx.bufferCalls).toBe(Object.keys(SFX).length);
    for (const buffer of library.values()) {
      expect(buffer.length).toBeGreaterThan(0);
    }
  });
});

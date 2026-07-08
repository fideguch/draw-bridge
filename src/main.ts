import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { EngineEvents } from '@engine/EngineEvents';
import { Economy } from '@meta/Economy';
import { SaveManager } from '@meta/SaveManager';
import { STORAGE_KEY_MAIN } from '@meta/SaveData';
import { WebHaptics, WebStorage } from '@platform/web';
import { CapacitorHaptics, CapacitorStorage } from '@platform/capacitor';
import type { HapticsInterface, StorageInterface } from '@platform/interfaces';
import { AudioBus } from '@render/audio/AudioBus';
import { SfxPlayer } from '@render/audio/SfxPlayer';
import type { PlayOptions } from '@render/audio/SfxPlayer';
import { SFX, buildSfxLibrary } from '@render/audio/SfxSynth';
import type { SfxKey } from '@render/audio/SfxSynth';
import { drawScrubModulation, engineHumModulation, rateToSemitones } from '@render/audio/audioMath';
import type { AudioContextLike } from '@render/audio/WebAudioTypes';
import { HapticsRouter } from '@render/juice/HapticsRouter';
import { launch } from '@tuning/TuningConstants';
import { BootScene } from '@render/scenes/BootScene';
import { HomeScene } from '@render/scenes/HomeScene';
import { LevelSelectScene } from '@render/scenes/LevelSelectScene';
import { PlayScene } from '@render/scenes/PlayScene';
import { SettingsScene } from '@render/scenes/SettingsScene';
import { ShopScene } from '@render/scenes/ShopScene';
import { SERVICES_KEY } from '@render/ui/services';
import type { AttemptJuice, GameServices } from '@render/ui/services';
import { skyCssColor } from '@render/ui/theme';
import { effectiveDpr, LAYOUT_EVENT, readSafeAreaInsets, updateLayout } from '@render/ui/layout';

const TARGET_FPS = 60;
// Sky (not dark) so there is no dark flash before the first scene paints.
const BACKGROUND_COLOR = skyCssColor;
/** Debounce (ms) for resize/orientation storms (iOS address-bar, rotation). */
const RELAYOUT_DEBOUNCE_MS = 120;

/**
 * COMPOSITION ROOT. eslint `boundaries` forbids `render → meta`, so the render
 * scenes never construct SaveManager/Economy themselves — this element-free
 * entry wires every layer together, builds the `GameServices` adapter, and
 * injects it on `game.registry` for BootScene (which runs first) to consume.
 */
function createGameServices(): GameServices {
  // S4: pick platform implementations by RUNTIME. On iOS/Android the WebView's
  // navigator.vibrate is a no-op, so haptics must go through @capacitor/haptics,
  // and persistence must use native Preferences (localStorage is not durable in
  // a Capacitor shell). On the web build the browser implementations are used.
  const isNative = Capacitor.isNativePlatform();
  const storage: StorageInterface = isNative ? new CapacitorStorage() : new WebStorage();
  const haptics: HapticsInterface = isNative ? new CapacitorHaptics() : new WebHaptics();
  const saveManager = new SaveManager(storage);
  const economy = new Economy(saveManager);

  // One-time native migration: earlier test builds wrote the save to localStorage;
  // copy it into Preferences once (before the first load) so progress is not lost.
  const migrateLegacyStorage = async (): Promise<void> => {
    if (!isNative) {
      return;
    }
    try {
      const existing = await storage.get(STORAGE_KEY_MAIN);
      if (existing !== null) {
        return;
      }
      const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_MAIN) : null;
      if (legacy !== null) {
        await storage.set(STORAGE_KEY_MAIN, legacy);
      }
    } catch {
      // best-effort — migration must never block boot (FR-021 owns the load path)
    }
  };

  // Meta screens don't wire real engine events (Phase 5 does); the router is
  // used here only as the FR-014 settings gate for UI-moment haptics.
  const hapticsRouter = new HapticsRouter(haptics, new EngineEvents());

  // A real AudioContext structurally satisfies AudioContextLike (WebAudioTypes
  // header) — the cast bridges lib.dom's stricter node variance.
  const audioBus = new AudioBus(() => new AudioContext() as unknown as AudioContextLike);
  const sfxPlayer = new SfxPlayer(audioBus, buildSfxLibrary(audioBus.context));

  const applySound = (enabled: boolean): void => {
    audioBus.masterGain.gain.value = enabled ? 1 : 0;
  };
  const applyLoadedSettings = (): void => {
    const settings = saveManager.getData().settings;
    applySound(settings.sound);
    hapticsRouter.setEnabled(settings.haptics);
  };

  return {
    resumeAudio: () => audioBus.resume(),
    playTap: () => {
      if (saveManager.getData().settings.sound) {
        sfxPlayer.play(SFX.commitPop);
      }
    },
    uiHaptic: () => {
      if (hapticsRouter.isEnabled) {
        haptics.impact('confirm');
      }
    },
    loadSave: async () => {
      await migrateLegacyStorage();
      const result = await saveManager.load();
      applyLoadedSettings();
      if (result.corruption !== null && result.corruption.needsUserNotification) {
        return { fullReset: result.corruption.fullReset, progressReset: result.corruption.progressReset };
      }
      return null;
    },
    getBalance: () => economy.balance,
    getProgress: (levelId) => {
      const progress = saveManager.getData().progress[levelId];
      return progress === undefined ? null : { bestStars: progress.bestStars, cleared: progress.cleared };
    },
    isCleared: (levelId) => saveManager.getData().progress[levelId]?.cleared ?? false,
    getUpgradeLevel: (axis) => {
      const upgrades = economy.getUpgrades();
      return axis === 'inkCapacity' ? upgrades.inkCapacityLv : upgrades.engineSpeedLv;
    },
    getUpgradePrice: (axis) => economy.priceFor(axis),
    purchase: async (axis) => {
      const result = await economy.purchase(axis);
      if (result.ok) {
        return { ok: true, newLevel: result.newLevel, newBalance: result.newBalance };
      }
      return { ok: false, reason: result.reason === 'maxLevel' ? 'maxLevel' : 'insufficientFunds' };
    },
    isSoundEnabled: () => saveManager.getData().settings.sound,
    isHapticsEnabled: () => saveManager.getData().settings.haptics,
    setSoundEnabled: async (enabled) => {
      saveManager.mutate((prev) => ({ ...prev, settings: { ...prev.settings, sound: enabled } }));
      applySound(enabled);
      await saveManager.saveOnSettingsChange();
    },
    setHapticsEnabled: async (enabled) => {
      saveManager.mutate((prev) => ({ ...prev, settings: { ...prev.settings, haptics: enabled } }));
      hapticsRouter.setEnabled(enabled);
      await saveManager.saveOnSettingsChange();
    },
    resetProgress: async () => {
      saveManager.resetProgress();
      await saveManager.save('reset');
    },
    creditLevelResult: async (input) => {
      const credit = await economy.creditLevelResult({
        levelId: input.levelId,
        outcome: 'clear',
        starRating: input.starRating,
        collectedCoins: input.collectedCoins,
        ...(input.bonusMultiplier !== undefined ? { bonusMultiplier: input.bonusMultiplier } : {}),
      });
      return {
        totalCredited: credit.totalCredited,
        newBalance: credit.newBalance,
        firstClear: credit.firstClear,
      };
    },
    attachEngineJuice: (events) => {
      const isSoundOn = (): boolean => saveManager.getData().settings.sound;
      // SFX failures must never propagate back through EngineEvents into the
      // sim step (EngineEvents forwards listener throws) — isolate every play.
      const playIf = (key: SfxKey, options?: PlayOptions): void => {
        if (!isSoundOn()) {
          return;
        }
        try {
          sfxPlayer.play(key, options);
        } catch {
          // audio never blocks gameplay (NFR-014)
        }
      };
      const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
      const unsubscribes = [
        events.on('strokeCommitted', () => playIf(SFX.commitPop)),
        // The rising anticipation rev is scene-driven (revTick); launchReleased is
        // the bass-weighted release burst (§4.2 2-2 "低域を効かせた発進バースト音").
        events.on('launchReleased', () => playIf(SFX.launchBurst)),
        events.on('creak', (payload) =>
          playIf(SFX.creak, {
            volume: clamp01(0.3 + payload.stress * 0.7),
            pitchSemitones: Math.round(payload.stress * 5),
          }),
        ),
        events.on('break', () => playIf(SFX.crack)),
        events.on('coinCollected', () => playIf(SFX.coinChime, { pitchSemitones: sfxPlayer.nextCoinPitch() })),
        events.on('failed', (payload) => {
          // divergence is the silent solver failsafe — no fail SFX (Judge header).
          if (payload.cause !== 'divergence') {
            playIf(SFX.sadFail);
          }
        }),
      ];
      const attemptHaptics = new HapticsRouter(haptics, events, {
        enabled: saveManager.getData().settings.haptics,
      });
      attemptHaptics.attach();

      const juice: AttemptJuice = {
        detach: () => {
          for (const unsubscribe of unsubscribes) {
            unsubscribe();
          }
          attemptHaptics.detach();
          audioBus.unduck(0);
        },
        drawScrub: (speed01) => {
          const mod = drawScrubModulation(speed01);
          playIf(SFX.drawLoop, { volume: mod.volume, pitchSemitones: mod.pitchSemitones });
        },
        revTick: (progress01) => {
          const rate = 1 + (launch.revPitchMax - 1) * clamp01(progress01);
          playIf(SFX.engineHum, { volume: 0.3, pitchSemitones: rateToSemitones(rate) });
        },
        engineHum: (speedRatio01) => {
          const mod = engineHumModulation(speedRatio01);
          playIf(SFX.engineHum, { volume: mod.volume, pitchSemitones: mod.pitchSemitones });
        },
        duckBgm: () => audioBus.duck(),
        unduckBgm: () => audioBus.unduck(),
        goalStarBeat: (index) => {
          const note = index <= 0 ? SFX.starC : index === 1 ? SFX.starE : SFX.starG;
          playIf(note);
          if (index >= 2) {
            playIf(SFX.cymbal); // 3rd star is "豪華" — add the cymbal accent (§4.3 3-4)
          }
          attemptHaptics.starBeat(index); // ascending light→medium→heavy
        },
        goalCountTick: (progress01) => {
          const rate = 1 + 0.3 * clamp01(progress01); // pitch 1.0 → 1.3 (§4.3 3-5)
          playIf(SFX.countTick, { pitchSemitones: rateToSemitones(rate) });
        },
        goalCoinArrive: (index) => {
          playIf(SFX.coinChime, { pitchSemitones: Math.min(index, 12) });
        },
        goalConfettiPop: (sideIndex) => {
          playIf(SFX.confettiPop);
          if (sideIndex === 0) {
            attemptHaptics.onLanding(); // .heavy on the cannon volley (§4.3 3-3)
          }
        },
      };
      return juice;
    },
  };
}

const META_SCENES = [BootScene, HomeScene, LevelSelectScene, ShopScene, SettingsScene, PlayScene];

// Dev-only spike route (?spike=1): S2 visual check scene (research R10, T035).
// The dynamic import keeps src/debug/ tree-shaken out of release builds.
const shouldBootSpike =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('spike') === '1';

// ── DPR-native, full-bleed surface (research 08_mobile_quality §1/§2) ─────────
// Phaser 4 does NO DPR handling and RESIZE mode can never be crisp (backing =
// CSS px). The only full-bleed + crisp pattern is Scale.NONE with the backing
// store sized in DEVICE pixels (width/height = cssSize × DPR) and zoom = 1/DPR
// so the CSS display size stays the real viewport. A manual resize listener
// (below) keeps it correct across iOS address-bar / rotation changes.
function cssViewport(): { width: number; height: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

const initialDpr = effectiveDpr();
const initialCss = cssViewport();
const initialGameW = Math.round(initialCss.width * initialDpr);
const initialGameH = Math.round(initialCss.height * initialDpr);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.NONE,
    width: initialGameW,
    height: initialGameH,
    zoom: 1 / initialDpr,
  },
  render: {
    // Suppress half-pixel bleed on the DPR-scaled backing store (research §2.2).
    // antialias is left at its WebGL default (true) so scaled textures stay smooth.
    roundPixels: true,
  },
  fps: {
    target: TARGET_FPS,
  },
  scene: shouldBootSpike ? [] : META_SCENES,
});

// Seed the ONE dynamic layout source synchronously — before any scene create()
// runs on the next tick — so every scene reads a live game-pixel geometry.
updateLayout(initialGameW, initialGameH, initialDpr, readSafeAreaInsets());

// ── relayout on resize / orientation / visualViewport (research §1.2) ─────────
function applyLayout(): void {
  const dpr = effectiveDpr();
  const css = cssViewport();
  const gameW = Math.round(css.width * dpr);
  const gameH = Math.round(css.height * dpr);
  game.scale.setZoom(1 / dpr);
  game.scale.resize(gameW, gameH);
  updateLayout(gameW, gameH, dpr, readSafeAreaInsets());
  // Scenes subscribe to this to re-anchor (menu scenes restart; PlayScene re-frames).
  game.events.emit(LAYOUT_EVENT);
}

let relayoutTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRelayout(): void {
  if (relayoutTimer !== undefined) {
    clearTimeout(relayoutTimer);
  }
  relayoutTimer = setTimeout(applyLayout, RELAYOUT_DEBOUNCE_MS);
}
window.addEventListener('resize', scheduleRelayout);
window.visualViewport?.addEventListener('resize', scheduleRelayout);
window.addEventListener('orientationchange', scheduleRelayout);

if (shouldBootSpike) {
  void import('./debug/SpikeScene').then((module) => {
    game.scene.add('Spike', module.SpikeScene, true);
  });
} else {
  // Registry is available synchronously; scene create() runs on the next frame,
  // so BootScene always finds the services in place.
  game.registry.set(SERVICES_KEY, createGameServices());
}

// Dev-only in-game level editor (?editor=1) — tree-shaken from release (FR-024).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('editor') === '1') {
  void import('./editor/EditorScene').then((m) => {
    game.scene.add('Editor', m.EditorScene, true);
  });
}

// Dev-only E2E/gatekeeper hook (window.__inkbridge) — tree-shaken from release.
if (import.meta.env.DEV) {
  void import('./render/devhook').then((module) => {
    module.installDevHook(game);
  });
}

export default game;

import Phaser from 'phaser';
import { EngineEvents } from '@engine/EngineEvents';
import { Economy } from '@meta/Economy';
import { SaveManager } from '@meta/SaveManager';
import { WebHaptics, WebStorage } from '@platform/web';
import { AudioBus } from '@render/audio/AudioBus';
import { SfxPlayer } from '@render/audio/SfxPlayer';
import type { PlayOptions } from '@render/audio/SfxPlayer';
import { SFX, buildSfxLibrary } from '@render/audio/SfxSynth';
import type { SfxKey } from '@render/audio/SfxSynth';
import type { AudioContextLike } from '@render/audio/WebAudioTypes';
import { HapticsRouter } from '@render/juice/HapticsRouter';
import { BootScene } from '@render/scenes/BootScene';
import { HomeScene } from '@render/scenes/HomeScene';
import { LevelSelectScene } from '@render/scenes/LevelSelectScene';
import { PlayScene } from '@render/scenes/PlayScene';
import { SettingsScene } from '@render/scenes/SettingsScene';
import { ShopScene } from '@render/scenes/ShopScene';
import { SERVICES_KEY } from '@render/ui/services';
import type { GameServices } from '@render/ui/services';

// Portrait design basis (plan.md Technical Context): 390x844.
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const TARGET_FPS = 60;
const BACKGROUND_COLOR = '#101216';

/**
 * COMPOSITION ROOT. eslint `boundaries` forbids `render → meta`, so the render
 * scenes never construct SaveManager/Economy themselves — this element-free
 * entry wires every layer together, builds the `GameServices` adapter, and
 * injects it on `game.registry` for BootScene (which runs first) to consume.
 */
function createGameServices(): GameServices {
  const storage = new WebStorage();
  const saveManager = new SaveManager(storage);
  const economy = new Economy(saveManager);

  const webHaptics = new WebHaptics();
  // Meta screens don't wire real engine events (Phase 5 does); the router is
  // used here only as the FR-014 settings gate for UI-moment haptics.
  const hapticsRouter = new HapticsRouter(webHaptics, new EngineEvents());

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
        webHaptics.impact('confirm');
      }
    },
    loadSave: async () => {
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
        // No dedicated rev buffer yet: a quiet, pitched-down launch thud stands in
        // for the anticipation rev (Phase 6 replaces it with the goal sequence).
        events.on('launchStarted', () => playIf(SFX.launchBurst, { volume: 0.3, pitchSemitones: -5 })),
        events.on('launchReleased', () => playIf(SFX.launchBurst)),
        events.on('creak', (payload) =>
          playIf(SFX.creak, {
            volume: clamp01(0.3 + payload.stress * 0.7),
            pitchSemitones: Math.round(payload.stress * 5),
          }),
        ),
        events.on('break', () => playIf(SFX.crack)),
        events.on('coinCollected', () => playIf(SFX.coinChime, { pitchSemitones: sfxPlayer.nextCoinPitch() })),
        events.on('cleared', () => {
          // Interim 3-note win arpeggio; the star-count-driven 5-beat is Phase 6.
          playIf(SFX.starC);
          window.setTimeout(() => playIf(SFX.starE), 120);
          window.setTimeout(() => playIf(SFX.starG), 240);
        }),
        events.on('failed', (payload) => {
          // divergence is the silent solver failsafe — no fail SFX (Judge header).
          if (payload.cause !== 'divergence') {
            playIf(SFX.sadFail);
          }
        }),
      ];
      const attemptHaptics = new HapticsRouter(webHaptics, events, {
        enabled: saveManager.getData().settings.haptics,
      });
      attemptHaptics.attach();
      return (): void => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
        attemptHaptics.detach();
      };
    },
  };
}

const META_SCENES = [BootScene, HomeScene, LevelSelectScene, ShopScene, SettingsScene, PlayScene];

// Dev-only spike route (?spike=1): S2 visual check scene (research R10, T035).
// The dynamic import keeps src/debug/ tree-shaken out of release builds.
const shouldBootSpike =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('spike') === '1';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  fps: {
    target: TARGET_FPS,
  },
  scene: shouldBootSpike ? [] : META_SCENES,
});

if (shouldBootSpike) {
  void import('./debug/SpikeScene').then((module) => {
    game.scene.add('Spike', module.SpikeScene, true);
  });
} else {
  // Registry is available synchronously; scene create() runs on the next frame,
  // so BootScene always finds the services in place.
  game.registry.set(SERVICES_KEY, createGameServices());
}

// Dev-only E2E/gatekeeper hook (window.__inkbridge) — tree-shaken from release.
if (import.meta.env.DEV) {
  void import('./render/devhook').then((module) => {
    module.installDevHook(game);
  });
}

export default game;

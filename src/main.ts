import Phaser from 'phaser';

// Portrait design basis (plan.md Technical Context): 390x844.
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const TARGET_FPS = 60;
const BACKGROUND_COLOR = '#101216';

/**
 * Placeholder boot scene — replaced by src/render/scenes/BootScene.ts in Phase 5 (T045).
 */
class BlankScene extends Phaser.Scene {
  constructor() {
    super('Blank');
  }

  create(): void {
    console.info(`InkBridge boot — Phaser ${Phaser.VERSION}`);
  }
}

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
  scene: shouldBootSpike ? [] : [BlankScene],
});

if (shouldBootSpike) {
  void import('./debug/SpikeScene').then((module) => {
    game.scene.add('Spike', module.SpikeScene, true);
  });
}

export default game;

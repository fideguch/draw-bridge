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
  scene: [BlankScene],
});

export default game;

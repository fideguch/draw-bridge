/**
 * BootScene — the entry scene (registered first in main.ts). The concrete
 * meta/platform/audio services are constructed by the composition root
 * (src/main.ts) and injected on `game.registry`; BootScene owns the runtime
 * boot flow: load the persisted save, stash any corruption notice for Home to
 * surface (SC-001 / FR-021), then route to Home.
 *
 * Audio is unlocked on the first user gesture through every Button press
 * (services.resumeAudio is idempotent), so nothing to wire here.
 */

import Phaser from 'phaser';
import { getServices, type SaveNotice } from '@render/ui/services';
import { color, layout, makeTextStyle, type } from '@render/ui/theme';

/** Registry key where BootScene leaves a one-shot save-restore notice. */
export const SAVE_NOTICE_KEY = 'saveNotice';

/** Max time boot waits for the save load before starting fresh (watchdog). */
const BOOT_SAVE_TIMEOUT_MS = 3000;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(color.sky);
    this.add
      .text(layout.width / 2, layout.height / 2, 'InkBridge（仮）', makeTextStyle(type.h1, color.textPrimary))
      .setOrigin(0.5);
    void this.boot();
  }

  private async boot(): Promise<void> {
    // Wait for the rounded-gothic stack to settle before any menu text bakes, so
    // glyph metrics don't shift after the first paint (FOUT, research §5). System
    // fonts resolve near-instantly; the guard covers non-browser/test contexts.
    if (typeof document !== 'undefined' && document.fonts !== undefined) {
      try {
        await document.fonts.ready;
      } catch {
        // Font readiness is best-effort — never block boot on it.
      }
    }
    const services = getServices(this);
    let notice: SaveNotice | null = null;
    try {
      // Boot watchdog: a wedged storage bridge (seen on WebView live-reload)
      // must degrade to a fresh session, never a permanent splash (FR-021).
      notice = await Promise.race([
        services.loadSave(),
        new Promise<SaveNotice | null>((resolve) => {
          setTimeout(() => resolve(null), BOOT_SAVE_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      // Storage rejects are the one allowed failure (FR-021); boot fresh rather
      // than blocking. The next save trigger retries persistence.
      console.error('BootScene: save load failed, starting fresh', error);
    }
    if (notice !== null) {
      this.registry.set(SAVE_NOTICE_KEY, notice);
    }
    this.scene.start('Home');
  }
}

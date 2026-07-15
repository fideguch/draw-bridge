/**
 * CS-3 safe-area E2E — Dynamic Island / cutout inset profile (round-9).
 *
 * Chromium mobile emulation (playwright.config uses iPhone-14 chromium metrics,
 * dpr 3) — NEVER webkit (learnings T6: webkit != real Safari; real-device is the
 * gatekeeper step). env(safe-area-inset-*) is 0 under emulation, so we SHIM it by
 * overriding the hidden #safe-probe padding (index.html paints env() onto it and
 * src/render/ui/layout.ts reads the resolved values) to an iPhone-15-Pro-like
 * Dynamic Island profile (top 59, bottom 34 CSS px), then trigger a relayout.
 *
 * Verifies the round-8 learning is honoured: the probe RECEIVES a nonzero top
 * inset (per-edge, not folded/zeroed) and the HUD + world clear it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

interface InkbridgeHook {
  scene: string;
  state: string | null;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}
interface LiveLayout {
  dpr: number;
  safe: { top: number; bottom: number; left: number; right: number };
}

const SAFE_TOP_CSS = 59;
const SAFE_BOTTOM_CSS = 34;

function spawnOf(levelId: string): { x: number; y: number } {
  for (const file of [
    join(process.cwd(), 'levels', `${levelId}.json`),
    join(process.cwd(), 'tests', 'fixtures', 'gate-levels', `${levelId}.json`),
  ]) {
    try {
      const lvl = JSON.parse(readFileSync(file, 'utf-8')) as { vehicleSpawn: { x: number; y: number } };
      if (lvl.vehicleSpawn) return lvl.vehicleSpawn;
    } catch {
      // try next
    }
  }
  throw new Error(`${levelId} vehicleSpawn not found`);
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return h.buttonRect(buttonId);
  }, id);
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function sceneState(page: Page): Promise<{ scene: string; state: string | null }> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state };
  });
}

async function liveSafeTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const l = (window as unknown as { __layout?: LiveLayout }).__layout;
    return l ? l.safe.top : -1;
  });
}

test('safe-area: simulated Dynamic Island inset reaches layout; HUD + world clear it', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => (await sceneState(page)).scene, { timeout: 15_000 }).toBe('Hub');
  await tapButton(page, 'level-ch1-l01');
  await expect.poll(async () => (await sceneState(page)).state, { timeout: 10_000 }).toBe('drawing');

  // Baseline: emulation reports zero insets.
  expect(await liveSafeTop(page)).toBe(0);

  // Shim the Dynamic Island profile onto the probe, then force a relayout.
  await page.addStyleTag({
    content: `#safe-probe{padding:${SAFE_TOP_CSS}px 0px ${SAFE_BOTTOM_CSS}px 0px !important;}`,
  });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));

  // (T3 CORE) the probe → layout wiring now carries a NONZERO top inset.
  await expect.poll(async () => liveSafeTop(page), { timeout: 5_000 }).toBeGreaterThan(0);

  const { safeTopGame, dpr } = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const l = (window as unknown as { __layout?: LiveLayout }).__layout!;
    return { safeTopGame: l.safe.top, dpr: l.dpr };
  });
  // Per-edge propagation: game-px top inset == CSS inset × dpr (never folded/zeroed).
  expect(Math.abs(safeTopGame - SAFE_TOP_CSS * dpr)).toBeLessThan(1.5);

  // HUD pause button clears the top inset (page px, i.e. CSS space).
  const pause = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge!;
    return h.buttonRect('hud-pause');
  });
  expect(pause).not.toBeNull();
  expect(pause!.y).toBeGreaterThanOrEqual(SAFE_TOP_CSS - 1);

  // World content is NOT drawn under the notch: the spawn maps below the inset.
  const spawn = spawnOf('ch1-l01');
  const spawnScreen = await page.evaluate((s) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge!;
    return h.worldToScreen(s.x, s.y);
  }, spawn);
  expect(spawnScreen.y).toBeGreaterThan(SAFE_TOP_CSS);

  await page.screenshot({ path: '/tmp/cs3-shots/ch1-l01-dynamic-island.png' });
});

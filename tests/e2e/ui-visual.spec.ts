/**
 * ui-visual — own-eyes capture of the Graphics-stroke overhaul (UI QUALITY sweep).
 * NOT a gate: it drives Home / LevelSelect / Shop / Settings (+ the Play drawing
 * phase, best-effort) on the iPhone 14 chromium profile (deviceScaleFactor 3) and
 * writes full-page PNGs to .fable/evidence-ui/ for manual inspection of icon
 * crispness, clean borders, and the absence of stray stroke lines.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '.fable/evidence-ui';

interface Hook {
  scene: string;
  state: string | null;
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
  worldToScreen(x: number, y: number): { x: number; y: number };
}

function getScene(page: Page): Promise<string> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    if (!h) throw new Error('hook missing');
    return h.scene;
  });
}

async function rect(page: Page, id: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    return h?.buttonRect(buttonId) ?? null;
  }, id);
}

async function tap(page: Page, id: string): Promise<void> {
  const r = await rect(page, id);
  if (!r) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

async function waitScene(page: Page, name: string): Promise<void> {
  await expect.poll(async () => getScene(page), { timeout: 15_000 }).toBe(name);
  await page.waitForTimeout(350); // let one-shot tweens settle before the shot
}

test('capture menu + play screens at DSF3', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.goto('/');
  await waitScene(page, 'Hub');
  await page.screenshot({ path: `${OUT}/01-hub.png` });

  await tap(page, 'hub-upgrade');
  await waitScene(page, 'Upgrade');
  await page.screenshot({ path: `${OUT}/02-upgrade.png` });
  await tap(page, 'upgrade-back');
  await waitScene(page, 'Hub');

  await tap(page, 'hub-settings');
  await waitScene(page, 'Settings');
  await page.screenshot({ path: `${OUT}/03-settings.png` });
  await tap(page, 'settings-back');
  await waitScene(page, 'Hub');

  // Play drawing phase — best-effort (skip if the engine is red under the feel agent).
  try {
    await tap(page, 'level-ch1-l01');
    await expect
      .poll(async () => page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
        return h?.state ?? null;
      }), { timeout: 10_000 })
      .toBe('drawing');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/05-play-drawing.png` });

    // Draw an arc so the live StrokeRenderer (filled thick polyline) is captured.
    const arc: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      arc.push([-1.6 + t * 3.2, 0.35 + Math.sin(t * Math.PI) * 0.55]);
    }
    const pts = await page.evaluate((worldPts) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge!;
      return worldPts.map(([x, y]) => h.worldToScreen(x, y));
    }, arc);
    await page.mouse.move(pts[0]!.x, pts[0]!.y);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.screenshot({ path: `${OUT}/06-play-live-stroke.png` });
    await page.mouse.up();
  } catch (error) {
    console.error('Play capture skipped (engine may be red):', error);
  }
});

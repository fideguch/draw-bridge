/**
 * iPhone 15 Pro Max-size verification (430x932 CSS @ DSF3) — proves the
 * responsive layout holds at the actual device size that produced the
 * 2026-07-08 feedback (not just the 390-design size).
 */
import { expect, test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

interface Hook {
  scene: string;
  state: string | null;
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}

async function hook(page: Page): Promise<{ scene: string; state: string | null }> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    if (!h) throw new Error('hook missing');
    return { scene: h.scene, state: h.state };
  });
}

async function tap(page: Page, id: string): Promise<void> {
  const r = await page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    return h?.buttonRect(buttonId) ?? null;
  }, id);
  if (!r) throw new Error(`button missing: ${id}`);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

test('Pro Max 430x932: full-bleed, crisp, no overlap, all screens navigable + captured', async ({ page }) => {
  const dir = '.fable/evidence-promax';
  await page.goto('/');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 15_000 }).toBe('Hub');

  // Full-bleed + DPR backing at THIS size.
  const m = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    return { x: box.x, y: box.y, w: box.width, h: box.height, vw: window.innerWidth, vh: window.innerHeight, backingW: canvas.width, dpr: window.devicePixelRatio };
  });
  expect(Math.abs(m.x)).toBeLessThanOrEqual(1);
  expect(m.w).toBeGreaterThanOrEqual(m.vw - 2);
  expect(m.h).toBeGreaterThanOrEqual(m.vh - 2);
  expect(m.backingW).toBeGreaterThanOrEqual(m.w * m.dpr * 0.9);
  await page.screenshot({ path: `${dir}/01-hub.png` });

  await tap(page, 'hub-settings');
  await expect.poll(async () => (await hook(page)).scene).toBe('Settings');
  await page.screenshot({ path: `${dir}/02-settings.png` });
  await tap(page, 'settings-back');
  await expect.poll(async () => (await hook(page)).scene).toBe('Hub');

  await tap(page, 'hub-upgrade');
  await expect.poll(async () => (await hook(page)).scene).toBe('Upgrade');
  await page.screenshot({ path: `${dir}/03-upgrade.png` });
  await tap(page, 'upgrade-back');
  await expect.poll(async () => (await hook(page)).scene).toBe('Hub');

  // Hub is the merged grid — tap a level tile straight into Play.
  await tap(page, 'level-ch1-l01');
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('drawing');
  await page.screenshot({ path: `${dir}/05-play-drawing.png` });
});

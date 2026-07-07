/**
 * AC-6 manual-flow E2E — the meta loop end to end (FR-018, FR-019, FR-021):
 * seeded save -> Shop purchase (real multiplier level-up, balance deduction)
 * -> atomic persistence across reload.
 * Save seeding via localStorage (WebStorage impl, key 'inkbridge.save').
 */
import { expect, test, type Page } from '@playwright/test';

const SAVE_KEY = 'inkbridge.save';

interface SaveShape {
  schemaVersion: number;
  coins: number;
  upgrades: { inkCapacityLv: number; engineSpeedLv: number };
  progress: Record<string, { bestStars: number; cleared: boolean }>;
  settings: { sound: boolean; haptics: boolean };
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await page.evaluate((buttonId) => {
    const h = (
      window as unknown as {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __inkbridge?: { buttonRect(id: string): { x: number; y: number; width: number; height: number } | null };
      }
    ).__inkbridge;
    return h?.buttonRect(buttonId) ?? null;
  }, id);
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function hookScene(page: Page): Promise<string> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: { scene: string } }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return h.scene;
  });
}

async function readSave(page: Page): Promise<SaveShape> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  if (!raw) throw new Error('save not found in localStorage');
  return JSON.parse(raw) as SaveShape;
}

test('meta loop: seeded coins -> shop purchase -> persisted across reload (AC-6)', async ({ page }) => {
  // Seed a valid save with 500 coins before the game boots.
  await page.addInitScript(
    ([key, save]) => {
      if (!localStorage.getItem(key as string)) {
        localStorage.setItem(key as string, save as string);
      }
    },
    [
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        coins: 500,
        upgrades: { inkCapacityLv: 0, engineSpeedLv: 0 },
        progress: {},
        settings: { sound: true, haptics: true },
      }),
    ],
  );

  await page.goto('/');
  await expect.poll(async () => hookScene(page), { timeout: 15_000 }).toBe('Home');

  // Home -> Shop.
  await tapButton(page, 'home-shop');
  await expect.poll(async () => hookScene(page), { timeout: 5_000 }).toBe('Shop');

  // Buy one ink-capacity level: balance drops by the price, level goes to 1,
  // and the save is written immediately (FR-021 save-on-purchase).
  const before = await readSave(page);
  expect(before.coins).toBe(500);
  await tapButton(page, 'shop-buy-inkCapacity');

  await expect
    .poll(async () => (await readSave(page)).upgrades.inkCapacityLv, { timeout: 5_000 })
    .toBe(1);
  const after = await readSave(page);
  const price = before.coins - after.coins;
  expect(price).toBeGreaterThan(0); // real deduction happened
  expect(after.coins).toBe(500 - price);

  // Atomic persistence across a full reload (FR-021).
  await page.reload();
  await expect.poll(async () => hookScene(page), { timeout: 15_000 }).toBe('Home');
  const persisted = await readSave(page);
  expect(persisted.upgrades.inkCapacityLv).toBe(1);
  expect(persisted.coins).toBe(500 - price);
});

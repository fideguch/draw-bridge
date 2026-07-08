/**
 * AC-4 / AC-8 E2E — real-pointer L1 clear (KPI-003 tempo contracts).
 *
 * The game renders to a Phaser CANVAS — there are no DOM buttons, so all
 * interaction goes through real pointer events at coordinates resolved via the
 * dev hook (see .fable/playscene-composition-spec.md):
 *   window.__inkbridge = {
 *     scene: string,                      // active scene key
 *     state: 'drawing'|'anticipation'|'running'|'result'|null,
 *     tick: number, outcome: 'clear'|'fail'|null,
 *     worldToScreen(x, y): {x, y},        // world meters -> page pixels
 *     buttonRect(id): {x, y, width, height} | null,  // page pixels
 *   }
 * Button ids: 'home-play', 'level-ch1-l01'.., 'hud-restart', 'result-replay',
 * 'result-retry', 'result-next'.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

interface InkbridgeHook {
  scene: string;
  state: string | null;
  tick: number;
  outcome: string | null;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}

declare global {
  interface Window {
    // Dev-hook global — double-underscore marks it as non-app surface.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __inkbridge?: InkbridgeHook;
  }
}

interface HookSnapshot {
  scene: string;
  state: string | null;
  tick: number;
  outcome: string | null;
}

async function hook(page: Page): Promise<HookSnapshot> {
  return page.evaluate(() => {
    const h = window.__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state, tick: h.tick, outcome: h.outcome };
  });
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await page.evaluate((buttonId) => {
    const h = window.__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return h.buttonRect(buttonId);
  }, id);
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/**
 * L1 solution stroke = the level's own recorded ghost (single source of truth —
 * stays correct when level geometry is re-authored or tuning is recalibrated).
 */
function loadL1GhostStroke(): ReadonlyArray<[number, number]> {
  const candidates = [
    join(process.cwd(), 'levels', 'ch1-l01.json'),
    join(process.cwd(), 'tests', 'fixtures', 'gate-levels', 'ch1-l01.json'),
  ];
  for (const file of candidates) {
    try {
      const level = JSON.parse(readFileSync(file, 'utf-8')) as {
        ghostSolutions: Array<{ stroke: Array<[number, number]> }>;
      };
      const stroke = level.ghostSolutions[0]?.stroke;
      if (stroke && stroke.length >= 2) return stroke;
    } catch {
      // try next candidate
    }
  }
  throw new Error('ch1-l01 level JSON with a ghost stroke not found');
}

const L1_STROKE_WORLD = loadL1GhostStroke();

async function drawStroke(page: Page, worldPoints: ReadonlyArray<[number, number]>): Promise<void> {
  const screenPoints = await page.evaluate((pts) => {
    const h = window.__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return pts.map(([x, y]) => h.worldToScreen(x, y));
  }, worldPoints as [number, number][]);

  const first = screenPoints[0]!;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of screenPoints.slice(1)) {
    // Several sub-moves per segment — StrokeInput thins by min vertex distance.
    await page.mouse.move(point.x, point.y, { steps: 2 });
  }
  await page.mouse.up();
}

async function navigateToL1Drawing(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 15_000 }).toBe('Home');
  await tapButton(page, 'home-play');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 5_000 }).toBe('LevelSelect');
  await tapButton(page, 'level-ch1-l01');
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('drawing');
}

test('L1: draw -> launch -> clear <= 25s, replay <= 1s (NFR-003 tempo contract)', async ({ page }) => {
  await navigateToL1Drawing(page);

  const clearStart = Date.now();
  await drawStroke(page, L1_STROKE_WORLD);

  // Commit -> anticipation -> running happens without further input (BR-001).
  await expect.poll(async () => (await hook(page)).state, { timeout: 5_000 }).not.toBe('drawing');

  // Clear within the 25s tempo contract (KPI-003), measured from stroke start.
  await expect.poll(async () => (await hook(page)).outcome, { timeout: 25_000 }).toBe('clear');
  expect(Date.now() - clearStart).toBeLessThanOrEqual(25_000);

  // Result -> Replay returns to a fresh drawing state within 1s (FR-004).
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('result');
  await tapButton(page, 'result-replay');
  const retryStart = Date.now();
  await expect.poll(async () => (await hook(page)).state, { timeout: 2_000 }).toBe('drawing');
  expect(Date.now() - retryStart).toBeLessThanOrEqual(1_000);
});

test('HUD restart during run returns to drawing <= 1s (FR-004)', async ({ page }) => {
  await navigateToL1Drawing(page);

  await drawStroke(page, L1_STROKE_WORLD);
  await expect.poll(async () => (await hook(page)).state, { timeout: 5_000 }).not.toBe('drawing');

  await tapButton(page, 'hud-restart');
  const restartStart = Date.now();
  await expect.poll(async () => (await hook(page)).state, { timeout: 2_000 }).toBe('drawing');
  expect(Date.now() - restartStart).toBeLessThanOrEqual(1_000);
});

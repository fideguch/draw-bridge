/**
 * Round-4 E2E — stroke × terrain clipping on a PLATEAU level (ch1-l03).
 *
 * User bug (screenshot): "線が引けない土台があります" — a line drawn across / into a
 * plateau lay through the solid. The engine now clips a stroke to the parts
 * OUTSIDE solid terrain and commits the longest run. This test reaches the L3
 * plateau (central pillar 中間支点) through the real clear→Next chain, then draws a
 * line that DIVES THROUGH the pillar and proves the clipped line still commits
 * and the car interacts (the plateau is drawable again — the bug is gone).
 *
 * Dev hook (window.__inkbridge): scene/state/outcome/resultNextReady +
 * worldToScreen(x,y) + buttonRect(id). See src/render/devhook.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

interface InkbridgeHook {
  scene: string;
  state: string | null;
  tick: number;
  outcome: string | null;
  resultNextReady: boolean;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}

// Local window cast per evaluate() — l1-clear.spec.ts owns the `declare global`.
type HookWindow = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __inkbridge?: InkbridgeHook;
};

interface Snapshot {
  scene: string;
  state: string | null;
  outcome: string | null;
  resultNextReady: boolean;
}

async function hook(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = (window as unknown as HookWindow).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state, outcome: h.outcome, resultNextReady: h.resultNextReady };
  });
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await page.evaluate(
    (buttonId) => (window as unknown as HookWindow).__inkbridge?.buttonRect(buttonId) ?? null,
    id,
  );
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

function loadGhostStroke(levelId: string): ReadonlyArray<[number, number]> {
  const level = JSON.parse(readFileSync(join(process.cwd(), 'levels', `${levelId}.json`), 'utf-8')) as {
    ghostSolutions: Array<{ stroke: Array<[number, number]> }>;
  };
  const stroke = level.ghostSolutions[0]?.stroke;
  if (!stroke || stroke.length < 2) throw new Error(`${levelId}: no ghost stroke`);
  return stroke;
}

async function drawStroke(page: Page, worldPoints: ReadonlyArray<[number, number]>): Promise<void> {
  const screenPoints = await page.evaluate((pts) => {
    const h = (window as unknown as HookWindow).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return pts.map(([x, y]) => h.worldToScreen(x, y));
  }, worldPoints as [number, number][]);

  const first = screenPoints[0]!;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of screenPoints.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 2 });
  }
  await page.mouse.up();
}

/** Play `id` with its recorded ghost until it clears (bounded honest redraws). */
async function clearWithGhost(page: Page, id: string, maxAttempts = 4): Promise<void> {
  const ghost = loadGhostStroke(id);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');
    await drawStroke(page, ghost);
    await expect.poll(async () => (await hook(page)).state, { timeout: 8_000 }).not.toBe('drawing');
    await expect.poll(async () => (await hook(page)).state, { timeout: 45_000 }).toMatch(/result|drawing/);
    const snap = await hook(page);
    if (snap.outcome === 'clear' && snap.state === 'result') return;
    if (snap.state === 'result') await tapButton(page, 'result-retry');
  }
  throw new Error(`${id} did not clear in ${maxAttempts} attempts`);
}

async function advanceToNext(page: Page): Promise<void> {
  await expect.poll(async () => (await hook(page)).resultNextReady, { timeout: 10_000 }).toBe(true);
  await tapButton(page, 'result-next');
  await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');
}

test('L3 plateau: a stroke driven THROUGH the pillar still commits + the car interacts', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 20_000 }).toBe('Hub');

  // Reach L3 (sequential unlock) via the real clear→Next chain: L1 → L2 → L3.
  await tapButton(page, 'level-ch1-l01');
  await clearWithGhost(page, 'ch1-l01');
  await advanceToNext(page);
  await clearWithGhost(page, 'ch1-l02');
  await advanceToNext(page);

  // On L3: a V that DIVES THROUGH the central plateau (pillar top ≈ -0.3 m,
  // x ∈ [-0.7, 0.7]) — the dip to y=-1.2 is well inside the solid. Pre-fix this
  // line lay through the plateau; now the engine clips it to the outside runs.
  await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');
  await drawStroke(page, [
    [-2.8, 0.1],
    [-1.6, -0.2],
    [-0.6, -0.8],
    [0, -1.2],
    [0.6, -0.8],
    [1.6, -0.2],
    [2.8, 0.1],
  ]);

  // The clipped line COMMITS (the plateau is drawable — no stuck draw phase)…
  await expect.poll(async () => (await hook(page)).state, { timeout: 8_000 }).not.toBe('drawing');
  // …and the car interacts with the world, reaching a terminal outcome.
  await expect.poll(async () => (await hook(page)).state, { timeout: 45_000 }).toBe('result');
  expect((await hook(page)).outcome).not.toBeNull();
});

/**
 * campaign — full 18-level Chapter 1 playthrough (PRIORITY-0 user demand).
 *
 * Real-device report: "線が引けない箇所がある / 引っかからない地形がある → 進行不可能。
 * プレイ一通りができるテストを設計せよ" (some spots can't be drawn / some terrain has
 * no collision → progression impossible. Design a test that plays a full run).
 *
 * This machine-plays ALL 18 tiles IN DISPLAY ORDER (= the order the clear
 * screen's Next button walks, CHAPTER1_TILES: 15 main + 3 bonus) through the
 * REAL render + input + engine pipeline: for each level it loads the level's own
 * recorded GHOST stroke, worldToScreen()s it, draws it with real pointer events,
 * and asserts the attempt CLEARS. Between levels it advances ONLY via the clear
 * overlay's Next button (resultNextReady → tap result-next), so a full green run
 * proves the entire play + sequential-progression chain end-to-end — the exact
 * "can't draw / doesn't collide / can't progress" class the user hit on device.
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

/**
 * The dev hook is reached inside each browser closure by casting `window`
 * WITHOUT a `declare global` augmentation — l1-clear.spec.ts owns that global
 * declaration and re-declaring a structurally different shape is a TS2717
 * conflict, so we cast to a local window shape per evaluate() instead.
 */
type HookWindow = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __inkbridge?: InkbridgeHook;
};

/** CHAPTER1_TILES display order (src/render/ui/levelCatalog.ts): main+bonus interleaved. */
const LEVEL_ORDER = [
  'ch1-l01', 'ch1-l02', 'ch1-l03', 'ch1-l04', 'ch1-l05', 'ch1-b1',
  'ch1-l06', 'ch1-l07', 'ch1-l08', 'ch1-l09', 'ch1-l10', 'ch1-b2',
  'ch1-l11', 'ch1-l12', 'ch1-l13', 'ch1-l14', 'ch1-l15', 'ch1-b3',
] as const;

interface Snapshot {
  scene: string;
  state: string | null;
  tick: number;
  outcome: string | null;
  resultNextReady: boolean;
}

async function hook(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = (window as unknown as HookWindow).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state, tick: h.tick, outcome: h.outcome, resultNextReady: h.resultNextReady };
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

async function buttonRegistered(page: Page, id: string): Promise<boolean> {
  return page.evaluate((buttonId) => (window as unknown as HookWindow).__inkbridge?.buttonRect(buttonId) != null, id);
}

/** The level's own recorded ghost stroke — the single source of a known clear. */
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

test.describe('Chapter 1 full campaign', () => {
  // One long serial test that plays all 18 levels — well under the 8-min budget.
  test.describe.configure({ retries: 0 });

  test('plays all 18 levels in order via the clear→Next chain (progression unblocked)', async ({ page }) => {
    test.setTimeout(480_000);

    await page.goto('/');
    // Hub merges Home + LevelSelect (DESIGN.md §6.1): the grid is the entry screen.
    await expect.poll(async () => (await hook(page)).scene, { timeout: 20_000 }).toBe('Hub');

    // Sequential-unlock gate is live: L1 open, L2 still locked (not a registered tap target).
    expect(await buttonRegistered(page, 'level-ch1-l01'), 'L1 must be unlocked at start').toBe(true);
    expect(await buttonRegistered(page, 'level-ch1-l02'), 'L2 must be LOCKED before L1 is cleared').toBe(false);

    await tapButton(page, 'level-ch1-l01');
    await expect.poll(async () => (await hook(page)).state, { timeout: 15_000 }).toBe('drawing');

    const perLevelTicks: Array<{ id: string; ticks: number }> = [];

    // A real player redraws a missed line; the user's report is "progression
    // IMPOSSIBLE", not "hard". A level counts as a progression blocker only if it
    // never clears within a bounded number of honest redraw attempts — this also
    // absorbs the inherent nondeterminism of mouse-drawn strokes (the frame maps a
    // deep-pit level at low px/m, so pointer rounding is amplified in world space).
    const MAX_ATTEMPTS = 4;

    for (let i = 0; i < LEVEL_ORDER.length; i++) {
      const id = LEVEL_ORDER[i]!;
      const isLast = i === LEVEL_ORDER.length - 1;

      let hasCleared = false;
      let lastFail = '';
      let clearTick = 0;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !hasCleared; attempt++) {
        // A fresh drawing state for this attempt (initial entry or after a retry).
        await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');

        console.log(`▶ ${id} (${i + 1}/${LEVEL_ORDER.length}) attempt ${attempt} — drawing ghost`);
        await drawStroke(page, loadGhostStroke(id));

        // Commit → anticipation → running happens with no further input (BR-001).
        await expect.poll(async () => (await hook(page)).state, { timeout: 8_000 }).not.toBe('drawing');

        // Wait for a terminal outcome (clear or a real fail; divergence silent-resets).
        await expect.poll(async () => (await hook(page)).state, { timeout: 45_000 }).toMatch(/result|drawing/);
        const snap = await hook(page);
        if (snap.outcome === 'clear' && snap.state === 'result') {
          hasCleared = true;
          clearTick = snap.tick;
          console.log(`✓ ${id} cleared at tick ${snap.tick} (attempt ${attempt})`);
          break;
        }
        lastFail = `outcome=${snap.outcome} state=${snap.state} tick=${snap.tick}`;
        console.log(`… ${id} attempt ${attempt} did not clear (${lastFail}) — retrying`);
        if (snap.state === 'result') {
          await tapButton(page, 'result-retry'); // fail overlay → fresh drawing
        }
        // divergence path silent-resets to 'drawing' on its own; loop re-polls.
      }

      expect(hasCleared, `${id} did NOT clear in ${MAX_ATTEMPTS} attempts (${lastFail}) — real progression blocker`).toBe(true);
      perLevelTicks.push({ id, ticks: clearTick });

      if (isLast) break;

      // Progression: the clear overlay's Next activates (≤1s tempo) and advances
      // to the next tile in display order.
      await expect.poll(async () => (await hook(page)).resultNextReady, { timeout: 10_000 }).toBe(true);
      await tapButton(page, 'result-next');
      // Landed in a fresh drawing state on the NEXT level.
      await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');
    }

    // Every level in the chapter cleared, reached only by the clear→Next chain.
    expect(perLevelTicks.map((r) => r.id)).toEqual([...LEVEL_ORDER]);
    console.log('campaign per-level clear ticks:\n' + perLevelTicks.map((r) => `  ${r.id}: ${r.ticks}`).join('\n'));
  });
});

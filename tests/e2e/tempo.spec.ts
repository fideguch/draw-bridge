/**
 * T093 — tempo-contract E2E (KPI-003 / KPI-004, game_design §4.3 3-7 / §4.4 X-3).
 *
 * Scripted-ghost-driven: plays ch1-l01 → l02 → l03 in sequence via the clear
 * overlay's Next button, drawing each level's own recorded ghost stroke, and
 * asserts the Phase 6 tempo contracts:
 *   - the whole three-level run completes well under 90 s wall-clock;
 *   - a clear→replay→clear loop cycle completes ≤ 40 s (KPI-004);
 *   - the goal celebration's Next button activates 1.5-2.5 s after the results
 *     panel appears (§4.3 3-7) — measured via the dev hook's resultNextReady;
 *   - the celebration is tap-skippable: a tap mid-celebration jumps straight to
 *     an interactive results panel (§4.4 X-3).
 *
 * All interaction goes through real pointer events at coordinates resolved via
 * window.__inkbridge (see .fable/playscene-composition-spec.md + devhook.ts).
 * Serial workers (playwright.config.ts) keep the wall-clock measurements honest,
 * so the polls below are deliberately generous against CPU contention.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// A local view of the dev hook. This spec casts window inside each evaluate
// (rather than augmenting the global Window) so it never collides with the other
// e2e specs' own __inkbridge declarations under one shared tsconfig.
interface InkbridgeHook {
  scene: string;
  state: string | null;
  tick: number;
  outcome: string | null;
  resultNextReady: boolean;
  strokePointCount: number;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}

interface HookSnapshot {
  scene: string;
  state: string | null;
  outcome: string | null;
  resultNextReady: boolean;
}

async function hook(page: Page): Promise<HookSnapshot> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state, outcome: h.outcome, resultNextReady: h.resultNextReady };
  });
}

async function buttonRect(
  page: Page,
  id: string,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return h.buttonRect(buttonId);
  }, id);
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await buttonRect(page, id);
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/** Tap the upper-middle of the canvas — hits the celebration skip-catcher/scrim. */
async function tapToSkip(page: Page): Promise<void> {
  const size = page.viewportSize();
  const width = size?.width ?? 390;
  const height = size?.height ?? 844;
  await page.mouse.click(width / 2, height * 0.28);
}

/** A level's own recorded ghost stroke (single source of truth). */
function loadGhostStroke(levelId: string): ReadonlyArray<[number, number]> {
  const candidates = [
    join(process.cwd(), 'levels', `${levelId}.json`),
    join(process.cwd(), 'tests', 'fixtures', 'gate-levels', `${levelId}.json`),
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
  throw new Error(`${levelId} level JSON with a ghost stroke not found`);
}

const GHOSTS = {
  'ch1-l01': loadGhostStroke('ch1-l01'),
  'ch1-l02': loadGhostStroke('ch1-l02'),
  'ch1-l03': loadGhostStroke('ch1-l03'),
} as const;

async function drawStroke(page: Page, worldPoints: ReadonlyArray<[number, number]>): Promise<void> {
  const screenPoints = await page.evaluate((pts) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: InkbridgeHook }).__inkbridge;
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

/** Draw the level's ghost and wait for the clear outcome (tempo-bounded). */
async function drawToClear(page: Page, levelId: keyof typeof GHOSTS): Promise<void> {
  await drawStroke(page, GHOSTS[levelId]);
  await expect.poll(async () => (await hook(page)).state, { timeout: 5_000 }).not.toBe('drawing');
  await expect.poll(async () => (await hook(page)).outcome, { timeout: 25_000 }).toBe('clear');
}

async function navigateToL1Drawing(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 15_000 }).toBe('Home');
  await tapButton(page, 'home-play');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 5_000 }).toBe('LevelSelect');
  await tapButton(page, 'level-ch1-l01');
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('drawing');
}

const TIGHT: { intervals: number[] } = { intervals: [100, 100, 100] };

test('tempo: l01→l03 via Next — celebration skippable, Next 1.5-2.5s, loop ≤40s, total ≤90s', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const totalStart = Date.now();

  // ── L01: first clear ────────────────────────────────────────────────────────
  await navigateToL1Drawing(page);
  const loopStart = Date.now();
  await drawToClear(page, 'ch1-l01');

  // Panel reveal → measure the Next activation window (§4.3 3-7).
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000, ...TIGHT }).toBe('result');
  const resultAt = Date.now();
  expect((await hook(page)).resultNextReady).toBe(false); // not active the instant the panel shows
  await expect.poll(async () => (await hook(page)).resultNextReady, { timeout: 6_000, ...TIGHT }).toBe(true);
  const nextDelayMs = Date.now() - resultAt;
  expect(nextDelayMs).toBeGreaterThanOrEqual(1_500); // must NOT activate early
  expect(nextDelayMs).toBeLessThanOrEqual(3_000); // 2.5 s target + serial-CPU/poll slack

  // ── loop cycle: clear → replay → clear ≤ 40 s (KPI-004) ─────────────────────
  await tapButton(page, 'result-replay');
  await expect.poll(async () => (await hook(page)).state, { timeout: 5_000 }).toBe('drawing');
  await drawToClear(page, 'ch1-l01');
  const loopMs = Date.now() - loopStart;
  expect(loopMs).toBeLessThanOrEqual(40_000);

  // Advance to L02 via Next.
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('result');
  await expect.poll(async () => (await hook(page)).resultNextReady, { timeout: 6_000 }).toBe(true);
  await tapButton(page, 'result-next');

  // ── L02: skip the celebration mid-way, assert an interactive panel ──────────
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('drawing');
  await drawToClear(page, 'ch1-l02');
  await tapToSkip(page); // tap anywhere → jump straight to the results panel
  await expect.poll(async () => (await hook(page)).state, { timeout: 5_000, ...TIGHT }).toBe('result');
  expect(await buttonRect(page, 'result-replay')).not.toBeNull(); // interactive after skip
  await expect.poll(async () => (await hook(page)).resultNextReady, { timeout: 6_000 }).toBe(true);
  await tapButton(page, 'result-next');

  // ── L03: play through to close the three-level run ──────────────────────────
  await expect.poll(async () => (await hook(page)).state, { timeout: 10_000 }).toBe('drawing');
  await drawToClear(page, 'ch1-l03');

  const totalMs = Date.now() - totalStart;
  expect(totalMs).toBeLessThanOrEqual(90_000);
});

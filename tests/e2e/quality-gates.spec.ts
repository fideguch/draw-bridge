/**
 * Quality gates encoding the 2026-07-08 real-device feedback as machine checks.
 * EXPECTED TO FAIL on the pre-overhaul build — each test maps to a reported
 * defect; the overhaul turns them green and they stay as permanent regression
 * gates. Runs on the iPhone 14 chromium-emulation profile (deviceScaleFactor 3).
 */
import { expect, test, type Page } from '@playwright/test';

interface Hook {
  scene: string;
  state: string | null;
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
  worldToScreen(x: number, y: number): { x: number; y: number };
}

function getHook(page: Page): Promise<{ scene: string; state: string | null }> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    if (!h) throw new Error('hook missing');
    return { scene: h.scene, state: h.state };
  });
}

async function rect(page: Page, id: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge;
    return h?.buttonRect(buttonId) ?? null;
  }, id);
}

async function tapRect(page: Page, id: string, fx = 0.5, fy = 0.5): Promise<void> {
  const r = await rect(page, id);
  if (!r) throw new Error(`button not registered: ${id}`);
  // touchscreen (not mouse): exercises Phaser's touch path — the one real
  // devices use. fx/fy pick a point inside the target; off-centre points catch
  // the Phaser 4 Container displayOrigin quadrant bug (2026-07-08).
  await page.touchscreen.tap(r.x + r.width * fx, r.y + r.height * fy);
}

async function waitHub(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 15_000 }).toBe('Hub');
}

test('QG-1 crisp rendering: canvas backing resolution >= CSS size x devicePixelRatio (ガビガビ根絶)', async ({ page }) => {
  await waitHub(page);
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    return {
      backingW: canvas.width,
      cssW: box.width,
      dpr: window.devicePixelRatio,
    };
  });
  // Allow 10% slack for rounding; the point is 3x-class backing, not 1x.
  expect(metrics.backingW).toBeGreaterThanOrEqual(metrics.cssW * metrics.dpr * 0.9);
});

test('QG-2 full-bleed: canvas fills the entire viewport, no letterbox (黒縁根絶)', async ({ page }) => {
  await waitHub(page);
  const m = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    return { x: box.x, y: box.y, w: box.width, h: box.height, vw: window.innerWidth, vh: window.innerHeight };
  });
  expect(Math.abs(m.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.y)).toBeLessThanOrEqual(1);
  expect(m.w).toBeGreaterThanOrEqual(m.vw - 2);
  expect(m.h).toBeGreaterThanOrEqual(m.vh - 2);
});

test('QG-3 no overlapping tap targets on Hub (つづきから/強化重なり)', async ({ page }) => {
  await waitHub(page);
  const ids = ['hub-continue', 'hub-upgrade'];
  const rects = [];
  for (const id of ids) {
    const r = await rect(page, id);
    expect(r, `${id} must be registered`).not.toBeNull();
    rects.push({ id, ...r! });
  }
  const [a, b] = rects as [typeof rects[0], typeof rects[0]];
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  expect(overlapX * overlapY, 'tap targets must not intersect').toBe(0);
});

test('QG-4 every menu button is alive (押せないボタン根絶): full navigation sweep', async ({ page }) => {
  await waitHub(page);
  // Hub -> 強化 -> back -> Hub -> Settings -> back -> Hub -> Play flow.
  await tapRect(page, 'hub-upgrade');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('Upgrade');
  await tapRect(page, 'upgrade-back');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('Hub');
  await tapRect(page, 'hub-settings');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('Settings');
  await tapRect(page, 'settings-back');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('Hub');
  // CRITICAL repro: after round-trips, Hub buttons must STILL work — and at
  // an off-centre point (bottom-right area), not just dead centre. つづきから
  // launches the next uncleared level straight into Play (no LevelSelect).
  await tapRect(page, 'hub-continue', 0.8, 0.8);
  await expect.poll(async () => (await getHook(page)).state, { timeout: 10_000 }).toBe('drawing');
});

test('QG-5 stable world scale across 5 replays (画面縮小の蓄積根絶)', async ({ page }) => {
  await waitHub(page);
  await tapRect(page, 'level-ch1-l01');
  await expect.poll(async () => (await getHook(page)).state, { timeout: 10_000 }).toBe('drawing');

  const worldSpanPx = async (): Promise<number> =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge!;
      const a = h.worldToScreen(0, 0);
      const b = h.worldToScreen(1, 0);
      return Math.hypot(b.x - a.x, b.y - a.y);
    });

  const initial = await worldSpanPx();
  for (let i = 0; i < 5; i++) {
    await tapRect(page, 'hud-restart');
    await expect.poll(async () => (await getHook(page)).state, { timeout: 3_000 }).toBe('drawing');
    const now = await worldSpanPx();
    expect(Math.abs(now - initial) / initial, `replay ${i + 1}: world scale drifted`).toBeLessThanOrEqual(0.01);
  }
});

test('QG-6 stroke shape fidelity: a drawn arc must stay an arc after solidify (直線化根絶)', async ({ page }) => {
  await waitHub(page);
  await tapRect(page, 'level-ch1-l01');
  await expect.poll(async () => (await getHook(page)).state, { timeout: 10_000 }).toBe('drawing');

  // Draw a pronounced arc over the gap (world coords chosen for ch1-l01 geometry).
  const arc: Array<[number, number]> = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = -1.6 + t * 3.2;
    const y = 0.35 + Math.sin(t * Math.PI) * 0.55; // apex +0.55m — unmistakably curved
    arc.push([x, y]);
  }
  const pts = await page.evaluate((worldPts) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: Hook }).__inkbridge!;
    return worldPts.map(([x, y]) => h.worldToScreen(x, y));
  }, arc);
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();

  // Within 300ms of solidify (before major settling), the bridge's mid must
  // sit clearly ABOVE the chord — a straightened line fails this.
  await page.waitForTimeout(300);
  const midDeviation = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: { bridgeMidDeviationM?: () => number } }).__inkbridge!;
    return h.bridgeMidDeviationM ? h.bridgeMidDeviationM() : NaN;
  });
  // Hook extension required (bridgeMidDeviationM): perpendicular deviation of the
  // chain midpoint from the end-to-end chord, in meters. Drawn apex 0.55m must
  // retain at least 60% immediately after solidify.
  expect(midDeviation).toBeGreaterThanOrEqual(0.33);
});

test('QG-7 in-play navigation: pause menu reaches the Hub grid and resume works (動線)', async ({ page }) => {
  await waitHub(page);
  await tapRect(page, 'level-ch1-l01');
  await expect.poll(async () => (await getHook(page)).state, { timeout: 10_000 }).toBe('drawing');

  // Pause -> resume: still in the attempt.
  await tapRect(page, 'hud-pause');
  await tapRect(page, 'pause-resume');
  await expect.poll(async () => (await getHook(page)).state, { timeout: 3_000 }).toBe('drawing');

  // Pause -> level list: back on the Hub grid (the missing escape route).
  await tapRect(page, 'hud-pause');
  await tapRect(page, 'pause-levels');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('Hub');
});

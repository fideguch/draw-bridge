/**
 * AC-8 / NFR-002 probe — input -> state-reflection latency <= 100ms.
 * The stroke tip renders in the SAME frame the point is accepted (FR-001), so
 * hook.strokePointCount incrementing is a faithful proxy for visual reflection
 * (state mutation happens in the same rAF handler that redraws the stroke).
 * Median over several samples; generous vs one-off GC pauses, hard-fails only
 * when the median breaks the contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

interface LatencyHook {
  scene: string;
  state: string | null;
  strokePointCount: number;
  worldToScreen(x: number, y: number): { x: number; y: number };
  buttonRect(id: string): { x: number; y: number; width: number; height: number } | null;
}

function getHook(page: Page): Promise<{ scene: string; state: string | null }> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: LatencyHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return { scene: h.scene, state: h.state };
  });
}

async function tapButton(page: Page, id: string): Promise<void> {
  const rect = await page.evaluate((buttonId) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: LatencyHook }).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return h.buttonRect(buttonId);
  }, id);
  if (!rect) throw new Error(`button not registered: ${id}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

function l1StrokeStart(): [number, number] {
  const level = JSON.parse(
    readFileSync(join(process.cwd(), 'levels', 'ch1-l01.json'), 'utf-8'),
  ) as { ghostSolutions: Array<{ stroke: Array<[number, number]> }> };
  return level.ghostSolutions[0]!.stroke[0]!;
}

test('input -> stroke-state reflection median <= 100ms (NFR-002 probe)', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 15_000 }).toBe('Home');
  await tapButton(page, 'home-play');
  await expect.poll(async () => (await getHook(page)).scene, { timeout: 5_000 }).toBe('LevelSelect');
  await tapButton(page, 'level-ch1-l01');
  await expect.poll(async () => (await getHook(page)).state, { timeout: 10_000 }).toBe('drawing');

  const [wx, wy] = l1StrokeStart();
  const start = await page.evaluate(
    ([x, y]) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const h = (window as unknown as { __inkbridge?: LatencyHook }).__inkbridge!;
      return h.worldToScreen(x!, y!);
    },
    [wx, wy],
  );

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  // In-page measurement: dispatch a real pointermove per sample and await the
  // point-count increment via rAF polling — no protocol round-trip in the
  // measured window.
  const samples = await page.evaluate(async ({ x, y }) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const h = (window as unknown as { __inkbridge?: LatencyHook }).__inkbridge!;
    const canvas = document.querySelector('canvas')!;
    const results: number[] = [];
    let px = x;
    for (let i = 0; i < 8; i++) {
      px += 14; // > min vertex distance, stays on the L1 platform span
      const before = h.strokePointCount;
      const t0 = performance.now();
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: px,
          clientY: y,
          bubbles: true,
          isPrimary: true,
          pointerType: 'touch',
        }),
      );
      const t1 = await new Promise<number>((resolve) => {
        const poll = (): void => {
          if (h.strokePointCount > before) resolve(performance.now());
          else requestAnimationFrame(poll);
        };
        poll();
      });
      results.push(t1 - t0);
    }
    return results;
  }, { x: start.x, y: start.y });

  await page.mouse.up();

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  console.log(`input-latency samples (ms): ${samples.map((s) => s.toFixed(1)).join(', ')} | median ${median.toFixed(1)}`);
  expect(median).toBeLessThanOrEqual(100);
});

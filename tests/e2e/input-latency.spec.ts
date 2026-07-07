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

  // Measurement: t0 = the trusted pointermove's own event.timeStamp captured by
  // a window capture-phase listener (page clock, before Phaser handles it);
  // t1 = rAF tick where strokePointCount has incremented. Playwright protocol
  // latency stays outside the measured window.
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const h = (window as unknown as { __inkbridge?: LatencyHook }).__inkbridge!;
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const w = window as unknown as { __latencyArm?: Promise<number> };
      const before = h.strokePointCount;
      w.__latencyArm = new Promise<number>((resolve) => {
        const onMove = (ev: PointerEvent): void => {
          window.removeEventListener('pointermove', onMove, true);
          const t0 = ev.timeStamp;
          const poll = (): void => {
            if (h.strokePointCount > before) resolve(performance.now() - t0);
            else requestAnimationFrame(poll);
          };
          poll();
        };
        window.addEventListener('pointermove', onMove, true);
      });
    });
    await page.mouse.move(start.x + 14 * (i + 1), start.y);
    const sample = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const w = window as unknown as { __latencyArm?: Promise<number> };
      return w.__latencyArm!;
    });
    samples.push(sample);
  }

  await page.mouse.up();

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  console.log(`input-latency samples (ms): ${samples.map((s) => s.toFixed(1)).join(', ')} | median ${median.toFixed(1)}`);
  expect(median).toBeLessThanOrEqual(100);
});

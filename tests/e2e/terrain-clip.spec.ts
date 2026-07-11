/**
 * Round-4 E2E — stroke × terrain clipping on a solid-heavy level (ch1-l03).
 *
 * User bug (screenshot): "線が引けない土台があります" — a line drawn across / into a
 * solid feature lay through the solid. The engine now clips a stroke to the parts
 * OUTSIDE solid terrain and commits the longest run. This test reaches L3 through
 * the real clear→Next chain, then draws a line that DIVES THROUGH solid terrain
 * and proves the clipped line still commits and the car reaches a terminal outcome
 * (the solid is drawable again — the bug is gone).
 *
 * GEOMETRY-INDEPENDENCE: the penetrating stroke is DERIVED from the level's own
 * terrain + recorded ghost (deriveTerrainPiercingStroke), never hardcoded. The
 * earlier version hardcoded a single-pillar L3's coordinates and rotted when L3
 * was redesigned into the multi-seal layout; deriving the stroke keeps the test
 * verifying the intent across future L3 redesigns. The derivation self-checks that
 * the probe is truly inside a solid AND that the stroke actually clips, so a
 * redesign that invalidates the assumption fails LOUD instead of silently no-op.
 *
 * Dev hook (window.__inkbridge): scene/state/outcome/resultNextReady +
 * worldToScreen(x,y) + buttonRect(id). See src/render/devhook.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { validateLevel, type Level, type Polyline } from '../../src/engine/level/LevelSchema';
import { buildTerrainSolids, isPointInSolids } from '../../src/engine/physics/TerrainSolids';
import { clipStrokeToSolids } from '../../src/engine/physics/StrokeClipper';

/**
 * Metres to plunge the penetration probe straight DOWN from the ghost's goal-side
 * anchor into the solid shelf it rests on. Deep past the engine's SURFACE_SKIN_M
 * (0.55 m — a graze tolerance) so the segment genuinely crosses the surface and
 * clips; a top-solid feature seals down to a closure plane ~100 m below the
 * terrain, so any depth beyond the skin stays inside the solid (derivation
 * self-checks via isPointInSolids, so this need only clear the skin comfortably).
 */
const SOLID_DIVE_DEPTH_M = 3;

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

/** Read + validate a level JSON (world-metre geometry, engine-authoritative). */
function loadLevel(levelId: string): Level {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'levels', `${levelId}.json`), 'utf-8'));
  const parsed = validateLevel(raw);
  if (!parsed.ok) throw new Error(`${levelId}: invalid level — ${parsed.errors.join(' | ')}`);
  return parsed.level;
}

function loadGhostStroke(levelId: string): Polyline {
  const stroke = loadLevel(levelId).ghostSolutions[0]?.stroke;
  if (!stroke || stroke.length < 2) throw new Error(`${levelId}: no ghost stroke`);
  return stroke;
}

/**
 * Derive a stroke that PENETRATES solid terrain for the CURRENT geometry of
 * `levelId`, with no hardcoded terrain coordinates: take the recorded ghost
 * clearing arc and extend it with a probe that dives straight DOWN into the solid
 * shelf under its goal-side anchor. The engine clips the buried tail and keeps the
 * clearing arc as the longest OUTSIDE run, so the car still crosses and clears —
 * proving a through-solid line commits (round-4 bug) without pinning where the
 * solid is. Fails LOUD if the probe is not inside a solid / the stroke does not
 * clip, so a future redesign re-derives the dive instead of silently no-op'ing.
 */
function deriveTerrainPiercingStroke(levelId: string): Polyline {
  const level = loadLevel(levelId);
  const ghost = loadGhostStroke(levelId);
  const anchor = ghost[ghost.length - 1] as readonly [number, number];
  const probe: readonly [number, number] = [anchor[0], anchor[1] - SOLID_DIVE_DEPTH_M];

  const solids = buildTerrainSolids(level.terrain, level.killY, undefined, level.id);
  if (!isPointInSolids({ x: probe[0], y: probe[1] }, solids)) {
    throw new Error(
      `${levelId}: derived dive probe (${probe[0]}, ${probe[1]}) is not inside solid terrain — ` +
        `L3 geometry changed; re-derive the penetration (see SOLID_DIVE_DEPTH_M)`,
    );
  }
  const stroke: Polyline = [...ghost, probe];
  const clip = clipStrokeToSolids(
    stroke.map(([x, y]) => ({ x, y })),
    solids,
  );
  if (!clip.clipped) {
    throw new Error(`${levelId}: derived stroke does not pierce solid terrain (clip no-op) — cannot exercise clipping`);
  }
  return stroke;
}

async function drawStroke(page: Page, worldPoints: Polyline): Promise<void> {
  // Copy to mutable [x, y] pairs for the (serialized) browser boundary.
  const pairs: [number, number][] = worldPoints.map(([x, y]) => [x, y]);
  const screenPoints = await page.evaluate((pts) => {
    const h = (window as unknown as HookWindow).__inkbridge;
    if (!h) throw new Error('__inkbridge dev hook missing');
    return pts.map(([x, y]) => h.worldToScreen(x, y));
  }, pairs);

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

test('L3: a stroke driven THROUGH solid terrain still commits + the car reaches a terminal outcome', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto('/');
  await expect.poll(async () => (await hook(page)).scene, { timeout: 20_000 }).toBe('Hub');

  // Reach L3 (sequential unlock) via the real clear→Next chain: L1 → L2 → L3.
  await tapButton(page, 'level-ch1-l01');
  await clearWithGhost(page, 'ch1-l01');
  await advanceToNext(page);
  await clearWithGhost(page, 'ch1-l02');
  await advanceToNext(page);

  // On L3: a line DERIVED from the level's own terrain + ghost (no hardcoded
  // coordinates) that dives THROUGH solid terrain — the clearing arc extended by
  // a probe plunging into the solid shelf beneath its goal-side anchor. Pre-fix
  // such a line lay through the solid and got stuck; now the engine clips the
  // buried tail and keeps the clearing arc as the longest outside run.
  const piercingStroke = deriveTerrainPiercingStroke('ch1-l03');
  await expect.poll(async () => (await hook(page)).state, { timeout: 20_000 }).toBe('drawing');
  await drawStroke(page, piercingStroke);

  // The clipped line COMMITS (the solid is drawable — no stuck draw phase)…
  await expect.poll(async () => (await hook(page)).state, { timeout: 8_000 }).not.toBe('drawing');
  // …and the car interacts with the world, reaching a terminal outcome.
  await expect.poll(async () => (await hook(page)).state, { timeout: 45_000 }).toBe('result');
  expect((await hook(page)).outcome).not.toBeNull();
});

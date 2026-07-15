/**
 * Chapter 1, levels 01–12 — ROUND-9 v2 REDESIGN (CS-4a).
 *
 * The BINDING source is designs/levels_round9.md (designer-approved 40-level
 * table, rows 1–12). These twelve levels are authored as schemaVersion 2:
 *   - objective per the table (coins = collect all, noBreak = zero segment break),
 *   - dangerZones use ONLY style 'zone' (v2 red rects that BLOCK drawing + kill),
 *   - objective-based stars (star3 = ghost ink × ~1.35, derived by authoring.ts),
 *   - NO spikes / needles anywhere (AC-4 ban), NO blocker-defense against free
 *     lines (BR-015): difficulty is honest terrain/hazard GEOMETRY.
 *
 * PORTRAIT-FIRST FRAMING (sizeStandards Gate 4): every level carries a deep chasm
 * (~−5…−6 m) or a tall climb so the readable-window ratio(H/W) clears its tier
 * floor (0.7) — the round-8 slate did the same. Spawn↔goal ≈ 12 m so D_sg clears.
 *
 * DATA ONLY — consumed by scripts/levels/authoring.ts, which runs each ghost at
 * Lv0 through the real engine, derives the ink economy, records the clearing
 * ghost, auto-places coins on the driven route (100 %-collectible gate), and
 * emits levels/<id>.json. Coordinates: world metres, y-up. Terrain authored
 * left→right = TOP solid.
 */

import { arch, coinArc, flag, p, pillar, spline, twoPlatforms } from './patterns';
import type { LevelSource } from './ch1';
import type { Point } from '../../src/engine/level/LevelSchema';

/** Convert Points into a terrain [x,y] polyline. */
function pl(...pts: readonly Point[]): [number, number][] {
  return pts.map((q) => [q.x, q.y]);
}

/** N placeholder coins — authoring re-places them ON the driven route (COUNT persists). */
function coinCount(n: number): Point[] {
  return coinArc(0, 1.2, n, 0.5, 0.3);
}

export const CH1_V2_SOURCES: readonly LevelSource[] = [
  // ── L1 (row 1) — Bridge / S · coins · Δgoal 0 ──────────────────────────────
  // "離す＝走る" tutorial: a shallow 2.8 m pit between flat banks; any line works.
  // A deep chasm (−4.8) supplies the portrait framing (S ratio 0.7).
  {
    id: 'ch1-l01',
    design: 'Bridge/S: 浅い谷を1本の橋で渡る最初の一歩（離す＝走る）— levels_round9 row1',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -7, leftRim: -1.4, leftY: 0, rightRim: 1.4, rightY: 0, rightFar: 7, chasmY: -4.8 }),
    vehicleSpawn: p(-5, 0.35),
    goalFlag: flag(5, 0, 1, 2),
    killY: -4.8,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'road-bridge', points: arch(-1.9, 0.06, 1.9, 0.06, 0.12) }],
  },

  // ── L2 (row 2) — Bridge / M · coins · Δgoal 0 ──────────────────────────────
  // "sag & support": a wider 4 m pit crossed by a firm up-bow bridge resting on
  // both rims (a drawn scoop over 4 m collapses; a compression bow holds).
  {
    id: 'ch1-l02',
    design: 'Bridge/M: 4mの谷を1本の橋で支えて渡る — levels_round9 row2',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -8, leftRim: -1.7, leftY: 0, rightRim: 1.7, rightY: 0, rightFar: 8, chasmY: -6 }),
    vehicleSpawn: p(-6, 0.35),
    goalFlag: flag(6, 0, 1, 2),
    killY: -6,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'support-bridge', points: arch(-2.6, 0.06, 2.6, 0.06, 0.16) }],
  },

  // ── L3 (row 3) — Climb / M · coins · Δgoal +1.5 ────────────────────────────
  // "ramp slope": low-left bank → a mid-ledge → high-right goal (+1.5 m). Two short
  // ramps rest on a central mesa (a single 5 m rising span collapses). A flat
  // horizontal line ends BELOW the raised goal and cannot clear (goal-above-start
  // geometry, BR-015 — no blocker needed).
  {
    id: 'ch1-l03',
    design: 'Climb/M: 低い左岸→中棚→+1.5mの高い右ゴールへ二段のランプで登る（平線は届かない）— levels_round9 row3',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-8, 0), p(-2.2, 0), p(-2.4, -5.5)), // low-left bank y0
      pl(p(-1.3, -5.5), p(-1.1, 0.75), p(1.1, 0.75), p(1.3, -5.5)), // wide central mesa (top y0.75) — short firm spans
      pl(p(2.4, -5.5), p(2.2, 1.5), p(8, 1.5)), // high-right bank y1.5
    ],
    vehicleSpawn: p(-6, 0.35),
    goalFlag: flag(6, 1.5, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'two-ramp-climb', points: spline([p(-2.7, 0.06), p(-1.5, 0.5), p(-1.05, 0.77), p(1.05, 0.77), p(1.5, 1.15), p(2.7, 1.56)]) }],
  },

  // ── L4 (row 4) — Red / M · coins · Δgoal 0 ─────────────────────────────────
  // "red = no-draw + death": a red rect fills the LOWER half of the pit. The
  // bridge spans the upper gap with comfortable clearance (never grazing the rect,
  // which also BLOCKS drawing); a naive idle car drives off the rim, falls, and
  // dies on the red floor (hazard-relevance attribution).
  {
    id: 'ch1-l04',
    design: 'Red/M: 谷の下半分を赤帯が埋める。上の隙間を橋で渡る（赤は描画禁止＋接触即死）— levels_round9 row4',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -8, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 8, chasmY: -6 }),
    vehicleSpawn: p(-6, 0.35),
    goalFlag: flag(6, 0, 1, 2),
    killY: -6,
    coins: coinCount(5),
    dangerZones: [{ x: -2, y: -6, width: 4, height: 5.0, style: 'zone' }], // top −1.0: fills the lower pit
    strokes: [{ kind: 'any', role: 'span-over-red', points: arch(-2.9, 0.06, 2.9, 0.06, 0.22) }],
  },

  // ── L5 (row 5) — Bridge / M · coins · Δgoal +1 ─────────────────────────────
  // Mastery check 1: a 4 m pit to a +1 m goal, generous ink, obvious multiple
  // families (flat ramp vs bowed arch). Δgoal +1 keeps a pure flat line short.
  {
    id: 'ch1-l05',
    design: 'Bridge/M: 4mの谷を渡り+1mのゴールへ。潤沢なインクで複数の解 — levels_round9 row5',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -8, leftRim: -2, leftY: 0, rightRim: 2, rightY: 1, rightFar: 8, chasmY: -5 }),
    vehicleSpawn: p(-6, 0.35),
    goalFlag: flag(6, 1, 1, 2),
    killY: -5,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'climb-bridge', points: arch(-2.5, 0.06, 2.5, 1.06, 0.18) }],
  },

  // ── L6 (row 6) — Descent / M · noBreak · Δgoal −2 ──────────────────────────
  // "landing control": a high-left bank drops −2 m to a low-right goal across a
  // gap; a smooth firm down-ramp beats a free fall. noBreak objective: the ramp
  // is a firm supported plank (rests on both rims → zero segment break).
  {
    id: 'ch1-l06',
    design: 'Descent/M: 高い左岸から−2mの低いゴールへ、なめらかな下りランプで着地（noBreak）— levels_round9 row6',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -8, leftRim: -2, leftY: 2, rightRim: 2, rightY: 0, rightFar: 8, chasmY: -5 }),
    vehicleSpawn: p(-6, 2.35),
    goalFlag: flag(6, 0, 1, 2),
    killY: -5,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'descent-ramp', points: arch(-2.5, 2.06, 2.5, 0.06, 0.12) }],
  },

  // ── L7 (row 7) — Red / L · coins · Δgoal 0 ─────────────────────────────────
  // "arc over protruding red": a narrow red rect PROTRUDES above a flat road mid
  // route; the bridge arcs over its top. A naive car driving the road runs INTO
  // the red and dies (attribution). Deep road ends supply the portrait framing.
  {
    id: 'ch1-l07',
    design: 'Red/L: 平らな道の中央に赤帯が突き出す。頭上を弓で越える（素直に走ると赤へ突っ込む）— levels_round9 row7',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, -7), p(-8, 0), p(8, 0), p(9, -7)), // flat road y0 with deep ends (framing)
    ],
    vehicleSpawn: p(-6.5, 0.35),
    goalFlag: flag(6.5, 0, 1, 2),
    killY: -7,
    coins: coinCount(6),
    dangerZones: [{ x: -0.5, y: -7, width: 1.0, height: 7.5, style: 'zone' }], // top +0.5: a narrow red bump above the road
    strokes: [{ kind: 'any', role: 'arc-over-red', points: spline([p(-2.7, 0.02), p(-1.5, 0.55), p(-0.6, 1.15), p(0, 1.25), p(0.6, 1.15), p(1.5, 0.55), p(2.7, 0.02)]) }],
  },

  // ── L8 (row 8) — Breather / L · coins · Δgoal 0 ────────────────────────────
  // Free-shape breather: gentle rolling ground over a deep valley, a coin trail
  // the player rakes with any relaxed line. No hazard.
  {
    id: 'ch1-l08',
    design: 'Breather/L: ゆるやかな起伏の地形とコインの列。好きな形の線で流し取る — levels_round9 row8',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2.0, leftY: 0.4, rightRim: 2.0, rightY: 0.4, rightFar: 9, chasmY: -6 }),
    vehicleSpawn: p(-6.5, 0.75),
    goalFlag: flag(6.5, 0.4, 1, 2),
    killY: -6,
    coins: coinCount(7),
    strokes: [{ kind: 'any', role: 'rolling-line', points: arch(-2.9, 0.42, 2.9, 0.42, 0.2) }],
  },

  // ── L9 (row 9) — Bridge / M · noBreak · Δgoal 0 ────────────────────────────
  // "mid support reuse": two pits with a small central island the bridge rests on,
  // splitting the crossing into two short firm spans. noBreak objective.
  {
    id: 'ch1-l09',
    design: 'Bridge/M: 二つの谷と中央の小島。島に載せて二つの短い橋に分ける（noBreak）— levels_round9 row9',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0), p(-2.6, 0), p(-2.8, -6)),
      pillar(0, 0.0, -6, 0.7, 1.1), // central island (flat top y0)
      pl(p(2.8, -6), p(2.6, 0), p(9, 0)),
    ],
    vehicleSpawn: p(-6, 0.35),
    goalFlag: flag(6, 0, 1, 2),
    killY: -6,
    coins: coinCount(5),
    strokes: [{ kind: 'any', role: 'two-span-bridge', points: spline([p(-2.9, 0.04), p(-1.4, -0.05), p(0, 0.04), p(1.4, -0.05), p(2.9, 0.04)]) }],
  },

  // ── L10 (row 10) — Red + Climb / L · coins · Δgoal +2 ──────────────────────
  // Draft-1 archetype: a mid platform, a red block, then a raised goal (+2 m). The
  // route climbs from the mid platform over the red rect (which blocks drawing +
  // kills) to the high goal.
  {
    id: 'ch1-l10',
    design: 'Red+Climb/L: 中段の足場→赤帯→+2mの高いゴール。赤の上を越えて登る — levels_round9 row10',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0), p(-2.2, 0), p(-2.4, -5.5)), // low-left platform y0
      pl(p(2.4, -5.5), p(2.2, 2), p(9, 2)), // high-right goal shelf y2
    ],
    vehicleSpawn: p(-6.3, 0.35),
    goalFlag: flag(6, 2, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    dangerZones: [{ x: -1.4, y: -5.5, width: 2.8, height: 4.0, style: 'zone' }], // red block in the pit, top −1.5
    strokes: [{ kind: 'any', role: 'climb-over-red', points: arch(-2.6, 0.06, 2.6, 2.06, 0.5) }],
  },

  // ── L11 (row 11) — Rock / L · noBreak · Δgoal 0 ────────────────────────────
  // "BridgeChain shields the car from a rock": a boulder rests on the pit floor;
  // the drawn line carries the car ABOVE it (a rock touching the CAR is a loss, the
  // drawn chain is unaffected). noBreak objective. A naive idle car drops into the
  // (floored) pit and dies on the boulder (attribution). CARD DEVIATION: a static
  // floor boulder replaces the "rolls from right slope" dynamic — round-8 measured
  // dynamic/timed rocks as unattributable under Gate 2.6; the shield mechanic holds.
  {
    id: 'ch1-l11',
    design: 'Rock/L: 谷底に鎮座する岩。描いた橋が車を岩の上へ渡す盾になる（岩は橋を素通り）— levels_round9 row11',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.0, 0.4), p(-2.2, -5.5), p(2.2, -5.5), p(2.0, 0.4), p(9, 0.4)), // U-pit with a solid floor the boulder rests on
    ],
    vehicleSpawn: p(-6.4, 0.75),
    goalFlag: flag(6, 0.4, 1, 2),
    killY: -5.5,
    coins: coinCount(5),
    rocks: [{ x: 0, y: -5.0, radius: 0.5, density: 5 }], // rests on the pit floor (−5.5) where the idle car falls
    strokes: [{ kind: 'any', role: 'shield-bridge', points: arch(-2.9, 0.42, 2.9, 0.42, 0.28) }],
  },

  // ── L12 (row 12) — Wow / L · coins · Δgoal −1 ──────────────────────────────
  // "speed → distance flight": a long descent builds speed, a short flat runway
  // aims it, then the car FLIES a gap and lands on a lower shelf (spike-round9-jump:
  // gap/distance flight works, height gain does not — landing sits below takeoff).
  // GAP realised at ~3 m (the measured reliable-fly distance for this car); the
  // design's 5 m is the aspiration, capped to the physics envelope (no re-tuning).
  {
    id: 'ch1-l12',
    design: 'Wow/L: 長い下りで加速し、短い助走から谷を飛び越えて低い棚へ着地（距離の跳躍）— levels_round9 row12',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-13, 3.5), p(-8, 3.5), p(-1.5, -1.5), p(-1.0, -1.5), p(-0.8, -8.5)), // shelf → long TERRAIN descent (5 m drop) → runway → takeoff edge
      pl(p(0.5, -8.5), p(0.7, -3.0), p(10, -3.0)), // landing shelf y−3.0 (below takeoff), ~1.3 m gap
    ],
    vehicleSpawn: p(-10, 3.85),
    goalFlag: flag(7.5, -3.0, 1, 2),
    killY: -8.5,
    coins: coinCount(6),
    // Ghost = a launch pad on the high shelf; the TERRAIN carries the long descent,
    // runway, and takeoff, so the car FLIES the gap on gravity + engine and the drawn
    // chain is ridden ONLY on the flat shelf (zero ridden shove → Gate 6 safe). The
    // ~1.3 m gap is the physics-feasible fly for a ground-driven car (design's 5 m
    // capped to the measured envelope — spike-round9-jump: distance flight, not height).
    strokes: [{ kind: 'any', role: 'launch-pad', points: arch(-11.5, 3.52, -8.5, 3.52, 0.08) }],
  },
];

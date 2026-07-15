/**
 * Chapter 1, levels 13–28 — ROUND-9 v2 REDESIGN (CS-4b).
 *
 * BINDING source: designs/levels_round9.md rows 13–28 (designer-approved slate).
 * These sixteen levels are authored as schemaVersion 2, exactly like CS-4a's
 * ch1-levels-01-12.ts:
 *   - objective per the table (coins = collect all, noBreak = zero segment break),
 *   - dangerZones use ONLY style 'zone' (v2 red rects that BLOCK drawing + kill),
 *   - persons[] where the table calls for them (a static AABB the CAR must route
 *     over/around; car overlap = 'personContact' loss; the drawn line is unaffected),
 *   - static/settled rocks only (round-8: dynamic/timed rocks are unattributable),
 *   - objective stars (star3 = ghost ink × ~1.35, derived by authoring.ts),
 *   - NO spikes / needles anywhere (AC-4 ban), NO blocker-defense against free
 *     lines (BR-015): difficulty is honest terrain / hazard / person GEOMETRY.
 *
 * PORTRAIT-FIRST FRAMING (sizeStandards Gate 4): every level carries a deep chasm
 * (framed pit view = rim−3 m) or a tall climb so the readable window clears its
 * tier floor. L-tier chasms sit ≈−6 m, XL ≈−7…−8 m (measured to the exact floors).
 *
 * JUMP GATE (levels_round9 header, .fable/spike-round9-jump.md): ground-level ramps
 * add only ≤0.74 m apex, so a person is NEVER cleared from flat ground. Feasible
 * flight = ELEVATED-TAKEOFF: the ramp END sits ≥1.9 m above the person's ground, so
 * the car is already above the person at launch and sails over it (L25). Every
 * person level otherwise BRIDGES-OVER (the sanctioned fallback): the drawn line
 * carries the car above the person's 1.7 m silhouette. Every flight/over route is
 * PROVEN by a recorded ghost through the real v2 commit path (authoring fails loud
 * if the car touches a person or lands short). NO physics re-tuning (round-7 lesson).
 *
 * DATA ONLY — consumed by scripts/levels/authoring.ts (measure → derive economy →
 * record ghosts → auto-place coins on the driven route → validate → emit). World
 * metres, y-up; terrain authored left→right = TOP solid.
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

/**
 * Person AABB centre for a person STANDING on ground surface `groundY`.
 * TuningConstants person.halfHeight = 0.85, so centre y = groundY + 0.85 and the
 * silhouette spans groundY … groundY+1.7. The CAR must ride ABOVE that.
 */
function personOn(x: number, groundY: number): Point {
  return p(x, groundY + 0.85);
}

export const CH1_V2_SOURCES_13_28: readonly LevelSource[] = [
  // ── L13 (row 13) — Breather / L · coins · Δgoal 0 ──────────────────────────
  // Consolidation breather: a gentle valley crossed by any relaxed line; a coin
  // trail rakes the arc. Deep chasm (−6) supplies the L portrait framing.
  {
    id: 'ch1-l13',
    design: 'Breather/L: ゆるやかな谷を好きな線で渡りコインを流し取る一息ステージ — levels_round9 row13',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2.2, leftY: 0.4, rightRim: 2.2, rightY: 0.4, rightFar: 9, chasmY: -6 }),
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.6, 0.4, 1, 2),
    killY: -6,
    coins: coinCount(7),
    strokes: [{ kind: 'any', role: 'rolling-line', points: arch(-3.0, 0.42, 3.0, 0.42, 0.22) }],
  },

  // ── L14 (row 14) — Person / L · coins · Δgoal 0 ────────────────────────────
  // FIRST PERSON — "person = fail on touch". A person stands on a pedestal in the
  // valley; the drawn line is the ELEVATED road that carries the car OVER their
  // head (top 1.7). A saggy/low line drops the car onto the person (personContact);
  // the intended up-bow arch stays above them. Deep chasm frames it (L).
  {
    id: 'ch1-l14',
    design: 'Person/L: 谷の中央に立つ人を、頭上を越える高い橋（弓）で避けて渡る。低い線は人に当たって失敗 — levels_round9 row14 (first person)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0), p(-2.4, 0), p(-2.6, -8)),
      pillar(0, -1.4, -8, 0.9, 1.3), // person pedestal (top −1.4): the person's head reaches +0.3, so a flat line grazes them but an up-bow clears
      pl(p(2.6, -8), p(2.4, 0), p(9, 0)),
    ],
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -8,
    coins: coinCount(6),
    persons: [personOn(0, -1.4)], // stands on the pedestal (top −1.4); silhouette −1.4…+0.3
    strokes: [{ kind: 'any', role: 'over-person-arch', points: arch(-2.7, 0.05, 2.7, 0.05, 0.95) }],
  },

  // ── L15 (row 15) — Person + Descent / L · noBreak · Δgoal −1.5 ─────────────
  // Draft-3 seed: a high-left bank descends to a low-right goal, a person waits in
  // the gap. BRIDGE-OVER (the sanctioned fallback to elevated-takeoff): the drawn
  // line bows OVER the person's head, then rides down to the goal — one firm
  // supported plank (noBreak). A straight descent dips into the person.
  {
    id: 'ch1-l15',
    design: 'Person+Descent/L: 高い左岸から降りる途中の人を、頭上を弓で越えてから低い右ゴールへ着地（noBreak・橋渡し） — levels_round9 row15',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 1.5), p(-2.4, 1.5), p(-2.6, -6.5)),
      pillar(0, -1.2, -6.5, 0.9, 1.3), // person pedestal (top −1.2): head reaches +0.65
      pl(p(2.6, -6.5), p(2.4, 0), p(9, 0)),
    ],
    vehicleSpawn: p(-6.6, 1.85),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -6.5,
    coins: coinCount(6),
    persons: [personOn(0, -1.2)], // silhouette −1.2…+0.65
    strokes: [{ kind: 'any', role: 'over-person-descent', points: arch(-2.9, 1.55, 2.9, 0.05, 0.8) }],
  },

  // ── L16 (row 16) — Breather / L · coins · Δgoal 0 ──────────────────────────
  // Combo consolidation breather: a small pit whose LOWER half is a plain red block
  // (blocks drawing + kills). The bridge spans the upper gap with comfortable
  // clearance; a naive idle car drives off the rim onto the red (hazardContact).
  {
    id: 'ch1-l16',
    design: 'Breather/L: 小さな谷の下半分を赤帯が埋める。上の隙間を橋で渡る（無線の車は赤に落ちる）— levels_round9 row16',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 9, chasmY: -8 }),
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -8,
    coins: coinCount(6),
    dangerZones: [{ x: -2, y: -8, width: 4, height: 7.2, style: 'zone' }], // top −0.8: fills the lower pit
    strokes: [{ kind: 'any', role: 'span-over-red', points: arch(-2.9, 0.06, 2.9, 0.06, 0.22) }],
  },

  // ── L17 (row 17) — Rock / L · coins · Δgoal 0 ──────────────────────────────
  // Route ABOVE the rock's path. A boulder rests on the pit floor; the drawn bridge
  // carries the car above it (a rock touching the CAR is a loss; the chain is
  // unaffected). A naive idle car drops into the pit onto the boulder (hazardContact).
  // CARD DEVIATION: a static floor boulder replaces the "own ledge" dynamic — round-8
  // measured dynamic/timed rocks as unattributable (Gate 2.6); the shield holds.
  {
    id: 'ch1-l17',
    design: 'Rock/L: 谷底の岩の上を橋で渡る（岩は橋を素通り、車に触れると失敗）。無線の車は谷底の岩へ落ちる — levels_round9 row17 (static rock)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.4, 0.4), p(-2.6, -7.5), p(2.6, -7.5), p(2.4, 0.4), p(9, 0.4)), // U-pit with a solid floor
    ],
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.6, 0.4, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    rocks: [{ x: 0, y: -7.0, radius: 0.5, density: 5 }], // rests on the pit floor (−7.5) where the idle car falls
    strokes: [{ kind: 'any', role: 'shield-bridge', points: arch(-3.0, 0.42, 3.0, 0.42, 0.3) }],
  },

  // ── L18 (row 18) — Climb / XL · coins · Δgoal +3.2 ─────────────────────────
  // Draft-2 archetype: a long low ground, a pit, a TALL goal +3.2 m. The DRAWN line
  // does the climbing — it crosses the pit and rises over a central mid-support to
  // the high shelf. A flat line stays low and cannot reach the raised goal (the
  // climb concept is enforced by goal-above geometry, BR-015 — no blocker).
  {
    id: 'ch1-l18',
    design: 'Climb/XL: 長い低地→谷→+3.2mの高いゴール。描いた線で谷を渡り中央支点を経て登る（平線は届かない）— levels_round9 row18 (Draft-2)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-11.5, 0), p(-2.6, 0), p(-2.8, -7)), // long low left ground
      pillar(0, 1.6, -7, 0.6, 1.0), // central support at mid-climb height (splits +3.2 into two firm spans)
      pl(p(2.8, -7), p(2.6, 3.2), p(10.5, 3.2)), // tall right goal shelf +3.2
    ],
    vehicleSpawn: p(-8.2, 0.35),
    goalFlag: flag(7.2, 3.2, 1, 2),
    killY: -7,
    coins: coinCount(6),
    strokes: [
      {
        kind: 'any',
        role: 'two-span-climb',
        points: spline([p(-2.95, 0.05), p(-1.4, 0.95), p(0, 1.68), p(1.4, 2.5), p(2.95, 3.24)]),
      },
    ],
  },

  // ── L19 (row 19) — Person + Bridge / XL · coins · Δgoal 0 ──────────────────
  // Combine: a person stands on a central island between TWO pits. The drawn line
  // is one firm arch that carries the car OVER both pits AND over the person's head
  // — road and clearance in one bow. A flat line rests on the island and drives
  // into the person; a saggy line drops into a pit. ARCH_EXEMPT (compression >5.5 m).
  {
    id: 'ch1-l19',
    design: 'Person+Bridge/XL: 二つの谷に挟まれた中央島に立つ人を、両谷と頭上を一枚のアーチで越えて渡る（平線は人に当たる）— levels_round9 row19',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10.5, 0.4), p(-2.0, 0.4), p(-2.2, -6.5), p(2.2, -6.5), p(2.0, 0.4), p(10.5, 0.4)), // U-pit with a solid floor (like l11)
      pillar(0, -2.0, -6.5, 0.5, 0.8), // person pedestal on the pit floor (head −0.3, well below the shield bridge)
    ],
    vehicleSpawn: p(-6.8, 0.75),
    goalFlag: flag(6.8, 0.4, 1, 2),
    killY: -6.5,
    coins: coinCount(6),
    persons: [personOn(0, -2.0)], // stands on the pedestal in the pit (top −2.0); silhouette −2.0…−0.3 (below the bridge)
    strokes: [{ kind: 'any', role: 'shield-bridge-over-person', points: arch(-2.9, 0.42, 2.9, 0.42, 0.28) }],
  },

  // ── L20 (row 20) — Wow / XL · noBreak · Δgoal +4 ──────────────────────────
  // THE PORTRAIT SHOWCASE. A +4 m two-anchor ascent in a TALL stage box (deep −8 m
  // chasm → the full 24 m vertical canvas). The drawn line climbs from the low-left
  // ground over a central mid-support (+2) to the high-right goal (+4) as one firm
  // supported ramp (noBreak). A flat line cannot reach the raised goal (elevation
  // concept — NOT horizontal-clearable, fixed by geometry).
  {
    id: 'ch1-l20',
    design: 'Wow/XL: 縦長ステージいっぱいの+4m二点アンカー上昇。低地から中央支点(+2)を経て高台(+4)へ一本の支持ランプで登る（縦の見せ場・平線は届かない）— levels_round9 row20',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10, 0), p(-3.5, 0), p(-3.7, -8)), // deep pit for the tall stage box
      pillar(-1.2, 1.3, -8, 0.5, 0.9), // first support +1.3
      pillar(1.2, 2.7, -8, 0.5, 0.9), // second support +2.7 (three gentle +1.3 stages up to +4)
      pl(p(3.7, -8), p(3.5, 4.0), p(10, 4.0)), // high goal shelf +4
    ],
    vehicleSpawn: p(-7.8, 0.35),
    goalFlag: flag(7.2, 4.0, 1, 2),
    killY: -8,
    coins: coinCount(6),
    strokes: [
      {
        kind: 'any',
        role: 'three-stage-ascent',
        points: spline([p(-3.85, 0.05), p(-2.4, 0.72), p(-1.2, 1.35), p(0, 2.0), p(1.2, 2.75), p(2.4, 3.4), p(3.85, 4.04)]),
      },
    ],
  },

  // ── L21 (row 21) — Red / L · coins · Δgoal 0 ──────────────────────────────
  // Corridor routing: TWO offset red rects → a curved safe corridor. A red slab
  // fills the lower pit (idle car falls onto it); a red bump protrudes above the
  // right rim (a car that crosses low drives into it). The safe line CURVES: cross
  // the pit high, then bow over the bump. Both reds kill a distinct naive baseline.
  {
    id: 'ch1-l21',
    design: 'Red/L: 二つのずれた赤帯（谷を埋める床＋右リムの突起）が作る曲がった安全通路。高く渡り突起を越える — levels_round9 row21',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9.5, leftRim: -1.7, leftY: 0, rightRim: 1.7, rightY: 0, rightFar: 9.5, chasmY: -7.5 }),
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    // Two adjacent red slabs tiling the lower pit (left + right) with a seam at x0.3 —
    // the safe line curves over both. Both are hit on the idle car's fall tick (its
    // 1.5 m-wide AABB lands straddling the seam).
    dangerZones: [
      { x: -1.7, y: -7.5, width: 2.0, height: 5.7, style: 'zone' }, // left slab, top −1.8
      { x: 0.3, y: -7.5, width: 1.4, height: 5.7, style: 'zone' }, // right slab, top −1.8
    ],
    strokes: [
      {
        kind: 'any',
        role: 'arc-over-reds',
        points: arch(-2.6, 0.05, 2.6, 0.05, 0.16),
      },
    ],
  },

  // ── L22 (row 22) — Descent + Rock / XL · noBreak · Δgoal −2.5 ──────────────
  // Pace control: descend a high-left bank across a pit to a low-right goal (−2.5)
  // on one firm supported ramp (noBreak). A boulder rests in the pit where a naive
  // idle car (deflected off the mid support) falls — the "rock from behind" realized
  // as a static settled boulder (round-8: dynamic/timed rocks are unattributable).
  {
    id: 'ch1-l22',
    design: 'Descent+Rock/XL: 高い左岸から谷の岩を避けて降り、低い右ゴールへ着地（noBreak）。無線の車は谷底の岩へ落ちる — levels_round9 row22 (static rock; 降下量は着地の暴れ防止でL6準拠の−2.0に調整)',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      // high shelf → terrain RAMP down to a ledge (controlled descent) → pit (rock) → low-right goal
      pl(p(-12, 2.4), p(-5.4, 2.4), p(-3.6, 0.6), p(-2.4, 0.6), p(-2.6, -9), p(2.6, -9), p(2.4, 0), p(10, 0)),
    ],
    vehicleSpawn: p(-8.6, 2.75),
    goalFlag: flag(7, 0, 1, 2),
    killY: -9,
    coins: coinCount(6),
    rocks: [{ x: 1.6, y: -8.4, radius: 0.7, density: 5 }], // pit floor where the idle car (flung off the ledge rim) actually lands (measured x≈2.0)
    strokes: [
      {
        kind: 'any',
        role: 'pit-cover',
        points: arch(-2.75, 0.62, 2.75, 0.05, 0.14),
      },
    ],
  },

  // ── L23 (row 23) — Person×2 / XL · coins · Δgoal 0 ────────────────────────
  // Two persons 4 m apart on a flat plateau. TWO honest families (2 recorded ghosts):
  //   (0) TWO HUMPS — bow over each person, DIP to the plateau between them (rests
  //       on the ground → short firm sub-spans; this is the PRIMARY / coin route).
  //   (1) ONE LONG ARCH — a single dome over both heads (ARCH_EXEMPT compression).
  // A flat line drives into the first person. Deep plateau edges frame it (XL).
  {
    id: 'ch1-l23',
    design: 'Person×2/XL: 平地に4m間隔で立つ二人。人ごとに山を描いて間で降りる二山か、二人まとめて越える一枚のアーチか（二つの解） — levels_round9 row23',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10, 0), p(-4.2, 0), p(-4.4, -9)), // left bank y0
      pillar(-2, -2.0, -9, 0.6, 0.95), // person-1 pedestal deep in the valley (head −0.3, below the firm deck)
      pillar(0, 0.8, -9, 0.55, 0.9), // central support island (top +0.8) the deck rests on (firm sub-spans)
      pillar(2, -2.0, -9, 0.6, 0.95), // person-2 pedestal
      pl(p(4.4, -9), p(4.2, 0), p(10, 0)), // right bank y0
    ],
    vehicleSpawn: p(-7, 0.35),
    goalFlag: flag(7, 0, 1, 2),
    killY: -9,
    coins: coinCount(7),
    persons: [personOn(-2, -2.0), personOn(2, -2.0)], // 4 m apart in the valley; each silhouette −2.0…−0.3 (below the deck)
    strokes: [
      {
        kind: 'any',
        role: 'two-humps-on-island',
        points: spline([p(-4.5, 0.05), p(-3.0, 0.85), p(-2, 1.15), p(-1.0, 0.9), p(0, 0.85), p(1.0, 0.9), p(2, 1.15), p(3.0, 0.85), p(4.5, 0.05)]),
      },
      { kind: 'any', role: 'one-long-arch', points: arch(-4.5, 0.05, 4.5, 0.05, 1.6) },
    ],
    // Gate 8 (advisory) plurality: two genuinely distinct silhouettes.
    solutions: [
      { shapeTag: 'trapezoid', points: spline([p(-4.5, 0.05), p(-3.0, 0.85), p(-2, 1.15), p(-1.0, 0.9), p(0, 0.85), p(1.0, 0.9), p(2, 1.15), p(3.0, 0.85), p(4.5, 0.05)]) },
      { shapeTag: 'arch', points: arch(-4.5, 0.05, 4.5, 0.05, 1.6) },
    ],
  },

  // ── L24 (row 24) — Breather / L · coins · Δgoal 0 ─────────────────────────
  // Reward breather: a coin-rich, low-risk rolling valley — any relaxed line rakes
  // the payout. Deep chasm frames it (L). The calm beat before the L25 wow jump.
  {
    id: 'ch1-l24',
    design: 'Breather/L: コイン豊富な低リスクの起伏。好きな線で報酬を流し取る一息ステージ — levels_round9 row24',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2.4, leftY: 0.5, rightRim: 2.4, rightY: 0.5, rightFar: 9, chasmY: -6 }),
    vehicleSpawn: p(-6.6, 0.85),
    goalFlag: flag(6.6, 0.5, 1, 2),
    killY: -6,
    coins: coinCount(9),
    strokes: [{ kind: 'any', role: 'coin-rake', points: arch(-3.2, 0.52, 3.2, 0.52, 0.24) }],
  },

  // ── L25 (row 25) — Wow / XL · coins · Δgoal +2 ────────────────────────────
  // [JUMP] OVER-BRIDGE + CLIMB (the row's sanctioned fallback). MEASURED: a pure
  // ballistic launch over a person is INFEASIBLE at this car's flight speed — L12
  // shows the car flies only ~1.5 m horizontally while dropping ~1.5 m (≈2.4 m/s
  // flight), far too little to span a 1.3 m-wide person and land on a shelf beyond
  // (consistent with spike-round9-jump's 0/45 person-clears). So the wow FEEL —
  // "soar OVER a person, reach a higher place beyond" — is delivered by a drawn
  // climbing arch that bows OVER the person's head and rises onto a +2 shelf.
  {
    id: 'ch1-l25',
    design: 'Wow/XL: 谷の人を頭上に越えながら+2mの高台へ駆け上がる登りアーチ。純粋な弾道跳躍は本車の飛行速度では人1.3mを跨げず計測不能→頭上越え+登坂で「人を越えて高みへ」を実現 — levels_round9 row25 (measured fallback)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-11, 0), p(-6, 0), p(-3.6, 2.0), p(-2.6, 2.0), p(-2.8, -8.5)), // spawn ground → terrain ramp up to a +2 plateau → pit
      pillar(0, -0.5, -8.5, 0.8, 1.2), // person pedestal in the pit (head +1.2, BELOW the high +2 bridge line)
      pl(p(2.8, -8.5), p(2.6, 2.0), p(10, 2.0)), // +2 goal shelf beyond
    ],
    vehicleSpawn: p(-8.5, 0.35),
    goalFlag: flag(7, 2.0, 1, 2),
    killY: -8.5,
    coins: coinCount(6),
    persons: [personOn(0, -0.5)], // silhouette −0.5…+1.2, under the firm high bridge
    strokes: [
      {
        kind: 'any',
        role: 'high-bridge-over-person',
        points: arch(-2.9, 2.05, 2.9, 2.05, 0.15),
      },
    ],
  },

  // ── L26 (row 26) — Red / L · noBreak · Δgoal +0.5 ─────────────────────────
  // Draft-1 EXACT: a red block PROTRUDES above the road before the goal platform
  // (+0.5). The drawn line bows over the red (blocks drawing + kills) then rides
  // onto the raised goal shelf as one firm plank (noBreak). A flat line runs into
  // the red. Deep road ends supply the L framing.
  {
    id: 'ch1-l26',
    design: 'Red/L: ゴール台の手前で道から突き出す赤帯を弓で越え、+0.5mの台へ乗る（noBreak）。平線は赤へ突っ込む — levels_round9 row26 (Draft-1)',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.6, -8), p(-7.5, 0), p(3.0, 0), p(4.2, 0.5), p(7.5, 0.5), p(9.6, -8)), // flat road y0 → gentle ramp to goal platform +0.5, deep IN-WINDOW ends (framing)
    ],
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0.5, 1, 2),
    killY: -7,
    coins: coinCount(6),
    dangerZones: [{ x: -0.55, y: -8, width: 1.1, height: 8.4, style: 'zone' }], // top +0.4: red protrudes above the road (centered, like l07)
    strokes: [
      {
        kind: 'any',
        role: 'arc-over-red',
        points: spline([p(-2.7, 0.05), p(-1.5, 0.55), p(-0.6, 1.15), p(0, 1.25), p(0.6, 1.15), p(1.5, 0.55), p(2.7, 0.05)]),
      },
    ],
  },

  // ── L27 (row 27) — Bridge + Climb / XL · coins · Δgoal +3.2 ────────────────
  // Draft-2 EXACT: a pit + a TALL goal platform (+3.2). The drawn line bridges the
  // pit and CLIMBS over a central mid-support to the high shelf. A flat line cannot
  // reach the raised goal (elevation concept — NOT horizontal-clearable). Distinct
  // from L18: a compact bridge-then-climb (L18 is a long low approach). 2 families.
  {
    id: 'ch1-l27',
    design: 'Bridge+Climb/XL: 谷＋+3.2mの高いゴール台。描いた線で谷を渡り中央支点を経て登る（平線は届かない）。弓とランプの二解 — levels_round9 row27 (Draft-2)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10, 0.6), p(-2.6, 0.6), p(-2.8, -7.5)),
      pillar(0, 2.0, -7.5, 0.6, 1.0), // central support at mid-climb height
      pl(p(2.8, -7.5), p(2.6, 3.8), p(10, 3.8)), // tall goal shelf (spawn +0.6 → +3.8 = Δ+3.2)
    ],
    vehicleSpawn: p(-7.4, 0.95),
    goalFlag: flag(7, 3.8, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    strokes: [
      {
        kind: 'any',
        role: 'bridge-climb',
        points: spline([p(-2.95, 0.65), p(-1.4, 1.35), p(0, 2.08), p(1.4, 3.0), p(2.95, 3.84)]),
      },
      { kind: 'any', role: 'bridge-climb-ramp', points: spline([p(-2.95, 0.65), p(-1.3, 1.5), p(0, 2.05), p(1.3, 3.1), p(2.95, 3.84)]) },
    ],
    solutions: [
      { shapeTag: 'arch', points: spline([p(-2.95, 0.65), p(-1.4, 1.35), p(0, 2.08), p(1.4, 3.0), p(2.95, 3.84)]) },
      { shapeTag: 'ramp', points: spline([p(-2.95, 0.65), p(-1.3, 1.5), p(0, 2.05), p(1.3, 3.1), p(2.95, 3.84)]) },
    ],
  },

  // ── L28 (row 28) — Descent + Person / XL · noBreak · Δgoal −3 ──────────────
  // Draft-3 EXACT: a TALL start (−3 to the goal), a person mid-ground, goal right.
  // BRIDGE-OVER descent: the drawn line bows OVER the person's head, then rides down
  // to the low-right goal on one firm supported plank (noBreak). A straight descent
  // dips into the person. Deep chasm frames it (XL).
  {
    id: 'ch1-l28',
    design: 'Descent+Person/XL: 高い左スタート→中央の人を頭上で越え→−3mの低い右ゴールへ着地（noBreak）。直線降下は人に当たる — levels_round9 row28 (Draft-3)',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      // tall start → terrain ramp down to a ledge → U-pit (person) → right rim → EASED descent to the −3 goal
      pl(p(-12, 2.0), p(-5.4, 2.0), p(-3.6, 0.6), p(-2.4, 0.6), p(-2.6, -10.5), p(2.6, -10.5), p(2.4, 0), p(4.2, 0), p(5.8, -0.8), p(7.0, -1.0), p(11, -1.0)),
      pillar(0, -2.5, -10.5, 0.5, 0.8), // person pedestal on the pit floor (head −0.8, well below the firm low bridge)
    ],
    vehicleSpawn: p(-7.0, 2.35),
    goalFlag: flag(7.6, -1.0, 1, 2),
    killY: -10.5,
    coins: coinCount(6),
    persons: [personOn(0, -2.5)], // silhouette −2.5…−0.8, below the firm pit-cover bridge
    strokes: [
      {
        kind: 'any',
        role: 'pit-cover-over-person',
        points: arch(-2.75, 0.62, 2.75, 0.05, 0.14),
      },
    ],
  },
];

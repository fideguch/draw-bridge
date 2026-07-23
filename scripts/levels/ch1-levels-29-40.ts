/**
 * Chapter 1, levels 29–40 — ROUND-9 v2 FINALE WAVE (CS-4c).
 *
 * BINDING source: designs/levels_round9.md rows 29–40 (designer-approved slate) —
 * the final twelve numbered levels. Authored as schemaVersion 2, exactly like the
 * CS-4a/4b modules (ch1-levels-01-12.ts / ch1-levels-13-28.ts):
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
 * tier floor. Climb rows (l30/l35/l39/l40) sit in TALL stage boxes (deep chasms +
 * high goals) so the +Δgoal geometry — never a horizontal line — reaches the flag.
 *
 * JUMP GATE (levels_round9 header, .fable/spike-round9-jump.md): ground-level ramps
 * add only ≤0.74 m apex, so a person is NEVER cleared from flat ground. Every
 * person level BRIDGES-OVER (the sanctioned fallback): the drawn line carries the
 * car above the person's ≤1.7 m silhouette; the person pedestals sit DEEP in the
 * pit so their heads stay well below the ridden deck (physics-forced, measured in
 * CS-4b). Every over/climb route is PROVEN by a recorded ghost through the real v2
 * commit path (authoring fails loud on a person touch or a short landing). NO
 * physics re-tuning (round-7 lesson).
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

export const CH1_V2_SOURCES_29_40: readonly LevelSource[] = [
  // ── L29 (row 29) — Rock + Person / L · coins · Δgoal 0 ─────────────────────
  // Lane choice: a boulder rests on the pit floor (the "lower lane") and a person
  // stands on a pedestal to the side (the "upper lane"). ONE shield-bridge carries
  // the car over BOTH (a rock touching the CAR is a loss; the chain is unaffected).
  // A naive idle car drops into the pit onto the boulder (hazardContact). Static
  // rock (round-8: dynamic/timed rocks are unattributable).
  {
    id: 'ch1-l29',
    design: 'Rock+Person/L: 谷底の岩（下レーン）と横の台に立つ人（上レーン）を一枚の盾橋で両方越える。無線の車は谷底の岩へ落ちる — levels_round9 row29 (static rock)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9, 0.4), p(-2.4, 0.4), p(-2.6, -7.5), p(2.6, -7.5), p(2.4, 0.4), p(9, 0.4)), // U-pit with a solid floor
      pillar(-1.8, -4.0, -7.5, 0.45, 0.6), // person pedestal DEEP-LEFT (top −4.0): the idle car only passes here early + HIGH; its low arc stays right of x0, so the person is never touched
    ],
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.6, 0.4, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    rocks: [{ x: 0.5, y: -7.0, radius: 0.5, density: 5 }], // on the pit floor (−7.5) where the idle car lands after arcing right then falling back left (measured)
    persons: [personOn(-1.8, -4.0)], // silhouette −4.0…−2.3 (below the bridge; deep-left, out of the idle car's low arc)
    strokes: [{ kind: 'any', role: 'shield-bridge-over-both', points: arch(-3.0, 0.42, 3.0, 0.42, 0.3) }],
  },

  // ── L30 (row 30) — Wow / XL · coins · Δgoal +2 ─────────────────────────────
  // CAPSTONE A. A +2 m climb-bridge that vaults a DEEP wide chasm on one central
  // mid-support, coins arcing high over the void (the "airborne coin arc"). The
  // drawn line climbs from the low-left ground over the support to the +2 goal
  // shelf; a flat line cannot reach the raised goal (climb concept — NOT
  // horizontal-clearable, fixed by geometry). Tall stage box (−9 chasm).
  {
    id: 'ch1-l30',
    design: 'Wow/XL: 深い谷を中央支点で越えて+2mの高台へ駆け上がる登り橋。コインは谷上を高く弧を描く（縦の見せ場・平線は届かない）— levels_round9 row30 (capstone A)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-11, 0), p(-2.8, 0), p(-3.0, -9)),
      pillar(0, 0.9, -9, 0.6, 1.0), // central support +0.9 (splits the +2 climb into two firm spans)
      pl(p(3.0, -9), p(2.7, 2.0), p(11, 2.0)), // +2 goal shelf
    ],
    vehicleSpawn: p(-7.5, 0.35),
    goalFlag: flag(6.9, 2.0, 1, 2),
    killY: -9,
    coins: coinCount(7),
    strokes: [
      {
        kind: 'any',
        role: 'climb-vault',
        points: spline([p(-2.95, 0.05), p(-1.4, 0.6), p(0, 0.96), p(1.4, 1.5), p(2.95, 2.04)]),
      },
    ],
  },

  // ── L31 (row 31) — Breather / L · coins · Δgoal 0 ──────────────────────────
  // Free-form breather: a wide gentle bowl any relaxed line rides; a coin trail
  // rakes the arc. Deep chasm (−6) supplies the L portrait framing. The calm beat
  // before the L32 route-planning exam.
  {
    id: 'ch1-l31',
    design: 'Breather/L: 広くゆるやかなボウルを好きな線で渡りコインを流し取る一息ステージ — levels_round9 row31',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2.3, leftY: 0.4, rightRim: 2.3, rightY: 0.4, rightFar: 9, chasmY: -6 }),
    vehicleSpawn: p(-6.6, 0.75),
    goalFlag: flag(6.6, 0.4, 1, 2),
    killY: -6,
    coins: coinCount(8),
    strokes: [{ kind: 'any', role: 'rolling-line', points: arch(-3.1, 0.42, 3.1, 0.42, 0.24) }],
  },

  // ── L32 (row 32) — Red×2 + Pit / L · noBreak · Δgoal 0 ─────────────────────
  // Full-route planning: TWO red slabs tile the lower pit (they BLOCK drawing +
  // kill), leaving a curved safe corridor above. The firm line arcs over both
  // reds on one supported plank (noBreak). A naive idle car drops off the rim onto
  // the reds (both hit on the fall tick, its 1.5 m-wide AABB straddling the seam).
  {
    id: 'ch1-l32',
    design: 'Red×2+Pit/L: 谷の下半分を埋める二枚の赤帯が作る曲がった安全通路を一本の橋で越える（noBreak）。無線の車は赤へ落ちる — levels_round9 row32',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9.5, leftRim: -1.8, leftY: 0, rightRim: 1.8, rightY: 0, rightFar: 9.5, chasmY: -7.5 }),
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    // Two adjacent red slabs tiling the lower pit (seam at x0.3); the safe line
    // curves over both, and the idle car's fall lands straddling the seam.
    dangerZones: [
      { x: -1.8, y: -7.5, width: 2.1, height: 5.5, style: 'zone' }, // left slab, top −2.0
      { x: 0.3, y: -7.5, width: 1.5, height: 5.5, style: 'zone' }, // right slab, top −2.0
    ],
    strokes: [{ kind: 'any', role: 'arc-over-reds', points: arch(-2.7, 0.05, 2.7, 0.05, 0.16) }],
  },

  // ── L33 (row 33) — Person + Pit / L · coins · Δgoal 0 ──────────────────────
  // Clear both at once: a person stands on a pedestal at the NEAR edge of a pit;
  // ONE bridge bows over the person's head AND spans the pit in a single arc. A
  // flat line rests low and drives into the person; a saggy line drops into the
  // pit. The pedestal sits deep so the head stays under the ridden deck.
  {
    id: 'ch1-l33',
    design: 'Person+Pit/L: 谷の手前に立つ人の頭上と谷を一枚の弓で同時に越える。平線は人に当たる — levels_round9 row33',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0), p(-2.2, 0), p(-2.4, -6.5), p(2.4, -6.5), p(2.2, 0), p(9.5, 0)), // U-pit (±2.2 rims, floor −6.5)
      pillar(0, 0.25, -6.5, 0.35, 0.55), // central mid-support (top +0.25): splits the ridden span into two firm ~2.2 m sub-spans → low shove
      pillar(1.2, -2.5, -6.5, 0.4, 0.6), // person pedestal just past centre (top −2.5): head −0.8, below the deck
    ],
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 0, 1, 2),
    killY: -6.5,
    coins: coinCount(6),
    persons: [personOn(1.2, -2.5)], // silhouette −2.5…−0.8 (below the deck)
    strokes: [
      {
        kind: 'any',
        role: 'deck-over-person-and-pit',
        points: spline([p(-2.5, 0.05), p(-1.1, 0.22), p(0, 0.29), p(1.1, 0.22), p(2.5, 0.05)]),
      },
    ],
  },

  // ── L34 (row 34) — Rock / L · noBreak · Δgoal +1 ───────────────────────────
  // Deflector line: a boulder rests on the pit floor before a RAISED goal approach
  // (+1). The drawn line is the shield deck that carries the car above the rock and
  // rides up onto the +1 shelf as one firm supported plank (noBreak). A naive idle
  // car drops into the pit onto the boulder (hazardContact). Static rock.
  {
    id: 'ch1-l34',
    design: 'Rock/L: +1mの高いゴール手前、谷底の岩の上を盾の橋で越えて登る（noBreak）。無線の車は谷底の岩へ落ちる — levels_round9 row34 (static rock)',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0), p(-2.2, 0), p(-2.4, -7), p(2.4, -7), p(2.2, 1), p(9.5, 1)), // U-pit, left ground y0, right shelf +1
    ],
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 1, 1, 2),
    killY: -7,
    coins: coinCount(6),
    rocks: [{ x: 0, y: -6.5, radius: 0.5, density: 5 }], // rests on the pit floor (−7) where the idle car falls
    strokes: [{ kind: 'any', role: 'shield-climb', points: arch(-2.9, 0.05, 2.9, 1.05, 0.28) }],
  },

  // ── L35 (row 35) — Wow / XL · coins · Δgoal +5 ─────────────────────────────
  // HIGH CLIMB — the TALL portrait showcase. A +5 m two-support ascent in a deep
  // (−10) stage box → the full vertical canvas. The drawn line climbs from the
  // low-left ground over two mid-supports (+1.6 / +3.3) to the high-right goal
  // (+5) as one firm supported ramp. A flat line cannot reach the raised goal
  // (elevation concept — NOT horizontal-clearable, fixed by geometry). CARD NOTE:
  // the "optional low coin detour" is advisory — coins ride the recorded ascent
  // route (single-ghost auto-placement); the low path is a player option, not a
  // second recorded ghost.
  {
    id: 'ch1-l35',
    design: 'Wow/XL: 深い縦長ステージの+5m二段支点上昇。低地から支点(+1.6/+3.3)を経て高台(+5)へ一本の支持ランプで登る（縦の高い見せ場・平線は届かない）— levels_round9 row35 (high climb)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-12.5, 0), p(-5.5, 0), p(-5.7, -10)), // deep pit for the tall stage box
      pillar(-3.3, 1.0, -10, 0.5, 0.9), // support 1 +1.0
      pillar(-1.1, 2.0, -10, 0.5, 0.9), // support 2 +2.0
      pillar(1.1, 3.0, -10, 0.5, 0.9), // support 3 +3.0
      pillar(3.3, 4.0, -10, 0.5, 0.9), // support 4 +4.0 (five gentle ~24° stages up to +5)
      pl(p(5.7, -10), p(5.5, 5.0), p(12.5, 5.0)), // high goal shelf +5
    ],
    vehicleSpawn: p(-7.0, 0.35),
    goalFlag: flag(6.5, 5.0, 1, 2),
    killY: -10,
    // A +5 climb at the car's shallow-end climbable gradient (~24°/stage) needs ~11 m
    // of horizontal at Lv0 speed; give the long showcase ascent the headroom.
    maxTicks: 2600,
    coins: coinCount(7),
    strokes: [
      {
        kind: 'any',
        role: 'high-ascent',
        points: spline([
          p(-5.6, 0.05), p(-4.4, 0.55), p(-3.3, 1.05), p(-2.2, 1.55), p(-1.1, 2.05),
          p(0, 2.55), p(1.1, 3.05), p(2.2, 3.55), p(3.3, 4.05), p(4.4, 4.55), p(5.6, 5.04),
        ]),
      },
    ],
  },

  // ── L36 (row 36) — Breather / L · coins · Δgoal 0 ──────────────────────────
  // Celebration breather: a coin-rich, precision-free rolling valley — any relaxed
  // line rakes a big payout. Deep chasm frames it (L). The reward beat before the
  // L37 routing exam.
  {
    id: 'ch1-l36',
    design: 'Breather/L: コイン豊富で難所のない起伏。好きな線で大量の報酬を流し取る祝祭ステージ — levels_round9 row36',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: twoPlatforms({ leftFar: -9, leftRim: -2.4, leftY: 0.5, rightRim: 2.4, rightY: 0.5, rightFar: 9, chasmY: -6 }),
    vehicleSpawn: p(-6.6, 0.85),
    goalFlag: flag(6.6, 0.5, 1, 2),
    killY: -6,
    coins: coinCount(10),
    strokes: [{ kind: 'any', role: 'coin-rake', points: arch(-3.2, 0.52, 3.2, 0.52, 0.24) }],
  },

  // ── L37 (row 37) — Mixed / L · coins · Δgoal +1.5 ──────────────────────────
  // Routing exam: a pit whose lower half is a red slab (blocks drawing + kills) +
  // a RAISED goal (+1.5). The drawn line arcs over the red, spans the pit, and
  // climbs onto the +1.5 shelf — one route threading all three demands. A naive
  // idle car drops off the rim onto the red (hazardContact). A flat line cannot
  // reach the raised goal.
  {
    id: 'ch1-l37',
    design: 'Mixed/L: 谷＋下半分の赤帯＋+1.5mの高いゴール。赤を越え谷を渡り登る一本の解（無線は赤へ落ちる・平線は届かない）— levels_round9 row37 (routing exam)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-9.5, 0), p(-2.2, 0), p(-2.4, -6.5), p(2.4, -6.5), p(2.2, 1.5), p(9.5, 1.5)), // U-pit, left ground y0, right shelf +1.5
    ],
    vehicleSpawn: p(-6.6, 0.35),
    goalFlag: flag(6.6, 1.5, 1, 2),
    killY: -6.5,
    coins: coinCount(6),
    dangerZones: [{ x: -2.2, y: -6.5, width: 4.6, height: 3.5, style: 'zone' }], // top −3.0: fills the lower pit
    strokes: [{ kind: 'any', role: 'arc-over-red-climb', points: arch(-2.9, 0.05, 2.9, 1.55, 0.3) }],
  },

  // ── L38 (row 38) — Rock + Person / L · noBreak · Δgoal 0 ───────────────────
  // Speed through slope: the terrain ramps DOWN into the crossing (controlling the
  // car's arrival speed) then back UP to the equal-height goal (Δ0). Between the
  // rims the car threads over a floor boulder AND a pedestalled person on one firm
  // supported plank (noBreak). A naive idle car rolls down the ramp and drops onto
  // the boulder (hazardContact). Static rock.
  {
    id: 'ch1-l38',
    design: 'Rock+Person/L: 下る斜面が到着速度を決める。谷底の岩と台の人の間を一枚の橋で抜けて同じ高さのゴールへ（noBreak）。無線の車は斜面を下り岩へ落ちる — levels_round9 row38 (static rock)',
    schemaVersion: 2,
    objective: { type: 'noBreak' },
    inkFeel: 'standard',
    gimmickTags: [],
    terrain: [
      pl(p(-10, 1.2), p(-5.0, 1.2), p(-2.4, 0), p(-2.6, -7.5), p(2.6, -7.5), p(2.4, 0), p(5.0, 1.2), p(10, 1.2)), // +1.2 shelves ramp down to the y0 pit rims (Δgoal 0)
      pillar(-1.8, -4.0, -7.5, 0.45, 0.6), // person pedestal DEEP-LEFT (top −4.0): the ramp-fed idle car only passes here early + HIGH, then descends to the right; never touched
    ],
    vehicleSpawn: p(-7.0, 1.55),
    goalFlag: flag(7.0, 1.2, 1, 2),
    killY: -7.5,
    coins: coinCount(6),
    rocks: [{ x: 1.3, y: -7.0, radius: 0.5, density: 5 }], // pit floor (−7.5) where the ramp-fed idle car lands (measured)
    persons: [personOn(-1.8, -4.0)], // silhouette −4.0…−2.3 (below the deck; deep-left, out of the idle car's descending path)
    strokes: [{ kind: 'any', role: 'pit-cover-over-both', points: arch(-2.9, 0.05, 2.9, 0.05, 0.28) }],
  },

  // ── L39 (row 39) — Climb / XL · coins · Δgoal +3 ───────────────────────────
  // Visible ink economy: a two-stage ascent to +3 over a central mid-support. The
  // ghost clears at the minimal ink and the derived star3 (= ghost ink × 1.35)
  // leaves a VISIBLE gold-ink margin the player can spend on a rougher climb.
  // Generous ink makes the drawing room obvious. A flat line cannot reach the
  // raised goal (elevation concept — NOT horizontal-clearable).
  {
    id: 'ch1-l39',
    design: 'Climb/XL: 中央支点を経る+3mの二段上昇。最小インクで登るゴーストのstar3(=×1.35)が見えるインク余裕を残す。潤沢なインクで描く余地が明快（平線は届かない）— levels_round9 row39 (visible ink economy)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: [
      pl(p(-10, 0), p(-2.6, 0), p(-2.8, -8)),
      pillar(0, 1.5, -8, 0.6, 1.0), // central support at mid-climb height (+1.5)
      pl(p(2.8, -8), p(2.6, 3.0), p(10, 3.0)), // tall goal shelf +3
    ],
    vehicleSpawn: p(-7.4, 0.35),
    goalFlag: flag(7.0, 3.0, 1, 2),
    killY: -8,
    coins: coinCount(6),
    strokes: [
      {
        kind: 'any',
        role: 'two-stage-ascent',
        points: spline([p(-2.95, 0.05), p(-1.4, 0.75), p(0, 1.55), p(1.4, 2.35), p(2.95, 3.04)]),
      },
    ],
  },

  // ── L40 (row 40) — Finale / XL · coins · Δgoal +2.5 ────────────────────────
  // SYNTHESIS. Every element at once: a deep pit, a red slab, a floor boulder, a
  // pedestalled person, and a HIGH flag (+2.5). Three recorded ghost families all
  // clear (arch / ramp / angle) — the drawn line rides high over the low floor
  // hazards + the deep person, climbing to the +2.5 shelf. A naive idle car drops
  // off the rim and lands straddling the red band + the boulder (both hit on the
  // fall tick). A flat line cannot reach the raised goal. The chapter capstone.
  {
    id: 'ch1-l40',
    design: 'Finale/XL: 谷＋赤帯＋岩＋人＋+2.5mの高い旗を一度に。三つの解の系統（弓/ランプ/角）が全て床の障害と深い人を越えて登る。無線の車は赤帯と岩の上へ落ちる（両方当たり）・平線は届かない — levels_round9 row40 (synthesis, 3 ghosts)',
    schemaVersion: 2,
    objective: { type: 'coins' },
    inkFeel: 'generous',
    gimmickTags: [],
    terrain: [
      pl(p(-11, 0), p(-2.2, 0), p(-2.4, -9), p(2.4, -9), p(2.2, 2.5), p(11, 2.5)), // U-pit, left ground y0, right shelf +2.5
      pillar(0, 1.25, -9, 0.3, 0.45), // central mid-support +1.25 (splits the +2.5 climb into two firm ~30° spans)
      pillar(1.5, -3.0, -9, 0.4, 0.6), // person pedestal deep in the pit (top −3.0): head −1.3, well below the deck
    ],
    vehicleSpawn: p(-7.5, 0.35),
    goalFlag: flag(6.9, 2.5, 1, 2),
    killY: -9,
    coins: coinCount(7),
    // Red band + boulder sit LOW on the LEFT pit floor, side by side, so the idle
    // car's fall lands straddling BOTH on one tick (its 1.5 m AABB overlaps the band
    // and touches the rock). The climbing families ride high over them + the deep
    // person, resting on the central mid-support.
    dangerZones: [{ x: -2.2, y: -9, width: 1.6, height: 1.0, style: 'zone' }], // floor red band, top −8.0 (x −2.2…−0.6)
    rocks: [{ x: -1.4, y: -8.5, radius: 0.5, density: 5 }], // NESTED in the red band, rock top −8.0 = zone top, so the idle car's floor landing touches BOTH on the same tick
    persons: [personOn(1.5, -3.0)], // silhouette −3.0…−1.3 (below every family)
    strokes: [
      {
        kind: 'any',
        role: 'finale-ramp',
        points: spline([p(-2.35, 0.05), p(-1.1, 0.6), p(0, 1.3), p(1.1, 1.95), p(2.35, 2.55)]),
      },
      { kind: 'any', role: 'finale-arch', points: spline([p(-2.35, 0.05), p(-1.2, 0.75), p(0, 1.32), p(1.2, 1.8), p(2.35, 2.55)]) },
      {
        kind: 'any',
        role: 'finale-angle',
        points: spline([p(-2.35, 0.05), p(-1.15, 0.5), p(0, 1.28), p(1.15, 1.95), p(2.35, 2.55)]),
      },
    ],
    // Gate 8 (advisory) plurality: three distinct climbing silhouettes, all resting
    // on the central mid-support.
    solutions: [
      { shapeTag: 'ramp', points: spline([p(-2.35, 0.05), p(-1.1, 0.6), p(0, 1.3), p(1.1, 1.95), p(2.35, 2.55)]) },
      { shapeTag: 'arch', points: spline([p(-2.35, 0.05), p(-1.2, 0.75), p(0, 1.32), p(1.2, 1.8), p(2.35, 2.55)]) },
      { shapeTag: 'angle', points: spline([p(-2.35, 0.05), p(-1.15, 0.5), p(0, 1.28), p(1.15, 1.95), p(2.35, 2.55)]) },
    ],
  },
];

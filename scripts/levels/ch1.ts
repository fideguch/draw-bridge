/**
 * Chapter 1 declarative level sources — ROLE-DIVERSE RECIPE REDESIGN v5
 * (2026-07-08, research/12_level_recipes.md).
 *
 * Pure DATA consumed by scripts/levels/authoring.ts, which runs each candidate
 * stroke through the real engine at Lv0 (WITH rocks live), derives the ink economy,
 * records ghosts, auto-places coins on the driven CAR route, and emits
 * levels/<id>.json. Regeneration after a TuningConstants change = rerun authoring.
 *
 * MANDATE (round 5): "線の役割が road ハンプ 1 種に固定 = 全ステージ同じ動作。競合の実例
 * (出典) に基づき役割を多様化せよ — 道 / 落ちてくる岩を防ぐ(shield) / 引っ掛けて道にする
 * (hook) / 一本書きで複数の穴を塞ぐ(multi-seal)". Each slot below implements a
 * DOCUMENTED competitor recipe (research/12 §2 assignment table §4) — NO original
 * ideas. The LINE'S ROLE (and the player's cognitive task) changes per level, and
 * adjacent levels never share a role tag (research/12 §4.1).
 *
 * ROLE PALETTE (research/12 §1) — the atlas `design` string names the role tag +
 * recipe id + source game so the PM can audit every level against its source:
 *   road (L1-L3) / shield-static (L4) / multi-seal (L5,B1) / ramp-jump (L6) /
 *   shield-dynamic (L7) / catch-redirect (L8,L14) / hook-cantilever (L9,L12) /
 *   dome-dual (L10,L15,B3) / sag-rope (L11,B2) / shield-timed (L13).
 *
 * ROCK ENTITY (round-5, src/engine/physics/RockHazard.ts): rolling/falling circle
 * hazards spawn at RUN START (post-commit, after the settle) and collide with
 * terrain / the drawn BridgeChain / the car. An undeflected rock induces the
 * existing tipOver/fall/timeout — the drawn line is its shield. Threaded through
 * authoring so every ghost is proven to clear WITH the rock live (§rocks fields).
 *
 * PHYSICS DISCIPLINE (research/11 §1 + research/12 §5, re-measured 2026-07-08):
 *   - 1 stroke/attempt (fixed); unsupported spans <= ~5.5 m (wider -> sag/break).
 *   - ANTI-DOMINANCE is carried by GEOMETRY, not ink starvation nor rock load:
 *     a mid SPIKE / tall WALL / low CEILING lip / RAISED far bank / deep-wide PIT
 *     physically fails every rim-to-rim straight (Gate 3 machine-verifies all 9
 *     overlapped/lifted candidates). Empirically a falling rock is NOT a reliable
 *     straight-killer (a pillar that supports the intended dip also supports a
 *     sagging straight; a pit-spanning line breaks under a heavy rock regardless
 *     of shape) — so the rock is a THEMATIC role-hazard the intended shape must
 *     survive, layered ON the geometric straight-kill, never the AD lever itself.
 *   - a stroke may not lie INSIDE a solid (StrokeClipper) so ghosts ride ON/ABOVE
 *     surfaces; sharp corners catapult the car (~1.4 m) so multi-bend ghosts are
 *     splined (patterns.ts spline()).
 *   - GENEROUS INK (authoring FEEL_FACTOR 3.0/2.5/2.0): difficulty is geometry +
 *     the rock, never ink; every AD board carries a kind:'3star' reference ghost.
 *   - SAWTOOTH: new role -> breather (B1/B2/B3 + L6 after peaks), ★1 (L1) -> ★5 (L15).
 *
 * Coordinates: world meters, y-up. Terrain authored left->right (top solid);
 * ceilings authored right->left (underside solid, Terrain.ts reverses for Box2D).
 */

import type { GimmickTag, Point, Polyline, Rect, Rock } from '../../src/engine/level/LevelSchema';
import {
  arch,
  ceiling,
  coinArc,
  coinLine,
  flag,
  line,
  p,
  pillar,
  spike,
  spline,
  twoPlatforms,
  wobble,
  type Gap,
} from './patterns';

export interface StrokeSource {
  /** 'any' = recorded clear (rating free); '3star' = Gate 2 asserts 3 stars. */
  readonly kind: 'any' | '3star';
  /** Human label for the authoring report + failure messages. */
  readonly role: string;
  /** Raw stroke (world m). RDP-simplified at commit; the simplified form persists. */
  readonly points: readonly Point[];
}

export interface LevelSource {
  readonly id: string;
  readonly design: string;
  /** Drives inkBudget = feelFactor x tight-reference ink (research/11 §3.2). */
  readonly inkFeel: 'generous' | 'standard' | 'tight';
  readonly terrain: readonly Polyline[];
  readonly vehicleSpawn: Point;
  readonly goalFlag: Rect;
  readonly killY: number;
  readonly coins: readonly Point[];
  readonly gimmickTags: readonly GimmickTag[];
  readonly strokes: readonly StrokeSource[];
  readonly maxTicks?: number;
  readonly bonusMultiplier?: number;
  /** Explicit budget override — the >=1.8x "geometry can't fail a straight" hatch. */
  readonly inkBudget?: number;
  /** Explicit thresholds override. */
  readonly starThresholds?: { readonly star2: number; readonly star3: number };
  /**
   * Rolling/falling rock hazards (round-5 role redesign). Physics circles that
   * spawn at run start and collide with terrain/bridge/car — the drawn line is
   * their shield/deflector. Threaded through authoring so every ghost is proven
   * to clear WITH the rock live. Absent == none (byte-identical to a rock-free
   * level). Per-rock params are level-local (level JSON), never TuningConstants.
   */
  readonly rocks?: readonly Rock[];
}

/** anti-dominant tag shorthand. */
const AD: readonly GimmickTag[] = ['anti-dominant'];

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // L1 — road (tutorial). tiny flat gap, generous ink, any sloppy line works
  // (FTUE <=10 s). Kept FLAT + same-height: the Gate 3 contract fixture derives
  // from this (a flat gap tagged anti-dominant MUST let overlapped straights clear).
  {
    id: 'ch1-l01',
    design: '道(road): まっすぐ橋を架ける — 既存 tutorial (InkBridge FTUE)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -9, leftRim: -0.9, leftY: 0, rightRim: 0.9, rightY: 0, rightFar: 12, chasmY: -5 }),
    vehicleSpawn: p(-3.2, 0.6),
    goalFlag: flag(2.6, 0, 1.5, 2.5),
    killY: -6,
    coins: coinArc(0, 0.9, 5, 0.5, 0.35),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'wobbly', points: wobble(-2, 0.15, 2, 0.15, 0.18) }],
  },

  // L2 — road. slightly wider + slight step; teach ink meter/stars (straight=3★).
  {
    id: 'ch1-l02',
    design: '道(road): インク効率で星を狙う — 既存 tutorial (InkBridge FTUE)',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -10, leftRim: -1.25, leftY: 0, rightRim: 1.25, rightY: 0.3, rightFar: 13, chasmY: -5 }),
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(3.0, 0.3, 1.4, 2.4),
    killY: -6,
    coins: coinArc(0, 1.1, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'tight-straight', points: line(-2.6, 0.15, 2.6, 0.5) },
      { kind: 'any', role: 'loose-arch', points: arch(-3, 0.2, 3, 0.55, 0.5) },
    ],
  },

  // L3 — road + mid fulcrum (B01): resting on the central pillar is cheaper. Non-AD
  // (a straight still clears the modest 4m gap; the pillar is the star path). KEEP
  // the pillar — terrain-winding.spec.ts negative control needs a flat plateau top.
  {
    id: 'ch1-l03',
    design: '道(road): 中間支点に載せて節約 — B01 Mid Pillar (Draw Bridge 中州)',
    inkFeel: 'standard',
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 14, chasmY: -5 }),
      pillar(0, -0.3, -5),
    ],
    vehicleSpawn: p(-4.3, 0.6),
    goalFlag: flag(3.6, 0, 1.3, 2.3),
    killY: -6,
    coins: coinArc(0, 0.9, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'rests-on-pillar', points: arch(-2.8, 0.1, 2.8, 0.1, -0.12) },
      { kind: 'any', role: 'sag-wide', points: arch(-3.2, 0.15, 3.2, 0.15, -0.1) },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // L4 — R04 shield-static (盾: 落石を弾く屋根). SOURCE: Stickman Rescue Draw 2 Save
  // (落石には傾けた頑丈な屋根/アーチ) + Happy Glass L20+ (線で落ちる球をブロック).
  // A mid SPIKE (tip 1.7) kills every straight (proven geometric AD); the ∧ vaults
  // it to a +1.0m bank. NEW ROLE: a heavy rock drops onto the arch — a firm high
  // vault sheds it down the far slope and off; a lazy low line lets the rock rest
  // in the deck path (crush). The line is a ROOF that takes the hit, not just a road.
  {
    id: 'ch1-l04',
    design: '盾(shield-static): 落石を屋根で受け流す — R04 Stickman Rescue / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -1.9, leftY: 0, rightRim: 1.9, rightY: 1.0, rightFar: 14, chasmY: -6 }),
      spike(-0.1, 1.7, -6, 0.85),
    ],
    vehicleSpawn: p(-4.2, 0.6),
    goalFlag: flag(3.5, 1.0, 1.2, 2.2),
    killY: -8,
    coins: coinArc(-0.1, 2.2, 6, 0.5, 0.3),
    rocks: [{ x: 0.7, y: 3.4, radius: 0.4, density: 5 }],
    strokes: [{ kind: '3star', role: 'roof-vault', points: arch(-2.7, 0.15, 2.5, 1.15, 1.7) }],
  },

  // L5 — R08 multi-seal (一本書きで複数の穴を塞ぐ). SOURCE: Draw Line Bridge (証拠11上,
  // 1本で複数ハザードを跨ぐ) + Happy Glass (1本で複数の穴を塞ぐ, 少描画=高星). TWO narrow
  // SPIKES split the crossing into holes; one continuous M line arcs over BOTH tips
  // and rests on the mid nub between them — sealing every hole in a single stroke.
  // Straights hit a spike (geometric AD). No rock (research/12 §4.2 non-rock main).
  {
    id: 'ch1-l05',
    design: '穴塞ぎ(multi-seal): 一本で複数の穴を塞ぐ — R08 Draw Line Bridge / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.9, leftY: 0, rightRim: 2.9, rightY: 0, rightFar: 15, chasmY: -6 }),
      pillar(0, 0.0, -6, 0.55, 0.95),
      spike(-1.5, 0.95, -6, 0.6),
      spike(1.5, 0.95, -6, 0.6),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(3.9, 0, 1.2, 2.2),
    killY: -8,
    coins: [...coinArc(-1.5, 1.3, 3, 0.45, 0.25), ...coinArc(1.5, 1.3, 3, 0.45, 0.25)],
    strokes: [
      {
        kind: '3star',
        role: 'multi-seal-M',
        points: spline([p(-3.5, 0.15), p(-2.3, 0.5), p(-1.5, 1.1), p(-0.7, 0.5), p(0, 0.18), p(0.7, 0.5), p(1.5, 1.1), p(2.3, 0.5), p(3.5, 0.15)]),
      },
    ],
  },

  // B1 — R08-lite multi-seal breather. SOURCE: Draw Line Bridge / Happy Glass. One
  // short 2-hole seal with generous coins (sawtooth trough after L5). Non-AD.
  {
    id: 'ch1-b1',
    design: '穴塞ぎ(multi-seal 易): 短い2連穴を一本で — R08-lite Draw Line Bridge',
    inkFeel: 'generous',
    bonusMultiplier: 6,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.0, leftY: 0, rightRim: 2.0, rightY: 0, rightFar: 20, chasmY: -5 }),
      pillar(0, -0.1, -5, 0.4, 0.8),
    ],
    vehicleSpawn: p(-4.2, 0.6),
    goalFlag: flag(4.4, 0, 1.5, 2.5),
    killY: -6,
    coins: [...coinArc(-1.0, 1.0, 4, 0.45, 0.35), ...coinArc(1.0, 1.0, 4, 0.45, 0.35), ...coinArc(3.0, 0.9, 4, 0.4, 0.35)],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'twin-seal', points: spline([p(-2.6, 0.15), p(-1.0, 0.5), p(0, 0.12), p(1.0, 0.5), p(2.6, 0.15)]) }],
  },

  // L6 — R10 ramp-jump (橋でなく跳ぶ). SOURCE: Draw Climber / Draw the Hill (終端 launch
  // ramp, 速度で飛距離) + Draw Physics Line (ランプで propel). A launch ramp flings the
  // car OVER a tall spike-pit onto a landing bank — the line is a jump ramp, not a
  // bridge. Straights impale on the spike (geometric AD). No rock.
  {
    id: 'ch1-l06',
    design: '跳躍(ramp-jump): ランプで棘を飛び越える — R10 Draw Climber / Draw the Hill',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -1.6, leftY: 0.6, rightRim: 2.4, rightY: 0, rightFar: 15, chasmY: -6 }),
      spike(0.4, 1.6, -6, 0.8),
    ],
    vehicleSpawn: p(-4.2, 1.2),
    goalFlag: flag(3.8, 0, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0.4, 2.2, 6, 0.55, 0.35),
    strokes: [{ kind: '3star', role: 'launch-ramp', points: arch(-2.5, 0.75, 2.9, 0.15, 1.5) }],
  },

  // L7 — R05 shield-dynamic (盾: 転がってくる岩を壁で止める). SOURCE: Stickman Rescue
  // (矢=車の前に垂直の壁) + Draw Bridge (cannon/saw/moving block を橋で覆う). A tall WALL
  // (top +1.75m) blocks every straight (geometric AD) and the ∧ vaults it to a +1.8m
  // bank. NEW ROLE: a rock spawns on the high goal bank and ROLLS LEFT down toward
  // the crossing — the vault's far shoulder walls it off / it rolls past under; the
  // firm high arch survives it. Distinct from L4 (falling) — here it ROLLS in.
  {
    id: 'ch1-l07',
    design: '盾(shield-dynamic): 転がる岩を壁で堰き止める — R05 Stickman Rescue / Draw Bridge',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.1, leftY: 0, rightRim: 2.1, rightY: 1.8, rightFar: 15, chasmY: -6 }),
      pillar(-0.1, 1.75, -6, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.6, 0.6),
    goalFlag: flag(3.8, 1.8, 1.2, 2.3),
    killY: -8,
    coins: coinArc(-0.1, 2.55, 6, 0.5, 0.3),
    rocks: [{ x: 4.6, y: 2.3, radius: 0.34, density: 3, initialVelocity: { x: -2.5, y: 0 } }],
    strokes: [{ kind: '3star', role: 'wall-vault', points: arch(-2.9, 0.15, 2.6, 1.95, 1.55) }],
  },

  // L8 — R06 catch-redirect (岩を止めるでなく逸らす). SOURCE: Draw Physics Line / Draw Line
  // Physics Puzzles (線=ランプで球を propel、壁で bounce) + Brain Dots (球を別方向へ redirect).
  // A mid SPIKE (geometric AD) + a rock that drops and the vault's downslope kicks it
  // off toward the goal-side pit — a DEFLECTOR ramp, not a wall. +1.4m bank.
  {
    id: 'ch1-l08',
    design: '逸らし(catch-redirect): 岩をランプで脇へ逃がす — R06 Draw Physics Line / Brain Dots',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.2, leftY: 0, rightRim: 2.2, rightY: 1.4, rightFar: 15, chasmY: -6 }),
      spike(-0.3, 1.6, -6, 0.85),
    ],
    vehicleSpawn: p(-4.7, 0.6),
    goalFlag: flag(4.0, 1.4, 1.2, 2.2),
    killY: -8,
    coins: coinArc(-0.3, 2.3, 6, 0.5, 0.3),
    rocks: [{ x: 0.7, y: 3.0, radius: 0.36, density: 3 }],
    strokes: [{ kind: '3star', role: 'deflect-ramp', points: arch(-2.9, 0.15, 2.7, 1.55, 1.5) }],
  },

  // L9 — R16 hook-cantilever / wrap-guard (引っ掛けて危険帯を回り込む護り道). SOURCE: Draw
  // Bridge L210 (証拠10) + Draw Save! (線が障害から守る). An OVERHANG rock lip (danger
  // band, underside 1.4->1.2m) forbids the high entry; the line HUGS LOW under the
  // lip then sweeps up to a +1.4m bank — an open S that WRAPS the hazard. Straights
  // die (lifted hit the lip, rim-height sag the deep pit). KEEP the ceiling — the
  // terrain-winding.spec.ts negative control needs L9's 2-point overhang.
  {
    id: 'ch1-l09',
    design: '回り込み(hook-cantilever): 危険帯の下を潜り護り道に — R16 Draw Bridge L210 / Draw Save!',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 1.4, rightFar: 14, chasmY: -6.5 }),
      ceiling(-2.2, -0.5, 1.4, 1.2),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.3, 1.4, 1.2, 2.2),
    killY: -8,
    coins: [...coinLine(-1.9, 0.46, -0.7, 0.5, 4), ...coinLine(0.4, 0.9, 2.6, 1.55, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'wrap-under-S',
        points: spline([p(-3.1, 0.2), p(-1.9, 0.3), p(-0.7, 0.36), p(0.3, 0.66), p(1.3, 1.12), p(2.3, 1.5), p(3.1, 1.65)]),
      },
    ],
  },

  // L10 — R14 dome-dual lite (盾＋道の兼任・入口 / MID-CLIMAX). SOURCE: Draw Bridge L69-74
  // (証拠12, dome-dual-role) simplified. A tall central WALL (top +1.0m) blocks every
  // straight over a 5.2m gorge and the goal sits 0.8m BELOW start; the line HUMPS
  // over the wall then LEAPS DOWN — AND a rock drops onto that hump, which the firm
  // arch bears + sheds. First time the ONE line is both roof (shield) and road.
  {
    id: 'ch1-l10',
    design: 'ドーム(dome-dual 入口): 守る屋根かつ走る道 — R14 Draw Bridge L69-74',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -2.6, leftY: 0, rightRim: 2.6, rightY: -0.8, rightFar: 16, chasmY: -5.0 }),
      pillar(-0.1, 1.0, -5.0, 0.5, 0.95),
    ],
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.4, -0.8, 1.0, 2.2),
    killY: -6.0,
    coins: [...coinArc(-0.1, 1.7, 4, 0.5, 0.25), ...coinLine(1.2, 0.2, 2.8, -0.5, 4)],
    rocks: [{ x: 0.9, y: 2.8, radius: 0.34, density: 3 }],
    strokes: [{ kind: '3star', role: 'dome-leap-down', points: arch(-2.9, 0.15, 2.9, -0.65, 1.55) }],
  },

  // B2 — R03-lite sag-rope breather (張り渡し). SOURCE: Draw Line Bridge ("COLLECT
  // COINS" 弛むロープ). A shallow taut span over a low spike floor + coin arc — the
  // sag window is generous (breather after the L10 climax). Non-AD.
  {
    id: 'ch1-b2',
    design: '張り渡し(sag-rope 易): 棘の上に弛ませず渡す — R03-lite Draw Line Bridge',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0.4, rightRim: 2.3, rightY: 0.4, rightFar: 20, chasmY: -5 }),
      spike(-0.7, -0.6, -5, 0.5),
      spike(0.9, -0.6, -5, 0.5),
    ],
    vehicleSpawn: p(-4.4, 1.0),
    goalFlag: flag(4.6, 0.4, 1.5, 2.5),
    killY: -6,
    coins: [...coinArc(0.1, 1.3, 6, 0.5, 0.4), ...coinArc(3.0, 1.2, 5, 0.45, 0.4)],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'taut-span', points: arch(-3.0, 0.55, 3.0, 0.55, 0.2) }],
  },

  // L11 — R03 sag-rope over pit spikes (ハザード上に張り渡す). SOURCE: Draw Line Bridge
  // (証拠11上, pit 内ハザード上を弛むロープが渡る). Two floor SPIKES sit in the pit; a
  // near-taut span must clear both tips AND reach a +1.4m bank — sag too much and it
  // impales, and a rim-height straight can't reach the raised bank (geometric AD). The
  // sag window is the puzzle. No rock (spikes are the pit hazard).
  {
    id: 'ch1-l11',
    design: '張り渡し(sag-rope): 棘の上に張力を保って渡す — R03 Draw Line Bridge (証拠11)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.4, leftY: 0, rightRim: 2.4, rightY: 1.4, rightFar: 15, chasmY: -6 }),
      spike(-0.9, 1.5, -6, 0.5),
      spike(0.9, 1.5, -6, 0.5),
    ],
    vehicleSpawn: p(-4.8, 0.6),
    goalFlag: flag(4.0, 1.4, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 2.2, 6, 0.5, 0.3),
    strokes: [{ kind: '3star', role: 'taut-over-spikes', points: arch(-3.0, 0.15, 2.9, 1.55, 1.5) }],
  },

  // L12 — R02 hook-cantilever / wrap (引っ掛けて危険帯を縫う, 証拠10 Draw Bridge L210).
  // SOURCE: Draw Bridge (Bravestars) Level 210 — the user's image. An overhang lip
  // (1.5->1.25m) forbids the high line; the stroke ducks LOW under it, then wraps up
  // to a +2.0m ledge — a smooth S wrapping the danger band. Straights die on the
  // raised-goal/deep-pit. Distinct sub-role from L9 (this is the classic L210 wrap).
  {
    id: 'ch1-l12',
    design: '回り込み(hook-wrap): 危険帯を縫って高台へ — R02 Draw Bridge L210 (証拠10, ユーザー画像)',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2.0, rightFar: 15, chasmY: -6.5 }),
      ceiling(-2.25, -0.55, 1.5, 1.25),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.4, 2.0, 1.0, 2.2),
    killY: -8,
    coins: [...coinLine(-1.9, 0.44, -0.7, 0.48, 4), ...coinLine(0.4, 1.25, 2.6, 2.1, 4)],
    strokes: [
      {
        kind: '3star',
        role: 'wrap-climb-S',
        points: spline([p(-3.2, 0.2), p(-1.9, 0.3), p(-0.6, 0.34), p(0.3, 0.66), p(1.2, 1.15), p(2.1, 1.65), p(3.0, 2.02), p(3.8, 2.2)]),
      },
    ],
  },

  // L13 — R11 shield-timed (時限盾: 確定した瞬間に転石が発進). SOURCE: Stickman Rescue
  // (引く前に来る障害を観察) + Happy Glass (描き始めた瞬間に球が動き出す). A tall WALL
  // (top +1.2m) is the geometric AD; a rock LAUNCHES with a leftward velocity the
  // instant the run starts (rocks spawn post-commit) and rolls at the crossing — the
  // firm over-wall vault to the +1.5m bank must be drawn to beat it. Timing role.
  {
    id: 'ch1-l13',
    design: '時限盾(shield-timed): 確定した瞬間に岩が走り出す — R11 Stickman Rescue / Happy Glass',
    inkFeel: 'standard',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.3, leftY: 0, rightRim: 2.3, rightY: 1.5, rightFar: 15, chasmY: -6 }),
      pillar(0, 1.8, -6, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.7, 0.6),
    goalFlag: flag(4.0, 1.5, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 2.75, 6, 0.5, 0.4),
    rocks: [{ x: 4.4, y: 2.1, radius: 0.34, density: 3, initialVelocity: { x: -3, y: 0 } }],
    strokes: [{ kind: '3star', role: 'timed-vault', points: arch(-2.8, 0.15, 2.7, 1.65, 1.6) }],
  },

  // L14 — R12+R08 catch-redirect + multi-seal FUSION (受け皿で逸らし＋複数穴塞ぎ). SOURCE:
  // Happy Glass funnel + Draw Line Bridge. TWO spikes (multi-seal holes, geometric AD)
  // AND a rock the M-line's central shoulder deflects off — two roles solved by one
  // stroke. Tight ink. The compound before the boss.
  {
    id: 'ch1-l14',
    design: '複合(catch+multi-seal): 逸らし＋複数穴塞ぎを一本で — R12+R08 Happy Glass / Draw Line Bridge',
    inkFeel: 'tight',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.9, leftY: 0, rightRim: 2.9, rightY: 0, rightFar: 15, chasmY: -6 }),
      pillar(0, 0.0, -6, 0.55, 0.95),
      spike(-1.5, 1.1, -6, 0.6),
      spike(1.5, 1.1, -6, 0.6),
    ],
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(3.9, 0, 1.2, 2.2),
    killY: -8,
    coins: [...coinArc(-1.5, 1.7, 3, 0.45, 0.25), ...coinArc(1.5, 1.7, 3, 0.45, 0.25)],
    rocks: [{ x: 2.2, y: 2.6, radius: 0.34, density: 3 }],
    strokes: [{ kind: '3star', role: 'fusion-dome', points: arch(-3.5, 0.15, 3.5, 0.15, 1.7) }],
  },

  // L15 — R15 dome-dual FULL composite (章ボス: 覆う→棘越え→落石を弾き→登坂). SOURCE: Draw
  // Bridge 後半 + Stickman 多段ハザード. The deepest/widest board: a 6.6m chasm, an
  // approach OVERHANG lip forbidding the high entry, a mid SPIKE, the highest +2.4m
  // summit, TWO rocks, tight ink. The long S ducks the lip, vaults the spike bearing
  // the rocks, and climbs the summit — every learned role in one stroke.
  {
    id: 'ch1-l15',
    design: 'ボス(dome-dual 完全体): 潜り→棘越え→落石を弾き→登坂 — R15 Draw Bridge / Stickman 多段',
    inkFeel: 'tight',
    gimmickTags: AD,
    maxTicks: 1800,
    terrain: [
      ...twoPlatforms({ leftFar: -13, leftRim: -3.3, leftY: 0, rightRim: 3.3, rightY: 2.4, rightFar: 18, chasmY: -6.5 }),
      ceiling(-3.0, -1.1, 1.7, 1.4),
      spike(1.4, 1.5, -6.5, 0.65),
    ],
    vehicleSpawn: p(-6.0, 0.6),
    goalFlag: flag(4.8, 2.4, 1.0, 2.2),
    killY: -8.5,
    coins: [...coinLine(-2.6, 0.5, -0.6, 0.95, 4), ...coinLine(0.6, 1.6, 3.0, 2.55, 4)],
    rocks: [
      { x: 7.4, y: 3.0, radius: 0.32, density: 3, initialVelocity: { x: -2, y: 0 } },
      { x: 9.0, y: 3.2, radius: 0.32, density: 3, initialVelocity: { x: -3, y: 0 } },
    ],
    strokes: [
      {
        kind: '3star',
        role: 'boss-composite-S',
        points: spline([
          p(-4.0, 0.18),
          p(-2.7, 0.34),
          p(-1.4, 0.5),
          p(-0.2, 1.0),
          p(0.9, 1.6),
          p(1.9, 2.15),
          p(2.9, 2.4),
          p(3.6, 2.55),
        ]),
      },
    ],
  },

  // B3 — R01-lite dome-dual easy (章完走＋守る道の再確認, coin祭). SOURCE: Draw Bridge
  // L69-74 (証拠12). A gentle central-support arch bears a light falling rock over a
  // modest gap, with a coin bonanza — a victory-lap reprise of the dome role. Non-AD.
  {
    id: 'ch1-b3',
    design: 'ドーム(dome-dual 易): 守る道の再確認＋コイン祭 — R01-lite Draw Bridge L69-74 (証拠12)',
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.2, leftY: 0, rightRim: 2.2, rightY: 0, rightFar: 24, chasmY: -5 }),
      pillar(0, -0.2, -5, 0.5, 0.9),
    ],
    vehicleSpawn: p(-4.6, 0.6),
    goalFlag: flag(5.2, 0, 1.6, 2.6),
    killY: -6,
    coins: [...coinArc(-0.1, 1.5, 5, 0.5, 0.35), ...coinArc(2.4, 1.1, 5, 0.45, 0.45), ...coinArc(4.0, 1.0, 4, 0.4, 0.4)],
    gimmickTags: [],
    rocks: [{ x: 0.4, y: 2.8, radius: 0.34, density: 3 }],
    strokes: [{ kind: 'any', role: 'dome-reprise', points: arch(-3.0, 0.15, 3.0, 0.15, 0.9) }],
  },
];

// Keep the Gap type reachable for downstream tooling / Ch2 sources.
export type { Gap };

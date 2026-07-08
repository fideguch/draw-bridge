/**
 * Chapter 1 declarative level sources (T086-T088).
 *
 * Pure DATA + geometry helpers consumed by scripts/levels/authoring.ts, which
 * runs each candidate stroke through the real engine at Lv0, derives the ink
 * economy from measured consumption, records ghosts, and emits levels/<id>.json.
 * When TuningConstants change (device juice tuning), regeneration = rerun the
 * authoring script against these sources — no hand-edited JSON.
 *
 * Design contract: designs/game_design.md §5 (sawtooth difficulty, FTUE) + §6
 * (per-level briefs). Physics authoring constraints: specs/.../research.md §R10
 * (unanchored chain; wide gaps need >=3 m platform overlap; unsupported spans
 * <= ~5 m, 6 m only with a mid support 中間支点 or generous overlap; N<=32 and
 * N<24 for wide unsupported spans). Anti-dominant defense (Gate 3): raised goal
 * platforms + ink-tight budgets defeat every straight rim-to-rim candidate while
 * a hand-tuned arch clears (proven pattern: tests/fixtures/gate-levels/ch1-l08).
 *
 * PLAYABLE-WINDOW COMPACTION (2026-07-08, real-device "stage too small"): the
 * framing (src/render/scenes/play/levelFraming.ts) fits spawn↔flag + 2 m pad, so
 * the on-screen size is driven by how far spawn/flag sit from the gap. Genre hits
 * (Draw Bridge) start the car ~2.5-3 m before the near rim and put the goal
 * ~2-3.5 m after the far rim so the ACTION fills the screen. Every spawn/flag was
 * pulled to that spacing; the GAP geometry and the candidate STROKES stay anchored
 * near x=0 (so ink economy + the Gate 3 rim/straight defense are untouched), and
 * the terrain runways keep their generous scenery extents (framing clips them).
 *
 * Coordinates: world meters, y-up. Terrain polylines authored left->right with
 * top-side winding (Terrain.ts reverses internally). Chasm bottoms drop slightly
 * outward from each rim (matches the fixtures).
 */

import type { GimmickTag, Point, Polyline, Rect } from '../../src/engine/level/LevelSchema';

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
  /** Drives inkBudget = feelFactor x tight-reference ink (game_design §6 legend). */
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
  /** Explicit budget override (anti-dominant budget tuning). */
  readonly inkBudget?: number;
  /** Explicit thresholds override. */
  readonly starThresholds?: { readonly star2: number; readonly star3: number };
}

// -- geometry helpers ------------------------------------------------------------

const p = (x: number, y: number): Point => ({ x, y });

/** Straight two-point stroke a->b. */
function line(ax: number, ay: number, bx: number, by: number): StrokeSource['points'] {
  return [p(ax, ay), p(bx, by)];
}

/**
 * Parabolic arch from (lx,ly) to (rx,ry) with an upward bow of `bow` m at the
 * center. Ends are hit exactly (bow term vanishes at the endpoints). `ly`/`ry`
 * already include the small rest offset above the platform surface.
 */
function arch(lx: number, ly: number, rx: number, ry: number, bow: number, count = 21): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1
    const s = 2 * t - 1; // -1..1
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + bow * (1 - s * s)));
  }
  return points;
}

/** Deliberately wobbly line (FTUE L1 "any sloppy line works"). Deterministic. */
function wobble(lx: number, ly: number, rx: number, ry: number, amp: number, count = 17): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const s = 2 * t - 1;
    const jitter = amp * Math.sin(i * 1.9) * (1 - s * s); // fades to 0 at the ends
    points.push(p(lx + (rx - lx) * t, ly + (ry - ly) * t + 0.25 * (1 - s * s) + jitter));
  }
  return points;
}

/** Two-platform gap (left surface leftY, right surface rightY). */
interface Gap {
  readonly leftFar: number;
  readonly leftRim: number;
  readonly leftY: number;
  readonly rightRim: number;
  readonly rightY: number;
  readonly rightFar: number;
  readonly chasmY: number;
}
function twoPlatforms(g: Gap): Polyline[] {
  return [
    [
      [g.leftFar, g.leftY],
      [g.leftRim, g.leftY],
      [g.leftRim - 0.2, g.chasmY],
    ],
    [
      [g.rightRim + 0.2, g.chasmY],
      [g.rightRim, g.rightY],
      [g.rightFar, g.rightY],
    ],
  ];
}

/** Flat-topped mesa (mid support 中間支点) rising from the chasm floor (base wider than top). */
function pillar(cx: number, topY: number, chasmY: number, halfTop = 0.7, halfBase = 1.1): Polyline {
  return [
    [cx - halfBase, chasmY],
    [cx - halfTop, topY],
    [cx + halfTop, topY],
    [cx + halfBase, chasmY],
  ];
}

/** Goal flag rect anchored on the platform surface. */
function flag(x: number, surfaceY: number, width = 1.2, height = 2.2): Rect {
  return { x, y: surfaceY, width, height };
}

/** A rhythm group of coins along an arch drive line. */
function coinArc(cx: number, cy: number, count: number, spacing: number, rise: number): Point[] {
  const coins: Point[] = [];
  const start = cx - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const s = (2 * i) / (count - 1) - 1; // -1..1
    coins.push(p(start + i * spacing, cy + rise * (1 - s * s)));
  }
  return coins;
}

// -- levels ----------------------------------------------------------------------

export const CH1_SOURCES: readonly LevelSource[] = [
  // L1 — tiny gap, generous ink, any sloppy line works (FTUE first success <=10 s).
  {
    id: 'ch1-l01',
    design: '1.8m gap · any-line-works',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -9, leftRim: -0.9, leftY: 0, rightRim: 0.9, rightY: 0, rightFar: 12, chasmY: -5 }),
    // Compacted: spawn 2.6 m before the near rim, flag 2.0 m past the far rim.
    vehicleSpawn: p(-3.5, 0.6),
    goalFlag: flag(2.9, 0, 1.5, 2.5),
    killY: -6,
    coins: coinArc(0, 0.9, 5, 0.5, 0.35),
    gimmickTags: [],
    // Wobble amp trimmed 0.28 -> 0.18 (firm-bridge rebuild): rdpEpsilon 0.02 now
    // preserves the drawn wobble, so a big-amp sloppy line makes a bumpy firm
    // bridge the car crawls over (431t). 0.18 stays visibly sloppy (FTUE "any
    // line works") while the brisk car clears in ~209t (< the old 251 baseline).
    strokes: [{ kind: 'any', role: 'wobbly', points: wobble(-2, 0.15, 2, 0.15, 0.18) }],
  },

  // L2 — slightly wider + slight step; teach ink meter/stars (straight -> 3 stars).
  {
    id: 'ch1-l02',
    design: '2.5m gap · slight step · straight=3★',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -10, leftRim: -1.25, leftY: 0, rightRim: 1.25, rightY: 0.3, rightFar: 13, chasmY: -5 }),
    vehicleSpawn: p(-3.85, 0.6),
    goalFlag: flag(3.25, 0.3, 1.4, 2.4),
    killY: -6,
    coins: coinArc(0, 1.1, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'tight-straight', points: line(-2.6, 0.15, 2.6, 0.5) },
      { kind: 'any', role: 'loose-arch', points: arch(-3, 0.2, 3, 0.55, 0.5) },
    ],
  },

  // L3 — wider valley; consolidation (sloppy drops to 2 stars).
  {
    id: 'ch1-l03',
    design: '3m gap · consolidation',
    inkFeel: 'standard',
    terrain: twoPlatforms({ leftFar: -10, leftRim: -1.5, leftY: 0, rightRim: 1.5, rightY: 0, rightFar: 13, chasmY: -5 }),
    // Extra runway (3.5 m): the wasteful high-bow "sloppy" alternative needs entry
    // speed to clear the tall hump; the tight 3★ arch clears at less.
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(3.5, 0, 1.3, 2.3),
    killY: -6,
    coins: coinArc(0, 1.0, 6, 0.5, 0.35),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'tight-arch', points: arch(-2.6, 0.15, 2.6, 0.15, 0.4) },
      { kind: 'any', role: 'sloppy-high', points: arch(-3.2, 0.2, 3.2, 0.2, 0.95) },
    ],
  },

  // L4 — mid support discovery (resting on the pillar is cheaper).
  {
    id: 'ch1-l04',
    design: '4m gap + central pillar 中間支点',
    inkFeel: 'standard',
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 14, chasmY: -5 }),
      pillar(0, -0.3, -5),
    ],
    // Shallow rest-on-pillar sag (bow -0.12): still loads the mid support but no
    // longer stalls the car at the bridge lip, so genre runway (2.9 m) clears.
    vehicleSpawn: p(-4.9, 0.6),
    goalFlag: flag(4.0, 0, 1.3, 2.3),
    killY: -6,
    coins: coinArc(0, 0.9, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'rests-on-pillar', points: arch(-2.8, 0.1, 2.8, 0.1, -0.12) },
      { kind: 'any', role: 'sag-wide', points: arch(-3.2, 0.15, 3.2, 0.15, -0.1) },
    ],
  },

  // L5 — first "curve/arch is needed for 3 stars" (wider gap, low far bank).
  {
    id: 'ch1-l05',
    design: '4.5m gap · low far bank · arch=3★',
    inkFeel: 'standard',
    terrain: twoPlatforms({ leftFar: -11, leftRim: -2.25, leftY: 0.4, rightRim: 2.25, rightY: -0.2, rightFar: 14, chasmY: -5.5 }),
    // Wide shallow arch (bridge left end at x=-5.2): spawn sits just behind it so
    // the car is behind the bridge with a short flat runway before the climb.
    vehicleSpawn: p(-5.5, 1.0),
    goalFlag: flag(4.25, -0.2, 1.3, 2.4),
    killY: -6.5,
    coins: coinArc(0, 0.9, 7, 0.5, 0.4),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'arch', points: arch(-5, 0.5, 5, 0.0, 0.42) },
      { kind: 'any', role: 'higher-arch', points: arch(-5.2, 0.55, 5.2, 0.1, 0.6) },
    ],
  },

  // B1 — bonus after L5: flat long run + coin arch (playful reward).
  {
    id: 'ch1-b1',
    design: 'bonus · flat long run · coin arch',
    inkFeel: 'generous',
    bonusMultiplier: 6,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.0, leftY: 0, rightRim: 1.0, rightY: 0, rightFar: 20, chasmY: -5 }),
    // Bonus keeps a longer post-gap run than a standard level, but fills the
    // multi-gap window budget (≤16 m) instead of the old 29 m sprawl.
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(5.8, 0, 1.5, 2.5),
    killY: -6,
    coins: [
      ...coinArc(0.3, 1.0, 5, 0.5, 0.35),
      ...coinArc(2.8, 1.2, 6, 0.45, 0.55),
      ...coinArc(4.8, 1.1, 5, 0.4, 0.45),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'straight', points: line(-2.2, 0.15, 2.2, 0.15) }],
  },

  // L6 — breather (sawtooth trough): two short narrow gaps.
  {
    id: 'ch1-l06',
    design: 'breather · two short gaps',
    inkFeel: 'generous',
    terrain: [
      [
        [-11, 0],
        [-2.3, 0],
        [-2.5, -5],
      ],
      // central island
      [
        [-1.1, -5],
        [-0.9, 0],
        [0.9, 0],
        [1.1, -5],
      ],
      [
        [2.5, -5],
        [2.3, 0],
        [13, 0],
      ],
    ],
    // Near rim -2.3, far rim 2.3: spawn 2.6 m before, flag 2.0 m after.
    vehicleSpawn: p(-4.9, 0.6),
    goalFlag: flag(4.3, 0, 1.4, 2.4),
    killY: -6,
    coins: [...coinArc(-1.6, 0.9, 3, 0.45, 0.25), ...coinArc(1.6, 0.9, 3, 0.45, 0.25)],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'double-hump', points: arch(-3, 0.15, 3, 0.15, 0.4) }],
  },

  // L7 — uphill: bridge to a higher far bank (climb).
  {
    id: 'ch1-l07',
    design: '3.5m gap · uphill far bank',
    inkFeel: 'standard',
    terrain: twoPlatforms({ leftFar: -11, leftRim: -1.75, leftY: 0, rightRim: 1.75, rightY: 1.2, rightFar: 14, chasmY: -5 }),
    vehicleSpawn: p(-4.7, 0.6),
    goalFlag: flag(3.75, 1.2, 1.3, 2.3),
    killY: -6,
    coins: coinArc(0.5, 1.4, 6, 0.5, 0.35),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'ramp-arch', points: arch(-2.8, 0.15, 3.0, 1.35, 0.4) },
      { kind: 'any', role: 'high-ramp', points: arch(-3.2, 0.2, 3.4, 1.4, 0.9) },
    ],
  },

  // L8 — deflect/creak/break: wide gap, RAISED goal bank (anti-dominant, proven pattern).
  {
    id: 'ch1-l08',
    design: '5m gap · raised +2m goal · sag/break',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2, rightFar: 15, chasmY: -6 }),
    // Climb level: the motor-powered ramp arch clears at tight runway (probed),
    // so spawn sits 2.7 m before the near rim; flag 2.0 m onto the raised bank.
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.5, 2, 1.2, 2.2),
    killY: -8,
    coins: coinArc(0, 1.6, 6, 0.55, 0.4),
    // Tight efficient arch (firm-bridge rebuild 2026-07-08): a firm bridge lets
    // the car climb straight rim-to-rim ramps to the +2m goal, so the old wider
    // arch no longer dominated on economy. This shorter arch (low overlap, bow
    // 0.3) needs only ~6.2 ink, pinning the tight budget below the overlapped
    // straights (Gate 3 economy defense — they become infeasible(budget)).
    strokes: [{ kind: 'any', role: 'efficient-arch', points: arch(-3.0, 0.15, 2.8, 2.15, 0.3) }],
  },

  // L9 — support + budget (rest on an offset pillar, draw short). Tight.
  {
    id: 'ch1-l09',
    design: '4.5m gap · offset pillar · tight budget',
    inkFeel: 'tight',
    terrain: [
      ...twoPlatforms({ leftFar: -11, leftRim: -2, leftY: 0, rightRim: 2, rightY: 0, rightFar: 14, chasmY: -5.5 }),
      pillar(0.6, -0.35, -5.5),
    ],
    // Offset-pillar V-dip stroke needs momentum to climb out (probed cliff at
    // ~2.5 m): 3.5 m runway gives safe margin.
    vehicleSpawn: p(-5.5, 0.6),
    goalFlag: flag(4.0, 0, 1.3, 2.3),
    killY: -6.5,
    coins: coinArc(0.4, 0.9, 6, 0.5, 0.3),
    gimmickTags: [],
    strokes: [{ kind: '3star', role: 'rests-on-offset-pillar', points: [p(-3, 0.12), p(0.6, -0.3), p(2.9, 0.12)] }],
  },

  // L10 — mid climax: wide gap, high raised goal +2.3m (anti-dominant, proven raised-goal pattern).
  {
    id: 'ch1-l10',
    design: '5.5m gap · high raised +2.3m goal · climax',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -13, leftRim: -2.7, leftY: 0, rightRim: 2.7, rightY: 2.2, rightFar: 16, chasmY: -6 }),
    vehicleSpawn: p(-5.3, 0.6),
    goalFlag: flag(4.7, 2.2, 1.0, 2.2),
    killY: -8,
    coins: coinArc(-0.2, 1.7, 7, 0.55, 0.45),
    // Tight efficient arch (firm-bridge rebuild): low overlap keeps the derived
    // budget below the overlapped straights so Gate 3 defeats them by economy.
    strokes: [{ kind: 'any', role: 'efficient-arch', points: arch(-3.2, 0.15, 3.0, 2.35, 0.3) }],
  },

  // B2 — bonus after L10: gentle downhill + triple coin arch.
  {
    id: 'ch1-b2',
    design: 'bonus · gentle downhill · triple coin arch',
    inkFeel: 'generous',
    bonusMultiplier: 7,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.2, leftY: 0.7, rightRim: 1.2, rightY: 0.3, rightFar: 20, chasmY: -5 }),
    vehicleSpawn: p(-3.8, 1.3),
    goalFlag: flag(5.5, 0.3, 1.5, 2.5),
    killY: -6,
    coins: [
      ...coinArc(0.2, 1.3, 5, 0.5, 0.4),
      ...coinArc(2.6, 1.15, 6, 0.45, 0.55),
      ...coinArc(4.6, 1.0, 5, 0.4, 0.45),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'gentle-arch', points: arch(-2.8, 0.85, 2.8, 0.45, 0.3) }],
  },

  // L11 — breather: downhill momentum into a small gap.
  {
    id: 'ch1-l11',
    design: 'breather · downhill · small gap',
    inkFeel: 'generous',
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.5, leftY: 0.45, rightRim: 1.5, rightY: 0, rightFar: 14, chasmY: -5 }),
    // Wide downhill arch (left end x=-4): spawn just behind it.
    vehicleSpawn: p(-4.3, 1.05),
    goalFlag: flag(3.5, 0, 1.4, 2.4),
    killY: -6,
    coins: coinArc(0, 0.85, 6, 0.5, 0.35),
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'downhill-arch', points: arch(-4, 0.55, 4, 0.15, 0.32) }],
  },

  // L12 — transition-angle management: deep gorge, raised far ledge +2.2m (anti-dominant).
  {
    id: 'ch1-l12',
    design: '5.2m gorge · raised +2.2m far ledge · steep straight fails',
    inkFeel: 'standard',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.6, leftY: 0, rightRim: 2.6, rightY: 2.2, rightFar: 15, chasmY: -6 }),
    vehicleSpawn: p(-5.3, 0.6),
    goalFlag: flag(4.6, 2.2, 1.0, 2.2),
    killY: -8,
    coins: coinArc(-0.2, 1.7, 6, 0.55, 0.45),
    // Tight efficient arch (firm-bridge rebuild): steep-straight physics no
    // longer fails the bot, so the tight budget (low-overlap arch) is the Gate 3 defense.
    strokes: [{ kind: 'any', role: 'efficient-arch', points: arch(-3.1, 0.15, 2.9, 2.35, 0.3) }],
  },

  // L13 — support choice: two pillars, pick the right one (low one is a trap). Tight star3.
  {
    id: 'ch1-l13',
    design: '5m gap · two pillars (choose correct) · tight star3',
    inkFeel: 'standard',
    terrain: [
      ...twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 0, rightFar: 15, chasmY: -6 }),
      pillar(-0.3, -0.5, -6, 0.8, 0.5), // correct: high, near center
      pillar(1.7, -2.6, -6, 0.7, 0.45), // trap: too low to help
    ],
    // The high central pillar supports even the tall high-arch alternative, so it
    // clears at genre runway (probed to spawn -4.7); -5.0 keeps safe margin.
    vehicleSpawn: p(-5.0, 0.6),
    goalFlag: flag(4.5, 0, 1.3, 2.3),
    killY: -8,
    coins: coinArc(-0.3, 0.9, 6, 0.5, 0.35),
    gimmickTags: [],
    strokes: [
      { kind: '3star', role: 'rests-on-high-pillar', points: arch(-3.2, 0.15, 3.4, 0.15, 0.34) },
      { kind: 'any', role: 'high-arch', points: arch(-3.6, 0.2, 3.6, 0.2, 0.95) },
    ],
  },

  // L14 — precision: raised goal + narrow flag + tight budget (anti-dominant).
  {
    id: 'ch1-l14',
    design: '5m gap · raised +2m goal · narrow flag (precision) · tight',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -2.5, leftY: 0, rightRim: 2.5, rightY: 2, rightFar: 14, chasmY: -6 }),
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.5, 2, 1.0, 1.9),
    killY: -8,
    coins: coinArc(-0.2, 1.6, 5, 0.5, 0.35),
    // Tight efficient arch (firm-bridge rebuild): low-overlap arch pins the tight
    // budget below the overlapped straights (Gate 3 economy defense).
    strokes: [{ kind: 'any', role: 'precise-arch', points: arch(-3.0, 0.15, 2.8, 2.15, 0.3) }],
  },

  // L15 — chapter boss: longest span + highest climb to raised goal, tight (anti-dominant).
  {
    id: 'ch1-l15',
    design: 'BOSS · 5.4m span · climb to +2.2m goal · long run · tight',
    inkFeel: 'tight',
    gimmickTags: ['anti-dominant'],
    maxTicks: 1800,
    terrain: twoPlatforms({ leftFar: -13, leftRim: -2.7, leftY: 0, rightRim: 2.7, rightY: 2.2, rightFar: 18, chasmY: -6.5 }),
    vehicleSpawn: p(-5.2, 0.6),
    goalFlag: flag(4.7, 2.2, 1.0, 2.2),
    killY: -8.5,
    coins: coinArc(-0.2, 1.7, 7, 0.55, 0.5),
    // Tight efficient boss arch (firm-bridge rebuild): low-overlap arch pins the
    // tight budget below the overlapped straights (Gate 3 economy defense).
    strokes: [{ kind: 'any', role: 'boss-arch', points: arch(-3.2, 0.15, 3.0, 2.35, 0.3) }],
  },

  // B3 — bonus after L15: flat long run + coin bonanza.
  {
    id: 'ch1-b3',
    design: 'bonus · flat long run · coin bonanza',
    inkFeel: 'generous',
    bonusMultiplier: 8,
    terrain: twoPlatforms({ leftFar: -12, leftRim: -1.0, leftY: 0, rightRim: 1.0, rightY: 0, rightFar: 24, chasmY: -5 }),
    vehicleSpawn: p(-3.6, 0.6),
    goalFlag: flag(5.8, 0, 1.6, 2.6),
    killY: -6,
    coins: [
      ...coinArc(0.2, 1.0, 5, 0.45, 0.35),
      ...coinArc(2.2, 1.2, 5, 0.4, 0.5),
      ...coinArc(3.8, 1.2, 5, 0.4, 0.5),
      ...coinArc(5.2, 1.1, 4, 0.35, 0.4),
    ],
    gimmickTags: [],
    strokes: [{ kind: 'any', role: 'straight', points: line(-2.2, 0.15, 2.2, 0.15) }],
  },
];

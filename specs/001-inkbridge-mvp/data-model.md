# Data Model: InkBridge MVP

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)
Naming follows `.specify/memory/conventions.md` (camelCase JSON keys, UL vocabulary, no `stage`).

## 0. Units & Coordinate Conventions

- Physics world units: **meters**, y-up (Box2D convention). Fixed timestep `1/60`; 1 tick = 1 physics step.
- Level JSON coordinates are world-space meters. Screen mapping (portrait 390×844 design basis) is a Render concern only.
- Pixel values (`*Px`, `*Pct`) apply to Render/UI layers, never to Engine.

## 1. Entities

### 1.1 Level (JSON file, `levels/*.json`)

Authoritative contract: [contracts/level-schema.md](./contracts/level-schema.md) (Gate 0 source of truth).

| Field | Type | Required | Validation | Source |
|---|---|---|---|---|
| `schemaVersion` | int | yes | `>= 1`; current = 1; older versions forward-migrated | FR-015 |
| `id` | string | yes | `^ch1-(l(0[1-9]\|1[0-5])\|b[1-3])$` — `ch1-l01`..`ch1-l15`, `ch1-b1`..`ch1-b3`; must match filename | FR-015, conventions §3 |
| `terrain` | Polyline[] | yes | ≥ 1 polyline; each ≥ 2 points; finite numbers; built as static Box2D chain shapes | FR-015, game_design §3.5 |
| `vehicleSpawn` | Point | yes | chassis center at rest above a terrain surface (Gate 1 raycast-down check) | FR-015 |
| `goalFlag` | Rect | yes | `width > 0`, `height > 0`; clear judged on VehicleReferencePoint entering this rect | FR-007, FR-015 |
| `killY` | number | yes | `killY < min(terrain vertex y)` — strictly below the lowest terrain point | FR-008, FR-015 |
| `inkBudget` | number | yes | `> 0` (Gate 1); world-meters of drawable stroke length at Lv0 | FR-002, FR-015 |
| `starThresholds` | `{star2, star3}` | yes | `0 < star3 < star2 <= inkBudget` (ink-consumption thresholds; less = better) | FR-007 |
| `coins` | Point[] | yes (may be empty) | guidance 5–10 per level; 1 coin value each | FR-009, game_design §7.3 |
| `gimmickTags` | string[] | yes (may be empty) | vocabulary: `"anti-dominant"` (Gate 3 target); Ch1 anti-dominant set = L8, L10, L12, L14, L15 | FR-026, game_design §5.5/§6 |
| `ghostSolutions` | GhostSolution[] | yes | length ≥ 1; recorded at Lv0 upgrades; levels with a 3-star intent carry a second `kind:"3star"` ghost | FR-015, FR-024, FR-026 |
| `maxTicks` | int | no | overrides `fail.maxTicksDefault` (1800 = 30 s) | FR-008, game_design §8.1 |
| `bonusMultiplier` | number | bonus only | required iff `id` matches `ch1-b*`; range 5–10, initial 6; forbidden on normal levels | FR-009, game_design §7.4 |

**GhostSolution** (embedded in Level):

| Field | Type | Notes |
|---|---|---|
| `kind` | `"any" \| "3star"` | `"3star"` ghosts must additionally satisfy `result.inkConsumed <= starThresholds.star3` (Gate 2 assert) |
| `stroke` | Point[] (≥ 2) | committed stroke polyline (post-simplify, pre-resample), world meters — replay input; run phase has zero input, so level + stroke fully determines the run |
| `sampleEveryTicks` | int ≥ 1 | self-describing sample density (authoring default 10; non-physics value) |
| `samples` | `{t, x, y}[]` | VehicleReferencePoint position samples every `sampleEveryTicks` ticks — position-sample playback, **never input replay** |
| `result` | object | `{outcome: "clear", ticks: int, finalPos: {x,y}, inkConsumed: number, starRating: 1\|2\|3}` — Gate 2 tolerance anchor |

### 1.2 Stroke (runtime, pre-solidify)

One per level attempt. Pipeline stages (FR-001, FR-003):

| Stage | Representation | Rule |
|---|---|---|
| `rawPoints` | screen px, ordered | vertex appended when ≥ `draw.minPointDistPx` (6 px) from last; tip always renders raw same-frame; smoothing applies to past vertices only |
| `simplified` | world m | RDP simplification (epsilon: TBD (spike/tuning)) |
| `resampled` | world m | equal-interval resample at `physics.segmentLength` (0.65 m; range 0.5–0.8) — input to BridgeChainBuilder |

Fields: `points` (current raw polyline), `inkConsumed` (world-meter length, decremented from budget in the same frame), `strokeId` (int, used as negative `groupIndex` collision filter). Constraints: exactly one stroke per attempt; drawing blocked during run phase; strokes with < 2 valid vertices or shorter than one segment length (0.5 m equivalent) are discarded with ink refunded.

### 1.3 BridgeChain (runtime, post-solidify)

| Field | Type | Notes |
|---|---|---|
| `segments` | Segment[] | N = 8–24 capsule bodies (start 12, hard cap 32), length = `physics.segmentLength`; capsule radius TBD (spike S1); same-stroke self-collision off (`groupIndex = -strokeId`); total chain mass = `bridge.strokeMassToCarRatio` (0.5) × vehicle mass |
| `joints` | ChainJoint[] | N−1 revolute joints: spring `hertz` 6 (4–8), `dampingRatio` 0.7 (0.6–0.8), angle limit ±0.3 rad (±0.2–0.4), `collideConnected=false` |
| joint stress state | per joint | `raw = \|F\|/breakForce + \|τ\|/breakTorque`; `ema = 0.85·ema + 0.15·raw` every tick; `creaking = ema in [0.6, 1.0)`; `broken = ema >= 1.0` → `b2DestroyJoint` (all over-threshold joints break the same step) |
| `breakForce/breakTorque` | number | initial = `bridge.breakForceFactor` (2.5) × vehicle static load |
| orphan fragments | Segment[] | after break: non-colliding with vehicle + fade after `bridge.debrisFadeDelaySec` (3.0 s) |
| fallback mode | flag | single compound rigid body (method A): no stress/creak/break; render-layer-only bending; swapped at physics layer only |

Render reconstructs one Catmull-Rom spline from segment positions (physics N and render vertices decoupled); the rendered path splits at break points with a jagged edge (fracture highlight).

### 1.4 Vehicle (runtime)

| Field | Type | Notes |
|---|---|---|
| `chassis` | body | rounded box (dimensions/mass: TBD (spike S1)); restitution 0 |
| `wheels` | body[2] | circles (radius: TBD (spike S1)); tire friction `car.tireFriction` 1.0 (0.8–1.2) |
| `wheelJoints` | b2WheelJoint[2] | suspension `car.suspensionHertz` 4 (3–6), damping 0.7 (0.5–0.9) |
| `motor` | state | rear wheel `enableMotor`; `effectiveMotorSpeed = car.motorSpeedBase × (1 + 0.05 × engineSpeedLv)`; `car.motorSpeedBase` / `car.maxMotorTorque`: TBD (spike/tuning) |
| `referencePoint` | Point (derived) | **VehicleReferencePoint = chassis AABB center** — sole point for clear (goalFlag entry) and fall (killY) judgement |

Terrain/stroke surface friction: `car.surfaceFriction` 0.75 (0.6–0.9).

### 1.5 JudgeOutcome (runtime, per attempt)

```
JudgeOutcome =
  | { outcome: 'clear'; ticks; inkConsumed; starRating: 1|2|3; coinsCollected }
  | { outcome: 'fail';  cause: 'fall' | 'tipOver' | 'timeout' | 'divergence';
      causeLocation: Point;         // fall point / overturned chassis / retained fracture highlight / divergence spot
      ticks }
```

Rules: clear on the tick referencePoint ∈ goalFlag rect; fail on ① referencePoint.y < killY, ② vehicle inverted (|tilt| > `fail.tipOverAngleRad` 2.1 rad, deterministic headless-friendly proxy for roof contact — see .fable/decisions.md) sustained `fail.tipOverTimeSec` (0.5 s), ③ ticks > maxTicks (1800). **Same-tick clear+fail resolves as clear (BR-009).** Partial collapse with the car still reaching the flag = clear. Solver divergence (NaN reference point, or speed > `physics.divergenceSpeedMax` 80 m/s) is represented **inside** the fail union as `cause: 'divergence'` (uniform engine shape), but it is a FAILSAFE, not a real loss: Render/Meta detect it with `isFailsafeReset(outcome)` and route it to the silent ≤ 1 s reset path — **no** fail UI, **no** `level_end` fail analytics, **no** attempt persistence — instead of the normal fall/tipOver/timeout fail flow.

### 1.6 StarRating (derived)

`inkConsumed <= star3` → 3 | `<= star2` → 2 | otherwise → 1. Stars never block progression; best value retained (no overwrite by lower results). Effective ink budget input: `level.inkBudget × (1 + 0.10 × inkCapacityLv)`; thresholds compare raw consumption, unscaled.

### 1.7 SaveData (persisted)

Authoritative contract: [contracts/save-data.md](./contracts/save-data.md).

| Field | Type | Validation |
|---|---|---|
| `schemaVersion` | int | current = 1; forward-only migration; unknown fields preserved |
| `coins` | int | `>= 0` invariant — violating transactions rejected up-front |
| `upgrades.inkCapacityLv` | int | 0–5 |
| `upgrades.engineSpeedLv` | int | 0–5 |
| `progress` | `Record<levelId, {bestStars: 0-3, cleared: boolean}>` | `bestStars > 0` implies `cleared`; monotonic (best only); `cleared` also gates BR-003 "collected coins credit first clear only" |
| `settings.sound` | boolean | immediate effect, persisted |
| `settings.haptics` | boolean | immediate effect, persisted |

Save triggers (BR-010): level end (clear or fail), upgrade purchase, settings change — atomic, automatic, no manual save UI.

### 1.8 TuningConstants (single source, `src/tuning/TuningConstants.ts`)

All initial values transcribed from designs/game_design.md §8. Level-specific values (inkBudget, starThresholds, maxTicks) live in level JSON. Magic numbers outside this module + level JSON are defects (NFR-010, grep-verifiable).

**Group `physics` / `bridge` / `car` / `fail` (§8.1)**

| Constant | Initial | Range |
|---|---|---|
| `physics.fixedDt` | 1/60 | fixed (determinism contract) |
| `physics.subStepCount` | 4 | 4–8 |
| `physics.segmentLength` | 0.65 m | 0.5–0.8 |
| `physics.segmentCountStart` | 12 | 8–24 |
| `physics.segmentCountMax` | 32 | fixed cap |
| `physics.divergenceSpeedMax` | 80 m/s | 50–150 |
| `physics.gravityY` | TBD (spike/tuning; Box2D default −10) | — |
| `bridge.jointHertz` | 6 | 4–8 |
| `bridge.jointDampingRatio` | 0.7 | 0.6–0.8 |
| `bridge.jointAngleLimit` | ±0.3 rad | ±0.2–0.4 |
| `bridge.breakForceFactor` | 2.5 × static load | 2–3 |
| `bridge.stressEmaKeep` / `stressEmaNew` | 0.85 / 0.15 | fixed |
| `bridge.creakBandMin` | 0.6 | 0.5–0.8 |
| `bridge.strokeMassToCarRatio` | 0.5 | 0.3–1.0 |
| `bridge.debrisFadeDelaySec` | 3.0 s | 2–5 |
| `car.suspensionHertz` | 4 | 3–6 |
| `car.suspensionDampingRatio` | 0.7 | 0.5–0.9 |
| `car.tireFriction` | 1.0 | 0.8–1.2 |
| `car.surfaceFriction` | 0.75 | 0.6–0.9 |
| `car.restitution` | 0 | fixed |
| `car.motorSpeedBase` / `car.maxMotorTorque` | TBD (spike/tuning) | — |
| `fail.tipOverTimeSec` | 0.5 s | 0.3–1.0 |
| `fail.maxTicksDefault` | 1800 (30 s) | level JSON override |

**Group `camera` (§8.2)**

| Constant | Initial | Range |
|---|---|---|
| `camera.followLerp` | 0.10 | 0.08–0.15 |
| `camera.lookAheadCarLengths` | 1.5 | 1–2 (speed-proportional) |
| `camera.launchKickPx` | 12 px | 8–16 |
| `camera.launchKickRecoverSec` | 0.3 s | fixed |
| `camera.traumaDecayPerSec` | 1.2 | 1.0–1.5 |
| `camera.shakeMaxOffsetPx` | 20 px | 16–30 |
| `camera.shakeMaxAngleDeg` | 7° | 5–10 |
| `camera.shakeFreqHz` | 20 Hz | 15–25 |
| `camera.traumaLaunch/Land/Crash/Goal` | 0.15 / 0.25 / 0.5 / 0.5 | land 0.2–0.3; Goal 0.4→0.5 (impact-first overhaul 2026-07-08, on par with Crash) |
| `camera.speedZoomOutPct` | 15% | 10–20 |
| `camera.goalZoomInPct` | 20% | 15–25 |

**Group `draw` / `ink` (juice — drawing, §8.3)**

| Constant | Initial | Range |
|---|---|---|
| `draw.minPointDistPx` | 6 px | 4–8 |
| `draw.lineWidthScreenPct` | 2.5% | 2–3 (8–12 pt @375 pt) |
| `draw.borderWidthPx` | 1.5 px | 1–2 |
| `draw.confirmPopScale` / `confirmPopMs` | 1.06 / 120 ms | fixed / 100–150 |
| `draw.loopVolumeMin→Max` | 0.3→1.0 | fixed |
| `draw.loopPitchMin→Max` | 1.0→1.2 | fixed |
| `draw.loopFadeMs` | 40 ms | 30–50 |
| `draw.pitchRandomPct` | ±5% | ±5–10 |
| `draw.penDustPerFrame` | 3 | 2–5 (speed-proportional) |
| `draw.rdpEpsilon` | TBD (tuning) | — |
| `ink.warnYellowRatio` / `warnRedRatio` | 0.5 / 0.2 | fixed |
| `ink.blinkPeriodMs` | 300 ms | fixed |
| `ink.depleteShakePx` / `depleteShakeMs` | 5 px / 150 ms | 4–6 / fixed |

**Group `launch` / `engine` / `coin` (juice — launch & run, §8.4)**

| Constant | Initial | Range |
|---|---|---|
| `launch.anticipationSec` | 0.4 s | 0.3–0.5 |
| `launch.revPitchMax` | 1.4 | fixed |
| `launch.squashTiltDeg` | 6.5° | 5–8 |
| `launch.squashScaleY/X` | 0.92 / 1.08 (0.2 s ease-in) | fixed |
| `launch.stretchScaleX/Y` | 1.15 / 0.9 (100 ms recover) | fixed |
| `launch.dustCount` | 15 | 10–20 |
| `engine.pitchMax` | 1.5 | fixed |
| `engine.gearStep` | 0.25 | fixed |
| `speedLines.thresholdRatio` | 0.6 | fixed |
| `coin.popScale` / `popMs` | 1.3 / 150 ms | fixed |
| `coin.sparkleCount` | 6 | 4–8 |
| `coin.semitoneStep` / `semitoneMax` | +1 (×1.0595) / +12 | fixed |
| `coin.comboResetSec` | 1.25 s | 1–1.5 |
| `coin.placementIntervalSec` | 0.15 s | 0.1–0.2 |
| `coin.hapticThinning` | 3 (1 per 3 coins) | 2–3 |

**Group `goal` / `audio` (juice — goal 5 beats, §8.5)**

| Constant | Initial | Range |
|---|---|---|
| `goal.hitStopMs` | 100 ms | 80–120 |
| `goal.slowTimeScale` | 0.3 | fixed |
| `goal.slowHoldSec` / `slowRecoverSec` | 0.3 / 0.2 s | 0.3–0.5 / 0.2–0.3 (impact-first overhaul 2026-07-08: envelope 750→600 ms) |
| `goal.confettiCannonCount` (each side) | 50 | 40–60 |
| `goal.confettiRainCount` | 80 | 60–100 |
| `goal.confettiGravityScale` | 0.3 | 0.2–0.4 |
| `goal.confettiSpinDegPerSec` | ±720°/s | fixed |
| `goal.starIntervalMs` / `starPopMs` | 250 / 250 ms | 200–300 / fixed |
| `goal.countUpSec` | 1.2 s | 0.8–1.5 |
| `goal.tickSoundIntervalMs` | 45 ms | 30–60 |
| `goal.coinBurstCount` | 20 | 10–30 |
| `goal.coinFlightSec` / `coinStaggerMs` | 0.5 s / 30 ms | 0.4–0.6 / 20–40 |
| `goal.nextActivateDelaySec` | 0.3 s | 0.15–1.0 (**user directive 2026-07-08**: was 2.0 s / 1.5–2.5; Next decoupled from the afterglow — envelope 600 ms + 300 ms = tappable @ ~900 ms ≤ 1 s) |
| `goal.nextPulseScalePct` / `nextPulsePeriodSec` | ±5% / 0.8 s | fixed |
| **Impact-first overhaul 2026-07-08 (research 10 §6.2)** | | |
| `goal.flashMs` / `flashPeakAlpha` | 100 ms / 0.45 | 90–120 / 0.35–0.5 (L1 cream screen flash) |
| `goal.zoomKickPct` / `zoomKickRecoverMs` | 6% / 120 ms | 4–8 / 100–160 (L2 camera zoom-kick) |
| `goal.titlePopScale` / `titlePopMs` | 1.15 / 260 ms | 1.1–1.2 / 220–300 (L7 title bounce) |
| `goal.scrimFadeInMs` | 150 ms | 120–180 (L9) |
| `goal.nextPopScale` / `nextPopMs` | 0.9 / 160 ms | 0.85–0.95 / 140–200 (L13 Next scale-in) |
| `goal.sunburstRayCount` / `sunburstMaxAlpha` | 14 / 0.4 | 12–16 / 0.2–0.5 (L8 sunburst; STATIC gold rays — rotation/alpha-swell dropped, they rendered blank on the large Graphics under software-WebGL; 0.28→0.4 per own-eyes) |
| `goal.centerBurstCount` / `centerBurstSpeedMinPx` / `centerBurstSpeedMaxPx` | 28 / 240 / 420 px/s | 20–32 (L5 center burst) |
| `goal.burstLifeMinMs` / `burstLifeMaxMs` | 300 / 600 ms | (L5/L10 particle life) |
| `goal.starPopOvershoot` / `starRadiusPx` / `starSparkleCount` | 1.4 / 30 px / 6 | 1.3–1.4 / 28–32 / 4–8 (L10; promoted from StarBurst locals 1.3 / 28) |
| `goal.starSparkleSpeedMinPx` / `starSparkleSpeedMaxPx` | 120 / 280 px/s | (L10 sparkle) |
| `goal.confettiRainFallMs` | 2000 ms | 1800–2500 (L6; promoted from Confetti local 2500) |
| `audio.bgmDuckDb` / `bgmDuckAttackSec` | −7.5 dB / 0.2 s | −6..−9 / fixed |
| `audio.maxSameSfxVoices` | 3 | fixed (NFR-014) |

**Group `haptic` (event→haptic mapping, §8.6 — one central table, FR-014)**: see [contracts/platform-interfaces.md](./contracts/platform-interfaces.md) §3 for the full table (confirm 0.6, launch 0.8, land 1.0, coin 0.4, creak stress-proportional, starSequence ascending, inkDepleted warning).

**Group `economy` (§8.7)**

| Constant | Initial | Range |
|---|---|---|
| `economy.clearReward` | 25 coins | 20–30 |
| `economy.bonusMultiplier` | 6 | 5–10 (level JSON `bonusMultiplier` overrides per bonus level) |
| `economy.upgradePriceBase` | 75 | 50–100 |
| `economy.upgradePriceGrowth` | 1.20 | 1.15–1.25 |
| `economy.inkPerLevelPct` | 10% | fixed (FR-019) |
| `economy.speedPerLevelPct` | 5% | fixed (FR-019) |
| `economy.maxUpgradeLevel` | 5 | v1.1+ expansion |
| `economy.bonusLevelInterval` | 5 levels | fixed |
| Price ladder (derived, rounded to 5) | Lv1–5: 75/90/110/130/155 (cum. 560; both axes 1,120) | game_design §7.2 |

**Group `ads` (constants only, unused in v1.0)**: placement IDs `rv_coin_multiplier`, `rv_continue_hint`, `interstitial_level_complete`; frequency caps TBD (v1.1, remote-config-ready).

## 2. Core State Machine

From game_design §2; times bind to the tempo contract (NFR-003) and are automated-test targets.

```
Idle → Drawing → Solidify → Anticipation → Running → Goal | Fail → Result → Next
```

| Transition | Trigger | Time budget | Juice hooks |
|---|---|---|---|
| Idle → Drawing | pointerdown (no stroke drawn this attempt AND ink > 0) | — | draw loop SFX starts (30–50 ms fade-in), pen dust |
| Drawing → Drawing | pointermove ≥ `draw.minPointDistPx` | same-frame ink decrement + bar update | loop volume/pitch tracks speed; depletion: whiff SFX + bar shake 5 px/150 ms + warning haptic (vertex add stops, stroke kept) |
| Drawing → Idle | pointerup with < 2 valid vertices | — | stroke discarded silently, ink refunded |
| Drawing → Solidify | pointerup (≥ 2 valid vertices; OS interrupt = release) | same frame | confirm pop 1.06/120 ms + confirm SFX (50–120 ms) + haptic `confirm` |
| Solidify → Anticipation | chain built (RDP → resample → capsule chain) | same frame | free physics sag = "line became object" cue |
| Anticipation → Running | `launch.anticipationSec` 0.4 s elapsed (fixed, non-skippable) | 0.3–0.5 s | rev pitch 1.0→1.4, squash 0.92/1.08, wheel-spin smoke; at release: 15 dust + stretch 1.15/0.9 + bass SFX + haptic `launch` + camera kick 12 px |
| Running → Goal | referencePoint ∈ goalFlag rect (clear beats same-tick fail) | — | 5-beat celebration 3–4 s (hit-stop → slow-mo → confetti → stars → count-up), BGM duck −7.5 dB; any tap skips all |
| Running → Fail | killY / tipOver 0.5 s / ticks > maxTicks | — | light dim + one short sad SFX + cause highlight persists (fracture/fall point/chassis) |
| Goal → Result | panel reveal (~600 ms) — decoupled from the afterglow | ≤ 1 s to tappable Next | **user directive 2026-07-08**: Next activates 0.3 s after the panel (≤ 1 s from clear, was 1.5–2.5 s), scale-in pop + ±5% pulse @0.8 s; Replay alongside; stars/coins/confetti/sunburst play on behind the active panel |
| Fail → Result | immediate | — | Retry immediately active; only Retry + home accept input |
| Result(clear) → Next | Next tapped | level transition ≤ 1 s | — |
| Result(fail) → Idle (same level) | Retry tapped | ≤ 1 s to playable | — |
| Next → Idle (next level) | level load | ≤ 1 s | — |
| Drawing/Anticipation/Running → Idle | persistent restart button (no confirm dialog; taps during reset ignored — exactly one reset) | ≤ 1 s | — |

Side effects on Result: clear → credit `economy.clearReward` (+ collected coins on first clear per BR-003, × `bonusMultiplier` on bonus levels), persist bestStars/cleared, unlock next level, `level_end` + `earn_virtual_currency` events. Fail/restart → collected coins discarded and placements restored; nothing persisted except the auto-save trigger on level end.

## 3. Cross-Entity Validation Rules (from FRs)

| # | Rule | Enforced by |
|---|---|---|
| V1 | `inkBudget > 0` | Gate 1, editor |
| V2 | `ghostSolutions.length >= 1` | Gate 0, editor save refusal (FR-024) |
| V3 | `killY < min(terrain vertex y)` | Gate 0 (code-level check) |
| V4 | `0 < star3 < star2 <= inkBudget` | Gate 0 (code-level check) |
| V5 | id pattern + filename match; bonus levels require `bonusMultiplier` (5–10), normal levels forbid it | Gate 0 |
| V6 | vehicleSpawn above terrain (raycast down hits terrain); goalFlag placement reachable (raycast down from rect hits terrain) | Gate 1 |
| V7 | Every ghost replays within tolerance at Lv0: outcome match, final pos ε = 0.05 m, ticks ±30; `kind:"3star"` ghosts satisfy `inkConsumed <= star3` | Gate 2 |
| V8 | Straight-line bot fails on every `anti-dominant` level | Gate 3 |
| V9 | `coins >= 0` balance invariant; purchases rejected/disabled when balance < price; exactly-once purchase under rapid taps | Meta layer + unit tests |
| V10 | `bestStars` monotonic non-decreasing; `bestStars > 0 ⇒ cleared` | Meta layer + unit tests |
| V11 | Save writes atomic + schemaVersion attached; unknown fields preserved on migration | SaveManager contract tests ([save-data.md](./contracts/save-data.md)) |
| V12 | Segment count N clamped to [2, 32] (floor of 2 guarantees ≥ 1 revolute joint so chain sag/creak/break physics exist — a 1-segment bridge has none; natural bridge strokes resample to 8+, so the floor only bites the shortest kept strokes); stroke < 2 vertices or < 1 segment length discarded with refund | StrokePipeline + BridgeChainBuilder unit tests |

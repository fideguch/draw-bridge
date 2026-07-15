/**
 * TuningConstants — single source of every tunable number (NFR-010).
 *
 * Initial values transcribed from designs/game_design.md §8 via
 * specs/001-inkbridge-mvp/data-model.md §1.8. Ranges are documented per field;
 * the debug tuning panel (FR-025, Phase 9) live-edits these at runtime.
 *
 * Level-specific values (inkBudget, starThresholds, maxTicks) live in level
 * JSON, NOT here. Magic numbers anywhere else in src/ are defects.
 */

/** Physics core (game_design §8.1) */
export const physics = {
  /** Fixed timestep — FIXED, never change (determinism contract). */
  fixedDt: 1 / 60,
  /** Box2D sub-step count. Range 4-8. */
  subStepCount: 4,
  /**
   * Capsule segment length in meters. Range 0.5-0.8.
   * spike-calibrated 2026-07-07 (S1): 0.65 -> 0.8 — fewer joints per span
   * bound the sag (angle limits are the load-bearing structure; joint springs
   * are cosmetic at chain mass scale). 6m gap uncrossable below 0.8.
   */
  segmentLength: 0.8,
  /** Segment count at start. Range 8-24. */
  segmentCountStart: 12,
  /** Hard cap on segments per stroke. Fixed. */
  segmentCountMax: 32,
  /** Solver divergence failsafe: speed ceiling in m/s. Range 50-150. */
  divergenceSpeedMax: 80,
  /** World gravity Y (y-up). Box2D default. spike-calibrated 2026-07-07 (kept). */
  gravityY: -10,
};

/** Bridge chain (game_design §8.1) */
export const bridge = {
  /** Capsule segment radius in meters. spike-calibrated 2026-07-07 (S1, kept). */
  capsuleRadius: 0.12,
  /**
   * Revolute spring joint stiffness. Range 4-10.
   * game-feel rebuild 2026-07-08: 6 -> 8 — snappier settle so a loaded bridge
   * reads as a FIRM drawn line (subtle give) rather than a slow floppy spring.
   * firmness pass 2026-07-08 (level overhaul): 8 -> 9 — real-device feedback
   * "まだ少しだけ柔らかい". The higher spring frequency settles the loaded chain
   * to its held shape faster (less lingering wobble), reinforcing the tighter
   * totalFlexBudgetRad below so the bridge reads as a firm plank with a hint of
   * life rather than a spring. Measured 9 (not 10): 9 keeps the recycled-slot
   * reset drift at ~0.009 m (sub-cm; world-reset determinism band) whereas 10
   * pushed it to ~0.034 m — 9 is the firmer-yet-stable sweet spot for this
   * chain-mass/step regime.
   */
  jointHertz: 9,
  /** Joint spring damping ratio. Range 0.6-0.8. */
  jointDampingRatio: 0.7,
  /**
   * TOTAL bend budget of a whole bridge, in radians, shared across ALL joints
   * (game-feel rebuild 2026-07-08). The per-joint angle limit is DERIVED as
   * clamp(totalFlexBudgetRad / jointCount, jointAngleLimitMinRad,
   * jointAngleLimitRad) in BridgeChainBuilder, so total flex stays ~constant no
   * matter how many segments a stroke resamples to. This is the "ふにゃふにゃ
   * fix": with the shape-fidelity floor (SEGMENT_COUNT_MIN 6) short strokes now
   * carry many joints, and a fixed per-joint limit would let total flex =
   * jointCount x limit balloon into rope-like sag. Budget ~0.5-0.7 rad makes a
   * 3m bridge under car load sag visibly-but-firmly (~0.1-0.2m), NOT rope-like.
   * TUNED 2026-07-08 to 0.3: the initial 0.5-0.7 guess measured rope-like — a
   * solidified 0.55m-bow arch flattened to <0.1m within 60 ticks (QG-6 probe).
   * 0.3 holds ~0.37m of that bow (firm) while a loaded 3m span still gives
   * ~0.1-0.2m; the shape reads as a firm drawn line with subtle give.
   * FIRMNESS PASS 2026-07-08 (level overhaul) to 0.22: real-device feedback was
   * still "まだ少しだけ柔らかい". 0.22 tightens the total give a further ~27% —
   * a loaded 3m span now sags ~0.10-0.15m (firm plank with a hint of life, not a
   * spring) and a committed 0.55m-bow arch holds ~0.40m through settling
   * (chain-deviation probe). Measured net effect on crossings is LESS sag-V, so
   * spike:bench still clears 2/4/6m at natural N without touching breakForceFactor.
   */
  totalFlexBudgetRad: 0.22,
  /**
   * Per-joint angle-limit CEILING in radians (+/-) — the clamp upper bound on
   * the derived per-joint limit (see totalFlexBudgetRad). At the segment floor
   * (few joints) this caps each joint's give; spike-calibrated 2026-07-07 (S1):
   * 0.2 arrests the sag-V early enough for the car to cross.
   */
  jointAngleLimitRad: 0.2,
  /**
   * Per-joint angle-limit FLOOR in radians (+/-) — the clamp lower bound on the
   * derived per-joint limit. Keeps a high-N chain from becoming perfectly rigid
   * (a hair of give per joint still creaks/breaks under overload).
   */
  jointAngleLimitMinRad: 0.02,
  /**
   * Break threshold = factor x vehicle static load.
   * spike-calibrated 2026-07-07 (S1): 2.5 -> 10, SUPERSEDES the paper range
   * 2-3 (game_design §8.1): measured dynamic force share on a 4m crossing is
   * ~2.6x static load (EMA share 1.04 at factor 2.5 — the Phase 2C
   * "uncrossable gap" defect), 6m worst case ~8.2x. Factor 10 puts the 6m
   * scenario at stress 0.82 (creak band, no break); factor 7.5 still breaks.
   * breakTorque derives from this x segmentLength (StressTracker).
   */
  breakForceFactor: 10,
  /** Stress EMA: keep weight. Fixed pair with stressEmaNew. */
  stressEmaKeep: 0.85,
  /** Stress EMA: new-sample weight. Fixed pair with stressEmaKeep. */
  stressEmaNew: 0.15,
  /** Creak band lower bound (stress 0-1). Range 0.5-0.8. */
  creakBandMin: 0.6,
  /** Total chain mass as a ratio of vehicle mass. Range 0.3-1.0. */
  strokeMassToCarRatio: 0.5,
  /** Orphan fragment fade delay in seconds. Range 2-5. */
  debrisFadeDelaySec: 3.0,
};

/** Vehicle (game_design §8.1; geometry §3.4 "dimensions TBD spike S1") */
export const car = {
  /** Chassis rounded-box half width in meters. spike-calibrated 2026-07-07 (kept). */
  chassisHalfWidth: 0.75,
  /** Chassis rounded-box half height in meters. spike-calibrated 2026-07-07 (kept). */
  chassisHalfHeight: 0.25,
  /** Chassis rounded-box corner radius in meters. spike-calibrated 2026-07-07 (kept). */
  chassisCornerRadius: 0.08,
  /**
   * Chassis shape density (kg/m^2). spike-calibrated 2026-07-07 (S1, kept):
   * density sweep x0.5/x1/x2 is outcome-invariant — stress is a force SHARE
   * of the mass-scaled break threshold, so car mass cancels out.
   */
  chassisDensity: 1.0,
  /**
   * Wheel circle radius in meters. spike-calibrated 2026-07-07 (S1, kept):
   * 0.38 was tried against the 6m sag-V and made tip-over WORSE.
   */
  wheelRadius: 0.3,
  /** Wheel shape density (kg/m^2). spike-calibrated 2026-07-07 (S1, kept — see chassisDensity). */
  wheelDensity: 1.0,
  /**
   * Wheel anchor X offset from chassis center (+front / -rear), meters.
   * spike-calibrated 2026-07-07 (S1): 0.45 -> 0.6 — the wider wheelbase
   * resists pitch-flip while descending into the bridge sag-V; it is what
   * turns the 6m crossing from tip-over into a clear at default bow.
   */
  wheelOffsetX: 0.6,
  /** Wheel anchor Y offset from chassis center (below), meters. spike-calibrated 2026-07-07 (kept). */
  wheelOffsetY: -0.25,
  /** Wheel joint suspension stiffness. Range 3-6. */
  suspensionHertz: 4,
  /** Wheel joint suspension damping. Range 0.5-0.9. */
  suspensionDampingRatio: 0.7,
  /** Tire friction. Range 0.8-1.2. */
  tireFriction: 1.0,
  /** Terrain/stroke surface friction. Range 0.6-0.9. */
  surfaceFriction: 0.75,
  /** Chassis restitution. Fixed. */
  restitution: 0,
  /**
   * Rear-wheel motor angular speed base in rad/s (Lv0).
   * game-feel rebuild 2026-07-08: 15 -> 24 — real-device feedback was "car too
   * slow, can't climb". 24 gives a brisk crossing and enough surface speed to
   * climb the drawn arcs and the l08-style +2m ramps without stalling. Wheel
   * surface speed = 24 x wheelRadius(0.3) = 7.2 m/s, far under
   * physics.divergenceSpeedMax (80).
   */
  motorSpeedBase: 24,
  /**
   * Max motor torque in N*m. game-feel rebuild 2026-07-08: 50 -> 110 — the old
   * 50 stalled on the raised ramps; 110 climbs them. (200 wheelies the car into
   * a self-flip before the bridge — kept well below that.)
   */
  maxMotorTorque: 110,
};

/**
 * Rock hazard defaults (RockHazard entity). Per-rock position, radius, optional
 * density and initial velocity live in the level JSON `rocks[]`; these are the
 * fallbacks + fixed surface properties shared by every rock. A rock is a plain
 * dynamic circle: it rolls/falls under normal gravity, collides with terrain,
 * the drawn BridgeChain, and the car (MASK_ALL), and induces the existing
 * tipOver/fall/timeout fail rules when it reaches the car undeflected.
 */
export const rock = {
  /** Default surface density (kg/m^2) when a rock omits `density`. Range 1-10. */
  density: 2.5,
  /** Rock surface friction (rolling grip). Range 0.4-0.9. */
  friction: 0.6,
  /** Rock restitution (bounciness). Range 0-0.3. */
  restitution: 0.1,
};

/**
 * Person NPC obstacle half-extents in world metres (round-9 BR-011). A Person is
 * a static AABB footprint the CAR must route over/around/jump — chassis or wheel
 * overlap fails the attempt with FailCause 'personContact'. `{x, y}` in the level
 * JSON `persons[]` is the AABB CENTRE, so the box spans x +/- halfWidth and y +/-
 * halfHeight: 1.3 m wide x 1.7 m tall (a person-sized silhouette). Tunable, not a
 * magic number — the Judge derives the person rects from these (level JSON carries
 * only the centre points). To stand a person on ground y0, author y = y0 + halfHeight.
 */
export const person = {
  /** Half of the person AABB width (m) — full width 1.3 m. */
  halfWidth: 0.65,
  /** Half of the person AABB height (m) — full height 1.7 m. */
  halfHeight: 0.85,
};

/**
 * Hazard VISUAL LANGUAGE render tunables (DESIGN.md §4.9). Render-ONLY — these
 * never touch physics/Judge (DangerZone `style` is inert metadata), so changing
 * any value cannot move the determinism hash. Centralised here per the
 * no-magic-numbers rule; the RockRenderer / DangerZoneRenderer read them.
 */
export const hazardRender = {
  // ── DangerZone teeth (spike / spikeDown) ──
  /** Spike teeth per world metre of zone width (density of the saw row). */
  teethPerMeter: 1.7,
  /** Tooth height as a fraction of the zone band height (apex reach into the band). */
  toothHeightFrac: 0.9,
  /** Red tip fraction of a tooth (upper portion painted hazardRed over the dark base). */
  toothTipFrac: 0.42,
  // ── DangerZone wash + hatch ──
  /** Red wash alpha at the pulse trough / peak (was a pale 0.16 — now unmistakable). */
  zoneFillAlphaMin: 0.28,
  zoneFillAlphaMax: 0.42,
  /** Diagonal hatch stripe alpha. */
  zoneStripeAlpha: 0.7,
  /** Hatch spacing / stripe width / border width in design px (ui-scaled). */
  zoneHatchSpacingPx: 15,
  zoneHatchWidthPx: 4,
  zoneBorderPx: 3,
  /** Stripe-scroll speed (design px per second) — the "live danger" barber-pole crawl. */
  zoneStripeScrollPxPerSec: 22,
  /** Wash breathing-pulse period (ms). */
  zonePulsePeriodMs: 1200,
  // ── Rock motion streaks ──
  /** Screen-space speed (px/frame) above which a moving rock grows motion streaks. */
  streakSpeedMinPx: 1.6,
  /** Streak length as a multiple of the per-frame screen displacement. */
  streakLengthMult: 4,
  /** Max streak alpha (scales up with speed). */
  streakAlphaMax: 0.6,
  // ── Armed-rock warning ──
  /** Warning-pulse angular speed (radians per update tick) — a calm ~1 Hz throb. */
  warnPulseSpeed: 0.12,
  /** Downward drop-beam length in world metres (armed rock → predicted landing lane). */
  warnBeamLengthM: 7,
  /** Target reticle outer radius as a multiple of the rock radius. */
  warnReticleRadiusMult: 1.15,
};

/** Fail judgement (game_design §8.1) */
export const fail = {
  /** Roof-contact time to declare tip-over, seconds. Range 0.3-1.0. */
  tipOverTimeSec: 0.5,
  /**
   * Chassis tilt (rad, either direction) that counts as roof-down.
   * Angle-based roofContactActive definition — see Vehicle.ts header.
   */
  tipOverAngleRad: 2.1, // TBD (tuning) — provisional (~120 deg)
  /** Default timeout in ticks (30 s @ 60 Hz). Level JSON maxTicks overrides. */
  maxTicksDefault: 1800,
};

/** Camera (game_design §8.2) */
export const camera = {
  /** Follow lerp factor. Range 0.08-0.15. */
  followLerp: 0.1,
  /** Look-ahead in car lengths (speed-proportional). Range 1-2. */
  lookAheadCarLengths: 1.5,
  /** Launch kick offset in px. Range 8-16. */
  launchKickPx: 12,
  /** Launch kick recovery in seconds. Fixed. */
  launchKickRecoverSec: 0.3,
  /** Trauma decay per second. Range 1.0-1.5. */
  traumaDecayPerSec: 1.2,
  /** Shake max offset in px (trauma^2 scaled). Range 16-30. */
  shakeMaxOffsetPx: 20,
  /** Shake max angle in degrees. Range 5-10. */
  shakeMaxAngleDeg: 7,
  /** Shake noise frequency in Hz. Range 15-25. */
  shakeFreqHz: 20,
  /** Trauma added on launch. */
  traumaLaunch: 0.15,
  /** Trauma added on landing (big jumps). Range 0.2-0.3. */
  traumaLand: 0.25,
  /** Trauma added on crash/break. */
  traumaCrash: 0.5,
  /**
   * Trauma added on goal. Impact-first celebration overhaul 2026-07-08
   * (research 10 §6.2): 0.4 -> 0.5 — the goal is a top-tier moment, on par with
   * traumaCrash (0.5). Range 0.4-0.5.
   */
  traumaGoal: 0.5,
  /** Speed zoom-out percentage. Range 10-20. */
  speedZoomOutPct: 15,
  /** Goal celebration zoom-in percentage. Range 15-25. */
  goalZoomInPct: 20,
};

/** Juice — drawing (game_design §8.3) */
export const draw = {
  /** Min distance between stroke vertices in px. Range 4-8. */
  minPointDistPx: 6,
  /** Stroke line width as % of screen width. Range 2-3 (8-12 pt @375 pt). */
  lineWidthScreenPct: 2.5,
  /** Dark border width in px. Range 1-2. */
  borderWidthPx: 1.5,
  /** Commit pop scale (1.0 -> this -> 1.0). Fixed. */
  confirmPopScale: 1.06,
  /** Commit pop duration in ms. Range 100-150. */
  confirmPopMs: 120,
  /** Draw loop SFX volume floor. Fixed range pair. */
  loopVolumeMin: 0.3,
  /** Draw loop SFX volume ceiling. Fixed range pair. */
  loopVolumeMax: 1.0,
  /** Draw loop SFX pitch floor. Fixed range pair. */
  loopPitchMin: 1.0,
  /** Draw loop SFX pitch ceiling. Fixed range pair. */
  loopPitchMax: 1.2,
  /** Draw loop SFX fade in/out in ms. Range 30-50. */
  loopFadeMs: 40,
  /** SFX pitch randomization in +/- percent. Range 5-10. */
  pitchRandomPct: 5,
  /** Pen dust particles per frame (speed-proportional). Range 2-5. */
  penDustPerFrame: 3,
  /**
   * RDP simplification epsilon in world meters. game-feel rebuild 2026-07-08:
   * 0.08 -> 0.02 — the "line reverts to straight" fix. At 0.08 a gently drawn
   * arc's interior vertices were within tolerance and got collapsed to the
   * endpoints, so the solidified bridge lost its bow. 0.02 preserves the drawn
   * shape while still killing hand-jitter noise.
   */
  rdpEpsilon: 0.02,
};

/** Ink bar UI (game_design §8.3) */
export const ink = {
  /** Bar turns yellow at this remaining ratio. Fixed. */
  warnYellowRatio: 0.5,
  /** Bar turns red at this remaining ratio. Fixed. */
  warnRedRatio: 0.2,
  /** Warning blink period in ms. Fixed. */
  blinkPeriodMs: 300,
  /** Depletion bar shake amplitude in px. Range 4-6. */
  depleteShakePx: 5,
  /** Depletion bar shake duration in ms. Fixed. */
  depleteShakeMs: 150,
};

/** Juice — launch (game_design §8.4) */
export const launch = {
  /** Anticipation duration in seconds (non-skippable). Range 0.3-0.5. */
  anticipationSec: 0.4,
  /** Rev SFX pitch peak during anticipation. Fixed. */
  revPitchMax: 1.4,
  /** Rear squash tilt in degrees. Range 5-8. */
  squashTiltDeg: 6.5,
  /** Squash scale Y during anticipation. Fixed. */
  squashScaleY: 0.92,
  /** Squash scale X during anticipation. Fixed. */
  squashScaleX: 1.08,
  /** Squash ease-in duration in seconds. Fixed. */
  squashEaseInSec: 0.2,
  /** Stretch scale X at release. Fixed. */
  stretchScaleX: 1.15,
  /** Stretch scale Y at release. Fixed. */
  stretchScaleY: 0.9,
  /** Stretch recovery duration in ms. Fixed. */
  stretchRecoverMs: 100,
  /** Dust burst particle count at release. Range 10-20. */
  dustCount: 15,
};

/** Engine hum (game_design §8.4) */
export const engine = {
  /** Hum pitch at max speed. Fixed. */
  pitchMax: 1.5,
  /** Gear step size for pitch quantization. Fixed. */
  gearStep: 0.25,
};

/** Speed lines (game_design §8.4) */
export const speedLines = {
  /** Show speed lines above this ratio of max speed. Fixed. */
  thresholdRatio: 0.6,
};

/** Coin pickup (game_design §8.4) */
export const coin = {
  /** Pickup radius around VehicleReferencePoint in meters (FR-009). */
  collectRadiusM: 0.5, // TBD (tuning) — provisional
  /** Pop scale (1.0 -> this -> 0). Fixed. */
  popScale: 1.3,
  /** Pop duration in ms. Fixed. */
  popMs: 150,
  /** Sparkle particle count. Range 4-8. */
  sparkleCount: 6,
  /** Pitch ladder step in semitones. Fixed. */
  semitoneStep: 1,
  /** Pitch ratio for one semitone. Fixed. */
  semitoneRatio: 1.0595,
  /** Pitch ladder cap in semitones. Fixed. */
  semitoneMax: 12,
  /** Combo (pitch ladder) reset after this silence, seconds. Range 1-1.5. */
  comboResetSec: 1.25,
  /** Authoring guidance: interval between arc-placed coins, seconds. Range 0.1-0.2. */
  placementIntervalSec: 0.15,
  /** Haptic thinning: 1 haptic per N coins. Range 2-3. */
  hapticThinning: 3,
};

/** Juice — goal 5-beat celebration (game_design §8.5) */
export const goal = {
  /** Hit-stop duration in ms. Range 80-120. */
  hitStopMs: 100,
  /** Slow-motion time scale. Fixed. */
  slowTimeScale: 0.3,
  /**
   * Slow-motion hold in real seconds. Range 0.3-0.5. Impact-first overhaul
   * 2026-07-08 (research 10 §6.2): 0.4 -> 0.3 (shortest of the band) so the
   * envelope tightens to 600 ms and the panel + Next arrive sooner.
   */
  slowHoldSec: 0.3,
  /**
   * Slow-motion recovery in seconds. Range 0.2-0.3. Impact-first overhaul
   * 2026-07-08: 0.25 -> 0.2 (envelope 750 -> 600 ms).
   */
  slowRecoverSec: 0.2,
  /** Confetti cannon count per side. Range 40-60. */
  confettiCannonCount: 50,
  /** Confetti rain count. Range 60-100. */
  confettiRainCount: 80,
  /** Confetti gravity scale. Range 0.2-0.4. */
  confettiGravityScale: 0.3,
  /** Confetti spin speed in +/- deg per second. Fixed. */
  confettiSpinDegPerSec: 720,
  /** Interval between sequential star pops in ms. Range 200-300. */
  starIntervalMs: 250,
  /** Star pop animation duration in ms. Fixed. */
  starPopMs: 250,
  /** Reward count-up duration in seconds. Range 0.8-1.5. */
  countUpSec: 1.2,
  /** Count-up tick sound interval in ms. Range 30-60. */
  tickSoundIntervalMs: 45,
  /** Coin burst particle count. Range 10-30. */
  coinBurstCount: 20,
  /** Coin counter flight duration in seconds. Range 0.4-0.6. */
  coinFlightSec: 0.5,
  /** Coin flight stagger in ms. Range 20-40. */
  coinStaggerMs: 30,
  /**
   * Next button activation delay in seconds, measured from panel reveal.
   * USER DIRECTIVE 2026-07-08: 2.0 -> 0.3 — "Next tappable within 1 s of clear".
   * Next is now DECOUPLED from celebration completion: envelope 600 ms + this
   * 300 ms = Next live @ ~900 ms (<= 1.0 s). The afterglow (stars / coins /
   * confetti / sunburst) keeps playing behind the already-active panel.
   * Range 0.15-1.0 (was 1.5-2.5). Contract mirrored in data-model.md +
   * tests/e2e/tempo.spec.ts (learnings.md T2: prevent contract-impl drift).
   */
  nextActivateDelaySec: 0.3,
  /** Next button pulse scale in +/- percent. Fixed. */
  nextPulseScalePct: 5,
  /** Next button pulse period in seconds. Fixed. */
  nextPulsePeriodSec: 0.8,

  // ── impact-first celebration overhaul (research 10 §6.2, 2026-07-08) ────────
  /** L1 screen-flash duration in ms. Range 90-120. */
  flashMs: 100,
  /** L1 screen-flash peak alpha (cream, not pure white — 純白は硬い). Range 0.35-0.5. */
  flashPeakAlpha: 0.45,
  /** L2 camera zoom-kick magnitude at impact, percent. Range 4-8. */
  zoomKickPct: 6,
  /** L2 camera zoom-kick recovery time-constant in ms. Range 100-160. */
  zoomKickRecoverMs: 120,
  /** L7 title "クリア！" bounce overshoot scale. Range 1.1-1.2. */
  titlePopScale: 1.15,
  /** L7 title bounce duration in ms. Range 220-300. */
  titlePopMs: 260,
  /** L9 result scrim fade-in duration in ms. Range 120-180. */
  scrimFadeInMs: 150,
  /** L13 Next button scale-in start scale. Range 0.85-0.95. */
  nextPopScale: 0.9,
  /** L13 Next button scale-in duration in ms. Range 140-200. */
  nextPopMs: 160,
  /** L8 sunburst ray count radiating behind the panel. Range 12-16. */
  sunburstRayCount: 14,
  /**
   * L8 sunburst alpha (static gold rays). Range 0.2-0.5. Own-eyes 2026-07-08:
   * the rays are drawn STATIC — a large Graphics that is tweened (rotation or an
   * alpha swell) rendered blank under the software-WebGL path, so rotation/swell
   * were dropped and this is set directly. 0.28 read as invisible; 0.4 gives a
   * legible gold radiance behind the title.
   */
  sunburstMaxAlpha: 0.4,
  /** L5 center-burst piece count from the flag at impact. Range 20-32. */
  centerBurstCount: 28,
  /** L5 center-burst min speed in px/s. */
  centerBurstSpeedMinPx: 240,
  /** L5 center-burst max speed in px/s. */
  centerBurstSpeedMaxPx: 420,
  /** L5/L10 burst + sparkle particle min life in ms. */
  burstLifeMinMs: 300,
  /** L5/L10 burst + sparkle particle max life in ms. */
  burstLifeMaxMs: 600,
  /** L10 star pop overshoot scale (promoted from StarBurst local 1.3). Range 1.3-1.4. */
  starPopOvershoot: 1.4,
  /** L10 star radius in px (promoted from StarBurst local 28). Range 28-32. */
  starRadiusPx: 30,
  /** L10 star sparkle particle count per pop (new). Range 4-8. */
  starSparkleCount: 6,
  /** L10 star sparkle min speed in px/s. */
  starSparkleSpeedMinPx: 120,
  /** L10 star sparkle max speed in px/s. */
  starSparkleSpeedMaxPx: 280,
  /** L6 confetti rain fall duration in ms (promoted from Confetti local 2500). Range 1800-2500. */
  confettiRainFallMs: 2000,
};

/** Audio mixing (game_design §8.5) */
export const audio = {
  /** BGM duck amount in dB during celebration. Range -6..-9. */
  bgmDuckDb: -7.5,
  /** BGM duck attack in seconds. Fixed. */
  bgmDuckAttackSec: 0.2,
  /** Max simultaneous voices per SFX type (NFR-014). Fixed. */
  maxSameSfxVoices: 3,
};

/**
 * Haptics strengths (game_design §8.6, FR-014).
 * Full event -> iOS/Android mapping table (styles, primitives, fallback rules):
 * specs/001-inkbridge-mvp/contracts/platform-interfaces.md §3.
 * creak is stress-proportional (intensity argument at the call site);
 * starSequence ascends light -> medium -> heavy; inkDepleted uses the
 * platform warning pattern. Coin thinning lives in coin.hapticThinning.
 */
export const haptic = {
  /** Line commit strength. */
  confirmStrength: 0.6,
  /** Launch strength. */
  launchStrength: 0.8,
  /** Landing strength (big jumps only). */
  landStrength: 1.0,
  /** Coin pickup strength (thinned). */
  coinStrength: 0.4,
};

/** Economy (game_design §8.7) */
export const economy = {
  /** Coins per clear. Range 20-30. */
  clearReward: 25,
  /** Bonus level reward multiplier default. Range 5-10; level JSON overrides. */
  bonusMultiplier: 6,
  /** First upgrade price. Range 50-100. */
  upgradePriceBase: 75,
  /** Price growth per level. Range 1.15-1.25. */
  upgradePriceGrowth: 1.2,
  /** Ink capacity gain per upgrade level in percent. Fixed (FR-019). */
  inkPerLevelPct: 10,
  /** Engine speed gain per upgrade level in percent. Fixed (FR-019). */
  speedPerLevelPct: 5,
  /** Upgrade level cap (v1.1+ may expand). */
  maxUpgradeLevel: 5,
  /** Bonus level cadence (every N levels). Fixed. */
  bonusLevelInterval: 5,
};

/**
 * Ads (constants only — unused in v1.0, BR-008 zero network calls).
 * Placement IDs are FROZEN and live with AdInterface in src/platform/interfaces.ts
 * (Phase 8, contracts/platform-interfaces.md §1). Frequency caps are
 * remote-config-ready; 0 = disabled until v1.1 tuning.
 */
export const ads = {
  /** Rewarded "collect x2" shows per day. */
  rvCoinMultiplierPerDay: 0, // TBD (v1.1, remote-config-ready)
  /** Rewarded hint/continue shows per day. */
  rvContinueHintPerDay: 0, // TBD (v1.1, remote-config-ready)
  /** Min cleared levels between interstitials. */
  interstitialMinLevelsBetween: 0, // TBD (v1.1, remote-config-ready)
};

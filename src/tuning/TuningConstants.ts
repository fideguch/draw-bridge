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
  /** Revolute spring joint stiffness. Range 4-8. */
  jointHertz: 6,
  /** Joint spring damping ratio. Range 0.6-0.8. */
  jointDampingRatio: 0.7,
  /**
   * Joint angle limit in radians (+/-). Range 0.2-0.4.
   * spike-calibrated 2026-07-07 (S1): 0.3 -> 0.2 — the angle limits ARE the
   * bridge structure; 0.2 arrests the sag-V early enough for the car to
   * cross. At 0.3 a 6m-gap chain collapses through its own bend budget.
   */
  jointAngleLimitRad: 0.2,
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
   * spike-calibrated 2026-07-07 (S1, kept): 12 cannot climb out of a 6m
   * sag-V (timeout); 15 clears every calibrated scenario.
   */
  motorSpeedBase: 15,
  /**
   * Max motor torque in N*m. spike-calibrated 2026-07-07 (S1, kept):
   * 200 wheelies the car into a self-flip before the bridge; 50 clears.
   */
  maxMotorTorque: 50,
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
  /** Trauma added on goal. */
  traumaGoal: 0.4,
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
  /** RDP simplification epsilon in world meters. */
  rdpEpsilon: 0.08, // TBD (tuning) — provisional until stroke pipeline tuning
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
  /** Slow-motion hold in real seconds. Range 0.3-0.5. */
  slowHoldSec: 0.4,
  /** Slow-motion recovery in seconds. Range 0.2-0.3. */
  slowRecoverSec: 0.25,
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
  /** Next button activation delay in seconds. Range 1.5-2.5. */
  nextActivateDelaySec: 2.0,
  /** Next button pulse scale in +/- percent. Fixed. */
  nextPulseScalePct: 5,
  /** Next button pulse period in seconds. Fixed. */
  nextPulsePeriodSec: 0.8,
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

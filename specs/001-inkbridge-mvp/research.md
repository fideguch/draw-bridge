# Phase 0 Research: InkBridge MVP

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)
All items below consolidate the project deep research (`research/00_local_examples.md` .. `research/07_decision.md`). No NEEDS CLARIFICATION markers remain in the Technical Context.

## R1. Game engine & language

- **Decision**: Phaser 4.2.x + TypeScript strict, built with Vite.
- **Rationale**: Browser-first dev loop (HMR) is the highest-leverage factor for physics/juice tuning, which dominates this project's effort; TS is the developer's primary stack; the web build doubles as a distribution asset (Poki/CrazyGames, GTM phase). Commercial precedent: Vampire Survivors mobile (Capacitor).
- **Alternatives considered**: Unity (no TS; WebGL iteration too slow), Godot 4 (no TS; no 2D wheel joint; 40MB web export), Cocos Creator (runner-up 8.1/10 — retained as migration fallback since game logic stays TS), Flutter+Flame, Defold, RN+Skia (weaker physics/juice ecosystems for this genre). See `research/05_tech_stack.md`.

## R2. Physics engine & bridge representation

- **Decision**: phaser-box2d 1.1.x (Box2D v3 port, MIT; verified on npm). Stroke → RDP simplify → equal-interval resample (segment 0.5–0.8 m) → capsule segments (N=8–24, hard cap 32) linked by revolute joints with springs (hertz 4–8, damping 0.6–0.8, angle limit ±0.2–0.4 rad, `collideConnected=false`, same-stroke self-collision off via negative groupIndex). Per-joint stress = |F|/breakForce + |τ|/breakTorque, EMA-smoothed (0.85/0.15); 0.6–1.0 drives creak feedback; >1.0 destroys the joint (partial collapse). Fallback method A: single compound rigid body behind the same input/render layers.
- **Rationale**: Box2D v3 officially demonstrates this exact construction (Driving sample: 20-capsule revolute bridge; Bridge sample: hertz 2.0/damping 0.7; BreakableJoint sample) and phaser-box2d exports the required APIs (`b2Joint_GetConstraintForce/Torque`, `b2DestroyJoint`) — source-verified. A load-deformable, breakable bridge is the core differentiator; every surveyed competitor uses a rigid single body.
- **Alternatives considered**: Matter.js (soft constraints unstable at vehicle loads), Planck.js (Box2D v2 API, no v3 spring/joint-force APIs), Rapier2D WASM (kept as exit path via thin physics wrapper; `rapier2d-deterministic` if bit determinism ever becomes mandatory). See `research/06_gap_1.md`.
- **Known risk + mitigation**: phaser-box2d last push 2025-04 with an unmerged capsule-collision PR (#24) → Spike S2 verifies contact quality first; MIT license permits forking; wheel/segment shapes can fall back to rounded boxes.

## R3. Vehicle model

- **Decision**: chassis (rounded box) + 2 wheel circles + `b2WheelJoint` ×2; suspension hertz ≈ 4 Hz, damping 0.7; rear-wheel `enableMotor` drive; tire friction 0.8–1.2, terrain/stroke 0.6–0.9, restitution 0. Launch = fixed 0.3–0.5 s anticipation (rev pitch 1.0→1.4, squash, wheel-spin dust) → motor engage.
- **Rationale**: Box2D-canonical car construction (Driving sample); Hill Climb Racing lineage proves the feel. Anticipation→release is the researched dopamine pattern for the launch scene.

## R4. Time & determinism

- **Decision**: fixed timestep 1/60 + accumulator + render interpolation; 120 Hz devices render high-RR while physics stays 60 Hz. Determinism contract (relaxed): (a) CI on pinned Node: state-hash equality across runs; (b) devices/engine upgrades: tolerance band — success/fail match, final vehicle position ε = 0.05 m, ticks ±30; (c) replays/ghosts are position-sample playback, never input replay.
- **Rationale**: JS port uses `Math.sin/cos/atan2` → cross-browser bit equality is impossible; Box2D upstream CI itself uses hash comparison. The prior projects' "full determinism" contract is intentionally relaxed (research/00 → 07 §7.2).

## R5. Native shell & plugins

- **Decision**: Capacitor 8 (not 7 — plugin ecosystem moved to v8). v1.0 plugins: @capacitor/haptics, @capacitor/preferences only. Ad/IAP/analytics stack pre-selected for v1.1+ but NOT installed: @capacitor-community/admob v8, @revenuecat/purchases-capacitor v13, @capacitor-firebase/* (analytics/remote-config), @sentry/capacitor v3.
- **Rationale**: "Zero external network calls" ships v1.0 clean (Data-Not-Collected posture) while `AdInterface`/`AnalyticsInterface` abstractions + placement constants keep the v1.1 ad retrofit cheap — the researched failure mode of the two prior local projects was monetization/analytics deferred with no seams. See `research/06_gap_3.md`.

## R6. Haptics

- **Decision**: single event→haptic mapping table (commit=light/TICK 0.6, launch=medium/THUD 0.8, landing=heavy/THUD 1.0, break=weak burst, stars=light→medium→heavy, ink-empty=warning). Android: `areAllPrimitivesSupported()` check with amplitude fallback (one unsupported primitive silences a whole composition). iOS: prepared impact generators via Capacitor Haptics. User toggle in settings.
- **Rationale**: research/03 platform-API findings; consistency requirement NFR-008/P4.

## R7. Audio

- **Decision**: Phaser Sound (Web Audio). Pre-decoded SFX; first-touch AudioContext resume; coin pickup pitch ladder (+1 semitone per rapid pickup, cap +12, reset after 1–1.5 s gap); per-stroke ±5% base-pitch randomization; BGM ducking −6..−9 dB at goal; ≤3 simultaneous instances per SFX type.
- **Rationale**: research/03 sound-design findings (reward-pitch escalation is a proven dopamine lever).

## R8. Level pipeline & quality gates

- **Decision**: levels are pure JSON (ghost solution ≥ 1 mandatory, killY, schemaVersion; IDs ch1-l01..l15, ch1-b1..b3). In-game editor (dev builds) is the only authoring tool; "save requires a recorded clear". CI gates on pinned Node: Gate 0 schema → Gate 1 static validity → Gate 2 ghost replay within tolerance band at Lv0 upgrades → Gate 3 straight-line bot MUST FAIL on anti-dominant tagged levels.
- **Rationale**: makes the genre's top gameplay complaint ("one straight line clears everything") a machine-checked design contract; ghost replay converts "every level is clearable" into CI. Pattern proven by prior local projects' test-contract methodology (research/00). See `research/06_gap_2.md`.

## R9. Testing stack

- **Decision**: Vitest for engine units (≥80% coverage); gate scripts as headless Node CLIs (shared LevelSchema/Engine code); Playwright for real-tap E2E (draw L1 stroke via pointer events → clear ≤ 25 s; retry ≤ 1 s; tempo contract assertions); GitHub Actions with pinned Node 20.
- **Rationale**: Engine is Phaser-free by constitution, so headless testing is native; Playwright covers the input→visual contract that units cannot.

## R10. Week-1 spikes (implementation gate — from research/07_decision.md §7.3)

| Spike | Protocol | Pass criteria | Fail path |
|---|---|---|---|
| S1 stroke physics | Same scene (8 m gap + fixed stroke + car), methods A/B/C/D × N=8/16/24/32, measured on mid-tier Android WebView via Capacitor shell | p95 step ≤ 4 ms @ 60fps AND method C (or D) shows visible load sag + credible break | Ship fallback A + render-layer sag; keep C behind flag |
| S2 capsule×wheel contact | Drive car across capsule chain; watch for manifold popping (unmerged PR #24) | No visible contact popping at 60fps | Fork + apply PR, or rounded-box segments |
| S3 determinism | Same level+stroke × 1000 headless runs, hash states | 100% hash equality on pinned Node | Investigate FP nondeterminism source; if unresolvable, Gate 2 uses tolerance band only (already designed) |

### R10 Results (2026-07-07, T035-T037 — headless Mac, Node v20.19.4; device WebView measurement pending, see below)

**Decision: method C ("chain") is the default.** Headless p95 ≤ 0.6 ms per step at every N ≤ 32 (criterion ≤ 4 ms) with visible load sag (0.4–2.2 m) and credible partial breaks. Method A ("compound") stays behind the existing `PhysicsMethod` flag as the perf fallback (4–10× cheaper, zero sag/break by design).

**S1 headless bench** — `npm run spike:bench` (scenario: two platforms + gap, fixed arc stroke bow 0.35 m / overlap 3 m, full attempt via GameSimulation at Lv0; forced N via effective segment length; p50/p95/max over every step of the attempt):

| method | N | gap | outcome | p50 ms | p95 ms | max ms | sag m |
|---|---|---|---|---|---|---|---|
| chain | 8 | 2/4/6 m | clear/clear/clear | 0.07–0.11 | 0.27–0.51 | 2.8 | 0.41/0.64/0.90 |
| chain | 16 | 2/4/6 m | clear/clear/tipOver | 0.09–0.11 | 0.23–0.54 | 4.7 | 0.56/1.22/2.59 |
| chain | 24 | 2/4/6 m | clear/fall/fall | 0.12–0.15 | 0.44–0.57 | 1.9 | chain slides into gap at N ≥ 24 |
| chain | 32 | 2/4/6 m | clear/fall/fall | 0.15–0.18 | 0.43–0.56 | 1.6 | idem |
| compound | 8–32 | all | clear (rigid) | 0.02–0.03 | 0.04–0.25 | 2.8 | 0.03 (no sag by design) |

**Calibrated tuning (breakForce calibration + chain stability — fixes the Phase 2C "4 m gap physically uncrossable" defect).** Sweep: breakForce ×1/×2/×3/×5 × car-density ×0.5/×1/×2 (`npm run spike:bench -- --calibrate`) plus structural-constant experiments. Applied to TuningConstants (`spike-calibrated 2026-07-07`):

| Constant | Old (provisional) | New (calibrated) | Why |
|---|---|---|---|
| `bridge.breakForceFactor` | 2.5 (paper range 2–3) | **10** (supersedes range) | Measured dynamic force share on a 4 m crossing ≈ 2.6× static load (EMA 1.04 at factor 2.5); 6 m worst case ≈ 8.2×. At 10 the 6 m scenario peaks at stress 0.82 — creak band without break; 7.5 still breaks. |
| `bridge.jointAngleLimitRad` | 0.3 | **0.2** (range floor) | The angle limits ARE the load-bearing structure (joint springs are ~10× too weak vs gravity torque at chain mass scale). 0.2 arrests the sag-V early enough to cross. |
| `physics.segmentLength` | 0.65 | **0.8** (range ceiling) | Sag budget ≈ joint count × angle limit: fewer joints per span bound the sag. 6 m gap is uncrossable below 0.8. |
| `car.wheelOffsetX` | 0.45 | **0.6** | Wider wheelbase resists the pitch-flip while descending into the sag-V — turns the 6 m crossing from tipOver into clear. |
| `car.chassisDensity` / `car.wheelDensity` | 1.0 (TBD) | **1.0 (kept)** | Density sweep ×0.5/×1/×2 is outcome-invariant: stress is a force share of the mass-scaled threshold, so car mass cancels. |
| `bridge.capsuleRadius`, `car.motorSpeedBase` (15), `car.maxMotorTorque` (50), `physics.gravityY` | TBD | **kept** | Validated by the sweep (motor 12 → timeout in the sag-V; torque 200 → self-wheelie flip; wheelRadius 0.38 → worse tip-over). |

Success evidence at the calibrated values (natural N): **4 m gap N=13 clear (maxStress 0.25), 6 m gap N=15 clear (maxStress 0.82)** — the requested chain N=12–16 region; 2 m clears at every N. Re-recorded `tests/fixtures/levels/example-valid.json` ghost (ticks 312 → 300) and widened its chasm walls to diverge (the wider wheelbase otherwise wedges above killY, breaking the fall-cause tests).

**Physics findings for level/ghost authoring** (the chain is unanchored — it only rests on the rims):

- Sagging pulls the stroke tails inward; below ~3 m of platform overlap a 6 m span slides off the rims entirely (2 m overlap → fall). Author wide-gap ghosts with generous overlaps.
- Joint count is the structural budget: N ≥ 24 across a 4–6 m span behaves like a rope and slides into the gap regardless of break thresholds. The N=32 cap only suits strokes that mostly rest on terrain.
- Unsupported spans ≥ ~6 m sit at the edge of viability (N=15 clears, N=16 tips over) — consistent with game_design §6 introducing mid supports (中間支点) from L4 for wide gaps.

**S2 capsule×wheel contact (visual check — SpikeScene).** Browser: `npm run dev` → `http://localhost:5173/?spike=1`. Keys 1–9 select gap/N scenarios, M toggles chain/compound, R restarts; HUD shows fps + step p50/p95/max; segments tint white→yellow→red with live joint stress. Watch for: load sag credibility, break separation without explosion, and wheel-over-capsule contact popping (upstream PR #24). Device procedure: quickstart.md §8. Headless proxy signal: no divergence failsafes or contact explosions in any of the 24 matrix runs.

**S3 determinism: PASS — 1000/1000 runs bit-identical** on Node v20.19.4 (`npm run spike:determinism`, 41.2 s): state hash `1e090a5c`, outcome clear @ tick 194, identical across 40 separate child processes (25 runs each — phaser-box2d leaks world slots, max 32 per process), which also proves independence from process-lifetime state. CI gate: `tests/unit/determinism.spec.ts` (25 in-process runs, exact-float-bits hash + tick + final-position equality).

**Remaining manual gate (gatekeeper):** S1/S2 on-device numbers (mid-tier Android WebView, p95 ≤ 4 ms @ 60 fps) via the Capacitor live-reload procedure in quickstart.md §8. Headless margin is ~8× under the budget, so the device check gates Phase 6 juice tuning, not Phases 4–5 (tasks.md dependency note).

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

Spike results are recorded back into this file and gate the physics implementation tasks.

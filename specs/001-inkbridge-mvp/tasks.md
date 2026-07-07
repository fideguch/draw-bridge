# Tasks: InkBridge MVP

**Input**: Design documents from `/specs/001-inkbridge-mvp/` (plan.md, research.md, data-model.md, contracts/, quickstart.md)
**Organization**: Layer + feature dependency order (per PM instruction — all 24 user stories are P1/Must, so per-story phasing adds no value). Traceability via FR references in each task. Engine layer is strict TDD (test task precedes implementation task).

**Tests**: TDD explicitly requested for Engine layer. Render/juice verified via ux_protocol.md device protocol (gatekeeper) + E2E.

## Phase 1: Setup & Toolchain

- [ ] T001 Scaffold Vite + TypeScript(strict) + Phaser 4.2 project: package.json (Node 20 engines), vite.config.ts (portrait canvas, dev/build modes), tsconfig.json, index.html, src/main.ts boot
- [ ] T002 Install and pin dependencies: phaser@4.2.x, phaser-box2d@1.1.x, vitest, @playwright/test, capacitor deps; verify phaser-box2d exports b2Joint_GetConstraintForce/Torque, b2DestroyJoint (research R2) in a smoke import test tests/unit/deps.spec.ts
- [ ] T003 [P] ESLint flat config: @typescript-eslint/naming-convention + eslint-plugin-boundaries per .specify/memory/conventions.md §1-2 (engine imports nothing from render/meta/platform; platform impls → interfaces only) + husky pre-commit lint-staged
- [ ] T004 [P] Create directory skeleton per plan.md structure + src/tuning/TuningConstants.ts with all ~90 grouped constants and initial values from data-model.md (physics/camera/juice/economy/audio)
- [ ] T005 [P] Rewrite .github/workflows/ci.yml: pinned Node 20, jobs = lint → unit (vitest) → gates (levels) → build; runs on PR and main push
- [ ] T006 Capacitor 8 init: ios/ + android/ platforms, @capacitor/haptics + @capacitor/preferences, portrait lock, safe-area viewport, WebView perf flags (FR-023)

**Checkpoint**: `npm run dev` shows empty Phaser canvas at 60fps; CI green on lint+unit.

## Phase 2: Engine Foundation — Phaser-free, TDD (FR-003, FR-005, FR-006, FR-007, FR-008, FR-015, FR-026 substrate)

- [x] T010 [P] Write failing tests for level schema validation in tests/unit/level-schema.spec.ts (valid minimal level from contracts/level-schema.md; missing ghostSolutions/killY/schemaVersion rejected; bonusMultiplier only on ch1-b*)
- [x] T011 [P] Implement src/engine/level/LevelSchema.ts + LevelLoader.ts to pass T010 (shared by game + Gate 0)
- [x] T012 [P] Write failing tests for stroke pipeline in tests/unit/stroke-pipeline.spec.ts (raw points → RDP → equal resample 0.5-0.8m; N cap 32; min-length discard + ink refund per FR-003)
- [x] T013 [P] Implement src/engine/physics/StrokePipeline.ts to pass T012
- [x] T014 Write failing tests for physics world lifecycle in tests/unit/world.spec.ts (fixed 1/60 step + accumulator; state hash stable across identical runs — S3 precursor; headless Node, no Phaser import)
- [x] T015 Implement src/engine/physics/World.ts (create/step/destroy/stateHash) to pass T014
- [x] T016 [P] Write failing tests for terrain in tests/unit/terrain.spec.ts (polylines → static chain shapes; killY plane)
- [x] T017 [P] Implement src/engine/physics/Terrain.ts to pass T016
- [x] T018 Write failing tests for bridge chain builder in tests/unit/bridge-chain.spec.ts (method C: capsule segments + revolute spring joints hertz 4-8/damping 0.6-0.8/limit ±0.2-0.4rad, collideConnected=false, same-stroke filter groupIndex; method A: single compound; both from same StrokePipeline output)
- [x] T019 Implement src/engine/physics/BridgeChainBuilder.ts (methods C + A behind PhysicsMethod flag) to pass T018 (FR-003)
- [x] T020 Write failing tests for stress/break in tests/unit/stress.spec.ts (per-joint raw=|F|/breakForce+|τ|/breakTorque, EMA 0.85/0.15; creak band 0.6-1.0 events; >1.0 → joint destroy + orphan fade timer 3.0s)
- [x] T021 Implement src/engine/physics/StressTracker.ts to pass T020 (FR-006)
- [x] T022 Write failing tests for vehicle in tests/unit/vehicle.spec.ts (chassis + 2 wheel joints hertz≈4/damping 0.7; anticipation 0.3-0.5s then motor engage; upgrade multipliers are REAL physics multipliers per BR-005)
- [x] T023 Implement src/engine/physics/Vehicle.ts to pass T022 (FR-005, FR-019 effect wiring)
- [x] T024 Write failing tests for judge in tests/unit/judge.spec.ts (flag AABB reach via VehicleReferencePoint=chassis AABB center; killY fall; tip-over roof-contact 0.5s; timeout 1800 ticks; same-tick clear-beats-fail per BR-009; divergence failsafe at physics.divergenceSpeedMax)
- [x] T025 Implement src/engine/rules/Judge.ts to pass T024 (FR-007, FR-008)
- [x] T026 [P] Write failing tests for ink + stars in tests/unit/ink-stars.spec.ts (length accounting, budget colors thresholds 50%/20%, star2/star3 thresholds from level JSON, star1 on any clear)
- [x] T027 [P] Implement src/engine/rules/InkBudget.ts + StarRating.ts to pass T026 (FR-002, FR-007)
- [x] T028 [P] Write failing tests for ghost replay in tests/unit/ghost.spec.ts (position-sample record every N ticks; playback verification tolerance band: success match, final pos ε=0.05m, ticks ±30)
- [x] T029 [P] Implement src/engine/replay/GhostRecorder.ts + GhostPlayer.ts to pass T028 (FR-015, FR-026 Gate 2 substrate)
- [x] T030 Implement src/engine/EngineEvents.ts typed event bus (stroke committed / launch / creak / break / coin / clear / fail) + tests in tests/unit/events.spec.ts — one-way Engine→observers (constitution IV) + src/engine/GameSimulation.ts attempt-lifecycle facade (tests/unit/simulation.spec.ts) consumed by GhostPlayer/gates/PlayScene

**Checkpoint**: headless engine plays a scripted stroke on a fixture level and judges clear/fail deterministically; unit coverage ≥80% on src/engine/.

## Phase 3: Spike Verification S1-S3 (research.md R10 — gates physics method choice)

- [x] T035 Build spike bench: scripts/spike/bench.ts (`npm run spike:bench`, vite-node; headless p95 step timing + `--calibrate` breakForce sweep, methods A/C × N=8/16/24/32 × gap 2/4/6m) + src/debug/SpikeScene.ts (`?spike=1` dev route: sag/break credibility, contact popping check) + calibrated TuningConstants (breakForceFactor 10, jointAngleLimitRad 0.2, segmentLength 0.8, wheelOffsetX 0.6 — research.md §R10)
- [x] T036 S3 determinism: tests/unit/determinism.spec.ts (25 in-process runs — phaser-box2d caps 32 worlds/process) + scripts/spike/determinism.ts (`npm run spike:determinism`) → 1000/1000 stateHash-identical on Node v20.19.4 across 40 child processes
- [x] T037 S1+S2 measurement: headless Mac results + method decision (**C "chain" default**, p95 ≤ 0.6ms ≤ 4ms budget; A stays behind flag) recorded in research.md §R10; Capacitor mid-tier Android measurement documented as manual gatekeeper step in quickstart.md §8 — **BLOCKS Phase 6 juice tuning tasks, not Phase 4-5**

## Phase 4: Level Gate Pipeline (FR-026)

- [ ] T040 Implement scripts/gates/gate0-schema.mjs + gate1-static.mjs per contracts/gate-pipeline.md (NDJSON output, exit codes 0/1/2)
- [ ] T041 Implement scripts/gates/gate2-ghost.mjs (headless ghost replay at Lv0 upgrades, tolerance band, double-run hash check) + gate3-antidominant.mjs (straight-line bot: rim-to-rim strokes at heights {0,+0.5,+1.0}m must ALL fail on anti-dominant tagged levels)
- [ ] T042 Wire `npm run gates` + CI job; add 2 fixture levels (one passing, one anti-dominant) in tests/fixtures/levels/

## Phase 5: Render & Draw (FR-001, FR-002, FR-004 UI, FR-015 flow)

- [ ] T045 Phaser boot + scene routing in src/render/scenes/BootScene.ts + PlayScene.ts skeleton: loads level JSON, builds Engine world, fixed-step accumulator drive + render interpolation
- [ ] T046 Stroke input + live rendering in src/render/draw/StrokeInput.ts + StrokeRenderer.ts: raw tip same-frame, past-points smoothing only, min vertex distance 4-8px, width 2-3% screen, round caps + dark border (FR-001); ink bar UI with 50%/20% color states + empty feedback (FR-002)
- [ ] T047 Bridge/vehicle/terrain rendering in src/render/BridgeRenderer.ts (Catmull-Rom spline over segment positions, break-point path split + jagged ends), VehicleRenderer.ts (wheel rotation synced to real velocity, suspension bounce), TerrainRenderer.ts
- [ ] T048 CameraDirector in src/render/juice/CameraDirector.ts: lerp follow 0.08-0.15, look-ahead 1-2 car lengths speed-proportional, launch kick 8-16px, trauma² shake (Perlin, maxOffset 16-30px, maxAngle 5-10°, freq 15-25Hz)
- [ ] T049 Restart flow: HUD restart button both phases, ≤1s reset without full scene reload (FR-004, NFR-003); fail overlay with cause highlight hook (FR-008)

**Checkpoint**: playable in browser — draw, launch, cross or fail, restart. No juice yet.

## Phase 6: Juice — the three dopamine scenes (FR-010, FR-011, FR-012, FR-013, FR-014; game_design §4 checklists are the spec)

- [ ] T055 [P] Audio foundation in src/render/audio/: SfxPlayer (pre-decode, first-touch resume, ±5% pitch random, ≤3 instances/type), coin pitch ladder (+1 semitone, cap +12, reset 1-1.5s), BGM ducking -6..-9dB (NFR-014)
- [ ] T056 [P] HapticsInterface mapping in src/platform/: commit=light/TICK(0.6), launch=medium/THUD(0.8), landing=heavy, break=weak burst, stars=light→medium→heavy, ink-empty=warning; Android areAllPrimitivesSupported() + amplitude fallback; settings toggle (FR-014)
- [ ] T057 Draw-scene juice: draw loop sound (speed→volume 0.3-1.0/pitch 1.0-1.2, stops with finger, 30-50ms fades), pen dust particles, commit pop scale 1.0→1.06→1.0/120ms + commit sound + haptic (FR-010)
- [ ] T058 Launch juice: anticipation (rev pitch 1.0→1.4, rear squash 5-8°, wheel-spin smoke) → release (10-20 dust burst, front stretch 1.15/0.9→100ms, bass burst SFX, haptic); engine hum speed→pitch 1.0-1.5 with 0.25 gear steps (FR-011)
- [ ] T059 Creak/stress feedback: joint stress 0.6-1.0 → segment tint white→yellow→red + creak SFX volume/pitch + dust particles + weak haptic pulses; break: crack SFX + debris + trauma+=0.5 + broken-joint highlight (FR-006 render side, FR-008 cause highlight)
- [ ] T060 Goal 5-beat celebration in src/render/juice/GoalSequence.ts: hit-stop 80-120ms → timeScale 0.3 (0.3-0.5s real, physics fixedDelta linked, camera zoom 15-25%) → confetti 2-stage (2 cannons 40-60 each + 0.3s-delayed rain 60-100, rotation ±720°/s, gravity 0.2-0.4x, pop sounds ×2 50ms apart) → stars sequential 200-300ms (scale 0→1.3→1.0, C-E-G arpeggio, cymbal on 3rd, haptic ramp) → reward count-up 0.8-1.5s (tick pitch 1.0→1.3) + coin burst 10-30 → counter flight; ALL tap-skippable; Next active 1.5-2.5s with ±5% pulse (FR-012)
- [ ] T061 [P] Fail experience: physics spectacle untouched, light dim + short sad SFX, Retry instant, cause highlight (broken joint / fall point / tip pose) (FR-013, FR-008)
- [ ] T062 Coin pickup: arc placements collectible during run, pop scale 1.0→1.3→0/150ms + 4-8 sparkles + pitch-ladder sound; level coins credit only on clear per BR-003 (FR-009)

**Checkpoint (gatekeeper target)**: the three scenes feel commercial-grade on device; tuning via debug panel.

## Phase 7: Meta, Persistence & Screens (FR-016, FR-017, FR-018, FR-019, FR-020, FR-021)

- [ ] T065 [P] Write failing tests for save system in tests/unit/save.spec.ts (atomic tmp-swap, schemaVersion forward migration, corruption partial-restore priority upgrades+coins>progress>settings per contracts/save-data.md)
- [ ] T066 [P] Implement src/meta/SaveManager.ts to pass T065; save on level end/purchase/settings change (FR-021)
- [ ] T067 [P] Write failing tests for economy in tests/unit/economy.spec.ts (clear reward 20-30, bonus ×5-10, upgrade prices 50-100 start ×1.15-1.25/Lv cap 5, insufficient-balance rejection)
- [ ] T068 [P] Implement src/meta/Economy.ts + UpgradeState.ts to pass T067 (FR-018, FR-019)
- [ ] T069 Home scene SC-001 (Play, coin balance, settings/shop entries — 2 taps to gameplay) in src/render/scenes/HomeScene.ts
- [ ] T070 Level select SC-002 (chapter map, stars/lock states, bonus distinction, replay unlocked) in src/render/scenes/LevelSelectScene.ts (FR-016)
- [ ] T071 Shop SC-007 (2 upgrade axes, price/current/next effect, disabled state + shortfall display) in src/render/scenes/ShopScene.ts (FR-019, P5 friction)
- [ ] T072 Settings SC-008 (sound/haptics toggles immediate+persisted, progress reset double-confirm typing "リセット", credits/version) in src/render/scenes/SettingsScene.ts (FR-020)
- [ ] T073 Results overlays SC-005/SC-006 wiring into PlayScene (clear: 5-beat + Next/Replay; fail: Retry) per ui_design_brief.md labels (Restart/Retry/Replay rule)
- [ ] T074 FTUE: L1-L3 finger-trace hint (no text), 45s-to-full-joy instrumentation hooks (FR-017)

## Phase 8: Platform Layer & Native Shell (FR-022, FR-023)

- [ ] T077 [P] src/platform/interfaces.ts (frozen names) + noop/ implementations + placement constants (rv_coin_multiplier, rv_continue_hint, interstitial_level_complete) + hidden ad UI hooks behind flags per contracts/platform-interfaces.md
- [ ] T078 [P] web/ + capacitor/ implementations (Storage: localStorage/Preferences; Haptics: vibrate/Capacitor Haptics; Analytics: console-dev/Noop)
- [ ] T079 Device builds verified: `npm run build && npx cap sync`, iOS + Android launch, portrait, safe area, 60fps WebView settings; record device fps/step in research.md (FR-023)

## Phase 9: Dev Tools (FR-024, FR-025 — dev builds only, tree-shaken from prod)

- [ ] T082 In-game level editor src/editor/: terrain vertex edit, car/flag/coin/gimmick placement, ink budget + star thresholds, testplay → record ghost on success, JSON export/import; save blocked without recorded clear (FR-024)
- [ ] T083 Debug tuning panel src/debug/: sliders for all TuningConstants groups live-applied, fps/step p95/body count overlay (FR-025)

## Phase 10: Content — Chapter 1 (game_design §6 per-level briefs)

- [ ] T086 Author ch1-l01..l05 (FTUE arc: L1 any-line-works 10s success; L2 ink meter/stars; L3 consolidation; L4 mid-support; L5 first curve-for-3-stars) with ghost solutions via editor; pass Gates 0-3
- [ ] T087 Author ch1-l06..l15 (sawtooth difficulty, growing gaps, anti-dominant tags from l07 per game_design §6) + pass gates
- [ ] T088 Author bonus ch1-b1..b3 (5-10× rewards, every 5 levels) + chapter progression wiring (FR-015)
- [ ] T089 Full-set gate run in CI + tempo audit: L1 ghost ≤25s, loop ≤40s (KPI-003, KPI-004)

## Phase 11: E2E, Contracts & Polish

- [ ] T092 Playwright E2E tests/e2e/l1-clear.spec.ts: real pointer-draw L1 → clear ≤25s; retry ≤1s; input→visual ≤100ms probe (NFR-002, NFR-003)
- [ ] T093 [P] Tempo contract test suite tests/e2e/tempo.spec.ts (first 3 levels 60-90s via scripted strokes, Next active 1.5-2.5s, celebration skippable)
- [ ] T094 [P] Bundle audit: web ≤5MB gzip, dev-only modules absent from prod build (NFR-013); cold start ≤3s device / ≤5s web (NFR-006)
- [ ] T095 [P] Accessibility pass: touch targets ≥44pt, stress double-coding (color+particles+vibration), 12pt min text (NFR-009)
- [ ] T096 juice checklist audit vs game_design §4 mandatory items = 100% (KPI-005) + ux_protocol.md full-screen device walkthrough (gatekeeper HG evidence)

## Dependencies

- Phase 1 → 2 → {3, 4, 5} ; 3 blocks Phase 6 tuning finalization (not its coding) ; 5 → 6 → 7 ; 7 → {8 finalize, 9} ; 9 → 10 ; 10 → 11
- Engine TDD pairs (T010→T011 etc.) are strictly ordered; [P] marks parallel-safe tasks (different files, no pending deps)

## Implementation Strategy

MVP-first vertical slice: after Phase 5 checkpoint the game is playable raw; Phase 6 is the quality bar (dopamine scenes); Phases 7-10 complete the loop. Every phase ends with CI green. gatekeeper device verification at Phase 6, 8, 11 checkpoints. forge_ace gates apply per change-set; claude-to-codex cross-review after Phase 6 and Phase 11; specs-evals wires Gates 0-3 + tempo contracts as the regression suite.

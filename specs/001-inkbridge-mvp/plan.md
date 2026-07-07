# Implementation Plan: InkBridge MVP

**Branch**: `001-inkbridge-mvp` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-inkbridge-mvp/spec.md`

## Summary

Build a line-drawing physics puzzle game (draw a bridge with one stroke → car launches automatically → reach the flag) as a locally playable MVP: Chapter 1's 15 levels + 3 bonus levels, star rating by ink economy, coin meta with 2 upgrade axes (ink capacity / engine speed), and the full set of mandatory "juice" for the three dopamine scenes (drawing / launch / goal). The differentiator is a genuinely deformable bridge: a segmented capsule chain with spring joints, stress-driven creak feedback, and breakable joints — competitors ship rigid single-body lines. Runs in the browser via Vite dev server and on iOS/Android devices via a Capacitor 8 shell. No ad/analytics SDKs; platform capabilities go through interfaces with Noop implementations.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 20 (pinned for CI determinism)
**Primary Dependencies**: Phaser 4.2.x (WebGL renderer), phaser-box2d 1.1.x (Box2D v3 JS port, MIT), Vite 6.x, Capacitor 8 (@capacitor/core, @capacitor/haptics), Vitest (unit), Playwright (E2E)
**Storage**: Local only — StorageInterface → localStorage (web) / @capacitor/preferences (native); save data JSON with schemaVersion + atomic write pattern
**Testing**: Vitest (engine unit, 80%+ coverage), headless Node gate scripts (Gate 0-3), Playwright (real-tap E2E: L1 clear + tempo contract), GitHub Actions on pinned Node
**Target Platform**: iOS 16+, Android 10+ (API 29+, Capacitor WebView), evergreen desktop/mobile browsers; portrait 390×844 design basis
**Project Type**: mobile-app (cross-platform game, web-first development)
**Performance Goals**: 60fps sustained; physics step p95 ≤ 4ms on mid-tier Android WebView; input→visual ≤ 100ms (stroke tip same-frame); fixed timestep 1/60 + accumulator + render interpolation
**Constraints**: Zero external network calls in v1.0; Engine layer Phaser-free and headless-runnable; all tunables in TuningConstants + level JSON; determinism contract = CI state-hash equality + device tolerance band (success/fail match, final pos ε=0.05m, ticks ±30); web bundle ≤ 5MB gzip
**Scale/Scope**: 18 levels (15 + 3 bonus), 10 screens (SC-001..SC-010), 26 FRs / 24 user stories, ~70 tuning constants, 4 CI gates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Quality Gate | designs/ score 93/92 ≥ 70; TDD for Engine; tempo/determinism/level gates as CI contracts — all carried into this plan's test strategy | PASS |
| II. Commercial Quality Bar | Juice specs (game_design §4) planned as first-class implementation tasks with checklist verification (KPI-005); mechanics imitate proven patterns | PASS |
| III. Scope Discipline | Plan contains no ad SDK / IAP / analytics SDK / vehicle collection / Ch2+ work; interfaces only | PASS |
| IV. Platform-Agnostic Design | Layer boundaries Engine/Render/Meta/Platform/Tuning mapped 1:1 to directory structure below; ESLint boundaries scaffolded in Phase A setup | PASS |

**Post-Phase-1 re-check**: PASS — data-model.md and contracts/ introduce no violations; level schema and platform interfaces match the Decision Freeze list in constitution.md.

## Project Structure

### Documentation (this feature)

```text
specs/001-inkbridge-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions consolidated + 3 spike protocols
├── data-model.md        # Phase 1 output — entities, level schema, save data, tuning
├── quickstart.md        # Phase 1 output — dev setup, run, test, device build
├── contracts/           # Phase 1 output
│   ├── level-schema.md          # Level JSON contract (Gate 0 source of truth)
│   ├── platform-interfaces.md   # Ad/Analytics/Haptics/Storage interface contracts
│   ├── save-data.md             # Persistence contract + migration rules
│   └── gate-pipeline.md         # Gate 0-3 CLI contract (inputs/outputs/exit codes)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── engine/                  # Phaser-FREE, headless-runnable (constitution IV)
│   ├── physics/             # Box2D world lifecycle, fixed-step loop, bridge chain
│   │   ├── World.ts             # world create/step/hash (1/60 + accumulator)
│   │   ├── BridgeChainBuilder.ts# stroke → RDP → resample → capsule chain + spring joints
│   │   ├── Vehicle.ts           # chassis + 2 wheel joints, motor, launch sequence
│   │   ├── StressTracker.ts     # per-joint EMA stress, creak band, break dispatch
│   │   └── Terrain.ts           # static chain shapes from level polylines
│   ├── rules/
│   │   ├── Judge.ts             # clear/fail detection (flag AABB, killY, tip-over, timeout)
│   │   ├── StarRating.ts        # ink-consumption thresholds
│   │   └── InkBudget.ts         # stroke length accounting
│   ├── level/
│   │   ├── LevelSchema.ts       # types + runtime validation (Gate 0 shares this)
│   │   └── LevelLoader.ts
│   ├── replay/
│   │   ├── GhostRecorder.ts     # position-sample recording
│   │   └── GhostPlayer.ts       # tolerance-band playback verification
│   └── EngineEvents.ts      # typed event bus (Render/Meta subscribe; one-way)
├── render/                  # Phaser 4 — observes Engine, never writes back
│   ├── scenes/              # Boot, Home, LevelSelect, Play, Shop, Settings (+Result overlays)
│   ├── draw/                # pointer capture, live stroke rendering (raw tip + smoothed past)
│   ├── juice/               # CameraDirector (lerp/look-ahead/kick/trauma²), HitStop,
│   │                        # SlowMo, Confetti, CoinBurst, StressTint, particles
│   └── audio/               # SfxPlayer (pitch ladder, ±5% random), EngineHum, Ducking
├── meta/                    # coins, upgrades (real multipliers), progression, save
├── platform/
│   ├── interfaces.ts        # AdInterface, AnalyticsInterface, HapticsInterface, StorageInterface
│   ├── noop/  ├── web/  └── capacitor/
├── tuning/
│   └── TuningConstants.ts   # single source of ~70 tunables (initial values from game_design §8)
├── editor/                  # in-game level editor (dev build only, import.meta.env.DEV)
├── debug/                   # tuning slider panel + fps/step overlay (dev build only)
└── main.ts

levels/                      # ch1-l01.json .. ch1-l15.json, ch1-b1..b3.json
scripts/gates/               # gate0-schema.mjs, gate1-static.mjs, gate2-ghost.mjs, gate3-antidominant.mjs
tests/
├── unit/                    # engine: chain builder, judge, stars, ink, stress, save migration
├── contract/                # level schema fixtures, platform interface conformance
└── e2e/                     # playwright: L1 real-tap clear, tempo contract, retry ≤1s
ios/ android/                # Capacitor shells (generated, committed)
.github/workflows/ci.yml     # pinned-Node gates + unit + E2E
```

**Structure Decision**: Single Vite app with layer-per-directory. The `engine/` package boundary is enforced by eslint-plugin-boundaries (engine imports nothing from render/meta/platform; render/meta import engine+tuning; platform impls implement `platform/interfaces.ts` only). Dev-only modules (`editor/`, `debug/`) are tree-shaken out of production builds via `import.meta.env.DEV` guards.

## Phase 0: Research → [research.md](./research.md)

All technology unknowns were resolved by the project-level deep research (research/00..07). research.md consolidates the decisions in spec-kit format and defines the **three week-1 spikes** (from research/07_decision.md §7.3) that gate physics implementation choices:

1. **Spike S1 — stroke physics method**: capsule chain A/B/C/D comparison at N=8/16/24/32 on mid-tier Android WebView. Pass: p95 step ≤ 4ms @ 60fps AND visible load sag + non-cartoonish break with method C (or D). Fail → fallback A (single compound) + render-layer fake sag.
2. **Spike S2 — capsule×wheel contact quality**: verify phaser-box2d unmerged capsule-manifold PR issue; if contact popping occurs → import PR into MIT fork or switch segments to rounded boxes.
3. **Spike S3 — run-to-run determinism**: same level + same stroke × 1000 headless runs → state hash comparison (CI gate precondition).

## Phase 1: Design & Contracts

- **data-model.md**: entities (Level, Stroke, BridgeChain, Segment, Vehicle, Judge outcomes, SaveData, UpgradeState, TuningConstants groups), validation rules, state machine (Idle→Drawing→Solidify→Anticipation→Running→Goal|Fail→Result→Next).
- **contracts/**: level JSON schema (ghost solution ≥1, killY, schemaVersion mandatory), platform interfaces (frozen names per constitution), save-data + migration contract, gate pipeline CLI contract (exit codes for CI).
- **quickstart.md**: `npm install && npm run dev` → browser play; `npm test` / `npm run gates`; `npx cap sync` → Xcode/Android Studio device run; editor & tuning panel access.
- **Agent context**: `.specify/scripts/bash/update-agent-context.sh claude` run after artifacts.

## Complexity Tracking

No constitution violations — table intentionally empty.

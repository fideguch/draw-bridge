# InkBridge Constitution

## Core Principles

### I. Quality Gate (NON-NEGOTIABLE)

- Requirements quality score must be >= 70 before implementation (current: 93/92 by two independent reviewers, recorded in `designs/workflow_config.md`).
- All functional requirements must have testable acceptance criteria (Given-When-Then in `designs/user_stories.md`).
- TDD mandatory for the Engine layer: tests written before implementation.
- Game-design intent is enforced as test contracts, not prose: tempo contracts (NFR-003), determinism contract (NFR-004), level gates (FR-026) run in CI and block merge.

### II. Commercial Quality Bar

- The quality standard is commercial release ("good enough to attach ads to"), NOT the two prior local projects (Stadium Rush! / Glowgrid) — those are process references only.
- Game mechanics imitate proven successful patterns (Bravestars Draw Bridge 53M DL et al.); we do not invent core mechanics from scratch. Differentiation comes from physical authenticity (bending/creaking/breaking bridges), generous ad UX, and juice quality.
- The three "dopamine scenes" (drawing the line / car launch / goal celebration) receive priority in development resources. Their specs in `designs/game_design.md` §4 are requirements, not suggestions.

### III. Scope Discipline

The following are NOT implemented in this feature (deferred with phase labels, see `designs/README.md` Rejected/Deferred table):

- Ad SDK integration (AdMob), UMP/ATT consent flows — v1.1 (interfaces only in v1.0)
- IAP (ad removal, coin packs) — v1.1
- Firebase Analytics / Remote Config / A/B testing — store-release build
- Vehicle collection & skins — v1.1; physics-varying vehicles — v1.2
- Bridge material unlocks — v1.2
- Offline earnings, daily calendar — v1.3
- Chapter 2+ gimmicks (G3..G12) and levels beyond Ch1's 15+3 — post-MVP
- Web portal submission (Poki/CrazyGames), CPI tests, store assets — GTM phase

### IV. Platform-Agnostic Component Design

- `Engine` (physics, rules) is Phaser-independent and runs headless in Node — this enables CI bot verification and is non-negotiable.
- `Render` observes Engine output; writing back to Engine state is forbidden.
- All platform capabilities (Ads, Haptics, Analytics, Storage) are accessed through interfaces with Noop / Web / Capacitor implementations. No direct SDK calls from game code.
- All tuning values live in `TuningConstants` + level JSON. Magic numbers scattered in code are a review-blocking defect.

## Technical Constraints

- Stack: TypeScript / Phaser 4.x + phaser-box2d (Box2D v3, MIT) / Vite / Capacitor 8. Verified on npm (phaser@4.2.0, phaser-box2d@1.1.0).
- Targets: iOS 16+, Android 10+ (API 29+), modern browsers (dev + distribution). Portrait, one-hand play.
- Performance: 60fps sustained with physics step p95 <= 4ms on mid-tier Android WebView (KPI-001). Fixed timestep 1/60 + accumulator + render interpolation.
- Determinism contract (relaxed, per research/07_decision.md §7.2): bit/state-hash equality inside CI (pinned Node); tolerance-band verification on devices (success/fail match, final position ε=0.05m, ticks ±30). Replays are position-sample playback.
- Privacy: v1.0 ships with zero external network calls ("Data Not Collected"). No ad/analytics SDKs bundled.
- Bridge physics: segmented capsule chain + spring revolute joints + break thresholds (method C), with single-compound rigid fallback (method A) switchable for low-end devices. Week-1 spike gates the choice (research/07_decision.md §7.3).

## Development Workflow

- Requirements: /requirements_designer → designs/ (done, score 93/92)
- Specification: /speckit-bridge → spec.md + constitution.md + conventions.md
- Pipeline: /speckit.plan → /speckit.tasks → implementation via forge_ace (Writer/Guardian/Overseer/PM-Admin) with gatekeeper device verification, claude-to-codex cross-model review, and specs-evals regression gates
- All changes must trace back to an FR or US. Handoffs are recorded as GitHub Issues (repo: fideguch/draw-bridge, Projects V2 #6).

## Architecture Governance

### Convention Authority

- `.specify/memory/conventions.md` defines naming decisions (thin reference)
- ESLint + eslint-plugin-boundaries enforce code structure at commit time (scaffolded with the app; no package.json exists yet at bridge time)
- New entities MUST be added to conventions.md before implementation

### Decision Freeze

Frozen at spec time (change requires /speckit-bridge re-run):

- Level JSON schema requirements (ghost solution mandatory, killY, schemaVersion)
- Layer boundaries: Engine / Render / Meta / Platform / TuningConstants
- Platform interface names: AdInterface, AnalyticsInterface, HapticsInterface, StorageInterface
- Analytics event vocabulary: GA4 game events (level_start, level_end, earn_virtual_currency, spend_virtual_currency)

### Business Rules Registry

Business rules that cannot be expressed in schema/linter are documented in conventions.md Section 4. These are the highest-drift-risk items — review them at every PR.

## Design Artifacts

### Source of Truth Hierarchy

1. `designs/ui_design_brief.md` — design tokens, screen layouts, motion rules, trust patterns (P1-P7)
2. `designs/game_design.md` §4 — juice specifications (the "dopamine checklists" with concrete parameters)
3. `designs/ux_protocol.md` — screen-by-screen verification protocol for gatekeeper device checks

### For Engineers

- UI implementation: read `designs/ui_design_brief.md` first; game feel: `designs/game_design.md` §4 and §8 (TuningConstants initial values)
- Token naming: follow conventions.md Section 5
- Figma file: Not yet created (Phase 5 deferred; game renders in code)

## Governance

- Constitution is generated from requirements_designer output
- Updates require re-running /requirements_designer and /speckit-bridge
- Constitution supersedes ad-hoc decisions during implementation
- conventions.md is a derived artifact — never edit manually

**Version**: 2.1 | **Generated**: 2026-07-07 | **Source**: designs/README.md

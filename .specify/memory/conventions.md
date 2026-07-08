# InkBridge Conventions

> Source: designs/ubiquitous_language.md | Generated: 2026-07-07
> Changes require re-running /speckit-bridge. Do NOT edit manually.

## 1. Directory Structure (layer boundaries — ESLint boundaries enforce)

- Pure game logic: `src/engine/` (Phaser-free, headless-runnable; physics, rules, level state)
- Rendering/juice: `src/render/` (Phaser scenes, particles, camera; reads Engine, never writes)
- Meta/economy: `src/meta/` (coins, upgrades, progression, persistence models)
- Platform interfaces: `src/platform/` (`AdInterface`, `AnalyticsInterface`, `HapticsInterface`, `StorageInterface` + `noop/`, `web/`, `capacitor/` impls)
- Tuning: `src/tuning/TuningConstants.ts` (single source of all tunable numbers)
- Levels: `levels/*.json` (data only; ghost solution + killY + schemaVersion mandatory)
- Tools: `src/editor/` (in-game level editor, dev-build only), `src/debug/` (tuning panel, dev-build only)
- Validation: `scripts/gates/` (Gate 0-3 CI scripts, headless Node)
- Import rule: engine → (nothing); render/meta → engine, tuning; platform impls → platform interfaces only; editor/debug → anything except platform impls.

## 2. Naming

- Classes/types/interfaces: PascalCase (no `I` prefix). Files: match main export (`BridgeChain.ts`).
- Variables/functions: camelCase. Booleans: `is/has/should` prefix. Constants: UPPER_SNAKE only for true compile-time constants.
- Domain vocabulary is fixed by UL (designs/ubiquitous_language.md): `Stroke` (pre-solidify), `BridgeChain` (post-solidify), `Segment`, `stress` (0-1), `break`, `Anticipation`, `launch`, `GoalFlag`, `starRating`, `inkCapacityLv`, `engineSpeedLv`, `Chapter`, `BonusLevel`, `GhostSolution`, `killY`, `VehicleReferencePoint` (chassis AABB center), `強化` (upgrade-entry label — never 「ショップ」, coin-only economy, UL-026), `Rock` / `RockHazard` (rolling/falling circle hazard, level JSON `rocks[]`; a `RockHazard` reaching the car undeflected induces the EXISTING tipOver/fall/timeout — NO new fail rule; the drawn `BridgeChain` is its shield/deflector). `DangerZone` (axis-aligned hazard band, level JSON `dangerZones[]`; the CAR — chassis or a wheel — overlapping a zone fails with the NEW `FailCause` `'hazard'`, clear-beats-fail per BR-009; the drawn `BridgeChain` and rocks pass through zones UNAFFECTED — a zone only kills the car).
- Forbidden identifiers: `DrawBridge` (competitor name), `stage` (use `level`), mixing `stroke`/`bridge` semantics.

## 3. Levels & Events (offline game — no DB/API)

- Level JSON: camelCase keys, `schemaVersion` int, ghost solution >= 1 mandatory, saved only if Gate 0-3 pass. IDs: `ch1-l01`..`ch1-l15`, `ch1-b1`..`ch1-b3`.
- Analytics event names (Noop in v1.0, GA4 vocabulary frozen): `level_start`, `level_end`, `earn_virtual_currency`, `spend_virtual_currency`.
- Ad placements (constants now, SDK later): `rv_coin_multiplier`, `rv_continue_hint`, `interstitial_level_complete` (frequency caps in TuningConstants).

## 4. Business Rules (not expressible in schema/linter)

- BR-001: Release of pointer = commit; the line solidifies and the car launches with zero additional input (Source: FR-003, FR-005)
- BR-002: Failure is never punished — no lives/stamina/penalty; retry <= 1s (Source: FR-004, FR-008, NFR-003)
- BR-003: Level-collected coins credit only on level clear; restart/fail discards them; clear reward credits every clear, collected coins first clear only (Source: FR-009, game_design §7.3)
- BR-004: All levels must be clearable with Lv0 upgrades (base ink/speed); Gate 2-3 replays always run at Lv0 (Source: FR-019, FR-026)
- BR-005: Upgrade effects are real physics multipliers — dummy/no-op effects forbidden (Source: FR-019)
- BR-006: hit-stop max 1-2 per level (goal + biggest crash only) (Source: FR-012, NFR-008)
- BR-007: Every celebration/animation is tap-skippable; failure effects are lightest-weight (Source: FR-012, FR-013, NFR-008)
- BR-008: v1.0 makes zero external network calls; ad/analytics code paths terminate in Noop implementations (Source: FR-022, NFR-012)
- BR-009: Clear and fail in the same tick resolves as clear (Source: FR-007)
- BR-010: Progress persists on every level end / purchase / settings change, atomically, with schemaVersion migration (Source: FR-021)

## 5. Design Tokens

- Source: designs/ui_design_brief.md Section 2 (code-named tokens, e.g. `colorInk`, `colorStressMid`, `colorCoin`)
- Naming: `color[Role]`, `space[Scale]` (4pt grid), `font[Role]`, `radius[Scale]`, `duration[Speed]`
- Token changes: update ui_design_brief.md first, then code. No inline hex in components.

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
- Domain vocabulary is fixed by UL (designs/ubiquitous_language.md): `Stroke` (pre-solidify), `BridgeChain` (post-solidify), `Segment`, `stress` (0-1), `break`, `Anticipation`, `launch`, `GoalFlag`, `starRating`, `inkCapacityLv`, `engineSpeedLv`, `Chapter`, `BonusLevel`, `GhostSolution`, `killY`, `VehicleReferencePoint` (chassis AABB center), `強化` (upgrade-entry label — never 「ショップ」, coin-only economy, UL-026), `Rock` / `RockHazard` (rolling/falling circle hazard, level JSON `rocks[]`; **round-7 F1**: the CAR — chassis or a wheel — touching a live rock fails with `FailCause` `'hazardContact'` — contact IS the loss, `hazard-wins` on a same-tick goal tie per BR-009; the drawn `BridgeChain` is its shield/deflector and is UNAFFECTED by rock contact). `DangerZone` (axis-aligned hazard band, level JSON `dangerZones[]`; the CAR overlapping a zone fails with the SAME `FailCause` `'hazardContact'`; the drawn `BridgeChain` and rocks pass through zones UNAFFECTED — a zone only kills the car). `hazardContact` (round-7 unified rock+zone+spike contact-death `FailCause`, highest judge priority). `killY` (**round-7 F3**: OUT-OF-WORLD engine failsafe at `minTerrainY-6`, authoring-DERIVED — NOT hand-set — and NEVER user-facing; `fall` below it is a silent failsafe reset like `divergence`, not a shown cause).
- **Round-8 vocabulary (fun-gate overhaul)**: `DeclaredSolution` / `solutions[]` (level JSON, additive schemaVersion 1, absent == none like `rocks`): author-DECLARED alternative solutions — each `{ shapeTag, stroke }` — that Gate 8 (multi-solution) PLAYS through the SAME player commit path and requires to CLEAR at Lv0; `shapeTag` (fixed vocabulary `SHAPE_TAGS`: `line | arch | hook | trapezoid | angle | pillar | wall | sag | ramp`) names the shape FAMILY of a declared solution — Gate 8 requires >= 2 DISTINCT shapeTags per level (tutorial allowlist `ch1-l01`/`ch1-l02` relaxed to 1). `lazy-line` (Gate 7): the machine form of the round-8 user complaint 「全28面が横一本線でクリアできる」— a bot draws 4 horizontal-line patterns (rim-exact / rim-overlap / high / low, `LAZY_LINE_PATTERNS`) through the player commit path; ANY pattern clearing FAILS the level (tutorial allowlist `ch1-l01`/`ch1-l02` sanctioned).
- Forbidden identifiers: `DrawBridge` (competitor name), `stage` (use `level`), mixing `stroke`/`bridge` semantics.

## 3. Levels & Events (offline game — no DB/API)

- Level JSON: camelCase keys, `schemaVersion` int, ghost solution >= 1 mandatory, saved only if Gate 0-3 pass. IDs: `ch1-l01`..`ch1-l15`, `ch1-b1`..`ch1-b3`.
- Level JSON `solutions[]` (round-8, optional/additive): `{ shapeTag, stroke }` entries; strokes are RAW authored polylines (world m) replayed by Gate 8 through the player commit path — never hand-record results into them (the gate plays them live). Levels without `solutions[]` are WARN-deferred under `--warn-new-gates` (staged rollout); DECLARED solutions are verified strictly regardless of the flag.
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
- BR-009: Clear and fail in the same tick resolves as clear — EXCEPT `hazardContact` (rock/zone/spike contact), which WINS over clear on a same-tick tie (round-7 F1, game_plan_v5 §2.1 hazard-wins; authoring never places a hazard on the goal line, so the tie is a deterministic edge only) (Source: FR-007)
- BR-010: Progress persists on every level end / purchase / settings change, atomically, with schemaVersion migration (Source: FR-021)
- BR-011: (round-9) `Person` — NPC obstacle (level JSON `persons[]`, static AABB sensor, dims from TuningConstants ≈1.3×1.7m); the CAR (chassis or wheel) touching a person fails with dedicated `FailCause` `'personContact'` (same judge priority tier as `hazardContact`, hazard-wins tie rule applies). The drawn BridgeChain is unaffected by persons. Visual: high-contrast stick figure (Source: designer Figma comment 11 + fun decision 4, 2026-07-15)
- BR-012: (round-9) DangerZone semantics AMENDED — zones now also BLOCK drawing: stroke points/segments may not enter any zone rect (draw predicate = terrain ∪ dangerZones; live preview and commit use the identical predicate). Zones render as plain static red rectangles; `spike`/`spikeDown` styles and all needle visuals are REMOVED game-wide. Applies to schemaVersion 2 levels; v1 levels keep round-7 semantics during the CS-1→CS-4 transition only (Source: designer comments 8/10 + fun decision 4; amends the round-7 DangerZone entry above)
- BR-013: (round-9) WYSIWYG stroke — the committed BridgeChain must equal the live preview exactly; a stroke that terrain clipping would split into >1 run is REJECTED before launch (player redraws; the longest-run auto-selection is removed for player commits) (Source: fun decision 3)
- BR-014: (round-9) Stars — ★1 = clear; ★2 = clear + level `objective` (v1 set: `coins` = collect all, `noBreak` = no segment break); ★3 = ★2 + inkUsed ≤ star3 ink threshold. Supersedes ink-only star thresholds (Source: fun decision 5)
- BR-015: (round-9) Free solutions — any physically valid one-stroke clear is a legitimate win; gates must not enforce anti-horizontal-line blocking (lazyLine = advisory telemetry only); level difficulty comes from terrain/hazard geometry, never from solution-defense gimmicks (Source: fun decision 2 + designer comment 3)

## 5. Design Tokens

- Source: designs/ui_design_brief.md Section 2 (code-named tokens, e.g. `colorInk`, `colorStressMid`, `colorCoin`)
- Naming: `color[Role]`, `space[Scale]` (4pt grid), `font[Role]`, `radius[Scale]`, `duration[Speed]`
- Token changes: update ui_design_brief.md first, then code. No inline hex in components.

# Quickstart: InkBridge MVP

Dev setup, run, test, and device build. Web-first workflow (plan.md): the browser dev loop is where physics/juice tuning happens; devices are for verification.

## 1. Prerequisites

- **Node 20** — use the exact version in `.nvmrc` (`nvm use`); the same pin runs in CI (determinism contract).
- npm (bundled with Node).
- Device builds only: Xcode 15+ (iOS 16+ target) / Android Studio (API 29+).

## 2. Install & Run

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Open the URL in a browser (mobile viewport ≈ 390×844 portrait recommended in devtools). HMR is active; TuningConstants edits hot-reload.

**Controls (web/desktop)**: mouse drag = draw the stroke (touch drag on devices); release = commit → car launches automatically; on-screen restart button = instant reset (≤ 1 s); any tap during the goal celebration = skip.

## 3. Dev-Only Tools (excluded from release builds via `import.meta.env.DEV`)

| Tool | Access | Purpose |
|---|---|---|
| Debug tuning panel (`src/debug/`) | `` ` `` (backtick) key, or triple-tap the top-left corner on touch | runtime sliders for every physics/camera/juice constant; continuous fps / physics-step-time (p95) / body-count readout; changed values persist for the session (FR-025) |
| Level editor (`src/editor/`) | `#/editor` hash route | terrain vertex editing, spawn/flag/coin/gimmick placement, inkBudget + star2/star3 + tags; **save requires a recorded test-play clear** (attaches the ghost solution); exports/imports level JSON (FR-024) |

Release builds tree-shake both directories out entirely — no runtime path can reveal them.

## 4. Test & Validate

```bash
npm test           # Vitest — engine unit tests (target: ≥ 80% line coverage on src/engine)
npm run gates      # Gate 0→1→2→3 over levels/*.json (headless; see contracts/gate-pipeline.md)
npm run e2e        # Playwright — real-pointer L1 draw & clear, tempo contract, retry ≤ 1s
```

`npm run gates` is the pre-commit check when authoring levels — identical to the CI pipeline on the same pinned Node. Exit 0 = all pass, 1 = a level failed a gate, 2 = config error.

## 5. Device Build (Capacitor 8)

```bash
npm run build              # production web bundle (≤ 5MB gzip budget)
npx cap sync ios           # copy bundle + plugins into ios/
npx cap sync android       # ... into android/
npx cap open ios           # Xcode → run on device
npx cap open android       # Android Studio → run on device
```

On-device verification target (week-1 spike + KPI-001): mid-tier Android (Snapdragon 6xx / Helio G), 60 fps with physics step p95 ≤ 4 ms — read it from the debug overlay (dev build on device). v1.0 plugins: `@capacitor/haptics`, `@capacitor/preferences` only; zero network calls.

## 6. Project Layout (from plan.md)

| Path | Contents |
|---|---|
| `src/engine/` | Phaser-free, headless-runnable: physics (World, BridgeChainBuilder, Vehicle, StressTracker, Terrain), rules (Judge, StarRating, InkBudget), level (LevelSchema, LevelLoader), replay (GhostRecorder/Player), EngineEvents |
| `src/render/` | Phaser 4 scenes, draw capture, juice (camera/hit-stop/slow-mo/confetti), audio — observes Engine, never writes back |
| `src/meta/` | coins, upgrades, progression, SaveManager |
| `src/platform/` | `interfaces.ts` + `noop/` `web/` `capacitor/` implementations |
| `src/tuning/TuningConstants.ts` | single source of ~70 tunables |
| `src/editor/`, `src/debug/` | dev-only tools (§3) |
| `levels/` | `ch1-l01.json`..`ch1-l15.json`, `ch1-b1..b3.json` |
| `scripts/gates/` | gate0-schema / gate1-static / gate2-ghost / gate3-antidominant |
| `tests/` | `unit/` (Vitest), `contract/` (schema + platform conformance), `e2e/` (Playwright) |
| `ios/`, `android/` | generated Capacitor shells (committed) |

## 7. Tuning Workflow

1. All tunables live in `src/tuning/TuningConstants.ts`, grouped `physics` / `bridge` / `car` / `camera` / `draw` / `launch` / `coin` / `goal` / `audio` / `haptic` / `economy` / `ads` — initial values transcribed from designs/game_design.md §8 (see data-model.md §1.8). Level-specific values (inkBudget, star thresholds, maxTicks) live in level JSON, not here.
2. Run the game, open the debug panel (`` ` ``), move sliders mid-run — changes propagate immediately to every consumer (single source; magic numbers elsewhere are defects, grep-verifiable per NFR-010).
3. Watch fps / step-time p95 / body count in the overlay while tuning (the spring-chain swamp: too stiff = dull collapse, too soft = flailing).
4. Copy final values back into `TuningConstants.ts` (panel values persist for the session only).
5. If a physics constant moved, re-run `npm run gates` — ghosts may need re-recording via the editor if Gate 2 drifts beyond ε = 0.05 m / ±30 ticks.

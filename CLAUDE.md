# draw-bridge Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-07-07

## Active Technologies

- TypeScript 5.x (strict), Node 20 (pinned for CI determinism) + Phaser 4.2.x (WebGL renderer), phaser-box2d 1.1.x (Box2D v3 JS port, MIT), Vite 6.x, Capacitor 8 (@capacitor/core, @capacitor/haptics), Vitest (unit), Playwright (E2E) (001-inkbridge-mvp)

## Project Structure

```text
src/
├── engine/     # Phaser-FREE, headless-runnable game logic (physics, rules, level, replay)
├── render/     # Phaser 4 scenes, draw input, juice, audio — observes Engine, never writes back
├── meta/       # coins, upgrades, progression, save
├── platform/   # interfaces.ts + noop/ web/ capacitor/ implementations
├── tuning/     # TuningConstants.ts — single source of ALL tunable numbers
├── editor/     # in-game level editor (dev build only)
└── debug/      # tuning slider panel (dev build only)
levels/         # level JSON (ghost solution + killY + schemaVersion mandatory)
scripts/gates/  # Gate 0-3 CI validation (headless Node)
tests/          # unit/ (vitest, engine TDD) contract/ e2e/ (playwright)
ios/ android/   # Capacitor 8 shells
```

## Directory Structure (governance)

| Directory | Owner | Git | Purpose                                           |
| --------- | ----- | --- | ------------------------------------------------- |
| research/ | PM    | Yes | Deep research + decision doc (07_decision.md)     |
| designs/  | PM    | Yes | Requirements (requirements_designer output, 93/92)|
| .specify/ | Auto  | Yes | spec-kit config, constitution, conventions        |
| specs/    | PM→TL | Yes | spec.md, plan.md, tasks.md (feature branch)       |
| src/      | Eng   | Yes | Production code                                   |
| tests/    | Eng   | Yes | Test code                                         |
| .claude/  | Auto  | No  | Claude Code project settings                      |

## Project Conventions

- Naming/boundaries/business rules: `.specify/memory/conventions.md` (BR-001..BR-010) — enforced by ESLint boundaries
- Principles: `.specify/memory/constitution.md` (Engine is Phaser-free; juice specs in designs/game_design.md §4 are REQUIREMENTS; no ad/analytics SDKs in v1.0)
- New entity? → Add to conventions.md first, then implement.
- All tunable numbers live in `src/tuning/TuningConstants.ts` or level JSON — magic numbers are review-blocking.
- UL vocabulary is binding: Stroke (pre-solidify) / BridgeChain (post-solidify), Level (never "stage"), Restart / Retry / Replay (context-fixed labels).

## Commands

- `npm run dev` — browser play (Vite HMR)
- `npm test` — vitest engine units (≥80% coverage on src/engine/)
- `npm run gates` — level validation pipeline Gate 0-3
- `npm run e2e` — Playwright (real-tap L1 clear, tempo contracts)
- `npm run build && npx cap sync` — device builds

## Code Style

TypeScript 5.x strict. Classes/types PascalCase (no I-prefix), variables camelCase, booleans is/has/should. Files ≤800 lines, functions ≤50 lines. Engine imports nothing from render/meta/platform.

## Recent Changes

- 001-inkbridge-mvp: Added TypeScript 5.x (strict), Node 20 (pinned for CI determinism) + Phaser 4.2.x (WebGL renderer), phaser-box2d 1.1.x (Box2D v3 JS port, MIT), Vite 6.x, Capacitor 8 (@capacitor/core, @capacitor/haptics), Vitest (unit), Playwright (E2E)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

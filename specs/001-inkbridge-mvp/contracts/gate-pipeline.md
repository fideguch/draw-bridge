# Contract: Gate Pipeline CLI (Gates 0–3)

Headless Node scripts in `scripts/gates/`, sharing `src/engine/` code (LevelSchema, World, Judge — the engine is Phaser-free by constitution IV). Source requirements: FR-026, BR-004, research R8. Identical results locally and in CI on the pinned Node version.

## 1. Scripts & Responsibilities

| Script | Gate | Checks |
|---|---|---|
| `gate0-schema.mjs` | 0 | JSON Schema (draft 2020-12) validation per [level-schema.md](./level-schema.md) + code-level checks: filename↔id match, `killY < min(terrain y)`, `star3 < star2 <= inkBudget`, ghost-solution presence ≥ 1 |
| `gate1-static.mjs` | 1 | static validity: `inkBudget > 0`; vehicleSpawn rests above terrain (raycast down hits terrain); goalFlag reachable placement (raycast down from rect hits terrain). Non-blocking warning: inkBudget vs minimal-span factor (factor value TBD — calibrated with editor measurements, game_design §6 legend) |
| `gate2-ghost.mjs` | 2 | headless ghost replay: for every `ghostSolutions[]` entry, re-simulate level + stroke **at Lv0 upgrade parameters** and compare to the recorded result within the tolerance band; `kind:"3star"` ghosts additionally assert `result.inkConsumed <= starThresholds.star3` |
| `gate3-antidominant.mjs` | 3 | straight-line bot MUST FAIL on every level tagged `anti-dominant` (no-op pass on untagged levels) |

## 2. CLI Contract (all four scripts)

```
node scripts/gates/gateN-*.mjs [--levels "<glob>"] [--quiet]
```

- `--levels` — level file glob, default `levels/*.json`.
- `--quiet` — suppress per-level lines, print summary only.

**Output (stdout, NDJSON)** — one line per level, then one summary line:

```json
{"gate":2,"level":"ch1-l08","pass":false,"errors":["ghost[0]: finalPos delta 0.11m > 0.05m"],"durationMs":412}
{"gate":2,"summary":true,"total":18,"passed":17,"failed":1,"durationMs":6210}
```

- `errors` is `[]` when `pass: true`. Gate 2 lines additionally carry `"stateHash"` (see §4). Human-readable logs go to stderr only — stdout stays machine-parseable.

**Exit codes**:

| Code | Meaning |
|---|---|
| 0 | all levels pass |
| 1 | at least one level fails a check |
| 2 | configuration/environment error (glob matched 0 files, unreadable file, bad flag, engine init failure) |

**Runner**: `npm run gates` executes Gates 0 → 1 → 2 → 3 in order over all levels, does NOT stop at the first failing gate (full report per PR), and exits 1 if any gate failed, 2 on config error.

## 3. Gate 2 — Tolerance Band (Lv0)

Replays always run at **Lv0 upgrades** (base inkBudget, base motorSpeed — BR-004: this machine-proves "every level is clearable unupgraded"). A ghost passes iff ALL of:

| Criterion | Tolerance |
|---|---|
| Outcome | exact match (`clear` — success/fail match) |
| Final VehicleReferencePoint position | ε = 0.05 m (Euclidean) vs `result.finalPos` |
| Tick count | ±30 ticks vs `result.ticks` |

Engine/library updates that push replays beyond the band trigger sensitivity-analysis recalibration or ghost re-recording — never unexamined threshold loosening (FR-026).

## 4. Determinism Check (CI regression detection)

Within a Gate 2 run, each level is simulated **twice in-process**; the end-state hashes (canonical serialization of all body positions/angles + tick count, hashed) must be bit-identical, and the hash is emitted as `stateHash` in the per-level output line. CI compares: (a) run-to-run equality within the job (hard fail on mismatch), (b) hash drift vs the previous main-branch run (reported for regression detection). Cross-device bit equality is explicitly NOT required (research R4) — the tolerance band covers devices.

## 5. Gate 3 — Straight-Line Bot Definition

For each level tagged `anti-dominant`:

1. **Anchor detection**: A = launch-pad edge — the terrain vertex marking the end of continuous terrain in the travel direction from `vehicleSpawn` (the spawn-side rim of the main gap; rim = vertex with no terrain within Δx = 0.2 m on its +x side, initial value). B = goal-side terrain edge — the symmetric rim vertex on the goalFlag side.
2. **Candidate strokes**: straight segments A→B with height offsets `{0, +0.5, +1.0}` m **× overlap extensions `{0, +1.0, +2.0}` m beyond each rim along x** (9 candidates; calibrated 2026-07-08 — exact rim-to-rim strokes have zero platform overlap and slide into every gap, making the original 3-candidate bot vacuously pass; real players draw straights through the rims. Regression-guarded by `tests/contract/gate3.spec.ts`).
3. **Ink clamp**: candidates whose length exceeds the Lv0 `inkBudget` are recorded as `infeasible(budget)` — they count as failed attempts (the economy layer of the anti-dominant defense).
4. **Verdict**: every feasible candidate is simulated headlessly at Lv0; the gate passes for the level iff **every candidate fails** (break / fall / tip-over / timeout). Any candidate clearing ⇒ gate failure ⇒ CI failure ⇒ merge blocked.

Ch1 anti-dominant set: `ch1-l08`, `ch1-l10`, `ch1-l12`, `ch1-l14`, `ch1-l15` (game_design §6). Near-trivial variants (L-shape, shallow V) are deliberately out of the bot's v1 domain (game_design §5.5 open question — revisit after feel tuning).

## 6. CI Wiring (`.github/workflows/ci.yml`)

- Trigger: every `pull_request` (plus `push` to main).
- Node **pinned to an exact 20.x version** via `.nvmrc` + `actions/setup-node@v4` with `node-version-file` (pinned Node = pinned V8 = in-CI bit determinism; exact patch version fixed at repo setup and only bumped deliberately with a Gate 2 re-verification).
- Steps: `npm ci` → `npm run gates` → `npm test` (Vitest, engine ≥ 80% coverage) → `npm run e2e` (Playwright; may be a separate job).
- Any nonzero gate exit fails the build and blocks merge (SC-004: 18/18 levels × 4 gates = 100%).
- The identical pipeline runs locally via `npm run gates` on the same pinned Node (`.nvmrc`) for pre-verification during level authoring.

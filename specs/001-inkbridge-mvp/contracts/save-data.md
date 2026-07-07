# Contract: SaveData & Persistence

Implemented by `src/meta/SaveManager` on top of `StorageInterface` ([platform-interfaces.md](./platform-interfaces.md) §4). Source requirements: FR-021, BR-003, BR-010, NFR-007.

## 1. SaveData JSON (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "coins": 120,
  "upgrades": { "inkCapacityLv": 1, "engineSpeedLv": 0 },
  "progress": {
    "ch1-l01": { "bestStars": 3, "cleared": true },
    "ch1-l02": { "bestStars": 2, "cleared": true }
  },
  "settings": { "sound": true, "haptics": true }
}
```

| Field | Type | Constraints |
|---|---|---|
| `schemaVersion` | int | current = 1; attached on every write |
| `coins` | int | `>= 0` invariant (violating writes are a programming error — rejected before save) |
| `upgrades.inkCapacityLv` | int | 0–5 |
| `upgrades.engineSpeedLv` | int | 0–5 |
| `progress` | object | keys = level ids (`ch1-l01`.. / `ch1-b1`..); absent key = never played; `bestStars` 0–3 monotonic non-decreasing; `bestStars > 0 ⇒ cleared: true`; `cleared` gates first-clear coin credit (BR-003) and next-level unlock |
| `settings.sound` / `settings.haptics` | boolean | applied immediately on change, persisted |

Unknown fields at ANY nesting level are **preserved verbatim** through load → migrate → save round-trips (forward compat with future versions; FR-021 edge case).

Initial state (fresh install / post-reset): `coins: 0`, both upgrades 0, `progress: {}` (Level 1 implicitly unlocked), settings default `true`/`true`. Progress reset (FR-020) writes the initial state but **retains current `settings`** — via the same atomic path (no half-reset state).

## 2. Storage Keys & Atomic Write Protocol

| Key | Content |
|---|---|
| `inkbridge.save` | current committed SaveData JSON |
| `inkbridge.save.tmp` | staging copy during a write |

Write sequence (every save trigger):

1. Serialize the full new SaveData (complete document — never partial patches).
2. `set('inkbridge.save.tmp', json)` → `get` back and parse-verify.
3. `set('inkbridge.save', json)` (per-key atomic per StorageInterface contract).
4. `remove('inkbridge.save.tmp')`.

Failure handling: if any step rejects, abort — `inkbridge.save` still holds the last good data; retry the whole sequence at the **next save trigger** (no retry loop, no user interruption). In-memory state remains authoritative until a save succeeds.

Load sequence (startup): read `inkbridge.save`; if missing/corrupt, try `inkbridge.save.tmp` (a crash between steps 2–4 leaves a valid tmp); then migrate → validate → delete tmp.

## 3. schemaVersion Migration Rules

- **Forward-only**: an ordered chain `migrate1to2`, `migrate2to3`, … applied in sequence until current. Downgrade migrations are never written; older app versions reading newer data fall into the corruption path (partial restore) rather than guessing.
- Each migration is a pure function `(old: unknown) => unknown` that maps known fields and spreads unknown fields through untouched.
- After migration, the result is validated; the migrated document is re-saved with the current `schemaVersion` at the next save trigger (not eagerly, to avoid write-on-boot).
- Migration unit tests are mandatory per version bump: fixture of every historical version → current (tests/unit, per plan.md test strategy).

## 4. Corruption Handling (FR-021)

Trigger: JSON parse failure, schema validation failure after migration, or version newer than the app understands.

1. **Partial restore** — salvage readable items in priority order:
   1. `upgrades` + `coins` (paid-for value — highest priority)
   2. `progress` (level clears / best stars)
   3. `settings`
   Each sub-tree is validated independently; unreadable sub-trees fall back to initial values.
2. Only if nothing at all is salvageable → initialize to the fresh state **WITH an explicit "progress could not be restored" user notification**. Silent resets are forbidden.
3. The salvaged/initialized state is committed via the normal atomic write, replacing the corrupt payload.

## 5. Save Triggers (BR-010 — automatic, no manual save UI)

| Trigger | When |
|---|---|
| Level end | clear or fail confirmation (after rewards credited on clear) |
| Purchase | immediately after balance deduction + level increment |
| Settings change | immediately on toggle / after progress reset completes |

Force-kill at any moment restores to the most recent completed trigger (NFR-007: restore rate 100%).

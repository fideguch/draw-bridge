# Contract: Level JSON Schema

**Gate 0 source of truth.** Runtime types + validation live in `src/engine/level/LevelSchema.ts`; `scripts/gates/gate0-schema.mjs` imports the same module (single definition, FR-026). Coordinates: world meters, y-up. Keys: camelCase (conventions §3). `schemaVersion` current = **1**.

## 1. JSON Schema (draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://inkbridge.dev/schemas/level-v1.json",
  "title": "InkBridge Level (schemaVersion 1)",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion", "id", "terrain", "vehicleSpawn", "goalFlag",
    "killY", "inkBudget", "starThresholds", "coins", "gimmickTags",
    "ghostSolutions"
  ],
  "properties": {
    "schemaVersion": { "type": "integer", "const": 1 },
    "id": { "type": "string", "pattern": "^ch1-(l(0[1-9]|1[0-5])|b[1-3])$" },
    "terrain": {
      "type": "array", "minItems": 1,
      "items": { "$ref": "#/$defs/polyline" }
    },
    "vehicleSpawn": { "$ref": "#/$defs/point" },
    "goalFlag": { "$ref": "#/$defs/rect" },
    "killY": { "type": "number" },
    "inkBudget": { "type": "number", "exclusiveMinimum": 0 },
    "starThresholds": {
      "type": "object", "additionalProperties": false,
      "required": ["star2", "star3"],
      "properties": {
        "star2": { "type": "number", "exclusiveMinimum": 0 },
        "star3": { "type": "number", "exclusiveMinimum": 0 }
      }
    },
    "coins": { "type": "array", "items": { "$ref": "#/$defs/point" } },
    "gimmickTags": {
      "type": "array",
      "items": { "type": "string", "enum": ["anti-dominant"] },
      "uniqueItems": true
    },
    "ghostSolutions": {
      "type": "array", "minItems": 1,
      "items": { "$ref": "#/$defs/ghostSolution" }
    },
    "maxTicks": { "type": "integer", "minimum": 60 },
    "bonusMultiplier": { "type": "number", "minimum": 5, "maximum": 10 }
  },
  "if": { "properties": { "id": { "pattern": "^ch1-b[1-3]$" } } },
  "then": { "required": ["bonusMultiplier"] },
  "else": { "not": { "required": ["bonusMultiplier"] } },
  "$defs": {
    "point": {
      "type": "object", "additionalProperties": false,
      "required": ["x", "y"],
      "properties": { "x": { "type": "number" }, "y": { "type": "number" } }
    },
    "polyline": {
      "type": "array", "minItems": 2,
      "items": {
        "type": "array", "prefixItems": [{ "type": "number" }, { "type": "number" }],
        "minItems": 2, "maxItems": 2
      }
    },
    "rect": {
      "type": "object", "additionalProperties": false,
      "required": ["x", "y", "width", "height"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number", "exclusiveMinimum": 0 },
        "height": { "type": "number", "exclusiveMinimum": 0 }
      }
    },
    "ghostSolution": {
      "type": "object", "additionalProperties": false,
      "required": ["kind", "stroke", "sampleEveryTicks", "samples", "result"],
      "properties": {
        "kind": { "type": "string", "enum": ["any", "3star"] },
        "stroke": { "$ref": "#/$defs/polyline" },
        "sampleEveryTicks": { "type": "integer", "minimum": 1 },
        "samples": {
          "type": "array", "minItems": 1,
          "items": {
            "type": "object", "additionalProperties": false,
            "required": ["t", "x", "y"],
            "properties": {
              "t": { "type": "integer", "minimum": 0 },
              "x": { "type": "number" },
              "y": { "type": "number" }
            }
          }
        },
        "result": {
          "type": "object", "additionalProperties": false,
          "required": ["outcome", "ticks", "finalPos", "inkConsumed", "starRating"],
          "properties": {
            "outcome": { "type": "string", "const": "clear" },
            "ticks": { "type": "integer", "minimum": 1 },
            "finalPos": { "$ref": "#/$defs/point" },
            "inkConsumed": { "type": "number", "exclusiveMinimum": 0 },
            "starRating": { "type": "integer", "enum": [1, 2, 3] }
          }
        }
      }
    }
  }
}
```

## 2. Field Reference

| Field | Type | Req | Constraints | Source FR |
|---|---|---|---|---|
| `schemaVersion` | int | yes | const 1 (this version); loader forward-migrates older files | FR-015 |
| `id` | string | yes | `ch1-l01`..`ch1-l15` / `ch1-b1`..`ch1-b3`; must equal filename stem (Gate 0 code check) | FR-015 |
| `terrain` | polyline[] | yes | ≥ 1 polyline, each ≥ 2 `[x,y]` points; becomes static chain shapes; vertex order = collision top-side winding | FR-015 |
| `vehicleSpawn` | point | yes | chassis center; must rest above terrain (Gate 1 raycast) | FR-005, FR-015 |
| `goalFlag` | rect | yes | judgement rectangle (`x`,`y` = bottom-left, y-up); clear when VehicleReferencePoint enters | FR-007, FR-015 |
| `killY` | number | yes | fall boundary; code check: `killY < min(terrain y)` | FR-008, FR-015 |
| `inkBudget` | number | yes | > 0 (Gate 1); meters of stroke at Lv0; Lv0 must suffice to clear (BR-004, proven by Gate 2) | FR-002, FR-015 |
| `starThresholds.star2/star3` | number | yes | code check: `0 < star3 < star2 <= inkBudget`; consumption ≤ star3 → 3★, ≤ star2 → 2★, else 1★ | FR-007 |
| `coins` | point[] | yes | may be empty; guidance 5–10/level, 1 coin each, arch/rhythm placement ~0.15 s spacing | FR-009 |
| `gimmickTags` | string[] | yes | v1 vocabulary: `anti-dominant` (Gate 3 target; Ch1: L8/L10/L12/L14/L15) | FR-026 |
| `ghostSolutions` | array | yes | ≥ 1; recorded at Lv0 by editor test play; save without one is refused | FR-015, FR-024 |
| `ghostSolutions[].kind` | enum | yes | `any` \| `3star`; `3star` asserts `result.inkConsumed <= star3` in Gate 2 | FR-026 |
| `ghostSolutions[].stroke` | polyline | yes | committed stroke (world m); zero run-phase input ⇒ level + stroke determines the run | FR-026 |
| `ghostSolutions[].samples` | array | yes | VehicleReferencePoint position samples, **position-sample playback, never input replay** | FR-026 |
| `ghostSolutions[].result` | object | yes | outcome/ticks/finalPos/inkConsumed/starRating — Gate 2 tolerance anchor (ε = 0.05 m, ±30 ticks) | FR-026 |
| `maxTicks` | int | no | overrides `fail.maxTicksDefault` (1800) | FR-008 |
| `bonusMultiplier` | number | bonus only | 5–10 (initial 6 ⇒ 150 coins); required iff bonus id, forbidden otherwise (schema if/then) | FR-009 |

**Beyond-schema Gate 0 code checks** (same module, not expressible in JSON Schema): filename ↔ `id` match; `killY < min(terrain y)`; `star3 < star2 <= inkBudget`; all numbers finite (no NaN/Infinity — JSON parse already rejects, guarded for programmatic construction); ghost `samples` last entry consistent with `result.finalPos` and `result.ticks`.

## 3. Minimal Example Level

```json
{
  "schemaVersion": 1,
  "id": "ch1-l01",
  "terrain": [
    [[-10, 0], [-2, 0], [-1.6, -5]],
    [[1.6, -5], [2, 0], [14, 0]]
  ],
  "vehicleSpawn": { "x": -8, "y": 0.6 },
  "goalFlag": { "x": 10, "y": 0, "width": 1.5, "height": 2.5 },
  "killY": -7,
  "inkBudget": 18,
  "starThresholds": { "star2": 12, "star3": 8 },
  "coins": [
    { "x": -1, "y": 1.0 },
    { "x": 0, "y": 1.4 },
    { "x": 1, "y": 1.0 }
  ],
  "gimmickTags": [],
  "ghostSolutions": [
    {
      "kind": "any",
      "stroke": [[-2.4, 0.2], [-1.2, -0.1], [0, -0.25], [1.2, -0.1], [2.4, 0.2]],
      "sampleEveryTicks": 10,
      "samples": [
        { "t": 0, "x": -8.0, "y": 0.6 },
        { "t": 150, "x": -0.2, "y": 0.4 },
        { "t": 300, "x": 10.4, "y": 0.9 }
      ],
      "result": {
        "outcome": "clear",
        "ticks": 300,
        "finalPos": { "x": 10.4, "y": 0.9 },
        "inkConsumed": 9.6,
        "starRating": 2
      }
    }
  ]
}
```

## 4. Versioning Rules

- Additive fields require a `schemaVersion` bump plus a forward migration in `LevelLoader` (older bundled files are migrated at load; Gate 0 validates against the version declared in the file, then migrates and re-validates against current).
- `additionalProperties: false` is deliberate: levels are first-party content, so unknown keys are authoring errors, not forward-compat data (contrast with SaveData, which preserves unknown fields).
- Removing/renaming fields is forbidden within a major chapter release; Gate 2 ghosts must be re-verified after any migration.

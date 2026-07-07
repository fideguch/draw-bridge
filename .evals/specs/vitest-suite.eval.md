# Eval 設計書: vitest-suite

> `.evals/specs/vitest-suite.eval.md`。taxonomy T1 / T2 / T3 から起こす。

## 概要 (Overview)

- 何を測るか: `npx vitest run`（320+ unit/contract テスト）が全緑、かつ `src/engine/` の
  カバレッジ閾値（lines ≥ 80%）を満たすこと。port quirk・contract 値・物理の regression を内包。
- なぜ重要か: engine は Phaser-free の headless SUT。ここが T1（port quirk 回帰）・
  T2（契約値/境界/event tick）・T3（物理判定）の**恒久 regression ガード**。契約テストが
  drift を機械検出する唯一の層。

## 分類 (Classification)

- type: `regression`（100% を維持）
- track: `A`
- 由来する失敗カテゴリ: **T1**（slot guard, wheel-wake, winding の各 regression test）,
  **T2**（stress `>` 境界, segment clamp `[2,32]`, launchReleased tick の契約テスト）, **T3**（stress/break/judge）

## 成功基準 (Success Criteria)

- [x] 客観的（exit code + coverage 閾値）。
- 基準:
  1. `npx vitest run` **exit 0**（全 spec green）。
  2. `src/engine/` lines coverage **≥ 80%**（constitution / criteria AC-1；実測 96.49%, progress 2C）。
  3. **負の対照を内包**: `tests/contract/gate3.spec.ts`（空虚 bot が落ちる = dominance 有効）、
     `tests/unit/determinism.spec.ts`（25-run 等価）。
- reference solution: `tests/unit/**`, `tests/contract/**`。

## データセット (Dataset)

- file: `.evals/datasets/golden.jsonl`（records `vitest-suite`, `vitest-determinism-spec`）

## Grader

| assertion id | type | logic | threshold | gate? |
|--------------|------|-------|-----------|-------|
| A1 vitest-suite | **code** | `npx vitest run` exit 0 | — | yes |
| A2 engine-coverage | **code** | `vitest run --coverage` engine lines ≥ 0.80 | 0.80 | yes |

> deterministic。LLM judge 不要 → Phase 3 スキップ正当。

## メトリクス (Metrics)

- reliability: `pass^k`。カバレッジは point-in-time 閾値ゲート。

## 注記（並行エージェント）

- ⚠️ `src/engine/GameSimulation.ts`・`src/render/scenes/**`・`levels/**` は他エージェントが編集中。
  full-suite の一時的 red は本 eval の deliverable ではなく並行状態のノイズであり得る（台帳の指示どおり）。
  regression baseline は decisions.md の "green" 状態（suite 320/320, commit 02635d4/b406424）を基準に受理。

## 次のステップ (Next Steps)

- [x] check matrix に記載済み。judge 不要。

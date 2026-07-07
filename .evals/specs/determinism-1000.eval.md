# Eval 設計書: determinism-1000

> `.evals/specs/determinism-1000.eval.md`。taxonomy T1 / T3 から起こす。

## 概要 (Overview)

- 何を測るか: 同一 level+stroke を 1000 回・クロスプロセスで headless 実行し、
  state hash が 100% 一致すること（`npm run spike:determinism`, 期待 hash `1e090a5c`）。
  併せて engine 単体の 25-run state-hash equality（`tests/unit/determinism.spec.ts`）。
- なぜ重要か: 決定論は Gate 2（ghost replay, ±30 tick / 0.05m band）と replay/star 判定の土台。
  bit-determinism が崩れると physics tuning の再現性（T3 の校正証拠）と Gate 2 が同時に無効化される。

## 分類 (Classification)

- type: `regression`（100% を維持）
- track: `A`
- 由来する失敗カテゴリ: **T1**（vendor-port — 特に recycled-slot determinism, decisions C1）, **T3**（tuning 校正の再現性）

## 成功基準 (Success Criteria)

- [x] 客観的（hash 一致 / exit code）。
- 基準: `npm run spike:determinism` が **exit 0** かつ 1000/1000 identical、state hash == **`1e090a5c`**（fresh-slot 決定論、reset 未使用、S3 1000-run 証明, research.md R10）。
- reference solution: `scripts/spike/determinism.ts` + `tests/unit/determinism.spec.ts`。

## データセット (Dataset)

- file: `.evals/datasets/golden.jsonl`（records `determinism-1000`, `vitest-determinism-spec`）

## Grader

| assertion id | type | logic | threshold | gate? |
|--------------|------|-------|-----------|-------|
| A1 determinism-1000 | **code** | exit 0 AND stdout に `1e090a5c` AND 1000/1000 | hash 完全一致 | yes |
| A2 determinism-spec | **code** | `npx vitest run tests/unit/determinism.spec.ts` exit 0（25-run 等価） | — | yes |

> deterministic。LLM judge 不要 → Phase 3 スキップ正当。

## メトリクス (Metrics)

- reliability: `pass^k`（k=1000 の consistency を 1 run で内包）。CI 実行時間 ~36s（許容内）。

## トレース/再現 (Track B のみ)

- N/A（Track A）。

## 次のステップ (Next Steps)

- [x] check matrix に記載済み。tuning 再校正時は期待 hash を human-gate で更新（baseline 受理と同様）。

# Eval 設計書: gates-exit-0

> `.evals/specs/gates-exit-0.eval.md`。1 ファイル = 1 評価対象。
> taxonomy 上位（T4 vacuous / T2 contract-drift / T3 physics-regression）から起こす。

## 概要 (Overview)

- 何を測るか: Gate 0-3 レベル検証パイプライン（`npm run gates`, NDJSON, exit 0/1/2）が
  同梱レベル全件に対して exit 0 で通り、かつ Gate 3 の anti-dominance bot が**空虚に pass しない**こと。
- なぜ重要か: レベルはコードではなく JSON データ。壊れたレベル / 空虚な dominance 判定が
  出荷されると「解けないレベル」「星が壊れる」= 直接プレイ体験を毀損（SC-004: 18/18 × 4 gates = 100%）。

## 分類 (Classification)

- type: `regression`（100% を維持する。飽和済み capability から昇格）
- track: `A`（output/artifact — 決定論的なプロジェクトコード）
- 由来する失敗カテゴリ: **T4**（vacuous verification）, **T2**（contract-implementation drift）, **T3**（physics-tuning regression, Gate 2 ghost replay 経由）

## 成功基準 (Success Criteria — measurable & unambiguous)

- [x] 2 人のレビュアーが独立に同じ pass/fail に到達できる（exit code は客観的）。
- 基準:
  1. `npm run gates`（`levels/*.json` 全件、`levels/` 空なら `tests/fixtures/gate-levels/*.json`）が **exit 0**。
  2. **負の対照**: anti-dominant fixture（`ch1-l08`, +2m rise）に対し straight-line/rim-to-rim（overlap=0）bot は Gate 3 で **exit 1**（dominance violation を検出）。overlap 校正 {0,1,2}m は contract §5 の "calibratable" 条項準拠。
- reference solution: `scripts/gates/gate3-antidominant.ts` + `tests/contract/gate3.spec.ts`（恒久 regression）。

## データセット (Dataset)

- file: `.evals/datasets/golden.jsonl`（check matrix。records `gates-exit-0`, `gate3-negative-control`）
- 構成: golden(real) 2 / from_traces 0 / synthetic 0

## Grader（cost hierarchy: code → rule → model → human）

| assertion id | type | logic | threshold | gate? |
|--------------|------|-------|-----------|-------|
| A1 gates-exit-0 | **code** | exit code of `npm run gates` == 0 | — | yes |
| A2 gate3-negative-control | **code** | Gate 3 on anti-dominant fixture exits 1 (violations>0) | — | yes |

> すべて deterministic。LLM judge 不要（合否は exit code で客観的）。→ Phase 3 は正当にスキップ。

## メトリクス (Metrics)

- reliability: `pass^k`（regression-critical。exit code は決定論なので k=1 で十分）。
- 非決定 assertion なし → `mean − k·stddev` の分散ゲートは不要。

## 次のステップ (Next Steps)

- [x] dataset（check matrix）に記載済み。
- [x] judge 不要（deterministic）。
- [ ] `levels/` が 18 レベル揃い次第 `npm run gates` を全件で回す（現状 fixture + 進行中の levels/）。AC-7 参照。

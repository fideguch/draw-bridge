# Eval 設計書: bundle-budget

> `.evals/specs/bundle-budget.eval.md`。build 健全性 + T2（no-SDK 契約）から起こす。

## 概要 (Overview)

- 何を測るか: `npm run build`（`tsc --noEmit && vite build`）が exit 0 で通り、
  生成 bundle が gzip **≤ 5MB** に収まること（criteria AC-8）。
- なぜ重要か: 型健全性（tsc）+ サイズ予算はデバイス出荷の下限。no ad/analytics SDK（constitution）を
  bundle サイズが間接的に守る（T2 の契約: v1.0 は SDK を bundle しない）。

## 分類 (Classification)

- type: `regression`
- track: `A`
- 由来する失敗カテゴリ: build 健全性 / **T2**（no-SDK 契約の間接ガード）

## 成功基準 (Success Criteria)

- [x] 客観的（exit code + サイズ数値）。
- 基準: `npm run build` **exit 0** かつ `dist/` の gzip 合計 ≤ 5,242,880 bytes（5MB）。
  参考実測: 393KB gzip（progress, Screens T069-T072）→ 予算に対し十分な余裕。
- reference solution: `vite.config.ts`（build 設定）。

## データセット (Dataset)

- file: `.evals/datasets/golden.jsonl`（record `bundle-budget`）

## Grader

| assertion id | type | logic | threshold | gate? |
|--------------|------|-------|-----------|-------|
| A1 build-exit-0 | **code** | `npm run build` exit 0（tsc + vite） | — | yes |
| A2 bundle-size | **code** | Σ gzip(dist/**/*.js,css) ≤ 5 MB | 5,242,880 B | yes |

> deterministic。LLM judge 不要 → Phase 3 スキップ正当。

## メトリクス (Metrics)

- reliability: `pass^k`。サイズは point-in-time 予算ゲート。

## 注記（並行エージェント）

- ⚠️ `src/render/scenes/**` を composition agent が編集中 → tsc が一時的に赤い可能性あり
  （台帳指示: 「full-suite verification は transient state を示し得る」）。build の deliverable は
  本 eval の wiring であって、並行編集中のツリーを緑にすることではない。

## 次のステップ (Next Steps)

- [x] check matrix に記載済み。judge 不要。

# Eval 設計書: tempo-contracts (E2E)

> `.evals/specs/tempo-contracts.eval.md`。taxonomy T6 から起こす。
> **STATUS: PENDING / UNVALIDATED** — composition（T045/T049 PlayScene）進行中。CI ゲート対象外。

## 概要 (Overview)

- 何を測るか: Playwright の tempo contracts（`npm run e2e`）— 実ポインタ描画で L1 クリア ≤25s、
  retry ≤1s、input→visual ≤100ms probe（`tests/e2e/l1-clear.spec.ts`, `meta-flow.spec.ts`）。
- なぜ重要か: KPI-003/KPI-004 の tempo（テンポ）と T6（device/toolchain 前提）を実行環境で固定する。

## 分類 (Classification)

- type: `regression`（将来。現時点は capability 検収前）
- track: `A`（output — ただし real browser 実行が必要）
- 由来する失敗カテゴリ: **T6**（Playwright device descriptor が webkit にフォールバック →
  chromium mobile emulation に切替済み。実 Safari は gatekeeper 手動ステップ）

## 成功基準 (Success Criteria)

- [ ] `npm run e2e` **exit 0**（L1 clear ≤25s AND retry ≤1s AND input→visual ≤100ms）。
- reference solution: `.fable/playscene-composition-spec.md`（composition が満たすべき契約）。

## STATUS 根拠（なぜ PENDING / UNVALIDATED）

- composition agent が `PlayScene`（T045/T049）を実装中。E2E は test-first で先行コミット済み
  （f4529b8, fc8e9dd, f7e61db）だが、**まだ緑ではない**（criteria AC-4/AC-8 = `passes:false`）。
- device WebView 実測（60fps p95 ≤4ms, AC-9）は **gatekeeper の手動ステップ**（自動 eval では測れない）。
- したがって本 eval は **advisory-only**。CI の regression ゲートに**含めない**（`eval-on-change.yml` / `ci.yml`
  の e2e は commented のまま）。composition landing 後に `PENDING` → `regression` へ昇格し baseline を human-gate で受理する。

## Grader

| assertion id | type | logic | threshold | gate? |
|--------------|------|-------|-----------|-------|
| A1 e2e-tempo | **code** | `npm run e2e` exit 0 | — | **no（PENDING まで）** |

> deterministic grader（exit code）。LLM judge 不要。ただし SUT（composition）未完のため gate せず。

## メトリクス (Metrics)

- reliability: `pass@k`（capability 段階）→ 飽和後 `pass^k` で regression 昇格。

## 次のステップ (Next Steps)

- [ ] composition landing → `npm run e2e` 緑を確認 → status を `VALIDATED`/`regression` に更新。
- [ ] `eval-on-change.yml` / `ci.yml` の e2e ジョブを有効化（webkit ではなく chromium で）。
- [ ] device 実測は gatekeeper evidence として別途記録（自動化しない）。

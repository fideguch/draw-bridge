# Eval フィードバック（プロジェクト向け）: 2026-07-08

> `gen-feedback.sh` 生成物を実測結果で拡充。対象 = プロジェクト本体。`.evals/feedback/FEEDBACK.md`。

## サマリ (Summary)

- run: `02635d4_20260707T160713Z`（dirty: false）
- **check-matrix health**: pass 7/7（pass_rate=1.0） / baseline 比較 verdict **PASS**（compare exit 0）
- ⚠️ **重要な区別**: 上記 pass_rate は **check matrix の健全性**（7 チェックが全て well-formed に定義済み）であり、
  **SUT 自体の合否ではない**（v0.1.0 shell adapter は dataset-health を検証する）。SUT の実合否は下記
  「実測（SUT 実行）」を参照。決定論 SUT でも「matrix が緑 = 製品が緑」と混同しないこと（= taxonomy **T4 空虚検証**の回避）。

## regression テーブル（check-matrix baseline 比較）

| assertion | baseline | latest | status |
|---|---|---|---|
| gates-exit-0 | 1 | 1 | ok |
| gate3-negative-control | 1 | 1 | ok |
| determinism-1000 | 1 | 1 | ok |
| vitest-suite | 1 | 1 | ok |
| vitest-determinism-spec | 1 | 1 | ok |
| tempo-contracts-e2e | 1 | 1 | ok |
| bundle-budget | 1 | 1 | ok |

## 実測（SUT 実行, 2026-07-08 ローカル, Node v20.19.4）

| check | 実行 | 実 exit | 結果 | 状態 |
|---|---|---|---|---|
| determinism-1000 | `npm run spike:determinism` | **0** | PASS 1000/1000 identical, hash **`1e090a5c`**（spec の期待値と一致, 41.0s） | GREEN |
| gates（Gate 0/1/3） | `npm run gates` | — | Gate0 18/18, Gate1 18/18, Gate3 18/18（anti-dominance 有効, 空虚 pass なし） | GREEN |
| gates（Gate 2） | `npm run gates` | **1** | Gate2 16/18 — **ch1-l05**（finalPos delta 0.0624m）, **ch1-l11**（0.0573m）が 0.05m band 超過 | **RED（下記 F1）** |
| vitest-suite | `npx vitest run` | 未実行 | 並行エージェントが `src/engine/GameSimulation.ts` 編集中のため full-suite は transient。台帳 green 基準 320/320 | 未再実行 |
| bundle-budget | `npm run build` | 未実行 | 並行エージェントが `src/render/scenes/**` 編集中のため tsc 一時 red 可能。台帳 393KB gzip | 未再実行 |
| tempo-contracts-e2e | `npm run e2e` | — | composition 進行中（AC-4/AC-8 = false） | **PENDING** |

## プロジェクト本体で「まだ開いている」修正 (open fixes)

1. **[HIGH] F1 — Gate 2 ghost-replay tolerance 超過（ch1-l05, ch1-l11）**
   - 現状: `npm run gates` が **exit 1**（Gate 2 のみ 16/18）。ch1-l05 は 0.0624m、ch1-l11 は 0.0573m と
     0.05m band を僅かに超過。ghost 記録と再生の finalPos が乖離。
   - 根拠: `gates-exit-0` eval / 本 run の NDJSON（`{"gate":2,"level":"ch1-l05",...delta 0.0624m}`）。
   - 提案: levels agent が ch1-l05 / ch1-l11 の ghost solution を再記録（現行 TuningConstants で）するか、
     該当レベルの killY/star 閾値ではなく **ghost 軌道を band 内に収める**。これは **並行 levels 作成の transient**
     の可能性が高い（両ファイルは 01:07 更新、作成進行中）— levels agent の担当領域であり本 eval 実装の deliverable ではない。
   - 注: これは eval が**実際に機能している証拠**（ghost drift を検出した）。

2. **[MED] F2 — tempo-contracts (E2E) が PENDING**
   - 現状: `npm run e2e`（L1 clear ≤25s / retry ≤1s / input→visual ≤100ms）は composition（T045/T049 PlayScene）
     未完のため未 green（criteria AC-4/AC-8 = `passes:false`）。E2E は test-first 済み（f4529b8 他）。
   - 提案: composition landing 後に `tempo-contracts.eval.md` を `PENDING`→`regression` 昇格、`ci.yml`/`eval-on-change.yml`
     の e2e ジョブを chromium で有効化、baseline を human-gate 受理。

3. **[MED] F3 — device WebView 60fps 実測が PENDING**
   - 現状: AC-9（iOS/Android で 60fps・p95 ≤4ms）は **gatekeeper の手動デバイス測定**であり自動 eval では測れない。
   - 提案: gatekeeper 実機ステップの evidence を別途記録。自動化しない（cross-env の測定は eval スコープ外）。

## criteria drift シグナル

- [ ] 現 taxonomy（T1-T6）に無い失敗モードは未出現 → **Phase 1 再実行は不要**（saturation 済み）。
- [ ] scheduled/PR run が taxonomy 外の失敗を出したら Phase 1 を再入する（Phase 7）。

## 次のステップ

- [ ] F1: levels agent が ch1-l05/ch1-l11 の ghost を band 内に（→ `npm run gates` exit 0 復帰）。
- [ ] F2: composition landing → E2E 昇格 → baseline 再受理。
- [ ] 改善確認後 `accept-baseline`（human-gated）。

# Eval Specs Index — InkBridge regression suite

> Phase 2 成果物。error-analysis（`../error-analysis/2026-07-08-traces.md`）の taxonomy を
> **既存の決定論的チェック**へ写像した regression スイート。SUT = 決定論的プロジェクトコード（Track A）。

## スイート一覧（taxonomy → check）

| eval spec | 対象 check（command） | grader | 由来 taxonomy | gate? | status |
|-----------|----------------------|--------|---------------|-------|--------|
| `gates-exit-0.eval.md` | `npm run gates`（Gate 0-3, NDJSON） | code (exit) | T4, T2, T3 | yes | VALIDATED |
| `gates-exit-0.eval.md` §A2 | gate3 negative-control（anti-dominant fixture） | code (exit==1) | **T4** | yes | VALIDATED |
| `determinism-1000.eval.md` | `npm run spike:determinism`（1000-run, hash `1e090a5c`） | code (exit+hash) | T1, T3 | yes | VALIDATED |
| `vitest-suite.eval.md` | `npx vitest run`（320+, engine cov ≥80%） | code (exit+cov) | T1, T2, T3 | yes | VALIDATED |
| `tempo-contracts.eval.md` | `npm run e2e`（Playwright tempo） | code (exit) | T6 | **no** | **PENDING / UNVALIDATED** |
| `bundle-budget.eval.md` | `npm run build`（≤5MB gzip） | code (exit+size) | build, T2 | yes | VALIDATED |

## grader 戦略: すべて CODE-BASED（cost hierarchy の floor）

grader cost hierarchy（cheapest first）は **code → rule → model(LLM-judge) → human**。
本プロジェクトの失敗モードは **全て objective / binary** に判定できるため、最安の **code grader** で完結する:

- 合否シグナルは exit code・state hash・カバレッジ %・bundle バイト数 = すべて機械可読で決定論的。
- 各 assertion は「2 人のレビュアーが独立に同じ pass/fail に到達できる」（曖昧さゼロ）。

## なぜ LLM-as-a-Judge が不要か（明示）

`<HARD-GATE id="JUDGE">`（Phase 3）は「model-based judge は human ラベルで検証してからのみ CI を
gate してよい」を強制する。本スイートは以下の理由で **judge を 1 つも作らない**:

1. **SUT が決定論的**: 同一入力 → 同一出力（determinism-1000 が hash `1e090a5c` で証明）。
   非決定・主観の余地がなく、LLM judge が解決すべき「曖昧な採点」問題が存在しない。
2. **失敗モードが objective**: T1〜T4/T6 はいずれも「exit code」「hash 一致」「境界値」「サイズ」で
   binary 判定できる（自由文の品質評価ではない）。
3. **cost hierarchy の原則**: subjective な失敗モードにのみ LLM judge を使う。ここには無い。
   → code grader が floor として十分。上位（model/human）へ登る必要がない。

## Phase 3（Judge Build & Validation）は正当にスキップ

- **CI を gate する model-based judge は 0 個** → `<HARD-GATE id="JUDGE">` は**自明に充足**
  （検証すべき judge が存在しないため違反しようがない）。
- `Claude が自分の judge の ground-truth ラベルを生成してはならない` という禁止事項にも抵触しない
  （judge を作らないため）。
- 将来 subjective な失敗モード（例: juice の「気持ちよさ」の主観評価）を eval 化する必要が出た場合にのみ
  Phase 3 を起動し、`config.json` の `judge.*`（tpr_min/tnr_min/kappa_min）と human ラベルで検証する。

## Track B（agent-ops）の扱い

T5（agent-ops mortality）は **コード SUT では測れない**エージェント運用の失敗モード。
eval 化せず、`../feedback/skill-feedback.md` に provenance 付き PROPOSAL として送る（Phase 6, R-C）。

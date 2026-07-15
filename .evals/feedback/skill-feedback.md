# Eval フィードバック（駆動スキル/エージェント向け）: 2026-07-08

> 対象 = このプロジェクトを駆動するスキル/エージェントの**行動**（Track B）。
> `<HARD-GATE id="FEEDBACK">`: **提案のみ・自動編集禁止・provenance 必須・project-local 既定**。
> `~/.claude` への変更は `--global` 指定時のみ（本ファイルは行わない）。

## 対象 (Scope)

- monitored skills（config.json）: `forge_ace`, `gatekeeper`, `claude-to-codex`, `fable-for-opus`, `specs-evals`
- scope: **project-local**（`.evals/feedback/` 内に留める）。
- 由来 taxonomy: **T5 agent-ops mortality**（コード SUT では測れない、無人自律運用の失敗モード）。
- trace source（Track B, 実データ）: `.fable/progress.md`, `.fable/decisions.md`, `git log`（合成なし）。

## 失敗の帰属 (Attribution — evidence schema)

> confidence < `attribution_confidence_min`(0.6) は `unknown` とし、hard patch を提案しない（advisory に留める）。

### 失敗 EA-2026-07-08-001 — サブエージェントの無通知死（credit 枯渇, commit 直前）

```json
{
  "failure_id": "EA-2026-07-08-001",
  "active_skills": ["fable-for-opus", "forge_ace"],
  "loaded_instructions": ["fable-for-opus autonomous long-run", "forge_ace Writer chunk"],
  "transcript_ref": ".fable/progress.md 'Phase 3 (T035-T037) ... spike agent died pre-commit at ~23:34, remainder collected+verified by main loop'",
  "tool_calls": ["(spike agent) Write scripts/spike/*", "commit (未達)"],
  "observed_violation": "自律 spike サブエージェントが commit 直前に credit 枯渇で停止。無通知。main loop は file mtime + ps 突合で事後検出",
  "alternative_causes": ["外部 credit 枯渇（スキル指示ではない）", "ネットワーク断"],
  "confidence": 0.50
}
```

- **判定: confidence 0.50 < 0.6 → `unknown`（特定スキル指示の bug とは断定しない）**。根本原因は外部（credit）で、
  スキル指示の欠陥への帰属は不確実。ただし**「検出可能性の欠如」はプロセス設計課題**として advisory 提案する（下記 提案 1）。

### 失敗 EA-2026-07-08-002 — 並行エージェントの tsc ノイズが post-edit フックをブロック

```json
{
  "failure_id": "EA-2026-07-08-002",
  "active_skills": ["forge_ace"],
  "loaded_instructions": ["post-edit typecheck hook"],
  "transcript_ref": "task ledger item 5; 本 eval run で再現（並行 src/render/scenes 編集中に build/vitest が transient red）",
  "tool_calls": ["Edit(src/**)", "Bash(tsc)"],
  "observed_violation": "並行エージェントの未完了編集で tsc が全ツリー red → post-edit フックが自分の変更と無関係に失敗",
  "alternative_causes": ["編集の一時的非整合（正常な並行作業）"],
  "confidence": 0.62
}
```

### 失敗 EA-2026-07-08-003 — Playwright device descriptor が未インストール webkit にフォールバック

```json
{
  "failure_id": "EA-2026-07-08-003",
  "active_skills": ["e2e-runner", "playwright-skill"],
  "loaded_instructions": ["playwright device descriptor default"],
  "transcript_ref": ".fable/progress.md '(iPhone 14 device defaults to webkit; real Safari = gatekeeper device step)'; commit 4a3de3b",
  "tool_calls": ["playwright.config device: 'iPhone 14'", "npm run e2e"],
  "observed_violation": "device 'iPhone 14' が webkit を要求するが未インストール → E2E 起動不能。chromium mobile emulation に切替で解決",
  "alternative_causes": [],
  "confidence": 0.80
}
```

## 改善提案（スキル/CLAUDE.md へのパッチ案 — 適用はユーザー判断）

### 提案 1 — fable-for-opus / forge_ace（confidence 0.50 → **advisory のみ**, hard patch にしない）

- 根拠: `EA-2026-07-08-001`。
- 意図: サブエージェント死の**検出可能性**を上げる（帰属は unknown なので指示の断定的書換えはしない）。
- advisory diff（提案・未適用）:
  ```diff
  --- a/fable-for-opus/SKILL.md (autonomous long-run)
  +++ b/fable-for-opus/SKILL.md
  @@ subagent orchestration
  + - サブエージェント委譲時は **commit-checkpoint 規律**を課す: 各 phase chunk の完了直後に
  +   小さくコミットさせ、親は子の liveness を file mtime + `ps` で検証する（無通知死の事後検出コスト削減）。
  + - 長時間 run では credit 残量の枯渇を「静かな失敗」と想定し、親ループが子の未達コミットを検出したら回収・再検証する。
  ```

### 提案 2 — forge_ace post-edit typecheck hook（confidence 0.62 → 閾値超, 提案）

- 根拠: `EA-2026-07-08-002`。本 eval run でも再現（並行編集下で full-suite が transient red）。
- project-local diff（提案・未適用）:
  ```diff
  --- a/forge_ace post-edit hook guidance
  +++ b/forge_ace post-edit hook guidance
  @@ typecheck scope
  + - 並行エージェント環境では tsc を**変更ファイル起点**にスコープする（`tsc --noEmit` 全ツリーは
  +   他エージェントの未完了編集で false-red になる）。全ツリー型チェックは quiescent 時 / CI に委ねる。
  ```

### 提案 3 — playwright-skill / e2e-runner（confidence 0.80 → 提案）

- 根拠: `EA-2026-07-08-003`, commit 4a3de3b（in-repo で既に解決済み = 確認済み lesson）。
- project-local diff（提案・未適用）:
  ```diff
  --- a/playwright.config.ts (guidance)
  +++ b/playwright.config.ts
  @@ projects
  + // device descriptor（'iPhone 14' 等）は webkit を暗黙要求する。CI に webkit が無い場合は
  + // chromium mobile emulation を明示 project に固定し、実 Safari/WebView は gatekeeper 実機ステップに回す。
  ```

## in-session（現セッションのエージェントへの直接フィードバック）

- 根本原因（T5）: 無人自律運用では「静かな失敗」（credit 死・並行編集ノイズ・env フォールバック）が最大の運用リスク。
- 次にとるべき行動: (1) 委譲は小コミット + liveness 検証、(2) 型チェックは変更スコープ、(3) E2E は browser project を明示 pin。
- evaluator-optimizer による即時修正: 実施せず（提案は本 eval の scope 外の運用改善で、コード SUT の regression ではない）。

## learnings への反映

- [x] `learnings.md` に確認済み lesson を蒸留追記（cap=50）。
- [x] 対象 `CLAUDE.md` の MANUAL ADDITIONS に `@.evals/feedback/learnings.md` の import 行を提案（Phase 6）。

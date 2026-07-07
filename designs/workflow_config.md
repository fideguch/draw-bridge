# ワークフロー設定

> [📋 目次](./README.md) | **設定** | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

> 💡 Phase 0 で生成されるワークフロー設定。本プロジェクト（InkBridge（仮）/ Draw Bridge 系 line-drawing 物理パズル、iOS + Android + Web）で実行するフェーズとスキップするフェーズを記録する。

**Mode**: **Full**

- 対象: 本番プロジェクト（商用レベル品質での出荷を前提とした MVP）
- 品質次元: 5 × 20pt = 100pt（合格ライン 70/100）
- 入力: 方針は [research/07_decision.md](../research/07_decision.md) で完全ロック済み（全10リサーチレポートの統合決定）。本実行は方針確定後の要件構築であり、対話Q&Aは行わない（DO NOT ASK 指示）。

---

## Phase Configuration / フェーズ設定

| Phase    | Name                   | Status   | Reason                                                                  |
| -------- | ---------------------- | -------- | ----------------------------------------------------------------------- |
| Phase 0  | ワークフロー設定       | **完了** | 本ファイル                                                               |
| Phase 1  | プロジェクト理解       | **完了** | 方針は research/07_decision.md でロック済み。再ヒアリング不要             |
| Phase 2  | 機能要件の抽出         | **完了** | [functional_requirements.md](./functional_requirements.md)              |
| Phase 3  | 非機能要件の抽出       | **完了** | [non_functional_requirements.md](./non_functional_requirements.md)      |
| Phase 4A | 品質スコアリング       | **完了** | 本ファイル末尾に採点を記録（5次元 × 20pt、独立2評価者 + 検証）            |
| Phase 4B | ユーザーストーリー生成 | **完了** | [user_stories.md](./user_stories.md)                                    |
| Phase 4C | ユビキタス言語定義     | **完了** | [ubiquitous_language.md](./ubiquitous_language.md)                      |
| Phase 4D | 次のステップ提案       | **完了** | speckit-bridge → plan/tasks → forge_ace（[README.md](./README.md) §次のステップ） |
| Phase 5  | UIデザイン             | **一部** | [ui_design_brief.md](./ui_design_brief.md) は作成。Figma生成は後続に延期（下記） |

### ステータスの値

- **完了**: 本実行で成果物を生成した。
- **一部**: ドキュメント（ブリーフ）は作成したが、ツール連携（Figma）は延期。

---

## Phase 5 (UIデザイン) の扱い

- **作成する**: [ui_design_brief.md](./ui_design_brief.md)（画面インベントリ・ビジュアル方針・デザイントークン・画面別レイアウト・信頼設計 P1-P7）。
- **延期する（optional / deferred）**: Figma MCP によるワイヤーフレーム・モックアップ生成。理由は以下:
  1. ゲーム画面は Phaser のプログラム描画（コード内レンダリング）が主体で、UI の最終品質は実機/ブラウザの動く物理・演出でのみ確認できる（[research/07_decision.md](../research/07_decision.md) §7）。
  2. juice 演出（軋み色変化・confetti・hit-stop 等）は静的モックで表現できず、Figma モックの価値が相対的に低い。
  3. Figma 生成は要件確定後にいつでも追加実行できる（ブリーフが入力として完成済み）。
- 再開時は `ui_design_brief.md` を入力に `/figma-generate-design` を実行する。

---

## Mode 詳細

| パラメータ       | 本プロジェクト設定（Full）                                       |
| ---------------- | ---------------------------------------------------------------- |
| 対象             | 出荷前提MVP（TypeScript / Phaser 4 + Phaser Box2D / Vite / Capacitor 8、iOS + Android + Web） |
| FR項目           | 全10項目（説明/アクター/事前条件/トリガー/主フロー/代替フロー/例外フロー/事後条件/ビジネスルール/優先度） |
| 品質次元         | 5 × 20pt = 100pt                                                 |
| 合格ライン       | 70/100                                                           |
| 自動スキップ     | なし（Phase 5 のFigma生成のみ手動延期）                           |

---

## Notes / 備考

- 本 designs/ の各仕様には [research/](../research/) の検証済み事実への参照を付す。推測による仕様確定は禁止。
- ID規約: `[FR-001](./functional_requirements.md#fr-001)`, `[NFR-001](./non_functional_requirements.md#nfr-001)`, `[US-001](./user_stories.md#us-001)`, `[SC-001](./functional_requirements.md#sc-001)`, `[UL-001](./ubiquitous_language.md#ul-001)`, `[KPI-001](./README.md#kpi-001)`（3桁ゼロ埋め・英語）。参照はすべて Markdown リンク化し、範囲表記（`〜`）は使わずカンマ区切りで列挙する。
- 商標・名称回避: 製品名は仮称 **InkBridge** とし、競合既存タイトル（"Draw Bridge Puzzle" 等）と同一の名称・アイコン・アート・UI文字列を使用しない。最終名称はストア提出フェーズで ASO 調査の上決定する。
- 数値契約: [research/07_decision.md](../research/07_decision.md) §8.1 のテンポ・性能契約（L1≤25秒 / リトライ≤1秒 / 応答≤100ms / 実機60fps）は NFR に転記し自動テスト化する。

---

## Phase 4A: 品質スコアリング記録（2026-07-07）

独立2評価者（ブラインド採点、[quality_rubric.md](~/.claude/skills/requirements_designer/references/quality_rubric.md) 準拠、信頼設計調整込み）+ 一貫性検証者1名で実施。

| 次元 | 評価者A | 評価者B |
|---|---|---|
| 網羅性 / Completeness | 20 | 19 |
| 具体性 / Specificity | 18 | 18 |
| テスト可能性 / Testability | 20 | 19 |
| 一貫性 / Consistency | 16 | 18 |
| 追跡可能性 / Traceability | 19 | 18 |
| **合計** | **93** | **92** |

- **判定: 合格**（合格ライン 70 / PRD化推奨ライン 80 の両方を超過。評価者間乖離1点で校正良好）
- 一貫性検証で検出された critical 3件（game_design.md のアンカー切れ2件・Gate 4 幻参照）・major 3件（「もう一度」ラベル揺れ・本採点記録の欠落・KPI-004 分母揺れ）・minor 4件は**全て修正適用済み**（修正14項目 + linkify-ids.js --fix で未リンクID 57件を自動リンク → 再検証 OK）。
- 採点の主な残存減点根拠（改善は実装フェーズで対応）: FR-005 発散閾値等の一部チューニング値が実機校正待ち（TuningConstants に初期値は定義済み）、目標→FR の明示マトリクスは README 目的とFRカテゴリの対応で代替。

---

[📋 目次](./README.md) | [機能要件 →](./functional_requirements.md)

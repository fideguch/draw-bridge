# InkBridge（仮） — 要件定義 INDEX

> 📋 **目次** | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

> 2026-07-07 作成。根拠は [research/07_decision.md](../research/07_decision.md)（research/ 配下の全10レポートの結論を「決定」に変換した統合意思決定ドキュメント。出典一覧は同 §10）。
> 推測による仕様確定は禁止。本 designs/ の各仕様には research/ の検証済み決定への参照を付す。

| ドキュメント | 内容 |
|---|---|
| [workflow_config.md](./workflow_config.md) | 実行モード（Full・合格ライン 70/100）・フェーズ設定（Phase 5 の Figma 生成のみ延期） |
| [game_design.md](./game_design.md) | コア体験の感情ループ・コアループ状態機械・物理モデル（セグメント化カプセルチェーン + ばね + 破断）・ジュース3場面チェックリスト・レベルデザイン文法・Ch1 15面ラフ仕様・メタ進行・チューニング表 |
| [functional_requirements.md](./functional_requirements.md) | 機能要件 26件（FR、全 Must）+ 受け入れ基準 + 画面一覧 10件（SC） |
| [non_functional_requirements.md](./non_functional_requirements.md) | 非機能要件 14件（NFR: 性能・決定論・アクセシビリティ・コンプライアンス） |
| [user_stories.md](./user_stories.md) | ユーザーストーリー（As a / I want / so that + Given-When-Then 受け入れ基準。エピック = FR カテゴリ A, B, C, D, E, F, G の7分類） |
| [ubiquitous_language.md](./ubiquitous_language.md) | ユビキタス言語（Stroke、Bridge Chain、Stress、Ghost Solution、Tempo Contract を含む用語集: 定義 / UI ラベル / コード命名 / アンチパターン） |
| [ui_design_brief.md](./ui_design_brief.md) | 画面構成・ビジュアル方針・デザイントークン |
| [ux_protocol.md](./ux_protocol.md) | UX プロトコル（テンポ契約・信頼設計パターン P1, P2, P3, P4, P5, P6, P7 の FR/NFR マッピング・フィードバック統一） |

---

## プロダクト概要

- **タイトル（仮）**: InkBridge（最終名称はストア提出時に ASO 調査で決定。競合 "Draw Bridge Puzzle" と同一の名称・アートは禁止）（[research/07_decision.md](../research/07_decision.md) §2.1）
- **ジャンル**: line-drawing 物理パズル。描いた線が橋になり、車が自動走行して審判される（タイプB「描いた物が構造物になる」×タイプA「描いた結果が動いて審判される」のハイブリッド）（[research/07_decision.md](../research/07_decision.md) §2.1）
- **プラットフォーム**: iOS 16+ / Android 10+ (API 29+) / Web（開発・配布両用）
- **スタック**: TypeScript / Phaser 4.1 + Phaser Box2D (Box2D v3) / Vite / Capacitor 8（[research/07_decision.md](../research/07_decision.md) §7.1）
- **コア体験**: 「描く（創造）→ 放つ（審判）→ 渡り切る or 崩れ落ちる（カタルシス）」。最重要価値は爽快感3場面（線を引く / 車が走り出す / ゴール）（[research/07_decision.md](../research/07_decision.md) 前提4・§4）
- **コアループ**: 1レベル 10〜30秒（演出込みループ1周 ≤ 40秒）、失敗→リトライ ≤ 1秒、想定セッション 6〜8分（[research/07_decision.md](../research/07_decision.md) §3.1・§3.5）
- **最大の差別化**: **荷重で本当にたわみ・軋み・折れる橋**（セグメント化カプセルチェーン + ばねジョイント + 破断）。市販の競合クローンは全て単一剛体で、この体験を誰も提供していない（[research/07_decision.md](../research/07_decision.md) §2.2・§7.2）
- **MVP スコープ**: Ch1 の15面 + ボーナス面、星評価、コイン、アップグレード2軸（インク量・車速 各5Lv）、juice 必須項目全部、インゲームレベルエディタ、検証ゲート CI、Capacitor シェル。広告 / IAP / 計測は**インターフェースのみ**（SDK 非同梱）（[research/07_decision.md](../research/07_decision.md) §8.1）
- **収益化前提**: 無料DL → 後日広告導入（リワード広告が主役、インタースティシャルは Level 8 クリアまで封印、広告除去 IAP $4.99）。`AdInterface` 抽象を v1.0 から設計に織り込み、実SDKだけ後刺しする（[research/07_decision.md](../research/07_decision.md) §6.1・§6.2）

---

## 目的と背景 / Background & Goals

### なぜこのプロジェクトをやるのか

- **需要は実証済み**: 直接競合 Bravestars「Draw Bridge Puzzle」は 53.5M DL、GameLord 3D 版 11.2M DL、Eureka 版 10M+ DL。2022年リリースの低予算クローンでも 1,000万DL・評価4.3前後を維持。隣接の Bridge Race は 2.5億〜5億DL（[research/07_decision.md](../research/07_decision.md) §2.1）。
- **供給は低品質**: 競合レビューの不満は「広告地獄（30秒毎・偽閉じボタン）」「直線1本で全クリできる平坦さ」「レベル使い回し」「進行消失バグ」に集中。**コンセプト自体への不満はほぼない**（5★比率72%）（[research/07_decision.md](../research/07_decision.md) §2.1）。
- **ジャンル未実装の体験で決定版を取る**: 差別化は優先順位付きの5点 — ①物理の本物感（荷重で凹み・軋み・限界で折れる橋。市販クローンは全て単一剛体）②支配戦略（直線1本）の防止 ③節度ある広告体験 ④共有適性（崩落の見世物・毎回違う「あなたの橋」= ショート動画の UA エンジン）⑤Web 配信併用（Poki / CrazyGames は draw 系の一等地）（[research/07_decision.md](../research/07_decision.md) §2.2）。
- **UA スケールを前提にしない**: サブジャンルの新規大型ヒットは2022年が最後。オーガニック（Web ポータル・SNS 動画映え）+ 高 LTV のハイブリッドカジュアル設計で小さく黒字化する構造を前提とする（[research/07_decision.md](../research/07_decision.md) §2.1・§2.3）。
- **過去2作（Stadium Rush! / Glowgrid）の欠落への回答**: 収益化・計測の実装ゼロという轍を踏まないため、v1.0 から `AdInterface` / `AnalyticsInterface` 抽象を必須スコープに入れる（[research/07_decision.md](../research/07_decision.md) §6.1・§9-9）。

### 成功の定義 / Success Metrics（KPI）

> 💡 MVP 出荷時点で測定・検証可能な定量基準のみを KPI とする。

| ID | 指標 | 目標値 | 測定方法 | 根拠・関連要件 |
|---|---|---|---|---|
| <a id="kpi-001"></a>**KPI-001** | 実機フレームレート | 60fps 維持・物理 step p95 ≤ 4ms（中級 Android 実機 = Snapdragon 6xx / Helio G 系の Capacitor WebView） | デバッグオーバーレイ + 着手週スパイク計測 | [research/07_decision.md](../research/07_decision.md) §7.3・§8.1 / [NFR-001](./non_functional_requirements.md#nfr-001) |
| <a id="kpi-002"></a>**KPI-002** | 入力応答 | タッチ→視覚反映 ≤ 100ms（線の先端は同フレーム反映） | 自動テスト + 計測 | [research/07_decision.md](../research/07_decision.md) §4.1・§8.1 / [NFR-002](./non_functional_requirements.md#nfr-002) |
| <a id="kpi-003"></a>**KPI-003** | テンポ契約 | L1 クリア ≤ 25秒 / 最初の3面 3連続成功 60〜90秒 / 失敗→リトライ ≤ 1秒 / ループ1周 ≤ 40秒 | テンポ契約自動テスト（ゴースト解リプレイ + UI 遷移計測） | [research/07_decision.md](../research/07_decision.md) §3.4・§3.5・§8.1 / [NFR-003](./non_functional_requirements.md#nfr-003) |
| <a id="kpi-004"></a>**KPI-004** | レベル品質 | 同梱15面 + ボーナス3面（計18面）が検証ゲート4段（Gate 0: JSONスキーマ / Gate 1: 静的妥当性 / Gate 2: ゴースト解リプレイ / Gate 3: 直線ボット否定）を 100% 通過。全面ゴースト解あり、anti-dominant タグ面は直線1本ボットが必ず失敗 | CI（GitHub Actions・固定 Node） | [research/07_decision.md](../research/07_decision.md) §3.3・§8.1 / [FR-026](./functional_requirements.md#fr-026)・[NFR-011](./non_functional_requirements.md#nfr-011) |
| <a id="kpi-005"></a>**KPI-005** | juice 実装率 | [research/07_decision.md](../research/07_decision.md) §4 の必須チェックリスト 100% 実装 | チェックリスト照合レビュー + デモ動画 | [research/07_decision.md](../research/07_decision.md) §4 / [FR-010](./functional_requirements.md#fr-010)・[FR-011](./functional_requirements.md#fr-011)・[FR-012](./functional_requirements.md#fr-012)・[FR-013](./functional_requirements.md#fr-013)・[FR-014](./functional_requirements.md#fr-014) |

> **市場 KPI はロードマップ項目（v1.1+）**: D1 リテンション 35〜40% / D7 12〜20% / D30 5〜7.5% / ARPDAU $0.10〜0.50 / セッション 6〜8分 は計測基盤（Firebase Analytics）導入後に測定する。v1.0（ローカル MVP）は外部ネットワーク通信ゼロのため測定対象外（[research/07_decision.md](../research/07_decision.md) §2.3・§8.2）。

---

## アクター / Actors

> 💡 本作はシングルプレイのオフラインゲーム。人間アクターは Player と Level Author（開発者）の2者。System（物理審判・検証パイプライン）は FR の主体として明示する。

| アクター | 種別 | 説明 | デバイス / 環境 |
|---|---|---|---|
| **Player（プレイヤー）** | 人間（主アクター） | 通勤・休憩の短セッションで遊ぶカジュアル層。縦持ち片手。チュートリアル文章は読まない | iPhone（iOS 16+）/ Android（10+, API 29+）縦持ち、Web ブラウザ（Chrome・Safari 最新2版） |
| **Level Author（レベル作者=開発者）** | 人間（コンテンツアクター） | インゲームエディタで地形・ギミック・インク予算を編集し、ゴースト解付きレベル JSON を量産する | Mac ブラウザ（`npm run dev`）+ 開発ビルド限定エディタ（[SC-009](./functional_requirements.md#sc-009)） |
| **System（物理審判・検証パイプライン）** | システム | 固定タイムステップ物理（1/60）で走行を決定的に審判。CI で Gate 0, Gate 1, Gate 2, Gate 3 を実行しレベル品質を保証 | アプリ内 Engine 層（ヘッドレス Node 実行可）+ CI（GitHub Actions・固定 Node） |

### 主要アクターの課題・ゴール

- **Player** → 短セッションで「描く→走る→ゴール」の爽快感を味わいたい → 既存クローンは広告地獄（30秒毎・偽閉じボタン）・「直線1本で全クリ」の平坦さ・進行消失バグで体験を毀損している（As-Is。[research/07_decision.md](../research/07_decision.md) §2.1）。
- **Player** → 説明を読まずに遊び始めたい → テキストチュートリアルは禁止し、指アイコンのなぞり誘導のみで最初の3面を 60〜90秒・3連続成功させる（[research/07_decision.md](../research/07_decision.md) §3.4 / [FR-017](./functional_requirements.md#fr-017)）。
- **Level Author** → 作った面に必ず解があることを保証してレベルを量産したい → 手作業検証では市場基準（ソフトローンチ級 300〜500面）に届かない。ゴースト解≥1本をスキーマで強制し、テンプレート×パラメータ変奏×ボット検証の3層で量産する（[research/07_decision.md](../research/07_decision.md) §3.3 / [FR-024](./functional_requirements.md#fr-024)・[FR-026](./functional_requirements.md#fr-026)）。
- **System** → 同一レベル+同一描線に対して再現可能な審判を下したい → JS ポート物理はブラウザ間ビット一致が保証されない。決定論契約を「CI 内ビット一致 + 実機許容帯」に緩和定義して解決する（[research/07_decision.md](../research/07_decision.md) §7.2 / [NFR-004](./non_functional_requirements.md#nfr-004)）。

---

## スコープと制約 / Scope & Constraints

### 今回やること / In Scope（フェーズ1: ローカルで遊べる MVP）

> ゴール: Mac ブラウザ（`npm run dev`）と手元の iOS/Android 実機（Capacitor シェル）で、**「脳汁3場面が商用級に気持ちいい」15面**が遊べる状態（[research/07_decision.md](../research/07_decision.md) §8.1）。

- **コア物理**: 描線 = セグメント化カプセルチェーン方式C（+ 単一剛体フォールバックA切替）、軋み・破断、地形 chain shape、車1台（chassis + wheel joint ×2）、固定タイムステップ 1/60（[research/07_decision.md](../research/07_decision.md) §7.2）
- **コアループ**: 描く → 発進 → ゴール/失敗 → 即リトライ（≤ 1秒）。星評価（インク消費量基準）、失敗の因果ハイライト（[research/07_decision.md](../research/07_decision.md) §3.1・§3.2）
- **レベル**: Ch1 の15面 + ボーナス面（5面毎）。ギミックは G1 静的地形 + G2 インク予算/星 + 中間支点。ノコギリ波難易度・FTUE 定石準拠。レベル JSON スキーマ（ゴースト解 ≥ 1本必須）（[research/07_decision.md](../research/07_decision.md) §3.3・§3.4）
- **Juice**: [research/07_decision.md](../research/07_decision.md) §4 の必須項目すべて（描画・発進・走行・軋み・ゴール5拍構成・ハプティクス・SFX）。推奨項目はスケジュール内で実装できたもののみ追加（必須ゲートには含めない）
- **メタ（最小）**: コイン獲得・残高、アップグレード2軸（インク量 +10%/Lv・車速 +5%/Lv、各5Lv）、ボーナス面報酬（通常の5〜10倍）（[research/07_decision.md](../research/07_decision.md) §5.1・§5.2）
- **ツール**: インゲームレベルエディタ + デバッグチューニングパネル（いずれも開発ビルド限定）（[research/07_decision.md](../research/07_decision.md) §7.3・§8.1）
- **品質ゲート**: 検証パイプライン Gate 0 / Gate 1 / Gate 2 / Gate 3 を CI（GitHub Actions・固定 Node）で全レベル・PR 毎に実行。実タップ E2E 1本（L1 を実際に描いてクリア）（[research/07_decision.md](../research/07_decision.md) §3.3・§8.1）
- **Platform 抽象**: `AdInterface` / `AnalyticsInterface` / `HapticsInterface` / `StorageInterface` + Noop 実装。**SDK は同梱しない**（[research/07_decision.md](../research/07_decision.md) §6.1）
- **ネイティブシェル**: Capacitor 8 の最小シェル（スパイク兼用。ストア提出はフェーズ外）（[research/07_decision.md](../research/07_decision.md) §8.1）

### 今回やらないこと / Out of Scope

- 広告 SDK 実装（AdMob）・UMP/ATT・IAP（広告除去・コインパック）
- Firebase 計測 / Remote Config / A/B テスト
- 車両コレクション・橋素材アンロック・オフライン収益・デイリーカレンダー
- レビュー誘導・フィードバックリンク（信頼設計 P7 Feedback Loop）
- Ch2 以降のギミック（G3, G4, G5, G6, G7, G8, G9, G10, G11, G12）と追加面
- Web ポータル提出（CrazyGames / Poki）・CPI テスト
- ストア資産（アイコン・スクリーンショット・メタデータ・RELEASE runbook）とストア提出
- UGC ステージ・AI 採点・リアルタイム対戦

### 保留・却下スコープ / Deferred & Rejected Scope

> Rejected ではなく Phase 指定で保留するものを含む（[research/07_decision.md](../research/07_decision.md) §8.2）。後から同じ議論を繰り返さないため理由を付記する。

| 項目 | 保留・却下理由 | Phase |
|---|---|---|
| 広告SDK実装（AdMob）・UMP/ATT | 前提「無料DL→後日広告導入」。枠（`AdInterface`）は v1.0 で設計済みのため後刺しが低コスト（[research/07_decision.md](../research/07_decision.md) §6.1） | v1.1（広告導入時） |
| IAP（広告除去 $4.99・コインパック） | 広告導入とセットで実装（[research/07_decision.md](../research/07_decision.md) §6.2） | v1.1〜 |
| Firebase 計測 / Remote Config / A/B | ローカル MVP には不要。イベント名は GA4 ゲーム推奨イベント（`level_start` / `level_end` / `earn_virtual_currency` / `spend_virtual_currency`）で先に規約化（[research/07_decision.md](../research/07_decision.md) §6.3） | ストア公開ビルド時 |
| 車両コレクション（観賞スキン→物理特性付き） | メタは「コア完成→経済→コレクション」の順を厳守（[research/07_decision.md](../research/07_decision.md) §5.1） | v1.1（スキン）→ v1.2（物理特性付き） |
| 橋素材アンロック（ロープ・鋼鉄・バネ） | 差別化の本命だがコア検証が先（[research/07_decision.md](../research/07_decision.md) §5.1 番外） | v1.2 |
| オフライン収益・デイリーカレンダー | 復帰装置は面数が揃ってから（[research/07_decision.md](../research/07_decision.md) §5.1） | v1.3 |
| レビュー誘導・フィードバックリンク（信頼設計 P7 Feedback Loop） | MVP は外部ネットワーク通信ゼロ（[NFR-012](./non_functional_requirements.md#nfr-012)）のため対象外。v1.1 で設定画面に追加予定（[ux_protocol.md](./ux_protocol.md) 信頼設計マッピング） | v1.1 |
| Ch2 以降のギミック（G3, G4, G5, G6, G7, G8, G9, G10, G11, G12）と 30〜150面 | 量産はテンプレート×パラメータ変奏×ボット検証の3層パイプライン整備後（[research/07_decision.md](../research/07_decision.md) §3.3） | v1.0 リリースまでに Ch2, Ch3。以降運用で追加 |
| Web ポータル提出（CrazyGames / Poki）・CPI テスト | ローカル MVP 合格後に GTM シーケンス（Web 検証→少額 CPI→パブ持ち込み）へ（[research/07_decision.md](../research/07_decision.md) §9-5） | フェーズ2（GTM） |
| ストア資産（アイコン・スクリーンショット・メタデータ・RELEASE runbook） | ストア提出フェーズの成果物。ただし**計画には最初から含める**（過去2作の先送りの轍を踏まない。[research/07_decision.md](../research/07_decision.md) §9-9） | ストア提出フェーズ |
| UGC ステージ・AI 採点・リアルタイム対戦 | ハイブリッドメタの拡張候補どまり（[research/07_decision.md](../research/07_decision.md) §8.2） | 将来検討（Rejected 候補） |

### 制約条件 / Constraints

> 根拠: [research/07_decision.md](../research/07_decision.md) 前提（プロジェクト憲法級）・§7

1. **商用品質基準**: 「広告を付けても恥ずかしくない」ことを出荷条件とする。既存ローカル2作（Stadium Rush! / Glowgrid）はプロセスの参考であり品質基準ではない（前提1）。
2. **模倣戦略**: ゲーム性はゼロから発明しない。Draw Bridge 系の成功パターン（Bravestars 版 53.5M DL / GameLord 3D 版 11.2M DL / Eureka 版 10M+ DL の直接競合3作）を模倣し、品質・脳汁・良心的な広告体験で磨き込む（前提2）。
3. **両 OS 対応**: iOS / Android 両対応。物理・ゲームロジックはエンジン/OS 非依存、広告・ハプティクス・計測はインターフェース抽象化（前提3）。
4. **爽快感最優先**: 「線を引く」「車が走り出す」「ゴール」の3場面に開発リソースを集中投下する（前提4）。
5. **技術スタック**: TypeScript / Phaser 4.1（新 WebGL レンダラ）+ Phaser Box2D（Box2D v3 JS ポート / MIT / 65KB）/ Vite / Capacitor 8。Box2D v3 の chain / capsule / wheel joint / ジョイント破断 API を TS ネイティブで直接使える唯一の構成（§7.1）。
6. **決定論契約（緩和定義）**: ブラウザ間ビット一致は保証しない。CI（固定 Node = 固定 V8）内は終了状態ハッシュのビット一致、実機・エンジン更新時は許容帯（成功/失敗一致 + 最終車両位置 ε=0.05m + tick ±30）で検証。リプレイ/ゴーストは入力再生ではなく位置サンプル再生（§7.2 / [NFR-004](./non_functional_requirements.md#nfr-004)）。
7. **アーキテクチャ**: `Engine`（物理・ルール）は **Phaser 非依存・ヘッドレス Node 実行可能**（CI ボット検証の前提）。`Render`（Phaser）は Engine の観測者で書き戻し禁止。`Meta`（経済・永続化）/ `Platform`（Ad / Haptics / Analytics / Storage の各インターフェース + Capacitor / Web / Noop 実装）で分離（§7.2 / [NFR-010](./non_functional_requirements.md#nfr-010)）。
8. **チューニング値の全集約**: 全チューニング値は `TuningConstants` + レベル JSON に集約。マジックナンバーの散在禁止（grep で検証可能にする）。デバッグスライダ（[FR-025](./functional_requirements.md#fr-025)）で実行中変更（§4 前文・§7.3）。
9. **商標・模倣境界**: 製品名・コード識別子に競合名 "Draw Bridge" をそのまま使わない。最終名称はストア提出時に ASO 調査で決定し、競合と同一の名称・アートを禁止（[ubiquitous_language.md](./ubiquitous_language.md) アンチパターン）。

### リスク対応（要約）

> 全文は [research/07_decision.md](../research/07_decision.md) §9。§表記は同ドキュメントの節番号。

| # | リスク | 確度 | 対策（要約） |
|---|---|---|---|
| 1 | 中級 Android WebView で 60fps 割れ | 中 | 着手週スパイク必須（§7.3）。NG 時は resolution scale 0.75・パーティクル削減・物理フォールバックA。最終手段は Cocos Creator 移植（TS ロジック再利用可） |
| 2 | Phaser Box2D のメンテ停滞（最終 push 2025-04、カプセル衝突の未マージ PR） | 高（事実）〜中（実害） | MIT フォーク前提。スパイクでカプセル×車輪の接触品質を最初に検証。物理層 thin wrapper で Rapier2D への移行路を確保 |
| 3 | ばね鎖チューニング沼（硬いと崩落が地味、柔らかいと暴れる） | 中〜高 | 全パラメータをデバッグスライダ化して実機で回す。破断閾値は「車静止荷重の2〜3倍」から開始。物理セグメント数を増やさず描画スプラインで見た目を稼ぐ |
| 4 | コンテンツ量産が市場基準（500面）に届かない | 中 | テンプレート×パラメータ変奏×ボット検証の3層 + インゲームエディタに初期投資（1〜2週）。目標: ツール整備後 週15〜20面/人。MVP 15面 → ソフトローンチ 300+ のフェーズ分割 |
| 5 | サブジャンル自体が下り坂（新規ヒットは2022年が最後） | 中 | UA 前提にしない。Web 検証（Poki Web Fit Test）→ 少額 CPI テスト（$360〜、CPI < $0.25 / D1 ≥ 35% でパブ持ち込み）→ 各段階に kill 基準 |
| 6 | 広告導入時の体験自壊（競合の轍） | 中 | 頻度キャップを Remote Config 化して遠隔調整。インタースティシャルは Level 8 まで封印・失敗直後に出さない・広告除去 IAP を必ず併設 |
| 7 | ブラウザ/端末間の物理非決定論 | 高（事実）/ 低（MVP 実害） | 決定論契約を「CI 内ビット一致 + 実機許容帯」に再定義済み（§7.2）。ゴースト共有は位置サンプル再生 |
| 8 | Google Play 新規個人アカウントの「12テスター×14日」要件 | 高（事実） | プロジェクト初週にストアアカウント問題を解決（組織アカウント取得 or 既存アカウント利用 or テスト前倒し）。GTM フェーズ0 のタスクに固定 |
| 9 | 収益化・計測の実装が過去2作同様に先送りされ続ける | 中 | v1.0 から `AdInterface` / `AnalyticsInterface` 抽象を必須スコープ化（[FR-022](./functional_requirements.md#fr-022)）。brand/store 工程を計画に明記 |
| 10 | juice 過剰でテンポ死 | 低〜中 | 全演出スキップ可・失敗時は演出最軽量・ループ1周 ≤ 40秒を数値契約テスト化（[NFR-003](./non_functional_requirements.md#nfr-003)・[NFR-008](./non_functional_requirements.md#nfr-008)） |

---

## 次のステップ / Next Steps

1. `/speckit-bridge` で本 designs/ を `specs/[feature]/spec.md` に構造化（品質スコア ≥ 70 ゲートを満たした上で）。
2. `specify plan` → `specify tasks` でタスク分解。
3. `forge_ace` で実装（gatekeeper 検証・claude-to-codex クロスモデルレビュー・specs-evals 回帰ゲート）。
4. 実装着手週に3スパイクを実施し、物理方式（方式C or フォールバックA）を確定してから本実装に入る: ①描線物理方式比較（A/B/C/D × N=8/16/24/32、合格基準 p95 step ≤ 4ms かつ 60fps）②カプセル×車輪の接触品質検証 ③run-to-run 決定論実測（同一レベル×同一描線×1000回ハッシュ比較）（[research/07_decision.md](../research/07_decision.md) §7.3）。
5. ストアアカウント問題（リスク #8）をプロジェクト初週に解決する（[research/07_decision.md](../research/07_decision.md) §9-8）。

---

📋 目次 | [設定 →](./workflow_config.md)

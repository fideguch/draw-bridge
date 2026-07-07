# UIデザインブリーフ — InkBridge（仮）

> [📋 目次](./README.md) | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | **UI** | [UX](./ux_protocol.md)

> Phase 5A 出力。Figma 生成は後続に延期（[workflow_config.md](./workflow_config.md) Phase 5）。本ブリーフがその入力となる。全数値の根拠は [research/07_decision.md](../research/07_decision.md) と [game_design.md](./game_design.md) に置き、本書は「画面としてどう置くか」を確定する。

---

<a id="ui-1"></a>

## 1. Platform & Responsive Strategy / プラットフォーム

- **Target**: Mobile App（iOS 16+ / Android 10+, API 29+）+ Web（デスクトップ・モバイルの Chrome / Safari 最新2版）（[NFR-005](./non_functional_requirements.md#nfr-005)、[research/07_decision.md](../research/07_decision.md) §7.1）
- **Primary approach**: Mobile-first、**縦持ち固定**・片手操作前提（[FR-023](./functional_requirements.md#fr-023)、アクター定義「縦持ち片手」= [README.md](./README.md)）
- **基準フレーム**: **390×844pt**（iPhone 14 クラス）。セーフエリア: 上 47pt / 下 34pt。全ての操作可能 UI はセーフエリア内側に配置する
- **対応レンジ**: 幅 320pt（旧小型端末・Web 縮小時）から 430pt（大型 iPhone / Android）。ゲームワールドは中央基準でスケール、HUD は四隅アンカー（上=左上・右上、下=中央・右下）で追従。120Hz 端末はレンダのみ高リフレッシュ・物理 60Hz 固定（[NFR-001](./non_functional_requirements.md#nfr-001)）
- **入力**: タッチ + マウス両対応（[NFR-005](./non_functional_requirements.md#nfr-005)）。描画キャンバスは HUD を除く画面全域
- **描画方針**: Phaser 4 のプログラム描画優先 + 必要最小限のテクスチャ（Web バンドル ≤5MB gzip、[NFR-013](./non_functional_requirements.md#nfr-013)）。外部 CDN・外部フォント読み込みなし（[NFR-012](./non_functional_requirements.md#nfr-012) 通信ゼロ）

---

<a id="ui-2"></a>

## 2. ビジュアル方針 / Visual Direction

### アートディレクション（ハイパーカジュアル定石）

- **フラット 2D + 高彩度 + 太いアウトライン（ゲームオブジェクト 3px）**。グラデーション不使用・ソリッドカラーのみ。シルエットが小画面・SNS 動画縮小時でも読める形状にする（共有適性 = UA エンジン、[research/07_decision.md](../research/07_decision.md) §2.2-4）
- **視認性最優先**: レベル開始時の静止俯瞰で「解くべき地形が一目で読める」ことを全アートの上位制約とする（[SC-003](./functional_requirements.md#sc-003) 備考、[research/07_decision.md](../research/07_decision.md) §3.1）
- **トーン**: Everyone レーティング準拠の明るくコミカルな昼景。暴力・恐怖表現なし、失敗（崩落）もコミカルな物理見世物として描く（[NFR-012](./non_functional_requirements.md#nfr-012)、[FR-013](./functional_requirements.md#fr-013)）
- **応力可視化が世界観の中心**: 橋チェーンの 白→黄→赤 の色変化（[FR-006](./functional_requirements.md#fr-006)）が本作最大の差別化演出のため、描線の基本色をチョーク白 + 濃色ボーダーとし、応力ティントが最大コントラストで乗る設計にする（[research/07_decision.md](../research/07_decision.md) §4.2）

### 色分離マップ（混同禁止の 5 系統）

| 系統 | 色域 | 判別の非色手がかり |
| --- | --- | --- |
| 地形 | 茶（土）+ 黄緑（草） | 静止・画面下部の塊形状 |
| 描線（橋） | チョーク白 + 濃紺ボーダー | 太さ 8-12pt・丸キャップの 1 本線 |
| 危険（応力・失敗） | アンバー→赤のティント | 粉パーティクル + 微振動 + 軋み音（[NFR-009](./non_functional_requirements.md#nfr-009) 二重符号化） |
| ゴール | マゼンタの旗 | 旗形状 + ポール + 揺れアニメ |
| 報酬（コイン・星） | レモンゴールド | 円形/星形 + 濃色ボーダー |

- **車**はビビッドオレンジの単独ヒーローオブジェクト（形状で一意判別）。危険の赤（#FF3B30）とは色相・文脈の両方で分離する

### 情報の優先順位 = 視覚の優先順位

1. 地形 + 車 + ゴール旗（解読対象。[FR-015](./functional_requirements.md#fr-015)）
2. 描線とインク残量バー（打ち手の資源。[FR-001](./functional_requirements.md#fr-001), [FR-002](./functional_requirements.md#fr-002)）
3. 応力状態（走行中の緊張。[FR-006](./functional_requirements.md#fr-006)）
4. HUD（コイン残高・リスタート。[FR-004](./functional_requirements.md#fr-004), [FR-018](./functional_requirements.md#fr-018)）
5. 装飾（雲・背景小物）

### 競合との識別（商標・アート回避）

- 製品名・ロゴ・アイコン・UI 文字列に "Draw Bridge" を使用しない。競合（Bravestars "Draw Bridge Puzzle"、GameLord 3D 版、Eureka 版）のアート・配色の複製を禁止する（[workflow_config.md](./workflow_config.md) Notes、[research/07_decision.md](../research/07_decision.md) §2.1）
- 本書のパレット（Section 3.1）は「昼空シアン × チョーク白の線 × マゼンタの旗」の組合せをアイデンティティとする 100% オリジナル定義

---

<a id="ui-3"></a>

## 3. デザイントークン / Design Tokens

> 全トークンはコード命名（英語 camelCase）で `TuningConstants` / テーマ定義に集約し、マジックナンバー散在を禁止する（[NFR-010](./non_functional_requirements.md#nfr-010)）。

### 3.1 カラーパレット

**ワールド（ゲームシーン）**

| トークン | HEX | 用途 | 根拠 |
| --- | --- | --- | --- |
| `colorSky` | #A8E4FF | 背景空（ソリッド 1 色） | §2 トーン |
| `colorCloud` | #FFFFFF | 雲（装飾、優先度最下位） | §2 優先順位 5 |
| `colorTerrainFill` | #A06A3F | 地形本体（土） | [FR-015](./functional_requirements.md#fr-015) 地形ポリライン |
| `colorTerrainGrass` | #6BD24B | 地形上面（草キャップ、厚さ 6pt） | 同上 |
| `colorTerrainStroke` | #4A2E17 | 地形アウトライン 3px | §2 太アウトライン |
| `colorInkLine` | #F8F5EC | 描線・橋チェーン基本色（応力 <0.6） | [research/07_decision.md](../research/07_decision.md) §4.1 高コントラスト単色 |
| `colorInkBorder` | #2B2440 | 描線ボーダー 2px・車輪・ポール・UI 枠線 | 同 §4.1 濃色ボーダー 1-2px |
| `colorStressMid` | #FFB300 | 応力ティント中間（stress 0.8 時点の補間色） | [FR-006](./functional_requirements.md#fr-006) 白→黄→赤 |
| `colorStressHigh` | #FF3B30 | 応力ティント最大（stress 1.0）・破断/失敗ハイライト | 同上・[FR-008](./functional_requirements.md#fr-008) |
| `colorGoalFlag` | #FF4F9A | ゴール旗（マゼンタ） | §2 色分離マップ |
| `colorCarBody` | #FF7A1A | 車体 | §2 ヒーローオブジェクト |
| `colorCoin` | #FFE14D | コイン + `colorCoinStroke` #8C6D1F ボーダー | [FR-009](./functional_requirements.md#fr-009) |
| `colorStar` | #FFE14D | 星評価（獲得時）/ 未獲得は #C9C6D9 | [FR-007](./functional_requirements.md#fr-007) |

- 応力の色補間は `colorInkLine`（stress 0.6）→ `colorStressMid`（0.8）→ `colorStressHigh`（1.0）の 2 区間線形補間。stress <0.6 はティなし（基本色のまま）（[game_design.md §8.1](./game_design.md#gd-8)）

**UI**

| トークン | HEX | 用途 |
| --- | --- | --- |
| `colorUiPrimary` | #21C46B | 主ボタン（あそぶ / Next / 購入）塗り |
| `colorUiPrimaryShadow` | #178C4B | 主ボタン下辺ハードシャドウ（4pt） |
| `colorUiDanger` | #FF3B30 | 破壊的操作（進行リセット）・不足額表示 |
| `colorUiDisabled` | #C9C6D9 | 非活性ボタン塗り |
| `colorUiSurface` | #FFFFFF | カード・モーダル面 |
| `colorUiSurfaceDim` | rgba(20,18,43,0.6) | モーダル/リザルト背後の暗幕 |
| `colorInkBarHigh` | #21C46B | インクバー >50%（緑） |
| `colorInkBarMid` | #FFB300 | インクバー 20-50%（黄） |
| `colorInkBarLow` | #FF3B30 | インクバー <20%（赤 + 300ms 点滅） |
| `colorTextPrimary` | #1E1B33 | 本文・ボタンラベル（白面・緑面上） |
| `colorTextSecondary` | #6E6A8A | 補足・キャプション |
| `colorTextInverse` | #FFFFFF | 濃色面上のテキスト |

- インクバー 3 色は [FR-002](./functional_requirements.md#fr-002) の閾値（>50% / 20-50% / <20%）に 1:1 対応
- コントラスト実測値: `colorTextPrimary` on `colorUiSurface` = 14.9:1、on `colorUiPrimary` = 7.0:1、`colorTextInverse` on `colorUiDanger` = 3.6:1（18pt Bold 以上限定で使用）— Section 4 の基準を満たす

### 3.2 タイポグラフィ

| トークン | サイズ | Weight | 用途 |
| --- | --- | --- | --- |
| `typeDisplay` | 40pt | Bold | クリア見出し・大数値 |
| `typeH1` | 28pt | Bold | 画面タイトル |
| `typeH2` | 22pt | SemiBold | レベル番号・カード見出し |
| `typeButton` | 18pt | Bold | ボタンラベル |
| `typeHudNumeral` | 18pt | Bold（等幅数字） | コイン残高・カウントアップ |
| `typeBody` | 16pt | Regular | 本文・設定項目 |
| `typeCaption` | 13pt | Regular | 補足・バージョン表示 |

- 最小フォントサイズ **12pt**（[NFR-009](./non_functional_requirements.md#nfr-009)）
- 書体: 丸ゴシック系のバンドルフォント（候補: 見出し = Fredoka、日本語 = M PLUS Rounded 1c。いずれも SIL OFL）。使用グリフのみサブセット化して同梱し、実行時の外部フォント取得をしない（[NFR-012](./non_functional_requirements.md#nfr-012), [NFR-013](./non_functional_requirements.md#nfr-013)）
- UI 表示言語は日本語、テキストキーは英語（[README.md](./README.md) 用語・表記規約）

### 3.3 スペーシング（4pt グリッド）

| トークン | 値 | 用途 |
| --- | --- | --- |
| `space1` | 4pt | アイコンとラベルの間隔 |
| `space2` | 8pt | 要素内パディング最小 |
| `space3` | 12pt | ボタン内上下パディング |
| `space4` | 16pt | 画面左右マージン・HUD のセーフエリアからのオフセット |
| `space6` | 24pt | カード間・グループ間 |
| `space8` | 32pt | セクション間 |
| `space12` | 48pt | 主ボタン上の分離余白 |

- 全レイアウト値は 4 の倍数のみ使用（例外なし）

### 3.4 Radius・ボーダー・シャドウ

| トークン | 値 | 用途 |
| --- | --- | --- |
| `radiusS` | 8pt | レベルタイル・トグル |
| `radiusM` | 12pt | カード・モーダル |
| `radiusL` | 20pt | 主ボタン |
| `radiusFull` | 999pt | インクバー・コイン残高ピル |
| `strokeGame` | 3px | ゲームオブジェクトのアウトライン |
| `strokeUi` | 2px | ボタン・カードの枠線（`colorInkBorder`） |
| `shadowButton` | offset (0, 4pt)・blur 0 | ボタン下辺のハードシャドウ（塗り色の暗色系。押下時: shadow 0 + ボタン本体を 4pt 下へ移動） |

- ぼかしシャドウは使わない（フラット定石 + 描画コスト削減、[NFR-001](./non_functional_requirements.md#nfr-001)）

---

<a id="ui-3-5"></a>

## 3.5. Trust Design Principles / 信頼設計原則

> Tier 1 の FR 側マッピングは [functional_requirements.md 信頼設計マッピング](./functional_requirements.md#trust-mapping) と一致。本節はその **UI パターンとしての実装位置** を確定する。

### Tier 1: 普遍的信頼パターン（全プロジェクト必須）

| パターン | 適用 | UI パターン（実装位置） |
| --- | --- | --- |
| P1: Visibility（状態可視性） | ✓必須 | ①**インクバー**: [SC-003](./functional_requirements.md#sc-003) 上部中央 234×14pt ピル、描画長に比例してリアルタイム減少 + 3 色閾値（[FR-002](./functional_requirements.md#fr-002)）②応力の色ティント + 粉パーティクル（[FR-006](./functional_requirements.md#fr-006)）③コイン残高をホーム/ショップ/リザルトで同値・同表記表示（[FR-018](./functional_requirements.md#fr-018)）④レベル選択の星/クリア/ロック状態（[FR-016](./functional_requirements.md#fr-016)） |
| P2: User Control（制御） | ✓必須 | ①**リスタートボタン常設**: 描画・走行両フェーズの右下（親指到達圏）56×56pt、セーフエリア右端/下端から各 16pt。確認なし・タップから ≤1 秒で初期状態（[FR-004](./functional_requirements.md#fr-004)）②**スキップ領域 = リザルト画面全域**: クリア 5 拍演出中の任意タップで最終状態へ即ジャンプ（[FR-012](./functional_requirements.md#fr-012)）③サウンド / ハプティクス個別 OFF トグル（[FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020)） |
| P3: Error Prevention & Recovery（エラー予防と回復） | ✓必須 | ①失敗原因ハイライト: 破断点 / 落下地点 / 転倒姿勢を `colorStressHigh` のリング + 拡大表示（[FR-008](./functional_requirements.md#fr-008)）②罰なし: ライフ・スタミナ・ペナルティ UI を一切置かない ③自動保存 + 破損時の部分復元 + 復元不能時のみ通知（[FR-021](./functional_requirements.md#fr-021)） |
| P4: Consistency（一貫性） | ✓必須 | イベント種別→フィードバック（音 / 触覚 / 視覚）を単一マッピング表で統一（確定 = light/TICK、発進 = medium/THUD、破断 = weak 連打、[FR-014](./functional_requirements.md#fr-014)、[NFR-008](./non_functional_requirements.md#nfr-008)）。演出時間は `TuningConstants` に一元化（[NFR-010](./non_functional_requirements.md#nfr-010)） |
| P5: Appropriate Friction（適切な摩擦） | ✓必須 | ①購入前の価格・現在 Lv・次 Lv 効果の明示 + 残高不足時はボタン非活性 + 不足額表示（[FR-019](./functional_requirements.md#fr-019)）②**進行リセットの二重確認モーダル**: 確認①「本当にリセットしますか？」→ 確認②「全ての星とコインが消えます」+ タイプ確認（指定文字列入力で実行ボタン活性化）（[FR-020](./functional_requirements.md#fr-020)）。逆に**リスタートには摩擦ゼロ**（罰なし設計、[FR-004](./functional_requirements.md#fr-004)） |
| P6: Audit & Undo（監査と取消） | △一部 | 操作ログ画面は持たない（MVP）。星のベスト値保持 + クリア履歴（[FR-016](./functional_requirements.md#fr-016)）と進行の永続表示（[FR-021](./functional_requirements.md#fr-021)）で代替。購入の Undo なし（価格を `typeDisplay` 40pt で大きく表示して誤購入を予防、[FR-019](./functional_requirements.md#fr-019)） |
| P7: Feedback Loop（フィードバック） | ✗MVP対象外 | v1.1 でレビュー誘導・フィードバックリンクを設定画面に追加予定（[README.md](./README.md) ロードマップ、[functional_requirements.md 信頼設計マッピング](./functional_requirements.md#trust-mapping)） |

### Tier 2: AI強化信頼パターン

- **非適用**: 本作に AI 機能はない（決定的物理審判のみ、[NFR-004](./non_functional_requirements.md#nfr-004)）。P8, P9, P10, P11, P12, P13 は対象外。

### 信頼キャリブレーション4段階

- **Pre-interaction**: L1 はテキストなしの指アイコンなぞり誘導のみで 10 秒以内に初成功（[FR-017](./functional_requirements.md#fr-017)）
- **Early usage**: L2 でインクバーと星閾値を UI 上の因果（線の長さ → バー減少 → 星数）として体得（[FR-017](./functional_requirements.md#fr-017), [game_design.md §5.4](./game_design.md#gd-5-4)）
- **Ongoing**: 星 / コイン残高 / アップグレード Lv ピップの蓄積を 3 画面（[SC-001](./functional_requirements.md#sc-001), [SC-002](./functional_requirements.md#sc-002), [SC-007](./functional_requirements.md#sc-007)）で一貫表示
- **Error recovery**: 失敗原因ハイライト + 演出最軽量 + 1 秒リトライで「自分の線の問題」として帰属・再挑戦（[FR-008](./functional_requirements.md#fr-008), [FR-013](./functional_requirements.md#fr-013)）

---

<a id="ui-4"></a>

## 4. Accessibility / アクセシビリティ

- **Target level**: WCAG 2.1 AA 相当（[NFR-009](./non_functional_requirements.md#nfr-009)）
- **Contrast ratio**: 通常テキスト ≥4.5:1 / 大テキスト（18pt Bold 以上）・重要 UI ≥3:1。Section 3.1 の実測値で担保
- **Touch target**: 全操作要素 ≥44×44pt（リスタート 56×56pt、トグル 51×31pt + パディングで 44pt 確保、レベルタイル 96×96pt）
- **Color independence（二重符号化）**: 応力 = 色 + 粉パーティクル + 微振動 + 軋み SFX。インクバー = 色 + バー長 + 点滅 + 枯渇時シェイク 4-6px/150ms + 空振り音。星 = 色 + 塗り/輪郭の形差（[NFR-009](./non_functional_requirements.md#nfr-009), [FR-002](./functional_requirements.md#fr-002), [FR-006](./functional_requirements.md#fr-006)）
- **サウンド OFF 時の完全性**: 全ゲーム情報（応力・枯渇・クリア/失敗）は視覚だけで取得可能。サウンド / ハプティクスは個別 OFF 可（[FR-020](./functional_requirements.md#fr-020)）
- **文字サイズ**: 最小 12pt（[NFR-009](./non_functional_requirements.md#nfr-009)）
- **Language**: ja（UI 表示）。テキストキーは英語で将来英語化に備える（[README.md](./README.md) 用語規約）
- **Dark mode**: 非対応（MVP）。ゲームシーンは固定昼景パレット 1 系統のみ（アセット最小化、[NFR-013](./non_functional_requirements.md#nfr-013)）

---

<a id="ui-5"></a>

## 5. Screen Inventory / 画面インベントリ

> [functional_requirements.md 画面一覧](./functional_requirements.md#screens) と 1:1 一致。Source FR は同表の関連 FR、Source US は [user_stories.md](./user_stories.md) の主要ストーリー。

| Screen ID | Screen Name | Source FR | Source US | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| [SC-001](./functional_requirements.md#sc-001) | タイトル/ホーム | [FR-016](./functional_requirements.md#fr-016), [FR-018](./functional_requirements.md#fr-018) | [US-014](./user_stories.md#us-014), [US-016](./user_stories.md#us-016) | Must | — |
| [SC-002](./functional_requirements.md#sc-002) | レベル選択 | [FR-015](./functional_requirements.md#fr-015), [FR-016](./functional_requirements.md#fr-016) | [US-014](./user_stories.md#us-014), [US-015](./user_stories.md#us-015) | Must | — |
| [SC-003](./functional_requirements.md#sc-003) | ゲームプレイ（描画フェーズ） | [FR-001](./functional_requirements.md#fr-001), [FR-002](./functional_requirements.md#fr-002), [FR-003](./functional_requirements.md#fr-003), [FR-004](./functional_requirements.md#fr-004), [FR-010](./functional_requirements.md#fr-010), [FR-017](./functional_requirements.md#fr-017) | [US-001](./user_stories.md#us-001), [US-002](./user_stories.md#us-002), [US-003](./user_stories.md#us-003), [US-013](./user_stories.md#us-013) | Must | — |
| [SC-004](./functional_requirements.md#sc-004) | ゲームプレイ（走行フェーズ） | [FR-004](./functional_requirements.md#fr-004), [FR-005](./functional_requirements.md#fr-005), [FR-006](./functional_requirements.md#fr-006), [FR-007](./functional_requirements.md#fr-007), [FR-008](./functional_requirements.md#fr-008), [FR-009](./functional_requirements.md#fr-009), [FR-011](./functional_requirements.md#fr-011) | [US-005](./user_stories.md#us-005), [US-006](./user_stories.md#us-006), [US-007](./user_stories.md#us-007), [US-008](./user_stories.md#us-008), [US-009](./user_stories.md#us-009) | Must | — |
| [SC-005](./functional_requirements.md#sc-005) | クリアリザルト | [FR-007](./functional_requirements.md#fr-007), [FR-009](./functional_requirements.md#fr-009), [FR-012](./functional_requirements.md#fr-012), [FR-018](./functional_requirements.md#fr-018) | [US-010](./user_stories.md#us-010), [US-011](./user_stories.md#us-011) | Must | — |
| [SC-006](./functional_requirements.md#sc-006) | 失敗リザルト | [FR-004](./functional_requirements.md#fr-004), [FR-008](./functional_requirements.md#fr-008), [FR-013](./functional_requirements.md#fr-013) | [US-004](./user_stories.md#us-004), [US-008](./user_stories.md#us-008) | Must | — |
| [SC-007](./functional_requirements.md#sc-007) | アップグレードショップ | [FR-018](./functional_requirements.md#fr-018), [FR-019](./functional_requirements.md#fr-019) | [US-016](./user_stories.md#us-016), [US-017](./user_stories.md#us-017) | Must | — |
| [SC-008](./functional_requirements.md#sc-008) | 設定 | [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020) | [US-012](./user_stories.md#us-012), [US-019](./user_stories.md#us-019) | Must | — |
| [SC-009](./functional_requirements.md#sc-009) | レベルエディタ（開発ビルド限定） | [FR-024](./functional_requirements.md#fr-024) | [US-022](./user_stories.md#us-022) | Must | — |
| [SC-010](./functional_requirements.md#sc-010) | デバッグチューニングパネル（開発ビルド限定） | [FR-025](./functional_requirements.md#fr-025) | [US-023](./user_stories.md#us-023) | Must | — |

Status: `—` = 未着手 / `WF` = ワイヤーフレーム完了 / `MK` = モックアップ完了。[SC-009](./functional_requirements.md#sc-009), [SC-010](./functional_requirements.md#sc-010) はリリースビルドから除外（[FR-024](./functional_requirements.md#fr-024), [FR-025](./functional_requirements.md#fr-025)）。

---

<a id="ui-6"></a>

## 6. 画面別レイアウト仕様（390×844 基準・セーフエリア 上47pt/下34pt）

### 6.0 共通レイアウト原則

- **親指到達圏** = 画面下半分（y ≥ 422pt）と左右下コーナー。頻度最高の操作（リスタート / Retry / Next / あそぶ）は必ずこの圏内に置く
- 主ボタン: 280×64pt・`radiusL`・`colorUiPrimary` + `colorTextPrimary` ラベル・底辺はセーフエリア下端から `space8`（32pt）上
- 戻るボタン: 左上、セーフエリア上端 + `space4`・左端 + `space4`、44×44pt
- コイン残高ピル: 右上、セーフエリア上端 + `space4`・右端 + `space4`、高さ 32pt・`radiusFull`・`typeHudNumeral`。表示値は全画面で [FR-018](./functional_requirements.md#fr-018) の単一残高
- 画面遷移は 200-300ms（Section 7）。レベル遷移 ≤1 秒・リトライ ≤1 秒（[NFR-003](./non_functional_requirements.md#nfr-003), [NFR-006](./non_functional_requirements.md#nfr-006)）

<a id="ui-sc-001"></a>

### 6.1 SC-001 タイトル/ホーム

```
┌────────────────────────────┐
│ [設定 44pt]      (◎ 1,250) │ ← セーフエリア上端+16pt
│                            │
│        InkBridge（仮）      │ ← ワードマーク typeDisplay
│                            │
│   （背景: 空+地形+静止車。   │
│     ゲーム世界の実パレット）  │
│                            │
│      ┌──────────────┐      │
│      │   ▶ あそぶ    │      │ ← 280×64 Primary
│      └──────────────┘      │
│ [ショップ]                  │ ← 左下 Secondary 132×48
│                            │ ← 下34ptセーフ
└────────────────────────────┘
```

- **要素配置**: 設定（左上 44×44）/ コイン残高ピル（右上）/ ワードマーク（上から 25% 位置・中央）/ あそぶ（下中央 280×64）/ ショップ（左下 132×48・`strokeUi` ボーダーのみの Secondary）
- **状態変化**: コイン残高は購入・獲得の都度更新（[FR-018](./functional_requirements.md#fr-018)）。初回起動時も同一レイアウト（バッジ・案内モーダルなし）
- **遷移**: あそぶ → [SC-002](./functional_requirements.md#sc-002)（レベルタイルタップで即プレイ。起動 → プレイ開始は 2 タップ以内 = [SC-001](./functional_requirements.md#sc-001) 備考）/ 設定 → [SC-008](./functional_requirements.md#sc-008) / ショップ → [SC-007](./functional_requirements.md#sc-007)
- **根拠**: [FR-016](./functional_requirements.md#fr-016), [FR-018](./functional_requirements.md#fr-018), [research/07_decision.md](../research/07_decision.md) §3.5

<a id="ui-sc-002"></a>

### 6.2 SC-002 レベル選択

```
┌────────────────────────────┐
│ [←]  Chapter 1    (◎1,250) │
│                            │
│  ┌────┐ ┌────┐ ┌────┐      │
│  │ 1  │ │ 2  │ │ 3  │      │ ← タイル 96×96・間隔16
│  │★★★│ │★★☆│ │★☆☆│      │
│  └────┘ └────┘ └────┘      │
│  ┌────┐ ┌────┐ ┌────┐      │
│  │ 4  │ │ 5  │ │ B1 │      │ ← B=ボーナス面(コイン色地)
│  │☆☆☆│ │ 錠 │ │ 錠 │      │
│  └────┘ └────┘ └────┘      │
│  … 3列×6行 = 15面+B1,B2,B3  │ ← 縦スクロール
└────────────────────────────┘
```

- **要素配置**: チャプター見出し（`typeH1`）/ レベルタイル 3 列 × 6 行（15 面 + ボーナス 3 面、[game_design.md §6](./game_design.md#gd-6)）。タイル = レベル番号（`typeH2`）+ 星 0-3（獲得 = `colorStar` 塗り / 未獲得 = 輪郭のみ）
- **状態変化**: ①ロック（`colorUiDisabled` 地 + 錠アイコン、タップ不能）②解放済み未クリア（白地 + 星 3 輪郭）③クリア済み（白地 + ベスト星数塗り。再プレイで星はベスト保持 = [FR-016](./functional_requirements.md#fr-016)）④次にプレイすべき面（scale ±5% / 周期 0.8s の脈動）⑤ボーナス面（`colorCoin` 地 + 「BONUS」ラベル 12pt。5 面ごと = [FR-015](./functional_requirements.md#fr-015)）
- **遷移**: 解放済みタイル → [SC-003](./functional_requirements.md#sc-003)（レベルロード ≤1 秒、[NFR-006](./non_functional_requirements.md#nfr-006)）/ ← → [SC-001](./functional_requirements.md#sc-001)。ロード parse 失敗時はエラー表示して本画面へ戻す（[FR-015](./functional_requirements.md#fr-015) 例外フロー）
- **根拠**: [FR-015](./functional_requirements.md#fr-015), [FR-016](./functional_requirements.md#fr-016)（信頼設計 P1 / P6）

<a id="ui-sc-003"></a>

### 6.3 SC-003 ゲームプレイ（描画フェーズ）

```
┌────────────────────────────┐
│         LEVEL 7            │ ← typeH2 上端SA+8
│    [████████░░░░░░]        │ ← インクバー 234×14
│                            │
│                      ▶旗   │
│  ▄▄▄▄▄              ▄▄▄▄▄ │
│  █████    ＼谷／    █████ │ ← 全景静止俯瞰
│  █████·車           █████ │
│        ～～描いた線～～      │ ← チョーク白+濃紺縁
│                            │
│  （描画キャンバス=画面全域）  │
│                     ┌────┐ │
│                     │ ↺  │ │ ← リスタート56×56 右下
└─────────────────────┴────┴─┘
```

- **要素配置**: レベル番号（上部中央）/ インクバー（その直下・234×14pt・`radiusFull`）/ リスタート（右下 56×56pt・セーフエリアから各 16pt = 親指到達圏）/ 残り = 描画キャンバス。カメラは地形 + 車 + 旗の全景静止俯瞰（[SC-003](./functional_requirements.md#sc-003) 備考）
- **状態変化**: ①インクバー: >50% `colorInkBarHigh` / 20-50% `colorInkBarMid` / <20% `colorInkBarLow` + 300ms 点滅。枯渇時: 描画不能 + 空振り音 + バー横シェイク 4-6px/150ms + warning ハプティクス（[FR-002](./functional_requirements.md#fr-002)）②描画中: 線先端は生タッチ座標を同フレーム反映（≤16.7ms、[NFR-002](./non_functional_requirements.md#nfr-002)）+ 描画ループ音 + ペン先ダスト（[FR-001](./functional_requirements.md#fr-001), [FR-010](./functional_requirements.md#fr-010)）③FTUE（L1, L2, L3 のみ）: 指アイコンのなぞり誘導オーバーレイ。テキストチュートリアル禁止（[FR-017](./functional_requirements.md#fr-017)）
- **遷移**: 指離し = 線確定 → 確定ポップ（scale 1.0→1.06→1.0 / 120ms）+ 物理化 + 発進シーケンス開始 → [SC-004](./functional_requirements.md#sc-004)（同一シーン内で描画 UI を非表示化）（[FR-003](./functional_requirements.md#fr-003), [FR-005](./functional_requirements.md#fr-005)）/ リスタート → ≤1 秒で本画面初期状態（[FR-004](./functional_requirements.md#fr-004)）
- **根拠**: [research/07_decision.md](../research/07_decision.md) §4.1 / [game_design.md §4.1](./game_design.md#gd-4-1)

<a id="ui-sc-004"></a>

### 6.4 SC-004 ゲームプレイ（走行フェーズ）

```
┌────────────────────────────┐
│  （描画UI・レベル番号は      │
│    フェードアウト済み）      │
│                            │
│        ◎  ◎  ◎            │ ← コインのアーチ配置
│   車→ ～～～橋～～～        │ ← 応力で白→黄→赤
│  ████        （軋み粉）████ │
│                            │
│  カメラ: lerp追従+look-ahead│
│                     ┌────┐ │
│                     │ ↺  │ │ ← リスタートのみ常設
└─────────────────────┴────┴─┘
```

- **要素配置**: HUD はリスタート（右下 56×56pt、描画フェーズと同位置 = P4 一貫性）のみ。他の情報は全てワールド内表現（応力色・粉パーティクル・コインポップ）
- **状態変化**: ①描画 UI（インクバー・レベル番号）は発進の溜め 0.3-0.5s の間に 150ms でフェードアウト（[FR-005](./functional_requirements.md#fr-005)）②橋: stress 0.6-1.0 で 白→黄→赤 ティント + 軋み SFX + 粉パーティクル、>1.0 で部分崩落 + 折れ口ハイライト（[FR-006](./functional_requirements.md#fr-006)）③コイン: 接触取得でポップ scale 1.0→1.3→0 / 150ms + キラ粒子 4-8 個 + 半音上昇音（[FR-009](./functional_requirements.md#fr-009)）④カメラ: lerp 0.08-0.15 追従 + look-ahead 車体 1-2 台分 + 発進キック 8-16px（[FR-011](./functional_requirements.md#fr-011)）
- **遷移**: 車体基準点が旗判定矩形へ到達 → 5 拍演出 → [SC-005](./functional_requirements.md#sc-005)（[FR-007](./functional_requirements.md#fr-007), [FR-012](./functional_requirements.md#fr-012)）/ 落下・転倒 0.5s・タイムアウト 30s → [SC-006](./functional_requirements.md#sc-006)（[FR-008](./functional_requirements.md#fr-008)）/ リスタート → [SC-003](./functional_requirements.md#sc-003)（走行中もいつでも有効、[FR-004](./functional_requirements.md#fr-004)）
- **根拠**: [research/07_decision.md](../research/07_decision.md) §4.2 / [game_design.md §4.2](./game_design.md#gd-4-2)

<a id="ui-sc-005"></a>

### 6.5 SC-005 クリアリザルト

```
┌────────────────────────────┐
│ [レベル選択]      (◎1,274) │ ← 残高は加算後の値
│  （背景=ゴール瞬間を60%暗幕）│
│      ★   ★   ★           │ ← 200-300ms間隔で順次
│                            │
│        + 24 ◎              │ ← カウントアップ0.8-1.5s
│    （confetti 2段構成）      │
│                            │
│   [Replay]   ┌──────────┐ │
│    132×48    │ Next ▶   │ │ ← 280×64・1.5-2.5s後
│              └──────────┘ │    活性+脈動±5%
│  ※画面全域タップ=スキップ    │
└────────────────────────────┘
```

- **要素配置**: 背景 = ゴール瞬間のワールドに `colorUiSurfaceDim` 暗幕 / 星 3 個（各 88pt、中央上部）/ 獲得コイン `typeDisplay` / Next（下中央 280×64・Primary）/ Replay（左下 132×48・Secondary）/ レベル選択（左上テキストボタン、[FR-016](./functional_requirements.md#fr-016) トリガー「リザルトからのレベル選択遷移」）/ コイン残高ピル（右上・加算後の値、[FR-018](./functional_requirements.md#fr-018)）
- **状態変化**: 5 拍構成 — ①hit-stop 80-120ms ②スロー timeScale 0.3 + ズームイン 15-25% ③confetti 2 段（キャノン各 40-60 個 + レイン 60-100 個）④星が 200-300ms 間隔で scale 0→1.3→1.0 / 250ms 出現 + ド・ミ・ソ上昇アルペジオ ⑤コインバースト 10-30 枚 → カウンター飛行 + カウントアップ 0.8-1.5s（[FR-012](./functional_requirements.md#fr-012)）。**画面全域が演出スキップのタップ領域**（P2）。Next は演出完了後 1.5-2.5s で活性化 + 脈動 scale ±5% / 周期 0.8s。BGM ダッキング -6〜-9dB / 0.2s（[NFR-014](./non_functional_requirements.md#nfr-014)）
- **遷移**: Next → 次レベルの [SC-003](./functional_requirements.md#sc-003)（≤1 秒）/ Replay → 同レベルの [SC-003](./functional_requirements.md#sc-003) / レベル選択 → [SC-002](./functional_requirements.md#sc-002)
- **根拠**: [research/07_decision.md](../research/07_decision.md) §4.3 / [game_design.md §4.3](./game_design.md#gd-4-3)

<a id="ui-sc-006"></a>

### 6.6 SC-006 失敗リザルト

```
┌────────────────────────────┐
│ [レベル選択]               │
│ （背景=崩落の静止。40%暗幕。 │
│   崩落自体が見世物なので     │
│   検死可能に残す）          │
│        ◎←折れ口リング       │ ← colorStressHigh
│   ████ ＼_車_／  ████      │
│                            │
│      ┌──────────────┐      │
│      │  ↺ Retry      │      │ ← 280×64 即時活性
│      └──────────────┘      │
│  （追加演出なし・最軽量）     │
└────────────────────────────┘
```

- **要素配置**: 背景 = 失敗瞬間のワールドに 40% 暗幕（クリアの 60% より軽く、原因の視認を優先）/ 失敗原因ハイライト = `colorStressHigh` のリング（破断点 / 落下地点 / 転倒姿勢、直径 64pt・ワールド内）/ Retry（下中央 280×64・**表示と同時に活性**）/ レベル選択（左上テキストボタン）
- **状態変化**: 追加演出なし（崩落・落下の物理見世物そのものが演出）。判定確定 → 軽量暗転 + 短い残念音のみ（[FR-013](./functional_requirements.md#fr-013)）。ライフ・ペナルティ・広告的インタラプトの UI は存在しない（罰なし = P3）。hit-stop は大クラッシュ時のみ 1 レベル 1-2 回の共有上限内で許可（[NFR-008](./non_functional_requirements.md#nfr-008)）
- **遷移**: Retry → [SC-003](./functional_requirements.md#sc-003)（タップから ≤1 秒、[FR-004](./functional_requirements.md#fr-004)、[NFR-003](./non_functional_requirements.md#nfr-003)）/ レベル選択 → [SC-002](./functional_requirements.md#sc-002)
- **根拠**: [research/07_decision.md](../research/07_decision.md) §3.2 / [game_design.md §4.4](./game_design.md#gd-4-4)

<a id="ui-sc-007"></a>

### 6.7 SC-007 アップグレードショップ

```
┌────────────────────────────┐
│ [←]  ショップ     (◎1,274) │
│ ┌────────────────────────┐ │
│ │ ▤ インク量   Lv2 ●●○○○ │ │ ← Lvピップ5個
│ │ 効果: +20% → 次Lv +30%  │ │ ← 現在→次を数値明示
│ │      ┌──────────┐      │ │
│ │      │ ◎ 120     │      │ │ ← 価格ボタン(活性)
│ │      └──────────┘      │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ ⚡ 車速     Lv0 ○○○○○ │ │
│ │ 効果: +0% → 次Lv +5%    │ │
│ │   [◎ 1,500  あと226]    │ │ ← 非活性+不足額
│ └────────────────────────┘ │
└────────────────────────────┘
```

- **要素配置**: カード 2 枚（インク量 Ink Capacity / 車速 Engine Speed、各 358×180pt・`radiusM`・間隔 `space6`）。カード内 = 名称 + アイコン / Lv ピップ 5 個（獲得 = `colorUiPrimary` 塗り）/ 効果の現在値 → 次 Lv 値（数値、インク +10%/Lv・車速 +5%/Lv、[FR-019](./functional_requirements.md#fr-019)）/ 価格ボタン（価格数値は `typeDisplay` 40pt 相当で大きく表示 = 誤購入予防）
- **状態変化**: ①購入可能（Primary 活性）②残高不足（`colorUiDisabled` 非活性 + 「あと N」不足額を `colorUiDanger` 13pt で表示）③Lv5 = MAX（価格ボタンを「MAX」表示に置換・非活性）。購入は即時実行・Undo なし。購入成功で残高ピップ・効果値・価格が同フレーム更新 + 保存（[FR-021](./functional_requirements.md#fr-021)）。価格曲線は [game_design.md §7.2](./game_design.md#gd-7-2) の表に従う
- **遷移**: ← → 呼び出し元（[SC-001](./functional_requirements.md#sc-001)）
- **根拠**: [FR-019](./functional_requirements.md#fr-019)（信頼設計 P5）、[research/07_decision.md](../research/07_decision.md) §5.1・§5.2

<a id="ui-sc-008"></a>

### 6.8 SC-008 設定

```
┌────────────────────────────┐
│ [←]  設定                  │
│                            │
│  サウンド          [ON ●]  │ ← トグル・即時反映
│  ハプティクス      [ON ●]  │
│  ──────────────────────    │
│  進行をリセット   [リセット] │ ← Danger 枠ボタン
│                            │
│  クレジット                 │
│  Version 1.0.0 (typeCaption)│
└────────────────────────────┘
```

- **要素配置**: トグル行 2 本（行高 56pt、ラベル `typeBody` + 右端トグル）/ 区切り線 / 進行リセット（`colorUiDanger` の枠線ボタン 132×48・右寄せ）/ クレジット・バージョン（`typeCaption`）
- **状態変化**: ①トグルは変更を即時反映 + 永続化（[FR-020](./functional_requirements.md#fr-020), [FR-021](./functional_requirements.md#fr-021)）②進行リセットは**二重確認モーダル**: モーダル1「本当にリセットしますか？」[キャンセル / 続ける] → モーダル2「全ての星とコインが消えます」+ 指定文字列のタイプ確認（入力一致まで実行ボタン非活性）→ 双方通過でのみ初期化（[FR-020](./functional_requirements.md#fr-020) 主フロー 2 = P5）。いずれかキャンセルでデータ無変更のまま本画面へ復帰
- **遷移**: ← → [SC-001](./functional_requirements.md#sc-001)
- **根拠**: [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020)（信頼設計 P2 / P3 / P5）

<a id="ui-sc-009"></a>

### 6.9 SC-009 レベルエディタ（開発ビルド限定）

```
┌────────────────────────────┐
│ [終了] エディタ  [解あり✓]  │ ← ゴースト解バッジ
│ ┌─┐                        │
│ │頂│  （編集キャンバス:      │
│ │点│   地形ポリライン頂点·   │
│ │車│   車/旗/コイン/ギミック │
│ │旗│   をドラッグ配置）      │
│ │◎│                        │
│ └─┘← ツール列 48×48/個     │
│ ┌────────────────────────┐ │
│ │インク予算[240] 星2[160] │ │ ← プロパティパネル
│ │星3[120]                 │ │
│ │[テスト][書出し][読込み]  │ │ ← 保存=解ありのみ活性
│ └────────────────────────┘ │
└────────────────────────────┘
```

- **要素配置**: ツール列（左端縦、48×48pt/個: 頂点編集・車スポーン・旗矩形・コイン・ギミックタグ）/ 編集キャンバス（中央）/ プロパティパネル（下部折りたたみ式、高さ 200pt: インク予算・star2/star3 閾値の数値入力）/ 操作ボタン（テストプレイ / JSON 書き出し / JSON 読み込み）/ ゴースト解バッジ（右上: 「解あり ✓」/「解なし」）
- **状態変化**: ①テストプレイ = [SC-003](./functional_requirements.md#sc-003) 相当のプレイへ切替、**成功時にゴースト解（描線 + 結果）をレベル JSON へ保存**しバッジが「解あり ✓」へ変化 ②書き出しボタンは「解あり」時のみ活性（解のないレベルは保存不可 = スキーマ強制、[FR-024](./functional_requirements.md#fr-024)）③編集を加えるとバッジは「解なし」へ戻る（解と地形の不整合防止）
- **遷移**: テストプレイ ⇄ 編集 / 終了 → 開発メニュー。リリースビルドには本画面のコード・導線を含めない（[FR-024](./functional_requirements.md#fr-024)）
- **根拠**: [research/07_decision.md](../research/07_decision.md) §3.3・§8.1、[FR-026](./functional_requirements.md#fr-026)（Gate 2 のゴースト解入力を本画面が生産）

<a id="ui-sc-010"></a>

### 6.10 SC-010 デバッグチューニングパネル（開発ビルド限定）

```
┌────────────────────────────┐
│ fps:60 step p95:3.2ms b:41 │ ← 常時読み出し行
│ ┌─────────────┐            │
│ │[物理|カメラ|Juice]│ ←タブ │
│ │ hertz      ●────  6.0   │ │
│ │ damping    ──●──  0.7   │ │
│ │ breakForce ───●─  ...   │ │
│ │ lerp       ─●───  0.10  │ │
│ │ trauma max ──●──  ...   │ │
│ └─────────────┘            │
│ （背後でゲームプレイ継続。   │
│   パネルは右側ドロワー260pt）│
└────────────────────────────┘
```

- **要素配置**: 読み出し行（上端固定: fps / 物理 step 時間 / ボディ数、`typeCaption` 等幅）/ 右側ドロワー（幅 260pt・ゲーム画面に重畳・スワイプで開閉）/ タブ 3 系統（物理: hertz・damping・breakForce・breakTorque・摩擦・モーター / カメラ: lerp・look-ahead・trauma / Juice: hit-stop 長・スロー倍率・confetti 数）/ 各行 = ラベル + スライダ + 現在値
- **状態変化**: スライダ操作は対応する `TuningConstants` を実行中に即時変更（再起動不要、[FR-025](./functional_requirements.md#fr-025)）。初期値・値域は [game_design.md §8](./game_design.md#gd-8) のチューニング表に一致させる
- **遷移**: ドロワー開閉のみ（プレイは継続、画面遷移なし）。リリースビルドから除外
- **根拠**: [research/07_decision.md](../research/07_decision.md) §7.3・§9 リスク3、[NFR-001](./non_functional_requirements.md#nfr-001)（[KPI-001](./README.md#kpi-001) 計測 UI を兼ねる）

---

<a id="ui-7"></a>

## 7. モーション原則 / Motion Principles

> 全 duration・イージングは `TuningConstants` に集約し [SC-010](./functional_requirements.md#sc-010) のスライダで実機調整する（[NFR-010](./non_functional_requirements.md#nfr-010)）。初期値の出典は [game_design.md §8.3, §8.4, §8.5](./game_design.md#gd-8)。

### イージング規約（用途を 4 種に固定）

| イージング | 用途 | 適用例 |
| --- | --- | --- |
| `easeOutBack` | 出現ポップ（オーバーシュート） | 線確定ポップ 120ms、星出現 250ms、コイン取得ポップ 150ms（[FR-003](./functional_requirements.md#fr-003), [FR-009](./functional_requirements.md#fr-009), [FR-012](./functional_requirements.md#fr-012)） |
| `easeOut` | 減速して止まる移動・復帰 | squash/stretch 復帰 100ms、カメラキック復帰 0.3s、カウントアップ 0.8-1.5s（[FR-011](./functional_requirements.md#fr-011), [FR-012](./functional_requirements.md#fr-012)） |
| `easeIn` | 加速して消える・飛んでいく | コインのカウンター飛行 各 0.4-0.6s（[FR-012](./functional_requirements.md#fr-012) 第5拍） |
| `linear` | 物理連動・進捗表現 | インクバー減少、車輪回転、timeScale の lerp 復帰 0.2-0.3s |

### Duration 規約（4 段階）

| 帯域 | 値域 | 適用 |
| --- | --- | --- |
| micro | 80-150ms | タップ応答・確定ポップ・hit-stop（80-120ms）・コインポップ |
| short | 200-300ms | 星の出現間隔（200-300ms）・**画面遷移（200-300ms 固定）**・インクバー点滅周期 300ms |
| medium | 300-600ms | 溜め 0.3-0.5s・スローモーション実時間 0.3-0.5s・コイン飛行 |
| long | 800-1500ms | 報酬カウントアップ 0.8-1.5s・confetti レイン 2-3s（装飾のみ、操作をブロックしない） |

### Juice との整合ルール

1. **テンポ契約が上位**: どの演出もループ 1 周 ≤40 秒・リトライ ≤1 秒・Next 活性 1.5-2.5 秒の数値契約を破らない（[NFR-003](./non_functional_requirements.md#nfr-003)）。演出は全てタップスキップ可（P2、[NFR-008](./non_functional_requirements.md#nfr-008)）
2. **hit-stop は 1 レベル 1-2 回まで**（ゴール・大クラッシュ限定。頻繁なアクションほどシンプルに、[NFR-008](./non_functional_requirements.md#nfr-008)）
3. **失敗側は最軽量**: 失敗リザルトへの遷移に medium 以上の演出を追加しない（[FR-013](./functional_requirements.md#fr-013)）
4. **アニメーション対象は transform 系のみ**（position / scale / rotation / alpha）。60fps 維持と物理 step p95 ≤4ms の予算を侵さない（[NFR-001](./non_functional_requirements.md#nfr-001)）
5. **screen shake は trauma 方式**（shake = trauma²）で UI レイヤーには適用しない（HUD・ボタンは揺らさない。ワールドカメラのみ、[game_design.md §8.2](./game_design.md#gd-8)）
6. ボタン押下は shadow 4pt → 0 + 本体 4pt 下移動（Section 3.4）を全ボタンで統一（P4）

---

<a id="ui-8"></a>

## 8. Existing Design System / 既存デザインシステム

- **Library URL**: None（新規。100% オリジナル定義 = Section 2, 3）
- **Components to reuse**: なし。既存ローカル 2 作（Stadium Rush! / Glowgrid）はプロセス参考のみでビジュアル流用禁止（[research/07_decision.md](../research/07_decision.md) 前提 1）
- **Icon set**: プログラム描画のオリジナルアイコン（リスタート ↺ / 設定歯車 / 錠 / コイン / 星）。外部アイコンフォント・CDN 不使用（[NFR-012](./non_functional_requirements.md#nfr-012), [NFR-013](./non_functional_requirements.md#nfr-013)）

---

<a id="ui-9"></a>

## 9. Figma Files / Figma 生成の延期と再開手順

> **延期の決定**: Figma によるワイヤーフレーム・モックアップ生成は後続に延期する（[workflow_config.md](./workflow_config.md) Phase 5）。理由: ①本作の画面は Phaser のプログラム描画が主体で、UI の最終品質は動く物理・演出でのみ確認できる ②juice 演出（軋み色変化・confetti・hit-stop）は静的モックで表現できない ③本ブリーフが入力として完成しているため、いつでも追加実行できる。

- **FigJam (IA & Flows)**: 未作成（延期）
- **Design File**: 未作成（延期）

### 再開手順（5 ステップ）

1. `/figma-generate-design` を本ブリーフ（designs/ui_design_brief.md）を入力に実行する
2. Section 3 のデザイントークンを Figma Variables として 1:1 の名前・値で登録する（`colorSky` = #A8E4FF 以下全トークン）
3. [SC-001](./functional_requirements.md#sc-001), [SC-002](./functional_requirements.md#sc-002), [SC-003](./functional_requirements.md#sc-003), [SC-004](./functional_requirements.md#sc-004), [SC-005](./functional_requirements.md#sc-005), [SC-006](./functional_requirements.md#sc-006), [SC-007](./functional_requirements.md#sc-007), [SC-008](./functional_requirements.md#sc-008) を 390×844 フレームで生成する（Section 6 のレイアウト仕様に従う）。[SC-009](./functional_requirements.md#sc-009), [SC-010](./functional_requirements.md#sc-010) は開発ビルド限定のため低忠実度ワイヤーフレームで可
4. 画面遷移フローを FigJam に起こす（Section 6 各画面の「遷移」記述と [ux_protocol.md](./ux_protocol.md) を入力とする）
5. スクリーンショット検証で本ブリーフとの差分（トークン値・配置・タッチターゲット ≥44pt）を確認し、Section 5 の Status 列を `WF` / `MK` へ更新する

---

[← UL](./ubiquitous_language.md) | [📋 目次](./README.md) | [UX →](./ux_protocol.md)

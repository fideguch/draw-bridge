# ユビキタス言語定義 — InkBridge（仮）

> [📋 目次](./README.md) | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | **UL** | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

FR・NFR・[game_design.md](./game_design.md) から抽出したドメイン用語 26 語（[UL-001](#ul-001), [UL-002](#ul-002), [UL-003](#ul-003), [UL-004](#ul-004), [UL-005](#ul-005), [UL-006](#ul-006), [UL-007](#ul-007), [UL-008](#ul-008), [UL-009](#ul-009), [UL-010](#ul-010), [UL-011](#ul-011), [UL-012](#ul-012), [UL-013](#ul-013), [UL-014](#ul-014), [UL-015](#ul-015), [UL-016](#ul-016), [UL-017](#ul-017), [UL-018](#ul-018), [UL-019](#ul-019), [UL-020](#ul-020), [UL-021](#ul-021), [UL-022](#ul-022), [UL-023](#ul-023), [UL-024](#ul-024), [UL-025](#ul-025), [UL-026](#ul-026)）を定義する。表記規約は次の 2 点（[research/07_decision.md](../research/07_decision.md) 前提 3・§6.3、インベントリ全体規約）:

1. **UI 表示は日本語**（将来英語化前提で文字列キーは英語）。コード識別子・ID・イベント名は英語。
2. コード命名は TypeScript 規約（Type = PascalCase / property = camelCase、§3 参照）。数値パラメータは `TuningConstants`（[UL-024](#ul-024)）とレベル JSON に集約する（[NFR-010](./non_functional_requirements.md#nfr-010)）。

本作はテキストチュートリアル禁止（[FR-017](./functional_requirements.md#fr-017)）のため、プレイ中 UI の文字列は恒常表示（レベル番号・残高・ボタン）に限られる。よって UI ラベル列の多くは「ラベルなし（演出で伝える）」であり、その場合も**開発内の呼称は本書の英語正式名に統一**する。

---

## 1. 用語集

### 描画 / Drawing

<a id="ul-001"></a>
<a id="ul-002"></a>
<a id="ul-003"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-001](#ul-001) | Stroke | ストローク / 描線 | 1 回のドラッグ（pointerdown→pointerup）で描かれる頂点列（ポリライン）。**物理化前**の状態を指す。1 レベル 1 ストローク、先端は生タッチ座標を同フレーム反映 | （ラベルなし。画面上の描線そのもの） | `Stroke` / `stroke`, `strokeId`（自己衝突フィルタ `filter.groupIndex = -strokeId`） | [FR-001](./functional_requirements.md#fr-001), [FR-003](./functional_requirements.md#fr-003), [game_design §3.1](./game_design.md#gd-3) | [SC-003](./functional_requirements.md#sc-003) |
| [UL-002](#ul-002) | Ink | インク | 描画長に比例して消費する戦略資源。レベル JSON の予算で初期化し、確定時の消費量が星評価（[UL-012](#ul-012)）の入力になる。残量バー: >50% 緑 / 20〜50% 黄 / <20% 赤 + 300ms 点滅 | インク（残量バー） | `inkBudget` / `inkRemaining`, `effectiveInkBudget`, `ink.*`（[game_design §8.3](./game_design.md#gd-8)） | [FR-002](./functional_requirements.md#fr-002), [FR-019](./functional_requirements.md#fr-019), [NFR-009](./non_functional_requirements.md#nfr-009) | [SC-003](./functional_requirements.md#sc-003) |
| [UL-003](#ul-003) | Solidify | ソリディファイ / 物理化 | 指離しで Stroke を確定し、RDP 間引き→等間隔リサンプル→カプセルチェーン生成で物理ワールドへ投入する処理。`GameState` の 1 状態。物理化と同時に発進シーケンスが開始する（0 秒フィードバック） | （ラベルなし。確定ポップ 120ms + 確定音 + ハプティクス light で提示） | `GameState.Solidify` / `solidify()` | [FR-003](./functional_requirements.md#fr-003), [game_design §2](./game_design.md#gd-2) | [SC-003](./functional_requirements.md#sc-003)→[SC-004](./functional_requirements.md#sc-004) 遷移 |

### 橋・物理 / Bridge & Physics

<a id="ul-004"></a>
<a id="ul-005"></a>
<a id="ul-006"></a>
<a id="ul-007"></a>
<a id="ul-008"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-004](#ul-004) | Bridge Chain | ブリッジチェーン / 橋チェーン | **物理化後**の橋。カプセルセグメント × N（N=8〜24、上限 32）を revolute joint（ばね hertz 4〜8 / dampingRatio 0.6〜0.8、limit ±0.2〜0.4 rad）で連結した物体。物理化前の Stroke（[UL-001](#ul-001)）と区別する | 橋 | `BridgeChain` / `bridgeChain`, `bridge.*` | [FR-003](./functional_requirements.md#fr-003), [FR-006](./functional_requirements.md#fr-006), [game_design §3.2](./game_design.md#gd-3) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-005](#ul-005) | Segment | セグメント | Bridge Chain を構成する単一のカプセル剛体。長さ 0.5〜0.8m 相当（初期値 0.65m）。ボディ数上限管理の単位 | （ラベルなし・内部構成要素） | `Segment` / `physics.segmentLength`, `physics.segmentCountMax` | [FR-003](./functional_requirements.md#fr-003), [NFR-001](./non_functional_requirements.md#nfr-001), [game_design §8.1](./game_design.md#gd-8) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-006](#ul-006) | Stress | ストレス / 応力 | ジョイント毎に毎 tick 算出する負荷値。raw = \|F\|/breakForce + \|τ\|/breakTorque を EMA（係数 0.85/0.15）で平滑。0.6〜1.0 で Creak（[UL-007](#ul-007)）、>1.0 で Break（[UL-008](#ul-008)） | （数値は非表示。線分色 白→黄→赤 + 粉パーティクル + 弱振動の二重符号化で可視化） | `stress` / `bridge.stressEmaKeep`, `bridge.stressEmaNew` | [FR-006](./functional_requirements.md#fr-006), [NFR-009](./non_functional_requirements.md#nfr-009), [game_design §3.2](./game_design.md#gd-3) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-007](#ul-007) | Creak | クリーク / 軋み | stress 0.6〜1.0 帯域の状態名。軋み SFX 音量/ピッチ・線分色補間・粉パーティクル・弱ハプティクス連打を stress 値に連動させる（本作固有の差別化 juice） | （ラベルなし。音・色・振動の演出） | `bridge.creakBandMin`, `haptic.creak` | [FR-006](./functional_requirements.md#fr-006), [game_design §4.2](./game_design.md#gd-4-2) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-008](#ul-008) | Break | ブレイク / 破断 | stress > 1.0 で `b2DestroyJoint` によりジョイントを破壊するイベント（部分崩落）。クラック音 + 破片 + カメラ trauma +0.5 + 折れ口ハイライト。破断位置は失敗時の因果ハイライトの入力になる | （ラベルなし。折れ口ハイライトで提示） | `breakForce` / `breakTorque`, `bridge.breakForceFactor` | [FR-006](./functional_requirements.md#fr-006), [FR-008](./functional_requirements.md#fr-008), [game_design §3.2](./game_design.md#gd-3) | [SC-004](./functional_requirements.md#sc-004), [SC-006](./functional_requirements.md#sc-006) |

### 走行・審判 / Run & Judgement

<a id="ul-009"></a>
<a id="ul-010"></a>
<a id="ul-011"></a>
<a id="ul-012"></a>
<a id="ul-025"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-009](#ul-009) | Anticipation | アンティシペーション / 溜め | 物理化完了から走行開始までの 0.3〜0.5s 固定・スキップ不可の発進儀式（レブ音ピッチ 1.0→1.4 + 車体後傾 squash + 空転煙）。`GameState` の 1 状態 | （ラベルなし・演出そのもの） | `GameState.Anticipation`, `launch.anticipationSec` | [FR-005](./functional_requirements.md#fr-005), [game_design §2](./game_design.md#gd-2)・[§8.4](./game_design.md#gd-8) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-010](#ul-010) | Launch | ローンチ / 発進 | 溜め完了時に後輪モーター駆動（enableMotor）を開始する解放イベント。ダスト 10〜20 個 + 車体前方 stretch + 低域バースト音 + ハプティクス medium | （ラベルなし） | `launch.*`, `haptic.launch`, `camera.traumaLaunch` | [FR-005](./functional_requirements.md#fr-005), [FR-011](./functional_requirements.md#fr-011), [game_design §4.2](./game_design.md#gd-4-2) | [SC-004](./functional_requirements.md#sc-004) |
| [UL-011](#ul-011) | Goal Flag | ゴールフラッグ / ゴール旗 | クリア判定の基準物。車体基準点がレベル JSON 定義の旗判定矩形に入った tick でクリア確定。クリア/失敗の同 tick 同時成立はクリア優先 | ゴール（旗スプライト） | `GoalFlag` / `goalRect`（レベル JSON: 旗判定矩形） | [FR-007](./functional_requirements.md#fr-007), [FR-015](./functional_requirements.md#fr-015), [game_design §2](./game_design.md#gd-2) | [SC-003](./functional_requirements.md#sc-003), [SC-004](./functional_requirements.md#sc-004) |
| [UL-012](#ul-012) | Star Rating | スターレーティング / 星評価 | クリア品質評価（星 1〜3）。インク消費量 ≤ star3 閾値 → 星3 / ≤ star2 閾値 → 星2 / それ以外 → 星1（少なく描くほど高評価）。星1 でもクリア可、記録はベスト値保持 | 星（★1〜3） | `StarRating` / `stars`、レベル JSON `star2` / `star3` | [FR-007](./functional_requirements.md#fr-007), [FR-016](./functional_requirements.md#fr-016), [game_design §5.6](./game_design.md#gd-5-6) | [SC-002](./functional_requirements.md#sc-002), [SC-005](./functional_requirements.md#sc-005) |
| [UL-025](#ul-025) | Vehicle Reference Point | ビークルリファレンスポイント / 車体基準点 | クリア判定（旗判定矩形への進入）と失敗判定（落下・転倒）に使う車の代表点。chassis の AABB 中心とする | （ラベルなし・内部判定点） | `vehicleReferencePoint` | [FR-007](./functional_requirements.md#fr-007), [FR-008](./functional_requirements.md#fr-008) | [SC-004](./functional_requirements.md#sc-004) |

### 経済・メタ / Economy & Meta

<a id="ul-013"></a>
<a id="ul-026"></a>
<a id="ul-014"></a>
<a id="ul-015"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-013](#ul-013) | Coin | コイン | 単一ソフト通貨（第二通貨なし）。獲得: クリア報酬 20〜30/面 + レベル内収集 + ボーナス面 5〜10 倍。消費: アップグレードのみ（MVP）。残高加算はクリア確定時のみ | コイン（残高・獲得数表示。ホーム / ショップ / リザルトで同一値・同一表記） | `coinBalance`, `economy.*`, `coin.*` | [FR-009](./functional_requirements.md#fr-009), [FR-018](./functional_requirements.md#fr-018), [game_design §7.3](./game_design.md#gd-7-3) | [SC-001](./functional_requirements.md#sc-001), [SC-004](./functional_requirements.md#sc-004), [SC-005](./functional_requirements.md#sc-005), [SC-007](./functional_requirements.md#sc-007) |
| [UL-026](#ul-026) | Upgrade Entry | 強化（きょうか） | アップグレード画面およびその導線ラベル。コイン（ソフト通貨）のみで恒久強化を購入する画面 — 課金要素なし（BR-008）。旧称「ショップ」は 2026-07-08 に廃止（課金誤認回避、DESIGN.md §2） | 強化（コインアイコン併記必須） | `UpgradeScene`（旧 ShopScene）, `upgrade-*` devId | [FR-018](./functional_requirements.md#fr-018), DESIGN.md §2/§9 | [SC-007](./functional_requirements.md#sc-007) |
| [UL-014](#ul-014) | Ink Capacity | インクキャパシティ / インク量 | アップグレード 2 軸の正式名（軸1）。レベルのインク予算へ +10%/Lv を実乗算（上限 5Lv、Lv5 で +50%）。Lv0（基本インク）で全レベルクリア可能を維持 | インク量 | `inkCapacityLv`, `economy.inkPerLevelPct` | [FR-019](./functional_requirements.md#fr-019), [game_design §7.1](./game_design.md#gd-7-1) | [SC-007](./functional_requirements.md#sc-007) |
| [UL-015](#ul-015) | Engine Speed | エンジンスピード / 車速 | アップグレード 2 軸の正式名（軸2）。モーター速度へ +5%/Lv を実乗算（上限 5Lv、Lv5 で +25%）。速度↑ = 描画精度要求↑のリスクリターン設計 | 車速 | `engineSpeedLv`, `economy.speedPerLevelPct` | [FR-019](./functional_requirements.md#fr-019), [game_design §7.1](./game_design.md#gd-7-1) | [SC-007](./functional_requirements.md#sc-007) |

### レベル・進行 / Levels & Progression

<a id="ul-016"></a>
<a id="ul-017"></a>
<a id="ul-018"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-016](#ul-016) | Level | レベル（日本語文中の数え表現は「面」を許容） | プレイの 1 単位。JSON データ（地形ポリライン・車スポーン・旗矩形・インク予算・星閾値・コイン配置・ギミックタグ・ゴースト解 ≥1 本・schemaVersion）として定義。「ステージ」とは呼ばない（§2） | レベル（例: レベル番号表示） | `Level` / `level`, `levelId` | [FR-015](./functional_requirements.md#fr-015), [FR-016](./functional_requirements.md#fr-016), [game_design §6](./game_design.md#gd-6) | [SC-002](./functional_requirements.md#sc-002), [SC-003](./functional_requirements.md#sc-003) |
| [UL-017](#ul-017) | Chapter | チャプター | レベル 15 面の束。チャプターごとに新ギミック 1 系統を解禁（10〜15 面周期）。MVP は Ch1（G1 + G2）のみ | チャプター | `Chapter` / `chapterId` | [FR-015](./functional_requirements.md#fr-015), [game_design §5.1](./game_design.md#gd-5-1) | [SC-002](./functional_requirements.md#sc-002) |
| [UL-018](#ul-018) | Bonus Level | ボーナスレベル / ボーナス面 | 5 面ごと（L5 / L10 / L15 クリア後）に解放されるコイン収集特化面。報酬は通常の 5〜10 倍（初期値 6 倍 = 150 コイン）。失敗条件は通常面と同一 | ボーナス（通常面と視覚区別のバッジ） | レベル JSON `isBonus`（フラグ例）, `economy.bonusMultiplier`, `economy.bonusLevelInterval` | [FR-009](./functional_requirements.md#fr-009), [FR-016](./functional_requirements.md#fr-016), [game_design §7.4](./game_design.md#gd-7-4) | [SC-002](./functional_requirements.md#sc-002) |

### オーサリング・品質ゲート / Authoring & Quality Gates

<a id="ul-019"></a>
<a id="ul-020"></a>
<a id="ul-021"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-019](#ul-019) | Ghost Solution | ゴーストソリューション / ゴースト解 | レベル JSON に添付必須（≥1 本）の成功解データ = 描線ポリライン + 走行結果の**位置サンプル**（入力再生ではない）。エディタのテストプレイ成功時に保存し、Gate 2 がヘッドレスリプレイで検証（許容帯: 成功一致 + 最終位置 ε=0.05m + tick ±30）。Lv0（基準パラメータ）で記録する | （ユーザー非公開。エディタ [SC-009](./functional_requirements.md#sc-009) では「解を保存」） | `GhostSolution` / レベル JSON `ghostSolutions` | [FR-015](./functional_requirements.md#fr-015), [FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026), [NFR-004](./non_functional_requirements.md#nfr-004) | [SC-009](./functional_requirements.md#sc-009) |
| [UL-020](#ul-020) | Straight-line Bot | ストレートラインボット / 直線ボット | スポーンから旗へ直線を 1 本描くだけの自動解法ボット。anti-dominant タグ付きレベルで**必ず失敗する**ことを Gate 3（CI）で検証する（支配戦略防止のテスト契約化） | （ユーザー非公開・CI 専用） | `StraightLineBot` | [FR-026](./functional_requirements.md#fr-026), [game_design §5.5](./game_design.md#gd-5-5), [KPI-004](./README.md#kpi-004) | — |
| [UL-021](#ul-021) | Tempo Contract | テンポコントラクト / テンポ契約 | ループ速度の数値契約: L1 クリア ≤25 秒 / 最初の 3 面 3 連続成功 60〜90 秒 / 失敗→リトライ ≤1 秒 / ループ 1 周 ≤40 秒 / Next 活性化 1.5〜2.5 秒。自動テスト（ゴースト解リプレイ + UI 遷移計測）で検証する | （ユーザー非公開・品質契約） | テストスイート名 `tempo-contract` | [NFR-003](./non_functional_requirements.md#nfr-003), [KPI-003](./README.md#kpi-003), [FR-017](./functional_requirements.md#fr-017) | — |

### 演出・チューニング / Juice & Tuning

<a id="ul-022"></a>
<a id="ul-023"></a>
<a id="ul-024"></a>

| ID | 用語 | 読み / 日本語 | 定義 | UIラベル | コード命名 | ソース | 画面(SC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [UL-022](#ul-022) | Hit-stop | ヒットストップ | 旗接触または大クラッシュのフレームで 80〜120ms 完全停止する演出。使用上限は 1 レベル 1〜2 回（ゴールと大クラッシュで共有） | （ラベルなし・演出） | `goal.hitStopMs` | [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013), [NFR-008](./non_functional_requirements.md#nfr-008) | [SC-004](./functional_requirements.md#sc-004), [SC-005](./functional_requirements.md#sc-005) |
| [UL-023](#ul-023) | Juice | ジュース | ゲームフィールを構成する演出群（音・粒子・カメラ・ハプティクス・スケール変形）の開発用総称。P0（必須）項目の 100% 実装が [KPI-005](./README.md#kpi-005) の合否条件、P1（推奨）は入るだけ入れる | （ユーザー非公開・開発用語） | デバッグパネル分類 `juice`（hit-stop 長 / スロー倍率 / confetti 数） | [FR-010](./functional_requirements.md#fr-010), [FR-011](./functional_requirements.md#fr-011), [FR-012](./functional_requirements.md#fr-012), [game_design §4](./game_design.md#gd-4) | [SC-003](./functional_requirements.md#sc-003), [SC-004](./functional_requirements.md#sc-004), [SC-005](./functional_requirements.md#sc-005), [SC-010](./functional_requirements.md#sc-010) |
| [UL-024](#ul-024) | TuningConstants | チューニングコンスタンツ / チューニング定数 | 物理・カメラ・juice・経済の全チューニング値を集約する単一ソース。マジックナンバー散在禁止（grep で検証可能）。デバッグパネルから実行中変更可。レベル固有値はレベル JSON 側 | （ユーザー非公開） | `TuningConstants`。キー: `physics.*` / `bridge.*` / `car.*` / `fail.*` / `camera.*` / `draw.*` / `ink.*` / `launch.*` / `engine.*` / `coin.*` / `goal.*` / `audio.*` / `haptic.*` / `economy.*` / `ads.*` | [FR-025](./functional_requirements.md#fr-025), [NFR-010](./non_functional_requirements.md#nfr-010), [game_design §8](./game_design.md#gd-8) | [SC-010](./functional_requirements.md#sc-010) |

<details><summary>コード表現の詳細（抜粋）</summary>

#### UL-001 / UL-003 / UL-004: Stroke → Solidify → Bridge Chain

- **コード表現**: 描画中は `Stroke`（頂点列）。`pointerup` で `solidify()` が RDP 間引き→リサンプル→`BridgeChain` を生成し、以降 `Stroke` オブジェクトは物理に関与しない（描画層は物理セグメント位置から Catmull-Rom で再構成）。
- **エイリアス**: 日本語の「確定」= pointerup の入力イベント、「物理化」= Solidify の変換処理。順序が固定の 2 側面であり、逆順・混用で使わない（[FR-003](./functional_requirements.md#fr-003) のタイトル「線の確定と物理化」がこの順序）。
- **アンチパターン**: 物理化後の橋を「線」と呼ばない（§2）。

#### UL-012: Star Rating

- **コード表現**: レベル JSON は閾値 2 値のみ保持 — `star2` / `star3`（星1 はクリアで確定）。判定は `inkConsumed ≤ star3 → 3` / `≤ star2 → 2` / `else → 1`。
- **検証接続**: 星3 ゴースト解（`kind: "3star"`）が star3 閾値を満たすことを Gate 2 で assert（[game_design §5.6](./game_design.md#gd-5-6)）。

#### UL-016: Level

- **コード表現**: `Level` はレベル JSON のロード結果。ID は `levelId`。日本語ドキュメント内の「15面」「ボーナス面」の「面」は Level の数え表現であり、コード・UI 文字列には使わない。
- **アンチパターン**: `Stage` / `Course` / `Map` を型名・変数名に使わない（§2）。

#### UL-019: Ghost Solution

- **コード表現**: レベル JSON フィールド `ghostSolutions`（配列、≥1 要素をスキーマで強制）。各要素 = 描線ポリライン + 位置サンプル列 + 結果（成功 / tick 数）。
- **アンチパターン**: 「リプレイ」と呼んで入力再生と誤解させない — 本作のリプレイ/ゴーストは位置サンプル再生（[NFR-004](./non_functional_requirements.md#nfr-004)）。

#### UL-024: TuningConstants

- **コード表現**: 初期値一覧は [game_design §8](./game_design.md#gd-8) の表が単一の正。`physics.fixedDt` / `bridge.stressEmaKeep` / `car.restitution` 等の「固定」印パラメータはスライダ対象外。
- **アンチパターン**: コード中に裸の数値リテラルでチューニング値を書かない（grep 検証で検出、[NFR-010](./non_functional_requirements.md#nfr-010)）。

</details>

---

## 2. アンチパターン一覧

> 競合名・実装技術・存在しない概念の語彙が UI・コード・ストアメタデータへ漏れることを防ぐ。

| Avoid This Term | Use Instead (UL-ID) | Reason |
| --- | --- | --- |
| **"Draw Bridge"**（製品名・コード識別子・ストアメタデータでの使用） | InkBridge（仮）— 最終名称はストア提出時に ASO 調査で決定（[README](./README.md)） | 競合 Bravestars「Draw Bridge Puzzle」（53.5M DL）の名称。同一名称・アートの使用禁止（[research/07_decision.md](../research/07_decision.md) §2.1） |
| 「線」と「橋」の混用 | [UL-001](#ul-001): Stroke（物理化前）/ [UL-004](#ul-004): Bridge Chain（物理化後） | Solidify（[UL-003](#ul-003)）の前後で物理的性質が異なる別概念。状態遷移で用語を切り替える |
| 「ステージ」「コース」「マップ」 | [UL-016](#ul-016): Level（レベル） | 1 概念 = 1 用語。UI・コード・会話とも Level に統一 |
| 収集物を「スター」と呼ぶ | [UL-013](#ul-013): Coin（MVP の収集物）/ [UL-012](#ul-012): Star Rating（クリア評価） | G12 の「収集スター」は Ch3 以降の別ギミック（[game_design §5.1](./game_design.md#gd-5-1)）。MVP で「星」は評価のみを指す |
| アップグレード軸を「インク」「スピード」と略す | [UL-014](#ul-014): Ink Capacity（UI「インク量」）/ [UL-015](#ul-015): Engine Speed（UI「車速」） | 資源 Ink（[UL-002](#ul-002)）・物理の速度値との混同防止。2 軸は正式名で呼ぶ |
| リトライ操作の言い換え（「やり直す」等、正式 3 ラベル以外の第 4 の表記） | プレイ中 HUD = 「リスタート」/ 失敗リザルト = 「Retry」/ クリアリザルト = 「Replay」の 3 ラベルのみ（[FR-004](./functional_requirements.md#fr-004), [FR-012](./functional_requirements.md#fr-012)） | 文脈別の正式ラベル（リスタート / Retry は ≤1 秒復帰の同一処理、Replay はクリア後の同レベル再プレイ）。第 4 の表記を作らない |
| Lives / ライフ / スタミナ / ペナルティ | （対応語なし — 概念を導入しない） | 罰なし設計（[FR-008](./functional_requirements.md#fr-008)）。存在しない概念の語彙を UI・コードに持ち込まない |
| 物理 API 名の UI 露出（`b2DestroyJoint`・revolute joint・EMA 等） | [UL-006](#ul-006): Stress / [UL-007](#ul-007): Creak / [UL-008](#ul-008): Break のドメイン語 | 実装技術は Engine 層に留め、ユーザーには演出（音・色・振動）で表現する |
| 「ゴールド」「ジェム」等の通貨語 | [UL-013](#ul-013): Coin | 単一ソフト通貨（[research/07_decision.md](../research/07_decision.md) §5.2）。第二通貨は存在しない |

### よくあるアンチパターン例

| Pattern | Bad Example | Good Example | Why |
| --- | --- | --- | --- |
| 強化導線を「ショップ」と表記 | ショップ / Store / SHOP | 強化 + コインアイコン | 「ショップ」は実課金と誤認される。本作はコイン専用経済（[UL-026](#ul-026), BR-008, DESIGN.md §2） |
| 競合名を製品・ジャンル名に使用 | 「Draw Bridge 系ゲーム」（UI・ストア文言） | 「線を描いて橋を架ける物理パズル」 | 競合名の流用は ASO 混同・出荷条件違反（[README](./README.md)） |
| 技術名がそのまま機能名 | 「EMA 応力が 0.6 を超えました」 | （軋み音 + 白→黄→赤の色変化で無言表現） | ユーザーは実装を知る必要がない。テキストチュートリアル禁止とも整合（[FR-017](./functional_requirements.md#fr-017)） |
| 内部状態名を UI 表示 | 「Anticipation 中…」 | （溜め演出 0.3〜0.5s そのもので伝える） | 状態機械の名前はコード内部に留める（[game_design §2](./game_design.md#gd-2)） |
| 1 概念 2 名称 | 「ステージ 5」と「レベル 5」の混在 | 「レベル 5」に統一 | 同義語を増やさない |

---

## 3. 命名規則

### 一般ルール

1. **UI 表示は日本語、コード識別子・文字列キー・ID は英語**（将来英語化前提。[research/07_decision.md](../research/07_decision.md) §6.3 のイベント規約と同方針）。
2. **1 概念 = 1 用語** — コード・UI・ドキュメント・会話で本書の英語正式名を使う（同義語を増やさない）。
3. **機能名はユーザーの体験で表現する** — 実装技術（Box2D API 名・EMA・RDP）を UI に出さない。演出で伝えられるものにラベルを付けない（[FR-017](./functional_requirements.md#fr-017) テキストチュートリアル禁止）。
4. **曖昧な汎用語（「データ」「アイテム」「オブジェクト」）を使わない** — Stroke / Bridge Chain / Ghost Solution 等の具体語を使う。
5. **"Draw Bridge" を製品名・コード・メタデータに一切使わない**（最重要・§2 先頭）。
6. **チューニング値は識別子に埋めない** — 数値は `TuningConstants`（[UL-024](#ul-024)）とレベル JSON に集約（[NFR-010](./non_functional_requirements.md#nfr-010)）。

### プログラミング言語別規約（TypeScript）

| Context | Convention | Example |
| --- | --- | --- |
| class / interface / enum 型 | PascalCase | `BridgeChain`, `GhostSolution`, `GameState` |
| enum メンバ（状態名） | PascalCase | `GameState.Solidify`, `GameState.Anticipation`（[game_design §2](./game_design.md#gd-2)） |
| 変数・関数・プロパティ | camelCase | `inkBudget`, `coinBalance`, `solidify()` |
| TuningConstants キー | `カテゴリ.camelCase` | `goal.hitStopMs`, `bridge.breakForceFactor`（[game_design §8](./game_design.md#gd-8)） |
| レベル JSON フィールド | camelCase | `inkBudget`, `star2`, `schemaVersion`, `ghostSolutions`（[FR-015](./functional_requirements.md#fr-015)） |
| 計測イベント名 | snake_case（GA4 ゲーム推奨イベント固定） | `level_start`, `level_end`, `earn_virtual_currency`, `spend_virtual_currency`（[FR-022](./functional_requirements.md#fr-022)） |
| Platform 抽象 | `名詞 + Interface` / 実装は `環境名 + 役割` | `AdInterface`, `NoopAdProvider`, `StorageInterface`（[FR-022](./functional_requirements.md#fr-022)） |
| レイヤー構成 | Engine / Render / Meta / Platform の 4 分離 | `Engine` は Phaser 非依存・ヘッドレス Node 実行可能（[NFR-010](./non_functional_requirements.md#nfr-010), [game_design §3.8](./game_design.md#gd-3)） |

### 使用技術スタック

- **Programming Language**: TypeScript
- **Engine / Physics**: Phaser 4.1（Render 層のみ）+ Phaser Box2D（Box2D v3）（[research/07_decision.md](../research/07_decision.md) §7.1）
- **Build / Native**: Vite / Capacitor 8（iOS 16+ / Android 10+）
- **Persistence**: StorageInterface 経由（Web = localStorage / Capacitor = Preferences、[FR-021](./functional_requirements.md#fr-021)）
- **Existing Style Guide**: なし（本書 §3 + [NFR-010](./non_functional_requirements.md#nfr-010) が単一の正）

---

[← US](./user_stories.md) | [📋 目次](./README.md) | [UI →](./ui_design_brief.md)

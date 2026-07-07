# ゲームデザイン仕様 — InkBridge（仮）

> [📋 目次](./README.md) | [設定](./workflow_config.md) | **ゲームデザイン** | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)
>
> 根拠: [research/07_decision.md](../research/07_decision.md)（§3 コアデザイン・§4 脳汁設計・§5 メタ進行・§7.2 物理実装・§8.1 MVPスコープ）、[research/03_juice_research.md](../research/03_juice_research.md)（juice 全パラメータの一次根拠）、[research/06_gap_2.md](../research/06_gap_2.md)（ギミック12類型・FTUE・検証ゲート・レベルJSON）、[research/06_gap_1.md](../research/06_gap_1.md)（カプセルチェーン方式の技術根拠）。
>
> 本書の数値は「初手で8割正しい出発点」（[research/03_juice_research.md](../research/03_juice_research.md) §8 注意1）であり、最終値は実機チューニング（[FR-025](./functional_requirements.md#fr-025) デバッグパネル）で確定する。全数値は `TuningConstants` とレベルJSONに集約し、コード中のマジックナンバー散在を禁止する（[NFR-010](./non_functional_requirements.md#nfr-010)）。

---

<a id="gd-1"></a>
## 1. コア体験の感情ループ

**「描く（創造）→ 放つ（審判）→ 渡り切る or 崩れ落ちる（カタルシス）」**。プレイヤーの操作は「描く」の1動詞のみで、描いた瞬間に自分の創造物が物理法則の審判にかけられる。最重要価値は爽快感3場面（線を引く / 車が走り出す / ゴール）への集中投下（[research/07_decision.md](../research/07_decision.md) 前提4）。

### 1.1 感情の拍（1ループ = 10〜30秒、演出込み1周 ≤ 40秒）

| 拍 | 感情 | 秒数 | 設計装置 | 参照 |
|---|---|---|---|---|
| 0. 読む | 静・分析 | 2〜5秒 | 地形+車+旗の静止俯瞰。解くべき地形が一目で読める（[SC-003](./functional_requirements.md#sc-003)） | [research/07_decision.md](../research/07_decision.md) §3.1 |
| 1. 描く | 創造・没入 | 3〜10秒 | 入力遅延ゼロ描画、描画速度に随伴するループ音、インク残量バーのリアルタイム減少（[FR-001](./functional_requirements.md#fr-001), [FR-002](./functional_requirements.md#fr-002), [FR-010](./functional_requirements.md#fr-010)） | [research/03_juice_research.md](../research/03_juice_research.md) §2 |
| 2. 溜め | 期待 | 0.3〜0.5秒（固定・スキップ不可） | レブ音ピッチ 1.0→1.4、車体後傾 squash、車輪空転煙（[FR-005](./functional_requirements.md#fr-005)） | [research/03_juice_research.md](../research/03_juice_research.md) §3.1 |
| 3. 走る | 審判・観戦 | 3〜10秒 | 走行中の操作ゼロ。カメラ lerp 追従 + look-ahead（[FR-011](./functional_requirements.md#fr-011)） | [research/07_decision.md](../research/07_decision.md) §3.1 |
| 4. 軋み | 緊張 | 走行中に断続 0.5〜3秒 | ジョイント応力 stress 0.6〜1.0 帯域を音・色（白→黄→赤）・粉パーティクル・弱振動で可視化（[FR-006](./functional_requirements.md#fr-006)） | [research/06_gap_1.md](../research/06_gap_1.md)、[research/07_decision.md](../research/07_decision.md) §4.2 |
| 5a. 到達 | カタルシス（成功） | 3〜4秒（タップで即スキップ可） | ゴール5拍演出: hit-stop→スロー→confetti→星→カウントアップ（[FR-012](./functional_requirements.md#fr-012)） | [research/03_juice_research.md](../research/03_juice_research.md) §4 |
| 5b. 崩落 | カタルシス（失敗） | ≤1秒でリトライ可能 | 崩落・落下の物理見世物そのものが演出。暗転+短い残念音のみ、罰なし（[FR-008](./functional_requirements.md#fr-008), [FR-013](./functional_requirements.md#fr-013)） | [research/07_decision.md](../research/07_decision.md) §3.2 |
| 6. 次へ | 前進 | Next 活性化 1.5〜2.5秒、レベル遷移 ≤1秒 | Next ボタン脈動（scale ±5% / 周期0.8秒）（[FR-012](./functional_requirements.md#fr-012), [NFR-006](./non_functional_requirements.md#nfr-006)） | [research/03_juice_research.md](../research/03_juice_research.md) §4.6 |

### 1.2 感情曲線（覚醒度の設計）

```
覚醒度
 ▲                                     ┌ 5a 到達（最高点・3〜4s で解放）
 │                        4 軋み ╱╲ ╱╲╱
 │             2 溜め ╱▔▔▔▔▔▔▔▔▔    ╲
 │   1 描く ╱▔╲__╱ 3 走る            ╲ 5b 崩落（失敗でも見世物=下げ止め）
 │ ╱▔▔▔▔▔▔       ▲                    ╲__ 6 次へ（≤1s リトライ / 1.5〜2.5s Next）
 │╱0 読む(静)     └ 0.3〜0.5s の期待の谷→解放
 └──────────────────────────────────────────▶ 時間（1周 ≤40秒）
```

- **失敗時に覚醒度を落とさない**ことが本作の要: 崩落は罰ではなく見世物であり、リトライ ≤1秒（[NFR-003](./non_functional_requirements.md#nfr-003) テンポ契約）で「考え直す楽しさ」に即接続する（Voodoo「Not punitive」原則、[research/03_juice_research.md](../research/03_juice_research.md) §4.6）。
- **緊張（拍4）は物理値から無料で手に入る**: 応力可視化は演出用の別システムではなく、破断判定に使う stress 値そのものをマッピングする（[research/06_gap_1.md](../research/06_gap_1.md)、[research/07_decision.md](../research/07_decision.md) §4.2）。

---

<a id="gd-2"></a>
## 2. コアループ状態機械（疑似コード）

> 根拠: [research/07_decision.md](../research/07_decision.md) §3.1（コアループ）・§3.2（成功/失敗条件）。時間値は [NFR-003](./non_functional_requirements.md#nfr-003) のテンポ契約と一致させ、自動テストで検証する。

```
enum GameState {
  Idle,          // レベル静止表示。地形+車+旗の俯瞰（SC-003）
  Drawing,       // ストローク描画中。インク消費・先端は生タッチ座標
  Solidify,      // 指離し。RDP間引き→リサンプル→カプセルチェーン生成 + 確定ポップ 120ms
  Anticipation,  // 発進の溜め 0.3〜0.5s（固定・スキップ不可）
  Running,       // モーター駆動。走行中の操作なし（リスタートのみ有効）
  Goal,          // ゴール5拍演出（3〜4s、タップで即スキップ）
  Fail,          // 失敗確定。暗転+残念音+原因ハイライト
  Result,        // クリアリザルト(SC-005) / 失敗リザルト(SC-006)
  Next           // 次レベルロード（≤1s）
}

// --- 遷移表 ---
Idle        → Drawing      : pointerdown（一筆書き制約: 当該レベルで未描画 かつ インク残量 > 0）
Drawing     → Drawing      : pointermove（最小点間距離 6px 以上で頂点追加。インク枯渇時は
                             頂点追加を停止し空振り音+バーシェイク。FR-001, FR-002）
Drawing     → Solidify     : pointerup（有効頂点 ≥ 2。1点のみのタップは線を破棄し Idle へ戻す
                             — セグメント生成の最小要件による境界条件規定）
Solidify    → Anticipation : チェーン生成完了（同フレーム。物理化と同時に発進シーケンス開始。FR-003）
Anticipation→ Running      : anticipationSec（初期値 0.4s、範囲 0.3〜0.5s）経過 → モーター駆動開始（FR-005）
Running     → Goal         : 車体基準点 ∈ ゴール旗判定矩形（FR-007）
Running     → Fail         : ①車体 y < 画面下限 killY
                             ②屋根の接地が tipOverTime（初期値 0.5s）継続
                             ③経過 tick > maxTicks（初期値 1800 = 30s 相当）（FR-008）
Goal        → Result       : 5拍演出完了 or タップスキップ（FR-012）
Fail        → Result       : 即時（演出最軽量。FR-013）
Result(成功) → Next         : Next ボタン活性化 1.5〜2.5s 後にタップ（FR-012）
Result(失敗) → Idle(同面)   : Retry 即時活性。押下 → ≤1s で初期状態（FR-004, FR-008）
Next        → Idle(次面)    : レベルロード ≤1s（FR-015, NFR-006）

// --- 全状態共通 ---
Drawing / Anticipation / Running → Idle(同面リセット)
  : リスタートボタン（描画・走行フェーズ常設）。タップ → ≤1s で同レベル初期状態。
    確認ダイアログは出さない（罰なし設計のため即時。FR-004）
```

※コードブロック内の ID 参照はリンク化対象外。

- **走行フェーズの入力はゼロ**。この構造により、リプレイ・自動検証が「レベルJSON + 描線ポリライン + tick 数」で完結する（[research/06_gap_2.md](../research/06_gap_2.md) §4.3、[FR-026](./functional_requirements.md#fr-026) の土台）。
- 星評価はインク消費量の閾値で決まる（少ないほど高評価、星1でもクリア可。[FR-007](./functional_requirements.md#fr-007)、[research/07_decision.md](../research/07_decision.md) §3.2）。

---

<a id="gd-3"></a>
## 3. 物理モデル仕様

> 根拠: [research/07_decision.md](../research/07_decision.md) §7.2（完全転記+展開）、[research/06_gap_1.md](../research/06_gap_1.md)（第一方式化の技術検証）。実装先: [FR-003](./functional_requirements.md#fr-003), [FR-005](./functional_requirements.md#fr-005), [FR-006](./functional_requirements.md#fr-006)。

### 3.1 レイヤー構造（描線 → ボディ化）

```
[入力層]  pointer点列 → RDP間引き → 等間隔リサンプル（セグメント長 0.5〜0.8m 相当）
[物理層]  カプセルセグメント×N（N=8〜24、上限32）を revolute joint で連結（方式C）
[描画層]  物理セグメント位置から Catmull-Rom スプラインで滑らかな1本線を再構成
          （物理Nと描画頂点を分離。破断点で描画パスを分割 + 折れ口ギザギザ）
[保険層]  同じ入力層/描画層のまま、物理層だけ単一 compound 剛体（方式A）に差し替え可能
```

### 3.2 方式C: セグメント化カプセルチェーン + ばね付きジョイント + 破断（第一方式）

| パラメータ | 値 | 説明 |
|---|---|---|
| セグメント形状 | カプセル | Box2D v3 capsule shape |
| セグメント長 | 0.5〜0.8m 相当 | 等間隔リサンプルの単位 |
| セグメント数 N | 8〜24（開始値 10〜16、上限 32） | ボディ数上限管理（[NFR-001](./non_functional_requirements.md#nfr-001)） |
| 連結ジョイント | revolute joint | 隣接セグメント間 |
| ばね（曲げ剛性=たわみ） | `enableSpring: hertz 4〜8, dampingRatio 0.6〜0.8` | 荷重で本当にたわむ差別化の心臓部 |
| 折れ角制限 | `enableLimit: ±0.2〜0.4 rad` | 最大折れ角 |
| 自己衝突 | `collideConnected=false`、同一ストローク内 `filter.groupIndex = -strokeId` | ストローク内衝突オフ |
| 応力（stress） | `raw = |F|/breakForce + |τ|/breakTorque` を EMA 平滑（係数 0.85/0.15） | ジョイント毎に毎 tick 算出 |
| 軋み帯域 | stress 0.6〜1.0 | 軋みSFX・色変化（白→黄→赤）・粉パーティクル・弱ハプティクスに直結（[FR-006](./functional_requirements.md#fr-006)） |
| 破断 | stress > 1.0 で `b2DestroyJoint`（部分崩落） | クラック音+破片+カメラ trauma +0.5+折れ口ハイライト |
| 破断閾値の初期値 | breakForce = 車静止荷重の 2〜3倍から開始 | [research/07_decision.md](../research/07_decision.md) §9 リスク3 |
| 破断後の孤立チェーン片 | 数秒後に車と非衝突化 + フェードアウト | 残骸によるハマり防止 |
| 質量指針 | 線の総質量 = 車の 0.3〜1.0 倍、セグメント単体との質量比 ≤ 約30:1 | 安定性の実務指針 |
| subStep | 4 から開始 → 不安定時 6〜8 | `b2World_Step` の subStepCount |

- **実在実証**: Box2D 公式 Driving サンプル（カプセル20枚 revolute 橋を車が渡る = 本作コアループと同型）と Bridge サンプル（160枚, hertz 2.0 / damping 0.7）。破断は公式 BreakableJoint サンプルが雛形で、Phaser Box2D が必要 API（`b2Joint_GetConstraintForce/Torque`, `b2DestroyJoint`）をエクスポート済みであることをソース確認済み（[research/07_decision.md](../research/07_decision.md) §7.2、[research/06_gap_1.md](../research/06_gap_1.md)）。
- **物理化の視覚合図は無料**: 確定と同時に線がわずかに落下・たわむのは方式Cの副次効果であり、演出コードを追加せずに「線が物体になった」を伝える（[research/07_decision.md](../research/07_decision.md) §4.1）。

### 3.3 方式A: 単一 compound 剛体（フォールバック）

- 入力層・描画層はそのまま、物理層のみ単一 compound 剛体に差し替える切替を設計時から用意する（[FR-003](./functional_requirements.md#fr-003)）。
- 適用条件: ①低性能端末向け設定 ②着手週スパイク（§3.7）で方式Cが合格基準未達の場合。不合格時は方式A + 描画層のみの演出たわみへ後退する（[research/07_decision.md](../research/07_decision.md) §7.3）。

### 3.4 車両仕様

| 要素 | 仕様 |
|---|---|
| 構成 | chassis（角丸ボックス or カプセル）×1 + wheel（円）×2 + `b2WheelJoint` ×2 |
| サスペンション | `hertz ≈ 4 / dampingRatio ≈ 0.7` |
| 駆動 | 後輪 `enableMotor + motorSpeed + maxMotorTorque` |
| タイヤ摩擦 | 0.8〜1.2 |
| 地形・描線の摩擦 | 0.6〜0.9 |
| restitution | 0 |
| 走行中の操作 | なし（[FR-005](./functional_requirements.md#fr-005)） |

### 3.5 地形

- static body の **chain shape 一択**（片側衝突・ゴースト衝突なし）。レベルJSONの `terrain` ポリラインから生成（[FR-015](./functional_requirements.md#fr-015)、[research/06_gap_2.md](../research/06_gap_2.md) §6.1）。

### 3.6 時間管理と決定論契約

| 項目 | 決定 |
|---|---|
| タイムステップ | 固定 `dt = 1/60` + アキュムレータ + 補間レンダリング（Phaser Box2D の WorldStep は accumulator 内蔵。補間は必要に応じ自前追加） |
| 高リフレッシュ端末 | 120Hz 端末はレンダのみ高リフレッシュ、物理は 60Hz 固定（[NFR-001](./non_functional_requirements.md#nfr-001)） |
| CI 内決定論 | 固定 Node（=固定 V8）でビット一致 / 終了状態ハッシュ一致による回帰検出（Box2D 本家 CI 方式） |
| 実機・エンジン更新時 | 許容帯検証: 成功/失敗一致 + 最終車両位置 ε = 0.05m + tick ±30（仮置き、感度分析で校正。[NFR-004](./non_functional_requirements.md#nfr-004)） |
| リプレイ/ゴースト | 「入力再生」ではなく**位置サンプル再生**で実装 |
| 将来ビット決定論が必須化した場合 | (a) ポートの三角関数差し替えフォーク (b) `rapier2d-deterministic`（WASM）移行 の2択を再評価 |

- 背景: JSポートは `Math.sin/cos/atan2` 依存のためブラウザ間ビット一致は保証されない（コード確認済み。[research/06_gap_2.md](../research/06_gap_2.md) §4.2）。よって決定論契約を上表のとおり「CI内ビット一致 + 実機許容帯」に緩和して確定した（[research/07_decision.md](../research/07_decision.md) §7.2）。

### 3.7 着手週スパイク（実装開始のゲート）

> 根拠: [research/07_decision.md](../research/07_decision.md) §7.3。本書の物理仕様は以下3スパイクの合格を前提とする。

| # | スパイク | 内容 | 合格基準 |
|---|---|---|---|
| 1 | 描線物理方式 | 同一シーン（崖8m + 固定描線 + 車）で A:単一compound / B:自由ヒンジ / C:ばね付きヒンジ / D:weld鎖 × N=8/16/24/32 を切替比較。中級 Android 実機（Snapdragon 6xx / Helio G 系）の Capacitor WebView で計測 | p95 step ≤ 4ms かつ 60fps、C or D で「荷重たわみが視認でき破断が誇張なく決まる」。不合格時のみ方式A+演出たわみへ後退 |
| 2 | カプセル×車輪の接触品質 | Phaser Box2D に未マージ修正PR（#24 カプセル衝突 manifold）があるため最初に検証 | 問題があれば PR 取り込みフォーク or セグメント形状を rounded box に変更 |
| 3 | run-to-run 決定論実測 | 同一レベル×同一描線×1000回実行でハッシュ比較 | CI ゲート（Gate 2）の前提確認 |

### 3.8 コンポーネント分離（環境非依存）

- `Engine`（物理・ルール。**Phaser 非依存・ヘッドレス Node 実行可能** — CI ボット検証の前提）/ `Render`（Phaser。Engine 出力の観測者、書き戻し禁止）/ `Meta`（経済・永続化）/ `Platform`（[FR-022](./functional_requirements.md#fr-022) の各インターフェース）/ `TuningConstants` + レベルJSON に数値全集約（[NFR-010](./non_functional_requirements.md#nfr-010)、[research/07_decision.md](../research/07_decision.md) §7.2）。

---

<a id="gd-4"></a>
## 4. ジュース演出仕様（3場面チェックリスト）

> 根拠: [research/07_decision.md](../research/07_decision.md) §4（完全転記）、一次パラメータは [research/03_juice_research.md](../research/03_juice_research.md)。
> 実装優先度の定義（[research/07_decision.md](../research/07_decision.md) §8.1「必須項目すべて + 推奨項目は入るだけ」）:
> **P0 = 必須（MVP出荷ブロッカー、[KPI-005](./README.md#kpi-005) の対象）/ P1 = 推奨（入るだけ入れる）/ P2 = 任意（余裕があれば）**

<a id="gd-4-1"></a>
### 4.1 場面1: 線を引く瞬間

| # | 項目 | 具体パラメータ | 優先度 | FR | 根拠 |
|---|---|---|---|---|---|
| 1-1 | 入力遅延ゼロ描画 | タッチ座標を同フレーム反映。スムージング（Catmull-Rom / 移動平均）は過去点のみに適用し、線の先端は生タッチ座標に固定 | P0 | [FR-001](./functional_requirements.md#fr-001) | [research/03_juice_research.md](../research/03_juice_research.md) §1.3, §2.1 |
| 1-2 | 頂点間引き | 最小点間距離 4〜8px で頂点追加（RDP 間引きは物理化時） | P0 | [FR-001](./functional_requirements.md#fr-001) | 同 §2.1 |
| 1-3 | 線の太さ・色 | 画面幅の 2〜3%（375pt幅で 8〜12pt）、丸キャップ・丸ジョイント、高コントラスト単色 + 外周 1〜2px の濃色ボーダー | P0 | [FR-001](./functional_requirements.md#fr-001) | 同 §2.1 |
| 1-4 | 描画中ループ音 | ペン/マーカー音。描画速度→音量 0.3→1.0 / ピッチ 1.0→1.2 連動。指が止まったら音も止まる。開始/停止 30〜50ms フェード。ストローク毎に基準ピッチ ±5% ランダム化 | P0 | [FR-010](./functional_requirements.md#fr-010) | 同 §2.2 |
| 1-5 | インク残量バー | リアルタイム減少。>50% 緑 / 20〜50% 黄 / <20% 赤+点滅(300ms)。枯渇時「カスッ」空振り音 + バー横シェイク(4〜6px, 150ms) + warning ハプティクス | P0 | [FR-002](./functional_requirements.md#fr-002) | 同 §2.5 |
| 1-6 | 線確定ポップ | 指を離した瞬間 scale 1.0→1.06→1.0（120ms, ease-out-back）+ 確定音（50〜120ms「コトッ」）+ ハプティクス iOS `.light`（`prepare()` 済）/ Android `PRIMITIVE_TICK`(0.6) | P0 | [FR-003](./functional_requirements.md#fr-003), [FR-014](./functional_requirements.md#fr-014) | 同 §2.4 |
| 1-7 | 物理化の視覚合図 | 確定と同時に線がわずかに落下・たわむ（方式Cのばね物理が演出を無料で提供） | P0 | [FR-003](./functional_requirements.md#fr-003) | [research/07_decision.md](../research/07_decision.md) §4.1 / §7.2 |
| 1-8 | ペン先ダスト | 2〜5個/フレーム（速度比例）、寿命 0.2〜0.5s、サイズ 2〜6px、線色→透明フェード | P1 | [FR-010](./functional_requirements.md#fr-010) | [research/03_juice_research.md](../research/03_juice_research.md) §2.3 |
| 1-9 | 星評価の予告表示 | インク消費量と星閾値の連動を描画中に予告（「この線だと★2」） | P1 | [FR-002](./functional_requirements.md#fr-002) 拡張 | 同 §2.5 |
| 1-10 | 描画中 continuous ハプティクス | iOS intensity 0.2〜0.35 / Android `LOW_TICK` 30〜60ms 間隔 | P2 | [FR-014](./functional_requirements.md#fr-014) 拡張 | 同 §2.4 |

<a id="gd-4-2"></a>
### 4.2 場面2: 車が走り出す瞬間（anticipation → release）

| # | 項目 | 具体パラメータ | 優先度 | FR | 根拠 |
|---|---|---|---|---|---|
| 2-1 | 溜め（儀式） | 0.3〜0.5s 固定・スキップ不可。エンジンレブ音ピッチ 1.0→1.4 上昇 + 車体後傾 squash（後方5〜8°、縦0.92/横1.08、0.2s ease-in）+ 車輪空転・後方に煙 | P0 | [FR-005](./functional_requirements.md#fr-005), [FR-011](./functional_requirements.md#fr-011) | [research/03_juice_research.md](../research/03_juice_research.md) §3.1 |
| 2-2 | 解放 | ダストパーティクル 10〜20個一斉放出 + 車体前方 stretch（横1.15/縦0.9→100msで復帰, ease-out）+ 低域を効かせた発進バースト音（Vlambeer「bassを足せ」）+ ハプティクス iOS `.medium` / Android `PRIMITIVE_THUD`(0.8) | P0 | [FR-011](./functional_requirements.md#fr-011), [FR-014](./functional_requirements.md#fr-014) | 同 §3.1 |
| 2-3 | カメラ | lerp 追従（係数 0.08〜0.15 @60fps）+ look-ahead（進行方向へ車体1〜2台分、速度比例）。発進時カメラキック（逆方向 8〜16px → 0.3s 復帰） | P0 | [FR-011](./functional_requirements.md#fr-011) | 同 §3.2 |
| 2-4 | 車輪回転・サスバウンス | 実速度同期の車輪回転 + wheel joint サスの上下動（Hill Climb Racing の「気持ちよく誇張された物理」基準） | P0 | [FR-005](./functional_requirements.md#fr-005), [FR-011](./functional_requirements.md#fr-011) | 同 §3.3 |
| 2-5 | エンジン音の速度→ピッチ変調 | 1.0→1.5 連続 + 0.25 刻みのギアチェンジ風段付き | P0 | [FR-011](./functional_requirements.md#fr-011) | 同 §3.4 |
| 2-6 | 橋の軋みフィードバック（本作固有） | stress 0.6〜1.0 帯域を (a) 軋みSFX音量/ピッチ (b) 線分色 白→黄→赤 (c) 微振動・粉パーティクル (d) ハプティクス弱連打 にマッピング（Poly Bridge 型応力可視化） | P0 | [FR-006](./functional_requirements.md#fr-006) | [research/07_decision.md](../research/07_decision.md) §4.2、[research/06_gap_1.md](../research/06_gap_1.md) |
| 2-7 | コイン取得音の半音上昇 | 連続取得ごとに +1 semitone（×1.0595）、上限 +12、1〜1.5s 途切れでリセット。取得ポップ（scale 1.0→1.3→0, 150ms）+ キラ粒子 4〜8個 | P0 | [FR-009](./functional_requirements.md#fr-009) | [research/03_juice_research.md](../research/03_juice_research.md) §3.6 |
| 2-8 | 破断時演出 | クラック音 + 破片 + カメラ trauma +=0.5 + 折れ口ハイライト | P0 | [FR-006](./functional_requirements.md#fr-006) | [research/07_decision.md](../research/07_decision.md) §4.2 |
| 2-9 | トラウマ方式 screen shake | `shake = trauma²`、Perlin ノイズ、maxOffset 16〜30px / maxAngle 5〜10°、freq 15〜25Hz。加算目安: 発進0.15 / 着地0.2〜0.3 / クラッシュ0.5 / ゴール0.4 | P1 | [FR-011](./functional_requirements.md#fr-011) | [research/03_juice_research.md](../research/03_juice_research.md) §1.4, §5.2 |
| 2-10 | 速度連動ズームアウト + スピード線 | ズームアウト +10〜20%、スピード線は最高速の60%超で出現 | P1 | [FR-011](./functional_requirements.md#fr-011) | 同 §3.2, §3.3 |
| 2-11 | スキッドマーク・permanence | 急加速・着地点にタイヤ痕。描いた線・破片の痕跡を残す | P1 | [FR-011](./functional_requirements.md#fr-011) | 同 §1.2（Vlambeer trick #8）|
| 2-12 | 着地ハプティクス | `.heavy` / `PRIMITIVE_THUD`(1.0)（大ジャンプ後のみ） | P1 | [FR-014](./functional_requirements.md#fr-014) | 同 §3.5 |
| 2-13 | コインのアーチ状配置 + 取得ハプティクス間引き | 0.1〜0.2s 間隔で取れるリズム配置。ハプティクスは 2〜3枚に1回に間引く | P1 | [FR-009](./functional_requirements.md#fr-009) | 同 §3.6 |

<a id="gd-4-3"></a>
### 4.3 場面3: ゴール（5拍構成、全体3〜4秒・スキップ可）

| # | 項目 | 具体パラメータ | 優先度 | FR | 根拠 |
|---|---|---|---|---|---|
| 3-1 | hit-stop（拍1） | 旗接触フレームで 80〜120ms の完全停止（推奨→必須に格上げ。ゴールの「切断面」を作る） | P0 | [FR-012](./functional_requirements.md#fr-012) | [research/03_juice_research.md](../research/03_juice_research.md) §4.1, §5.1 |
| 3-2 | スローモーション（拍2） | timeScale 0.3 へ即時変更、実時間 0.3〜0.5s 維持 → 0.2〜0.3s で 1.0 へ lerp 復帰。物理の fixedDeltaTime も連動（カクつき防止）。スロー中カメラ 15〜25% ズームイン | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.1 |
| 3-3 | Confetti 2段構成（拍3） | ①ゴール地点から左右2門キャノン（各40〜60個、斜め上45〜70°、拡散30°）②0.3s 遅れて上部から降下レイン（60〜100個、2〜3s）。紙片は回転±720°/s + sin 揺れ、重力0.2〜0.4倍。発射音「ポンッ」×2（左右50msずらし）+ `.heavy` ハプティクス | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.2 |
| 3-4 | 星の順次出現（拍4） | 200〜300ms 間隔、各星 scale 0→1.3→1.0（250ms, ease-out-back）+ 衝撃波リング。音は上昇アルペジオ（ド・ミ・ソ）、3つ目だけ豪華（シンバル追加）。ハプティクス漸増 light→medium→heavy | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.4 |
| 3-5 | 報酬カウントアップ（拍5） | 0→獲得額を 0.8〜1.5s（ease-out）。チック音 30〜60ms 間隔でピッチ 1.0→1.3 上昇。タップで即スキップ | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.5 |
| 3-6 | コインバースト→回収 | 10〜30枚放射爆発 → 各 20〜40ms ずらしでカウンターへ飛行（各0.4〜0.6s, ease-in）。到達ごとに半音上昇チン音 + カウンター scale パンチ(1.0→1.2→1.0, 100ms) | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.3 |
| 3-7 | Next ボタン | 演出完了後 1.5〜2.5s で活性化、脈動誘導（scale ±5%、周期0.8s） | P0 | [FR-012](./functional_requirements.md#fr-012) | 同 §4.6 |
| 3-8 | BGM ダッキング | ゴール瞬間 -6〜-9dB（0.2s）で SFX を立てる | P0 | [FR-012](./functional_requirements.md#fr-012), [NFR-014](./non_functional_requirements.md#nfr-014) | 同 §5.4 |

<a id="gd-4-4"></a>
### 4.4 横断規則（全場面共通）

| # | 項目 | 具体パラメータ | 優先度 | FR/NFR | 根拠 |
|---|---|---|---|---|---|
| X-1 | ハプティクスの端末対応チェック | Android `areAllPrimitivesSupported()` 必須（未対応プリミティブが1つでもあると composition 全体が無音）+ 振幅フォールバック + 設定OFF提供 | P0 | [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020) | [research/03_juice_research.md](../research/03_juice_research.md) §5.5, §8 注意3 |
| X-2 | hit-stop 頻度制限 | 1レベル 1〜2回まで（ゴール・大クラッシュ限定）。「頻繁なアクションほど juice はシンプルに」 | P0 | [NFR-008](./non_functional_requirements.md#nfr-008) | 同 §5.1, §8 注意4 |
| X-3 | 全演出スキップ可・失敗時最軽量 | ゴール演出はタップで即スキップ。失敗は暗転+短い残念音のみ、hit-stop は大クラッシュ時のみ許可（X-2 の回数を共有） | P0 | [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013) | [research/07_decision.md](../research/07_decision.md) §4.3 / §9 リスク10 |
| X-4 | SE のピッチランダム化 | 繰り返し再生される SE は基準ピッチ ±5% ランダム化。同種 SE の同時発音は最大3重 | P0 | [NFR-014](./non_functional_requirements.md#nfr-014) | [research/03_juice_research.md](../research/03_juice_research.md) §5.4 |

---

<a id="gd-5"></a>
## 5. レベルデザイン文法

> 根拠: [research/06_gap_2.md](../research/06_gap_2.md) §1.3（ギミック12類型）・§2（支配戦略対策）・§5（FTUE）・§6.2（解禁ロードマップ）、[research/07_decision.md](../research/07_decision.md) §3.3・§3.4。

<a id="gd-5-1"></a>
### 5.1 ギミック12類型（G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11, G12）

| # | 類型 | 例 | 制約する次元 | 解禁チャプター（初期案） |
|---|---|---|---|---|
| G1 | 静的地形（谷幅・高低差・傾斜・中間支点） | 基本。谷幅がレベルの主パラメータ | 幾何 | **Ch1（MVP）** |
| G2 | インク予算 + 星経済 | 雑な線を経済的に罰する | 経済 | **Ch1（MVP）** |
| G3 | 描画禁止区域 | 直線を幾何的に禁止 | 幾何（否定） | Ch3 |
| G4 | 可動・回転オブジェクト | 動く足場 | 時間 | Ch4 |
| G5 | 破壊ハザード | レーザー・火・砲弾 | 経路否定・耐久 | Ch6 |
| G6 | 動的荷重 | 落下貨物・壊れやすい車 | 構造強度 | Ch2（壊れやすい車）/ Ch5（落下貨物） |
| G7 | 複数車両・対向車 | 全車が衝突せず渡り切る橋形状 | 同時性 | Ch7 |
| G8 | 複数ゴール/ソース | 分岐 | 分岐 | Ch8 以降 |
| G9 | スイッチ・ポータル | 順序ギミック | 順序 | Ch8 |
| G10 | 描画順序依存（複数ストローク） | 支持構造を先に描く | 順序 | Ch8 |
| G11 | 外力 | 風・コンベア | 外力 | Ch9 |
| G12 | 収集スター/コイン配置 | 経路誘導 | 経路誘導 | Ch3（スター）。コイン配置自体は全面共通（[FR-009](./functional_requirements.md#fr-009)） |

- 解禁文法: **1チャプター = 15面、チャプターごとに新ギミック1系統**（10〜15面周期、Cut the Rope 箱文法 + 市場標準）。解禁順は [research/06_gap_2.md](../research/06_gap_2.md) §6.2 を初期値とし、競合実機採取（同 Open Question 1）で補正する。
- Ch2 以降のギミック実装は v1.0 リリースまでのロードマップ項目（[research/07_decision.md](../research/07_decision.md) §8.2）。

<a id="gd-5-2"></a>
### 5.2 Ch1（MVP 15面）の使用範囲

- **使用するのは G1（地形・中間支点）+ G2（インク予算・星）のみ**（[research/07_decision.md](../research/07_decision.md) §8.1）。
- 橋のたわみ・軋み・破断（[FR-006](./functional_requirements.md#fr-006)）と失敗条件（落下・転倒・タイムアウト、[FR-008](./functional_requirements.md#fr-008)）はギミックではなくコア物理であり、Ch1 の全面で常時有効。これにより「谷幅 > 安定スパン」「急坂着地で転倒」を G1 の地形パラメータだけで難所化できる（[research/06_gap_2.md](../research/06_gap_2.md) §2.1 パターン (c)）。

<a id="gd-5-3"></a>
### 5.3 ノコギリ波難易度

- チャプター内は「**教習面（失敗させない）→ 積み上げ → クライマックス → 息抜き**」の繰り返し。単調増加は禁止（[research/06_gap_2.md](../research/06_gap_2.md) §3.2）。
- Ch1 の波形: L1-L3 教習 → L4-L5 積み上げ → L6 息抜き → L7-L9 積み上げ → L10 中間クライマックス → L11 息抜き → L12-L14 積み上げ → L15 チャプターボス（§6 の表を参照）。
- 難易度の実測: ローンチ前はボット群による難易度推定（[research/06_gap_2.md](../research/06_gap_2.md) §3.3, §4.5 の構想。MVP の Gate 0, Gate 1, Gate 2, Gate 3（[FR-026](./functional_requirements.md#fr-026)）の対象外で、ソフトローンチ前に非ブロッキング計測として導入予定）を用い、その成功率・試行回数中央値を難易度プロキシとする。

<a id="gd-5-4"></a>
### 5.4 FTUE 3面設計（[FR-017](./functional_requirements.md#fr-017)）

| 面 | 役割 | 数値契約 |
|---|---|---|
| L1 | 狭い谷 + 潤沢インク。「どんな線でも渡れる」= 失敗がほぼ不可能な初成功 | 初成功まで ≤10秒、クリア ≤25秒（[KPI-003](./README.md#kpi-003)） |
| L2 | インクメーターと星の学習（直線で星3が取れる） | — |
| L3 | 成功の定着（雑な線だと星2に落ちる） | L1-L3 合計 60〜90秒で3連続成功 |

- **テキストチュートリアル禁止** — 指アイコンのなぞり誘導のみ。学びはプレイに埋め込む（[research/06_gap_2.md](../research/06_gap_2.md) §5「テキストチュートリアル禁止」「45秒以内にコア快感」）。
- 45秒以内にフル快感（描く→走る→ゴール5拍演出）を必ず1回体験させる（[research/07_decision.md](../research/07_decision.md) §3.4）。

<a id="gd-5-5"></a>
### 5.5 支配戦略（直線1本）対策の重ね掛け

> 単一の銀の弾丸ではなく「経済 × 幾何 × 動力学」の重ね掛けで無効化する（[research/06_gap_2.md](../research/06_gap_2.md) §2.3、[research/07_decision.md](../research/07_decision.md) §3.3）。

| 段階 | 層 | 機序 | 適用チャプター |
|---|---|---|---|
| 序盤 | 経済（G2） | 直線でもクリア可、ただし星が減る | Ch1 前半 |
| 序盤後半 | 幾何+構造（G1 × コア物理） | 谷幅 > 安定スパン（支持なし直線は自重+車重でたわみ・破断）、中間支点の強制、急坂直線は転倒 | Ch1 後半 |
| 中盤 | 幾何否定（G3） | 禁止区域で直線が幾何的に不成立 | Ch3 以降 |
| 後半 | 動力学（G5, G6, G7） | 静的には成立する直線が動的に破綻 | Ch5 以降 |

- **テスト契約化**: `anti-dominant` タグ面で直線1本ボット（両崖の縁を結ぶ線分1本）が成功したらビルド失敗（Gate 3、[FR-026](./functional_requirements.md#fr-026)、[KPI-004](./README.md#kpi-004)）。同梱15面のうち anti-dominant タグ面は §6 の表で指定する。
- 直線以外の準自明解（L字・浅いV字）をボット定義域に含めるかは、ゲームフィール実装後のプレイテストで判断する（[research/06_gap_2.md](../research/06_gap_2.md) Open Question 4）。

<a id="gd-5-6"></a>
### 5.6 星閾値設計の指針

- 星 = **インク消費量の閾値**（少なく描くほど高評価、Happy Glass 方式）。星1はクリアのみで確定、レベルJSONは `star2` / `star3` の閾値2値を保持する（[FR-007](./functional_requirements.md#fr-007)）。
- 初期比率の指針（[research/06_gap_2.md](../research/06_gap_2.md) §6.1 の例 `budget 220 / star2 140 / star3 90` からの導出比）: **star2 ≈ インク予算の 60〜70% / star3 ≈ 40〜50%**。最終値はエディタの星3ゴースト解の実測消費量で面ごとに校正する。
- 検証との接続: 各面のゴースト解（`kind: "3star"`）が star3 閾値を満たすことを Gate 2 で assert する（[research/06_gap_2.md](../research/06_gap_2.md) §4.4「星閾値達成を assert」、[FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026)）。
- 基本インク（アップグレード Lv0）で全レベルクリア可能を維持する（[FR-019](./functional_requirements.md#fr-019)）。星3がアップグレード前提になる面を Ch1 に置くことは禁止（FTUE 保護。後半チャプターでの「未強化では星3が届かない」設計は v1.1 以降、[research/07_decision.md](../research/07_decision.md) §5.1 設計原則）。

---

<a id="gd-6"></a>
## 6. Ch1 15面 + ボーナス3面の面別ラフ仕様

> 根拠: [research/06_gap_2.md](../research/06_gap_2.md) §5（最初の10面への翻訳案）を Ch1 スコープ（G1+G2+中間支点のみ、[research/07_decision.md](../research/07_decision.md) §8.1）へ具体化。
> **詳細座標・地形頂点・インク予算の実数値は、インゲームレベルエディタ（[FR-024](./functional_requirements.md#fr-024)）で実装時に作成し、Gate 0〜3 通過（[FR-026](./functional_requirements.md#fr-026)）を保存条件とする。本表は学習目標とトポロジーの設計意図を固定するラフ仕様である。**
>
> インク予算感の凡例（Gate 1 の静的妥当性検査「インク予算 ≥ 最小必要スパン × 係数」と同一尺度。係数の実値はエディタ実測で確定）: **潤沢** = 最小スパンの約2.5〜3.0倍 / **標準** = 約1.8〜2.2倍 / **タイト** = 約1.3〜1.6倍（初期案）。

| 面 | 学習目標 | 地形トポロジー概要 | ギミック | インク予算感 | anti-dominant |
|---|---|---|---|---|---|
| L1 | 描く→走る→ゴールの初体験（10秒で初成功） | 同高度の狭い谷1つ | G1 | 潤沢 | なし |
| L2 | インクメーターと星の学習（直線で星3可） | 狭い谷 + わずかな段差 | G1+G2 | 潤沢 | なし |
| L3 | 成功の定着（雑な線は星2に落ちる） | やや広い谷 | G1+G2 | 標準 | なし |
| L4 | 中間支点の発見（支点に載せると得） | 谷中央に岩柱（中間支点）1本 | G1(支点)+G2 | 標準 | なし |
| L5 | 「星3には曲線（アーチ）が要る」初面 | 広めの谷 + 低い対岸 | G1+G2 | 標準（星3はタイト） | なし |
| **B1** | ボーナス面（L5クリア後解放） | 平坦ロングラン + コインアーチ | G1+コイン配置 | 潤沢 | なし |
| L6 | 息抜き（ノコギリ波の谷） | 短スパンの狭い谷2連 | G1+G2 | 潤沢 | なし |
| L7 | 傾斜・登坂（斜面へ橋を架ける） | 上り勾配の対岸（高低差プラス） | G1+G2 | 標準 | なし |
| L8 | たわみ・軋み・破断の初体験 | 谷幅が直線の安定スパンを超える広い谷。谷壁の岩棚を経由するV字 or 深いアーチで荷重分散 | G1+G2 | 標準 | **あり**（直線は自重+車重で破断） |
| L9 | 支点 + 予算の複合（支点に載せて短く描く） | 広い谷 + 中央からずれたオフセット支点 | G1(支点)+G2 | タイト | なし |
| L10 | 中間クライマックス（支点2本 + 高低差の複合） | 二段谷（下り→上り）、支点2本 | G1(支点×2)+G2 | 標準 | **あり**（直線はインク予算超過で不成立） |
| **B2** | ボーナス面（L10クリア後解放） | 緩い下り + コインアーチ3連 | G1+コイン配置 | 潤沢 | なし |
| L11 | 息抜き（下り勾配で勢い任せ） | 下り→小ギャップ | G1+G2 | 潤沢 | なし |
| L12 | 着地角の管理（急角度の直線滑走は転倒する） | 高所→低所の大落差 | G1+G2 | 標準 | **あり**（直線は急角度滑走で転倒判定） |
| L13 | 支点の選択（複数支点から正しい1本を選ぶ） | 広い谷 + 高さの異なる支点2本（低い側はトラップ） | G1(支点×2)+G2 | 標準（星3はタイト） | なし |
| L14 | 精密描画（張り出し地形の下をくぐる線） | 谷 + 対岸手前に張り出した岩庇（直線経路を静的地形で塞ぐ） | G1+G2 | タイト | **あり**（直線は岩庇に衝突して不成立） |
| L15 | チャプターボス（既習全部: 支点+高低差+長スパン+タイト予算） | 二段谷 + 支点 + 登坂ゴール | G1(支点)+G2 | タイト | **あり** |
| **B3** | ボーナス面（L15=チャプター完走後解放） | 平坦ロングラン + コイン大量配置 | G1+コイン配置 | 潤沢 | なし |

- anti-dominant タグ面は 5面（L8, L10, L12, L14, L15）。全て G1+G2 の範囲内の機序（破断・予算超過・転倒・静的地形の幾何否定）で直線を排除しており、Ch1 に新ギミック実装は不要。
- 全18面（L1〜L15 + B1〜B3）にゴースト解 ≥1本（星3解を含む面は2本）を添付し、Gate 0〜3 を 100% 通過させる（[KPI-004](./README.md#kpi-004)、[FR-015](./functional_requirements.md#fr-015)）。
- コイン配置は全面共通仕様（アーチ状 0.1〜0.2s 間隔のリズム配置、[FR-009](./functional_requirements.md#fr-009)）。

---

<a id="gd-7"></a>
## 7. メタ進行仕様

> 根拠: [research/07_decision.md](../research/07_decision.md) §5（メタ進行）・§3.5（セッション設計）、[research/04_meta_powerups.md](../research/04_meta_powerups.md)。MVP のメタは「単一ソフト通貨 + アップグレード2軸 + ボーナス面」に限定（[research/07_decision.md](../research/07_decision.md) §8.1）。

<a id="gd-7-1"></a>
### 7.1 アップグレード2軸の効果式（[FR-019](./functional_requirements.md#fr-019)）

| 軸（UL 正式名） | 効果式（物理パラメータへの実乗算。ダミー禁止） | Lv上限 | 設計意図 |
|---|---|---|---|
| **Ink Capacity**（インク量） | `effectiveInkBudget = level.inkBudget × (1 + 0.10 × inkCapacityLv)`（Lv5 で +50%） | 5 | コア動詞「描く」の解空間を直接拡張。吊り橋・二重支持の創造的解が解禁。**基本インク（Lv0）で全レベルクリア可能を維持** |
| **Engine Speed**（車速） | `effectiveMotorSpeed = baseMotorSpeed × (1 + 0.05 × engineSpeedLv)`（Lv5 で +25%） | 5 | 物理走行で最も体感される軸。勢いでギャップを飛ぶ新解法を生む。**速度↑ = 描画精度要求↑のリスクリターン設計**で数値インフレ化を防ぐ |

- 検証パイプライン（Gate 2〜3）は常に **Lv0（基準パラメータ）** でリプレイ実行する。ゴースト解は Lv0 で記録するため、「基本インクで全レベルクリア可能」が CI で機械的に保証される。
- v1.0 のキャップは各5Lv（[research/07_decision.md](../research/07_decision.md) §8.1）。§5.1 の長期キャップ（インク 6〜10Lv / 車速 10〜15Lv）への拡張は v1.1 以降のロードマップ。

<a id="gd-7-2"></a>
### 7.2 価格表（Lv1〜5 の具体数値案）

> 導出: 初回 50〜100 コイン × 緩指数 ×1.15〜1.25/Lv（[research/07_decision.md](../research/07_decision.md) §5.2、HCR2 実測準拠）。初期値として **初回75 / 成長率 ×1.20**（両レンジの中央値）を採り、5の倍数へ丸める。両軸同一価格。

| Lv | 価格（コイン） | 累計 | 効果（Ink Capacity） | 効果（Engine Speed） |
|---|---|---|---|---|
| 1 | 75 | 75 | +10% | +5% |
| 2 | 90 | 165 | +20% | +10% |
| 3 | 110 | 275 | +30% | +15% |
| 4 | 130 | 405 | +40% | +20% |
| 5 | 155 | 560 | +50% | +25% |

- 片軸フル = 560 コイン、両軸フル = **1,120 コイン**。
- 初回価格 75 は「チュートリアル後 2〜3面以内に買える」（HCR2 Free-Until パターン、[research/07_decision.md](../research/07_decision.md) §5.2）を満たす: L1〜L3 の獲得見込み ≈ 75〜105 コイン（§7.3）。
- 購入 UX: 価格・現在Lv・次Lv効果を購入前に明示、残高不足はボタン非活性 + 不足額表示、購入は即時・Undo なし（誤購入防止に価格を大きく表示。[FR-019](./functional_requirements.md#fr-019)）。

<a id="gd-7-3"></a>
### 7.3 コイン獲得/消費バランス表

| 項目 | 初期値（調整範囲） | 根拠 |
|---|---|---|
| 通常クリア報酬 | 25 コイン/面（20〜30。ほぼ一定、**獲得側を指数にしない**） | [research/07_decision.md](../research/07_decision.md) §5.2（Draw Climber 実測） |
| レベル内配置コイン | 5〜10 枚/面 × 1コイン/枚（初期案。エディタで面ごとに配置） | [FR-009](./functional_requirements.md#fr-009)。枚数はエディタ実測で校正 |
| ボーナス面報酬 | 150 コイン（通常の6倍。範囲 5〜10倍） | [research/07_decision.md](../research/07_decision.md) §5.2 |
| Ch1 一周の想定総獲得 | ≈ 935 コイン（クリア報酬 15×25=375 + 収集 ≈110 + ボーナス 3×150=450） | 上記の積算 |
| 総シンク（両軸フル） | 1,120 コイン | §7.2 |
| 獲得/シンク比 | ≈ 0.83（一周で片軸フル + もう片軸 Lv3 相当。両軸フルには星3リプレイ・ボーナス面再訪が必要） | リプレイ動機の設計 |

- 全取引（獲得・消費）は `earn_virtual_currency` / `spend_virtual_currency` イベントとして記録する（[FR-018](./functional_requirements.md#fr-018), [FR-022](./functional_requirements.md#fr-022)。v1.0 は NoopAnalytics）。
- 長期シンク原則「全コンテンツ総額 ≥ 日次獲得量の100倍」（[research/07_decision.md](../research/07_decision.md) §5.2）はフルゲーム（Ch2 以降 + 車両ガチャ導入時）で適用する。MVP は上表の比率で開始し、`TuningConstants` の経済ブロックで調整する。
- リプレイ時のコイン再獲得ポリシー（再収集可否）は research に決定がないため、実装時に「収集コインは初回のみ・クリア報酬は毎回」を初期値としてプレイテストで確定する（Open Item として [FR-018](./functional_requirements.md#fr-018) の実装時に決定）。

<a id="gd-7-4"></a>
### 7.4 ボーナス面

| 項目 | 仕様 |
|---|---|
| 出現間隔 | 5面ごと（L5, L10, L15 クリア後に解放。Ch1 では B1, B2, B3 の3面） |
| 報酬 | 通常の5〜10倍（初期値6倍 = 150 コイン） |
| 内容 | コイン収集特化のロングラン面（§6 の B1〜B3）。失敗条件は通常面と同一 |
| 将来接続 | リワード広告の接続点（「受取×2」プレースメント）。v1.0 は `AdInterface` の placement 定数のみ予約し UI 導線はフラグで非表示（[FR-022](./functional_requirements.md#fr-022)） |
| レベル選択での扱い | ボーナス面の視覚区別を表示（[FR-016](./functional_requirements.md#fr-016), [SC-002](./functional_requirements.md#sc-002)） |

> 根拠: [research/07_decision.md](../research/07_decision.md) §3.5・§5.2・§6.2、[research/04_meta_powerups.md](../research/04_meta_powerups.md) §1.2。

---

<a id="gd-8"></a>
## 8. チューニング表（TuningConstants 初期値一覧）

> 全パラメータは `TuningConstants` に集約し、デバッグチューニングパネル（[FR-025](./functional_requirements.md#fr-025)）のスライダで実行中に変更できる。**初期値はレンジ中央値（丸め）、調整範囲は research の裏取りレンジ**。レベル固有値（インク予算・星閾値・maxTicks）はレベルJSON側（[FR-015](./functional_requirements.md#fr-015)）。

### 8.1 物理（[research/07_decision.md](../research/07_decision.md) §7.2）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `physics.fixedDt` | 1/60 | 固定（変更禁止。決定論契約の前提） |
| `physics.subStepCount` | 4 | 4〜8 |
| `physics.segmentLength` | 0.65 m | 0.5〜0.8 m |
| `physics.segmentCountStart` | 12 | 8〜24 |
| `physics.segmentCountMax` | 32 | 固定上限 |
| `physics.divergenceSpeedMax`（発散判定の速度上限） | 80 m/s | 50〜150 m/s |
| `bridge.jointHertz` | 6 | 4〜8 |
| `bridge.jointDampingRatio` | 0.7 | 0.6〜0.8 |
| `bridge.jointAngleLimit` | ±0.3 rad | ±0.2〜0.4 rad |
| `bridge.breakForceFactor`（車静止荷重比） | 2.5 | 2〜3 |
| `bridge.stressEmaKeep` / `stressEmaNew` | 0.85 / 0.15 | 固定（変更時は軋み演出と再校正） |
| `bridge.creakBandMin` | 0.6 | 0.5〜0.8 |
| `bridge.strokeMassToCarRatio` | 0.5 | 0.3〜1.0 |
| `bridge.debrisFadeDelaySec`（孤立チェーン片） | 3.0 s | 2〜5 s |
| `car.suspensionHertz` | 4 | 3〜6 |
| `car.suspensionDampingRatio` | 0.7 | 0.5〜0.9 |
| `car.tireFriction` | 1.0 | 0.8〜1.2 |
| `car.surfaceFriction`（地形・描線） | 0.75 | 0.6〜0.9 |
| `car.restitution` | 0 | 固定 |
| `fail.tipOverTimeSec` | 0.5 s | 0.3〜1.0 s |
| `fail.maxTicksDefault` | 1800（30s） | レベルJSONで上書き可 |

### 8.2 カメラ（[research/03_juice_research.md](../research/03_juice_research.md) §3.2, §5.2）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `camera.followLerp` | 0.10 | 0.08〜0.15 |
| `camera.lookAheadCarLengths` | 1.5 | 1〜2（速度比例） |
| `camera.launchKickPx` | 12 px | 8〜16 px |
| `camera.launchKickRecoverSec` | 0.3 s | 固定 |
| `camera.traumaDecayPerSec` | 1.2 | 1.0〜1.5 |
| `camera.shakeMaxOffsetPx` | 20 px | 16〜30 px（画面幅の2〜4%） |
| `camera.shakeMaxAngleDeg` | 7° | 5〜10° |
| `camera.shakeFreqHz` | 20 Hz | 15〜25 Hz |
| `camera.traumaLaunch` / `traumaLand` / `traumaCrash` / `traumaGoal` | 0.15 / 0.25 / 0.5 / 0.4 | 着地のみ 0.2〜0.3 |
| `camera.speedZoomOutPct` | 15% | 10〜20% |
| `camera.goalZoomInPct` | 20% | 15〜25% |

### 8.3 Juice — 描画（[research/03_juice_research.md](../research/03_juice_research.md) §2）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `draw.minPointDistPx` | 6 px | 4〜8 px |
| `draw.lineWidthScreenPct` | 2.5% | 2〜3%（375pt幅で 8〜12pt） |
| `draw.borderWidthPx` | 1.5 px | 1〜2 px |
| `draw.confirmPopScale` / `confirmPopMs` | 1.06 / 120 ms | 固定 / 100〜150 ms |
| `draw.loopVolumeMin→Max` | 0.3→1.0 | 固定レンジ |
| `draw.loopPitchMin→Max` | 1.0→1.2 | 固定レンジ |
| `draw.loopFadeMs` | 40 ms | 30〜50 ms |
| `draw.pitchRandomPct` | ±5% | ±5〜10% |
| `draw.penDustPerFrame` | 3 | 2〜5（速度比例） |
| `ink.warnYellowRatio` / `warnRedRatio` | 0.5 / 0.2 | 固定 |
| `ink.blinkPeriodMs` | 300 ms | 固定 |
| `ink.depleteShakePx` / `depleteShakeMs` | 5 px / 150 ms | 4〜6 px / 固定 |

### 8.4 Juice — 発進・走行（[research/03_juice_research.md](../research/03_juice_research.md) §3）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `launch.anticipationSec` | 0.4 s | 0.3〜0.5 s |
| `launch.revPitchMax` | 1.4 | 固定 |
| `launch.squashTiltDeg` | 6.5° | 5〜8° |
| `launch.squashScaleY/X` | 0.92 / 1.08（0.2s ease-in） | 固定 |
| `launch.stretchScaleX/Y` | 1.15 / 0.9（100ms 復帰） | 固定 |
| `launch.dustCount` | 15 | 10〜20 |
| `engine.pitchMax` | 1.5 | 固定 |
| `engine.gearStep` | 0.25 | 固定 |
| `speedLines.thresholdRatio`（最高速比） | 0.6 | 固定 |
| `coin.popScale` / `popMs` | 1.3 / 150 ms | 固定 |
| `coin.sparkleCount` | 6 | 4〜8 |
| `coin.semitoneStep` / `semitoneMax` | +1（×1.0595）/ +12 | 固定 |
| `coin.comboResetSec` | 1.25 s | 1〜1.5 s |
| `coin.placementIntervalSec` | 0.15 s | 0.1〜0.2 s |
| `coin.hapticThinning`（N枚に1回） | 3 | 2〜3 |

### 8.5 Juice — ゴール5拍（[research/03_juice_research.md](../research/03_juice_research.md) §4）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `goal.hitStopMs` | 100 ms | 80〜120 ms |
| `goal.slowTimeScale` | 0.3 | 固定 |
| `goal.slowHoldSec` / `slowRecoverSec` | 0.4 / 0.25 s | 0.3〜0.5 / 0.2〜0.3 s |
| `goal.confettiCannonCount`（左右各） | 50 | 40〜60 |
| `goal.confettiRainCount` | 80 | 60〜100 |
| `goal.confettiGravityScale` | 0.3 | 0.2〜0.4 |
| `goal.confettiSpinDegPerSec` | ±720°/s | 固定 |
| `goal.starIntervalMs` / `starPopMs` | 250 / 250 ms | 200〜300 / 固定 |
| `goal.countUpSec` | 1.2 s | 0.8〜1.5 s |
| `goal.tickSoundIntervalMs` | 45 ms | 30〜60 ms |
| `goal.coinBurstCount` | 20 | 10〜30 |
| `goal.coinFlightSec` / `coinStaggerMs` | 0.5 s / 30 ms | 0.4〜0.6 s / 20〜40 ms |
| `goal.nextActivateDelaySec` | 2.0 s | 1.5〜2.5 s |
| `goal.nextPulseScalePct` / `nextPulsePeriodSec` | ±5% / 0.8 s | 固定 |
| `audio.bgmDuckDb` / `bgmDuckAttackSec` | -7.5 dB / 0.2 s | -6〜-9 dB / 固定 |
| `audio.maxSameSfxVoices` | 3 | 固定（[NFR-014](./non_functional_requirements.md#nfr-014)） |

### 8.6 ハプティクス（[research/03_juice_research.md](../research/03_juice_research.md) §5.5、[FR-014](./functional_requirements.md#fr-014)）

| 定数（イベント） | iOS | Android（API 30+） | 強度 |
|---|---|---|---|
| `haptic.confirm`（線確定） | `.light`（`prepare()` 済） | `PRIMITIVE_TICK` | 0.6 |
| `haptic.launch`（発進） | `.medium` | `PRIMITIVE_THUD` | 0.8 |
| `haptic.land`（着地、大ジャンプ後のみ） | `.heavy` | `PRIMITIVE_THUD` | 1.0 |
| `haptic.coin`（間引き 3枚に1回） | `.light` | `PRIMITIVE_TICK` | 0.4 |
| `haptic.creak`（軋み） | weak 連打 | `PRIMITIVE_LOW_TICK` 連打 | stress 比例 |
| `haptic.starSequence`（星） | light→medium→heavy 漸増 | TICK→CLICK→THUD 連結 | 漸増 |
| `haptic.inkDepleted`（枯渇） | `.notificationOccurred(.warning)` | `EFFECT_DOUBLE_CLICK` | — |

### 8.7 経済（[research/07_decision.md](../research/07_decision.md) §5.2、本書 §7）

| 定数 | 初期値 | 調整範囲 |
|---|---|---|
| `economy.clearReward` | 25 | 20〜30 |
| `economy.bonusMultiplier` | 6 | 5〜10 |
| `economy.upgradePriceBase` | 75 | 50〜100 |
| `economy.upgradePriceGrowth` | 1.20 | 1.15〜1.25 |
| `economy.inkPerLevelPct` | 10% | 固定（[FR-019](./functional_requirements.md#fr-019)） |
| `economy.speedPerLevelPct` | 5% | 固定（[FR-019](./functional_requirements.md#fr-019)） |
| `economy.maxUpgradeLevel` | 5 | v1.1+ で拡張（§7.1） |
| `economy.bonusLevelInterval` | 5面 | 固定 |
| `ads.*`（プレースメントID・頻度キャップ） | 定数のみ定義、v1.0 は未使用 | Remote Config 化前提（[research/07_decision.md](../research/07_decision.md) §6.1） |

---

[← 設定](./workflow_config.md) | [📋 目次](./README.md) | [機能要件 →](./functional_requirements.md)

# 機能要件 — InkBridge（仮）MVP

> [📋 目次](./README.md) | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | **機能要件** | [非機能要件](./non_functional_requirements.md) | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

機能要件とは、**「システムが何をするか」**を定義したものです。全26要件（[FR-001](#fr-001), [FR-002](#fr-002), [FR-003](#fr-003), [FR-004](#fr-004), [FR-005](#fr-005), [FR-006](#fr-006), [FR-007](#fr-007), [FR-008](#fr-008), [FR-009](#fr-009), [FR-010](#fr-010), [FR-011](#fr-011), [FR-012](#fr-012), [FR-013](#fr-013), [FR-014](#fr-014), [FR-015](#fr-015), [FR-016](#fr-016), [FR-017](#fr-017), [FR-018](#fr-018), [FR-019](#fr-019), [FR-020](#fr-020), [FR-021](#fr-021), [FR-022](#fr-022), [FR-023](#fr-023), [FR-024](#fr-024), [FR-025](#fr-025), [FR-026](#fr-026)）はいずれも MVP（フェーズ1）の出荷条件であり優先度 Must です。数値仕様の単一の正は [research/07_decision.md](../research/07_decision.md)、パラメータ初期値の一覧は [game_design.md](./game_design.md) §8 にあります。アクターは [README](./README.md) に定義された Player / Level Author / System の3者です。

カテゴリ: **A**=描画 / **B**=走行・審判 / **C**=演出 / **D**=レベル・進行 / **E**=メタ・経済 / **F**=プラットフォーム基盤 / **G**=オーサリング・品質ゲート

---

## 要件サマリー

| ID | タイトル | カテゴリ | アクター | 優先度 | 関連KPI |
| --- | --- | --- | --- | --- | --- |
| [FR-001](#fr-001) | 一筆書き線描画 | A | Player | Must | [KPI-002](./README.md#kpi-002) |
| [FR-002](#fr-002) | インク残量管理 | A | Player / System | Must | [KPI-002](./README.md#kpi-002), [KPI-005](./README.md#kpi-005) |
| [FR-003](#fr-003) | 線の確定と物理化 | A | Player / System | Must | [KPI-001](./README.md#kpi-001), [KPI-005](./README.md#kpi-005) |
| [FR-004](#fr-004) | リスタート制御 | A / B | Player | Must | [KPI-003](./README.md#kpi-003) |
| [FR-005](#fr-005) | 車両自動発進・走行 | B | System | Must | [KPI-001](./README.md#kpi-001), [KPI-003](./README.md#kpi-003) |
| [FR-006](#fr-006) | 橋の応力・軋み・破断 | B | System | Must | [KPI-001](./README.md#kpi-001), [KPI-005](./README.md#kpi-005) |
| [FR-007](#fr-007) | クリア判定と星評価 | B | System | Must | [KPI-003](./README.md#kpi-003) |
| [FR-008](#fr-008) | 失敗判定と因果提示 | B | System | Must | [KPI-003](./README.md#kpi-003) |
| [FR-009](#fr-009) | コイン収集・報酬 | B / E | Player / System | Must | [KPI-005](./README.md#kpi-005) |
| [FR-010](#fr-010) | 描画ジュース | C | System | Must | [KPI-005](./README.md#kpi-005) |
| [FR-011](#fr-011) | 発進・走行ジュース | C | System | Must | [KPI-005](./README.md#kpi-005) |
| [FR-012](#fr-012) | ゴール5拍演出 | C | System | Must | [KPI-003](./README.md#kpi-003), [KPI-005](./README.md#kpi-005) |
| [FR-013](#fr-013) | 失敗演出（軽量） | C | System | Must | [KPI-003](./README.md#kpi-003) |
| [FR-014](#fr-014) | ハプティクス統合 | C | System | Must | [KPI-002](./README.md#kpi-002), [KPI-005](./README.md#kpi-005) |
| [FR-015](#fr-015) | レベルロード・進行管理 | D | System | Must | [KPI-004](./README.md#kpi-004) |
| [FR-016](#fr-016) | レベル選択 | D | Player | Must | — |
| [FR-017](#fr-017) | FTUE（最初の3面） | D | Player / System | Must | [KPI-003](./README.md#kpi-003) |
| [FR-018](#fr-018) | コイン残高・経済 | E | Player / System | Must | — |
| [FR-019](#fr-019) | アップグレード購入 | E | Player | Must | — |
| [FR-020](#fr-020) | 設定 | E | Player | Must | — |
| [FR-021](#fr-021) | 進行データ永続化 | E | System | Must | — |
| [FR-022](#fr-022) | Platform 抽象層 | F | System | Must | — |
| [FR-023](#fr-023) | Capacitor ネイティブシェル | F | System | Must | [KPI-001](./README.md#kpi-001) |
| [FR-024](#fr-024) | インゲームレベルエディタ | G | Level Author | Must | [KPI-004](./README.md#kpi-004) |
| [FR-025](#fr-025) | デバッグチューニングパネル | G | Level Author | Must | [KPI-001](./README.md#kpi-001) |
| [FR-026](#fr-026) | レベル検証パイプライン | G | System | Must | [KPI-004](./README.md#kpi-004) |

FR→US の対応は [user_stories.md](./user_stories.md) のストーリーマップ（各USのソースFR欄）を参照。

---

<a id="screens"></a>
## 画面一覧 / Screens (SC)

> 💡 機能要件から導出した全画面。UIデザインの対象範囲（[ui_design_brief.md](./ui_design_brief.md)）と [ux_protocol.md](./ux_protocol.md) の対象。[SC-009](#sc-009) と [SC-010](#sc-010) は開発ビルド限定でリリースビルドから除外する。

| ID | 画面名 | 優先度 | 状態 | ソースFR | 備考 |
| --- | --- | --- | --- | --- | --- |
| <a id="sc-001"></a>[SC-001](#sc-001) | タイトル/ホーム | Must | — | [FR-016](#fr-016), [FR-018](#fr-018) | Play・コイン残高・設定入口・ショップ入口。起動→2タップ以内でプレイ開始 |
| <a id="sc-002"></a>[SC-002](#sc-002) | レベル選択 | Must | — | [FR-015](#fr-015), [FR-016](#fr-016) | チャプター、面ごとの星/クリア状態、ボーナス面の視覚区別。解放済み面の再プレイ可 |
| <a id="sc-003"></a>[SC-003](#sc-003) | ゲームプレイ（描画フェーズ） | Must | — | [FR-001](#fr-001), [FR-002](#fr-002), [FR-003](#fr-003), [FR-004](#fr-004), [FR-010](#fr-010), [FR-017](#fr-017) | インク残量バー、レベル番号、リスタート、地形+車+旗の静止俯瞰。解くべき地形が一目で読める |
| <a id="sc-004"></a>[SC-004](#sc-004) | ゲームプレイ（走行フェーズ） | Must | — | [FR-004](#fr-004), [FR-005](#fr-005), [FR-006](#fr-006), [FR-007](#fr-007), [FR-008](#fr-008), [FR-009](#fr-009), [FR-011](#fr-011) | カメラ追従、リスタート常設。描画UIは非表示化 |
| <a id="sc-005"></a>[SC-005](#sc-005) | クリアリザルト | Must | — | [FR-007](#fr-007), [FR-009](#fr-009), [FR-012](#fr-012), [FR-018](#fr-018) | 5拍演出、星3、獲得コイン、Next/Replay。全演出タップスキップ可 |
| <a id="sc-006"></a>[SC-006](#sc-006) | 失敗リザルト | Must | — | [FR-004](#fr-004), [FR-008](#fr-008), [FR-013](#fr-013) | 失敗原因ハイライト、Retry 即時。演出最軽量・罰なし |
| <a id="sc-007"></a>[SC-007](#sc-007) | アップグレードショップ | Must | — | [FR-018](#fr-018), [FR-019](#fr-019) | インク量/車速の Lv・価格・効果、残高。効果は数値+ビジュアルで明示 |
| <a id="sc-008"></a>[SC-008](#sc-008) | 設定 | Must | — | [FR-014](#fr-014), [FR-020](#fr-020) | サウンド/ハプティクス ON/OFF、進行リセット（二重確認）、クレジット |
| <a id="sc-009"></a>[SC-009](#sc-009) | レベルエディタ（開発ビルド限定） | Must | — | [FR-024](#fr-024) | 地形頂点編集、ギミック配置、インク予算/星閾値、JSON出力、ゴースト解保存 |
| <a id="sc-010"></a>[SC-010](#sc-010) | デバッグチューニングパネル（開発ビルド限定） | Must | — | [FR-025](#fr-025) | 物理/カメラ/juice パラメータのスライダ、fps/step 表示。TuningConstants 連動 |

Status: `—` = 未着手 / `WF済` = ワイヤーフレーム完了 / `MK済` = モックアップ完了

---

## カテゴリ別要件

### A. 描画 / Drawing

<a id="fr-001"></a>

#### FR-001: 一筆書き線描画 — Must

> **関連:** KPI: [KPI-002](./README.md#kpi-002) | NFR: [NFR-002](./non_functional_requirements.md#nfr-002), [NFR-005](./non_functional_requirements.md#nfr-005) | SC: [SC-003](#sc-003) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.1・§3.1 / [game_design.md](./game_design.md#gd-4-1) §4.1

- **説明 / Description**: プレイヤーが画面のドラッグで1ストロークの線を描く。線の先端は生タッチ座標を同フレームで反映し、平滑化（Catmull-Rom または移動平均）は過去点のみに適用する（Swink 即時応答原則）。
- **アクター / Actor**: Player（描画操作）。System（頂点管理・描画）。
- **事前条件 / Precondition**: レベルがロード済みで描画フェーズ（[SC-003](#sc-003)）にある。インク残量 > 0。当該レベルでまだ線を確定していない（1レベル1ストローク）。
- **トリガー / Trigger**: 描画可能領域へのタッチダウン（pointerdown。マウスの場合は mousedown）。
- **主フロー / Main Flow**:
  1. タッチダウン位置を始点として頂点列（ポリライン）に追加する。
  2. ドラッグ中、直前頂点からの距離が最小点間距離 4〜8px を超えるたびに新頂点を追加する（RDP 間引きは物理化時 = [FR-003](#fr-003) で実施）。
  3. 線の先端はタッチの生座標を同フレーム（60fps 基準 16.7ms 以内）で描画へ反映する。平滑化は先端を除く過去頂点にのみ適用する。
  4. 線を太さ画面幅 2〜3%（375pt 幅で 8〜12pt）、丸キャップ・丸ジョイント、高コントラスト単色 + 外周 1〜2px の濃色ボーダーで描画する。
  5. 頂点追加のたびに追加線長に比例してインクを消費する（[FR-002](#fr-002)）。
  6. 描画中は速度連動ループ音とペン先ダストを再生する（[FR-010](#fr-010)）。
- **代替フロー / Alternative Flow**: マウス入力（Web / デスクトップ）でもタッチと同一の頂点追加・先端追従・インク消費を行う（[NFR-005](./non_functional_requirements.md#nfr-005)）。
- **例外フロー / Exception Flow**: ①インクが枯渇した場合、その位置で頂点追加を停止し [FR-002](#fr-002) の枯渇フィードバック（空振り音+シェイク+warning ハプティクス）を発火する。描画済みの線は保持され、指を離せば [FR-003](#fr-003) の確定に進める。②OS によるタッチ中断（着信・通知シェード・システムジェスチャ）は指離しと同一に扱い、[FR-003](#fr-003) の確定処理へ進む。
- **事後条件 / Postcondition**: 頂点列が保持され、指離しで [FR-003](#fr-003) の物理化に引き渡される。
- **ビジネスルール / Business Rule**: 1レベル1ストローク（描き直しはリスタート [FR-004](#fr-004) のみ。複数ストローク面は後半チャプターの拡張ギミック G10 として保留 — [research/07_decision.md](../research/07_decision.md) §3.1）。走行フェーズ中の追加描画は不可。描画パラメータは TuningConstants に集約する（[NFR-010](./non_functional_requirements.md#nfr-010)）。

<a id="fr-002"></a>

#### FR-002: インク残量管理 — Must

> **関連:** KPI: [KPI-002](./README.md#kpi-002), [KPI-005](./README.md#kpi-005) | NFR: [NFR-009](./non_functional_requirements.md#nfr-009), [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-003](#sc-003) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.1 / [game_design.md](./game_design.md#gd-4-1) §4.1（信頼設計 P1）

- **説明 / Description**: レベル毎に定義されたインク予算を保持し、描画長に比例して消費、残量バーをリアルタイム表示する。インク消費量は星評価（[FR-007](#fr-007)）の入力となる戦略資源。
- **アクター / Actor**: Player（消費・閲覧）。System（計測・表示）。
- **事前条件 / Precondition**: レベル JSON にインク予算（> 0、Gate 1 で保証）がロード済み（[FR-015](#fr-015)）。
- **トリガー / Trigger**: 描画フェーズ開始（バー初期化）、および [FR-001](#fr-001) の頂点追加（消費）。
- **主フロー / Main Flow**:
  1. レベル開始時、インク残量をレベル JSON のインク予算で初期化し、バーを満量表示する。
  2. 頂点追加のたびに追加線長に比例して残量を減らし、バーへ同フレームで反映する。
  3. バーの色を残量に応じて切り替える: > 50% は緑 / 20〜50% は黄 / < 20% は赤 + 300ms 周期の点滅。
  4. 確定時点の消費量を保持し、星評価（[FR-007](#fr-007)）へ渡す。
- **代替フロー / Alternative Flow**: アップグレード Ink Capacity（[FR-019](#fr-019)）購入済みの場合、レベルのインク予算に +10%/Lv を実乗算した値で初期化する。
- **例外フロー / Exception Flow**: 残量が 0 に達した場合: ①それ以上の頂点追加を停止（それ以上描けない）②「カスッ」という空振り音を再生 ③バーを横に 4〜6px / 150ms シェイク ④warning ハプティクスを発火（[FR-014](#fr-014)）。プレイヤーは指を離して確定する（[FR-003](#fr-003)）か、リスタート（[FR-004](#fr-004)）を選ぶ。
- **事後条件 / Postcondition**: 確定時のインク消費量が確定し、星評価と描線の長さ上限の管理に使われる。
- **ビジネスルール / Business Rule**: 基本インク（未強化 Lv0）で全レベルがクリア可能であることを維持する（[FR-019](#fr-019) / [research/07_decision.md](../research/07_decision.md) §5.1）。バーの常時可視化は信頼設計 P1（Visibility）の実装。色は非色情報（バー長・点滅）と二重符号化する（[NFR-009](./non_functional_requirements.md#nfr-009)）。

<a id="fr-003"></a>

#### FR-003: 線の確定と物理化 — Must

> **関連:** KPI: [KPI-001](./README.md#kpi-001), [KPI-005](./README.md#kpi-005) | NFR: [NFR-001](./non_functional_requirements.md#nfr-001), [NFR-004](./non_functional_requirements.md#nfr-004), [NFR-010](./non_functional_requirements.md#nfr-010) | SC: [SC-003](#sc-003), [SC-004](#sc-004) | **根拠:** [research/07_decision.md](../research/07_decision.md) §7.2 方式C / [game_design.md](./game_design.md#gd-3) §3.1・§3.2

- **説明 / Description**: 指を離した瞬間に線を確定し、ポリラインをセグメント化カプセルチェーン（第一方式C）へ変換して物理ワールドに投入する。物理化と同時に車の発進シーケンス（[FR-005](#fr-005)）を開始する（0秒フィードバック）。
- **アクター / Actor**: Player（確定操作）。System（物理化）。
- **事前条件 / Precondition**: [FR-001](#fr-001) の描線が存在する（頂点 2 点以上）。
- **トリガー / Trigger**: pointerup（指離し）。OS によるタッチ中断も同一に扱う（[FR-001](#fr-001) 例外フロー）。
- **主フロー / Main Flow**:
  1. RDP アルゴリズムで頂点列を間引く。
  2. セグメント長 0.5〜0.8m 相当で等間隔リサンプルする（セグメント数 N=8〜24、上限 32）。
  3. カプセルセグメント × N を revolute joint で連結する: enableSpring（hertz 4〜8 / dampingRatio 0.6〜0.8）、enableLimit（±0.2〜0.4 rad）、collideConnected=false、同一ストローク内は filter.groupIndex = -strokeId で自己衝突オフ。
  4. 確定ポップ（scale 1.0→1.06→1.0 / 120ms, ease-out-back）+ 確定音（50〜120ms の「コトッ」）+ ハプティクス light / PRIMITIVE_TICK(0.6) を再生する（[FR-014](#fr-014)）。
  5. 物理化された線がばねジョイントの挙動でわずかに落下・たわむ（物理が演出を無償提供 — 追加実装なし）。
  6. 同時に [FR-005](#fr-005) の発進シーケンス（溜め）を開始し、走行フェーズ（[SC-004](#sc-004)）へ遷移して描画 UI を非表示化する。
  7. 描画層は物理セグメント位置から Catmull-Rom スプラインで滑らかな 1 本線を再構成する（物理 N と描画頂点の分離）。
- **代替フロー / Alternative Flow**: 設定または低性能端末フォールバック（[FR-023](#fr-023) 例外フロー）が有効な場合、物理層のみ方式A（単一 compound 剛体）に差し替えて物理化する。入力層・描画層は共通のまま（[research/07_decision.md](../research/07_decision.md) §7.2 保険層）。
- **例外フロー / Exception Flow**: ①描線長が最小セグメント長（0.5m 相当）未満の場合は物理化せず描線を破棄し、消費したインクを返還して描画フェーズに留まる。②物理化直後にソルバの発散（座標 NaN・貫通爆発）を検出した場合、フェイルセーフとしてレベルを初期状態にリセットする（[FR-004](#fr-004) と同一の ≤1秒復帰）。
- **事後条件 / Postcondition**: 橋チェーン（Bridge Chain）が物理ワールドに存在し、走行フェーズが進行中。インク消費量が確定済み。
- **ビジネスルール / Business Rule**: 物理パラメータは TuningConstants に集約し実行中変更可能にする（[FR-025](#fr-025) / [NFR-010](./non_functional_requirements.md#nfr-010)）。安定性指針: 線の総質量は車の 0.3〜1.0 倍、セグメント単体との質量比 ≤ 30:1、subStep 4→6〜8、N は 10〜16 から開始（[research/07_decision.md](../research/07_decision.md) §7.2）。方式C の採否は着手週スパイクで最終確定する（同 §7.3）。

<a id="fr-004"></a>

#### FR-004: リスタート制御 — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003) | NFR: [NFR-003](./non_functional_requirements.md#nfr-003), [NFR-008](./non_functional_requirements.md#nfr-008) | SC: [SC-003](#sc-003), [SC-004](#sc-004), [SC-006](#sc-006) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.2・§3.5（信頼設計 P2）

- **説明 / Description**: 描画・走行の両フェーズに常設のリスタートボタンを置き、タップから 1 秒以内に同一レベルを初期状態へ戻す。失敗リザルト（[SC-006](#sc-006)）の Retry も同一処理。
- **アクター / Actor**: Player。
- **事前条件 / Precondition**: レベルがプレイ中（[SC-003](#sc-003) または [SC-004](#sc-004)）、または失敗リザルト表示中（[SC-006](#sc-006)）。
- **トリガー / Trigger**: リスタートボタンまたは Retry ボタンのタップ。
- **主フロー / Main Flow**:
  1. タップを受けたら確認ダイアログを出さず、即座にリセット処理を開始する。
  2. 物理ワールド・描線・インク残量・カメラ位置・レベル内コイン取得状態をレベル初期状態へ戻す。
  3. 画面暗転は最小にとどめ、タップから 1 秒以内に描画フェーズの静止俯瞰（[SC-003](#sc-003)）へ復帰する。
- **代替フロー / Alternative Flow**: 走行中（車が走っている最中・崩落の最中）のタップでも即時有効で、同一の ≤1秒復帰を行う。
- **例外フロー / Exception Flow**: リセット処理中の連打は無視する（多重リセット防止）。物理発散のフェイルセーフ（[FR-003](#fr-003)・[FR-005](#fr-005) 例外フロー）も本処理を共用する。
- **事後条件 / Postcondition**: レベルが初期状態（[SC-003](#sc-003)）に戻る。そのランで取得したレベル内コインは残高へ加算されず初期配置に戻る（残高加算はクリア確定時のみ、[FR-009](#fr-009)）。
- **ビジネスルール / Business Rule**: 罰なし設計（P2 / P3）のため確認ダイアログを出さない（即時実行）。「失敗→リトライ ≤ 1秒」はテンポ契約の合否項目（[KPI-003](./README.md#kpi-003) / [NFR-003](./non_functional_requirements.md#nfr-003)）として自動テスト化する。

---

### B. 走行・審判 / Run & Judgement

<a id="fr-005"></a>

#### FR-005: 車両自動発進・走行 — Must

> **関連:** KPI: [KPI-001](./README.md#kpi-001), [KPI-003](./README.md#kpi-003) | NFR: [NFR-001](./non_functional_requirements.md#nfr-001), [NFR-004](./non_functional_requirements.md#nfr-004) | SC: [SC-004](#sc-004) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.2・§7.2 / [game_design.md](./game_design.md#gd-3) §3.4・§3.6

- **説明 / Description**: 線の確定と同時に車の発進儀式（溜め→解放）を実行し、以降は物理シミュレーションのみで走行させる。走行中のプレイヤー操作は存在しない（描いた線が審判される）。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: [FR-003](#fr-003) で橋チェーンが物理化済み。車がレベル JSON のスポーン位置に静止している。
- **トリガー / Trigger**: [FR-003](#fr-003) の物理化完了。
- **主フロー / Main Flow**:
  1. 溜め（Anticipation）: 0.3〜0.5s 固定・スキップ不可の儀式として、エンジンレブ音のピッチ 1.0→1.4 上昇 + 車体後傾 squash（後方 5〜8°、縦 0.92 / 横 1.08、0.2s ease-in）+ 車輪空転と後方への煙を再生する。
  2. 解放（Launch）: 後輪 wheel joint の enableMotor + motorSpeed + maxMotorTorque でモーター駆動を開始する（後輪駆動）。解放演出は [FR-011](#fr-011)。
  3. 車体は chassis（角丸ボックス or カプセル）1 + wheel（円）×2 + b2WheelJoint ×2 の標準構成で走行する: サス hertz ≈ 4 / dampingRatio ≈ 0.7、タイヤ摩擦 0.8〜1.2、restitution 0。
  4. 物理は固定タイムステップ dt = 1/60 + アキュムレータ + 補間レンダリングで進行する。120Hz 端末でもレンダのみ高リフレッシュとし物理は 60Hz 固定（[NFR-001](./non_functional_requirements.md#nfr-001)）。
  5. 走行中、毎 tick でクリア判定（[FR-007](#fr-007)）・失敗判定（[FR-008](#fr-008)）・応力判定（[FR-006](#fr-006)）・コイン接触（[FR-009](#fr-009)）を評価する。
- **代替フロー / Alternative Flow**: アップグレード Engine Speed（[FR-019](#fr-019)）購入済みの場合、モーター速度に +5%/Lv を実乗算する。
- **例外フロー / Exception Flow**: ①物理ソルバの発散（座標 NaN、または速度が発散判定閾値を超過）を検出した場合、フェイルセーフとしてレベルを初期状態へリセットする（[FR-004](#fr-004) の処理を共用、≤1秒復帰）。②制限 tick 超過は [FR-008](#fr-008) の失敗条件③（タイムアウト）として処理する。
- **事後条件 / Postcondition**: クリアまたは失敗のいずれかの判定が確定する。
- **ビジネスルール / Business Rule**: 走行中の運転・ブースト操作は導入しない（Voodoo「Intuitive」原則、[research/07_decision.md](../research/07_decision.md) §3.1）。実行中の入力がゼロであることが、リプレイ・自動検証を「レベル JSON + 描線ポリライン + tick 数」で完結させる品質保証戦略の土台（[FR-026](#fr-026)）。

<a id="fr-006"></a>

#### FR-006: 橋の応力・軋み・破断 — Must

> **関連:** KPI: [KPI-001](./README.md#kpi-001), [KPI-005](./README.md#kpi-005) | NFR: [NFR-001](./non_functional_requirements.md#nfr-001), [NFR-009](./non_functional_requirements.md#nfr-009), [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-004](#sc-004) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.2・§7.2 / [game_design.md](./game_design.md#gd-3) §3.2（本作最大の差別化）

- **説明 / Description**: 橋チェーンの各ジョイントの応力（Stress）を毎 tick 算出し、0.6〜1.0 帯で軋み（Creak）演出、1.0 超で破断（Break）による部分崩落を発生させる。競合クローン（全て単一剛体）が提供していないジャンル未実装の体験。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 方式C（カプセルチェーン）で橋が物理化済みで、走行フェーズ中。
- **トリガー / Trigger**: 物理 step 毎のジョイント拘束力取得（b2Joint_GetConstraintForce / b2Joint_GetConstraintTorque）。
- **主フロー / Main Flow**:
  1. 各ジョイントで raw = |F| / breakForce + |τ| / breakTorque を算出する。
  2. stress = EMA（係数 0.85 / 0.15）で raw を平滑化する（1 tick のスパイクで即破断させない）。
  3. stress 0.6〜1.0 の帯域で軋み演出を stress 値に連動させる: (a) 軋み SFX の音量・ピッチ (b) 当該線分の色を白→黄→赤へ補間 (c) 粉パーティクル (d) 弱ハプティクス連打（[FR-014](#fr-014)）。
  4. stress > 1.0 で b2DestroyJoint により当該ジョイントを破断する: クラック音 + 破片パーティクル + カメラ trauma += 0.5 + 折れ口ハイライトを発火し、描画パスを破断点で分割して折れ口をギザギザ表示する。
  5. 破断後の孤立チェーン片は数秒後に車と非衝突化し、フェードアウトさせる。
- **代替フロー / Alternative Flow**: フォールバック方式A（単一剛体、[FR-003](#fr-003) 代替フロー）稼働時はジョイントが存在しないため応力・破断は発生せず、描画層のみの演出たわみに後退する（[research/07_decision.md](../research/07_decision.md) §7.3）。
- **例外フロー / Exception Flow**: 同一 step 内で複数ジョイントが同時に stress > 1.0 となった場合は全て破断させる（連鎖崩落は物理見世物として許容）。カメラ trauma は 1.0 でクランプし、シェイクの過剰化を防ぐ。
- **事後条件 / Postcondition**: stress 状態が描画・音響・触覚へ反映され、破断結果（崩落）は失敗判定（[FR-008](#fr-008)）の入力になり得る。破断ジョイント位置は失敗時の因果ハイライトに使われる。
- **ビジネスルール / Business Rule**: 応力可視化は色 + 非色（粉パーティクル・微振動）の二重符号化とする（[NFR-009](./non_functional_requirements.md#nfr-009) / 信頼設計 P1）。breakForce / breakTorque は TuningConstants で管理し、初期指針は「車静止荷重の 2〜3 倍」（[research/07_decision.md](../research/07_decision.md) §9 リスク3）。

<a id="fr-007"></a>

#### FR-007: クリア判定と星評価 — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003) | NFR: [NFR-004](./non_functional_requirements.md#nfr-004) | SC: [SC-004](#sc-004), [SC-005](#sc-005) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.2 / [game_design.md](./game_design.md#gd-5-6) §5.6

- **説明 / Description**: 車体基準点がゴール旗（Goal Flag）の判定矩形に到達した瞬間をクリアと判定し、インク消費量の 3 段階閾値で星 1〜3 を算定する（Happy Glass 方式: 少なく描くほど高評価）。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 走行フェーズ中で、失敗判定（[FR-008](#fr-008)）が未確定。
- **トリガー / Trigger**: 毎 tick の「車体基準点 × ゴール旗判定矩形」の包含検査。
- **主フロー / Main Flow**:
  1. 車体基準点が判定矩形に入った tick でクリアを確定し、ゴール演出（[FR-012](#fr-012)、hit-stop から開始）を発火する。
  2. インク消費量（[FR-002](#fr-002)）をレベル JSON の閾値 2 値と比較して星を算定する: 消費 ≤ star3 閾値 → 星3 / 消費 ≤ star2 閾値 → 星2 / それ以外 → 星1。
  3. 星・獲得コイン（クリア報酬 + レベル内収集、[FR-009](#fr-009)）を確定してクリアリザルト（[SC-005](#sc-005)）へ渡す。
  4. クリア状態と星を進行データへ保存し（[FR-021](#fr-021)）、次レベルを解放する（[FR-015](#fr-015)）。
- **代替フロー / Alternative Flow**: クリア済みレベルの再プレイでは、今回の星が記録未満でも記録はベスト値を保持する（[FR-016](#fr-016)）。
- **例外フロー / Exception Flow**: クリア条件と失敗条件が同一 tick で同時成立した場合はクリアを優先する（プレイヤー有利解釈 — 罰なし設計との整合）。
- **事後条件 / Postcondition**: クリアリザルトが表示され、星・コイン・次レベル解放が永続化済み。
- **ビジネスルール / Business Rule**: クリア自体は星1でも可（進行をブロックしない）。星閾値はレベル JSON に star2 / star3 の 2 値で保持し、閾値設計指針は [game_design.md](./game_design.md#gd-5-6) §5.6 に従う。

<a id="fr-008"></a>

#### FR-008: 失敗判定と因果提示 — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003) | NFR: [NFR-003](./non_functional_requirements.md#nfr-003), [NFR-008](./non_functional_requirements.md#nfr-008) | SC: [SC-004](#sc-004), [SC-006](#sc-006) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.2（信頼設計 P3）

- **説明 / Description**: 3 条件（落下・転倒・タイムアウト）で失敗を判定し、失敗原因の箇所を視覚ハイライトして Retry を即時提示する。ライフ・スタミナ・ペナルティは一切存在しない（Not punitive）。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 走行フェーズ中で、クリア判定（[FR-007](#fr-007)）が未確定。
- **トリガー / Trigger**: 毎 tick の失敗条件評価。
- **主フロー / Main Flow**:
  1. 条件①（落下）: 車体基準点がレベル定義の画面下限 Y（レベルJSONの killY）を下回った tick で失敗を確定する。
  2. 条件②（転倒）: 車の屋根の接地が連続 0.5s（初期値、TuningConstants）継続した時点で失敗を確定する。
  3. 条件③（タイムアウト）: 経過が制限 tick（初期値 30s 相当 = 1800 tick）を超過した時点で失敗を確定する。
  4. 失敗確定時、原因箇所をハイライトする: 落下 = 落下地点 / 転倒 = 転倒姿勢の車体 / 破断起因の崩落 = 破断ジョイント位置（[FR-006](#fr-006) の折れ口ハイライトを維持表示）。
  5. 失敗リザルト（[SC-006](#sc-006)）を最軽量演出（[FR-013](#fr-013)）で表示し、Retry ボタンを即時活性化する（[FR-004](#fr-004)、タップから ≤1秒で再開）。
- **代替フロー / Alternative Flow**: 橋の破断・部分崩落が発生しても、車がゴール旗に到達すれば失敗ではなくクリアとする（[FR-007](#fr-007)。「ギリギリ渡り切る」が最高のカタルシス）。
- **例外フロー / Exception Flow**: 失敗確定後は Retry とホーム遷移以外の入力（描画・走行への干渉）を無効化する。判定確定前の崩落・落下の途中経過はそのまま物理見世物として見せる。
- **事後条件 / Postcondition**: レベルは未クリアのまま。失敗回数による報酬減・待機・広告表示は発生しない。
- **ビジネスルール / Business Rule**: 罰なし設計: ライフ・スタミナ・ペナルティなし（[research/07_decision.md](../research/07_decision.md) §3.2）。失敗の因果可読性（どこが限界を超えたか一目で分かる）は 00 の「原因バナー」思想の物理版であり、信頼設計 P3 の実装。

<a id="fr-009"></a>

#### FR-009: コイン収集・報酬 — Must

> **関連:** KPI: [KPI-005](./README.md#kpi-005) | NFR: [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-004](#sc-004), [SC-005](#sc-005) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.2・§5.2 / [game_design.md](./game_design.md#gd-7-3) §7.3

- **説明 / Description**: レベル内に配置されたコインを走行中の接触で取得し、クリア確定時にクリア報酬と合算して残高へ加算する。取得演出は半音上昇コンボ音で快感を積み上げる。
- **アクター / Actor**: Player（結果の享受）。System（判定・演出・加算）。
- **事前条件 / Precondition**: レベル JSON のコイン配置がロード済みで、走行フェーズ中。
- **トリガー / Trigger**: 車体とコイン（センサー）の接触。
- **主フロー / Main Flow**:
  1. 接触した tick でコインを取得済み状態にし、取得ポップ（scale 1.0→1.3→0 / 150ms）+ キラ粒子 4〜8 個を再生する。
  2. 取得音は連続取得ごとに +1 semitone（× 1.0595）上昇させる。上限 +12 semitone、取得が 1〜1.5s 途切れたらリセット。
  3. クリア確定（[FR-007](#fr-007)）時、クリア報酬 20〜30 コイン（面によらずほぼ一定）+ レベル内収集分を残高へ加算する（[FR-018](#fr-018)）。
  4. ボーナス面（Bonus Level）では報酬を通常の 5〜10 倍にする。
- **代替フロー / Alternative Flow**: コインを 1 枚も取得せずクリアした場合もクリア報酬は満額付与する（コインは経路誘導 G12 であり強制ではない）。
- **例外フロー / Exception Flow**: 失敗またはリスタートした場合、そのランで取得したコインは残高へ加算せず初期配置に戻す（残高加算はクリア確定時のみ — 罰なしかつ稼ぎ周回の防止）。
- **事後条件 / Postcondition**: クリア時に残高が更新され、earn_virtual_currency イベントが AnalyticsInterface（[FR-022](#fr-022)、v1.0 は Noop）へ記録される。
- **ビジネスルール / Business Rule**: コイン配置は走行中に 0.1〜0.2s 間隔で取れるアーチ状のリズム配置とする（[research/07_decision.md](../research/07_decision.md) §4.2）。獲得側の経済を指数にしない（同 §5.2）。

---

### C. 演出 / Juice

<a id="fr-010"></a>

#### FR-010: 描画ジュース — Must

> **関連:** KPI: [KPI-005](./README.md#kpi-005) | NFR: [NFR-002](./non_functional_requirements.md#nfr-002), [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-003](#sc-003) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.1 / [game_design.md](./game_design.md#gd-4-1) §4.1・§8.3

- **説明 / Description**: 描画中の聴覚・視覚フィードバック（ループ音・ペン先パーティクル）を提供し、「線を引く瞬間」を快感化する。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 描画フェーズで指がドラッグ中（[FR-001](#fr-001) 実行中）。
- **トリガー / Trigger**: 描画の開始・速度変化・停止。
- **主フロー / Main Flow**:
  1. 描画開始でペン/マーカーのループ音を開始する（フェードイン 30〜50ms）。
  2. 描画速度をループ音へ連続マッピングする: 音量 0.3〜1.0 / ピッチ 1.0〜1.2。
  3. 指が止まったら音も止める（フェードアウト 30〜50ms。「動き = 音」の一致）。
  4. ストロークごとに基準ピッチを ±5% ランダム化する（[NFR-014](./non_functional_requirements.md#nfr-014)）。
  5. （推奨・入るだけ）ペン先ダストを 2〜5 個/フレーム放出する: 速度比例、寿命 0.2〜0.5s、サイズ 2〜6px、線色→透明フェード。
- **代替フロー / Alternative Flow**: サウンド OFF（[FR-020](#fr-020)）時は音を再生せず視覚フィードバックのみ提供する。音・粒子が無効でも描画機能（[FR-001](#fr-001)）は完全動作する。
- **例外フロー / Exception Flow**: 初回タッチ時点で AudioContext が suspended の場合、resume 処理を先に実行してから再生する（[NFR-014](./non_functional_requirements.md#nfr-014)。resume 完了までの区間は無音を許容し描画はブロックしない）。
- **事後条件 / Postcondition**: 描画終了（確定またはリスタート）とともに全ループ音が停止している。
- **ビジネスルール / Business Rule**: 音・粒子は演出であり判定・物理へ影響しない。パラメータは TuningConstants §8.3（[game_design.md](./game_design.md#gd-8) 参照）に集約。

<a id="fr-011"></a>

#### FR-011: 発進・走行ジュース — Must

> **関連:** KPI: [KPI-005](./README.md#kpi-005) | NFR: [NFR-001](./non_functional_requirements.md#nfr-001), [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-004](#sc-004) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.2 / [game_design.md](./game_design.md#gd-4-2) §4.2・§8.4

- **説明 / Description**: 発進の解放演出、カメラワーク、エンジン音、車輪・サスの視覚同期を提供し、「車が走り出す瞬間」を快感化する（軋み演出は [FR-006](#fr-006) が担当）。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: [FR-005](#fr-005) の溜めが完了し解放イベントが発火した、または走行中。
- **トリガー / Trigger**: 解放イベント、および走行中の速度・接地変化。
- **主フロー / Main Flow**:
  1. 解放時: ダストパーティクル 10〜20 個の一斉放出 + 車体前方 stretch（横 1.15 / 縦 0.9 → 100ms で復帰, ease-out）+ 低域を効かせた発進バースト音 + ハプティクス medium / PRIMITIVE_THUD(0.8)（[FR-014](#fr-014)）。
  2. カメラ: lerp 追従（係数 0.08〜0.15 @60fps）+ look-ahead（進行方向へ車体 1〜2 台分、速度比例）+ 発進時カメラキック（進行と逆方向へ 8〜16px → 0.3s で復帰）。
  3. エンジン音: 速度→ピッチ 1.0〜1.5 の連続変調 + 0.25 刻みのギアチェンジ風の段付き。
  4. 車輪を実速度と同期して回転させ、wheel joint サスの上下動を車体描画へ反映する（誇張された物理の気持ちよさ）。
  5. （推奨・入るだけ）trauma² 方式スクリーンシェイク（Perlin ノイズ、maxOffset 16〜30px / maxAngle 5〜10°、freq 15〜25Hz、加算目安: 発進 0.15 / 着地 0.2〜0.3 / クラッシュ 0.5 / ゴール 0.4）、速度連動ズームアウト +10〜20%、スピード線（最高速の 60% 超で出現）、スキッドマーク。
- **代替フロー / Alternative Flow**: サウンド / ハプティクス OFF（[FR-020](#fr-020)）時は該当チャネルのみ停止し、視覚演出とカメラは維持する。
- **例外フロー / Exception Flow**: パーティクル生成が性能予算（[NFR-001](./non_functional_requirements.md#nfr-001)）を圧迫する端末では、推奨項目（シェイク・スピード線・スキッドマーク・ダスト）から順に生成数を削減する（[research/07_decision.md](../research/07_decision.md) §9 リスク1 の縮退順序）。
- **事後条件 / Postcondition**: 走行終了（クリア / 失敗確定）でエンジン音・シェイクが停止している。
- **ビジネスルール / Business Rule**: 必須 / 推奨の区分は [research/07_decision.md](../research/07_decision.md) §4.2 のチェックリストに従い、必須 100% が [KPI-005](./README.md#kpi-005) の合否条件。パラメータは TuningConstants §8.4 に集約。

<a id="fr-012"></a>

#### FR-012: ゴール5拍演出 — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003), [KPI-005](./README.md#kpi-005) | NFR: [NFR-008](./non_functional_requirements.md#nfr-008), [NFR-014](./non_functional_requirements.md#nfr-014) | SC: [SC-005](#sc-005) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4.3 / [game_design.md](./game_design.md#gd-4-3) §4.3・§8.5（信頼設計 P2: 全スキップ可）

- **説明 / Description**: クリア確定から「時間演出→爆発→評価→報酬→即・次へ」の 5 拍構成（全体 3〜4 秒）でカタルシスを演出する。全演出はタップで即スキップ可能。
- **アクター / Actor**: System（演出）。Player（閲覧・スキップ）。
- **事前条件 / Precondition**: [FR-007](#fr-007) でクリアが確定した。
- **トリガー / Trigger**: 車体基準点のゴール旗接触フレーム。
- **主フロー / Main Flow**:
  1. **拍1 hit-stop**: 旗接触フレームで 80〜120ms の完全停止（ゴールの「切断面」を作る）。
  2. **拍2 スローモーション**: timeScale を 0.3 へ即時変更し実時間 0.3〜0.5s 維持 → 0.2〜0.3s で 1.0 へ lerp 復帰。物理の fixedDeltaTime も連動させてカクつきを防止する。スロー中はカメラを 15〜25% ズームイン。
  3. **拍3 confetti 2段**: ①ゴール地点から左右 2 門のキャノン（各 40〜60 個、斜め上 45〜70°、拡散 30°）②0.3s 遅れて上部から降下レイン（60〜100 個、2〜3s）。紙片は回転 ±720°/s + sin 揺れ、重力 0.2〜0.4 倍。発射音「ポンッ」× 2（左右 50ms ずらし）+ ハプティクス heavy。
  4. **拍4 星の順次出現**: 200〜300ms 間隔で各星 scale 0→1.3→1.0（250ms, ease-out-back）+ 衝撃波リング。音はド・ミ・ソの上昇アルペジオ、3 つ目のみシンバル追加。ハプティクスは light→medium→heavy と漸増（[FR-014](#fr-014)）。
  5. **拍5 報酬カウントアップ**: 0→獲得額を 0.8〜1.5s（ease-out）でカウント、チック音は 30〜60ms 間隔でピッチ 1.0→1.3 上昇。同時にコインバースト 10〜30 枚を放射 → 各 20〜40ms ずらしでカウンターへ飛行（各 0.4〜0.6s, ease-in）、到達ごとに半音上昇のチン音 + カウンター scale パンチ（1.0→1.2→1.0 / 100ms）。
  6. Next ボタンを演出完了後 1.5〜2.5s で活性化し、脈動（scale ±5%、周期 0.8s）で誘導する。Replay ボタンも併設する。
  7. ゴール瞬間から BGM を -6〜-9dB（0.2s）ダッキングして SFX を立てる（[NFR-014](./non_functional_requirements.md#nfr-014)）。
- **代替フロー / Alternative Flow**: 演出中の画面タップで演出全体を即スキップし、星・獲得コインの確定値を静的表示して Next / Replay を即時活性化する。スキップは星・コイン・保存結果に影響しない。
- **例外フロー / Exception Flow**: hit-stop の使用回数は 1 レベル 1〜2 回の上限を大クラッシュ（[FR-013](#fr-013)）と共有する。上限超過時は拍1 を省略し拍2 以降を実行する。
- **事後条件 / Postcondition**: 星・コインが保存済み（[FR-021](#fr-021)）で、Next（次レベル）/ Replay（同レベル再挑戦）が選択可能。
- **ビジネスルール / Business Rule**: 演出全体 3〜4 秒・全スキップ可・Next 活性化 1.5〜2.5s はテンポ契約（[KPI-003](./README.md#kpi-003) / [NFR-003](./non_functional_requirements.md#nfr-003)）の合否項目。パラメータは TuningConstants §8.5 に集約。

<a id="fr-013"></a>

#### FR-013: 失敗演出（軽量） — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003) | NFR: [NFR-008](./non_functional_requirements.md#nfr-008) | SC: [SC-006](#sc-006) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.2・§4 横断規則 / [game_design.md](./game_design.md#gd-4-4) §4.4

- **説明 / Description**: 失敗時は追加演出を最小限にとどめ、崩落・落下の物理挙動そのものを見世物として見せる。判定確定後は軽量暗転 + 短い残念音のみで Retry を即出現させる。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: [FR-008](#fr-008) で失敗が確定した。
- **トリガー / Trigger**: 失敗判定の確定。
- **主フロー / Main Flow**:
  1. 判定確定までの崩落・落下・転倒は物理シミュレーションをそのまま見せる（追加エフェクト不要 — 物理が見世物）。
  2. 判定確定後、軽量の画面暗転 + 短い残念音（1 種、re-try を妨げない長さ）を再生する。
  3. 失敗原因ハイライト（[FR-008](#fr-008)）を維持したまま失敗リザルト（[SC-006](#sc-006)）を表示し、Retry ボタンを即時活性化する。
- **代替フロー / Alternative Flow**: 大クラッシュ（カメラ trauma が上限 1.0 に達する規模の崩落）に限り hit-stop を 1 回許可する。使用上限（1 レベル 1〜2 回）はゴール演出（[FR-012](#fr-012)）と共有する。
- **例外フロー / Exception Flow**: 演出中のタップは全てスキップとして扱い、即座に [SC-006](#sc-006) の操作可能状態（Retry 活性）へ遷移する。
- **事後条件 / Postcondition**: 失敗リザルトが表示され、Retry タップ→再開 ≤1秒の計測起点が成立している。
- **ビジネスルール / Business Rule**: 失敗時演出は最軽量とし（[NFR-008](./non_functional_requirements.md#nfr-008)）、confetti・カウントアップに類する報酬系演出を流用しない。罰の表現（減点表示・煽り文言）を禁止する（信頼設計 P3）。

<a id="fr-014"></a>

#### FR-014: ハプティクス統合 — Must

> **関連:** KPI: [KPI-002](./README.md#kpi-002), [KPI-005](./README.md#kpi-005) | NFR: [NFR-002](./non_functional_requirements.md#nfr-002), [NFR-009](./non_functional_requirements.md#nfr-009) | SC: [SC-008](#sc-008) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4 横断必須 / [game_design.md](./game_design.md#gd-8) §8.6（信頼設計 P2: OFF 可）

- **説明 / Description**: ゲームイベント→ハプティクスのマッピング表を一元定義し、iOS / Android / Web のプラットフォーム差異を HapticsInterface（[FR-022](#fr-022)）で吸収する。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 起動時に HapticsInterface の実装（Noop / Web / Capacitor）が注入済み。
- **トリガー / Trigger**: マッピング表に定義されたゲームイベントの発火。
- **主フロー / Main Flow**:
  1. マッピング表を一元定義する（TuningConstants と同居、散在禁止）: 線確定 = light / PRIMITIVE_TICK(0.6)、発進 = medium / PRIMITIVE_THUD(0.8)、着地 = heavy / PRIMITIVE_THUD(1.0)（大ジャンプ後のみ）、破断・軋み = weak 連打、星出現 = light→medium→heavy 漸増、インク枯渇 = warning。
  2. 全ての発火はマッピング表を引いて HapticsInterface 経由で行い、ゲームロジックはプラットフォーム API を直接呼ばない。
  3. iOS: prepare() 済みの UIImpactFeedbackGenerator 相当（Capacitor Haptics 経由）で発火遅延を抑える（タッチ→触覚 ≤100ms、[NFR-002](./non_functional_requirements.md#nfr-002)）。
  4. Android: 起動時に areAllPrimitivesSupported() を検査する。primitive が 1 つでも未対応の端末では composition 全体が無音になるため、振幅（amplitude）ベースの表現へフォールバックする。
- **代替フロー / Alternative Flow**: 設定（[FR-020](#fr-020)）でハプティクス OFF の場合、マッピング表の全発火を無効化する（即時反映・永続化）。
- **例外フロー / Exception Flow**: バイブレーション非搭載端末・非対応ブラウザでは Noop / Web 実装が空動作し、例外を投げずゲーム進行に影響しない。
- **事後条件 / Postcondition**: 全ハプティクスがマッピング表由来で発火し、いかなる端末でも「一部イベントのみ無音」という不整合が発生しない。
- **ビジネスルール / Business Rule**: イベント種別ごとのフィードバック形式統一は信頼設計 P4（[NFR-008](./non_functional_requirements.md#nfr-008)）。Android の areAllPrimitivesSupported() チェックは必須（[research/07_decision.md](../research/07_decision.md) §4.3 横断必須）。

---

### D. レベル・進行 / Levels & Progression

<a id="fr-015"></a>

#### FR-015: レベルロード・進行管理 — Must

> **関連:** KPI: [KPI-004](./README.md#kpi-004) | NFR: [NFR-006](./non_functional_requirements.md#nfr-006), [NFR-007](./non_functional_requirements.md#nfr-007) | SC: [SC-002](#sc-002) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.3・§8.1 / [game_design.md](./game_design.md#gd-6) §6

- **説明 / Description**: レベルを JSON データとしてロードし（コード / データ分離）、チャプター内の順次解放を管理する。MVP は Ch1 = 15 面 + ボーナス 3 面を同梱する。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: 同梱レベル JSON が検証パイプライン Gate 0〜3（[FR-026](#fr-026)）を 100% 通過している。
- **トリガー / Trigger**: レベル選択（[FR-016](#fr-016)）でのプレイ開始、クリアによる次面遷移。
- **主フロー / Main Flow**:
  1. レベル JSON スキーマの必須フィールドをロードする: 地形ポリライン、車スポーン位置、旗判定矩形、インク予算、星閾値（star2 / star3）、killY（画面下限 = 落下失敗判定の Y 座標。Gate 0 スキーマ検証対象）、コイン配置、ギミックタグ、ゴースト解 ≥ 1 本、schemaVersion。
  2. Ch1 の 15 面 + ボーナス面（5 面ごと: L5 / L10 / L15 の後に計 3 面）を進行順に構成する。
  3. レベルクリア（[FR-007](#fr-007)）でチャプター内の次面を解放する（順次解放）。
  4. レベル遷移（リザルト→次面のプレイ可能状態）を 1 秒以内に完了する（[NFR-006](./non_functional_requirements.md#nfr-006)）。
- **代替フロー / Alternative Flow**: schemaVersion が旧い場合は前方マイグレーションを適用してロードする（[FR-021](#fr-021) と同一の方針）。
- **例外フロー / Exception Flow**: スキーマに適合しないレベル JSON は同梱前に検証パイプライン（[FR-026](#fr-026) Gate 0）で弾かれるため、実行時には到達しない。実行時ロードで parse 失敗が発生した場合は当該レベルをスキップせずエラー表示し、レベル選択（[SC-002](#sc-002)）へ戻す（無言のクラッシュ・進行破壊を禁止）。
- **事後条件 / Postcondition**: 選択可能なレベル集合が進行データ（[FR-021](#fr-021)）と一致している。
- **ビジネスルール / Business Rule**: レベルはすべて JSON データ（コードに面データを埋め込まない）。解のないレベルは存在できない（ゴースト解 ≥ 1 本をスキーマで強制、[FR-024](#fr-024) / [FR-026](#fr-026)）。

<a id="fr-016"></a>

#### FR-016: レベル選択 — Must

> **関連:** KPI: — | NFR: [NFR-007](./non_functional_requirements.md#nfr-007), [NFR-009](./non_functional_requirements.md#nfr-009) | SC: [SC-001](#sc-001), [SC-002](#sc-002) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.3（信頼設計 P1 / P6）

- **説明 / Description**: チャプターマップに各面の星（0〜3）・クリア状態・ロック状態を表示し、解放済み面の再プレイを可能にする。星の記録はベスト値を保持する。
- **アクター / Actor**: Player。
- **事前条件 / Precondition**: 進行データ（[FR-021](#fr-021)）がロード済み。
- **トリガー / Trigger**: ホーム（[SC-001](#sc-001)）の Play タップ、またはリザルトからのレベル選択遷移。
- **主フロー / Main Flow**:
  1. チャプターマップに各面のカードを表示する: 獲得星（0〜3）、クリア状態、ロック状態。
  2. ボーナス面は通常面と視覚的に区別して表示する（[game_design.md](./game_design.md#gd-7-4) §7.4）。
  3. 解放済み面のタップで描画フェーズ（[SC-003](#sc-003)）へ遷移する（起動→プレイ開始は 2 タップ以内、[SC-001](#sc-001)）。
  4. 再プレイの結果が記録未満の星だった場合も、表示・保存はベスト値を保持する（低い結果で上書きしない）。
- **代替フロー / Alternative Flow**: 全面クリア後も任意の解放済み面を再プレイでき、星3 の埋め直しに挑戦できる。
- **例外フロー / Exception Flow**: ロック中の面をタップした場合は遷移せず、ロックアイコンのシェイクと「前のレベルをクリア」の表示で解放条件を伝える。
- **事後条件 / Postcondition**: 選択レベルがプレイ可能になる、または不可のフィードバックが返る。
- **ビジネスルール / Business Rule**: 星・クリア履歴の一覧性は信頼設計 P1（Visibility）と P6（Action Audit）の実装。タッチターゲットは ≥ 44pt（[NFR-009](./non_functional_requirements.md#nfr-009)）。

<a id="fr-017"></a>

#### FR-017: FTUE（最初の3面） — Must

> **関連:** KPI: [KPI-003](./README.md#kpi-003) | NFR: [NFR-003](./non_functional_requirements.md#nfr-003) | SC: [SC-003](#sc-003), [SC-004](#sc-004), [SC-005](#sc-005) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.4 / [game_design.md](./game_design.md#gd-5-4) §5.4

- **説明 / Description**: 最初の 3 面を「合計 60〜90 秒で 3 連続成功」する構成にし、テキストチュートリアルなし（指アイコンのなぞり誘導のみ）でコアループを学習させる。
- **アクター / Actor**: Player（体験）。System（レベル構成・誘導表示）。
- **事前条件 / Precondition**: 初回起動、または進行リセット（[FR-020](#fr-020)）直後で L1 が未クリア。
- **トリガー / Trigger**: L1 / L2 / L3 のプレイ開始。
- **主フロー / Main Flow**:
  1. L1: 狭い谷 + 潤沢インクで「どんな線でも渡れる」地形とし、初回タッチから 10 秒で初成功させる（L1 クリア ≤ 25 秒はテンポ契約）。
  2. L1 の描画フェーズで指アイコンのなぞり誘導アニメーション（谷をまたぐ軌跡）を表示する。テキストは表示しない。
  3. 初回起動から 45 秒以内にフル快感 1 周（描く→走る→ゴール 5 拍演出）を必ず 1 回体験させる。
  4. L2: インク予算をやや絞り、インクメーターの減少と星評価（消費と星の関係）を体感で学習させる。
  5. L3: 成功を定着させる。L1 開始から L3 クリアまで合計 60〜90 秒で 3 連続成功。
- **代替フロー / Alternative Flow**: プレイヤーが誘導を無視して別の線を描いてもクリアできる（L1 は失敗が困難な地形設計。誘導は強制ではない）。
- **例外フロー / Exception Flow**: L1 で失敗した場合も罰なしで即リトライ（[FR-004](#fr-004)）とし、リトライ開始時になぞり誘導アニメーションを再表示する。
- **事後条件 / Postcondition**: L3 クリア時点でプレイヤーが「描く→走る→評価」のループと「インク = 戦略資源」を操作体験のみで理解している。
- **ビジネスルール / Business Rule**: テキストチュートリアル禁止（対象ユーザーは文章を読まない、[README](./README.md)）。学びはプレイに埋め込む（L4 以降の学習展開は [game_design.md](./game_design.md#gd-6) §6）。60〜90 秒 / 45 秒 / ≤25 秒はテンポ契約テスト（[NFR-003](./non_functional_requirements.md#nfr-003)）の合否項目。

---

### E. メタ・経済 / Meta & Economy

<a id="fr-018"></a>

#### FR-018: コイン残高・経済 — Must

> **関連:** KPI: — | NFR: [NFR-007](./non_functional_requirements.md#nfr-007) | SC: [SC-001](#sc-001), [SC-005](#sc-005), [SC-007](#sc-007) | **根拠:** [research/07_decision.md](../research/07_decision.md) §5.2 / [game_design.md](./game_design.md#gd-7-3) §7.3（信頼設計 P1）

- **説明 / Description**: 単一ソフト通貨（コイン）の残高を管理し、ホーム・ショップ・リザルトで一貫表示する。全取引をイベントとして記録する。
- **アクター / Actor**: Player（獲得・消費）。System（残高管理・記録）。
- **事前条件 / Precondition**: 進行データ（[FR-021](#fr-021)）がロード済み。
- **トリガー / Trigger**: クリア確定による獲得（[FR-009](#fr-009)）、アップグレード購入による消費（[FR-019](#fr-019)）。
- **主フロー / Main Flow**:
  1. 残高を単一の値として保持する（通貨はコイン 1 本のみ。プレミアム通貨は導入しない）。
  2. 残高をホーム（[SC-001](#sc-001)）・ショップ（[SC-007](#sc-007)）・クリアリザルト（[SC-005](#sc-005)）で同一の値・同一の表記で表示する。
  3. 獲得経路: クリア報酬（20〜30 一定）+ レベル内収集 + ボーナス面（5〜10 倍）。
  4. 消費経路: アップグレード購入のみ（MVP）。
  5. 全取引を earn_virtual_currency / spend_virtual_currency イベントとして AnalyticsInterface（[FR-022](#fr-022)）へ記録する（v1.0 は Noop 実装のため送信なし・呼び出し規約のみ確立）。
- **代替フロー / Alternative Flow**: 残高変動時は表示中の全画面のカウンターへ即時反映する（画面間で値が食い違う瞬間を作らない）。
- **例外フロー / Exception Flow**: 残高 ≥ 0 の不変条件を破る操作は拒否する（購入時の残高不足は [FR-019](#fr-019) がボタン非活性で事前防止）。
- **事後条件 / Postcondition**: 残高が更新・永続化（[FR-021](#fr-021)）され、取引履歴イベントが記録されている。
- **ビジネスルール / Business Rule**: 獲得側の経済を指数にしない（[research/07_decision.md](../research/07_decision.md) §5.2）。残高の一貫表示は信頼設計 P1。コイン獲得 / 消費のバランス表は [game_design.md](./game_design.md#gd-7-3) §7.3 に従う。

<a id="fr-019"></a>

#### FR-019: アップグレード購入 — Must

> **関連:** KPI: — | NFR: [NFR-007](./non_functional_requirements.md#nfr-007) | SC: [SC-007](#sc-007) | **根拠:** [research/07_decision.md](../research/07_decision.md) §5.1・§5.2 / [game_design.md](./game_design.md#gd-7-1) §7.1・§7.2（信頼設計 P5）

- **説明 / Description**: 2 軸のアップグレード（Ink Capacity = インク量 / Engine Speed = 車速）をコインで購入する。効果は物理パラメータへの実乗算とする（ダミー禁止）。
- **アクター / Actor**: Player。
- **事前条件 / Precondition**: ショップ（[SC-007](#sc-007)）を表示中。進行データがロード済み。
- **トリガー / Trigger**: 購入ボタンのタップ。
- **主フロー / Main Flow**:
  1. 2 軸を表示する: Ink Capacity（+10%/Lv、上限 5Lv）、Engine Speed（+5%/Lv、上限 5Lv）。
  2. 各軸に現在 Lv・価格・次 Lv の効果を数値 + ビジュアルで購入前に明示する（例: インクバーの伸長プレビュー）。
  3. 価格は初回 50〜100 コイン、以降 × 1.15〜1.25/Lv の緩指数とする（Lv 別の具体価格表は [game_design.md](./game_design.md#gd-7-2) §7.2）。
  4. 購入タップで即時に残高から差し引き、Lv を +1 し、効果を物理パラメータ（インク予算 / モーター速度）へ実乗算で反映する。
  5. spend_virtual_currency イベントを記録する（[FR-018](#fr-018)）。
- **代替フロー / Alternative Flow**: 上限 Lv 到達済みの軸は「MAX」表示にし購入ボタンを非活性化する。
- **例外フロー / Exception Flow**: ①残高不足の場合、購入ボタンを非活性にし不足額を表示する（タップしても取引は発生しない）。②購入処理中の連打は 1 回のみ処理する（二重購入防止）。
- **事後条件 / Postcondition**: Lv・残高が更新・永続化され（[FR-021](#fr-021)）、次のレベルプレイから効果が反映される。
- **ビジネスルール / Business Rule**: 効果のダミー禁止 — 必ず物理パラメータへの実乗算（[research/07_decision.md](../research/07_decision.md) §5.1 設計原則）。Ink Capacity は「基本インクで全レベルクリア可能」を破らない範囲の快適化。Engine Speed は速度↑ = 描画精度要求↑のリスクリターン設計とし数値インフレ化を防ぐ。購入は即時で Undo なし、誤購入防止として価格を大きく表示する（信頼設計 P5: 摩擦は価格の視認性で作り、確認ダイアログでテンポを壊さない）。

<a id="fr-020"></a>

#### FR-020: 設定 — Must

> **関連:** KPI: — | NFR: [NFR-007](./non_functional_requirements.md#nfr-007), [NFR-009](./non_functional_requirements.md#nfr-009) | SC: [SC-008](#sc-008) | **根拠:** [research/07_decision.md](../research/07_decision.md) §4 横断必須（信頼設計 P2 / P3 / P5）

- **説明 / Description**: サウンド・ハプティクスの個別 ON/OFF、進行リセット（二重確認付き）、クレジット・バージョン表示を提供する。
- **アクター / Actor**: Player。
- **事前条件 / Precondition**: 設定画面（[SC-008](#sc-008)）を表示中。
- **トリガー / Trigger**: トグル操作、進行リセットのタップ。
- **主フロー / Main Flow**:
  1. サウンド ON/OFF・ハプティクス ON/OFF のトグルを個別に提供し、変更を即時反映して永続化する（[FR-021](#fr-021)）。
  2. 進行リセットは二重確認とする: ①「本当にリセットしますか？」の確認 → ②「全ての星とコインが消えます」の警告 + タイプ確認（「リセット」と入力）→ 双方通過時のみ初期化を実行する。
  3. クレジットとバージョン番号を表示する。
- **代替フロー / Alternative Flow**: 二重確認のいずれかでキャンセルした場合、進行データは一切変更せず設定画面に戻る。
- **例外フロー / Exception Flow**: リセット実行後は初期状態（L1 のみ解放・コイン 0・アップグレード Lv0・設定は現値維持）を保存する。保存に失敗した場合は [FR-021](#fr-021) の例外フロー（直前データ保持 + 再試行）に従い、中途半端な状態を残さない。
- **事後条件 / Postcondition**: 設定値が即時反映・永続化されている。リセット実行時は進行が初期化されている。
- **ビジネスルール / Business Rule**: サウンド / ハプティクス OFF は信頼設計 P2（User Control）。破壊的操作の二重確認は P5（Appropriate Friction）— 購入（[FR-019](#fr-019)）とは逆に、不可逆な全消去にのみ強い摩擦を課す。

<a id="fr-021"></a>

#### FR-021: 進行データ永続化 — Must

> **関連:** KPI: — | NFR: [NFR-007](./non_functional_requirements.md#nfr-007) | SC: — | **根拠:** [research/07_decision.md](../research/07_decision.md) §2.1（競合の「進行消失」不満への直接回答）（信頼設計 P3 / P6）

- **説明 / Description**: レベル進行・星・コイン・アップグレード Lv・設定を StorageInterface 経由で自動保存し、破損時は部分復元を試行する。ユーザーに保存操作を要求しない。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: StorageInterface の実装（Web = localStorage / Capacitor = Preferences）が注入済み（[FR-022](#fr-022)）。
- **トリガー / Trigger**: レベル終了（クリア / 失敗）毎、アップグレード購入毎、設定変更毎。
- **主フロー / Main Flow**:
  1. 保存対象を直列化する: レベル進行（クリア状態）・星（面ごとのベスト値）・コイン残高・アップグレード Lv（2 軸）・設定（サウンド / ハプティクス）。
  2. schemaVersion を付与し、アトミック書き込み（完全なデータを書き終えてから置換）で保存する。
  3. 起動時にロードし、schemaVersion が旧い場合は前方マイグレーションを適用する。
  4. アプリ強制終了後の再起動でも直近のレベル終了時点まで復元する（[NFR-007](./non_functional_requirements.md#nfr-007)）。
- **代替フロー / Alternative Flow**: マイグレーションで未知フィールドを検出した場合は破棄せず保持する（将来バージョンとの往復に耐える）。
- **例外フロー / Exception Flow**: ①破損検出（parse 失敗・スキーマ不一致）時は部分復元を試行する（読める項目のみ復元）。②部分復元も失敗した場合のみ初期化し、ユーザーへ「進行データを復元できなかった」旨を通知する（無言の初期化を禁止）。③書き込み失敗（容量不足・I/O エラー）時は直前の正常データを保持したまま、次の保存トリガーで再試行する。
- **事後条件 / Postcondition**: 最新の進行状態が永続化されており、いかなる復元経路でも「保存されていたはずの進行が無言で消える」事態が発生しない。
- **ビジネスルール / Business Rule**: 保存は自動のみ（手動セーブ UI を作らない）。進行の永続表示は信頼設計 P6、自動保存・破損復元は P3。競合レビュー最大級の不満「進行消失バグ」への直接回答（[research/07_decision.md](../research/07_decision.md) §2.1）。

---

### F. プラットフォーム基盤 / Platform

<a id="fr-022"></a>

#### FR-022: Platform 抽象層 — Must

> **関連:** KPI: — | NFR: [NFR-010](./non_functional_requirements.md#nfr-010), [NFR-012](./non_functional_requirements.md#nfr-012) | SC: — | **根拠:** [research/07_decision.md](../research/07_decision.md) §6.1・§6.3 / [game_design.md](./game_design.md#gd-3) §3.8

- **説明 / Description**: 広告・計測・触覚・保存の 4 インターフェース（AdInterface / AnalyticsInterface / HapticsInterface / StorageInterface）を定義し、各々に Noop / Web / Capacitor の実装を用意する。v1.0 は SDK 非同梱でインターフェースのみ実装する。
- **アクター / Actor**: System。
- **事前条件 / Precondition**: なし（アプリ起動の最初期に構築される基盤）。
- **トリガー / Trigger**: アプリ起動時の環境判定と実装注入。
- **主フロー / Main Flow**:
  1. AdInterface を定義する: showRewarded(placement) / showInterstitial(placement) / isReady() / イベントコールバック + placement 定数。v1.0 は NoopAdProvider（常に即時成功 or 非表示）を注入する。
  2. AnalyticsInterface を定義する: イベント名は GA4 ゲーム推奨イベントで規約化（level_start / level_end / earn_virtual_currency / spend_virtual_currency）。v1.0 は Noop 実装。
  3. HapticsInterface（[FR-014](#fr-014)）/ StorageInterface（[FR-021](#fr-021)）を定義し、同じ 3 実装構成（Noop / Web / Capacitor）とする。
  4. 起動時に実行環境（ブラウザ / Capacitor）を判定し、対応する実装を注入する。
  5. RV ボタンその他の広告 UI 導線はフラグで非表示化できる形で実装まで済ませる（v1.0 のフラグ値は非表示）。
  6. 広告プレースメント ID・表示タイミング・頻度キャップは Remote Config 化前提の定数として TuningConstants に定義する。
- **代替フロー / Alternative Flow**: Poki / CrazyGames SDK のイベント（gameplayStart / gameplayStop / commercialBreak / rewardedBreak）も AdInterface の別実装として設計し、Web ポータル配信時に注入を差し替えるだけで対応する。
- **例外フロー / Exception Flow**: インターフェース実装内部の失敗（保存失敗 = [FR-021](#fr-021) 例外フローを除く）はゲーム進行をブロックせず、記録のみで継続する（広告・計測の不調でゲームを止めない）。
- **事後条件 / Postcondition**: ゲームロジックはプラットフォーム API を直接参照せず、全アクセスがインターフェース越しになっている。v1.1 の広告 / 計測 SDK 導入が「実装の後刺し」のみで完了する。
- **ビジネスルール / Business Rule**: v1.0 は外部ネットワーク通信ゼロ・SDK 非同梱（[NFR-012](./non_functional_requirements.md#nfr-012)）。過去 2 作の「収益化実装ゼロ」の轍を踏まないための必須スコープ（[research/07_decision.md](../research/07_decision.md) §6.1・§9 リスク9）。

<a id="fr-023"></a>

#### FR-023: Capacitor ネイティブシェル — Must

> **関連:** KPI: [KPI-001](./README.md#kpi-001) | NFR: [NFR-001](./non_functional_requirements.md#nfr-001), [NFR-005](./non_functional_requirements.md#nfr-005), [NFR-013](./non_functional_requirements.md#nfr-013) | SC: — | **根拠:** [research/07_decision.md](../research/07_decision.md) §7.1・§8.1

- **説明 / Description**: Capacitor 8 で iOS / Android のネイティブシェルを生成し、実機での動作・計測（着手週スパイク兼用）を可能にする。ストア提出はフェーズ外。
- **アクター / Actor**: System（ビルド・実行基盤）。
- **事前条件 / Precondition**: Vite ビルドの Web バンドルが生成可能。
- **トリガー / Trigger**: ネイティブビルドの実行。
- **主フロー / Main Flow**:
  1. Capacitor 8 で iOS（16+）/ Android（10+, API 29+）プロジェクトを生成する。
  2. セーフエリア（ノッチ）対応と画面向きの縦固定を設定する。
  3. WebView のハードウェアアクセラレーションを有効化し、60fps 動作を確保する。
  4. @capacitor/haptics プラグインを HapticsInterface の Capacitor 実装へ接続する（[FR-014](#fr-014)）。
  5. 中級 Android 実機（Snapdragon 6xx / Helio G 系）で起動し、[KPI-001](./README.md#kpi-001) のスパイク計測（60fps・物理 step p95 ≤ 4ms）に使用する。
- **代替フロー / Alternative Flow**: Web ビルド（npm run dev / npm run build）はシェルなしでブラウザ動作し、開発反復と将来の Web ポータル配布資産を兼ねる。
- **例外フロー / Exception Flow**: 実機 WebView が 60fps を維持できない場合、①resolution scale 0.75 ②パーティクル生成数削減 ③物理フォールバック方式A（[FR-003](#fr-003) 代替フロー）の順で縮退する（[research/07_decision.md](../research/07_decision.md) §9 リスク1）。
- **事後条件 / Postcondition**: 同一の TypeScript コードベースが Web / iOS / Android の 3 環境で動作している。
- **ビジネスルール / Business Rule**: ストア提出（アイコン・スクショ・メタデータ）はフェーズ外だが計画には含める（[research/07_decision.md](../research/07_decision.md) §8.2）。Capacitor は 8 系を使用する（7 ではない — プラグイン生態系が v8 世代）。

---

### G. オーサリング・品質ゲート / Authoring & Quality Gates

<a id="fr-024"></a>

#### FR-024: インゲームレベルエディタ — Must

> **関連:** KPI: [KPI-004](./README.md#kpi-004) | NFR: [NFR-011](./non_functional_requirements.md#nfr-011) | SC: [SC-009](#sc-009) | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.3・§8.1

- **説明 / Description**: ゲームランタイムに同梱するインゲームレベルエディタ（開発ビルド限定）で、Level Author が地形・ギミック・経済パラメータを編集し、ゴースト解付きレベル JSON を量産する。
- **アクター / Actor**: Level Author。
- **事前条件 / Precondition**: 開発ビルドで起動している（リリースビルドにはエディタコードが存在しない）。
- **トリガー / Trigger**: 開発ビルドのエディタ起動操作。
- **主フロー / Main Flow**:
  1. エディタ（[SC-009](#sc-009)）を起動し、新規レベルまたはインポートした既存レベルを開く。
  2. 地形ポリラインの頂点を追加・移動・削除で編集する。
  3. 車スポーン位置・ゴール旗判定矩形・コイン・ギミックを配置する。
  4. インク予算・星閾値（star2 / star3）・ギミックタグ（anti-dominant を含む）を設定する。
  5. テストプレイを実行し、成功時にゴースト解（描線ポリライン + 走行結果）をレベル JSON へ保存する。
  6. レベル JSON をエクスポート / インポートする。
- **代替フロー / Alternative Flow**: 既存レベル JSON をインポートして編集を再開し、パラメータ変奏（テンプレート × 変奏の量産戦略）に使う。
- **例外フロー / Exception Flow**: ゴースト解が記録されていないレベルは保存操作を拒否する: 保存ボタンを非活性化し「テストプレイで解を記録してください」と表示する（解のないレベルはスキーマ上存在できない）。
- **事後条件 / Postcondition**: ゴースト解 ≥ 1 本付きのレベル JSON が出力され、検証パイプライン（[FR-026](#fr-026)）の入力になる。
- **ビジネスルール / Business Rule**: エディタはインゲーム同梱に限定投資し、専用外部ツールは作らない（[research/07_decision.md](../research/07_decision.md) §3.3）。リリースビルドからビルドフラグで完全除外する。

<a id="fr-025"></a>

#### FR-025: デバッグチューニングパネル — Must

> **関連:** KPI: [KPI-001](./README.md#kpi-001) | NFR: [NFR-010](./non_functional_requirements.md#nfr-010) | SC: [SC-010](#sc-010) | **根拠:** [research/07_decision.md](../research/07_decision.md) §7.3・§9 リスク3 / [game_design.md](./game_design.md#gd-8) §8

- **説明 / Description**: 開発ビルド限定のオーバーレイで、物理・カメラ・juice の全 TuningConstants を実行中にスライダで変更し、fps / 物理 step 時間 / ボディ数を常時表示する。ばね鎖チューニング沼（リスク3）への一次対策。
- **アクター / Actor**: Level Author（開発者としてのチューニング作業）。
- **事前条件 / Precondition**: 開発ビルドで起動している。
- **トリガー / Trigger**: デバッグパネルの表示切替操作。
- **主フロー / Main Flow**:
  1. オーバーレイ（[SC-010](#sc-010)）を表示する（ゲーム画面に重畳、プレイ継続可能）。
  2. 物理パラメータをスライダで実行中に変更する: hertz / dampingRatio / breakForce / breakTorque / 摩擦 / モーター速度・トルク。
  3. カメラパラメータを変更する: lerp 係数 / look-ahead 距離 / trauma 加算量。
  4. juice パラメータを変更する: hit-stop 長 / スロー倍率 / confetti 数。
  5. fps / 物理 step 時間（p95 判定用）/ ボディ数を常時表示する（[KPI-001](./README.md#kpi-001) の計測手段）。
  6. 変更は TuningConstants を単一ソースとして参照する全システムへ即時反映する。
- **代替フロー / Alternative Flow**: パネルを閉じても変更値はセッション中保持され、プレイで手触りを確認してから再度開いて追い込める。
- **例外フロー / Exception Flow**: リリースビルドではパネルのコードごとビルドから除外され、表示手段が存在しない。
- **事後条件 / Postcondition**: 実機で確定したパラメータ値が TuningConstants の初期値更新の根拠になる。
- **ビジネスルール / Business Rule**: 全チューニング値は TuningConstants + レベル JSON に集約し、マジックナンバーの散在を禁止する（grep で検証可能、[NFR-010](./non_functional_requirements.md#nfr-010)）。初期値一覧は [game_design.md](./game_design.md#gd-8) §8。

<a id="fr-026"></a>

#### FR-026: レベル検証パイプライン — Must

> **関連:** KPI: [KPI-004](./README.md#kpi-004) | NFR: [NFR-004](./non_functional_requirements.md#nfr-004), [NFR-011](./non_functional_requirements.md#nfr-011) | SC: — | **根拠:** [research/07_decision.md](../research/07_decision.md) §3.3・§7.2・§8.1

- **説明 / Description**: 同梱全レベルを 4 段の自動ゲート（Gate 0〜3）で検証し、CI（GitHub Actions・固定 Node）で PR 毎に実行する。「全面に解がある」「直線 1 本で全クリできない」をコードで保証する。
- **アクター / Actor**: System（CI / ヘッドレスエンジン）。
- **事前条件 / Precondition**: Engine 層が Phaser 非依存でヘッドレス Node 実行可能（[NFR-010](./non_functional_requirements.md#nfr-010)）。全レベルにゴースト解 ≥ 1 本が添付済み（[FR-024](#fr-024)）。
- **トリガー / Trigger**: PR の作成・更新（CI）、およびローカルでの CLI 実行。
- **主フロー / Main Flow**:
  1. **Gate 0（スキーマ検証）**: 全レベル JSON の必須フィールド・型・schemaVersion・ゴースト解の存在を検証する。
  2. **Gate 1（静的妥当性）**: ①ゴール旗が到達可能な配置である ②インク予算 > 0 である、を静的に検証する。
  3. **Gate 2（ゴースト解リプレイ）**: ヘッドレスエンジンでゴースト解の描線を物理化し走行させ、成功することを検証する。判定は許容帯方式: 成功 / 失敗の一致 + 最終車両位置 ε = 0.05m + tick 数 ±30。
  4. **Gate 3（直線ボット否定）**: anti-dominant タグ付きレベルで、直線 1 本ボット（Straight-line Bot: スポーンから旗へ直線を 1 本描くだけの解法）が必ず失敗することを検証する。
  5. CI は GitHub Actions・固定 Node バージョン（= 固定 V8）で全レベルを対象に PR 毎に実行する。CI 内では同一入力→終了状態ハッシュ一致（ビット一致）で回帰を検出する。
  6. いずれかの Gate に失敗したら CI を fail させ、マージをブロックする。
- **代替フロー / Alternative Flow**: ローカルでも CI と同一 Node バージョンで同一パイプラインを CLI 実行でき、レベル作成中に事前検証できる。
- **例外フロー / Exception Flow**: エンジン更新（Phaser Box2D の更新・フォーク取り込み）で Gate 2 の許容帯を超える差分が出た場合、感度分析で許容帯を再校正するか、ゴースト解を再収録する（[NFR-004](./non_functional_requirements.md#nfr-004) の決定論契約に従い、無検討の閾値緩和を禁止）。
- **事後条件 / Postcondition**: main ブランチの同梱 15 面 + ボーナス 3 面が常に Gate 0〜3 を 100% 通過している（[KPI-004](./README.md#kpi-004)）。
- **ビジネスルール / Business Rule**: 決定論契約は「CI 内ビット一致 + 実機許容帯」の 2 層（[research/07_decision.md](../research/07_decision.md) §7.2）。Gate 3 はゲームデザイン意図（支配戦略の防止 = 競合最大のゲーム性不満への回答）のテスト契約化（同 §3.3）。リプレイは入力再生ではなく描線 + 位置サンプルの再生。

---

<a id="trust-mapping"></a>
## 信頼設計マッピング（Tier 1）

> 💡 信頼設計パターン P1〜P7 の実装先宣言。各 FR / NFR に織り込み済みの内容を横断参照する。詳細プロトコルは [ux_protocol.md](./ux_protocol.md)。

| パターン | 内容 | 実装先 |
| --- | --- | --- |
| **P1** Visibility | 状態の常時可視化 | [FR-002](#fr-002)（インクバー）, [FR-006](#fr-006)（応力可視化 白→黄→赤）, [FR-016](#fr-016)（進捗/星）, [FR-018](#fr-018)（残高一貫表示） |
| **P2** User Control | ユーザーが主導権を持つ | [FR-004](#fr-004)（リスタート常設）, [FR-012](#fr-012)（演出全スキップ）, [FR-014](#fr-014) / [FR-020](#fr-020)（ハプティクス/サウンド個別OFF） |
| **P3** Error Prevention & Recovery | 失敗を罰せず復帰させる | [FR-008](#fr-008)（失敗因果提示・罰なし）, [FR-021](#fr-021)（自動保存・破損復元） |
| **P4** Consistency | フィードバックの一貫性 | [NFR-008](./non_functional_requirements.md#nfr-008)（イベント種別毎のフィードバック統一）, [NFR-010](./non_functional_requirements.md#nfr-010)（TuningConstants 一元化） |
| **P5** Appropriate Friction | 不可逆操作にのみ摩擦 | [FR-019](#fr-019)（価格・効果の事前明示）, [FR-020](#fr-020)（進行リセット二重確認） |
| **P6** Action Audit | 行動の記録と閲覧 | [FR-016](#fr-016)（星・クリア履歴）, [FR-021](#fr-021)（進行の永続表示） |
| **P7** Feedback Loop | ユーザーの声の回収 | MVP 対象外。v1.1 でレビュー誘導・フィードバックリンクを設定画面へ追加予定（[README](./README.md) ロードマップに記載） |

---

<details><summary>書き方のヒント</summary>

| 優先度 | 意味 |
| --- | --- |
| Must | これがないとリリースできない |
| Should | あるべきだが、なくてもMVPは成立する |
| Could | 余裕があれば入れたい |
| Won't | 今回は見送り（将来検討） |

</details>

---

[← ゲームデザイン](./game_design.md) | [📋 目次](./README.md) | [非機能要件 →](./non_functional_requirements.md)

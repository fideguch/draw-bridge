# ユーザーストーリー — InkBridge（仮）MVP

> [📋 目次](./README.md) | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | [非機能要件](./non_functional_requirements.md) | **US** | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

ユーザーストーリーは **「誰が・何をしたい・なぜ」** をユーザー視点で整理し、Given-When-Then の受け入れ基準を付したものです。形式: As a **[role]**, I want **[capability]**, so that **[value]**。
アクターは3者（[README](./README.md) 定義）: **Player** = 通勤・休憩の短セッションで遊ぶカジュアル層（縦持ち片手、チュートリアル文章は読まない）/ **Level Author** = インゲームエディタでゴースト解付きレベル JSON を量産する開発者 / **System** = 固定タイムステップ物理の審判と CI 検証パイプライン。
全26 FR（[functional_requirements.md](./functional_requirements.md)）が優先度 Must のため、全 US も Must を継承します。テンポ・数値契約（[KPI-003](./README.md#kpi-003) / [NFR-003](./non_functional_requirements.md#nfr-003)）は受け入れ基準にそのまま反映しています。数値の単一の正は [research/07_decision.md](../research/07_decision.md)。

---

## ストーリーマップ

| エピック（= FR カテゴリ） | Must | Should | Could |
| --- | --- | --- | --- |
| Epic A: 描く / Draw | [US-001](#us-001), [US-002](#us-002), [US-003](#us-003), [US-004](#us-004) | — | — |
| Epic B: 走る・審判される / Run & Judge | [US-005](#us-005), [US-006](#us-006), [US-007](#us-007), [US-008](#us-008), [US-009](#us-009) | — | — |
| Epic C: 気持ちよさ / Juice | [US-010](#us-010), [US-011](#us-011), [US-012](#us-012) | — | — |
| Epic D: 進行 / Progression | [US-013](#us-013), [US-014](#us-014), [US-015](#us-015) | — | — |
| Epic E: 成長 / Growth | [US-016](#us-016), [US-017](#us-017), [US-018](#us-018), [US-019](#us-019) | — | — |
| Epic F: どこでも遊べる / Play Anywhere | [US-020](#us-020), [US-021](#us-021) | — | — |
| Epic G: 作る・守る / Author & Guard | [US-022](#us-022), [US-023](#us-023), [US-024](#us-024) | — | — |

> **集計**: Must 24件 (99 SP) / Should 0件 (0 SP) / Could 0件 (0 SP) / 合計 24件 (99 SP)

### 信頼設計カバレッジ（P1-P7 → US）

> 💡 [ux_protocol.md](./ux_protocol.md) の信頼設計パターンに対応するストーリーの横断参照。実装先 FR は [functional_requirements.md](./functional_requirements.md) の「信頼設計マッピング」を参照。

| パターン | 対応US |
| --- | --- |
| P1 Visibility | [US-003](#us-003)（インクバー）, [US-006](#us-006)（応力可視化）, [US-014](#us-014)（星・進捗一覧）, [US-016](#us-016)（残高一貫表示） |
| P2 User Control | [US-004](#us-004)（リスタート常設）, [US-011](#us-011)（演出スキップ）, [US-012](#us-012)（ハプティクス個別OFF） |
| P3 Error Prevention & Recovery | [US-008](#us-008)（失敗因果提示・罰なし）, [US-018](#us-018)（自動保存・破損復元） |
| P4 Consistency | [US-012](#us-012)（イベント→触覚マッピング一元化）, [US-023](#us-023)（TuningConstants 一元化） |
| P5 Appropriate Friction | [US-017](#us-017)(価格・効果の事前明示), [US-019](#us-019)（進行リセット二重確認） |
| P6 Action Audit | [US-014](#us-014)（星・クリア履歴）, [US-018](#us-018)（進行の永続化） |
| P7 Feedback Loop | MVP 対象外（v1.1 でレビュー誘導・フィードバックリンクを設定画面へ追加予定 — [README](./README.md) ロードマップ） |

---

## エピック別ストーリー

### Epic A: 描く / Draw

> 💡 FR カテゴリ A（描画）に対応。コア動詞「描く」の成立と、描き直しの自由を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-001](#us-001) | 描いて離したら橋になって車が走り出す | [FR-001](./functional_requirements.md#fr-001), [FR-003](./functional_requirements.md#fr-003), [FR-005](./functional_requirements.md#fr-005) | Must | 8 |
| [US-002](#us-002) | 描く手応えが指と耳に返る | [FR-001](./functional_requirements.md#fr-001), [FR-010](./functional_requirements.md#fr-010) | Must | 5 |
| [US-003](#us-003) | インク残量が一目で分かる | [FR-002](./functional_requirements.md#fr-002) | Must | 3 |
| [US-004](#us-004) | 失敗してもすぐやり直せる | [FR-004](./functional_requirements.md#fr-004), [FR-008](./functional_requirements.md#fr-008), [FR-013](./functional_requirements.md#fr-013) | Must | 3 |

<a id="us-001"></a>

#### US-001: 描いて離したら橋になって車が走り出す — Must (8 SP)

**ソースFR:** [FR-001](./functional_requirements.md#fr-001), [FR-003](./functional_requirements.md#fr-003), [FR-005](./functional_requirements.md#fr-005)

- **ストーリー / Story**: As a **Player**, I want 指1本のドラッグで線を1本描き、指を離した瞬間にその線が橋になって車が走り出してほしい, so that 操作説明を読まなくても「描く（創造）→放つ（審判）」の核体験が最初の面から成立する。
- **ストーリーポイント / Story Points**: 8
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 描画フェーズ（[SC-003](./functional_requirements.md#sc-003)）, When 画面をドラッグする, Then 線の先端がタッチの生座標に同フレーム（60fps 基準 16.7ms 以内）で追従し、平滑化は過去頂点のみに適用される（[KPI-002](./README.md#kpi-002)）。
  - [ ] Given 線を描いた状態, When 指を離す, Then 確定ポップ（scale 1.0→1.06→1.0 / 120ms）+ 確定音 + light ハプティクスと同時に線がカプセルチェーンとして物理化され、わずかに落下・たわむ。
  - [ ] Given 物理化完了, When 発進シーケンス, Then 0.3〜0.5秒の溜めを経て車が自動発進し、走行中のプレイヤー操作は存在しない（描いた線だけが審判される）。
  - [ ] Given L1 を初見プレイ, When 線を描いて離す, Then 追加操作なしで走行が完走し、L1 を 25 秒以内にクリアできる（[KPI-003](./README.md#kpi-003)）。
- **備考 / Notes**: インベントリ指定の必須ストーリー。物理化は方式C（セグメント化カプセルチェーン、[research/07_decision.md](../research/07_decision.md) §7.2）。頂点 2 点未満・最小セグメント長未満の線は物理化せずインク返還（[FR-003](./functional_requirements.md#fr-003) 例外フロー）。

<a id="us-002"></a>

#### US-002: 描く手応えが指と耳に返る — Must (5 SP)

**ソースFR:** [FR-001](./functional_requirements.md#fr-001), [FR-010](./functional_requirements.md#fr-010)

- **ストーリー / Story**: As a **Player**, I want 描いている最中に線の見た目・音・粒子が指の動きへ連続的に反応してほしい, so that 「線を引く」行為そのものが気持ちよく、何度でも描き直したくなる。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 描画中, When ドラッグ速度を変える, Then ペン/マーカーのループ音が音量 0.3〜1.0 / ピッチ 1.0〜1.2 で速度に連動する。
  - [ ] Given 描画中, When 指を止める, Then ループ音が 30〜50ms のフェードで停止する（「動き = 音」の一致）。
  - [ ] Given ドラッグ, When 頂点追加, Then 最小点間距離 4〜8px で頂点が追加され、線は太さ画面幅 2〜3%（375pt 幅で 8〜12pt）・丸キャップ・高コントラスト単色 + 外周 1〜2px の濃色ボーダーで描画される。
  - [ ] Given サウンド OFF（[FR-020](./functional_requirements.md#fr-020)）, When 描画, Then 音は再生されないが描画機能は完全動作する。
- **備考 / Notes**: ストローク毎の基準ピッチ ±5% ランダム化・ペン先ダスト 2〜5 個/フレームは [research/07_decision.md](../research/07_decision.md) §4.1（[KPI-005](./README.md#kpi-005) チェックリスト対象）。

<a id="us-003"></a>

#### US-003: インク残量が一目で分かる — Must (3 SP)

**ソースFR:** [FR-002](./functional_requirements.md#fr-002)

- **ストーリー / Story**: As a **Player**, I want 描ける残り長さ（インク）が常にバーで見えてほしい, so that 「どこまで太く・長く描けるか」を賭けの対象にでき、星3を狙う戦略が立てられる（信頼設計 P1）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 描画中, When 線長が伸びる, Then バーが同フレームでリアルタイム減少し、残量 > 50% は緑 / 20〜50% は黄 / < 20% は赤 + 300ms 周期点滅で表示される。
  - [ ] Given 残量 0, When さらにドラッグする, Then それ以上描けず、「カスッ」空振り音 + バー横シェイク 4〜6px / 150ms + warning ハプティクスが発火する。
  - [ ] Given Ink Capacity Lv 購入済み（[FR-019](./functional_requirements.md#fr-019)）, When レベル開始, Then インク予算に +10%/Lv が実乗算された値でバーが初期化される。
- **備考 / Notes**: 色 + 非色（バー長・点滅）の二重符号化（[NFR-009](./non_functional_requirements.md#nfr-009)）。[research/07_decision.md](../research/07_decision.md) §4.1。

<a id="us-004"></a>

#### US-004: 失敗してもすぐやり直せる — Must (3 SP)

**ソースFR:** [FR-004](./functional_requirements.md#fr-004), [FR-008](./functional_requirements.md#fr-008), [FR-013](./functional_requirements.md#fr-013)

- **ストーリー / Story**: As a **Player**, I want 失敗しても・描き損ねても、いつでもワンタップで即やり直したい, so that 「次はこう描こう」と考え直すこと自体が楽しみになり、フラストレーションが積み上がらない（信頼設計 P2: リスタート常設）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 描画フェーズまたは走行フェーズ（崩落の最中を含む）, When 常設リスタートボタンをタップ, Then 確認ダイアログなしで 1 秒以内に同レベルの初期状態（描画フェーズの静止俯瞰）へ戻る（[KPI-003](./README.md#kpi-003)）。
  - [ ] Given 失敗リザルト（[SC-006](./functional_requirements.md#sc-006)）, When Retry をタップ, Then 1 秒以内に再開でき、失敗演出は軽量暗転 + 短い残念音のみでテンポを妨げない。
  - [ ] Given リセット処理中, When ボタン連打, Then 多重リセットは発生しない（1 回のみ処理）。
  - [ ] Given 失敗またはリスタート, When 再開, Then ライフ・スタミナ・ペナルティ・待機時間は 0 件（罰なし設計）。
- **備考 / Notes**: インベントリ指定の必須ストーリー。「失敗→リトライ ≤ 1秒」はテンポ契約の自動テスト項目（[NFR-003](./non_functional_requirements.md#nfr-003)）。[research/07_decision.md](../research/07_decision.md) §3.2・§3.5。

---

### Epic B: 走る・審判される / Run & Judge

> 💡 FR カテゴリ B（走行・審判）に対応。「描いた線が審判される」緊張と、本作最大の差別化（たわみ・軋み・破断）を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-005](#us-005) | 溜め→解放の発進にワクワクする | [FR-005](./functional_requirements.md#fr-005), [FR-011](./functional_requirements.md#fr-011) | Must | 5 |
| [US-006](#us-006) | 自分の橋がたわみ・軋み・折れる | [FR-006](./functional_requirements.md#fr-006) | Must | 8 |
| [US-007](#us-007) | 少ないインクで星3を狙う | [FR-007](./functional_requirements.md#fr-007) | Must | 3 |
| [US-008](#us-008) | 失敗の原因が一目で分かる | [FR-008](./functional_requirements.md#fr-008) | Must | 3 |
| [US-009](#us-009) | 走りながらコインを拾って稼ぐ | [FR-009](./functional_requirements.md#fr-009) | Must | 3 |

<a id="us-005"></a>

#### US-005: 溜め→解放の発進にワクワクする — Must (5 SP)

**ソースFR:** [FR-005](./functional_requirements.md#fr-005), [FR-011](./functional_requirements.md#fr-011)

- **ストーリー / Story**: As a **Player**, I want 線を確定した直後、車が「溜めてから一気に走り出す」儀式を見せてほしい, so that 自分の橋が審判される瞬間への期待が最大化される（anticipation → release）。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 線の確定, When 発進シーケンス開始, Then 0.3〜0.5s 固定の溜め（エンジンレブ音ピッチ 1.0→1.4 + 車体後傾 squash + 車輪空転・後方の煙）が再生される。
  - [ ] Given 溜め完了, When 解放, Then ダストパーティクル 10〜20 個一斉放出 + 車体前方 stretch（横 1.15 / 縦 0.9 → 100ms 復帰）+ 低域の発進バースト音 + medium / PRIMITIVE_THUD(0.8) ハプティクスが同時発火する。
  - [ ] Given 走行中, When 速度変化, Then エンジン音ピッチが 1.0〜1.5 で連動（0.25 刻みのギア段付き）し、車輪は実速度同期で回転し、カメラは lerp 係数 0.08〜0.15 + 車体 1〜2 台分の look-ahead で追従する。
  - [ ] Given Engine Speed Lv 購入済み（[FR-019](./functional_requirements.md#fr-019)）, When 走行, Then モーター速度に +5%/Lv が実乗算される。
- **備考 / Notes**: [research/07_decision.md](../research/07_decision.md) §4.2（[KPI-005](./README.md#kpi-005) 必須チェックリスト）。発進時カメラキック（逆方向 8〜16px → 0.3s 復帰）を含む。

<a id="us-006"></a>

#### US-006: 自分の橋がたわみ・軋み・折れる — Must (8 SP)

**ソースFR:** [FR-006](./functional_requirements.md#fr-006)

- **ストーリー / Story**: As a **Player**, I want 車の荷重で自分の描いた橋が本当にたわみ、軋み、限界を超えると折れてほしい, so that 「渡り切れるか」の緊張と「ギリギリ耐えた/崩れ落ちた」のカタルシスが毎回味わえる（本作最大の差別化・信頼設計 P1）。
- **ストーリーポイント / Story Points**: 8
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 車が橋チェーン上, When ジョイント stress（EMA 0.85 / 0.15 平滑）が 0.6〜1.0 帯に入る, Then 軋み SFX の音量・ピッチ + 当該線分色の白→黄→赤補間 + 粉パーティクル + 弱ハプティクス連打が stress 値に連動する。
  - [ ] Given stress > 1.0 のジョイント, When 破断, Then b2DestroyJoint による部分崩落 + クラック音 + 破片パーティクル + カメラ trauma +0.5 + 折れ口ハイライト（描画パス分割 + ギザギザ表示）が発生する。
  - [ ] Given 破断後の孤立チェーン片, When 数秒経過（初期値は TuningConstants で管理）, Then 車と非衝突化されフェードアウトする。
  - [ ] Given フォールバック方式A 稼働時（[FR-003](./functional_requirements.md#fr-003) 代替フロー）, When 走行, Then 応力・破断は発生せず描画層のみの演出たわみに後退する。
- **備考 / Notes**: 競合クローンは全て単一剛体でありジャンル未実装の体験（[research/07_decision.md](../research/07_decision.md) §2.2・§7.2）。応力可視化は色 + 非色の二重符号化（[NFR-009](./non_functional_requirements.md#nfr-009)）。

<a id="us-007"></a>

#### US-007: 少ないインクで星3を狙う — Must (3 SP)

**ソースFR:** [FR-007](./functional_requirements.md#fr-007)

- **ストーリー / Story**: As a **Player**, I want インクを節約して渡り切るほど高い星評価がほしい, so that クリア後も「もっと細く・短く描けたはず」と同じ面に挑み直す動機が生まれる。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 車体基準点がゴール旗判定矩形に到達, When クリア確定, Then インク消費量とレベル JSON の閾値 2 値の比較で星が算定される: 消費 ≤ star3 閾値 → 星3 / 消費 ≤ star2 閾値 → 星2 / それ以外 → 星1。
  - [ ] Given 星1 のクリア, When 進行, Then 次レベルは解放される（星による進行ブロック 0 件）。
  - [ ] Given クリア条件と失敗条件が同一 tick で同時成立, When 判定, Then クリアが優先される（プレイヤー有利解釈）。
- **備考 / Notes**: Happy Glass 方式（[research/07_decision.md](../research/07_decision.md) §3.2）。星閾値の設計指針は [game_design.md](./game_design.md#gd-5-6) §5.6。

<a id="us-008"></a>

#### US-008: 失敗の原因が一目で分かる — Must (3 SP)

**ソースFR:** [FR-008](./functional_requirements.md#fr-008)

- **ストーリー / Story**: As a **Player**, I want 失敗したとき「どこが限界を超えたか」を画面上で見せてほしい, so that 敗因を自分の描いた線に帰属でき、「次はここを支えよう」という仮説を持ってリトライできる（信頼設計 P3: 失敗因果）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 橋の破断起因で車が落下, When 失敗確定, Then 破断ジョイント位置（折れ口ハイライト）が維持表示され、失敗リザルトでも視認できる。
  - [ ] Given 車の屋根接地が連続 0.5s（初期値）継続, When 転倒判定, Then 転倒姿勢の車体がハイライトされ失敗が確定する。
  - [ ] Given 車体基準点が画面下限 Y を下回る、または制限 tick（初期値 30s 相当 = 1800 tick）超過, When 失敗確定, Then 落下地点またはタイムアウトの原因表示とともに Retry が即時活性化する。
  - [ ] Given 失敗確定, When リザルト表示, Then 減点表示・煽り文言・報酬減は 0 件（Not punitive）。
- **備考 / Notes**: 00 の「原因バナー」思想の物理版（[research/07_decision.md](../research/07_decision.md) §3.2）。失敗条件は落下・転倒・タイムアウトの 3 種。

<a id="us-009"></a>

#### US-009: 走りながらコインを拾って稼ぐ — Must (3 SP)

**ソースFR:** [FR-009](./functional_requirements.md#fr-009)

- **ストーリー / Story**: As a **Player**, I want 走行中にコインをリズムよく拾い、取るほど音が上がっていってほしい, so that 良い線を描いた走行がそのまま報酬とコンボの快感になる。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 走行中, When コインに接触, Then 取得ポップ（scale 1.0→1.3→0 / 150ms）+ キラ粒子 4〜8 個が再生され、取得音は連続取得ごとに +1 semitone 上昇する（上限 +12、取得が 1〜1.5s 途切れたらリセット）。
  - [ ] Given クリア確定, When 報酬加算, Then クリア報酬 20〜30 コイン + レベル内収集分が残高へ加算され、earn_virtual_currency イベントが記録される。
  - [ ] Given 失敗またはリスタート, When そのランで取得したコイン, Then 残高へ加算されず初期配置に戻る（残高加算はクリア確定時のみ）。
  - [ ] Given コインを 1 枚も取らずにクリア, When 報酬, Then クリア報酬は満額付与される（コインは経路誘導であり強制ではない）。
- **備考 / Notes**: アーチ状 0.1〜0.2s 間隔のリズム配置（[research/07_decision.md](../research/07_decision.md) §4.2・§5.2）。

---

### Epic C: 気持ちよさ / Juice

> 💡 FR カテゴリ C（演出）に対応。爽快感3場面の仕上げと、テンポを壊さないスキップ・OFF の主導権を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-010](#us-010) | ゴールの5拍演出でカタルシスを味わう | [FR-012](./functional_requirements.md#fr-012) | Must | 5 |
| [US-011](#us-011) | 演出はいつでもスキップできる | [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013) | Must | 2 |
| [US-012](#us-012) | 触覚の手応えを感じる・切れる | [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020) | Must | 3 |

<a id="us-010"></a>

#### US-010: ゴールの5拍演出でカタルシスを味わう — Must (5 SP)

**ソースFR:** [FR-012](./functional_requirements.md#fr-012)

- **ストーリー / Story**: As a **Player**, I want ゴールの瞬間に時間が止まり、紙吹雪と星と報酬が畳みかけてほしい, so that 「渡り切った」達成が全身で祝福され、次の面へ進む勢いが生まれる。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 車体基準点がゴール旗に接触, When クリア演出, Then ①hit-stop 80〜120ms ②timeScale 0.3 スロー（実時間 0.3〜0.5s 維持 → 0.2〜0.3s で復帰、カメラ 15〜25% ズームイン）③confetti 2段（左右キャノン各 40〜60 個 → 0.3s 遅れ上部レイン 60〜100 個）④星の順次出現（200〜300ms 間隔、ド・ミ・ソ上昇アルペジオ、3 つ目のみシンバル）⑤報酬カウントアップ 0.8〜1.5s + コインバースト 10〜30 枚、の 5 拍が順に再生される（全体 3〜4 秒）。
  - [ ] Given 演出完了, When Next 待ち, Then Next ボタンが 1.5〜2.5s で活性化し、scale ±5% / 周期 0.8s で脈動する（Replay 併設）。
  - [ ] Given ゴール瞬間, When BGM, Then -6〜-9dB へ 0.2s でダッキングされ SFX が立つ（[NFR-014](./non_functional_requirements.md#nfr-014)）。
  - [ ] Given hit-stop 使用上限（1 レベル 1〜2 回、大クラッシュと共有）超過, When 拍1, Then 拍1 を省略し拍2 以降を実行する。
- **備考 / Notes**: [research/07_decision.md](../research/07_decision.md) §4.3（[KPI-005](./README.md#kpi-005) 必須チェックリスト）。パラメータは TuningConstants §8.5（[game_design.md](./game_design.md#gd-8)）。

<a id="us-011"></a>

#### US-011: 演出はいつでもスキップできる — Must (2 SP)

**ソースFR:** [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013)

- **ストーリー / Story**: As a **Player**, I want どの演出もタップ1回で飛ばしたい, so that 周回プレイのテンポが演出に奪われず、短い休憩時間でも多くの面を回せる（信頼設計 P2: 演出スキップ）。
- **ストーリーポイント / Story Points**: 2
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given ゴール演出のいずれの拍, When 画面タップ, Then 演出全体が即スキップされ、星・獲得コインの確定値が静的表示され Next / Replay が即時活性化する（スキップによる値の変化 0 件）。
  - [ ] Given 失敗確定, When 演出, Then 軽量暗転 + 短い残念音のみで Retry が即出現し、confetti・カウントアップに類する報酬系演出は流用されない。
  - [ ] Given 描く→走る→ゴール演出→次面表示のループ 1 周, When 計測, Then 40 秒以内に収まる（[KPI-003](./README.md#kpi-003) / [NFR-003](./non_functional_requirements.md#nfr-003)）。
- **備考 / Notes**: 「juice 過剰でテンポ死」リスクへの数値契約対策（[research/07_decision.md](../research/07_decision.md) §9 リスク10）。

<a id="us-012"></a>

#### US-012: 触覚の手応えを感じる・切れる — Must (3 SP)

**ソースFR:** [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020)

- **ストーリー / Story**: As a **Player**, I want 線の確定・発進・星の出現が指先の振動でも返ってきてほしい（そして電車内では完全に切りたい）, so that 画面を注視しなくても操作の成立が分かり、環境に合わせて体験を制御できる（信頼設計 P2 / P4）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 線確定・発進・着地・破断・星出現・インク枯渇の各イベント, When 発火, Then 一元マッピング表（確定 = light / PRIMITIVE_TICK(0.6)、発進 = medium / PRIMITIVE_THUD(0.8)、着地 = heavy / PRIMITIVE_THUD(1.0)、破断・軋み = weak 連打、星 = light→medium→heavy 漸増、枯渇 = warning）どおりの触覚が HapticsInterface 経由で返る。
  - [ ] Given Android で primitive 未対応の端末, When 起動時の areAllPrimitivesSupported() 検査, Then 振幅ベースへフォールバックし「一部イベントのみ無音」の不整合が発生しない。
  - [ ] Given 設定でハプティクス OFF, When 全イベント, Then 触覚発火が 0 件になり、変更は即時反映・永続化される。
  - [ ] Given タッチ入力, When ハプティクス発火, Then タッチ→触覚 100ms 以内（[KPI-002](./README.md#kpi-002) / [NFR-002](./non_functional_requirements.md#nfr-002)）。
- **備考 / Notes**: [research/07_decision.md](../research/07_decision.md) §4 横断必須。バイブレーション非搭載環境では Noop / Web 実装が空動作し例外を投げない。

---

### Epic D: 進行 / Progression

> 💡 FR カテゴリ D（レベル・進行）に対応。読まずに学べる FTUE と、面を選び星を集め直す循環を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-013](#us-013) | 説明を読まずに最初の3面で覚える | [FR-017](./functional_requirements.md#fr-017) | Must | 5 |
| [US-014](#us-014) | 面を選び星を集め直す | [FR-015](./functional_requirements.md#fr-015), [FR-016](./functional_requirements.md#fr-016) | Must | 3 |
| [US-015](#us-015) | ボーナス面で大きく稼ぐ | [FR-009](./functional_requirements.md#fr-009), [FR-015](./functional_requirements.md#fr-015) | Must | 2 |

<a id="us-013"></a>

#### US-013: 説明を読まずに最初の3面で覚える — Must (5 SP)

**ソースFR:** [FR-017](./functional_requirements.md#fr-017)

- **ストーリー / Story**: As a **Player**, I want チュートリアル文章を1文字も読まずに、最初の3面を連続成功しながら遊び方を覚えたい, so that ダウンロード直後の数十秒で「これは自分のゲームだ」と確信できる。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 初回起動で L1, When プレイ, Then テキスト表示 0 件・指アイコンのなぞり誘導のみで、初回タッチから 10 秒で初成功できる（L1 は狭い谷 + 潤沢インクで失敗が困難な地形）。
  - [ ] Given 初回起動, When 45 秒経過時点, Then 描く→走る→ゴール 5 拍演出のフル快感 1 周を必ず 1 回体験済みである。
  - [ ] Given L1 開始, When L3 クリアまで, Then 合計 60〜90 秒で 3 連続成功する（[KPI-003](./README.md#kpi-003)。L2 でインクメーターと星、L3 で成功の定着を学習）。
  - [ ] Given 誘導を無視した線, When L1 プレイ, Then それでもクリアできる（誘導は強制ではない）。L1 で失敗した場合はリトライ開始時に誘導が再表示される。
- **備考 / Notes**: [research/07_decision.md](../research/07_decision.md) §3.4。対象ユーザーは文章を読まない前提（[README](./README.md) ペルソナ）。

<a id="us-014"></a>

#### US-014: 面を選び星を集め直す — Must (3 SP)

**ソースFR:** [FR-015](./functional_requirements.md#fr-015), [FR-016](./functional_requirements.md#fr-016)

- **ストーリー / Story**: As a **Player**, I want チャプターマップで自分の星と進み具合を一覧し、解放済みの面に挑み直したい, so that 積み上げた成果が常に見え、星3の埋め直しという自分のペースの遊びができる（信頼設計 P1 / P6）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given レベル選択（[SC-002](./functional_requirements.md#sc-002)）, When 表示, Then Ch1 の 15 面 + ボーナス 3 面それぞれの星（0〜3）・クリア状態・ロック状態が表示され、ボーナス面は通常面と視覚的に区別される。
  - [ ] Given クリア済み面の再プレイで記録未満の星, When 保存, Then 表示・保存はベスト値を保持する（低い結果での上書き 0 件）。
  - [ ] Given ロック中の面, When タップ, Then 遷移せず、ロックアイコンのシェイクと「前のレベルをクリア」の表示で解放条件が伝わる。
  - [ ] Given ホーム（[SC-001](./functional_requirements.md#sc-001)）, When 起動, Then 2 タップ以内にプレイを開始でき、リザルト→次面のレベル遷移は 1 秒以内に完了する（[NFR-006](./non_functional_requirements.md#nfr-006)）。
- **備考 / Notes**: [research/07_decision.md](../research/07_decision.md) §3.3。タッチターゲット ≥ 44pt（[NFR-009](./non_functional_requirements.md#nfr-009)）。

<a id="us-015"></a>

#### US-015: ボーナス面で大きく稼ぐ — Must (2 SP)

**ソースFR:** [FR-009](./functional_requirements.md#fr-009), [FR-015](./functional_requirements.md#fr-015)

- **ストーリー / Story**: As a **Player**, I want 5面ごとにご褒美のボーナス面で一気にコインを稼ぎたい, so that 「あと少しでボーナス」がセッションを続ける理由になり、アップグレード資金が貯まる。
- **ストーリーポイント / Story Points**: 2
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given L5 / L10 / L15 のクリア, When 進行, Then ボーナス面（計 3 面）が出現する。
  - [ ] Given ボーナス面のクリア, When 報酬, Then 通常面の 5〜10 倍のコインが付与される。
  - [ ] Given レベル選択, When ボーナス面表示, Then 通常面と視覚的に区別されている（[US-014](#us-014) と共通）。
- **備考 / Notes**: 将来のリワード広告接続点（v1.1、[research/07_decision.md](../research/07_decision.md) §3.5・§5.2）。

---

### Epic E: 成長 / Growth

> 💡 FR カテゴリ E（メタ・経済）に対応。コインを注ぎ込む成長実感と、資産（進行・残高）を守る信頼を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-016](#us-016) | 強化したら本当に体感が変わる | [FR-018](./functional_requirements.md#fr-018), [FR-019](./functional_requirements.md#fr-019) | Must | 5 |
| [US-017](#us-017) | 買う前に価格と効果が分かる | [FR-019](./functional_requirements.md#fr-019) | Must | 2 |
| [US-018](#us-018) | 進行が絶対に消えない | [FR-021](./functional_requirements.md#fr-021) | Must | 3 |
| [US-019](#us-019) | 進行リセットを誤って実行しない | [FR-020](./functional_requirements.md#fr-020) | Must | 2 |

<a id="us-016"></a>

#### US-016: 強化したら本当に体感が変わる — Must (5 SP)

**ソースFR:** [FR-018](./functional_requirements.md#fr-018), [FR-019](./functional_requirements.md#fr-019)

- **ストーリー / Story**: As a **Player**, I want 貯めたコインでインク量と車速を強化し、次のプレイで確かに違いを感じたい, so that 稼ぐ→強くなる→新しい解が描けるの循環が信じられる。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 残高が価格以上, When Ink Capacity を購入, Then 即時に残高から差し引かれ Lv +1 され、次のレベルからインク予算に +10%/Lv（上限 5Lv）が実乗算される（ダミー効果 0 件）。
  - [ ] Given Engine Speed 購入済み, When 走行, Then モーター速度に +5%/Lv（上限 5Lv）が実乗算され、速度↑ = 描画精度要求↑のリスクリターンが成立する。
  - [ ] Given 価格, When Lv 進行, Then 初回 50〜100 コイン → × 1.15〜1.25/Lv の緩指数に従う（Lv 別価格表は [game_design.md](./game_design.md#gd-7-2) §7.2）。
  - [ ] Given 残高変動, When ホーム（[SC-001](./functional_requirements.md#sc-001)）・ショップ（[SC-007](./functional_requirements.md#sc-007)）・リザルト（[SC-005](./functional_requirements.md#sc-005)）表示, Then 3 画面で同一の値・同一の表記で表示される（信頼設計 P1）。
- **備考 / Notes**: 効果のダミー禁止は [research/07_decision.md](../research/07_decision.md) §5.1 設計原則。spend_virtual_currency イベント記録は [FR-018](./functional_requirements.md#fr-018)。

<a id="us-017"></a>

#### US-017: 買う前に価格と効果が分かる — Must (2 SP)

**ソースFR:** [FR-019](./functional_requirements.md#fr-019)

- **ストーリー / Story**: As a **Player**, I want 購入前に「いくらで・何が・どれだけ良くなるか」をはっきり見たい, so that 誤購入の後悔なしに、確認ダイアログのテンポ阻害もなしに買い物できる（信頼設計 P5）。
- **ストーリーポイント / Story Points**: 2
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given ショップ表示, When 各軸を見る, Then 現在 Lv・価格（大きく表示）・次 Lv の効果が数値 + ビジュアル（例: インクバーの伸長プレビュー）で購入前に見える。
  - [ ] Given 残高不足, When 購入ボタン, Then 非活性 + 不足額表示となり、タップしても取引は発生しない（残高 ≥ 0 の不変条件を破る操作 0 件）。
  - [ ] Given 上限 Lv 到達済みの軸, When 表示, Then 「MAX」表示で購入ボタンが非活性化される。
  - [ ] Given 購入ボタン連打, When 処理, Then 1 回のみ処理される（二重購入 0 件）。
- **備考 / Notes**: 購入は即時・Undo なし。摩擦は価格の視認性で作り確認ダイアログは出さない（[research/07_decision.md](../research/07_decision.md) §5.1 / [FR-019](./functional_requirements.md#fr-019) ビジネスルール）。

<a id="us-018"></a>

#### US-018: 進行が絶対に消えない — Must (3 SP)

**ソースFR:** [FR-021](./functional_requirements.md#fr-021)

- **ストーリー / Story**: As a **Player**, I want 何もしなくても星・コイン・強化・設定が全部残っていてほしい, so that アプリを突然閉じても・電池が切れても、積み上げた進行を失う不安なく遊べる（信頼設計 P3 / P6: 進行保全）。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given レベル終了（クリア / 失敗）・アップグレード購入・設定変更の各イベント, When 発生, Then レベル進行・星（ベスト値）・コイン残高・アップグレード Lv・設定が schemaVersion 付きでアトミック書き込みにより自動保存される（ユーザーの保存操作 0 回）。
  - [ ] Given アプリ強制終了, When 再起動, Then 直近のレベル終了時点まで復元される（[NFR-007](./non_functional_requirements.md#nfr-007)）。
  - [ ] Given 保存データ破損（parse 失敗・スキーマ不一致）, When 起動, Then 部分復元（読める項目のみ）を試行し、失敗時のみ初期化 + 「進行データを復元できなかった」通知を表示する（無言の初期化 0 件）。
  - [ ] Given 書き込み失敗（容量不足・I/O エラー）, When 保存, Then 直前の正常データを保持したまま次の保存トリガーで再試行する。
- **備考 / Notes**: 競合レビュー最大級の不満「進行消失バグ」への直接回答（[research/07_decision.md](../research/07_decision.md) §2.1）。StorageInterface（Web = localStorage / Capacitor = Preferences）経由。

<a id="us-019"></a>

#### US-019: 進行リセットを誤って実行しない — Must (2 SP)

**ソースFR:** [FR-020](./functional_requirements.md#fr-020)

- **ストーリー / Story**: As a **Player**, I want 全進行の消去だけは二段階で確認してほしい, so that 設定画面の誤タップで星とコインを失う事故が起きない（信頼設計 P5: 不可逆操作にのみ摩擦）。
- **ストーリーポイント / Story Points**: 2
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 設定（[SC-008](./functional_requirements.md#sc-008)）で進行リセットをタップ, When 二重確認（①「本当にリセットしますか？」→ ②「全ての星とコインが消えます」+ 指定文字列のタイプ確認）を双方通過, Then 初期化が実行され L1 のみ解放・コイン 0・アップグレード Lv0 に戻る（サウンド / ハプティクス設定は現値維持）。
  - [ ] Given 二重確認のいずれかの段階, When キャンセル, Then 進行データの変更 0 件で設定画面に戻る。
  - [ ] Given サウンド / ハプティクスのトグル, When 変更, Then 確認なしで即時反映・永続化される（摩擦は不可逆操作のみに限定）。
- **備考 / Notes**: 購入（[US-017](#us-017)）と対になる摩擦設計（[research/07_decision.md](../research/07_decision.md) §4 横断必須 / [FR-020](./functional_requirements.md#fr-020)）。

---

### Epic F: どこでも遊べる / Play Anywhere

> 💡 FR カテゴリ F（プラットフォーム基盤）に対応。実機での品質と、将来の収益化・計測を後刺しできる骨格を担保する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-020](#us-020) | 手元のスマホで 60fps で遊ぶ | [FR-023](./functional_requirements.md#fr-023) | Must | 5 |
| [US-021](#us-021) | 通信ゼロで遊べて広告は後刺しできる | [FR-022](./functional_requirements.md#fr-022) | Must | 5 |

<a id="us-020"></a>

#### US-020: 手元のスマホで 60fps で遊ぶ — Must (5 SP)

**ソースFR:** [FR-023](./functional_requirements.md#fr-023)

- **ストーリー / Story**: As a **Player**, I want ハイエンドではない自分のスマホでも滑らかに遊びたい, so that 物理のたわみと爽快感が端末性能で毀損されない。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 中級 Android 実機（Snapdragon 6xx / Helio G 系）の Capacitor WebView, When プレイ, Then 60fps 維持・物理 step p95 ≤ 4ms を満たす（[KPI-001](./README.md#kpi-001) / [NFR-001](./non_functional_requirements.md#nfr-001)）。
  - [ ] Given ノッチ付き端末, When 表示, Then セーフエリア対応 + 画面向き縦固定で UI 要素の欠け 0 件。
  - [ ] Given 60fps 未達の端末, When 縮退, Then ①resolution scale 0.75 ②パーティクル生成数削減 ③物理フォールバック方式A の順で縮退する。
  - [ ] Given 同一 TypeScript コードベース, When ビルド, Then Web（ブラウザ）/ iOS 16+ / Android 10+（API 29+）の 3 環境で動作する（[NFR-005](./non_functional_requirements.md#nfr-005)）。
- **備考 / Notes**: 実機計測は着手週スパイクの合格ゲート兼用（[research/07_decision.md](../research/07_decision.md) §7.3・§9 リスク1）。ストア提出はフェーズ外。

<a id="us-021"></a>

#### US-021: 通信ゼロで遊べて広告は後刺しできる — Must (5 SP)

**ソースFR:** [FR-022](./functional_requirements.md#fr-022)

- **ストーリー / Story**: As a **Level Author**（開発者）, I want v1.0 は外部通信ゼロのまま、広告・計測・触覚・保存をインターフェース抽象の背後に隔離しておきたい, so that v1.1 の広告 / 計測 SDK 導入が「実装の後刺し」だけで完了し、過去2作の「収益化実装ゼロ」の轍を踏まない。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given v1.0 ビルド, When ネットワーク監視, Then 外部通信 0 件・広告 / 計測 SDK 非同梱である（[NFR-012](./non_functional_requirements.md#nfr-012)）。
  - [ ] Given ゲームロジック, When プラットフォーム機能の呼び出し, Then 全アクセスが AdInterface / AnalyticsInterface / HapticsInterface / StorageInterface 経由で、プラットフォーム API の直接呼び出しは 0 件。
  - [ ] Given v1.0 の Noop 実装, When レベル開始 / 終了・コイン獲得 / 消費, Then level_start / level_end / earn_virtual_currency / spend_virtual_currency が GA4 ゲーム推奨イベント名の規約どおり発行される（送信はされない）。
  - [ ] Given RV ボタンその他の広告 UI 導線, When v1.0, Then フラグで非表示化されており、フラグ切替のみで表示に転換できる実装が済んでいる。
- **備考 / Notes**: Poki / CrazyGames SDK も AdInterface の別実装として設計（[research/07_decision.md](../research/07_decision.md) §6.1・§6.3・§9 リスク9）。広告プレースメント定数は TuningConstants に定義。

---

### Epic G: 作る・守る / Author & Guard

> 💡 FR カテゴリ G（オーサリング・品質ゲート）に対応。「全面に解がある」「直線1本で全クリできない」をコードで保証する。

| US ID | タイトル | ソースFR | 優先度 | SP |
| --- | --- | --- | --- | --- |
| [US-022](#us-022) | 作った面に必ず解があることを保証する | [FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026) | Must | 8 |
| [US-023](#us-023) | 実行中に手触りを追い込む | [FR-025](./functional_requirements.md#fr-025) | Must | 3 |
| [US-024](#us-024) | 直線1本の支配戦略を CI で否定する | [FR-026](./functional_requirements.md#fr-026) | Must | 5 |

<a id="us-022"></a>

#### US-022: 作った面に必ず解があることを保証する — Must (8 SP)

**ソースFR:** [FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026)

- **ストーリー / Story**: As a **Level Author**, I want インゲームエディタで面を作り、テストプレイで解いた証拠（ゴースト解）ごと保存したい, so that 「解けない面」がプレイヤーに届く事故を構造的にゼロにできる。
- **ストーリーポイント / Story Points**: 8
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 開発ビルドのエディタ（[SC-009](./functional_requirements.md#sc-009)）, When 編集, Then 地形ポリライン頂点の追加・移動・削除、車スポーン・ゴール旗矩形・コイン・ギミックの配置、インク予算・星閾値（star2 / star3）・ギミックタグの設定、JSON エクスポート / インポートができる。
  - [ ] Given テストプレイ未成功のレベル, When 保存操作, Then 保存ボタンが非活性で「テストプレイで解を記録してください」と表示され、保存できない（解のないレベル JSON はスキーマ上存在できない）。
  - [ ] Given テストプレイ成功, When 保存, Then ゴースト解（描線ポリライン + 走行結果）がレベル JSON へ添付される。
  - [ ] Given PR の作成・更新, When CI 実行, Then 同梱全レベル（15 面 + ボーナス 3 面）が Gate 0（スキーマ検証）/ Gate 1（静的妥当性: 旗到達可能な配置 + インク予算 > 0）/ Gate 2（ヘッドレスエンジンでのゴースト解リプレイ: 成功一致 + 最終車両位置 ε = 0.05m + tick ±30）を 100% 通過しなければマージがブロックされる（[KPI-004](./README.md#kpi-004)）。
- **備考 / Notes**: インベントリ指定の必須ストーリー。エディタはインゲーム同梱に限定投資し専用外部ツールは作らない。リリースビルドからビルドフラグで完全除外（[research/07_decision.md](../research/07_decision.md) §3.3・§8.1）。

<a id="us-023"></a>

#### US-023: 実行中に手触りを追い込む — Must (3 SP)

**ソースFR:** [FR-025](./functional_requirements.md#fr-025)

- **ストーリー / Story**: As a **Level Author**（開発者）, I want 物理・カメラ・juice の全パラメータをゲームを止めずにスライダで動かしたい, so that ばね鎖チューニング沼（硬いと崩落が地味 / 柔らかいと暴れる）を実機の手触りで最短脱出できる。
- **ストーリーポイント / Story Points**: 3
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given 開発ビルドのデバッグパネル（[SC-010](./functional_requirements.md#sc-010)）, When スライダ操作, Then 物理（hertz / dampingRatio / breakForce / breakTorque / 摩擦 / モーター速度・トルク）・カメラ（lerp 係数 / look-ahead 距離 / trauma 加算量）・juice（hit-stop 長 / スロー倍率 / confetti 数）が実行中に変更され、TuningConstants を単一ソースとする全システムへ即時反映される。
  - [ ] Given パネル表示中, When プレイ, Then fps / 物理 step 時間（p95 判定用）/ ボディ数が常時表示される（[KPI-001](./README.md#kpi-001) の計測手段）。
  - [ ] Given パネルを閉じた状態, When セッション継続, Then 変更値は保持され、再度開いて追い込みを継続できる。
  - [ ] Given リリースビルド, When 起動, Then パネルのコードがビルドから除外され表示手段が存在しない。
- **備考 / Notes**: リスク3（チューニング沼）への一次対策（[research/07_decision.md](../research/07_decision.md) §7.3・§9 リスク3）。マジックナンバー散在禁止は [NFR-010](./non_functional_requirements.md#nfr-010)（grep で検証可能）。

<a id="us-024"></a>

#### US-024: 直線1本の支配戦略を CI で否定する — Must (5 SP)

**ソースFR:** [FR-026](./functional_requirements.md#fr-026)

- **ストーリー / Story**: As a **System**（検証パイプライン）, I want anti-dominant タグ付きの面で「直線を1本描くだけの解法」が必ず失敗することを PR 毎に自動証明したい, so that 競合最大のゲーム性不満「直線1本で全クリできる平坦さ」が本作に混入しないことをコードで保証できる。
- **ストーリーポイント / Story Points**: 5
- **受け入れ基準 / Acceptance Criteria**:
  - [ ] Given anti-dominant タグ付きレベル, When 直線1本ボット（Straight-line Bot: スポーンから旗へ直線を 1 本描く解法）をヘッドレスエンジンで実行, Then 必ず失敗する（Gate 3、[KPI-004](./README.md#kpi-004)）。
  - [ ] Given Gate 3 に不合格のレベルを含む PR, When CI（GitHub Actions・固定 Node）, Then fail してマージがブロックされる。CI 内では同一入力→終了状態ハッシュ一致（ビット一致）で回帰を検出する（[NFR-004](./non_functional_requirements.md#nfr-004)）。
  - [ ] Given ローカル環境, When CLI 実行, Then CI と同一 Node バージョンで同一パイプライン（Gate 0, Gate 1, Gate 2, Gate 3）をレベル作成中に事前検証できる。
  - [ ] Given エンジン更新で Gate 2 許容帯（ε = 0.05m / tick ±30）超えの差分, When 対応, Then 感度分析による許容帯の再校正またはゴースト解の再収録を行う（無検討の閾値緩和 0 件）。
- **備考 / Notes**: ゲームデザイン意図のテスト契約化（[research/07_decision.md](../research/07_decision.md) §3.3）。支配戦略の無効化は経済（G2）×幾何（G1, G3）×動力学（G5, G6, G7）の重ね掛け（Ch1 は G2 中心）。

---

<details><summary>INVEST原則</summary>
I - Independent（独立している）/ N - Negotiable（交渉可能）/ V - Valuable（価値がある）/ E - Estimable（見積もり可能）/ S - Small（小さい）/ T - Testable（テスト可能）
</details>

---

[← 非機能要件](./non_functional_requirements.md) | [📋 目次](./README.md) | [UL →](./ubiquitous_language.md)

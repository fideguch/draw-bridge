# ローカル既存事例調査 — StadiumRush / BloomLogic(Glowgrid)（2026-07-07）

> 対象: 同一開発者による既存ハイパーカジュアルゲーム2作のローカルコードベース精読。
> 目的: 新プロジェクト **Draw Bridge系（iOS + Android 両対応）** の開発プロセス・品質基準・ドキュメント構造の設計材料。
> 注意: 既存2作は「参考」であり品質基準ではない。新作はこれらより高い商用レベルを目指す。
> 確度表記: **高**=ファイル/コミットで直接確認した事実 / **中**=状況証拠からの推定 / **低**=推測。

- 対象1: `/Users/fumito_ideguchi/Desktop/start/work/tenhoh/casual-games/traffic`（**Stadium Rush!**）
- 対象2: `/Users/fumito_ideguchi/Desktop/start/work/tenhoh/puzzle`（**Bloom Logic** → リリース名 **Glowgrid**）

---

## 0. エグゼクティブサマリー

| | Stadium Rush! | Bloom Logic / Glowgrid |
|---|---|---|
| ジャンル | Crowd Management Puzzle（人流最適化・ハイブリッドカジュアル志向） | Nonogram / Picture Logic（お絵かきロジック） |
| コア | 決定論的容量ネットワーク流量エンジン + 「圧力解放（Pressure & Release）」 | 決定論ノノグラム + LineSolver 一意解保証 + 開花演出 |
| 状態 | MVP完成（CS6.1まで、2026-06-11〜12の実質2日）。**未リリースと推定（中）** | **App Store v1.0 提出済（高）**。バンドルID `com.medicavice.glowgrid` |
| 技術 | iOS 17+ / Swift 6 / SwiftUI + SpriteKit / xcodegen / 外部依存ゼロ | 同左 + バンドルOFLフォント（Fredoka/Nunito）+ 完全カスタムUIキット |
| ツール | research/ + designs/ + **.gatekeeper**（HG1〜HG5全PASS） | research/ + designs/ + **.specify（spec-kit）** + **.evals（specs-evals）** + GitHub Actions eval gate |
| 収益化 | MVPは無し。v1.2で広告SDK計画（fail広告クリエイティブ前提） | MVPは無し（Data Not Collected 維持）。将来用に IAA ガイド文書を整備 |
| 最大の学び | PM実機フィードバック3周で「忙しいがつまらない」を理論(Sid Meier/juice)で診断→コア再設計 | requirements_designer → speckit-bridge → specs-evals の**フルパイプラインが1本通った実績** |

---

## (a) それぞれどんなゲームか

### a-1. Stadium Rush!（traffic）

**確度: 高**（`README.md`, `designs/game_design.md`, `research/03_decision.md`）

- **一言**: 試合終了後のスタジアムから観客全員（最終レベルは70,000人）を**事故ゼロ**で帰宅させる人流最適化パズル。
- **コア体験**: 「ボトルネック発見 → 一手で流れが変わる → 群衆が掃けていく快感」。人数カウンタが 69,000 → 0 へ滑り落ちる。
- **コアメカニクス（イテレーション3以降の最終形）**:
  - 操作は**ゲート開閉タップのみ**（当初あったバス発車・電車はPMフィードバックで全撤去）。
  - **Pressure & Release**: 「ゲートを閉じて溜め、いいタイミングで開けて一気に流す」1行ルール。閉→開遷移から `surgeWindow` 秒間 throughput×`surgeMultiplier` の**開放サージ**。
  - 閉じる理由 = **共有下流の排他制御**（全ゲートが共有資源を奪い合う配置。「競合のないゲートは置かない」をグラフ検証テストで強制）。
  - 失敗 = STAMPEDE（コンコース密度100%超×3秒連続）。**原因バナー必須**（「北コンコースに東スタンドと南スタンドの流れが合流しました」）。
  - スコア層: RUSHボーナス（解放人数比例）/ コンボ乗数（〜×2.0）/ PERFECT RUSH（圧力満タン±1秒開放）。エンジン非変更でViewModel側に実装。
- **メタ進行**: コインで買う4種アップグレード（ゲート拡幅・サージ強化・通路拡張・出口整備、各3段階）。効果は流量パラメータへの実乗算＝**ダミー禁止**（L8が未強化では★3困難になるようレベル設計で体感価値を保証）。★1〜3評価 + parTime。
- **レベル**: JSON 10本（ノード・エッジ・座標・parTime・**想定操作列 expectedOps を併記**）。「1レベル=1学習」カリキュラム（L2=開けすぎると合流で死ぬ、L3=駅はパンクする…）。
- **収益化計画**: MVPは広告・課金なし。ロードマップ v1.2 で「毎レベル後インタースティシャル + 失敗時リワード復活」（リサーチでトップ100レベル型27本中24本が採用と検証済みの構成）+ **STAMPEDE fail のプレイアブル広告**（fail広告でCPI約55〜60%削減のMondayOFF実証をリサーチで確認）。
- **世界観の制約**: 実在スタジアム名・都市名・チーム名・「FIFA」「World Cup」文言は**使用禁止**（商標・審査リスク。grep検証をACに含む）。

### a-2. Bloom Logic / Glowgrid（puzzle）

**確度: 高**（`README.md`, `BloomLogic/README.md`, `designs/`, `BloomLogic/DESIGN.md`, `brand/`）

- **一言**: 行・列の数字ヒントから論理演繹でマスを塗り、最後の1マスで隠されたピクセルアートが「光って現れる」ノノグラムパズル。**運要素ゼロ・推測不要**をテストで保証。
- **コア体験**: 「静 → 演繹 → 開花」。1マスの確定が連鎖して盤面が雪崩のように埋まり、最後に絵が開花（Bloom Reveal / Glow演出）。
- **コアメカニクス**:
  - タップで塗り／×（Mark）／クリア。Fill/Markモードトグル。同一行/列限定のドラッグ塗り。
  - **一意解保証**: 決定論ソルバー `LineSolver` が「推測なしで全マス確定できる」盤面のみ同梱（オーサリングゲート）。全30レベルの一意可解＋★3可解を EngineTests で自動検証。
  - 失敗系: ライフ制（5×5=5 / 10×10=4 / 15×15=3）。誤塗りは即赤ハイライト＝敗因が常に自分の推論ミスとして帰属可能。
  - ヒント = 「1ライン確定」型（LineSolverが行→列・昇順の固定規則で次の確定ラインを選ぶ＝決定的）。回数制限付き。
- **メタ進行**: **庭（Garden）コレクション** — クリアした絵がギャラリーに永続表示、未収集はシルエットで「あとN枚」を可視化。3パック（Sprouts 5×5 / Blossoms 10×10 / Garden 15×15）×各10 = 30レベル。★/タイム記録。パック内順次アンロック。
- **収益化計画**: **v1.0は完全無収益・完全オフライン**（広告/IAP/解析/通信ゼロ → App Privacy「Data Not Collected」申告）。`brand/MONETIZATION.md` に2025-26年のIAA体系（メディエーション3強寡占、waterfall→in-app bidding移行、eCPM相場、ATT/SKAdNetwork/UMP/PrivacyInfo.xcprivacy要件、ARPDAU式）を将来用に整備済み。推奨構成は「リワード動画主役 + 控えめインタースティシャル + 広告除去IAP」。
- **リブランド**: designs/ 時点の落ち着いた「Bloom Logic」ビジュアルを、リリース前に **"Candy Pop Arcade"（明るいレトロアーケード、ホットピンク #FF4C8B）** の **Glowgrid** に全面リスキン（2026-06-29、`DESIGN.md`）。内部型名・スキーム名は `BloomLogic` のまま、ユーザー可視要素のみ変更。
- **ストア資産**: `brand/` にアイコン・ワードマーク・スクショ・store-metadata・PRIVACY.md・**RELEASE.md（TestFlight→App Store提出の手順書）** まで揃っている。

---

## (b) 技術スタック

**確度: 高**（`project.yml`, ソースコード, README）

### 共通（両作で統一）

| 項目 | 内容 |
|---|---|
| 言語 | **Swift 6**（`SWIFT_STRICT_CONCURRENCY: complete`、警告=エラー扱い） |
| UI | **SwiftUI**（画面・HUD）+ **SpriteKit**（盤面描画・演出） |
| 対応OS | iOS 17+ / iPhone縦持ち固定 |
| プロジェクト生成 | **xcodegen**（`project.yml` が single source of truth。`.xcodeproj` は生成物） |
| 外部依存 | **ゼロ**（SPM/CocoaPodsパッケージなし。広告SDKもMVPなし） |
| オーディオ | **AVAudioEngine プログラム合成SE**（外部音源ファイルなし＝ライセンス回避） |
| レイヤ構造 | `Engine`（純粋・**Foundationのみ import**）/ `Meta`（永続化）/ `ViewModel`（@MainActor）/ `Render`（SpriteKit描画専用）/ `UI`（SwiftUI + DesignTokens.swift）/ `Audio` |
| チューニング値 | **`TuningConstants.swift` + レベルJSONに全集約**（マジックナンバー散在禁止） |
| レベル | JSONデータ（コードとデータ分離、量産前提） |
| 決定論 | **同一レベル+同一操作列 → 必ず同一結果**をユニットテストで保証（両作の憲法級ルール） |

### Stadium Rush! 固有

- `GameLoop/GameClock`: 固定タイムステップ（0.1秒tick）のアキュムレータ時計。ポーズ=tick供給停止。
- `Engine/Simulation/FlowEngine.swift`（295行）: 「fixed dt, fixed phase order, ascending-id traversal, Double-only math」で決定論を保証（ソースコメントに明記）。表示専用の `lastTickEdgeFlow` はフェーズ入力にならないことをテストで証明。
- Render: 共有1テクスチャ+ノードプールで**7万ドット60fps**（L10）。
- **テスト**: EngineTests 83件+（決定論トレース一致 / 人数保存則 誤差<0.001 / 全10レベル想定操作列クリア / STAMPEDE発火精度 / L2・L3・L8の学習契約 / アンチ観戦契約 / 操作密度バンド）+ UITests 7件（**L1を実タップでクリア** / L10 FPS / 各画面キャプチャ）。`build/` に xcresult 群（検証証跡）が残存。
- Swiftファイル数: Sources 41。1ファイル最大でも GameViewModel 454行（800行制限内）。

### Glowgrid 固有

- フォント: **Fredoka + Nunito をバンドル**（SIL OFL）。システムフォント不使用。
- **完全カスタムUIキット**（`Sources/UI/Kit/` 9コンポーネント: GardenButton/Card/Toggle/ProgressBar/TopBar/Dialog/Icon/Background/Haptics）。**iOSネイティブwidget禁止**（NavigationStack, List, Toggle, ProgressView, confirmationDialog, .sheet, SF Symbols すべて不使用 — 回帰ゲートG5でgrep検証）。
- Engine: `Model/`（CellState, Solution, LineClue, LevelDefinition…）+ `Simulation/`（ClueGenerator, LineSolver, NonogramGame, ScoreEvaluator）。Swiftファイル数 43。
- **テスト**: EngineTests 36〜37件 + UITests 3〜8件（時期により増減。L1実タップクリア / スワイプ / チュートリアル / ナビゲーション / スクショ）。
- **回帰ゲート** `.evals/runner/run-gate.sh`（G1: EngineTests全通過 / G2: L1実タップクリア / G3: "picross" grep 0件 / G4: レベル数≥30 / G5: iOSネイティブwidget 0件）— **GitHub Actions（macos-15ランナー）でPR毎に実行**。
- ビルドは `CODE_SIGNING_ALLOWED=NO` オプション付きコマンドラインを標準化。開発用起動引数（`-uitest-mute` / `-uitest-reset` / `-uitest-jump <levelID>`）を両作で共通運用。

---

## (c) 開発パイプラインの実際の流れ

**確度: 高**（git log、各ディレクトリの実在ファイルで確認）

### c-1. 共通フロー（実際に回った順序）

```
research/
  00_raw_*.md（生ログ/ディープ分析）
  01_market_research.md（並列Web調査 + 敵対的検証 ✅/❌/⚠️ 判定）
  02_game_ideas.md（案N本 × 3審査員 × 5軸×10点 = 150点満点採点）
  03_decision.md（採用決定 + リスク→設計判断の対応表 + 感情設計）
      ↓
designs/（requirements_designer 出力。品質スコア≥70ゲート）
      ↓
（puzzleのみ）/speckit-bridge → specs/001-*/spec.md + .specify/memory/constitution.md + conventions.md
      ↓
実装（forge_ace + gatekeeper + claude-to-codex クロスレビュー）
      ↓
（puzzleのみ）specs-evals → .evals/ 回帰ゲート + GitHub Actions CI
      ↓
PM実機プレイ → designs/iterationN_feedback.md → 再実装（trafficはCS1〜CS6.1）
```

### c-2. research/ の質（両作共通の型）

- **01_market_research.md**: トピック並列調査（traffic=12トピック・194claims、puzzle=5観点）。**重要数値は別エージェントが別ソースで裏取り（敵対的検証）**し、✅confirmed / ❌refuted（訂正込み）/ ⚠️unverifiable を明記。全事実に出典URL+データ時点+確度。
- **02_game_ideas.md**: traffic=18案、puzzle=9案。**3審査員（UX中毒性 / 市場トレンド / ソロ開発TD）× 5軸（トレンド/バズ/実装容易/継続/ASO）× 各10点**。
- **03_decision.md**: 最高得点案を機械的に採らず、**PMの意図（コア体験）を優先しつつ、審査で出た減点理由を「実装戦略で潰せるリスク」として設計判断に変換する対応表**が核。次工程への接続（designs/ 生成 → ゲート → 実装）を末尾に明記。
- trafficはさらに **04_fun_gap_research.md**（PMフィードバック起点の追加リサーチ。後述）。

### c-3. gatekeeper の使われ方（traffic）

`.gatekeeper/history/2026-06-11T14-12-23.566Z.json`（mode: "paired", version 1.2.1）に全ゲートの証跡が残る:

| Gate | 内容 | 証跡（実記録） |
|---|---|---|
| HG-1 | 仕様の事前読了 | research 3本 + designs/ の read-before-code |
| HG-1.5 | **UXプロトコル**（全画面の SCREEN/USER GOAL/FIRST ACTION/HAPPY PATH/ERROR PATH/EDGE CASES をコード前に完成） | `designs/ux_protocol.md` 全6画面 |
| HG-2 | パターン/トークン遵守 | Guardian の grep 検査、Designer 25項目QA（DesignTokens 16/16 一致） |
| HG-3 | 推測修正禁止（facts-first） | バグはスクショ証跡で診断してから修正 |
| HG-4 | 仮説固執防止 | 2回超の仮説試行なし |
| HG-5 | **実機検証**（own-eyes） | クリーンビルド+全テスト、スクショをReadで自分の目で確認、**L1実タップクリアを4回独立実行** |

- 最終ステータス `VERIFIED`。**「テストが通った」ではなく「スクショを自分の目で見た・実タップでクリアした」を証跡として記録する運用**が特徴。
- puzzle には `.gatekeeper/` ディレクトリが無い（**確度: 高**）が、`designs/ux_protocol.md` は「gatekeeper HG-1.5」準拠で作成され、constitution にも gatekeeper 検証が工程として明記されている（状態ファイルの永続化はしていないと推定。**確度: 中**）。

### c-4. spec-kit / specs-evals の使われ方（puzzle）

- `.specify/`: spec-kit v0.4.3 を `here: true, offline: true` で導入。`memory/constitution.md`（**v2.1、5原則すべて NON-NEGOTIABLE**: ①品質ゲート≥70+TDD ②決定論 ③スコープ規律（MVPに広告/IAP/通信コード禁止）④商標（"picross" grep=0をビルド失敗条件に）⑤アーキテクチャ（Engine は Foundation のみ、モジュール境界表つき））+ `memory/conventions.md`（ディレクトリ構造・UL用語のSwift命名対応表・永続化規約。「手動編集禁止、変更は /speckit-bridge 再実行」）。
- `.claude/commands/speckit.*.md` 9コマンド（specify/plan/tasks/implement/analyze/clarify/checklist/constitution/taskstoissues）を配置。
- `specs/001-bloom-logic/spec.md`（344行）: designs/ から変換されたユーザーストーリー（P1/P2優先度、Why this priority、Independent Test、Given-When-Then受け入れシナリオ）+ `checklists/requirements.md`（CHK001〜: 完全性・実装詳細リーク禁止・テスト可能性・SC測定可能性・NEEDS CLARIFICATIONゲートを個別検証）。
- `.evals/`（specs-evals Track A）: `config.json`（judge=claude-opus-4-8, 回帰しきい値, learnings上限50）+ **決定論グレーダーのみの回帰ゲート**（LLMジャッジ不要の最安構成）+ `feedback/learnings.md`（Reflexion式・確認済み失敗からの教訓を CLAUDE.md 経由で将来セッションに注入する設計）+ `error-analysis/TEMPLATE.md`。
- **CI**: `.github/workflows/eval.yml` が `BloomLogic/**` 変更のpush/PRで run-gate.sh を実行。

### c-5. 実装の刻み方（traffic の git 履歴が示す実態）

```
c4fb5e2 docs: market research, idea evaluation, and MVP requirements   ← research+designs
6223b0d docs: resolve 7 Plan Quality Gate open questions               ← planner が検出した仕様曖昧点を「仕様決定」として文書化
94d2fd8 feat: deterministic crowd-flow engine, 10 levels, upgrade meta ← CS1（エンジン+テストから）
0c74304 feat: playable game UI, render layer, audio                    ← CS2/2.1/2.2
065eeec fix: codex cross-review remediations                           ← CS3（claude-to-codex クロスモデルレビュー是正）
5cc60a8 feat: dynamic crowd-flow visualization, tempo retune           ← CS4 = iteration1_feedback 対応
d6de91c feat: anti-spectator gameplay — waves, sink rhythm, rain       ← CS5 = iteration2_feedback 対応
4dd7b01 feat: Pressure & Release core — gates-only, surge, RUSH        ← CS6 = iteration3_redesign 対応
b19191a fix: make on-screen numbers exactly causal                     ← CS6.1
```

- 特筆: **「Plan Quality Gate の OPEN QUESTIONS を推測でなく仕様決定として解消してから実装」**（6223b0d、`game_design.md` §7に7項目残存）。
- puzzle は squash 済みで2コミットのみ（scaffold → App Store 1.0 submission）。開発期間は traffic ≈2日（6/11-12）、puzzle ≈12日（6/24〜7/6、リスキン・ストア提出含む）（**確度: 高**、git日付とファイル日付）。

---

## (d) iteration feedback から得られた学び（ゲームフィール・爽快感・UI/UX）

**確度: 高**（`designs/iteration1_feedback.md` / `iteration2_feedback.md` / `iteration3_redesign.md` / `research/04_fun_gap_research.md`。すべて traffic。puzzle にはイテレーション文書なし——代わりにリリース前の全面リスキンが1回）

### d-1. イテレーション1（PM実機一次FB）: 「動いている感」が無いと死ぬ

- **P0: 人流の動的可視化がゲーム性の根幹**。「どれぐらいパンパンかの動的な動きが見えない」→ エッジ上をドットが実流量に比例して移動するコンベア表現 / ノード内部にドットが詰まっていく充填表現 / 占有率バー / 待機列の長さ可視化。受け入れ基準が秀逸: **「スクショ2枚を並べたとき、色を見ずともどこが混んでいるか分かる」**。
- **P1: テンポ**。「序盤はサクサククリアさせてルール理解に集中」→ レベル別クリア時間ターゲットを数値契約化（**L1≤25秒、L2-3≤40秒、L8-10でも90〜150秒**）し、**想定操作列の実測クリア時間をテストが出力して検証**。
- **P2: 世界観ドレッシングは「仮でいいからそれっぽく」**（ピッチ描画・座席ストライプ・「試合終了!」導入バナー1.2秒厳守/リトライ時省略）。
- 制約の型: 「決定論エンジンの挙動変更禁止・既存テスト全グリーン・60fps維持」をイテレーション要件に毎回明記。

### d-2. イテレーション2（二次FB）: 支配戦略の検出と「アンチ観戦」契約

- PM指摘「ゲートを開いて眺めているだけになる」→ 診断: **支配戦略 =「全ゲート開けて放置」が成立してしまっている**。新要素（電車）が意思決定を生んでいない。
- 対策を**テストで強制する契約**に変換したのが最大の発明:
  - **アンチ観戦契約**: L3以降「t=0全開放+以後無操作」ではクリア不能であることを全レベル自動証明（`testStaticOpenAllDoesNotClear`）。
  - **操作密度契約**: 想定操作列が平均≥6 ops/分、最大無操作間隔≤15秒であることを構造的にassert。
  - **ウェーブ放出**（burstPeriod/Duty/Multiplier、位相固定=決定論維持、省略時後方互換）で「移り変わるボトルネック」を作る。
  - 中盤イベント（雨の途中開始 `startTime`）で動的な再判断を強制。

### d-3. イテレーション3（三次FB）: 「忙しいがつまらない」の理論的解体 → コア再設計

PM指摘「**忙しいがつまらない。爽快感がない。電車バスは要らない。シンプルさが足りず奥深さがない。閉じる理由が必要**」。ここで**追加リサーチ（research/04、5領域の比較調査+裏取り）を挟んでから**再設計した点が重要。

| PM指摘 | リサーチによる診断 | 採った対策 |
|---|---|---|
| 忙しいがつまらない | Sid Meier「単純すぎる決定の高頻度連打」。CS5は操作**頻度**をKPIにしたが**見返り**と**トレードオフ**を作らなかった | 操作密度契約を「6〜40 ops/分」の**上下バンド**に置換（眺めゲーも連打ゲーも構造的に禁止） |
| 電車バスが無意味 | 外部タイマーが課す**強制手（forced moves）**は決定ではなく作業 | 電車バスを全レベルから撤去（エンジンコードは互換残置） |
| 閉じる理由がない | **競合のないゲートは無価値**（Mini Motorwaysの信号の反例）。成功作は全て排他制御構造 | 全ゲートを「2つ以上の流れが奪い合う共有資源」を守る位置に。**グラフ検証テストで「競合のないゲート禁止」を強制** |
| 爽快感がない | **溜めの可視化（anticipation）が無いと解放は報酬にならない**（Pull the Pin / Sand Balls / Peggle Extreme Fever） | 圧力リングゲージ・ゲート前の密集演出→開放サージ→RUSH!ポップ+コンボ+PERFECT。**閉じる=報酬の前借り**という損得構造化 |

**爽快感の実装仕様（普遍的に流用可能・確度: 高）**:
- **Juice原則**: 1タップに応答カスケード（squash&stretch ×1.35→×0.85→×1.0 を100ms以内 + 噴出リング + 粒子 + スコアポップ + 触覚 + 合成SE）。「タップしたのに画面上何も変わらない瞬間をゼロに」。
- **応答100ms予算**（Swink『Game Feel』）を性能要件化（タップ→視覚/触覚反応）。
- **ヒットストップ+シェイク**は大イベント限定（≥500人解放で0.15秒停止。通常プレイでのシェイク禁止）。
- **パンク予告**: 密度>100%ノードに3秒収縮カウントダウンリング（「2〜3秒先の危機を予見して先回りする」を可能にする可視の危機）。
- **音**: 全SE合成。噴出whoosh+ポップコーン流・RUSH成立チャイム（C6）・PERFECTスティング（G5-B5-E6）・コンボごとのピッチ上昇。
- **意図的にMVP外へ送った演出**（ラグドール転倒・操作音の音階化・排他ペアゲート連動）も根拠付きで記録 → やらないことにも出典がある。

### d-4. puzzle 側の該当知見

- イテレーション文書は無いが、**リリース直前に UI を全面リスキン**（calm な Bloom Logic → 明るくパンチのある Candy Pop Arcade / Glowgrid）した事実自体が学び: **designs/ の初期ビジュアル方針は出荷時に大きく変わり得る。ただし DESIGN.md §8「Test contract」に UITest が依存する accessibilityID/文言を明記してリスキンの回帰を防いだ**（`cell-<r>-<c>`, `modeToggle`, "Glowgrid" staticText 等）。
- README曰く誤塗り時「自動で×に補正」— 設計時の「ライフ減のみ」から利便性方向へ調整（**確度: 中**、README記述より）。

---

## (e) designs/ の各ドキュメントのフォーマット（新プロジェクトが踏襲すべき構造）

**確度: 高**（全ファイル読了）。**puzzle 版が新しい成熟テンプレート**であり、traffic 版はその前身。新プロジェクトは puzzle 版の構造を基準にすべき。

### e-1. ファイル構成（puzzle = requirements_designer Full モード出力）

| ファイル | 役割 | 構造の要点 |
|---|---|---|
| `workflow_config.md` | Phase 0 設定 | 実行モード（Full）、Phase 0〜5 の完了状態テーブル、品質次元（5×20pt=100、合格70）、Phase 5（Figma生成）の延期判断と再開手順、ID規約 |
| `README.md` | INDEX + プロジェクト憲章 | ドキュメント一覧表 / プロダクト概要 / 目的と背景 / **KPIテーブル（ID・目標値・測定方法・根拠リンク）** / **アクター表**（Player / Level Author / System）+ 課題ゴール / **In Scope・Out of Scope・Rejected Scope（却下理由+Phase付き）** / 制約条件（番号付き）/ 次のステップ |
| `game_design.md` | ゲームデザイン仕様 | §1 コア体験（**感情ループを疑似コードブロックで記述**・失敗ループも）/ §2 コアエンジンモデル（データモデル表・判定式）/ §3 操作表（**フィードバック応答時間付き**）/ §4 レベル・カリキュラム表（1レベル1学習）/ §5 チューニング初期値表 / §6 メタゲーム / §7 ジュース演出 / §8 **決定論ルール（不変条約）** / §9 MVP非対象 |
| `functional_requirements.md` | 機能要件 | **画面一覧（SC-00x）テーブル**→ 要件サマリーマトリクス → FR-00x 各項目が**10フィールド固定**（説明/アクター/事前条件/トリガー/主フロー/代替フロー/例外フロー/事後条件/ビジネスルール/備考）+ **AC は Given-When-Then チェックボックス** |
| `non_functional_requirements.md` | 非機能要件 | サマリーテーブル → NFR-00x（説明/指標/目標値/**測定方法**/優先度）。性能・決定論・プライバシー・互換性・a11y・保守性・オフライン・コンプライアンス・データ・起動の10カテゴリ |
| `user_stories.md` | US | ストーリーマップ（Epic×優先度）→ US-00x（As a / I want / so that + GWT受け入れ基準 + **ストーリーポイント** + ソースFRリンク） |
| `ubiquitous_language.md` | UL | UL-00x 用語表（用語 / **UIラベル(EN)** / 定義 / ソースFR / 画面SC / **コード命名**）+ **アンチパターン表**（Avoid→Use Instead+理由。商標回避を含む）+ 命名規則（言語別規約） |
| `ux_protocol.md` | UXプロトコル（gatekeeper HG-1.5） | 画面ごとに固定ブロック: `SCREEN / USER GOAL / FIRST ACTION / HAPPY PATH / ERROR PATH / (UNDO/CONTROL) / EDGE CASES / TRUST(P1-P7)`。**コード記述前に全画面分完成必須（HARD-GATE）** |
| `ui_design_brief.md` | UIブリーフ | Platform戦略 / ブランド / **デザイントークン表（Light/Dark両HEX）** / タイポグラフィ表 / Design Style / **Trust Design Principles（P1〜P7の適用可否表）** / アクセシビリティ（WCAG AA目標値）/ 画面インベントリ / **ASCIIアートの画面レイアウト** / サウンド方針 |

### e-2. 横断的な規約（両作で一貫。踏襲価値が高い）

1. **全IDはアンカーリンク化**: `FR-001`〜, `NFR-001`〜, `US-001`〜, `SC-001`〜, `UL-001`〜, `KPI-001`〜（3桁ゼロ埋め）。FR↔NFR↔US↔SC↔UL↔KPI が相互リンクされ、**トレーサビリティが機械的に検証可能**（speckit-bridge のチェックリストがこれを利用）。
2. **「推測による仕様確定は禁止。各仕様に research/ の検証済み事実への参照を付す」**を README 冒頭に宣言し、実際にほぼ全節が `research/0X` へのリンクを持つ。
3. **受け入れ基準は必ずテスト可能な形**（GWT または grep/計測可能な数値）。「学習契約」（L2は全開だと失敗する等）のような**ゲームデザイン上の意図すらテスト契約として書く**。
4. **各ドキュメントの先頭にナビゲーションバー**（`[📋 目次] | [設定] | [機能要件] | …`）。
5. Rejected Scope（却下スコープ）に**却下理由と復活Phase**を残す。
6. traffic で後から増えた `iterationN_feedback.md` は「**出典（PM実機FB）→ P0/P1/P2優先度 → FR-In 形式の要件 → 数値の受け入れ基準 → 変えないことの制約**」という追補フォーマット。designs/ を生きた文書として運用する好例。

---

## (f) 新プロジェクト（Draw Bridge系、iOS + Android）への示唆

### f-1. 技術は原則流用不可 — ただし「アーキテクチャ原則」は移植可能

- **事実（高）**: 両作は Swift 6 / SwiftUI + SpriteKit / xcodegen / AVAudioEngine の **iOSネイティブ専用**構成。Androidでは1行も動かない。UIキット（Glowgridの custom kit）もSwiftUI依存。
- **分析（中）**: iOS+Android 両対応では Unity / Godot / Flutter(Flame) / KMP+Compose 等のクロスプラットフォームエンジン選定が別途必要（本レポートの範囲外、別調査で決定すべき）。その際も**移植可能な原則**は:
  1. **純粋エンジンの分離**（Engine はレンダラ/OS非依存・テスト可能な決定論コア。FlowEngine / NonogramGame の設計思想はそのまま C# / GDScript / Kotlin に移せる）。
  2. **レベル=データ（JSON）+ 想定操作列（expectedOps）併記 → 全レベル解可能性の自動テスト**。
  3. **TuningConstants への数値集約**。
  4. **Render/Audio はエンジン出力の観測者**（書き戻し禁止）。
- **注意（分析・中〜低確度）**: Draw Bridge 系は物理シミュレーション（描いた橋の剛体/車両物理）が核になる可能性が高く、**既存2作の「完全決定論・同一操作列→同一結果」契約は物理エンジン（可変浮動小数・プラットフォーム差）とは相性が悪い**。(a) 固定タイムステップ物理で単一プラットフォーム内の再現性のみ保証する、(b) 決定論契約を「解の存在保証（ゴースト解の録画再生でクリア可能性を検証）」に緩和する、等の再設計が必要。**「決定論をどこまで持ち込むか」は新作の最重要技術判断のひとつ**。

### f-2. プロセスはほぼ全面的に流用可能（そして実績が2回ある）

- `research（敵対的検証付き）→ 02_ideas（3審査員×5軸採点）→ 03_decision（リスク→設計判断表）→ requirements_designer designs/ → speckit-bridge specs/ + constitution → forge_ace + gatekeeper → specs-evals 回帰ゲート + CI` のフルチェーンは **puzzle で1周完走済み**。新作はこの puzzle 版フロー（+ traffic 版のイテレーションFBループ）を初期から採用すべき。
- **constitution.md の「NON-NEGOTIABLE 原則」パターン**（品質ゲート/決定論/スコープ規律/商標/アーキテクチャ境界）は新作でもそのまま雛形になる。Draw Bridge なら「物理再現性の定義」「インク/描画リソースの保存則」「橋描画の操作契約」等に置き換える。
- **決定論グレーダーだけの回帰ゲート（run-gate.sh + GitHub Actions）**は安価で強力。新作では両OSぶんのビルド/テストゲート（例: G1エンジン不変量 / G2実タップE2E / G3商標grep / G4コンテンツ数 / G5デザイン規約grep）を最初に設計する。

### f-3. ゲームフィール知見は Draw Bridge に直接写像できる

**確度: 中（分析）**。iteration1〜3 + research/04 の教訓は物理橋ゲームに素直に対応付く:

| 既存作の教訓 | Draw Bridge への写像 |
|---|---|
| 溜め→解放の非対称（閉じる=報酬の前借り） | 「描く（静・計画）→車両が渡る（動・審判）」の緊張と解放。渡り切る瞬間に juice を集中投下 |
| 支配戦略テスト（全開放置でクリア不能を自動証明） | 「太い一本橋で常に安定クリア」等の支配戦略をレベル毎に排除（インク予算・地形・動的荷重で） |
| 強制手の排除（外部タイマー作業の禁止） | 描画は常にトレードオフ（インク量 vs 強度 vs 形状）であるべき。1解しかない橋は作業 |
| 失敗の因果可読性（原因バナー） | 崩落時に**どの節点/部材が折れたかをハイライト+一言原因**（「中央の接合部に荷重集中」）。fail 自体が広告映えする画に |
| テンポ契約（L1≤25秒・10秒で最初の成功体験） | L1は「1本線を引くだけで渡れる」ほぼ失敗不可能設計 + クリア時間の数値契約テスト |
| 1レベル1学習カリキュラム | 三角構造→支点→動荷重→…をレベルJSONで段階導入 |
| 操作100ms応答・ヒットストップは大イベント限定 | 描画ストロークの即時反映、崩落/完走時のみスロー演出 |
| メタはダミー禁止（効果が体感できる実乗算） | インク上限+素材強化等は「未強化ではL8の★3が届かない」形でレベル側から価値を保証 |

### f-4. 「これらより上」を目指すために足りていないもの（新作の上積みポイント）

**確度: 高（両リポジトリに存在しないことを確認した事実）+ 分析**:

1. **収益化の実装ゼロ**: 両作とも広告SDK・IAP・解析が未実装（計画文書のみ）。新作が商用レベルを目指すなら、**MONETIZATION.md の知見（メディエーション選定・ATT/UMP/PrivacyInfo・リワード主役構成）を v1.0 スコープに引き上げる**判断が必要。Android側は Google Play の広告ポリシー・データセーフティフォームが追加要件。
2. **計測なし**: D1/D7リテンションもファネルも取れない（完全オフライン思想のため）。商用版では解析（+A/Bテスト基盤）が前提になる。KPI-003 が「UITestによるproxy」止まりだった点は明確な限界。
3. **LiveOps・リモート設定なし**: レベル追加・難易度調整は全てアプリ更新。
4. **リリース実績は1本・結果データなし**: Glowgrid は提出済みだが、審査結果・DL数・リテンションの実データはリポジトリに無い。**「このパイプラインが市場で勝てるか」は未検証**。
5. **iPad/横持ち/多言語は両作とも未対応**（縦持ちiPhone英語/日本語のみ）。
6. **StadiumRush は store 資産が無くリリース未達**（brand/ ディレクトリ自体が無い）。「MVP完成」と「出荷」の間の距離（アイコン・スクショ・メタデータ・提出Runbook）は Glowgrid の `brand/` 一式が埋めた — 新作は**この brand/store 工程を最初から計画に含める**（Glowgrid の RELEASE.md はほぼそのまま Runbook 雛形になる。Android は Play Console 版を新規作成）。

### f-5. すぐ流用できる具体的資産（コピー元パス）

| 資産 | パス | 用途 |
|---|---|---|
| designs/ テンプレ（成熟版） | `puzzle/designs/*.md` | requirements_designer 出力の期待フォーマット |
| constitution 雛形 | `puzzle/.specify/memory/constitution.md` | 新作の NON-NEGOTIABLE 原則定義 |
| conventions 雛形 | `puzzle/.specify/memory/conventions.md` | UL→コード命名の対応表方式 |
| 回帰ゲート | `puzzle/BloomLogic/.evals/runner/run-gate.sh` + `.github/workflows/eval.yml` | G1〜G5 型の決定論ゲート + CI |
| イテレーションFB様式 | `traffic/designs/iteration1〜3_*.md` | PM実機FB→数値契約付き要件への変換様式 |
| 爽快感リサーチ | `traffic/research/04_fun_gap_research.md` | juice/anticipation/interesting decisions の設計教訓集（出典付き） |
| IAA収益化ガイド | `puzzle/BloomLogic/brand/MONETIZATION.md` | 広告実装時の要件チェックリスト |
| ストア提出Runbook | `puzzle/BloomLogic/brand/store/RELEASE.md` | iOS提出手順（Android版は要新規） |
| デザインシステム様式 | `puzzle/BloomLogic/DESIGN.md` | トークン+コンポーネント+**テスト契約**を1枚に collocate する様式 |

---

## 未解決の疑問（別途確認推奨）

1. Glowgrid の App Store 審査結果・リリース後KPI（リポジトリに記録なし）。
2. StadiumRush を出荷しなかった理由（W杯2026時流を狙った設計だったが、6/12以降コミットなし）。
3. puzzle 開発時に gatekeeper / forge_ace の状態がどこにも永続化されていない理由（運用変更か、単に未コミットか）。
4. requirements_designer の現行バージョンのテンプレートが puzzle 版からさらに進化しているか（スキル側の更新確認）。
5. Draw Bridge のエンジン選定（Unity/Godot/Flutter/KMP…）と、物理決定論の扱い — 本レポートの範囲外、専用の技術調査が必要。

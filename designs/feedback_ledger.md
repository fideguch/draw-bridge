# フィードバック対応台帳（全ラウンド網羅）— round-7 リリース前

> 作成: 2026-07-09 / round-7 計画フェーズ / 設計者成果物（**実装なし**）
> 目的: ユーザー指示「過去のフィードバックを全部見直せ」に応え、**本プロジェクトで受けた全フィードバックを1件も落とさず**、各件の状態と証拠ポインタを台帳化する。
> 出典（再読済）: `git log`（全50コミットのメッセージ）/ `.evals/feedback/learnings.md` / `research/09〜12` 各 intro の「発端フィードバック/マンデート」/ `DESIGN.md §0` / `designs/level_design_v4.md §0` / `.fable/plan.md`（round-6）/ `.fable/criteria.json`（round-7）/ `.fable/archive/*-criteria.json`（round-4/5/6）。
> 状態記号: **解決済**（過去ラウンドで対応・出荷）/ **今回対応**（round-7 の本計画 v5 で対応）/ **積み残し**（設計判断で v1.1 以降に意図的に延期）。

---

## 0. サマリ（結論先出し）

- **総フィードバック件数: 24 件**（UI 5・モバイル品質 2・演出 2・ラベル 2・車 1・進行 1・空間 1・役割 1・v4欠陥 5・round-7 5）。
- **解決済 17 件 / 今回対応 6 件 / 積み残し 1 件**（P7 レビュー誘導＝ネットワークゼロ方針により v1.1 予定・設計判断による延期であって "落とし" ではない）。
- **落とし（未追跡・無視）0 件。** round-7 の5件はすべて本計画 v5（`designs/game_plan_v5.md`＋`designs/atlas-design-v5.html`）で対応する。
- **「車とゴールが近すぎ」は3回目の指摘。** 原因は過去ラウンドの**過補正**（下記 F2 の履歴参照）。round-7 で**計測基準＋CIゲート**により決着させる。

---

## 1. 全件台帳

### 1.1 UI クローム（DESIGN.md §0「ボタン配置やコンポーネント定義が荒い・チープな見た目」2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| UI-1 | ボタン寸法が画面ごとにバラバラ（280×64/132×48/200×52/160×56/220×56 混在） | **解決済** | `DESIGN.md §4`（L/M/S 3段固定）/ git `a995cb7` design-system impl |
| UI-2 | Secondary が白面フラットで「押せる塊」に見えない | **解決済** | `DESIGN.md §3.4`（チャンキー影規格）/ 原則8 |
| UI-3 | アイコン+ラベルの対提示が不徹底 | **解決済** | `DESIGN.md §4` 原則4（icon+label 対）|
| UI-4 | 「ショップ」ラベルが課金か通貨か曖昧 | **解決済** | `DESIGN.md §2.3`「強化」採用 / UL-026 / git `c517828` |
| UI-5 | インク資源が細いバー1本で「インク」と読めない | **解決済** | `DESIGN.md §7` InkGauge / git `a995cb7` |

### 1.2 モバイル描画品質（research/08、2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| MB-1 | 背の高い端末でレターボックス（FIT+固定390×844） | **解決済** | git `c8e08e1` full-bleed DPR-native（Scale.NONE + zoom 1/DPR）|
| MB-2 | DPR 未対応で描画がボヤける（1x） | **解決済** | git `c8e08e1` / `760aece` DPR-scaled input thinning |

### 1.3 クリア演出・テンポ（research/10、2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| CE-1 | クリア直後のエフェクトが弱い | **解決済** | git `63c129d` impact-first celebration / `15bb940` goal 5-beat |
| CE-2 | Next ボタンが出るのが遅い（≤1秒にせよ） | **解決済** | git `5b68c45` テンポ≤1.0s / `63c129d` Next tappable ≤1s / `designs/game_design.md` §行27 |

### 1.4 ラベル・語彙（git、2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| LB-1 | 禁止バリアント「もういちど」→ UL 正規 Retry/Replay | **解決済** | git `6493dd4` result labels to UL-canonical |
| LB-2 | 英語混じり（BONUS/MAX/Version）→ 日本語/カタカナ統一 | **解決済** | git `93c1f93` Japanese label consistency |

### 1.5 車の見た目（git、2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| CAR-1 | 車が「全部暗い塊」に見える | **解決済** | git `552ed46` sporty vehicle redesign（cabin/stripe/rims, fill-only）|

### 1.6 レベル進行・空間・役割（research/09・11・12、2026-07-08）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| LV-1 | どのステージも横に1本の短い線でクリアでき退屈。より複雑な線を長く、画面全体を使い、どう引くか考えさせよ。start/goal 固定で道が少し変わるだけ | **解決済（継続発展）** | research/09（監査＋13型）/ git `dfde67f` 進行overhaul / `762f69d` late-game archetypes。→ round-7 F2/F4 でさらに拡大 |
| LV-2 | 地形アセット +30 型、脳トレ、難易度インフレ、初期インクが少なすぎ | **解決済** | research/11（39型カタログ＋インク予算再設計）/ git `26b2ac4` spatial overhaul v3（generous 2-3x, compound inflation）|
| LV-3 | 線の"役割"を使えていない（道/shield/hook/multi-seal）。競合実例15型以上を集めよ | **解決済（継続発展）** | research/12（16 recipes R01-R16）/ git `5307c55` recipes / `8159d3c` role-diverse redesign。→ round-7 F4 で全9役割を28面へ展開 |

### 1.7 v4 欠陥（level_design_v4 §0、実機確認、2026-07-09）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| V4-1 | 縦画面の縦スペースが狭い（横帯ばかり） | **解決済（継続強化）** | v4 全面 縦span≥0.60 / git `fe0b30a`。→ round-7 F2 で可読窓 18-25m へ拡大、L12/L19 は 縦>横 |
| V4-2 | 危険帯が視覚的に不明 | **解決済（継続強化）** | v4 DangerZone 赤ハッチ+spike歯 / git `d18bcbf`。→ round-7 F1 で saturated red パレット統一 |
| V4-3 | L9/L12 が酷似 | **解決済（継続強化）** | v4 マトリクス min 2 / `designs/level_design_v4.md §5`。→ round-7 F4 で min **3**（全378ペア）へ |
| V4-4 | 岩が当たらない（当たっても損失にならない） | **今回対応** | v4 triggered spawns+relevance gate（git `a7c6f70`/`1500251`）は "交差" までは実装。→ **round-7 F1 で接触＝即ゲームオーバーに昇格**（下 R7-1）|
| V4-5 | 線が車に押されてズレる | **解決済（継続）** | v4 アンカー分類 / settled shape。→ round-7 F5 で全28面にアンカー方式明記 |

### 1.8 round-7（現行、2026-07-09、`.fable/criteria.json`）

| # | フィードバック項目 | 状態 | 証拠ポインタ |
|---|---|---|---|
| R7-1 | 岩に当たったらゲームオーバー（現状は当たっても損失にならない） | **今回対応** | `game_plan_v5.md §2`（fail 原因・judge 順序・relevance ゲート簡素化）/ 全 rock 面に接触即死ETA。criteria AC-1 |
| R7-2 | 車とゴールが近すぎ・ステージ面積が狭い（3回目・決着） | **今回対応** | `game_plan_v5.md §3`（size 基準 min/typ/max・可読窓 16-26m・CIゲート）/ atlas 各カードに距離明記。criteria AC-2 |
| R7-3 | killY は設計的に無意味・表現を廃止 | **今回対応** | `game_plan_v5.md §4`（engine failsafe のみ残置、視覚/atlas から除去）/ atlas-v5 は killY 非描画。criteria AC-3 |
| R7-4 | ゲーム性が広がっていない・似て非なる面 → +10面で約28面へ刷新 | **今回対応** | `game_plan_v5.md §5-6`（28-slate＋構造多様性マトリクス min 3）/ atlas-design-v5.html。criteria AC-4 |
| R7-5 | リリース前最終ラウンド | **今回対応** | 本計画一式（ledger＋plan v5＋atlas v5＋codex レビュー）。criteria AC-5/AC-6 |

### 1.9 意図的な延期（設計判断・"落とし" ではない）

| # | 項目 | 状態 | 根拠 |
|---|---|---|---|
| DF-1 | P7 Feedback Loop（レビュー誘導・フィードバックリンク） | **積み残し（v1.1 予定）** | MVP は外部ネットワーク通信ゼロ（NFR-012 / BR-008）。設定画面への追加は v1.1。`designs/functional_requirements.md` 信頼設計マッピング / `designs/README.md` ロードマップに記録済 |

---

## 2. 「車とゴールが近すぎ」= 3回目の指摘の履歴分析（決着のため）

ユーザーが同一点を3回指摘した理由を git で追跡し、**過去ラウンドの過補正**を特定した：

| 時系列 | コミット | 何をしたか | 結果 |
|---|---|---|---|
| 初期 | `26b2ac4` | spatial-puzzle overhaul v3「wider stages」 | 一旦広げた |
| 直後 | `bb3462b` | 「compact playable windows to genre density（spawn/flag をアクションに寄せる）」 | **狭めた**（ジャンル密度を優先し過補正）|
| 補修 | `26391d2` | 「playable-window framing（kills tiny-stage）」 | 描画枠は直したが spawn-goal 分離は狭いまま |
| 現状計測 | `levels/ch1-*.json` | spawn→goal 水平距離 = **min 6.1 / median 8.5 / max 9.7m**、world 幅 9.5-14m | ユーザー「まだ近い」（3回目）|

**決着方針（round-7 F2）**: 「ジャンル密度」への過補正を戻し、**可読窓（対角）16-26m・コース長・spawn-goal 分離を計測基準化**し、**CI ゲート（scripts/gates）で最小値を機械強制**して再狭化を恒久防止する。詳細は `designs/game_plan_v5.md §3`。

---

## 3. 網羅性の自己検証（落とし 0 の証明）

- **git log 全50コミット**を読み、feat/fix コミットの背景フィードバックをすべて上表に写像した（UI/mobile/celebration/label/car/levels）。
- **research 09-12 の intro 発端文**（4件のマンデート）をすべて LV-1/LV-2/LV-3 と V4-* に写像。
- **DESIGN.md §0 の5 sub-issue**を UI-1〜5 に写像。
- **level_design_v4 §0 の5欠陥**を V4-1〜5 に写像。
- **round-7 criteria の AC-1〜6** を R7-1〜5 に写像。
- 唯一の未実装項目 P7 は**設計判断による延期**として DF-1 に明示（ドキュメントに既記録）。
- → **追跡漏れ・無視された項目は存在しない。**

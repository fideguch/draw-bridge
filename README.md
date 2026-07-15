# InkBridge

**線を1本描いて、車をゴールへ運ぶ物理パズル。**

崖・穴・落石・棘の谷を前に、プレイヤーが引ける線は基本 1 レベル 1 本だけ。
指を離すと線は即座に物理化（Solidify）し、たわみ・軋み・破断する橋（BridgeChain）
になって車が自動発進する。インクは有限の戦略資源で、少なく描くほど星評価が高い。
テキストチュートリアルは無く、失敗しても罰は無い（リトライ ≤ 1 秒）。

## 線の役割（Chapter 1 の 9 類型 ＋ 複合）

同じ「1 本の線」が、面ごとに別の仕事を担うのがコアの面白さ。
役割タグは `designs/level_design_v4.md` の設計マトリクスが正本。

| role | 線の仕事 | 代表面 |
| --- | --- | --- |
| `road` | 道になって渡す／登る | L01, L02, L03 |
| `shield-static` | 静的な庇で落石を止める | L04 |
| `multi-seal` | 一筆で複数の穴を塞ぐ | L05, B1 |
| `ramp-jump` | ジャンプ台で跳ばす | L06 |
| `shield-dyn` | 転がる岩を堰き止める（時限含む） | L07, L13 |
| `catch-redirect` | 受けて逸らすシュート | L08 |
| `hook` | 障害の下をくぐる／巻きつく | L09, L12 |
| `dome-dual` | 守る屋根 かつ 走る道 | L10, B3 |
| `sag-rope` | たわむ綱で棘の谷を張り渡す | L11, B2 |

`composite` と `boss`（L23）は上記の複合。全 28 面（通常 23＋ボーナス 5、round-7 で拡張）。

## 開発エビデンス（スクリーンショット参照）

実機・レンダリングの検証画像は `.fable/` 配下に蓄積している（`.gitignore` 済み＝
git 管理外・再生成可能なので、バイナリはリポジトリに含めない）。主な参照先:

- `.fable/evidence-levels/ch1-l*.png` — レベルのレンダリング確認
- `.fable/design-atlas-spot.png`, `.fable/atlas-r5-spot.png` — アトラス整合スポットチェック
- `.fable/evidence-celebration/t*.png` — ゴール演出のフレーム連番
- `.fable/atlas/index.html` — `npm run atlas` が生成する全 28 面のルートアトラス（自己完結 HTML）。設計正本は `designs/atlas-design-v5.html`

## クイックスタート

```bash
npm install
npm run dev      # ブラウザでプレイ（Vite HMR）
npm test         # vitest エンジン単体（src/engine/ で ≥80% カバレッジ）
npm run gates    # レベル検証パイプライン Gate 0-3（headless Node）
npm run e2e      # Playwright（実タップ L1 クリア / 全 28 面キャンペーン / テンポ契約）
npm run atlas    # 設計アトラス .fable/atlas/index.html を再生成
```

補助: `npm run lint`（ESLint）, `npm run build`（tsc --noEmit + vite build）,
`npm run spike:determinism`（決定論 1000 run のハッシュ一致回帰）。
Node 20 系を前提（CI 決定論のためピン留め）。

## アトラス先行のレベル設計プロセス

工程を反転させ、**設計を先に絵で確定してから実装する**（atlas-first）:

1. **設計** — `designs/atlas-design.html` と `designs/level_design_v4.md` で
   18 面のシルエット・ハザード配置・役割・難度順を確定（これが設計正本）。
2. **実装** — レベル JSON（`levels/ch1-*.json`）とエンジン（DangerZone 実体・
   岩インターセプト）を、その図に一致させる。
3. **照合** — `npm run atlas` が JSON とゴースト解を実物理から再描画し、
   `.fable/atlas/index.html` として出力。設計図と実装の乖離を目視・機械で検出する。

## アーキテクチャ（レイヤー境界）

境界は `.specify/memory/conventions.md` が定義し、ESLint（eslint-plugin-boundaries）が強制する。

| レイヤー | ディレクトリ | 役割 |
| --- | --- | --- |
| Engine | `src/engine/` | Phaser 非依存・headless 実行可能なゲームロジック（物理・ルール・レベル・リプレイ） |
| Render | `src/render/` | Phaser 4 シーン・描画入力・juice・音。Engine を観測し、書き戻さない |
| Meta | `src/meta/` | コイン・アップグレード・進行・セーブ |
| Platform | `src/platform/` | インターフェイス＋ `noop/` `web/` `capacitor/` 実装 |
| Tuning | `src/tuning/TuningConstants.ts` | 全チューニング数値の単一ソース（マジックナンバー禁止） |
| Tools | `src/editor/`, `src/debug/` | レベルエディタ・チューニングパネル（dev ビルド専用） |

import 規則: **Engine は何も import しない**（`Phaser 4.2` / `phaser-box2d 1.1` を
使うのは Render 以降）。render/meta は engine・tuning のみ、platform 実装は
platform インターフェイスのみに依存する。

## レベル検証パイプライン（Gate 0-3）

`npm run gates` が全 18 面を headless Node で機械検証する。契約は
`specs/001-inkbridge-mvp/contracts/gate-pipeline.md`。

- **Gate 0 — schema**: レベル JSON をエンジンの `validateLevel`（ゲーム／エディタと共有）で検証＋ファイル名⇔id 一致。
- **Gate 1 — static**: `inkBudget > 0`・車スポーンが地形上・ゴール旗の設置・地形ワインディング／衝突面（無シミュレーション）。
- **Gate 2 — ghost replay**: 記録済みゴースト解を **Lv0 で再走**し、記録結果との許容帯（outcome 一致・tick ±30・finalPos 0.05m）に収まるか検証（BR-004 = 無強化でクリア可能の機械証明）。プロセス内 2 回走行が bit 一致すること（決定論回帰）も要求。
  - **ハザード settle 条件（動的ハザード面のみ）**: `rocks[]` を持つ面は岩がドーム上で settle する n 体接触が混沌としており、記録 finalPos がビルド差で最大 ~0.5m ドリフトしうる。**再走が CLEAR かつ tick が帯域内のときに限り** finalPos εを `HAZARD_SETTLE_EPSILON_M`（0.5m）へ緩和する（静的面は 0.05m のまま厳格・outcome/tick 退行時も厳格。`src/engine/replay/GhostPlayer.ts`）。
  - **Gate 2.5 コイン**: 少なくとも 1 つのゴースト経路が全コインを実軌跡上で回収できること（取れないコインは失敗）。
  - **Gate 2.6 ハザード関連性**: rock / DangerZone は車の時空間経路と交差し、実際に失敗へ変換できること（各ハザード面はインターセプト帯の下に穴を持ち、素朴な直線が岩と共に落ちる）。
- **Gate 3 — anti-dominant**: `anti-dominant` タグ面で、直線ボット（rim-to-rim ＋高さ変位 {0, +0.5, +1.0}m）が **必ず失敗**すること（負の対照＝1 本の直線で解けない設計の保証）。

オーサリング（ゴースト記録・コイン配置）は `src/engine/replay/` と
`scripts/atlas/` が共有する実ゲーム物理を通す。

## デバイスビルド（iOS / Android）

Capacitor 7 シェル（`@capacitor/core` `^7.6.7`）。

```bash
npm run build && npx cap sync   # Web 資産をネイティブシェルへ同期
```

手順の詳細は `specs/001-inkbridge-mvp/quickstart.md`:
§5 Device Build、§8 実機計測手順（Android の p95 step / fps ゲートキーパー）、
§9 チューニングワークフロー / エミュレータ検証。

## コントリビュート

- ドメイン用語は **UL（`designs/ubiquitous_language.md`）が拘束**:
  Stroke（物理化前）/ BridgeChain（物理化後）、Level（"stage" は使わない）、
  Restart / Retry / Replay（文脈固定ラベル）、`強化`（"ショップ" は廃止）。
- 命名・境界・ビジネスルール（BR-001..BR-010）は `.specify/memory/conventions.md`。
  新しいエンティティは **まず conventions.md に追加** してから実装する。
- 原則は `.specify/memory/constitution.md`（Engine は Phaser フリー / juice 仕様は要件 /
  v1.0 は広告・解析 SDK なし・外部通信ゼロ = BR-008）。
- 全チューニング数値は `src/tuning/TuningConstants.ts` かレベル JSON に集約
  （マジックナンバーはレビューブロック）。ファイル ≤800 行・関数 ≤50 行、TypeScript strict。

# 10. クリア演出の強化リサーチ — celebration stack の設計と Next ≤1.0s 化

> 対象フィードバック:
> 1. 「クリアした直後のエフェクトが弱い」→ celebration stack を分解し、安価で効く punch レイヤを追加。
> 2. 「Next ボタンが出るのが遅い（クリア後1秒以内に次へ）」→ Next 活性化を celebration 完了から**切り離す**。
>
> 本書は既存アーキテクチャ（`src/render/juice/`, `src/render/scenes/play/GoalSequence.ts`,
> `src/tuning/TuningConstants.ts` の `goal.*`, `src/render/ui/theme.ts`, `fillShapes.ts`）と
> Phaser 4.2.0 実 API（`node_modules/phaser`）を検証した上で、実装可能な処方箋を出す。
> juice 理論の一次ソースは `research/03_juice_research.md`、fill-only 制約は `research/08_mobile_quality.md §3` を継承。

---

## 0. 結論サマリ（TL;DR）

### 診断
- **Next が遅い根本原因**: Next は「celebration 全体が終わってから」活性化する設計。実測タイムラインで
  `envelopeMs()`（= hitStop 100 + slowHold 400 + slowRecover 250 = **750ms**）でパネル表示 →
  そこから `nextActivateDelaySec` **2000ms** 後に活性化 = **クリア後 2750ms**。要求（≤1000ms）の2.75倍。
- **演出が弱い根本原因（5点）**: (1) クリア瞬間に**画面フラッシュが無い**（切断面の「パンチ」不在）、
  (2) 「クリア！」タイトルが `revealPanel()` で**静的に出現**（bounce/pop が無い）、
  (3) confetti は 100ms で出るが**スロー演出の裏に埋もれ**、リザルト画面自体は scrim+text+ボタン2個で**平面的**、
  (4) 背景に**放射光（sunburst）/グロー等の「豪華さ」レイヤが無い**、
  (5) star pop（半径28px）・camera trauma（0.4）が控えめで**「大きい瞬間」が作れていない**。

### 処方
1. **impact-first 再構成**: t=0 に `camera.flash` + trauma bump + confetti cannon + goal stinger を**同時発火**。
   スロー演出は圧縮し、その裏でパネルが**素早く**入る。
2. **Next を celebration から切り離す**: パネル表示（~600ms）+ `nextActivateDelaySec` を **0.3s** に短縮 →
   **Next tappable @ ~900ms**。star/coin/rain は Next 活性化後も**afterglow として裏で継続**（全ビート tap-skip 可）。
3. **安価に効く punch レイヤ 5種**（ほぼ描画コスト0）: screen flash / タイトル scale-bounce /
   sunburst rays（generateTexture 焼き＋回転）/ star sparkle burst（既存 `ParticleBurst` 再利用）/ camera zoom-kick。
4. celebration 総尺は視覚 **~2.0–2.4s**（Next はその 1/3 の時点で既に押せる）。

---

## 1. 問題の診断（現状コード実測）

### 1.1 Next が遅い理由 — 現行タイムライン

`GoalSequence.start()` → `revealPanel()` の実測（`goal.*` 現行値）:

| t (ms) | 発生 | ソース |
|---|---|---|
| 0 | hit-stop 開始（100ms）+ trauma 0.4 + duckBgm | `start()` |
| 100 | confetti cannon + rain 開始 | `schedule(goal.hitStopMs, fireConfetti)` |
| **750** | **パネル表示**（scrim + 静的「クリア！」+ coin counter + Replay有効/Next無効）+ star + count-up 開始 | `schedule(envelopeMs(), revealPanel)`。`envelopeMs = 100 + 400 + 250` |
| **2750** | **Next 活性化**（`revealPanel` から `nextActivateDelaySec` 2.0s 後） | `schedule(goal.nextActivateDelaySec*1000, activateNext)` |

→ **Next tappable = 2750ms**。ユーザーが「遅い」と感じるのはこの構造。
UX 研究では **400ms を超えると「効いたか？」の不安が芽生える**（[UX Tigers, think-time](https://www.uxtigers.com/post/think-time-ux)）。
リザルトで 2.75s 待たされるのは HC のテンポ設計として明確に過長。

### 1.2 演出が弱い理由 — レイヤ棚卸し

| 現状レイヤ | 有無 | 評価 |
|---|---|---|
| hit-stop → slow-mo → recover | あり（`TimeScaleController.goalCelebration`） | ◯ ただし尺が長く（650ms）「間延び」寄り |
| camera trauma（shake） | あり（`traumaGoal` 0.4） | △ 控えめ。ゴールは最大級の瞬間なので 0.5 相当が妥当 |
| **screen flash（白/クリーム閃光）** | **無し** | ✗ 「切断面のパンチ」が最も効く安価レイヤが欠落 |
| confetti cannon ×2 + rain | あり（`Confetti.ts`, 50×2 + 80） | ◯ 密度は十分。ただしスローの裏で目立たない |
| **center burst（中央からの一発）** | **無し** | △ 画面中央の「主役」になる一撃が無い |
| **「クリア！」タイトルの pop/bounce** | **無し（静的 `add.text`）** | ✗ 出現が limp。Gmail の star pop（200ms bounce）原則の逆 |
| **sunburst rays / 放射光** | **無し** | ✗ リザルト背景が平面的（scrim+text+button のみ） |
| star pop + shockwave | あり（`StarBurst.ts`, 半径28, overshoot 1.3） | ◯ 小さめ。sparkle/glow を足すと「豪華」化 |
| reward count-up + coin fountain | あり（`RewardCountUp.ts`） | ◯ 良好。coin 可視数を増やすと満足度↑ |
| Next 脈動誘導 | あり（±5%, 0.8s） | ◯ ただし活性化が遅すぎて意味が薄い |
| SFX（star arpeggio / count tick / coin chime / confetti pop / BGM duck） | あり（`AttemptJuice`） | ◯ 揃っている。**clear stinger（ジングル）だけ未配線** |
| haptic（star 漸増 / coin 間引き） | あり（`HapticsRouter`） | ◯ **impact の THUD（t=0）だけ弱い**（confetti pop 側の haptic に依存） |

**要点**: 音・触覚・confetti・star・coin は「素材」として揃っている。弱いのは
**(a) クリア瞬間の視覚パンチ（flash/中央burst/trauma）** と **(b) リザルト面の見栄え（title bounce / sunburst）** と
**(c) テンポ（Next が遅い）** の3点。素材追加より **orchestration（並べ替え・強調）** で大半が解ける。

---

## 2. 競合の celebration stack 分解（catalog）

ジャンルヒットのクリア演出を分解（`research/03 §7` teardown + 追加リサーチ）。**Next 即時性**の列に注目。

| ゲーム | 瞬間の punch | 評価表示 | 報酬 | 背景の豪華さ | Next テンポ |
|---|---|---|---|---|---|
| **Happy Glass**（Lion Studios） | 水が溢れる→スマイル（personality）、軽い flash | **インク使用量＝星**を順次表示 | コイン加算 | 控えめ（ガラスの表情変化が主役） | 速い・ワンタップで次 |
| **Draw Climber**（Voodoo） | フィニッシュライン通過で紙吹雪、レース勝利感 | 順位/報酬倍率ゲート | コイン倍率（RV接続） | レース背景＋群衆 | フィニッシュ後**即**報酬→次 |
| **Draw Bridge 系** | 車が渡り切る hit-stop 感、confetti | ★1-3 | コイン fountain | flag + confetti | 速い |
| **HC 一般の定番 stack** | ① screen flash（1-2フレーム白）② hit-stop 80-120ms ③ confetti 2段 | ④ star を 200-300ms 間隔で pop（scale 0→1.3→1.0）＋上昇アルペジオ | ⑤ coin を counter へ時差 fly＋半音上昇 chime | ⑥ 放射状 rays（回転）＋タイトル bounce＋scrim dim | **⑦ Next は演出と並行して即活性（celebration は裏で継続）** |

**横断原則（本作への示唆）**:
- **クリア瞬間に「白い一撃」**（flash）を置くのは HC の常套。破壊/達成の「切断」を可視化（`research/03 §1.1` "Screen flash / over-scale"）。
- **star の順次 pop は afterglow**であり、**Next の前提条件ではない**。競合は Next を早期に出し、star/coin/紙吹雪を**パネルの上/裏で流し続ける**。
- タイトル文字は**必ず animate**（bounce/pop/落下）。静的テキストは「達成感の放棄」。
- 「豪華さ」は**放射光 rays**（1枚の回転スプライトで十分）で安価に出る。

出典: [Happy Glass Design Analysis (Game Developer)](https://www.gamedeveloper.com/design/happy-glass---design-analysis) /
[Voodoo Guide (GameAnalytics)](https://www.gameanalytics.com/blog/voodoo-guide-mobile-game-design-keep-things-simple) /
[Hypercasual UI/UX Guide (Pixune)](https://pixune.com/blog/hypercasual-games-ui-ux-design-guide/)

---

## 3. celebration-stack カタログ — 具体パラメータ（本作テーマ色と対応）

theme（`src/render/ui/theme.ts`）の色トークン:
`goalFlag 0xff4f9a` / `carBody 0xff7a1a` / `coin,star 0xffe14d` / `uiPrimary 0x21c46b` /
`stressMid 0xffb300` / `sky 0xa8e4ff` / `inkLine 0xf8f5ec`（クリーム）/ `inkBorder 0x2b2440`。

confetti/celebration の festive palette（現行 `GoalSequence` ヘッダ準拠）:
**`[goalFlag, carBody, coin, uiPrimary, stressMid]`** に `sky` を足した **6色**を推奨（彩度の帯を広げる）。

| # | レイヤ | パラメータ（推奨値） | easing | 色 | 優先度 | 現状 |
|---|---|---|---|---|---|---|
| L1 | **screen flash** | duration 90–120ms、peak alpha 0.45（白すぎ回避）、1回のみ | 立上り即時→`Quad.Out` フェード | `inkLine 0xf8f5ec`（クリーム閃光。純白 0xffffff は硬い） | **必須** | ✗ |
| L2 | **camera zoom-kick** | slow-mo と別に、t=0 で瞬間 +6% ズームを 120ms で戻す（「ドンッ」の質量） | `Back.Out` | — | 推奨 | △（slow-mo zoom のみ） |
| L3 | **camera trauma** | `traumaGoal` 0.4 → **0.5**（着地 0.25 とクラッシュ 0.5 の間、ゴールは最上位級） | trauma² 減衰（既存） | — | 推奨 | ◯ |
| L4 | **confetti cannon ×2** | 各 `confettiCannonCount` 50（現行維持）、初速 45–70°、拡散、寿命はバリスティック | 重力積分（既存） | 6色 palette | 必須 | ◯ |
| L5 | **center burst（新）** | flag 中央から 24–32 片を全周放射（`ParticleBurst.emit` full-circle、速度 240–420px/s、寿命 500ms） | `Linear`＋alpha フェード（既存 ParticleBurst） | 6色 palette | 推奨 | ✗ |
| L6 | **confetti rain** | `confettiRainCount` 80、fall **2000ms**（現行 2500→短縮でテンポ締め） | 重力積分（既存） | 6色 palette | 推奨 | ◯ |
| L7 | **タイトル「クリア！」bounce** | scale 0 → **1.15 → 1.0**、260ms、+ y に軽い overshoot（-8px→0） | `Back.Out`（pop）→`Quad.Out`（settle） | 文字 `textInverse 0xffffff`、陰に `inkBorder` | **必須** | ✗ |
| L8 | **sunburst rays（新）** | 12–16 本の金色ウェッジをパネル背後に。連続回転 **8–12°/s**、alpha 0→0.28→0 で 2.2s | 回転 `Linear`、alpha `Sine` | `star 0xffe14d`（薄）/ `stressMid 0xffb300` | 推奨 | ✗ |
| L9 | **scrim dim** | 既存 `scrim {0x14122b, 0.6}` を **fade-in 150ms**（現在は即時）で「暗転して主役を立てる」 | `Quad.Out` | `0x14122b @0.6` | 推奨 | △（即時表示） |
| L10 | **star pop** | 半径 28→**30**、overshoot **1.3→1.4**、間隔 250ms、shockwave ring（既存）＋ **sparkle 6片**（`ParticleBurst`、star 色） | `Back.Out`→`Quad.Out`（既存） | `star 0xffe14d` | 必須 | ◯（sparkle 追加） |
| L11 | **reward count-up** | 0→額を `countUpSec` 1.2s、tick 45ms、pitch 1.0→1.3（既存） | `easeOutCubic`（既存） | 文字 `textInverse` | 必須 | ◯ |
| L12 | **coin fountain** | `coinBurstCount` 20、radial explode→counter へ 30ms 時差 fly、到達で counter punch（既存） | explode `Quad.Out`→fly `Quad.In`（既存） | `coin 0xffe14d`/`coinStroke` | 必須 | ◯ |
| L13 | **Next arrive** | パネル+0.3s で **enabled + scale-in pop（0.9→1.0, 160ms）** ＋既存 ±5% 脈動 | `Back.Out` | `uiPrimary 0x21c46b` | **必須** | △（遅すぎ） |

**particle budget（モバイル 60fps）**: 現行 confetti は cannon 100 + rain 80 = **180 個の proxy-tween 矩形**（各 onUpdate 毎フレーム）。
これは既に上限帯。追加する center burst（~28）+ star sparkle（~18）は**寿命 500ms の短命**で同時存在は限定的なので許容。
**「もっと密度」を求めるなら → §5.4 の ParticleEmitter 移行**（単一ドローコール、テクスチャatlas）で 200–300 片まで安全に押せる。
逆に**強さは flash / trauma / title bounce / sunburst（いずれも ≒0 コスト）で作る**のが費用対効果最良で、confetti 増量は最後の手段。

出典: [Building a 60FPS WebGL Game on Mobile (Airtight)](https://www.airtightinteractive.com/2015/01/building-a-60fps-webgl-game-on-mobile/) /
[Optimizing Particle Effects for Mobile (Unity Learn)](https://learn.unity.com/tutorial/optimizing-particle-effects-for-mobile-applications)

---

## 4. Juice 理論の適用 — anticipation → impact → afterglow

`research/03 §1`（"Juice it or Lose it" / "Art of Screenshake" / "Game Feel" / Eiserloh camera math）の三幕構成をゴールに割り当てる:

| 幕 | 時間帯 | 内容 | 効かせ方 |
|---|---|---|---|
| **anticipation** | クリア確定の直前フレーム | hit-stop（**hold frame**）80–120ms で「時が止まる」 | 既存 `hitStopMs` 100。1–3フレームの hold がインパクトを増幅（`research/03 §5.3`） |
| **impact** | t=0–150ms | **flash（L1）＋ trauma（L3）＋ zoom-kick（L2）＋ confetti cannon（L4）＋ center burst（L5）＋ stinger（音）＋ THUD（触覚）を同時** | 「同時多発」が脳汁の核。単発でなく**積層**（Juice it or Lose it の主張そのもの） |
| **afterglow** | t=0.4–2.4s | slow-mo 復帰 → パネル bounce-in → star 順次 pop → count-up → coin fountain → rain 沈静 → sunburst 回転フェード | **Next はこの幕の頭（~0.9s）で既に押せる**。afterglow は「見たい人だけ見る」ボーナス |

**easing 指針**（`research/03 §5.3`, GameAnalytics）:
- **画面に入る/止まる** → `ease-out`（scrim fade、title settle、star settle）。
- **遊び心の pop** → `Back.Out`（title・star・Next の overshoot）。
- **飛び去る/加速** → `ease-in`（coin が counter へ吸い込まれる `Quad.In`、既存）。
- UI は 150–300ms、ゲーム内オブジェクトは 100–200ms（本作の既存値と整合）。

---

## 5. Phaser 4.2.0 実装アプローチ（実 API 検証済み）

### 5.1 検証済み API（`node_modules/phaser/types/phaser.d.ts` 実測・行番号）

| API | 行 | 用途 | fill-only 制約（§3）との関係 |
|---|---|---|---|
| `Camera.flash(duration, r, g, b, force?, cb?, ctx?)` | 4002 | **L1 screen flash** | **無関係**（post-composite の全画面ティント。Graphics stroke ではない）→ **安全** |
| `Camera.shake(duration, intensity, force?, cb?, ctx?)` | 4014 | 追加の一発 shake（trauma 系と併用可） | 無関係 → 安全 |
| `Camera.zoomTo(zoom, duration, ease, force?, cb?, ctx?)` | 4059 | L2 zoom-kick / slow-mo zoom | 無関係 → 安全 |
| `Camera.fadeIn/fadeOut(...)` | 3946 / 3960 | 画面転換（本件では未使用でよい） | 無関係 |
| `Graphics.generateTexture(key, w?, h?)` | 29834 | **L8 sunburst をテクスチャ焼き**、confetti チップの texture 化 | **fill のみで描いて焼く**ので §3 適合（`research/08 §3.2` の推奨手法そのもの） |
| `ParticleEmitter`（`add.particles`, `ParticleEmitterConfig`: `tint[]`, `gravityY`, `rotate`, `lifespan`, `quantity`, `speed`…） | 存在（`src/gameobjects/particles/`） | §5.4 confetti 高密度化（任意） | texture 駆動なので §3 適合 |
| `camera.filters.internal/external.addGlow(color, outer, inner, …)` | 18742 | star / title の glow（任意の「豪華」化） | filter パイプライン（stroke 不使用）→ 安全。ただしモバイル GPU 負荷は実機確認 |

**結論**: 追加したい演出（flash / shake / zoom-kick / sunburst / 高密度 particle / glow）は**すべて Phaser 4.2 に存在し、
すべて §3 の「Graphics stroke 禁止」に抵触しない**（stroke 系は `strokeRoundedRect`/`strokePath`/`strokeCircle`/`lineStyle` のみが対象）。

### 5.2 fill-only 互換の描画手法（既存 `fillShapes.ts` を使う）

- **sunburst rays**: fill-only の `g.fillPoints`（`fillShapes.ts` 内 `fillPoly`）で N 本の三角ウェッジを中心から描く →
  **`generateTexture('sunburst', d, d)` で1枚に焼く** → `scene.add.image(cx, cy, 'sunburst')` を scrim と title の間の depth に置き、
  `tween { angle: +360, duration: ~30000, repeat:-1 }`（連続回転）＋ alpha 0→0.28→0 を 2.2s。
  **回転は1スプライトの transform のみ**なので毎フレーム再描画ゼロ、GPU も安い。
- **title bounce**: `ResultOverlay.showClearShell` の `add.text('クリア！')` に `setScale(0)` → `tweens.add({ scale: 1.15, ease:'Back.Out', 260ms, yoyo→1.0 })`。
  既存 `CommitPop` / star pop と同じ「centroid-local scale pop」パターンで drift 無し。
- **center burst / star sparkle**: 既存 **`ParticleBurst`（`src/render/juice/ParticleBurst.ts`）をそのまま再利用**。
  `new ParticleBurst(scene, {depth, gravityPx:0, lifeMsMin:300, lifeMsMax:600, sizePxMin:3, sizePxMax:7})` →
  `emit(flagX, flagY, {count:28, color: pick(palette), speedPxMin:240, speedPxMax:420})`（full-circle）。
- **screen flash**: 最小実装は `scene.cameras.main.flash(100, 248, 245, 236)`（クリーム）。
  **より柔らかい制御**が欲しければ、既存 `skipCatcher` と同型の全画面 `add.rectangle(..., 0xf8f5ec, 0).setScrollFactor(0)` を
  alpha 0.45→0 に `Quad.Out` で 100ms フェード（fill-only、depth は confetti より上・パネルより下）。どちらも §3 適合。

### 5.3 既存モジュールへの接続点（新規ファイルを最小化）

| 追加レイヤ | 接続先 | 変更概要 |
|---|---|---|
| L1 flash | `GoalSequence.start()` 冒頭 | `this.deps.scene.cameras.main.flash(...)` を 1 行、または `CameraDirector.flash()` を薄く追加 |
| L2 zoom-kick / L3 trauma 0.5 | `TuningConstants.camera.traumaGoal`, `GoalSequence.start()` | 定数変更＋既存 `addTrauma` 呼び出しのみ |
| L5 center burst / L10 sparkle | `GoalSequence.fireConfetti()` / `StarBurstView.popStar()` | 既存 `ParticleBurst` を new して emit |
| L7 title bounce / L9 scrim fade / L13 Next pop | `ResultOverlay`（`showClearShell` / `addScrim` / `activateNext`） | tween 追加。**新規パーティは sunburst の1枚だけ** |
| L8 sunburst | 新規 `SunburstView`（小、~60行）or `ResultOverlay` 内 | generateTexture 焼き＋回転 Image |

### 5.4 （任意）confetti を ParticleEmitter へ移行して perf headroom を得る

現行 confetti は「proxy-tween 矩形 ×180」。**もっと密度**を望むなら Phaser の `ParticleEmitter` へ:
1. boot 時に fill-only Graphics で 3–4 色の紙片チップを描き `generateTexture('confetti_chip', ...)`。
2. `scene.add.particles(x, y, 'confetti_chip', { tint:[6色], gravityY:420, rotate:{min:-360,max:360}, speed:{min:200,max:640}, angle:{min:-110,max:-70}, lifespan:2200, quantity:… })` を cannon/rain 用に配置。
- **利点**: 単一ドローコール＋atlas 化で 200–300 片でも 60fps 余裕。`emitParticleAt` で一括発火。
- **トレードオフ**: (a) boot で texture 焼きが1回入る、(b) 現行の**純粋 generator（headless テスト対象）が emitter config に置き換わる**ため、
  `confettiCannonPieces`/`confettiRainPieces` の unit test 資産を失う。**まず §3 の安価 punch を入れて体感を測り、density 不足が残った場合のみ**移行するのが費用対効果的に正しい（Kwalee 原則: polish は検証後の第2波）。

---

## 6. 新ビートタイムライン — Next tappable ≤1.0s（celebration は 1.5–2.4s 継続）

### 6.1 推奨タイムライン（impact-first + Next 早期活性）

| t (ms) | beat | 視覚 | 音 (SFX) | 触覚 (haptic) |
|---|---|---|---|---|
| **0** | **IMPACT（切断面）** | hit-stop 100ms freeze / **flash クリーム 100ms（L1）** / trauma **0.5**（L3）/ **zoom-kick +6%→戻す（L2）** / **confetti cannon ×2（L4）** / **center burst 28片（L5）** | **clear stinger（上昇ジングル）** + **confetti pop ×2**（左右 50ms 差） / duckBgm | **THUD（landStrength 1.0）** |
| 100 | slow-mo in | `timeScale→0.3`、slow-mo zoom in（既存）、confetti **rain** 開始（fall 2000ms） | （スティンガー継続、BGM ダック中） | — |
| 100–**400** | slow hold | `slowHoldSec` **0.3**（0.4→短縮） | — | — |
| 400–**600** | recover | `slowRecoverSec` **0.2**（0.25→短縮）、`timeScale→1` | — | — |
| **~600** | **PANEL reveal** | `setZoomImmediate(1)`（E2E 制約: 画面座標 UI 前に zoom=1）/ **scrim fade-in 150ms（L9）** / **「クリア！」bounce（L7）** / **sunburst rays 回転フェードイン（L8）** / `markResultState()` / star・count-up・coin fountain 開始 | — | — |
| ~600–1350 | star afterglow | star ×(1-3) を 250ms 間隔で pop（overshoot 1.4）＋ shockwave ＋ **sparkle（L10）** | **C-E-G アルペジオ**（3つ目に cymbal） | **ascending light→medium→heavy**（既存 `starBeat`） |
| ~600–1800 | reward | count-up 1.2s（tick pitch 1.0→1.3）＋ coin fountain（30ms 時差 fly、counter punch） | tick 音上昇 / coin 到達 **半音上昇 chime** | coin 間引き（`hapticThinning` 3） |
| **~900** | **NEXT LIVE** | Next **enabled + scale-in pop（L13）** ＋ ±5% 脈動。**← ここで tappable（≤1.0s 達成）** | （任意）UI pop | （任意）light |
| ~1800–2400 | afterglow tail | confetti rain 沈静 / sunburst 回転しつつ alpha フェードアウト | count-up 完了「ジャジャン」＋ unduckBgm | — |

**キー数値**:
- **Next tappable = envelope 600ms + nextActivateDelay 300ms = 900ms**（≤1000ms 達成、margin 100ms）。
- celebration の**視覚**総尺 ~2.4s（rain/sunburst の soft tail 含む）。要求「1.5–2.5s」内。
- 全ビート **tap-skip 可**（既存 `skip()` を踏襲）。ただし Next は既に 0.9s で live なので、
  **skip は「afterglow を早送りするだけ」**で Next 活性化タイマとは独立（現行の skipCatcher→scrim skip 構造を維持）。

### 6.2 TuningConstants 変更（`goal.*`）

| 定数 | 現行 | 推奨 | 根拠 |
|---|---|---|---|
| `goal.slowHoldSec` | 0.4 | **0.3** | 間延び短縮（range 0.3–0.5 内で最短寄り） |
| `goal.slowRecoverSec` | 0.25 | **0.2** | 同上（range 0.2–0.3 内で最短） |
| `goal.nextActivateDelaySec` | 2.0 | **0.3** | **Next を celebration 完了から切離す最重要変更**。パネル+0.3s で活性化 |
| `camera.traumaGoal` | 0.4 | **0.5** | ゴールは最上位級イベント（クラッシュ 0.5 と同格） |
| `goal.confettiRainCount` | 80 | 80（維持） | 密度は十分 |
| （新）`goal.flashMs` | — | **100** | screen flash 尺 |
| （新）`goal.flashPeakAlpha` | — | **0.45** | クリーム閃光ピーク（純白 1.0 は硬い） |
| （新）`goal.zoomKickPct` | — | **6** | impact zoom-kick（%） |
| （新）`goal.titlePopScale` | — | **1.15** | タイトル bounce overshoot |
| （新）`goal.sunburstRayCount` | — | **14** | rays 本数 |
| （新）`goal.sunburstRotDegPerSec` | — | **10** | rays 回転速度 |
| `StarBurst` overshoot（現状ローカル `STAR_POP_OVERSHOOT_SCALE` 1.3） | 1.3 | **1.4**（+ 定数を `goal.starPopOvershoot` へ昇格） | `StarBurst.ts` の TODO(tuning) を解消（現在マジックナンバー） |

> 注: `StarBurst.ts` / `Confetti.ts` / `RewardCountUp.ts` に散在する `TODO(tuning)` ローカル定数
> （overshoot, shockwave, confetti geometry, counter punch, coin burst reach 等）は、この機会に
> `goal.*` へ昇格すると **NFR-010「全 tunable は TuningConstants か level JSON」** に完全準拠する（現在は暫定ローカル）。

### 6.3 `GoalSequence` の構造変更（要点のみ）

1. **`start()` 冒頭に IMPACT を集約**: `camera.flash` + trauma 0.5 + zoom-kick + **confetti を t=0 で発火**（現行は `schedule(hitStopMs, fireConfetti)`＝100ms 後 → t=0 直後へ前倒し）+ center burst + `goalImpact()`（新・§7）。
2. **`revealPanel()` の Next スケジュールを短縮**: `schedule(goal.nextActivateDelaySec*1000=**300**, activateNext)`。**star/count-up は現状どおり `revealPanel` 内で開始**（＝Next と並行）。
3. **`ResultOverlay.showClearShell` にタイトル bounce / scrim fade / sunburst を追加**、`activateNext` に scale-in pop を追加。
4. **skip 経路は不変**（time snap → revealPanel → confetti.stop / stars.skip / countUp.skip）。Next タイマは skip とは独立に走る（既に 0.9s で活性なので実害なし）。

---

## 7. SFX / Haptic レイヤリング（既存 `AttemptJuice` / `HapticsRouter` 活用）

### 7.1 モーメント別マップ

| モーメント | SFX（`AttemptJuice` フック） | Haptic（`HapticsRouter`） | 既存/新規 |
|---|---|---|---|
| **t=0 impact** | **clear stinger（上昇ジングル）** + `goalConfettiPop(0/1)`（既存, 左右 50ms 差） + `duckBgm()`（既存） | **THUD（landStrength 1.0）** | stinger と impact haptic は**新規 `goalImpact()`**、pop/duck は既存 |
| star i pop | `goalStarBeat(i)`（既存）: C-E-G アルペジオ＋3つ目 cymbal | `starBeat(i)`（既存）: light→medium→heavy | 既存 |
| count-up tick | `goalCountTick(progress)`（既存）: pitch 1.0→1.3 | — | 既存 |
| count-up 完了 | 「ジャジャン」＋ `unduckBgm()`（既存 onDone） | — | 既存（chord は SfxSynth 側で強化可） |
| coin i 到達 | `goalCoinArrive(i)`（既存）: 半音上昇 chime | coin 間引き（既存 `hapticThinning`） | 既存 |
| **Next activate** | （任意）`playTap()` 系の軽い pop | （任意）`uiHaptic()` light | 任意・新規配線 |

### 7.2 追加提案 — `AttemptJuice.goalImpact()`

現状、クリア瞬間の「一撃の音＋触覚」は confetti pop の haptic に相乗りしている。**切断面を締める専用キュー**を1つ足す:

```ts
// services.ts の AttemptJuice に追加（composition root で SfxSynth/HapticsRouter に配線）
/** Goal impact (t=0): clear stinger (rising jingle) + heavy THUD haptic (§4.3 3-1). */
goalImpact(): void;
```

- **SFX**: 上昇ジングル（例: メジャートライアド上昇 or ゴール stinger 1発）。BGM ダックと同時に前面へ。
- **Haptic**: `HapticsRouter` に `onGoalImpact()` を足し `fire('land')`（landStrength 1.0 / THUD）1発。
  既存 frozen `HapticEvent` enum を**増やさず** `'land'` 再利用（`break` burst と同じ「既存イベント合成」方針）。
- これで haptic の弧が **THUD（impact）→ light→medium→heavy（star）→ 間引き tick（coin）** と escalate し、触覚だけで達成のドラマが読める。

**音設計原則**（`research/03 §5.4`）: 反復音は pitch ランダム ±5–10%、連鎖は半音上昇、重要イベントに低域を足す、
ゴール瞬間は BGM を -7.5dB ダック（既存 `audio.bgmDuckDb`）して stinger を立てる。既存実装と整合。

---

## 8. 実装チェックリスト（優先度順）

### P0 — テンポ修正（ユーザー要求②に直結、変更コスト最小）
- [ ] `goal.nextActivateDelaySec` 2.0 → **0.3**（Next を celebration から切離す）
- [ ] `goal.slowHoldSec` 0.4→0.3、`goal.slowRecoverSec` 0.25→0.2（envelope 750→600ms）
- [ ] → **Next tappable @ ~900ms** を E2E（`npm run e2e`）で assert（既存 `setDevResultNextReady` フック活用）

### P1 — 安価 punch（ユーザー要求①に最大効果、描画コスト≒0）
- [ ] **screen flash（L1）**: `cameras.main.flash(100, 248,245,236)` を `start()` t=0 に
- [ ] **camera trauma 0.5（L3）** + **zoom-kick 6%（L2）**
- [ ] **confetti を t=0 発火**（100ms 前倒し）
- [ ] **「クリア！」bounce（L7）**: `showClearShell` の title に Back.Out scale pop
- [ ] **scrim fade-in 150ms（L9）** + **Next scale-in pop（L13）**
- [ ] **`goalImpact()` 配線**（stinger + THUD、§7.2）

### P2 — 豪華レイヤ（差がつく afterglow）
- [ ] **sunburst rays（L8）**: fill-only 描画→`generateTexture`→回転 Image
- [ ] **center burst（L5）** + **star sparkle（L10）**: 既存 `ParticleBurst` 再利用
- [ ] star overshoot 1.3→1.4、shockwave 明度up
- [ ] `TODO(tuning)` ローカル定数群を `goal.*` へ昇格（NFR-010 準拠）

### P3 — 任意（perf headroom / さらなる密度）
- [ ] confetti を `ParticleEmitter`＋`generateTexture` チップへ移行（§5.4、体感不足が残る場合のみ）
- [ ] star/title に `camera.filters.addGlow`（実機 GPU 負荷を確認の上）

---

## 9. 出典

**juice / game-feel 理論**
- [Juice it or Lose it (GameJuice まとめ)](https://gamejuice.co.uk/resources/juice-it-or-lose-it) — 積層による feel 変化の原典
- [Squeezing more juice out of your game design (GameAnalytics)](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design) — easing 使い分け / hold frame
- [Secrets of Game Feel and Juice (GameDesign.gg)](https://www.gamedesign.gg/knowledge-base/game-design/game-feel-feedback/secrets-of-game-feel-and-juice/)
- 本作既存: `research/03_juice_research.md §1`（Jonasson/Purho, Vlambeer, Swink, Eiserloh）/ §4 ゴール演出 / §5 横断技法 / §7 teardown

**hypercasual UX / テンポ**
- [Think-Time UX (UX Tigers)](https://www.uxtigers.com/post/think-time-ux) — 400ms 不安閾値 / 200ms pop の意味
- [Hypercasual Games UI/UX Guide (Pixune)](https://pixune.com/blog/hypercasual-games-ui-ux-design-guide/) — 即時フィードバック
- [Voodoo Guide (GameAnalytics)](https://www.gameanalytics.com/blog/voodoo-guide-mobile-game-design-keep-things-simple) — Not punitive / テンポ
- [Happy Glass Design Analysis (Game Developer)](https://www.gamedeveloper.com/design/happy-glass---design-analysis) — インク=星、personality
- [Is Your Hyper-Casual Game Fun? (Supersonic)](https://supersonic.com/learn/blog/is-your-hyper-casual-game-fun-best-practices-for-boosting-retention) — moderation の重要性

**Phaser 4.2 / モバイル particle**
- [Particles | Phaser Help](https://docs.phaser.io/phaser/concepts/gameobjects/particles) / [ParticleEmitter API](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter) — tint[] / gravityY / rotate / lifespan / quantity
- 実 API 検証: `node_modules/phaser/types/phaser.d.ts`（`flash` L4002 / `shake` L4014 / `zoomTo` L4059 / `generateTexture` L29834 / `filters.addGlow` L18742）、`src/gameobjects/particles/`
- [Building a 60FPS WebGL Game on Mobile (Airtight)](https://www.airtightinteractive.com/2015/01/building-a-60fps-webgl-game-on-mobile/) / [Optimizing Particle Effects for Mobile (Unity Learn)](https://learn.unity.com/tutorial/optimizing-particle-effects-for-mobile-applications) — particle budget
- fill-only 制約: `research/08_mobile_quality.md §3`（Phaser #5429 stroke 回帰 / 二重塗り / generateTexture 焼き）

**本作コード（接続点）**
- `src/render/scenes/play/GoalSequence.ts`（5拍 orchestrator）/ `ResultOverlay.ts`（clear shell）
- `src/render/juice/`（`Confetti` / `StarBurst` / `RewardCountUp` / `CommitPop` / `ParticleBurst` / `CameraDirector` / `HapticsRouter`）
- `src/render/ui/`（`theme.ts` 色トークン / `fillShapes.ts` fill-only primitives / `services.ts` AttemptJuice）
- `src/tuning/TuningConstants.ts`（`goal.*` / `camera.traumaGoal` / `audio.bgmDuckDb`）
</content>
</invoke>

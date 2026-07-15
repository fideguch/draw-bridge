# ジュース実装チェックリスト（game_design §4 マンダトリー = 100%）

> 対象: [designs/game_design.md](../designs/game_design.md) §4.1 / §4.2 / §4.3 / §4.4。
> 監査基準（AC-5 / KPI-005 / T096）: **必須（P0）項目は 0 件の DEFERRED**。推奨（P1）/任意（P2）は入るだけ実装し、未実装は理由付きで DEFERRED 可。
> Phase 6 コミット: `feat(juice): goal 5-beat celebration + remaining mandatory juice, tempo E2E (T057-T062, T093)`。
> 検証: vitest 385/385、playwright（自作 4 spec: l1-clear ×2 / meta-flow / tempo）green、tsc/eslint clean、build green。

## サマリ

| 区分 | 件数 | DONE | DEFERRED |
|------|-----:|-----:|---------:|
| 必須 P0（§4.1/4.2/4.3/4.4） | 23 | **23** | **0** |
| 推奨 P1 | 12 | 7 | 5 |
| 任意 P2 | 2 | 0 | 2 |

**必須 23/23 DONE（DEFERRED ゼロ）。**

---

## §4.1 場面1: 線を引く瞬間

| # | 項目 | 優先 | 状態 | 実装 (file:anchor) |
|---|------|------|------|--------------------|
| 1-1 | 入力遅延ゼロ描画（先端は生タッチ） | P0 | DONE | `StrokeInput.onPointerUp`（生 tip を verbatim push）+ `StrokeRenderer.redraw`（同フレーム再描画）|
| 1-2 | 頂点間引き 4-8px | P0 | DONE | `StrokeInput.onPointerMove` → `shouldAppendPoint(draw.minPointDistPx)` |
| 1-3 | 線の太さ/色/丸キャップ/濃色ボーダー | P0 | DONE | `StrokeRenderer`（`draw.lineWidthScreenPct` / `inkZoneColor` / `borderWidthPx` / 頂点ディスク）|
| 1-4 | 描画中ループ音（速度→音量/ピッチ、指停止で停止） | P0 | DONE | `PlayScene.emitDrawJuice`（cadence + tip speed）→ `juice.drawScrub` / `main.ts drawScrub` → `drawScrubModulation` → `SFX.drawLoop` |
| 1-5 | インク残量バー（減少/色帯/点滅/枯渇シェイク+空振り+haptic） | P0 | DONE | `InkBarView`（zone/blink/`playDepletedFeedback` shake）+ `PlayScene.onStrokePoint`（枯渇時 feedback + `uiHaptic`）|
| 1-6 | 線確定ポップ scale 1.0→1.06→1.0 + 確定音 + haptic | P0 | DONE | `PlayScene.commitStroke` → `playCommitPop`（`draw.confirmPopScale/Ms`）; SFX `main.ts strokeCommitted→commitPop`; haptic `HapticsRouter strokeCommitted→confirm` |
| 1-7 | 物理化の視覚合図（線が落下・たわむ） | P0 | DONE | `BridgeRenderer`（方式C: live segment 中心を spline; ばね/角度制限で自然にたわむ）|
| 1-8 | ペン先ダスト 2-5個/フレーム（速度比例） | P1 | DONE | `PlayScene.emitDrawJuice` → `ParticleBurst.emit`（count = 2 + speed×3, `color.inkLine`）|
| 1-9 | 星評価の予告表示 | P1 | DEFERRED | 推奨。インク→星閾値の描画中予告 UI 未実装（残量色帯 1-5 が近似の即時フィードバックを提供）。v1.1 候補。|
| 1-10 | 描画中 continuous ハプティクス | P2 | DEFERRED | 任意。commit/depleted の離散 haptic のみ。continuous パターンは端末負荷検証後に。|

## §4.2 場面2: 車が走り出す瞬間

| # | 項目 | 優先 | 状態 | 実装 (file:anchor) |
|---|------|------|------|--------------------|
| 2-1 | 溜め（非スキップ、レブ音上昇、後傾 squash、車輪空転煙） | P0 | DONE | 非スキップ = engine `anticipationSec`; レブ = `PlayScene.updateRunJuice` → `juice.revTick`; squash = `VehicleRenderer.playAnticipation`（`commitStroke` で発火）; 煙 = `PlayScene.emitWheelSmoke` |
| 2-2 | 解放（ダスト一斉放出、前方 stretch、低域発進音、medium haptic） | P0 | DONE | dust = `PlayScene.emitLaunchDust`（`launch.dustCount`）; stretch = `VehicleRenderer.playRelease`; SFX = `main.ts launchReleased→launchBurst`; haptic = `HapticsRouter launchReleased→launch` |
| 2-3 | カメラ lerp 追従 + look-ahead + 発進キック | P0 | DONE | キック = `PlayScene.attachCameraJuice` → `director.launchKick` + `traumaLaunch`。**追従/look-ahead は SC-003 の「全体一望」設計に基づき静止**（`CameraDirector.follow(centerPx)`）→ 逸脱として下記に明記。|
| 2-4 | 車輪回転 + サスバウンス（実速度同期） | P0 | DONE | `VehicleRenderer.drawWheel`（body 角でスポーク回転）+ 車輪を実 body 位置で描画（サス移動が無料で反映）|
| 2-5 | エンジン音の速度→ピッチ変調 + ギア段付き | P0 | DONE | `PlayScene.updateRunJuice` → `juice.engineHum` → `engineHumModulation`（`engine.gearStep` 量子化）→ `SFX.engineHum` |
| 2-6 | 橋の軋み（(a)音 (b)色 (c)微振動/粉 (d)弱haptic） | P0 | DONE | (a) `main.ts creak→creak` vol/pitch; (b) `BridgeRenderer.stressColor` tint; (c) `PlayScene creak→ParticleBurst`（stress dust @ referencePoint, throttled）; (d) `HapticsRouter creak→creak` |
| 2-7 | コイン取得音 半音上昇 + 取得ポップ + キラ粒子 | P0 | DONE | SFX = `main.ts coinCollected→coinChime` + `SfxPlayer.nextCoinPitch`（半音ladder）; pop/sparkle = `CoinRenderer` |
| 2-8 | 破断時（クラック音 + 破片 + trauma + 折れ口ハイライト） | P0 | DONE | crack = `main.ts break→crack`; 破片 = `PlayScene break→debris.emit`; trauma = `break→traumaCrash`; 折れ口 = `BridgeRenderer.drawTornCap` |
| 2-9 | トラウマ方式 screen shake | P1 | DONE | `CameraDirector`（`trauma²` seeded-noise, `cameraMath`）+ 各 trauma 加算（launch/crash/goal）|
| 2-10 | 速度連動ズームアウト + スピード線 | P1 | DONE (partial) | スピード線 = `PlayScene.updateRunJuice` → `SpeedLines.update(speedLineIntensity)`（>60% 出現）。速度連動ズームアウトは静止カメラ設計により不採用（下記逸脱）。|
| 2-11 | スキッドマーク・permanence | P1 | DEFERRED | 推奨。タイヤ痕/線痕の永続描画は未実装（破片/ダストは寿命フェード）。v1.1 候補。|
| 2-12 | 着地ハプティクス（大ジャンプ後） | P1 | DEFERRED | 推奨。`HapticsRouter.onLanding`（heavy）は実装済だが「大ジャンプ検出」の発火条件は未接続。v1.1。|
| 2-13 | コインのアーチ配置 + haptic 間引き | P1 | DONE | 配置 = レベル JSON オーサリング; haptic 間引き = `HapticsRouter`（`coin.hapticThinning`）|

## §4.3 場面3: ゴール（5拍構成、全体3-4秒・スキップ可）

| # | 項目 | 優先 | 状態 | 実装 (file:anchor) |
|---|------|------|------|--------------------|
| 3-1 | hit-stop 80-120ms（拍1） | P0 | DONE | `TimeScaleController.goalCelebration` → `makeGoalTimeScalePlan(goal.hitStopMs)`; `GoalSequence.start` |
| 3-2 | スローモーション 0.3 + fixedDelta連動 + カメラ 15-25% ズームイン（拍2） | P0 | DONE | `TimeScaleController.update`（scaled delta → `sim`）; `PlayScene onScaleChange` → `slowMoZoom` → `director.zoomTo`; 復帰時 `setZoomImmediate(1)` |
| 3-3 | Confetti 2段（2門キャノン + 0.3s遅延レイン、pop×2 50ms差、heavy haptic）（拍3） | P0 | DONE | `GoalSequence.fireConfetti` → `ConfettiCelebration`（cannons+rain）; `juice.goalConfettiPop`（pop SFX + side0 heavy haptic）|
| 3-4 | 星の順次出現（250ms間隔、pop、C-E-Gアルペジオ、3つ目シンバル、haptic漸増）（拍4） | P0 | DONE | `GoalSequence` `StarBurstView.showStars(onBeat)`; `juice.goalStarBeat`（`SFX.starC/E/G` + 3rd `SFX.cymbal` + `HapticsRouter.starBeat` 漸増）|
| 3-5 | 報酬カウントアップ（tick pitch 1.0→1.3、タップ即スキップ）（拍5） | P0 | DONE | `GoalSequence.startReward` → `RewardCountUp`; `juice.goalCountTick`; `GoalSequence.skip` → `countUp.skip()` |
| 3-6 | コインバースト→回収（半音チン音 + カウンターパンチ）（拍5） | P0 | DONE | `GoalSequence.startReward` → `CoinBurstFlight.burst`; onArrive → `juice.goalCoinArrive` + `overlay.punchCoinCounter` |
| 3-7 | Next ボタン 1.5-2.5s 後活性 + 脈動 | P0 | DONE | `GoalSequence.revealPanel` → `schedule(goal.nextActivateDelaySec)` → `overlay.activateNext`（pulse）。**tempo E2E で計測検証**（`resultNextReady` 窓 ∈ [1.5, 2.5]s）|
| 3-8 | BGM ダッキング -6..-9dB | P0 | DONE | `juice.duckBgm/unduckBgm` → `AudioBus.duck/unduck`（`audio.bgmDuckDb`）; `GoalSequence.start` duck / `startReward.onDone` unduck |

## §4.4 横断規則

| # | 項目 | 優先 | 状態 | 実装 (file:anchor) |
|---|------|------|------|--------------------|
| X-1 | ハプティクス端末対応チェック（areAllPrimitivesSupported + fallback + 設定OFF） | P0 | DONE | platform 層（`WebHaptics`/`CapacitorHaptics`, T056）+ `HapticsRouter` 設定ゲート |
| X-2 | hit-stop 頻度制限 1-2回/レベル | P0 | DONE | `TimeScaleController`（`HIT_STOP_MAX_PER_ATTEMPT` budget, `resetBudget`）; goal/crash が予算を共有 |
| X-3 | 全演出スキップ可 + 失敗最軽量 | P0 | DONE | skip = `GoalSequence.skip`（全画面 tap-catcher + scrim）; fail = `PlayScene.showFailWithCause`（暗転 + 短い sad SFX + hit-stop なし + 高速 Retry）|
| X-4 | SE のピッチランダム化 ±5% + 同時発音≤3 | P0 | DONE | `SfxPlayer.rollPitch`（`draw.pitchRandomPct`）+ `AudioBus.acquireVoice`（`audio.maxSameSfxVoices`）|

---

## 逸脱・設計判断

1. **カメラ追従/look-ahead/速度ズームアウトの不採用（2-3 / 2-10）**
   本作は SC-003「解くべき地形が一目で読める」を満たすため、アタック全体を **静止フレーム（zoom 1、`WorldToPixel` に framing を焼き込み）** で提示する（`levelFraming` header 参照）。走行中に車を追従・ズームアウトすると全体一望が崩れ、かつ dev-hook の world↔screen 逆写像（E2E 契約）の厳密性が失われる。したがって発進キック/trauma shake（2-3/2-9）は採用しつつ、lerp 追従・look-ahead・速度ズームアウトは意図的に静止とした。**マンダトリー 2-3 のコア（発進キック）は DONE**、追従はレベル設計上不要。

2. **ゴール slow-mo のカメラズーム vs dev-hook 制約の解法（3-2）**
   セカンドカメラを追加せず、**メインカメラ 1 台をヒットストップ/スローモー窓の間だけズーム**し、結果パネル表示の瞬間に `setZoomImmediate(1)` で厳密に zoom 1 へ復帰させる（Next 活性・`setDevPlayState('result')` の前）。パネル/星/コイン飛行など screen 空間 UI は常に zoom 1 でのみ描画されるため歪まず、world 空間の演出（confetti / coin-burst 起点）はズーム窓中に world-pixel 空間で配置してカメラに正しくズームさせる。詳細は `GoalSequence.ts` header に明記。tempo E2E がスキップ性・Next 窓・ループ時間を実測で検証。

3. **連続音（1-4 / 2-5）の実装方式**
   専用ループボイスを増設せず、短い合成バッファ（`SFX.drawLoop` / `SFX.engineHum`）を cadence で再トリガし、速度連動の volume/pitch を都度付与する（NFR-013 program-first、既存 `SfxPlayer` を再利用）。マッピングは pure（`audioMath.drawScrubModulation` / `engineHumModulation`、headless test 済）。実サウンド差し替え時は数値のみ調整。

## 実装追加ファイル（Phase 6）

- `src/render/scenes/play/GoalSequence.ts`（T060 オーケストレータ）
- `src/render/juice/ParticleBurst.ts`（pen dust / launch smoke / break debris / creak dust）
- `src/render/juice/SpeedLines.ts`（スピード線 + pure `speedLineIntensity`）
- `src/render/juice/CommitPop.ts`（線確定ポップ）
- `src/render/audio/audioMath.ts`（`drawScrubModulation` / `engineHumModulation` / `rateToSemitones`）
- `src/render/audio/SfxSynth.ts`（`engineHum` / `cymbal` 追加）
- `tests/e2e/tempo.spec.ts`（T093 テンポ契約）

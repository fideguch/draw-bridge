# 03. ゲームフィール（Juice）徹底リサーチ — 「脳汁が出る」瞬間の設計

> 対象: 線を引いて車を走らせる物理ゲーム（Draw Bridge系）
> 調査日: 2026-07-07 / 調査者: ゲームフィール研究エージェント
> 目的: 「線を引く」「車が走り出す」「ゴール」の3場面で脳汁を出す技法を、実装可能なパラメータ付きチェックリストに落とす

---

## 0. エグゼクティブサマリー

- **Juice の定義**: 「動くゲームの上に載せる、ゲームプレイを変えない快感の層」。Juice it or Lose it 曰く「小さなディテール、驚きと喜びの小さな瞬間の積み重ね」であり、単体で劇的な効果を持つ技法は無い。**30個の小技を重ねる**ことで初めて別物になる（確度: 高）。
- **Draw Bridge系での最重要3点**:
  1. **描画は入力遅延ゼロ＋音とパーティクルの「随伴フィードバック」**（Swink の real-time control 原則）
  2. **走り出しは anticipation（溜め）→ release（解放）の非対称設計**。溜め 0.3〜0.5s、解放時にカメラキック＋ダスト＋ハプティクス
  3. **ゴールは hit-stop（50〜100ms）→ スローモーション（timeScale 0.3 を実時間 0.3〜0.5s）→ confetti → 段階的星評価 → カウントアップ → 2〜3秒以内に次へ** の固定シーケンス
- **音の黄金律**: 繰り返し音はピッチを±5〜10%ランダム化。連続回収（コイン/コンボ）は**半音ずつ上昇**させ、途切れたらリセット（確度: 高）
- **ハプティクスの黄金律**: 頻発イベントは極小（tick）、節目は中〜大（impact）。iOSは `UIImpactFeedbackGenerator` + `prepare()`、Androidは `VibrationEffect.Composition` のプリミティブを使い、未対応端末フォールバックを必ず用意（確度: 高）
- **ハイパーカジュアルのテンポ律**: 1レベル10〜30秒、リトライ/次レベルへの遷移は最短化。「演出は豪華に、拘束時間は最短に」が鉄則（確度: 中〜高）

---

## 1. 理論的基盤 — 4つの一次ソース

### 1.1 "Juice it or Lose it"（Martin Jonasson & Petri Purho, 2012）

灰色の Breakout クローンに1つずつ juice を追加していくライブデモ。追加された技法の系譜（確度: 高）:

| 技法 | 内容 |
|---|---|
| Tweening | すべての動きにイージング。線形移動を廃止 |
| Color | パレット導入。ブロックごとに色 |
| Sound | ヒット音。**再生ごとにピッチをランダム変化**させ単調さを回避 |
| Music | レイヤードBGM（進行に応じて重ねる） |
| Particles | ブロックが数十個の色付き破片に爆散 |
| Screen shake | ヒット時に画面を揺らす |
| Ball trail / stretch | ボールに軌跡、進行方向に伸びる（stretch） |
| 目玉（personality） | ボールとブロックに目を付けるだけで愛着が生まれる |
| Screen flash / over-scale | 破壊時の白フラッシュ、一瞬の過剰スケール |

**教訓**: juice は「すでに動くゲームの上に足すもの」であり、ゲームの成立に依存させない。1つ1つは地味でも、**全部載せると全く別の体験になる**。

- 出典: [GDC Vault](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose) / [YouTube](https://www.youtube.com/watch?v=Fy0aCDmgnxg) / [juicy-breakout ソースコード (grapefrukt)](https://github.com/grapefrukt/juicy-breakout) / [解説記事 (Fid)](https://cobble.games/wise-inspiring-smart/game-design/juice-it-or-lose-it) / [デモ再実装 (Longwelwind)](https://longwelwind.net/blog/juice-it/)

### 1.2 "The Art of Screenshake"（Jan Willem Nijman / Vlambeer, 2013）

退屈な横スクロールシューターに約30個の小技を加えるデモ。Draw Bridge系に転用可能な要点（確度: 高）:

| # | 技法 | Draw Bridge への転用 |
|---|---|---|
| 1 | 基本アニメ＋音（土台） | 車輪回転、走行音 |
| 2 | **Camera lerp**（カメラは対象を遅れて滑らかに追う） | 車追従カメラの補間 |
| 3 | Camera position（進行方向に寄せる＝look-ahead） | 車の前方をより多く見せる |
| 4 | Screen shake | 着地・衝突・ゴールで使用 |
| 5 | **Sleep（hit-stop）**: 「致命的ヒットに 100〜200ms のスリープを入れると行為に意味が宿る」 | ゴールテープ接触・大クラッシュ時 |
| 6 | Impact effect（衝突点にエフェクト） | 車輪と線の接触スパーク |
| 7 | Kickback / knockback | 発進時に車体が後ろに沈む |
| 8 | **Permanence（痕跡を残す）** | 描いた線・スキッドマーク・破片を残す |
| 9 | Bass（低音を足す） | 発進音・着地音に低域レイヤー |
| 10 | Muzzle flash 的な「初回フレームだけ強調」 | 発進の最初の1フレームにフラッシュ |

- 出典: [講演書き起こし (Engineering of Conscious Experience)](https://theengineeringofconsciousexperience.com/jan-willem-nijman-vlambeer-the-art-of-screenshake/) / [技法まとめ (artificials.ch)](https://artificials.ch/game-feeling/) / [Game Developer 記事](https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)

### 1.3 "Game Feel"（Steve Swink, 2008）

- Game Feel = **「シミュレートされた空間内の仮想オブジェクトのリアルタイム制御を、polish で強調したもの」**。3要素: ①リアルタイム制御 ②物理的相互作用のある空間 ③シミュレーションを変えない polish（確度: 高）
- リアルタイム制御の2原則: **予測可能な結果**（プレイヤーの行動に期待通りの応答）と**即時応答**（応答が「即座」と感じられること）。人間が「即時」と知覚する応答閾値は一般に **50〜150ms（目安100ms）** とされる（書籍の枠組み＋一般的知覚研究。閾値数値の帰属は確度: 中）
- Draw Bridge への含意: **指のドラッグと線の描画の間に1フレームの遅延も入れない**こと自体が最大の juice。描画のスムージング処理は「見た目は滑らか、先端は指に吸い付く」形で行う
- 出典: [Game Feel (Internet Archive)](https://archive.org/details/gamefeelgamedesi0000swin) / [書評 (Liz England)](https://lizengland.com/blog/review-game-feel-by-steve-swink/) / [Game feel (Wikipedia)](https://en.wikipedia.org/wiki/Game_feel) / [学術サーベイ "Designing Game Feel"](https://arxiv.org/pdf/2011.09201)

### 1.4 "Math for Game Programmers: Juicing Your Cameras With Math"（Squirrel Eiserloh, GDC 2016）

トラウマ方式スクリーンシェイクの原典（確度: 高）:

- **shake = trauma²**（または trauma³）。trauma は 0〜1 のスカラーで、イベント発生時に加算し、時間で線形減衰させる
- 揺れの生成は**乱数ではなく Perlin ノイズ**を使う（滑らかで、ポーズ/スローモーションと自然に整合し、周波数調整でき、リプレイ再現可能）
- 2Dでは **平行移動＋回転** の両方を揺らす。`angle = maxAngle * shake * noise(seed1, t)`、`offsetX = maxOffset * shake * noise(seed2, t)`、`offsetY = maxOffset * shake * noise(seed3, t)`
- 出典: [講演スライドPDF](http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf) / [archive.org 全文](https://archive.org/stream/GDC2016Eiserloh/GDC2016-Eiserloh_djvu.txt) / [トラウマ方式解説 (Borderline Blog)](http://blog.borderline.games/tutorials/gettinghit!/trauma-based-screenshake.html) / [Bevy 公式実装例](https://bevy.org/examples/camera/2d-screen-shake/) / [Unity実装 (Roystan)](https://roystan.net/articles/camera-shake/)

---

## 2. 場面1: 線を引く瞬間の手触り

> 設計思想: 描画はこのゲームの「操作の快感」の心臓部。Swink の即時応答原則がすべてに優先する。juice は「指の動きが世界に刻まれている」感覚を増幅する方向に足す。

### 2.1 線の描画そのもの（インクの表現）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 入力遅延ゼロ描画 | タッチ座標を同フレームで反映。スムージング（Catmull-Rom / 移動平均）は**過去点にのみ**適用し、先端は生タッチ座標に固定 | **必須** | 高（Swink原則からの導出） |
| 頂点間引き | 最小点間距離 4〜8px で頂点追加（物理コスト削減と滑らかさの両立） | **必須** | 中（実装慣行） |
| 線の太さ | 画面幅の 2〜3%（375pt幅で 8〜12pt）。丸キャップ・丸ジョイント。指で隠れても見える太さ | **必須** | 中 |
| 線の色 | 背景と高コントラストの単色＋わずかな外周の濃色ボーダー（1〜2px）で「描いた物体感」を出す | **必須** | 中 |
| 描画中の線の生命感 | 描いている間、線先端に半径=線幅1.2倍の丸カーソル。線全体をごくわずかに脈動（scale 1.00→1.02、周期0.5s）させると「まだ乾いていないインク」感 | 任意 | 低（提案） |
| インクのテクスチャ | クレヨン/マーカー風のテクスチャブラシ、端に僅かなにじみ。Happy Glass 系は均一線でも成立するため装飾扱い | 任意 | 中 |

### 2.2 描画音（最重要の随伴フィードバック）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| ペン/マーカーのループ音 | 描画中のみ再生するループSFX（pencil/marker scribble）。開始/停止に 30〜50ms のフェードを入れクリックノイズ回避 | **必須** | 高（フォーリー素材の標準運用） |
| 速度→音のマッピング | 描画速度に応じて音量 0.3→1.0、ピッチ 1.0→1.2 を連続変化。**指が止まったら音も止まる**（随伴性が快感の源） | **必須** | 中（速度マッピングは実装慣行） |
| ピッチランダム化 | ストローク開始ごとに基準ピッチを ±5% ランダム化 | 推奨 | 高（Juice it or Lose it / Power of Pitch Shifting） |

- 出典: [The Power of Pitch Shifting (Game Developer)](https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting) / 素材例: [Zapsplat pencil pack](https://www.zapsplat.com/sound-effect-packs/pencil-sound-effects/), [Pixabay drawing SFX](https://pixabay.com/sound-effects/search/drawing/)

### 2.3 描画パーティクル

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| ペン先ダスト | 先端から 2〜5個/フレーム（速度比例）、寿命 0.2〜0.5s、サイズ 2〜6px、線と同色→透明へフェード、僅かに重力落下 | 推奨 | 中（「頻繁なアクションほど juice はシンプルに」原則） |
| インク飛沫 | 高速描画時（閾値超）のみ、進行方向逆側に小さな飛沫 | 任意 | 低 |

### 2.4 描き終わりのフィードバック（線が「物体になる」瞬間）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 確定ポップ | 指を離した瞬間、線全体を scale 1.0→1.06→1.0（計 120ms、ease-out-back）。または線幅を 1.15倍→1.0 に 100ms で戻す | **必須** | 中（over-scale の応用） |
| 確定音 | 短い「コトッ/ポンッ」（50〜120ms）。描画ループ音の停止と同時に再生 | **必須** | 中 |
| 確定ハプティクス | iOS: `UIImpactFeedbackGenerator(.light)`（事前に `prepare()`）/ Android: `PRIMITIVE_TICK`（scale 0.6） | **必須** | 高（プラットフォームガイドライン） |
| 物理化の視覚合図 | 確定と同時に線がわずかに落下・たわむ（物理有効化そのものが演出になる）。影を落とす | 推奨 | 中 |
| 描画中ハプティクス | iOS: `CHHapticEngine` の continuous（intensity 0.2〜0.35, sharpness 0.3）を描画速度で変調 / Android: `LOW_TICK` を 30〜60ms 間隔で発火。**「頻発イベントは極小に」**（Android公式原則） | 任意 | 高（API仕様・原則）/ 中（数値） |

### 2.5 インク残量表示

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 残量バー | 画面上部 or ペン先付近に残量バー。描画中はリアルタイム減少（描いた線の長さに比例） | **必須** | 高（Happy Glass 等の定番） |
| 色による警告 | 残量 >50%: 緑 / 20〜50%: 黄 / <20%: 赤＋バー点滅（周期 300ms） | 推奨 | 中 |
| 枯渇フィードバック | 残量ゼロで描画が止まる瞬間: 「カスッ」という空振り音＋バーを横シェイク（振幅 4〜6px、150ms）＋ Android `EFFECT_DOUBLE_CLICK` / iOS `.notificationOccurred(.warning)` | 推奨 | 中 |
| インク＝スコア設計 | Happy Glass は「少なく描くほど星が多い」でインクを**スコア資源化**し、リプレイ動機を作った。星評価とインク残量を連動させる設計は本ゲームでも有効 | 推奨 | 高（Happy Glass 分析） |

- 出典: [Happy Glass Design Analysis (Game Developer)](https://www.gamedeveloper.com/design/happy-glass---design-analysis) / [Happy Glass 分析 (Olin Olmstead)](https://medium.com/@olinolmstead/happy-glass-game-design-analysis-3700b0186066)

---

## 3. 場面2: 車が走り出す瞬間の爽快感

> 設計思想: **anticipation（溜め）→ release（解放）**。アニメーション12原則の anticipation は「大きな動きの前に逆方向の小さな動きを入れる」こと。溜めが長いほど解放が気持ちいいが、ハイパーカジュアルでは 0.3〜0.5s が上限。

### 3.1 Anticipation → Release の設計

| フェーズ | 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|---|
| 溜め | エンジン回転上昇音 | 発進 0.3〜0.5s 前からアイドル音→レブ音へピッチ上昇（1.0→1.4） | **必須** | 中 |
| 溜め | 車体の後傾スクワッシュ | 車体を後方に 5〜8° 傾け、縦 0.92 / 横 1.08 に squash（0.2s、ease-in） | 推奨 | 高（squash&stretch 原則、値は GameMaker 公式 docs の 1.3/0.7 系を弱めた推奨値） |
| 溜め | 車輪の空転＋後方に小石/煙 | 車輪回転のみ先行開始、接地点から後方へ煙 5〜10個/フレーム | 推奨 | 中 |
| 解放 | 発進バースト | ダストパーティクル 10〜20個を一斉放出＋車体が前方に stretch（横 1.15 / 縦 0.9、100ms で 1.0 に復帰、ease-out） | **必須** | 中 |
| 解放 | 発進音 | 低域を効かせたバースト音（Vlambeer「bass を足せ」）＋タイヤスキール | **必須** | 高（原則）/ 中（構成） |
| 解放 | 発進ハプティクス | iOS `.impactOccurred(.medium)` / Android `PRIMITIVE_THUD` or `EFFECT_CLICK` | **必須** | 高 |
| 解放 | カメラキック | 発進方向と逆に 8〜16px のカメラパンチ→ 0.3s で復帰（後述の trauma 0.15〜0.2 加算でも可） | 推奨 | 中 |

- 出典: [The 12 Principles of Animation in Video Games (Game Anim)](https://www.gameanim.com/2019/05/15/the-12-principles-of-animation-in-video-games/) / [Juicing Your Movements (GameMaker/Amazon)](https://developer.amazon.com/docs/gamemaker/juicing-your-movements.html)

### 3.2 カメラワーク（走行中）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| Camera lerp 追従 | カメラ位置を毎フレーム `lerp(cam, target, 0.08〜0.15)`（60fps基準）。車に硬直追従させない | **必須** | 高（Vlambeer trick #2） |
| Look-ahead | 注視点を車の進行方向へ車体 1〜2台分オフセット（速度に比例して増加）。「これから起こること」を見せる | **必須** | 高（Vlambeer trick #3） |
| 速度連動ズームアウト | 速度 0→最高速で orthographic size / FOV を +10〜20%（0.5s の ease で連続変化）。速度感と視界確保を両立 | 推奨 | 中（レーシングゲームの dynamic FOV 慣行） |
| 着地・衝突シェイク | trauma 方式（§5.2）。小衝突 trauma+=0.2、大クラッシュ +=0.5 | 推奨 | 高（方式）/ 中（値） |

- 出典: [FOVと速度感の議論 (LFS Forum)](https://www.lfs.net/forum/thread/27179-FOV---Sense-of-Speed) / [Speed Sensation mod (OverTake)](https://www.overtake.gg/downloads/speed-sensation.75016/)

### 3.3 スピード表現（視覚）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| スピード線/風パーティクル | 速度が最高速の 60% 超で画面端に流線パーティクル出現。速度に比例して数と長さ増加 | 推奨 | 中 |
| 車体トレイル | 車の残像/軌跡。ただし Juice研究では「トレイルは逆に遅く見せることがある」との指摘あり → 短め（0.1〜0.2s分）に留める | 任意 | 中（GameAnalytics 記事の注意点） |
| スキッドマーク（permanence） | 急加速・着地点にタイヤ痕を残す。描いた線も消さない。「痕跡を残す」は Vlambeer の核心 trick | 推奨 | 高 |
| 車輪の回転＋バウンス | 車輪回転速度を実速度と同期。サスペンションの上下バウンス（Hill Climb Racing の「バウンシーで浮遊感ある物理」が愛される理由） | **必須** | 高 |

### 3.4 エンジン音・加速感（聴覚）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 速度→ピッチのエンジンループ | エンジンループのピッチを速度で 1.0→1.5 に連続変調。ギアチェンジ風の段付き（0.25刻みでピッチを一瞬落として上げ直す）を入れると加速感が増す | **必須** | 中 |
| 空中/接地の音変化 | ジャンプ中はエンジン音のローパス＋風切り音、着地で「ドンッ」＋低域 | 推奨 | 中 |
| アップグレード連動音 | Hill Climb Racing は「エンジン強化後にだけターボ音が鳴る」ことで成長を音で体感させた。車強化要素を入れるなら音も強化する | 任意 | 高（HCR分析） |

- 出典: [Hill Climb Racing (Wikipedia)](https://en.wikipedia.org/wiki/Hill_Climb_Racing) / [Hill Climb Racing 紹介 (Softonic)](https://hill-climb-racing.en.softonic.com/)

### 3.5 ハプティクス（走行中）

| イベント | iOS | Android | 優先度 | 確度 |
|---|---|---|---|---|
| 発進 | `UIImpactFeedbackGenerator(.medium)` | `PRIMITIVE_THUD`（scale 0.8） | **必須** | 高 |
| 走行中の路面感 | `CHHapticEngine` continuous、intensity 0.1〜0.25 を速度で変調（連続ハプティクスの上限は30s） | `PRIMITIVE_LOW_TICK` を速度比例間隔（40〜120ms）で連打 | 任意 | 高（API仕様）/ 中（数値） |
| 着地 | `.impactOccurred(.heavy)`（大ジャンプ後のみ） | `PRIMITIVE_THUD`（scale 1.0） | 推奨 | 高 |
| 注意 | 毎フレーム振動は不快＋電池消費。**「頻発イベントは極小、節目は明確に」**（Android 公式原則）。設定でOFF可能にする | 同左＋`areAllPrimitivesSupported()` で対応確認し、非対応なら `EFFECT_CLICK`/waveform にフォールバック | **必須** | 高 |

- 出典: [Haptics design principles (Android公式)](https://developer.android.com/develop/ui/views/haptics/haptics-principles) / [Android haptics API reference](https://developer.android.com/develop/ui/views/haptics/haptics-apis) / [Custom haptic effects (Android公式)](https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects) / [Core Haptics ガイド (Medium/Maksim Po)](https://medium.com/@mi9nxi/haptic-feedback-in-ios-a-comprehensive-guide-6c491a5f22cb) / [Apple platforms haptics 開発者ガイド (Eidinger)](https://blog.eidinger.info/haptics-on-apple-platforms) / [Updating haptics in real time (Apple公式)](https://developer.apple.com/documentation/CoreHaptics/updating-continuous-and-transient-haptic-parameters-in-real-time)

### 3.6 コイン回収（ピッチ上昇 — 脳汁の核）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| **連続回収でピッチ半音上昇** | コイン取得音を連続取得ごとに **+1 semitone**（pitch ×1.0595 ずつ）。「半音はシーケンスとして最も自然なステップ」。上限 +12 semitone（1オクターブ）でループ or 維持。**1〜1.5s 取得が途切れたらリセット** | **必須** | 高（The Power of Pitch Shifting） |
| コイン取得の視覚 | コインを scale 1.0→1.3→0（計150ms）でポップ消滅＋キラ粒子 4〜8個。取得順にコンボ数字を小さく表示（+1, +2, ...） | **必須** | 中 |
| コインのフライング演出 | 取得コインのスプライトが画面上部のカウンターへ 0.4〜0.6s（ease-in-quad）で飛ぶ（Temple Run 等の定番）。カウンター到達時にカウンター自体を scale 1.0→1.2→1.0（100ms）でパンチ | 推奨 | 高（定番手法） |
| コイン取得ハプティクス | iOS `.impactOccurred(.light)` or `selectionChanged()` / Android `PRIMITIVE_TICK`（scale 0.4）。**連続取得時は間引く（2〜3枚に1回）** | 推奨 | 高（原則）/ 中（間引き値） |
| コイン配置 | アーチ状・波状に並べ、取ること自体がリズムになる配置（等間隔 0.1〜0.2s で取れる間隔） | 推奨 | 中 |

- 出典: [The Power of Pitch Shifting (Game Developer)](https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting) / [コインフライ実装 (Medium/Trisledinh)](https://medium.com/@trisledinh/unity-how-to-create-effect-coin-fly-in-less-than-15-minutes-9a2e7f72aff2)

---

## 4. 場面3: ゴール演出

> 設計思想: ゴールは「達成の切断面」。**時間操作（hit-stop→スロー）→ 爆発（confetti/コイン）→ 評価（星）→ 報酬（カウントアップ）→ 即・次へ** の5拍構成。全体で3〜4秒、スキップ可能にする。

### 4.1 時間演出（スローモーション + hit-stop）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| ゴール瞬間の hit-stop | ゴールテープ接触フレームで **50〜100ms（60fpsで3〜6フレーム）の完全停止**。Vlambeer は致命的ヒットに 100〜200ms を推奨 → ゴールは 80〜120ms が目安 | 推奨 | 高（Vlambeer / Capcom分析） |
| スローモーション | hit-stop 直後に `timeScale = 0.3` へ即時変更、**実時間 0.3〜0.5s 維持**、その後 0.2〜0.3s かけて 1.0 へ lerp 復帰。Unity では `Time.fixedDeltaTime = 0.02f * timeScale` も同時に設定（物理のカクつき防止） | **必須** | 高（Unity公式 API）/ 中（維持時間） |
| スロー中のカメラズーム | 車へ 15〜25% ズームイン（0.3s、ease-out）。復帰時にズームバック | 推奨 | 中 |
| スロー中の音 | BGMにローパスフィルタ＋ピッチ 0.8、SFXはスロー対象外（「テープを切る音」は等倍で鳴らす） | 任意 | 中 |

- 出典: [Time.timeScale (Unity公式)](https://docs.unity3d.com/ScriptReference/Time-timeScale.html) / [In-game time and real time (Unity Manual)](https://docs.unity3d.com/6000.3/Documentation/Manual/time-scale.html) / [Hitstop in Unreal Engine (Cobra Code)](https://medium.com/@cobracode/hitstop-in-unreal-engine-cbe85a907728) / [Hitstop in Capcom Beat 'Em Ups (Shane Sicienski)](https://shane-sicienski.com/blog/blog-post-title-one-55pmn) / [Hit Stop (TV Tropes)](https://tvtropes.org/pmwiki/pmwiki.php/Main/HitStop)

### 4.2 Confetti（紙吹雪）

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 2段構成 | ①ゴール地点から左右2門のキャノン（各 40〜60個、初速は斜め上 45〜70°、拡散 30°）②0.3s 遅れて画面上部から降下レイン（60〜100個、2〜3s） | **必須** | 中（定番構成の推奨値） |
| 紙片の挙動 | 長方形紙片（4×8px 前後）を回転（角速度ランダム ±720°/s）＋ひらひら（横方向に sin 揺れ）、重力は弱め（実重力の 0.2〜0.4）、寿命 2〜3s でフェード | 推奨 | 中 |
| 色 | 5〜6色のビビッドパレット（ゲームのアクセントカラー含む） | 推奨 | 中 |
| 発射音 | 「ポンッ」×2（左右で 50ms ずらす）＋ハプティクス `.heavy` / `PRIMITIVE_THUD` | 推奨 | 中 |

- 実装参考: [confetti (Flutter package)](https://fluttergems.dev/packages/confetti/)（blastDirection, emissionFrequency, numberOfParticles, gravity 等のパラメータ構造が参考になる）

### 4.3 コインバースト

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| バースト→回収 | 獲得コイン 10〜30枚を車/宝箱から放射状に爆発（初速ランダム、0.3s で減速）→ 各コインが **20〜40ms ずつずれて** カウンターへ飛ぶ（各 0.4〜0.6s、ease-in） | 推奨 | 高（定番手法）/ 中（値） |
| 到達音のピッチ上昇 | コインがカウンターに到達するたび「チン」を **半音ずつ上昇** で再生（§3.6と同じ系）。カウンターは到達ごとに scale パンチ | **必須** | 高（手法）/ 中（適用） |

### 4.4 星評価

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| 順次出現 | 星を1つずつ **200〜300ms 間隔**で表示。各星は scale 0→1.3→1.0（250ms、ease-out-back）＋着地時に小さな衝撃波リング | **必須** | 中（定番構成） |
| 音の上昇アルペジオ | 星1・2・3で「ド・ミ・ソ」等のメジャーアルペジオ（各+4, +3 semitone）。3つ目だけ豪華に（シンバル/キラキラ追加） | **必須** | 中（半音上昇原理の応用） |
| ハプティクスの漸増 | 星1: `.light` → 星2: `.medium` → 星3: `.heavy`＋confetti 追加噴射 | 推奨 | 中 |
| 星の基準 = インク残量 | 「使ったインクが少ないほど星が多い」（Happy Glass 方式）。演出とリプレイ動機を直結させる | 推奨 | 高（Happy Glass 分析） |

### 4.5 報酬カウントアップ

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| カウントアップ | 0→獲得額を **0.8〜1.5s** でカウント（ease-out: 最初速く最後ゆっくり）。1増分ごとではなく毎フレーム補間値を表示 | **必須** | 中（スロットカウンター系実装の標準） |
| チック音 | カウント中 30〜60ms 間隔でチック音（ピッチをカウント進行で 1.0→1.3 に上昇）。完了時に「ジャジャン」＋最終額を scale パンチ | 推奨 | 中 |
| スキップ | タップで即座に最終値へ。**演出がテンポを殺してはならない** | **必須** | 高（HC鉄則） |

- 実装参考: [react-slot-counter](https://github.com/almond-bongbong/react-slot-counter)（duration/delay/方向などのAPI設計が参考）

### 4.6 次レベルへのテンポ

| 技法 | 具体パラメータ | 優先度 | 確度 |
|---|---|---|---|
| リザルト滞在時間 | 演出完了→「Next」ボタン活性化まで **1.5〜2.5s**。ボタンは脈動（scale 1.0↔1.05、周期 0.8s）で誘導 | **必須** | 中 |
| 失敗時は超高速 | 失敗→リトライは **1s 以内**・ワンタップ（or 自動）。「Not punitive（罰しない）」は Voodoo の設計原則。失敗演出は軽く（暗転＋短い残念音のみ、長い死亡アニメ禁止） | **必須** | 高（Voodoo原則） |
| セッション設計 | 1レベル 10〜30秒 が HC の標準。ゴール演出込みでもループ1周を〜40秒に収める | 推奨 | 中 |
| 進捗の見える化 | リザルトに「レベル進捗バー」や「次の報酬まであとN」を置き、即・次へ行く理由を作る | 推奨 | 中 |

- 出典: [A Voodoo Guide To Game Design (GameAnalytics)](https://www.gameanalytics.com/blog/voodoo-guide-mobile-game-design-keep-things-simple) / [5 Ways Voodoo Dominates (Deconstructor of Fun)](https://www.deconstructoroffun.com/blog/2018/8/1/5-ways-voodoo-dominates-the-hyper-casual-market) / [Casual Game Loops (GDevelop)](https://gdevelop.io/blog/casual-game-loops) / [Kwalee: How to Make a Game in Two Days](https://www.kwalee.com/blog/gamedev/how-to-make-a-game-in-two-days)

---

## 5. 横断技法リファレンス（詳細パラメータ）

### 5.1 Hit-stop（sleep / freeze frame）

- 軽い衝撃: **50〜100ms（3〜6フレーム@60fps）** / 重い・致命的: **100〜200ms**（Vlambeer）。0.2s は「重い」演出の出発点（Unreal 記事）
- 実装は「全停止」より「関係オブジェクトのみ停止」が上質（Capcom 方式）。ただし HC では全停止で十分
- 多用禁止。1レベルに1〜2回（ゴール・大クラッシュ）が上限
- 確度: 高

### 5.2 Screen shake（トラウマ方式）

```
trauma ∈ [0,1]、イベントで加算、毎秒 1.0〜1.5 で線形減衰
shake = trauma²
offsetX = maxOffsetX * shake * perlin(seed1, t*freq)   // maxOffset: 画面幅の2〜4%（〜16-30px）
offsetY = maxOffsetY * shake * perlin(seed2, t*freq)
angle   = maxAngle  * shake * perlin(seed3, t*freq)    // maxAngle: 5〜10°
freq: 15〜25Hz 相当
```

- イベント別 trauma 加算の目安（本ゲーム向け提案、確度: 中）: 発進 0.15 / 着地 0.2〜0.3 / クラッシュ 0.5 / ゴール 0.4
- Perlin ノイズ必須（乱数はガタつく・スローと整合しない）。確度: 高（方式は Eiserloh 原典）

### 5.3 Squash & Stretch / イージング

- 標準値: **squash = (1.3, 0.7)、控えめなら (1.2, 0.8)、体積保存**（x×y ≈ 一定）。復帰は 100〜150ms、ease-out
- イージング使い分け（GameAnalytics）: **画面に入る/止まる → ease-out**、**動き出す/画面から出る → ease-in**、遊び心 → back/elastic。UI は 150〜300ms、ゲーム内オブジェクトは 100〜200ms が目安（確度: 中）
- 「hold frame（1〜3フレーム保持）」でインパクトを強調（GameAnalytics）

### 5.4 サウンド設計原則

1. **繰り返し音はピッチランダム化 ±5〜10%**（単調さの回避、Juice it or Lose it 由来）
2. **連鎖はピッチ半音上昇**（コンボ長の可聴化＋満足度増、Power of Pitch Shifting）
3. **重要イベントに低域（bass）を足す**（Vlambeer）
4. **BGMはレイヤー構造**: ベースループ＋走行中レイヤー＋ゴール時スティンガー。ゴール瞬間は BGM をダッキング（-6〜-9dB、0.2s）して SFX を立てる（確度: 中）
5. すべてのプレイヤー操作に音を対応させる（描く・確定・発進・回収・ゴール）— 「gameplay 関連の音はフルボディで明瞭に」（GameAnalytics）

### 5.5 ハプティクス実装マップ

| イベント | iOS | Android (API 30+) | Android フォールバック |
|---|---|---|---|
| 線確定 | `UIImpactFeedbackGenerator(.light)` + `prepare()` | `PRIMITIVE_TICK` (scale 0.6) | `EFFECT_TICK` |
| 発進 | `.medium` | `PRIMITIVE_THUD` (0.8) | `EFFECT_CLICK` |
| コイン | `.light` / `selectionChanged()`（間引き） | `PRIMITIVE_TICK` (0.4) | `EFFECT_TICK` |
| 着地/衝突 | `.heavy` | `PRIMITIVE_THUD` (1.0) | `EFFECT_HEAVY_CLICK` |
| 星×3/confetti | `.heavy` → `CHHapticEngine` カスタム（transient intensity 1.0, sharpness 0.7 を 3連） | `startComposition()` で TICK→CLICK→THUD 連結 | waveform `[0,50,60,80]` |
| 原則 | intensity/sharpness は 0〜1。エンジンのリセット/停止ハンドリング必須 | `areAllPrimitivesSupported()` 必須（未対応プリミティブが1つでもあると **composition 全体が鳴らない**） | 設定でハプティクスOFFを提供 |

- 確度: 高（いずれもプラットフォーム公式ドキュメント準拠）

---

## 6. 実装チェックリスト（優先度順）

### 必須（これが無いと「脳汁」が成立しない）

- [ ] 描画の入力遅延ゼロ（先端は生タッチ座標、スムージングは過去点のみ）
- [ ] 描画中ループ音（速度→音量/ピッチ連動、開始停止フェード 30〜50ms）
- [ ] 線確定ポップ（scale 1.06、120ms）＋確定音＋ light ハプティクス
- [ ] インク残量バー（リアルタイム減少）
- [ ] 発進の anticipation（レブ音 0.3〜0.5s）→ release（ダスト＋stretch＋medium ハプティクス＋bass音）
- [ ] Camera lerp 追従（係数 0.08〜0.15）＋ look-ahead（車1〜2台分）
- [ ] 車輪回転・サスバウンスの物理表現
- [ ] エンジン音の速度→ピッチ変調（1.0→1.5）
- [ ] コイン取得音の半音ずつピッチ上昇（途切れ 1〜1.5s でリセット）＋取得ポップ
- [ ] ゴール: timeScale 0.3 を実時間 0.3〜0.5s（+ fixedDeltaTime 連動）→ 1.0 へ 0.2〜0.3s で復帰
- [ ] Confetti 2段構成（キャノン＋レイン、計 100〜200個、2〜3s）
- [ ] 星の順次出現（200〜300ms 間隔、scale 0→1.3→1.0、上昇アルペジオ）
- [ ] 報酬カウントアップ（0.8〜1.5s、ease-out、タップでスキップ）
- [ ] 失敗→リトライ 1s 以内・罰なし / 成功→Next 活性化 1.5〜2.5s
- [ ] ハプティクスの端末対応チェック＋OFF設定

### 推奨（差がつく層）

- [ ] ペン先ダストパーティクル（2〜5個/フレーム、寿命 0.2〜0.5s）
- [ ] インク残量の色警告（50%/20%閾値）＋枯渇フィードバック
- [ ] インク残量＝星評価の連動（Happy Glass 方式）
- [ ] 発進時カメラキック＋車体後傾 anticipation
- [ ] トラウマ方式 screen shake（shake=trauma²、Perlinノイズ、maxOffset 16〜30px / maxAngle 5〜10°）
- [ ] 速度連動ズームアウト（+10〜20%）とスピード線
- [ ] スキッドマーク・描線の permanence（痕跡を残す）
- [ ] ゴール hit-stop 80〜120ms（スロー前）
- [ ] コインのカウンターへのフライング＋カウンター scale パンチ
- [ ] コインバースト→時差回収（20〜40ms ずらし）
- [ ] カウントアップ中のチック音ピッチ上昇
- [ ] 星ごとのハプティクス漸増（light→medium→heavy）
- [ ] BGMダッキング（ゴール時 -6〜-9dB）
- [ ] Nextボタンの脈動誘導（scale ±5%、周期 0.8s）

### 任意（余裕があれば）

- [ ] 描画中の continuous ハプティクス（iOS intensity 0.2〜0.35 / Android LOW_TICK 連打）
- [ ] インクのテクスチャブラシ・にじみ表現
- [ ] 走行中の路面ハプティクス（速度比例）
- [ ] 車体トレイル（短め 0.1〜0.2s）
- [ ] スロー中の BGM ローパス＋ピッチ 0.8
- [ ] 車アップグレード連動のエンジン音強化（Hill Climb Racing 方式）
- [ ] 車に目玉を付ける等の personality 演出（Juice it or Lose it の「eyes」）

---

## 7. 成功ゲームからの学び（teardown）

### Draw Climber（Voodoo）
- 「描く→即・走りに反映」のループが核。**走行中でも描き直せる**ため、描画と走行の快感が分離せず連続する。本ゲームでも「走行中の描き足し」を許すかは中核的な設計判断
- レース形式（対戦相手の存在）＋フィニッシュ後の報酬倍率ゲートで、ゴール演出に「もう一押しの報酬」を接続
- 確度: 中（一次 teardown 記事は発見できず、ストア情報・プレイ記録ベース）
- 出典: [Draw Climber (AppGrooves)](https://appgrooves.com/app/draw-climber-by-gilbert-barouch) / [MWM apps page](https://mwm.ai/apps/draw-climber/1495369374)

### Happy Glass（Lion Studios）
- **各ストロークが即・物理オブジェクト化**し、「描く＝世界に介入する」感覚が快感の源
- **インク使用量を星評価に直結**させ、演出（星）とリプレイ動機（少なく描く挑戦）を一体化
- ガラスの表情変化（frown→smile）という**最小コストの personality 演出**が感情報酬として機能
- 確度: 高
- 出典: [Happy Glass Design Analysis (Game Developer)](https://www.gamedeveloper.com/design/happy-glass---design-analysis) / [Olin Olmstead 分析](https://medium.com/@olinolmstead/happy-glass-game-design-analysis-3700b0186066)

### Hill Climb Racing（Fingersoft）
- 「バウンシーで浮遊感のあるカートゥーン物理」自体が juice。リアルさより**気持ちよく誇張された物理**
- **アップグレードが音で体感できる**（エンジン強化後のみターボ音）— 成長の可聴化
- コイン価値が進行と共に上がり、スタントでボーナス — 回収の快感がスケールし続ける
- 確度: 高
- 出典: [Hill Climb Racing (Wikipedia)](https://en.wikipedia.org/wiki/Hill_Climb_Racing) / [Google Play](https://play.google.com/store/apps/details?id=com.fingersoft.hillclimb&hl=en_US)

### パブリッシャー横断の設計原則
- Voodoo: **Snackable / Intuitive / YouTubable / Not punitive / Innovative**。「罰しない」がテンポ設計の根拠（確度: 高）
- Supersonic: 「入力（プレイヤー操作）と出力（ゲームの応答）の質が感情反応を作る」「カメラアングル変更だけでゲームはよりリアルに感じられる」（確度: 高）
- Kwalee: プロトタイプ段階では **polish するな**（まず遊べる状態に）→ juice 実装は MVP 検証後の第2波で入れるのがプロセス上正しい（確度: 高）
- 出典: [Voodoo Guide (GameAnalytics)](https://www.gameanalytics.com/blog/voodoo-guide-mobile-game-design-keep-things-simple) / [Supersonic: Great Concept](https://supersonic.com/learn/blog/how-to-come-up-with-a-great-hyper-casual-game-concept/) / [Supersonic: Level Design Tips](https://supersonic.com/learn/blog/3-tips-for-improving-the-level-design-of-your-hyper-casual-game) / [Kwalee: Game in Two Days](https://www.kwalee.com/blog/gamedev/how-to-make-a-game-in-two-days)

---

## 8. 確度と注意事項

| 区分 | 内容 |
|---|---|
| 確度: 高 | 原典講演・公式ドキュメント・複数ソース一致の原則（trauma²、半音上昇、sleep 100〜200ms、timeScale API、haptics API 仕様、Voodoo 原則、squash 1.3/0.7） |
| 確度: 中 | コミュニティ実装の標準値からの推奨初期値（shake の maxOffset/maxAngle、confetti 個数、カウントアップ時間、カメラ lerp 係数、イージング時間）。**実機での調整前提のスタート値**として扱うこと |
| 確度: 低 | 本レポート独自の提案（描画中の線の脈動、インク飛沫等）。A/Bで検証 |
| 注意1 | juice の数値は最終的に**実機の手で決める**もの。本レポートの値は「初手で8割正しい出発点」を狙ったもの |
| 注意2 | Draw Climber の一次 teardown 記事は未発見。演出の詳細（コイン音のピッチ挙動等）は実プレイでの録画分析を推奨 |
| 注意3 | Android は端末によりアクチュエータ品質差が激しい。プリミティブ未対応で composition 全体が無音になる仕様（公式）のため、フォールバック実装は必須 |
| 注意4 | 演出過多はテンポを殺す。「頻繁なアクションほど juice はシンプルに」（GameAnalytics）を全場面で適用 |

---

## 9. 出典一覧

### GDC / 理論
- Juice it or Lose it — [GDC Vault](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose) / [YouTube](https://www.youtube.com/watch?v=Fy0aCDmgnxg) / [juicy-breakout (GitHub)](https://github.com/grapefrukt/juicy-breakout) / [解説 (Fid)](https://cobble.games/wise-inspiring-smart/game-design/juice-it-or-lose-it) / [Roblog](https://roblog.co.uk/2024/03/juicy-games/) / [Longwelwind demo](https://longwelwind.net/blog/juice-it/)
- The Art of Screenshake — [書き起こし](https://theengineeringofconsciousexperience.com/jan-willem-nijman-vlambeer-the-art-of-screenshake/) / [artificials.ch まとめ](https://artificials.ch/game-feeling/) / [Game Developer 記事](https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games) / [Blue Tengu 実験](https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/)
- Game Feel (Steve Swink) — [Internet Archive](https://archive.org/details/gamefeelgamedesi0000swin) / [Liz England 書評](https://lizengland.com/blog/review-game-feel-by-steve-swink/) / [Wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel) / [Designing Game Feel: A Survey (arXiv)](https://arxiv.org/pdf/2011.09201)
- Juicing Your Cameras With Math (Eiserloh, GDC 2016) — [スライドPDF](http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf) / [archive.org 全文](https://archive.org/stream/GDC2016Eiserloh/GDC2016-Eiserloh_djvu.txt) / [Borderline trauma解説](http://blog.borderline.games/tutorials/gettinghit!/trauma-based-screenshake.html) / [Bevy 実装例](https://bevy.org/examples/camera/2d-screen-shake/) / [Roystan Unity実装](https://roystan.net/articles/camera-shake/)

### Hit-stop / 時間演出
- [Hitstop in Unreal Engine (Cobra Code)](https://medium.com/@cobracode/hitstop-in-unreal-engine-cbe85a907728) / [Capcom Beat 'Em Ups の hitstop 分析](https://shane-sicienski.com/blog/blog-post-title-one-55pmn) / [TV Tropes: Hit Stop](https://tvtropes.org/pmwiki/pmwiki.php/Main/HitStop) / [CritPoints: Hitstop](https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/)
- [Unity Time.timeScale](https://docs.unity3d.com/ScriptReference/Time-timeScale.html) / [Unity Manual: time-scale](https://docs.unity3d.com/6000.3/Documentation/Manual/time-scale.html)

### サウンド
- [The Power of Pitch Shifting (Game Developer)](https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting)
- [Peggle Blast のリアルタイムシンセ (Audiokinetic)](https://www.audiokinetic.com/en/blog/real-time-synthesis-for-sound-creation-in-peggle-blast/)
- 素材: [Zapsplat pencil pack](https://www.zapsplat.com/sound-effect-packs/pencil-sound-effects/) / [Pixabay drawing SFX](https://pixabay.com/sound-effects/search/drawing/) / [Uppbeat drawing SFX](https://uppbeat.io/sfx/category/craft/drawing)

### ハプティクス
- iOS: [Core Haptics 総合ガイド (Maksim Po)](https://medium.com/@mi9nxi/haptic-feedback-in-ios-a-comprehensive-guide-6c491a5f22cb) / [Apple platforms haptics ガイド (Eidinger)](https://blog.eidinger.info/haptics-on-apple-platforms) / [リアルタイム更新 (Apple公式)](https://developer.apple.com/documentation/CoreHaptics/updating-continuous-and-transient-haptic-parameters-in-real-time) / [BiTE Interactive: Finishing Touches](https://www.biteinteractive.com/finishing-touches-haptics/)
- Android: [Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles) / [Haptics API reference](https://developer.android.com/develop/ui/views/haptics/haptics-apis) / [Custom haptic effects](https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects) / [AOSP: constants & primitives](https://source.android.com/docs/core/interaction/haptics/haptics-constants-primitives)

### ハイパーカジュアル / teardown
- [Voodoo Guide (GameAnalytics)](https://www.gameanalytics.com/blog/voodoo-guide-mobile-game-design-keep-things-simple) / [Deconstructor of Fun: Voodoo](https://www.deconstructoroffun.com/blog/2018/8/1/5-ways-voodoo-dominates-the-hyper-casual-market)
- [Supersonic: Concept](https://supersonic.com/learn/blog/how-to-come-up-with-a-great-hyper-casual-game-concept/) / [Supersonic: Level Design](https://supersonic.com/learn/blog/3-tips-for-improving-the-level-design-of-your-hyper-casual-game)
- [Kwalee: 3 Steps](https://www.kwalee.com/blog/gamedev/follow-these-3-simple-steps-make-enjoyable-hyper-casual-games) / [Kwalee: Game in Two Days](https://www.kwalee.com/blog/gamedev/how-to-make-a-game-in-two-days)
- [Squeezing More Juice (GameAnalytics)](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design) / [GDevelop: Casual Game Loops](https://gdevelop.io/blog/casual-game-loops)
- [Happy Glass 分析 (Game Developer)](https://www.gamedeveloper.com/design/happy-glass---design-analysis) / [Happy Glass 分析 (Olmstead)](https://medium.com/@olinolmstead/happy-glass-game-design-analysis-3700b0186066)
- [Hill Climb Racing (Wikipedia)](https://en.wikipedia.org/wiki/Hill_Climb_Racing) / [Draw Climber (AppGrooves)](https://appgrooves.com/app/draw-climber-by-gilbert-barouch)

### 実装部品
- [コインフライ実装 (Trisledinh)](https://medium.com/@trisledinh/unity-how-to-create-effect-coin-fly-in-less-than-15-minutes-9a2e7f72aff2) / [react-slot-counter](https://github.com/almond-bongbong/react-slot-counter) / [confetti (Flutter)](https://fluttergems.dev/packages/confetti/) / [12 Principles in Video Games (Game Anim)](https://www.gameanim.com/2019/05/15/the-12-principles-of-animation-in-video-games/) / [Juicing Your Movements (GameMaker)](https://developer.amazon.com/docs/gamemaker/juicing-your-movements.html)

# 技術スタック選定調査: 線描画×物理2Dゲーム（iOS / Android / ローカルブラウザ開発）

- 調査日: 2026-07-07
- 調査者: 技術選定アーキテクト（Claude）
- 対象プロジェクト: draw-bridge（線を引いて物理で車を走らせる2Dゲーム）
- 前提条件: 開発者のメインスタックは TypeScript。iOS / Android 両ストアへリリース。開発中は Mac のブラウザで即プレイできること。

---

## 1. 結論（TL;DR）

**推奨: Phaser 4.1 + Phaser Box2D（Box2D v3 のJSポート）+ Vite + Capacitor 7**（総合 8.6 / 10）

- 次点は **Cocos Creator 3.8.x**（8.1 / 10）。TypeScriptネイティブ＋ネイティブビルドで性能面は上だが、英語圏ドキュメント・広告エコシステム・コミュニティの薄さ、エディタ中心のワークフローで差がついた。
- 決め手は「(c) ローカル開発体験」「(d) TS親和性」で満点、かつ「(a) 線描画→物理ボディ化」で Box2D v3（chain shape / capsule / wheel joint / Soft Step solver）をフル装備で使える唯一のTSネイティブ構成であること。
- 最大のリスクは「(b) 中級Android端末のWebView性能」。ただし本ゲームの負荷（剛体数十個・スプライト少数）なら実測上問題になりにくく、Vampire Survivors モバイル版（Capacitor製・確度:中〜高）という商用前例がある。緩和策は §8 参照。

---

## 2. 評価方法

- 評価軸 (a)〜(h) を各 0〜10 点で採点し、重み付き合計（重み: a=20%, b=15%, c=15%, d=15%, e=10%, f=5%, g=10%, h=10%）で比較。
- 重みの根拠: 本ゲームのコア差別化は「線→物理ボディ化」の実装品質（a）。開発者がTS人材の個人〜少人数開発であるため開発速度に直結する (c)(d) を高め、(f) は実装量が小さいため低めに設定。
- 事実と推測は区別し、各主張に確度（高/中/低）を付す。

---

## 3. 各候補の 2026年7月時点の状況（事実確認）

### 3.1 Phaser（候補1）
- **Phaser 4 は正式リリース済み**。v4.0.0 "Caladan" が 2026-04-10、v4.1.0 "Salusa" が 2026-04-30 リリース。WebGLレンダラをゼロから再構築（RenderNodes / 統一フィルタシステム）しつつ、既存APIはほぼ維持（確度: 高）。
  - https://phaser.io/download/release/v4.1.0 / https://phaser.io/news/2026/04/phaser-4-1-0-salusa-release / https://phaser.io/news/2026/05/phaser-3-vs-phaser-4
- 物理は Arcade Physics / Matter.js を従来通り内蔵（確度: 高）。https://docs.phaser.io/phaser/concepts/physics
- **Phaser Box2D**: Phaser Studio が Box2D v3.0（C実装, 2024-08公開）をモダンJSへ変換した公式ポート。**世界唯一の Box2D v3 Webポート**、MITライセンス、min+gz 約65KB。convex polygon / circle / **capsule** / **chain** / rounded polygon、revolute / distance / prismatic / weld / **wheel joint**、Soft Step solver・sub-stepping・CCD・Contact Events 対応（確度: 高）。
  - https://phaser.io/news/2024/12/announcing-phaser-box2d / https://github.com/phaserjs/phaser-box2d / https://phaser.io/box2d
- 物理エンジン代替候補:
  - **Matter.js** (~82KB): 純JS。`Bodies.fromVertices()`（凹形状は poly-decomp で凸分解）で描線ボディ化可能だが、精度・スタッキング安定性は Box2D 系に劣る。wheel joint 相当は constraint の組合せで自作（確度: 高）。https://brm.io/matter-js/docs/classes/Bodies.html
  - **Planck.js** (~290KB): Box2D v2系の純JS書き直し。安定・実績あり（確度: 高）。https://napejs.org/benchmark.html
  - **Rapier2D (WASM)** (~1.6MB): WASM+SIMD で最速級。2025年はWeb性能改善に注力、新BVHブロードフェーズ導入。`@dimforge/rapier2d` v0.19系、決定論ビルド（rapier2d-deterministic）あり（確度: 高）。https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/ / https://www.npmjs.com/package/@dimforge/rapier2d-deterministic
- **Capacitor**: 公式に「ゲームに適したプラットフォーム」としてPhaser+Capacitorチュートリアルを提供。https://capacitorjs.com/docs/guides/games / https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor

### 3.2 Godot 4.x（候補2）
- 最新は **Godot 4.6**（2026-01リリース）+ 4.5.2。モバイルは2025〜26年に大幅強化: Androidネイティブデバッグシンボル(4.5)、instrumented tests・エディタからのデバイスミラーリング(4.6)、iOS向け自動エクスポート設定。**Google Play Billing / Play Games Services / StoreKit 2 の公式プラグイン**を財団がメンテ（確度: 高）。https://godotengine.org/article/godot-mobile-update-apr-2026/
- Web書き出しは Compatibility レンダラ（WebGL 2.0）のみ。**C#はWeb書き出し不可**。素のWASMが約40MBと重く、wasm-opt+brotli等の最適化が前提。モバイル実機ではロード遅延が顕著（確度: 高）。https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html / https://github.com/godotengine/godot/issues/68647
- 2D物理のジョイントは PinJoint2D / GrooveJoint2D / DampedSpringJoint2D で、**Box2D の wheel joint に相当する2D専用ジョイントは組み込みでは無い**（PinJoint2D のモーター+スプリングで代替、または godot-rapier2d / Box2D GDExtension を導入）（確度: 中〜高）。
- 描線→コリジョン化は `Geometry2D.offset_polyline_2d()` でポリライン→ポリゴン化 → CollisionPolygon2D、または SegmentShape2D 連結が定番レシピ（確度: 高）。https://kidscancode.org/godot_recipes/4.x/2d/line_collision/index.html / https://shaggydev.com/2022/01/25/line2d-physics/
- 広告: **Poing Studios の godot-admob-plugin**（Android/iOS、GDScript/C#、メディエーション対応、エディタ内モック広告、2026-02にも更新）が事実上の標準（確度: 高）。https://github.com/poingstudios/godot-admob-plugin
- 商用実績: Brotato($10.7M)等はPC中心。モバイルでは Kamaeru / Rift Riff が2025-12にモバイルストアへ（クラッシュ率 ~4%→<1% に改善の実例）（確度: 高）。https://godotengine.org/article/godot-mobile-update-apr-2026/

### 3.3 Unity 6 (C#)（候補3）
- **Runtime Fee は2024-09に完全撤回**。Personal は収益$200Kまで無料・スプラッシュ任意化。Pro/Enterprise は2026-01-12から5%値上げ（確度: 高）。https://unity.com/blog/unity-is-canceling-the-runtime-fee / https://unity.com/products/pricing-updates
- (a) は最も簡単な部類: `PolygonCollider2D` + **WheelJoint2D 組み込み**。ヒーパーカジュアルの Draw Climber 系実績も豊富（確度: 高）。
- **WebGLビルドが極端に遅い**: Unity 6 で30〜40分/回の報告（開発ビルドで約20分）。ブラウザでの高速イテレーションは実質不可。エディタPlay Modeは即時（確度: 高）。https://discussions.unity.com/t/unity-6-webgl-building-takes-a-lot-of-time/1543746
- 広告SDK（AdMob公式 / Unity LevelPlay / AppLovin MAX）は全候補中で最も成熟（確度: 高）。

### 3.4 Flutter + Flame + Forge2D（候補4）
- Flame は活発に維持（Flame Game Jam 2026開催）。**Forge2D は Box2D の純Dartポート**で、ChainShape・WheelJoint 等 Box2D v2 系のAPIをフル提供（確度: 高）。https://docs.flame-engine.org/latest/bridge_packages/flame_forge2d/forge2d.html / https://github.com/flame-engine/forge2d
- 広告は **google_mobile_ads（Google公式Flutterプラグイン）** が別格の成熟度。Casual Games Toolkit で公式にゲーム向け構成（ads/IAP/audio/crashlytics）を提供（確度: 高）。https://docs.flutter.dev/cookbook/plugins/google-mobile-ads / https://docs.flutter.dev/resources/games-toolkit
- 懸念: 物理が純Dart実行（WASM/ネイティブC++でない）ため、剛体数が増えると JS系WASM勢やネイティブ勢に劣る。本ゲーム規模なら実用圏（確度: 中）。言語は Dart（TSに文法は近いが別言語）。

### 3.5 Defold（候補5）
- 2026年上半期に1.12系5リリース+**1.13.0**。1.13.0 で **Box2D スクリプティングAPI拡張**（`physics.create_joint()` で revolute/prismatic/weld/distance/**wheel** 等をLuaから動的生成）、AndroidのデフォルトGPUバックエンドがVulkan化（確度: 高）。https://defold.com/2026/06/30/Defold-H1-2026/
- **HTML5ビルドが全エンジン中最小・最速ロード**（確度: 中〜高）。https://app.cinevva.com/guides/web-game-engines-comparison.html
- 広告: **Defold Foundation 公式の extension-admob**（iOS/Android統一API）+ IronSource 公式拡張（確度: 高）。https://defold.com/extension-admob/
- 商用実績: Family Island（Melsoft、数千万DL級）等（確度: 高）。https://defold.com/2020/08/11/Melsoft-Games-partners-with-the-Defold-Foundation/
- 言語はLua（ts-defold というTS→Luaトランスパイラは存在するがニッチ）。ランタイム中の任意形状コリジョン生成はBox2D API拡張で改善したが、エディタ設計は「事前定義シェイプ」中心（確度: 中）。

### 3.6 Cocos Creator（候補6）
- 3.8 系がLTS。3.8.6 でパッケージサイズ・性能・Box2D改善。3.9 が次のメジャー（確度: 高）。https://forum.cocosengine.org/t/cocos-creator-3-8-is-here-learn-more-about-it-in-our-release-notes/59194
- **エディタ＆スクリプトはTypeScriptネイティブ**。ネイティブ書き出し時はC++コア＋JSVMで、WebViewではない（確度: 高）。
- 広告: **公式 cocos-google-admob 拡張**（3.7.3+、C++→TS APIエクスポーズ、5フォーマット対応）（確度: 高）。https://github.com/cocos/cocos-google-admob
- 弱点: 英語圏のコミュニティ・ドキュメント・サードパーティ事例が中国圏に比べ薄い。西側でのハイパーカジュアル事例は限定的（確度: 中）。

### 3.7 React Native + Skia + 物理（候補7）
- 2026年時点で「**完全なRNゲームエンジンは存在しない**」が専門家の結論。Skia+Reanimated 4 の `<Atlas>` が唯一のGPUバッチ経路だが、**廉価Android（OPPO A16級）ではスプライト約300個で頭打ち**。スプライトシート/シーン管理/ゲームオーディオ等のエンジン層が欠落（確度: 高）。https://dev.to/grzott/the-react-native-game-engine-gap-in-2026-rnge-skia-phaser-in-webview-expo-gl-55hp
- Matter.js との組合せは Expo 公式ブログにあるが「数十ボディまで」が実用範囲（確度: 中〜高）。https://expo.dev/blog/build-2d-game-style-physics-with-matter-js-and-react-native-skia
- 広告(react-native-google-mobile-ads / AppLovin MAX RN公式)とハプティクス(expo-haptics)は成熟。ただし物理ゲームの商用実績はほぼ無い（確度: 中）。

---

## 4. 評価軸別の詳細

### (a) 線描画→物理ボディ化の実装容易性
| 候補 | 評価 | 根拠 |
|---|---|---|
| Phaser + Phaser Box2D | **9** | Box2D v3: chain shape（静的地形）、capsule 連結（動的な描線ボディ）、wheel joint、凸分解不要のカプセル戦略が全部そろう。50+の公式サンプルに車デモあり |
| Godot 4.6 | 7 | `offset_polyline_2d`→CollisionPolygon2D の定番レシピはあるが、2D wheel joint 非搭載で車はPinJoint2D+モーターか外部拡張。組み込み2D物理の安定性評判は Box2D 系に一歩劣る |
| Unity 6 | 9 | PolygonCollider2D + WheelJoint2D 組み込み。EdgeCollider2D も描線に直結。実装例最多 |
| Flutter Forge2D | 8 | Box2D API そのまま（ChainShape / WheelJoint / 動的ボディ生成）。純Dartゆえ大量ボディに弱い |
| Defold 1.13 | 6.5 | wheel joint 含むジョイント動的生成は新APIで可能になったが、任意描線→シェイプ生成のワークフローはまだ発展途上 |
| Cocos Creator | 8 | Box2D(wasm) 内蔵・TSから chain/wheel を直接操作可能 |
| RN + Skia | 5 | Matter.js `fromVertices` + 凸分解は可能だが、全て手組み。ネイティブ物理ソルバー無し |

### (b) 中級Android端末での60fps維持
- ネイティブ描画勢（Unity 9 / Godot 9 / Defold 9 / Cocos 8.5 / Flutter 7.5）が有利。
- **Phaser + Capacitor = 6.5**: Android WebView は Chrome 本体よりCPU/GPU割当が渋く、フレーム落ち報告あり。一方で本ゲームの負荷（剛体数十・描画オブジェクト少数）は Phaser 4 の新WebGLレンダラ+WASM/軽量JS物理なら十分収まる範囲。RN記事の「WebViewで5〜10倍減速」はデスクトップ比かつ重負荷シナリオの数字（確度: 中）。https://github.com/ionic-team/capacitor/discussions/3899
- RN + Skia = 5（廉価端末の300スプライト上限、JSスレッド物理）。

### (c) ローカル開発体験（ホットリロード・ブラウザ即プレイ）
| 候補 | 点 | 内容 |
|---|---|---|
| Phaser | **10** | Vite dev server + HMR でブラウザ即時リロード。公式TS+Viteテンプレートあり。ゲームがそのままWebページ |
| Cocos | 8.5 | エディタから1クリックでブラウザプレビュー。TSホットリロードあり |
| Flutter | 8 | ホットリロードは最強クラス。ただしブラウザ実行(CanvasKit)はビルドがやや遅く、通常はデスクトップ/実機で回す |
| Defold | 8 | 実機ホットリロード・小さいHTML5ビルドで反復が速い |
| Godot | 7 | エディタF5で即実行（ネイティブウィンドウ）。ブラウザで遊ぶにはWeb書き出しが必要でHMR無し |
| Unity | 6 | Play Modeは即時だがdomain reload待ちあり。WebGLビルド20〜40分でブラウザ反復は非現実的 |
| RN | 6 | Expoのfast refreshは優秀だが、Skiaゲームのブラウザ実行は制約が多い |

### (d) TypeScript/JavaScript 親和性
- Phaser **10**（TSファースト、npm/Vite/ESLint等が全部そのまま）> RN 10 > Cocos 9.5（TSネイティブだがエディタ拘束）> Flutter 5.5（Dart）> Defold 4.5（Lua、ts-defoldは非公式）> Godot 3（GDScript/C#。C#はWeb不可。GodotJSは実験的）> Unity 2（C#のみ）。

### (e) 広告SDK統合（AdMob / Unity Ads / AppLovin MAX）
| 候補 | 点 | 状況 |
|---|---|---|
| Unity | 10 | AdMob公式Unityプラグイン、LevelPlay、MAX公式。業界標準 |
| Flutter | 9 | google_mobile_ads はGoogle自身がメンテ。AppLovin MAX 公式Flutterプラグインあり |
| Defold | 8.5 | Foundation公式 extension-admob + IronSource 公式拡張 |
| Godot | 8 | Poing Studios AdMob（2026-02更新、メディエーション対応）。MAX直接対応は弱い |
| RN | 8.5 | react-native-google-mobile-ads / MAX RN公式 |
| Phaser+Capacitor | 7 | @capacitor-community/admob が活発（App Open/Banner/Interstitial/Rewarded、UMP同意管理対応）。**AppLovin MAX は公式Capacitorプラグイン無し**（Cordova互換レイヤで動作報告あり）。Unity Ads も同様に手薄 |
| Cocos | 7 | 公式AdMob拡張あり。西側メディエーション（MAX等）は自前ブリッジ |

出典: https://github.com/capacitor-community/admob / https://github.com/AppLovin/AppLovin-MAX-Cordova/issues/32 / https://github.com/poingstudios/godot-admob-plugin / https://defold.com/extension-admob/ / https://github.com/cocos/cocos-google-admob

### (f) ハプティクス・サウンドのネイティブアクセス
- Phaser+Capacitor **9**: `@capacitor/haptics` 公式プラグイン（impact/notification/selection、Taptic Engine対応）。音はWeb Audio（WebViewで低レイテンシ化済み）+必要ならネイティブプラグイン。https://capacitorjs.com/docs/apis/haptics
- RN 9（expo-haptics）/ Unity 8（Nice Vibrations等の定番アセット）/ Flutter 8（HapticFeedback標準API）/ Godot 6.5（`Input.vibrate_handheld()` は粒度粗い。CoreHaptics級はサードパーティプラグイン。iOSで初回呼び出しスタッター報告 #84323）/ Cocos 6 / Defold 5.5（コミュニティ拡張頼み）。

### (g) ストア申請実績（同構成の商用ゲーム）
- Unity 10: Draw Climber 系ハイパーカジュアルの本場（Voodoo等）。
- Phaser+Capacitor 8: **Vampire Survivors モバイル版が Capacitor 製**（Ionic公式ブログの言及。確度: 中〜高）。Phaser公式が Capacitor 書き出しを一次サポート。https://ionic.io/blog/capacitor-everything-youve-ever-wanted-to-know
- Defold 8: Family Island 等。Godot 7: Kamaeru / Rift Riff（2025-12モバイル同時展開）。Cocos 7.5: 中国圏で大量、西側は少なめ。Flutter 6: Flameゲームは多数だが物理系ヒットは少ない。RN 3: 商用物理ゲームほぼ皆無。

### (h) ビルドサイズとロード時間
- Defold 10（HTML5最小・APK数MB）> Phaser+Capacitor 9（エンジン~1MB+Box2D 65KB。APK/IPAはWebView同梱不要でアセット次第、Web版は数MBで即ロード）> Cocos 7.5 > Flutter 7（APK 15〜25MB）> Unity 6 / Godot 6（GodotはWeb素40MB問題。モバイルAPKは30MB前後、最適化で削減可）。

---

## 5. 総合比較表（重み付き）

| 候補 | (a) 20% | (b) 15% | (c) 15% | (d) 15% | (e) 10% | (f) 5% | (g) 10% | (h) 10% | **総合** |
|---|---|---|---|---|---|---|---|---|---|
| **1. Phaser 4 + Box2D v3 + Capacitor** | 9 | 6.5 | 10 | 10 | 7 | 9 | 8 | 9 | **8.6** |
| 6. Cocos Creator 3.8 | 8 | 8.5 | 8.5 | 9.5 | 7 | 6 | 7.5 | 7.5 | **8.1** |
| 5. Defold 1.13 | 6.5 | 9 | 8 | 4.5 | 8.5 | 5.5 | 8 | 10 | **7.5** |
| 3. Unity 6 | 9 | 9 | 6 | 2 | 10 | 8 | 10 | 6 | **7.4** |
| 4. Flutter + Flame + Forge2D | 8 | 7.5 | 8 | 5.5 | 9 | 8 | 6 | 7 | **7.4** |
| 2. Godot 4.6 | 7 | 9 | 7 | 3 | 8 | 6.5 | 7 | 6 | **6.7** |
| 7. RN + Skia + 物理 | 5 | 5 | 6 | 10 | 8.5 | 9 | 3 | 6 | **6.4** |

※ 物理エンジンの第一候補は **Phaser Box2D**（wheel joint / chain / capsule / MIT / 65KB）。剛体数が桁違いに増える場合のみ **Rapier2D（WASM+SIMD, ~1.6MB）** に差し替え。Matter.js は車両ジョイントとスタッキング安定性で非推奨、Planck.js は Box2D v2 系でPhaser Box2D（v3）に劣後。

---

## 6. 追加調査: 線描画物理の実装パターン（定番）

### 6.1 描いた線の物理表現 — 3方式の使い分け
| 方式 | 用途 | 備考 |
|---|---|---|
| **chain shape** | 静的な地形・描いた線が「地面」として固定される場合 | Box2D の chain は **staticボディ専用・片側衝突**。内部頂点のゴースト衝突を排除でき、地形はこれ一択（確度: 高） |
| **連結カプセル/矩形の compound body** | 描いた線が「落ちる・乗れる橋」など**動的ボディ**になる場合（本ゲームの中核） | 1つの rigid body に、ポリラインの各セグメントを**カプセル（v3）または回転矩形**のfixtureとして複数アタッチ。質量はセグメント長合計から自動算出。Box2D v3 はカプセルをネイティブサポートするので端点の引っかかりが出ない（確度: 高） |
| trimesh / 凸分解ポリゴン | 塗りつぶし形状（Happy Glass系） | 2Dでは trimesh ではなく `poly-decomp`/earcut で凸分解して compound 化するのが定番。線ゲームには不要（確度: 高） |

- 実装手順（定番）: pointer move でサンプリング → **Ramer–Douglas–Peucker で間引き**（頂点数を10〜30に）→ 隣接セグメントをカプセル fixture 化 → 1ボディに集約。Matter.js なら `Bodies.fromVertices` + matter-lines が参考実装。https://github.com/shundroid/matter-lines
- Godot流: `Geometry2D.offset_polyline_2d()` で太らせてポリゴン化（https://kidscancode.org/godot_recipes/4.x/2d/line_collision/index.html）。

### 6.2 車の表現（Box2D 系ベストプラクティス）
- **chassis（箱 or カプセル）1個 + wheel（円）2個 + b2WheelJoint × 2** が標準構成。wheel joint は「サスペンション軸に沿った移動＋自由回転＋モーター」を1つで提供（v3で Line joint から改名）。https://box2d.org/documentation/group__wheel__joint.html
- サスペンション: `hertz ≈ 4Hz`、`dampingRatio ≈ 0.7` が出発点。硬すぎるとホイールが跳ねてグリップを失う。
- 駆動: wheel joint の `enableMotor + motorSpeed（rad/s）+ maxMotorTorque`。後輪のみ駆動から始めるのが調整しやすい。
- 摩擦: タイヤ `friction 0.8〜1.2` / 地形・描線 `0.6〜0.9` / `restitution 0`。グリップ不足はタイヤを多角形化（knobbly）せず、まず摩擦とサスで調整（Box2Dフォーラムの定説）。
- 逆さ走行や引っかかり対策: chassis の角を丸める（rounded polygon / capsule）。
- 参考: iforce2d のBox2D車両チュートリアル（http://www.iforce2d.net/b2dtut/top-down-car）、Emanuele Feronato の car/truck 連載（https://emanueleferonato.com/2011/08/22/step-by-step-creation-of-a-box2d-cartruck-with-motors-and-shocks/）、Phaser公式 Box2D チュートリアル群（https://phaser.io/tutorials/box2d-tutorials/an-overview-of-joints）。

### 6.3 60fps の物理ステップ設計
- **固定タイムステップ + アキュムレータ + 補間レンダリング**が鉄則（Gaffer on Games "Fix Your Timestep!"）。https://gafferongames.com/post/fix_your_timestep/
  - `dt = 1/60` 固定。フレーム経過時間をアキュムレータに積み、dt 単位で `world.step()` を消費。余り / dt を α として前回状態と線形補間して描画。
  - アキュムレータ上限（例: 0.25s）で spiral of death を防止（遅い端末ではスローモーションに逃がす）。
- Box2D v3 は `b2World_Step(world, dt, subStepCount)` の **subStepCount = 4** が推奨デフォルト。Soft Step solver によりジョイントの安定性が v2 より高い。
- 120Hz端末対策: 描画は requestAnimationFrame 任せ、物理は60Hz固定+補間にすることでリフレッシュレート非依存になる。

### 6.4 類似ゲームのOSS実装例
- **matter-lines**（Matter.js で線を描いてボディ化するライブラリ）: https://github.com/shundroid/matter-lines
- **Draw Climber クローン**（MIT、Web実装）: https://github.com/drawclimber
- **Draw-In-Unity-3D**（描線→物理化アルゴリズムのUnity実装、考え方の参考）: https://github.com/HectorPulido/Draw-In-Unity-3D
- Phaser Box2D 公式サンプル50+（車・ジョイント・スプライト統合のミニゲーム含む）: https://github.com/phaserjs/phaser-box2d
- Godot の Line2D 物理化解説: https://shaggydev.com/2022/01/25/line2d-physics/

---

## 7. 最終推奨と次点との差

### 推奨構成（確定案）
```
言語:        TypeScript
エンジン:     Phaser 4.1.x（新WebGLレンダラ）
物理:        Phaser Box2D（Box2D v3 / MIT / 65KB）… 描線=カプセルcompound、地形=chain、車=wheel joint×2
ビルド:      Vite（dev: HMRでブラウザ即プレイ / build: 静的バンドル）
ネイティブ化: Capacitor 7（iOS/Android）
広告:        @capacitor-community/admob（AdMob。メディエーション拡張が必要になったらMAX Cordovaプラグイン検証）
ハプティクス: @capacitor/haptics
サウンド:     Phaser Sound（Web Audio）
```

### 推奨理由（要点）
1. **(a)×(d) の掛け算で唯一無二**: 「Box2D v3 の車両・チェーン・カプセルをTSネイティブで直接叩ける」構成は他に無い。Unityは(a)同点だがTS不可、CocosはBox2D v2系＋エディタ拘束。
2. **(c) が満点**: `npm run dev` でブラウザ即プレイ＋HMR。ゲームプレイのパラメータ調整（摩擦・サス・モータートルク）はこのゲームの開発工数の大半を占めるため、反復速度が品質に直結する。
3. **Web版がそのまま配布可能**: itch.io / Poki 等でのソフトローンチやプレイアブル広告への転用が追加コストゼロ。
4. 商用前例（Vampire Survivors モバイル）と公式サポート（Phaser公式Capacitorチュートリアル、Capacitor公式ゲームガイド）が存在。

### 次点（Cocos Creator 3.8）との差 = 0.5点
- Cocos が勝る点: ネイティブ描画による (b) の安心感（8.5 vs 6.5）。
- Phaser が勝る点: (c) ブラウザ完結の開発体験（エディタ不要・Git差分がクリーン）、(d) npmエコシステム完全互換、(f) Capacitorハプティクス、英語圏ドキュメント・AI支援の効きやすさ、(h) Web配布の軽さ。
- 判断: 本ゲームは物理負荷が軽く (b) の差が実害化しにくい一方、(c)(d) の差は開発全期間に効く。**性能検証スパイク（§8-1）が失敗した場合のみ Cocos / Godot に切替**というリスクヘッジ付きで Phaser を採る。

### Unity を選ばない理由
ライセンス問題は解消済み（$200Kまで無料）だが、(d) TS不可・(c) WebGLビルド30分超で「ブラウザ即プレイ開発」という必須要件を満たさない。チームがC#人材ならば最有力だった。

### Godot を選ばない理由
エンジン品質・モバイル対応は2026年時点で急伸しているが、(d) TS不可（C#はWeb書き出し不可）・2D wheel joint 非搭載・Web書き出し40MB問題で本件の要件適合度が低い。

---

## 8. リスクと緩和策

| # | リスク | 確度 | 緩和策 |
|---|---|---|---|
| 1 | **中級Android WebViewで60fps割れ**（30fps報告例あり） | 中 | **着手週に性能スパイク**: 目標端末（例: Snapdragon 6xx / Helio G系, 2〜3万円帯）実機で「剛体50個+描線+車」のプロトを計測。NG時は resolution scale 0.75、`powerPreference: 'high-performance'`、パーティクル削減。それでもNGなら Cocos Creator へ移植（TSなのでロジック層は再利用可能） |
| 2 | AppLovin MAX / Unity Ads の公式Capacitorプラグイン不在 | 高（事実） | MVP は AdMob 単独（@capacitor-community/admob は UMP同意管理まで対応）。メディエーションが収益上必須になった段階で MAX Cordova プラグインの Capacitor 互換を検証、最悪カスタムプラグイン（Swift/Kotlin 各200行程度） |
| 3 | Phaser 4 が新しく既知バグが残る | 中 | 4.1で安定化済みだがレンダラ起因の問題は Phaser 3.90（LTS的安定版）へのダウングレードパスを確保（API互換高い）。物理層は Phaser 非依存（Phaser Box2D は独立ライブラリ）なので影響を受けない |
| 4 | Phaser Box2D のメンテ継続性（Phaser Studio 依存） | 低〜中 | MIT なのでフォーク可能。代替として Rapier2D（@dimforge、活発）へのアダプタを物理層の抽象化（thin wrapper）で担保 |
| 5 | WebViewの音声レイテンシ・バックグラウンド挙動 | 低 | Web Audio はモバイルWebViewで成熟。問題があれば native-audio Capacitorプラグイン |

---

## 9. 主要出典

### フレームワーク状況
- Phaser 4.0/4.1 リリース: https://phaser.io/download/release/v4.1.0 / https://phaser.io/news/2026/05/phaser-3-vs-phaser-4 / https://gamefromscratch.com/phaser-4-released/
- Phaser Box2D: https://phaser.io/news/2024/12/announcing-phaser-box2d / https://github.com/phaserjs/phaser-box2d / https://phaser.io/box2d
- Godot Mobile Update 2026-04: https://godotengine.org/article/godot-mobile-update-apr-2026/
- Godot Web export / サイズ問題: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html / https://github.com/godotengine/godot/issues/68647 / https://popcar.bearblog.dev/how-to-minify-godots-build-size/
- Unity Runtime Fee 撤回・価格: https://unity.com/blog/unity-is-canceling-the-runtime-fee / https://unity.com/products/pricing-updates
- Unity 6 WebGL ビルド時間: https://discussions.unity.com/t/unity-6-webgl-building-takes-a-lot-of-time/1543746
- Flame / Forge2D: https://github.com/flame-engine/flame / https://docs.flame-engine.org/latest/bridge_packages/flame_forge2d/forge2d.html
- Defold H1 2026 / 1.13.0: https://defold.com/2026/06/30/Defold-H1-2026/
- Cocos Creator 3.8: https://forum.cocosengine.org/t/cocos-creator-3-8-is-here-learn-more-about-it-in-our-release-notes/59194
- RNゲームエンジンギャップ 2026: https://dev.to/grzott/the-react-native-game-engine-gap-in-2026-rnge-skia-phaser-in-webview-expo-gl-55hp / https://expo.dev/blog/build-2d-game-style-physics-with-matter-js-and-react-native-skia

### 物理エンジン
- ベンチマーク（バンドルサイズ含む）: https://napejs.org/benchmark.html
- Rapier 2025振り返り/2026計画: https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/
- rapier.js: https://github.com/dimforge/rapier.js / https://www.npmjs.com/package/@dimforge/rapier2d-deterministic
- Box2D 公式（chain / wheel joint / simulation）: https://box2d.org/documentation/ / https://box2d.org/documentation/group__wheel__joint.html
- Matter.js fromVertices: https://brm.io/matter-js/docs/classes/Bodies.html

### ネイティブ化・広告・ハプティクス
- Capacitor ゲームガイド / Phaser チュートリアル: https://capacitorjs.com/docs/guides/games / https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor
- @capacitor-community/admob: https://github.com/capacitor-community/admob
- AppLovin MAX Capacitor 互換 issue: https://github.com/AppLovin/AppLovin-MAX-Cordova/issues/32
- @capacitor/haptics: https://capacitorjs.com/docs/apis/haptics
- Godot AdMob (Poing Studios): https://github.com/poingstudios/godot-admob-plugin
- Defold extension-admob: https://defold.com/extension-admob/
- Cocos AdMob 公式拡張: https://github.com/cocos/cocos-google-admob
- Flutter google_mobile_ads / Casual Games Toolkit: https://docs.flutter.dev/cookbook/plugins/google-mobile-ads / https://docs.flutter.dev/resources/games-toolkit
- Vampire Survivors と Capacitor: https://ionic.io/blog/capacitor-everything-youve-ever-wanted-to-know / https://en.wikipedia.org/wiki/Vampire_Survivors

### 実装パターン
- Fix Your Timestep!: https://gafferongames.com/post/fix_your_timestep/
- iforce2d Box2D チュートリアル: http://www.iforce2d.net/b2dtut/top-down-car
- Godot Line2D 物理化: https://kidscancode.org/godot_recipes/4.x/2d/line_collision/index.html / https://shaggydev.com/2022/01/25/line2d-physics/
- matter-lines: https://github.com/shundroid/matter-lines
- Draw Climber OSS: https://github.com/drawclimber

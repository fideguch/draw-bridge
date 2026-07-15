# 08. モバイル商用品質レンダリング処方箋（Phaser 4.2.0 / Capacitor WebView）

> 対象: iOS / Android WebView（Capacitor 7.x）で Draw Bridge 系物理パズルを「商用品質」で描画する。
> 検証基盤: `node_modules/phaser` = **Phaser 4.2.0**（実ソースを直接読解）。Web 調査は 2026-07-08 時点。
> API はすべて Phaser 4.x のソース/ドキュメントで実在を確認済み（Phaser 3 から変わった点は明記）。
>
> 現行実装の要点（`src/main.ts`, `src/render/ui/theme.ts`, `index.html` を読解）:
> - Scale = `Phaser.Scale.FIT` + `CENTER_BOTH` + 固定 `390×844` → **背の高い端末でレターボックス**、かつ **DPR 未対応（1x 描画）でボヤける**。
> - `Button.ts` が `strokeRoundedRect()` で枠線描画 → **Phaser 4 のライン不具合を踏む**（後述 §3）。
> - `Text` に `resolution` 未指定 → **resolution=1 で Retina でボヤける**（§4）。
> - セーフエリアが `theme.ts` で `top:47 / bottom:34` と**ハードコード** → 端末差に非対応（§1）。

---

## 0. 結論サマリ（TL;DR）

| # | 課題 | 処方（Phaser 4.2.0 で検証済み） |
|---|------|--------------------------------|
| 1 | フルスクリーン | **FIT を捨てる**。`Scale.NONE` + 手動リサイズで 100% 充填。RESIZE は「レターボックスは消えるが 1x でボヤける」ため商用品質では不採用（§1・§2 で論証）。 |
| 2 | DPR シャープネス | Phaser 4 に **`resolution` ゲーム設定は存在しない**（削除）。正解は **`width/height = innerW/H × DPR` + `zoom = 1/DPR`**。バッキングストアを端末実ピクセルで確保する。 |
| 3 | Graphics | `strokeRoundedRect()` / 細ライン（`lineStyle`,`lineBetween`）は 4.0 で**回帰バグ**。UI は **塗り専用角丸（`fillRoundedRect`）+ `generateTexture()` キャッシュ**、枠線は「二重塗り」か **`NineSlice`**。 |
| 4 | Text/アイコン | Text は **`resolution` を DPR に合わせる**（拡大時のみ必須）。絵文字/文字グリフ（⚙ 等）を廃し、**SVG を DPR 相当の `scale` でラスタライズ**（`load.svg(key, url, { scale })` は 4.2.0 に実在）。 |
| 5 | 競合UI | 全面背景 + 大型角丸ボタン + ハードシャドウ + 太丸ゴシック（Fredoka / Baloo 2 / M PLUS Rounded 1c）。ボタン高 ≥64pt、角丸 16–24pt、下方向影 4–6pt。**フォントは同梱**する。 |
| 6 | 入力 | `Scale.NONE`+DPR でも **Phaser の `pointer.x/y`・`worldX/worldY` は自動で DPR 補正済み**（`transformX/Y` が `displayScale` を掛ける）。落とし穴は「DOM イベント座標とゲーム座標の混在」。Capacitor は `viewport-fit=cover` + `touch-action:none` + iOS の `contentInset:'never'`。 |
| 7 | ゲームフィール | ライン=**ほぼ剛体**（緩いロープは不可）。本作は既に stiff joint + 角度制限 0.2rad で正解。車速は **モータ 15 rad/s × 車輪 0.3m = 理論 4.5 m/s、実効 2.5–4 m/s**。画面はレベル全体を zoom1 で表示するため **約 0.12–0.35 画面幅/秒**（1 走行 3–8 秒）。 |

---

## 1. フルスクリーン充填 + セーフエリア

### 1.1 Scale モードの選択（4.2.0 ソース検証）

`src/scale/const/SCALE_MODE_CONST.js` に定義される 4.x のモード:

| モード | 値 | 挙動（ソースの説明そのまま） |
|--------|----|------------------------------|
| `NONE` | 0 | Phaser はキャンバスを一切変えない。手動で `scale.resize()` を呼ぶ。 |
| `FIT` | 3 | アスペクト維持で内接 → **レターボックス発生**（現行実装）。 |
| `ENVELOP` | 4 | アスペクト維持で外接（はみ出す）。 |
| `RESIZE` | 5 | 親要素サイズにキャンバスを合わせる。アスペクト無視 → レターボックス無し。 |
| `EXPAND` | 6 | RESIZE のように可視領域を親に合わせ、内側は FIT スケール（3.80 追加）。 |

**「レターボックス無しで 100% 充填」の候補は `RESIZE` か `EXPAND` か `NONE`。**
ところが `RESIZE` は DPR 非対応であり（§2 で論証）、単体では Retina でボヤける。したがって **商用品質では `Scale.NONE` + DPR 手動制御（§2）が正解**。

`RESIZE` の実装確認 —`src/scale/ScaleManager.js` `updateScale()` L1065–1086:

```js
else if (this.scaleMode === CONST.SCALE_MODE.RESIZE) {
    this.displaySize.setSize(this.parentSize.width, this.parentSize.height); // 親=CSSピクセル
    this.gameSize.setSize(this.displaySize.width, this.displaySize.height);
    this.baseSize.setSize(this.displaySize.width, this.displaySize.height);
    // ...
    this.canvas.width  = styleWidth;   // = CSS px。DPR を掛けない！
    this.canvas.height = styleHeight;
}
```

`parentSize` は `getParentBounds()`（L658–702）で `getBoundingClientRect()`（＝CSS ピクセル）から取得。よって **RESIZE のキャンバス・バッキングストア = CSS ピクセル = 1x**。3x 端末では実解像度の 1/3 でしか描かれず、テキスト・細線が明確にボヤける。**RESIZE は zoom すら無視する**（上記ブランチに `zoom` が現れない）ため、DPR を後付けできない。これが「Phaser の RESIZE は Retina でボケる」という定番の苦情の根本原因。

### 1.2 relayout（リサイズ駆動の再配置）パターン

`NONE` モードは **ブラウザリサイズを自動購読しない**（`refresh()` docstring L955「Scale Mode が 'NONE' 以外のときだけ自動」）。よって自前で購読する。

`resize()` は現在の `zoom` を保持する（`src/scale/ScaleManager.js` L831–882、`displaySize = width*zoom` を再計算 → `style.width = width*zoom`）ので、DPR 前提のリサイズは以下で成立:

```ts
function relayout(game: Phaser.Game) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  game.scale.setZoom(1 / dpr);              // CSS 表示サイズ = 実ピクセル/DPR に戻す
  game.scale.resize(cssW * dpr, cssH * dpr); // バッキングストア = 実ピクセル（RESIZE イベント発火）
}
window.addEventListener('resize', () => relayout(game));
// iOS のアドレスバー伸縮・回転対策として visualViewport も併用推奨
window.visualViewport?.addEventListener('resize', () => relayout(game));
```

各 Scene 側の再配置（HUD・ボタンのアンカリング）:

```ts
// RESIZE イベント引数は ScaleManager L993: emit(RESIZE, gameSize, baseSize, displaySize, prevW, prevH)
this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
  this.layout(gameSize.width, gameSize.height); // gameSize は「ゲーム=実ピクセル」空間
});
```

### 1.3 セーフエリア（ノッチ / ホームインジケータ）

**要点: `env(safe-area-inset-*)` は JS から直接読めない**（CSS 値であり `getComputedStyle` でカスタムプロパティを読んでも未解決文字列が返る環境がある）。堅牢な定番手法は **プローブ要素の computed padding を読む**:

```html
<!-- index.html: viewport-fit=cover は設定済み（必須） -->
<div id="safe-probe" style="
  position:fixed; top:0; left:0; visibility:hidden; pointer-events:none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);"></div>
```

```ts
export function readSafeAreaInsetsCss() {
  const el = document.getElementById('safe-probe')!;
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,      // CSS px
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}
// NONE+DPR ではゲーム空間=実ピクセルなので、レイアウトに使うときは × DPR する:
const dpr = window.devicePixelRatio || 1;
const insetTopGamePx = readSafeAreaInsetsCss().top * dpr;
```

**現行 `index.html` の是正点**: いま `#app` に `padding: env(safe-area-inset-*)` を当てて**キャンバス自体を内側に縮めている**（＝実質レターボックス）。フルブリード化するなら `#app` の padding を外し、キャンバスは 100vw/100vh で全面に敷き、**セーフエリアは「ゲーム内 UI の配置マージン」としてのみ使う**（背景は端まで描く／操作 UI はインセット内に置く）。`theme.ts` の `safeArea = {top:47, bottom:34}` ハードコードを上記の実測値に置換する。

出荷ゲームの流儀もこれ: 背景・演出は全面（ノッチ下まで）に描き、タップ対象・重要 HUD だけを `env()` インセットの内側にアンカーする。

Capacitor 側:
- iOS: `capacitor.config.ts` に `ios.contentInset: 'never'` が既に設定済み → WebView がセーフエリア下まで伸びるので **アプリ側でインセット処理が必須**（上記で対応）。
- ステータスバー透過は `@capacitor/status-bar` の `overlaysWebView: true`（Android）で全面化。ジェスチャナビ／ホームインジケータの領域には操作 UI を置かない。

---

## 2. devicePixelRatio シャープネス（最重要・4.2.0 実ソース検証）

### 2.1 Phaser 4 に `resolution` ゲーム設定は「無い」

- `src/core/Config.js` を grep: `resolution` はコメント（TimeStep の時刻精度）にしか現れず、**レンダリング解像度の設定キーは存在しない**。存在するのは `zoom`（L68）、`antialias`/`antialiasGL`（L357/362）、`roundPixels`（L382, 既定 false）、`pixelArt`（L397）、`smoothPixelArt`（L407）。
- `devicePixelRatio` は Phaser 4 の `scale/`・`renderer/`・`textures/`・`core/` の**どこでも使われていない**（`src/device/OS.js` の端末判定と matter-js の描画 libのみ）。
- 結論: **Phaser 4 は DPR を一切自動処理しない。開発者が明示的にバッキングストアを実ピクセルで確保する必要がある。**

> 歴史的経緯: Phaser 3 初期の `resolution` 設定は元々まともに機能せず（issue #3198「devicePixelRatio>1 でボヤける」）、3.50 で廃止 → Phaser 4 でも復活していない。

### 2.2 標準解「NONE + サイズ×DPR + zoom=1/DPR」

コミュニティ標準（supernapie / joshmorony / rexrainbow ノート）で確立し、**4.2.0 ソースの `resize()`/`updateScale()` の挙動と整合する**唯一の全面クリスプ手法:

```ts
const dpr = window.devicePixelRatio || 1;
const game = new Phaser.Game({
  type: Phaser.WEBGL,        // WebGL 明示（AUTO 可、ただし Canvas fallback は品質低）
  parent: 'app',
  backgroundColor: '#101216',
  scale: {
    mode: Phaser.Scale.NONE,                        // 手動制御
    width:  window.innerWidth  * dpr,               // バッキングストア = 実ピクセル
    height: window.innerHeight * dpr,
    zoom:   1 / dpr,                                // CSS 表示は実ピクセル/DPR に縮小
  },
  render: {
    antialias: true,          // WebGL 線形補間（テクスチャ拡縮を滑らかに）
    roundPixels: true,        // 半ピクセル描画を抑止（テクスチャ系のにじみ防止）
    // pixelArt: false        // ドット絵ではないので false（既定）
  },
});
```

**なぜクリスプになるか（`resize()` L845–862 の検証）**: `resize(w,h)` は `canvas.width = baseSize.width = w`(=実ピクセル) にし、`style.width = w*zoom = w/dpr`(=CSS px) にする。よってバッキングストア＝実ピクセル、表示＝CSS ピクセルで **1 デバイスピクセル＝1 キャンバスピクセル**の等倍描画になり、テキスト・ベクタが端末解像度でシャープ。`width/height` を端末アスペクトそのままにするので **レターボックスも出ない**（§1 と両立）。

### 2.3 「固定デザイン座標系」を保つ uiScale レイヤ（本作向けの実務的追加）

NONE+DPR の副作用: ゲーム世界の座標が**実ピクセル**になり、端末ごとに `gameSize` が変わる（例 iPhone 論理414pt×DPR3 = 828 ゲーム px 幅）。本作は `theme.ts` が `390×844` 固定前提なので、そのままだと崩れる。**デザイン言語（390 幅）を維持したまま実ピクセルで描く**には「ルートスケール」を導入する:

```ts
const DESIGN_WIDTH = 390;
// 各 Scene で:
const uiScale = this.scale.gameSize.width / DESIGN_WIDTH; // 例: 828/390 = 2.12
const px = (designUnits: number) => designUnits * uiScale;
// 位置・サイズ・fontSize すべてを px() で通す（後述の通りテキストは resolution=1 で足りる）
```

- 世界レンダは既存の `WorldToPixel` + `levelFraming.framingFor(level, viewport)` が `viewport = gameSize`（実ピクセル）を受ければ自動でスケールするので、**`levelFraming` に渡す viewport を実ピクセルにするだけ**で crisp 化する（`pixelsPerMeter` が DPR 分だけ大きくなる）。
- UI（`theme.ts`/`Button.ts`）は数値を `px()` 経由にするのが移行の主作業。

> 代替（最小変更・ただしレターボックス許容なら）: `FIT` のまま `width/height = DESIGN_WIDTH*dpr, DESIGN_HEIGHT*dpr` にするとデザイン座標を保ったまま crisp 化できる。ただし本タスクの要件「レターボックス無し」に反するので**非推奨**。フルブリードが必須なら NONE+DPR+uiScale。

---

## 3. Graphics 品質と UI レンダリング戦略

### 3.1 既知の Phaser 4.x Graphics 不具合（issue tracker 検証）

| Issue | 内容 | 影響 |
|-------|------|------|
| **#7198**（4.0.0-rc.5, 2025-09） | `lineStyle()`/`lineBetween()` の 1px ライン が**ボヤける/太くなる回帰**（3.85 では正常）。作者回避策: `pixelArt:true` で「一応直る」が副作用あり | 4.0 の WebGL 線テッセレーション回帰。**細い罫線・グリッドが汚い** |
| **#5429** | `strokeRoundedRect()` が**モバイルで誤った線を描く**（線幅>2 で弧の始点に破綻） | Android 実機で角丸枠線が壊れる |
| **#3955** | Stroke rounded rect の視覚アーティファクト（Android のみ） | 同上 |
| **#4004** | `fillRoundedRect()` + `generateTexture()` を Sprite に貼ると歪む | テクスチャ化時の注意点 |

4.1.0 / 4.2.0 CHANGELOG を確認: `strokeRoundedRect` のライン系修正は**入っていない**（4.2.0 は Line の `setTo()` 修正 #7270 のみ）。つまり **細ストローク/角丸ストロークは 4.2.0 でも要警戒**。

**本作は既に踏んでいる**: `Button.ts redraw()` が secondary/danger 変種で
```ts
this.bodyGfx.lineStyle(stroke.ui, s.border, 1);       // stroke.ui = 2
this.bodyGfx.strokeRoundedRect(left, top, w, h, corner);
```
を実行 → #5429/#7198 の対象。Android 実機で枠線が乱れるリスク。

### 3.2 UI レンダリング戦略（決定 + フォールバック）

**決定: UI は「塗り専用 Graphics を `generateTexture()` でテクスチャ化」して Sprite/NineSlice として使う。ストローク（枠線）を避ける。**

理由と手段:
1. **塗り優先**: `fillRoundedRect()` は安定。枠線が欲しければ **二重塗り**（`fillRoundedRect(x-b, y-b, w+2b, h+2b, r+b)` を枠色 → その上に本体色 `fillRoundedRect`）で `strokeRoundedRect` を回避。本作 `Button.ts` は既に「影＝塗り角丸／本体＝塗り角丸」で描いており、**枠線だけを二重塗りに置換すれば #5429 を消せる**。
2. **静的 UI はテクスチャ化**: Phaser 4 ドキュメントも明言—「Graphics が変化しないなら `generateTexture()` で焼くと性能が上がる」「頻繁に更新するならメモリを食うので避ける」。ボタン地・パネルは形状固定なので **`graphics.generateTexture(key, w, h)` → `this.add.image(x,y,key)`**。毎フレーム `clear()+fill` を回さないので GPU/CPU 負荷も下がる。
   - **重要**: テクスチャは **実ピクセルサイズ（= デザインサイズ × uiScale）で焼く**こと。焼いた後に拡大すると再びボヤける（#4004 も同種の罠）。
3. **可変幅パネルは `NineSlice`**（`src/gameobjects/nineslice/` に 4.2.0 実在）: 角丸パネル/ボタンを 1 枚の 9 スライステクスチャにして任意サイズへ破綻なく伸縮。角丸半径がスライスのコーナーに保存されるので、幅可変の UI（ダイアログ、バー）に最適。
4. **`RenderTexture`**（`src/gameobjects/rendertexture/` 実在）: 複数 Graphics/Text を 1 枚に合成キャッシュしたい場合に使用（例: 完成した盤面 UI を 1 ドローコール化）。

**出荷 HTML5 ゲームの実際**: 高品質ハイパーカジュアルは **テクスチャアトラス（TexturePacker 等）に UI パーツを焼き込み**、ランタイムでは Sprite/NineSlice を貼るのが主流。Graphics を毎フレーム描くのは避ける。DOM オーバーレイ UI（`Phaser.DOM` / HTML 要素）は、複雑なテキスト入力やスクロールリスト（設定・ショップの長リスト）には有効だが、ゲーム内 HUD は Phaser 描画に統一した方が座標・演出が揃う。**本作の推奨**: ボタン/パネルはテクスチャ化 Sprite + NineSlice、長スクロール（レベル選択・ショップ）だけ DOM も検討。

**フォールバック順**:
- (A) 塗り角丸 + 二重塗り枠 + `generateTexture` 焼き（第一選択）。
- (B) 可変サイズが多いなら `NineSlice` テクスチャ。
- (C) どうしても `strokeRoundedRect` を使うなら **線幅 ≤2 かつ Android 実機で目視確認**、または `pixelArt:true`（ただし全テクスチャが nearest 補間になり写実背景がジャギる副作用—UI 専用シーンでのみ）。
- (D) 究極のフォールバック: UI を SVG で作り DPR 相当 `scale` でラスタライズ（§4）。

---

## 4. テキスト / アイコンのシャープネス

### 4.1 Text の resolution（4.2.0 実ソース検証）

- `src/gameobjects/text/TextStyle.js` L32: 設定キー `resolution`（既定 **0**）。L247–255 のコメント「既定 0 = ゲーム設定の resolution を使う」。
- しかし **ゲーム設定に resolution が無い**（§2.1）ため、`Text.js` L248–251 で **`resolution===0 → 強制 1`**。つまり**放置すると Text は常に 1x で焼かれる**。
- Text は内部キャンバスに `fontSize × resolution` px でグリフを焼く（`Text.js` L1327–1328 `w*=resolution; h*=resolution;`、L1362 `context.scale(resolution, resolution)`）→ そのテクスチャを表示サイズで WebGL 描画。

**処方（2 通り、アーキテクチャで選ぶ）**:

- **推奨: §2.3 の「サイズを uiScale で事前スケール」方式なら resolution=1 でよい**。`fontSize = designSize × uiScale`（例 18×2.12=38px）で焼けば、テクスチャが最終表示サイズと等倍＝実ピクセル解像度で crisp。追加コスト無し。
  ```ts
  this.add.text(x, y, s, { fontSize: `${px(18)}px`, /* resolution 省略=1 */ });
  ```
- **拡大されるテキストだけ resolution を上げる**: Tween で拡大するスコア表示や、**カメラ zoom がかかる世界空間テキスト**は 1x 焼きだと拡大時にボヤける。この場合だけ `resolution = 最大表示倍率（≒dpr や zoom 上限）` を設定:
  ```ts
  const t = this.add.text(x, y, s, { resolution: dpr });
  t.setResolution(dpr); // API 実在: Text.js L1060 / TextStyle.js L764
  ```
  メモリはテクスチャが resolution² 倍になるので、多数の HUD 数字に一律適用しない（TextStyle コメントの警告どおり）。

> ちなみに `docs.phaser.io` の #6852「テキストが非常にボヤける」も、この resolution 未設定 + 拡大が典型原因。

### 4.2 アイコンのベストプラクティス

**やってはいけない**: 絵文字（⚙ 🔊 等）や記号グリフをアイコンに使う。**フォント依存でプラットフォーム毎に字形が変わり、色・サイズ制御ができず、Retina でボケる/ズレる**。本作の設定画面等で ⚙ 系グリフを使っているなら排除対象。

**推奨: SVG を DPR 相当でラスタライズしてテクスチャ化**。Phaser 4.2.0 は `load.svg` がサイズ指定に対応（`src/loader/filetypes/SVGFile.js` L68–70 `width/height/scale`、L79–127 で SVG を実サイズにリサイズしてから Blob 化 → ラスタライズ）:

```ts
// preload: DPR に合わせて拡大ラスタライズ（アイコン原寸 24pt を実ピクセルで）
const dpr = window.devicePixelRatio || 1;
this.load.svg('ic-settings', 'assets/icons/settings.svg', { scale: dpr });
// もしくは固定サイズで: { width: 24 * dpr, height: 24 * dpr }
// create: 実ピクセルで焼けているので等倍表示すれば crisp
this.add.image(x, y, 'ic-settings').setDisplaySize(24 * uiScale, 24 * uiScale);
```

代替: 単純図形（+, ×, 歯車の外形）は **パス描画 Graphics（塗り）を `generateTexture`** でも良い。ただし §3 のライン不具合を避けるため塗りで。ベクタの元データを持つ SVG→ラスタライズが最も破綻しない。

---

## 5. 競合 UI リファレンスと具体的視覚仕様

Draw Bridge 系（Bravestars「Draw Bridge Puzzle」）/ Draw Climber / Happy Glass に共通する「ヒット作の品質バー」:

**構造**
- **全面（フルブリード）背景**: 空グラデ or 単色をノッチ下まで。レターボックス無し。
- **世界は zoom1 で全体俯瞰**: 解くべき地形が一目で読める（Draw Bridge の売り）。本作 `levelFraming` の思想と一致。
- **操作 UI は下 1/4 と四隅**: 主要ボタン（PLAY/リトライ/次へ）は画面下部中央の**大型**、設定/戻る等は上部四隅の**小型丸ボタン**。すべてセーフエリア内側。

**ボタンメトリクス（デザイン基準 390pt 幅での実測的ガイド）**
| 項目 | 値 | 備考 |
|------|----|------|
| 主要ボタン高 | **64–72pt**（最小タップ 44pt は死守） | 本作 `minTouchTarget=44` はヒット領域下限。見た目はもっと大きく |
| 主要ボタン幅 | 画面幅の 70–86%（≒280–336pt） | 下部フルワイド気味 |
| 角丸 | **16–24pt**（`radius.l=20` は妥当。full pill も可） | Happy Glass は pill 寄り |
| ハードシャドウ | 下方向 **4–6px**、押下で影が潰れて本体が沈む | 本作 `shadowOffsetY=4` + 押下沈み込みは正解 |
| 押下フィードバック | 4pt 下シフト + 影消し（本作実装済み） | claymorphism 的「押せる」感 |
| 配色 | 高彩度の緑/オレンジ主色 + 白面 + 濃色テキスト | 本作 `uiPrimary=0x21c46b` 系で OK |

**タイポグラフィ（最重要の品質差）**
- **太い丸ゴシック**が genre 標準: **Fredoka**（丸く極太、見出し/ボタン）、**Baloo 2**、日本語は **M PLUS Rounded 1c**。数字は太字丸ゴで「チャンキー」に。
- **アウトライン/縁取り**（濃い縁 + 白/明色本体）で背景から浮かせるのが典型。Phaser Text の `stroke`/`strokeThickness` で縁取り可能。
- **本作の是正点**: `theme.ts fontFamily` はシステムフォールバック（Fredoka は「同梱を延期」）。**商用品質にはフォント同梱が必須**（システム丸ゴは端末で字形/太さがばらつき、Latin フォールバックが崩れる）。`@font-face` で woff2 を同梱し、Phaser 起動前に `document.fonts.ready` を待ってから Boot する（FOUT/字形差回避）。CDN 不可（NFR-012）ならローカル同梱。

**タテ長端末のアンカリング**
- 上部 HUD（コイン、進捗、設定）→ `top-inset + margin` にアンカー。
- 下部操作系 → `height - bottom-inset - margin` からの相対。
- 中央の盤面 → `levelFraming` で可変高さにフィット（既存思想を維持）。
- すべて §1.2 の `resize` イベントで再アンカー。固定 Y 座標（現行の 47/34 ハードコード）は禁止。

---

## 6. 入力座標マッピングの落とし穴

### 6.1 Phaser 4 の入力変換（NONE+DPR で自動補正される・ソース検証）

- `ScaleManager.transformX/Y`（L1270–1289）: `(pageX - canvasBounds.left) * displayScale.x`。
- `displayScale` は `refresh()` L976 で `baseSize / canvasBounds`。NONE+DPR では `baseSize.width = innerW*dpr`（実ピクセル）、`canvasBounds.width = innerW`（CSS 表示幅）なので **`displayScale.x = dpr`**。
- 結論: **DOM の CSS 座標 → ゲーム（実ピクセル）座標への DPR 変換を Phaser が自動でやる**。`pointer.x/y`、`pointer.worldX/worldY`、`setInteractive` のヒットテストはすべてゲーム空間で正しく一致する。**手動で DPR を掛ける必要は無い**。

**落とし穴（＝手動でやると二重補正でズレる）**:
- `event.clientX/pageX`（DOM 生値）を**直接**ゲーム座標として使うとズレる。必ず Phaser の `pointer`（既に変換済み）か、必要なら `scale.transformX(pageX)` を通す。
- 本作 `PlayScene` L763–767 は camera zoom/scroll を手動で world↔screen 変換している。NONE+DPR 化後は **camera の zoom は 1 のまま**（DPR は Scale 側で処理され camera には現れない）なので、この式は zoom=1 前提で整合する。`StrokeInput` は `pointer.worldX/worldY`（自動補正済み）→ `WorldToPixel.toWorld` を使えば DPR を意識せず正しい。**混在（DOM 座標と worldX の混用）だけ避ける**。

### 6.2 Capacitor WebView 固有

- **viewport**: `viewport-fit=cover`（設定済み）+ `maximum-scale=1, user-scalable=no`（設定済み）でピンチズーム/ダブルタップズーム抑止。
- **`touch-action: none`**: `html,body,canvas` に設定済み（良い）。ブラウザのスクロール/プルリフレッシュ/ダブルタップ拡大とドロー操作の競合を防ぐ。`overscroll-behavior: none` も設定済み。
- **iOS のジェスチャ競合**: 画面端からのスワイプ（戻る/コントロールセンター/ホーム）はドロー中に暴発しうる。UI の操作対象を端 8–16pt に置かない。ホームインジケータ領域（下 34pt 目安）にドロー開始点が集中しないレベルデザイン。
- **`preventDefault`**: Capacitor WebView では `touchmove` 既定挙動が残ると 300ms 遅延やスクロールが出ることがある。Phaser の入力は `passive:false` で拾うが、`index.html` の `touch-action:none` があれば概ね不要。二重に `preventDefault` すると `pointercancel` が増えるので注意。
- **iOS `contentInset:'never'`**（設定済み）: WebView がセーフエリア下まで伸びる前提で §1.3 のインセット処理を必ず実装。
- **フルスクリーン API は使わない**: `ScaleManager.startFullscreen()` は `pointerup` 必須のブラウザ API（L1290 付近の docstring）だが、Capacitor では WebView 自体が全画面。ネイティブのステータスバー/イマーシブ設定で対応する。

---

## 7. ドローフィジックスのゲームフィール数値目標

### 7.1 ライン剛性（本作は既に正解に到達している）

- **ジャンル標準は「ほぼ剛体」**。Happy Glass の描線は剛体ボディ、Draw Climber の脚も剛体、Draw Bridge の橋は「重み・重力・角度に自然反応するが、弱い/不安定な線は崩れる」= **剛性の高い連結体**。緩いロープ/柔らかいバネは「グニャグニャして気持ち悪く」不採用。
- **本作の実装（`TuningConstants.ts`）は spike で正解に収束済み**:
  - `bridge.jointHertz = 6`, `jointDampingRatio = 0.7`（バネは「装飾」）。
  - **`bridge.jointAngleLimitRad = 0.2`（0.3→0.2 に調整）— コメント「角度制限こそが橋の構造」**。これが剛性の本体。剛体に近い挙動を安価に得る定石（各ジョイントの曲げ角を狭くクランプ）。
  - `segmentLength = 0.8`（0.65→0.8、ジョイント数を減らして sag を抑制）。
  - `breakForceFactor = 10`（実測動的荷重 ~2.6–8.2×static に対応）。
- **処方**: この方針を維持。「柔らかくして面白く」の誘惑に乗らない。剛性＝角度制限で作り、破断は force factor で作る、という現行設計が genre 正解。

### 7.2 車速の数値目標（ソース由来で算出）

`car`（`TuningConstants.ts`）から:
- `motorSpeedBase = 15 rad/s`（後輪モータ角速度, Lv0）、`wheelRadius = 0.3 m`。
- **無スリップ理論線速 = ω × r = 15 × 0.3 = 4.5 m/s**（上限）。
- 荷重・傾斜・タイヤ摩擦（`tireFriction=1.0`）でのスリップを見込み、**実効水平速度 ≈ 2.5–4.0 m/s**。
- 速度アップグレード: `economy.speedPerLevelPct = 5%` × 最大 5Lv = +25% → モータ最大 ~18.75 rad/s → **理論 ~5.6 m/s**。

**画面幅あたりの速度（`levelFraming` から算出）**:
`framingFor()` は **レベル全体を zoom1 でビューポートに内接**させる（`pixelsPerMeter = min(availW/contentW, availH/contentH)`）。したがって「画面幅で見えるメートル数」= レベルの content 幅（横長レベルなら幅、縦制約なら別）。

- 例 `ch1-b1.json`: 地形 X=-12〜20 → contentW≈32m、availH 制約で `ppm≈11 px/m`（390 幅・margin16）。画面幅≈32m。車速 4 m/s → **≈0.125 画面幅/秒**（横断 ~8 秒）。これは広い bonus レベル。
- 標準レベル（content 幅 ~10–16m 想定）: 画面幅≈10–16m、車速 2.5–4 m/s → **≈0.16–0.4 画面幅/秒**、**1 走行の横断 3–6 秒**。

**数値目標（まとめ）**:
| 指標 | 目標値 | 根拠 |
|------|--------|------|
| 車 水平速度（Lv0 実効） | **2.5–4.0 m/s**（理論上限 4.5） | motor 15rad/s × wheel 0.3m |
| 車 水平速度（最大UP） | ~5.6 m/s | +25% |
| 画面横断速度 | **0.15–0.35 画面幅/秒**（標準レベル） | levelFraming zoom1 全体表示 |
| 1 走行の所要時間 | **3–6 秒**（広レベルで最大 ~8 秒） | 上記より |
| ライン剛性 | 角度制限 **0.2 rad**、jointHertz 6、damping 0.7 | 現行 spike 値を維持 |
| 破断閾値 | static 荷重 × **10** | 実測動的share 2.6–8.2× |

「遅めで熟考させる」ペース（車がゆっくり渡り、橋のたわみを見せる）が Draw Bridge の肝。速すぎる（>0.5 画面幅/秒）と物理の見せ場が飛ぶので上限に注意。

---

## 8. 現行コードとのギャップと移行手順（実装チェックリスト）

| # | 現状 | 変更 | 対象ファイル |
|---|------|------|-------------|
| 1 | `Scale.FIT` + 固定390×844 | `Scale.NONE` + `width/height=innerW/H×DPR` + `zoom=1/DPR` + `window resize` 購読 | `src/main.ts` |
| 2 | DPR 未対応 | `render:{ antialias:true, roundPixels:true }` 追加 | `src/main.ts` |
| 3 | デザイン座標固定前提が崩れる | `uiScale = gameSize.width / 390` を導入し UI 数値を `px()` 経由に | `src/render/ui/theme.ts`, 各 Scene |
| 4 | `levelFraming` に固定 390×844 を渡している疑い | viewport に実ピクセル `gameSize` を渡す（world 側は自動 crisp 化） | `PlayScene.ts` |
| 5 | `strokeRoundedRect` 枠線 | 枠線を「二重塗り」に置換、静的地/影は `generateTexture` 焼き | `src/render/ui/Button.ts` |
| 6 | Text `resolution` 未指定 | 事前スケール方式なら resolution=1 のまま。拡大/世界空間テキストは `resolution:dpr` | `theme.makeTextStyle`, 該当 Text |
| 7 | セーフエリア 47/34 ハードコード | プローブ実測（`readSafeAreaInsetsCss()×dpr`）に置換 | `index.html`, `theme.ts` |
| 8 | `#app` に safe-area padding（実質レターボックス） | padding 撤去、キャンバス 100vw/100vh、インセットは UI 配置にのみ使用 | `index.html` |
| 9 | フォントはシステム丸ゴ | Fredoka/Baloo2/M PLUS Rounded 1c を woff2 同梱、`document.fonts.ready` 後に Boot | `index.html`, `BootScene.ts` |
| 10 | ⚙等グリフ（もしあれば） | SVG→`load.svg({scale:dpr})` でラスタライズしテクスチャ化 | assets, `BootScene`/`preload` |

---

## 付録: 検証ソース一覧

**Phaser 4.2.0 ローカルソース（一次・最重要）**
- `node_modules/phaser/src/scale/const/SCALE_MODE_CONST.js` — NONE/FIT/RESIZE/EXPAND 定義
- `node_modules/phaser/src/scale/ScaleManager.js` — `updateScale()` RESIZE分岐(L1065–1086), `resize()`(L831–882), `refresh()`/RESIZE emit(L993), `transformX/Y`(L1270–1289), `getParentBounds()`(L658–702)
- `node_modules/phaser/src/core/Config.js` — resolution 不在の確認、`zoom`(L68), `antialias`(L357), `roundPixels`(L382), `pixelArt`(L397), `smoothPixelArt`(L407)
- `node_modules/phaser/src/gameobjects/text/Text.js`/`TextStyle.js` — `resolution` 既定0→強制1(L248–251), 焼き倍率(L1327–1362), `setResolution`
- `node_modules/phaser/src/gameobjects/graphics/Graphics.js` — `lineStyle`/`fillRoundedRect`/`strokeRoundedRect`/`generateTexture`(L1523)
- `node_modules/phaser/src/gameobjects/nineslice/`, `.../rendertexture/` — 4.2.0 に実在
- `node_modules/phaser/src/loader/filetypes/SVGFile.js` — `svgConfig {width,height,scale}`(L68–127)
- `node_modules/phaser/changelog/v4/4.1/*`, `.../4.2/*` — Graphics ライン修正は未収録（Line `setTo` #7270 のみ）

**GitHub Issues（Graphics 不具合）**
- #7198 https://github.com/phaserjs/phaser/issues/7198 — 4.0 の 1px ライン回帰
- #5429 https://github.com/photonstorm/phaser/issues/5429 — strokeRoundedRect モバイル破綻
- #3955 https://github.com/photonstorm/phaser/issues/3955 — stroke rounded rect Android アーティファクト
- #4004 https://github.com/photonstorm/phaser/issues/4004 — fillRoundedRect+generateTexture 歪み
- #3198 https://github.com/phaserjs/phaser/issues/3198 — DPR>1 ボヤけ（resolution 廃止の背景）

**DPR / Scale 手法**
- Phaser Scale Manager Docs https://docs.phaser.io/phaser/concepts/scale-manager
- rexrainbow Notes https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scalemanager/
- Supernapie「Support retina with Phaser 3」https://supernapie.com/blog/support-retina-with-phaser-3/ （NONE + size×dpr + zoom=1/dpr の一次記述）
- joshmorony Retina/Scaling 記事 https://www.joshmorony.com/how-to-use-retina-graphics-in-html5-phaser-games/
- Phaser Graphics Docs https://docs.phaser.io/phaser/concepts/gameobjects/graphics （generateTexture 性能ガイド）

**競合 UI / ゲームフィール**
- Bravestars Draw Bridge Puzzle（Google Play）https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame — 物理・one-line draw・重み反応
- Draw Climber（CrazyGames）https://www.crazygames.com/game/draw-climber — 剛体脚・速度は形状依存
- Fredoka / Nunito（Google Fonts）https://fonts.google.com/specimen/Fredoka , https://fonts.google.com/specimen/Nunito — 太丸ゴシック

**本作コード（ギャップ分析根拠）**
- `src/main.ts`(Scale.FIT 390×844), `index.html`(#app safe-area padding), `src/render/ui/Button.ts`(strokeRoundedRect), `src/render/ui/theme.ts`(safeArea ハードコード, fontFamily), `src/tuning/TuningConstants.ts`(car/bridge 数値), `src/render/scenes/play/levelFraming.ts`(zoom1 全体表示), `src/render/world/worldToPixel.ts`, `capacitor.config.ts`(contentInset:'never')

# InkBridge — デザインシステム / Design System (Source of Truth)

> 本書はプロジェクトの UI デザイン唯一の正典（single source of truth）である。
> トークン → `src/render/ui/theme.ts`、レイアウト定数 → 各 Scene、チューニング数値 → `src/tuning/TuningConstants.ts` に 1:1 で対応する（§10「Design-as-Code 同期」参照）。
>
> **目的（2026-07-08 の指摘への回答）**: 「ボタン配置やコンポーネント定義が荒い・チープな見た目」を解消する。原因は (a) ボタン寸法が画面ごとにバラバラ（280×64 / 132×48 / 200×52 / 160×56 / 220×56 が混在）、(b) Secondary が白面フラットで「押せる塊」に見えない、(c) アイコン+ラベルの対提示が不徹底、(d) 「ショップ」ラベルが課金か通貨か曖昧、(e) インク資源が細いバー1本で「インク」と読めない、の5点。本書はこれらを研究裏付けのあるトークン/コンポーネント規格で機械的に解消する。
>
> **世界観アイデンティティは不変（keep）**: 昼空シアン #A8E4FF × チョーク白の描線 × マゼンタの旗 × オレンジの車。本書が精緻化（refine）するのは UI クローム（ボタン/カード/HUD/オーバーレイ）のみ。ワールド配色（sky/terrain/ink/stress/goal/car/coin）は据え置く。

---

## 0. 研究サマリと本書への反映（Research → Decisions）

本書の規格はすべて一次情報（Apple HIG / Google Material Design 3 / WCAG 2.2 / NN/g）と実務ガイド（Supersonic・Homa・Voodoo・GameAnalytics・Refactoring UI）に基づく。要点と反映先：

| 研究知見 | 出典 | 本書での反映 |
| --- | --- | --- |
| HUD は「必要最小限」。下1/3はプレイ帯として空ける。要素は全て役割を持つか削除。UI整理で D7 継続率 +20% / ARPU +5% の実績 | Supersonic（[ux-ui-best-practices](https://supersonic.com/learn/blog/ux-ui-best-practices) / [prototype clarity](https://supersonic.com/learn/blog/improve-the-clarity-of-your-hyper-casual-prototype-with-these-3-art-design-tips/)）, Pixune | §7 Play HUD は インクゲージ+レベル+リスタート+ポーズ の4点のみ。下1/3は描画帯として恒久空白 |
| 1画面の主CTAは1つ。支配要素は最大2、サイズ変化は最大3段階。size+color+position で主従を同時表現 | NN/g [visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | ボタンサイズを L/M/S の3段に固定（§4）。各画面 Primary は1つだけ |
| タッチターゲット最小 44×44pt (Apple) / 48×48dp (Material)、間隔 ≥8dp。主CTAは 56–64pt へ拡大。親指緑ゾーン=画面下中央（タップ精度 緑96% vs 伸ばし61%） | Apple HIG, Material, [LukeW touch targets](https://www.lukew.com/ff/entry.asp?1085=), thumb-zone研究 | 全操作要素 ≥44pt。Primary L=280×64 を下部緑ゾーンに。リスタート56×56 |
| アイコン単体は曖昧。home/search/print 以外は常時テキストラベルを併記（recall→recognition） | NN/g [icon usability](https://www.nngroup.com/articles/icon-usability/) | 機能ボタンはアイコン+ラベル対（§4）。単体アイコンは gear/back/restart/pause/play の慣用記号のみに限定 |
| 主CTAの色は1つの高彩度アクセント色を専有。green=進む/確定、red=破壊、grey=無効専用、cancel は無色 | NN/g, UX Movement, Supersonic | `uiPrimary`緑=確定/購入、`uiDanger`赤=破壊、`uiDisabled`灰=無効専用、Secondaryは無色寄り（§3.1） |
| ソフト通貨は常時可視・消費場所の近くに表示。アイコン+数値を必ず対提示。ソフト通貨消費とIAPは別導線・別ラベルに分離 | gamigion, Gamesbrief, Game UI Database | コイン残高ピルを全画面右上に固定。消費先を「強化」に明示（§9） |
| アップセルは失敗/欠乏の瞬間に、欠けた当のものを提示。カタログ全出しは避け短い価値ラダーで | gamigion, Homa, Voodoo | 失敗オーバーレイでインク不足時に「インクを増やす」を文脈提示（§8.4）。強化画面はインク/車速の2枚のみ |
| 60-30-10。CTAアクセントは約10%被覆に抑え、寒色パステルの世界から暖色寄り高彩度で浮かせる | NN/g [60-30-10](https://www.nngroup.com/articles/color-enhance-design/) | ワールド=60/30、UIアクセント緑=10%。強化/コインの金は報酬アクセント（§3.1） |
| radius は大きめ（16–28dp+pill）で「柔らかい玩具」感。ハードオフセット影（blur0/spread0、塗り色の暗トーン）が押下で潰れる=触れる合図。押下は squash + 影潰し | Material 3 [shape](https://m3.material.io/styles/shape/corner-radius-scale), NN/g [neobrutalism](https://www.nngroup.com/articles/neobrutalism/), [Juice It or Lose It](https://garden.bradwoods.io/notes/design/juice) | radius に xl=28 追加。全ボタンに「チャンキー影」規格を確立（§3.4, §4） |
| 8ptグリッド + 4ptサブグリッド。無効は content38%/container12% + フラット化（影除去）。ロックは無効+錠アイコン。状態は色だけで示さない | Material 3 [spacing](https://m2.material.io/design/layout/spacing-methods.html) / [states](https://m3.material.io/foundations/interaction/states/state-layers) | §3.3 スペーシング据え置き（既に4pt準拠）。§4 状態規格を確立 |
| 本文 ≥16px/17pt、最小 11pt。丸ゴシックは「甘い/柔らかい/遊び心」の知覚を強め本ジャンルに適合。CTA/数値は Bold | Apple HIG [typography](https://developer.apple.com/design/human-interface-guidelines/typography), Material 3, RetroStyleGames | §3.2 タイポ据え置き（丸ゴシック方針は既存で正解）。本文16/最小12を維持 |
| WCAG AA: 本文≥4.5:1、大テキスト(≥18pt or 14pt Bold)≥3:1、UIコンポーネント/アイコン≥3:1。閾値は四捨五入不可 | WCAG 2.2 [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) / [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) | §3.1 に実測コントラストを併記。全ペアが AA を満たすことを保証 |

---

## 1. ゲームUIデザイン原則（本作の憲法）

> 本節は「なぜこの規格か」を研究で裏付ける憲法。個別数値は §3–§9。

### 原則1: プレイ帯を汚さない（Clear the play field）
描画フェーズの下2/3は指が動く神聖な領域。HUD は **インクゲージ・レベル番号・リスタート・ポーズの4点のみ**に絞る。コイン残高・強化導線・装飾はプレイ中に一切出さない（Supersonic「more is less」/ 下1/3をプレイ帯に）。走行フェーズは HUD をリスタートのみに減衰させ、他情報は全てワールド内表現（応力色・粉・コインポップ）に委ねる（既存方針を厳守）。

### 原則2: 1画面1主CTA（One dominant CTA）
どの画面も **視覚的に支配する操作は1つ**。それを size + color + position の3手段で同時に押し上げる（NN/g）。Primary は緑 `uiPrimary`・最大サイズ L・下部緑ゾーン。他は Secondary/Ghost に落とす。「スクイントテスト」（画面をぼかして主CTAが残るか）を各画面のレビュー基準にする。

### 原則3: 親指で押せる（Thumb-first）
頻度最高の操作（つづきから / Retry / Next / リスタート）は必ず画面下半分＝親指緑ゾーンに置く。全操作要素は視覚寸法とは別に **≥44pt の当たり判定**を持つ（Apple HIG / Material 48dp）。主CTAは 64pt 高で緑ゾーン中央。破壊的・低頻度操作（設定・戻る）は上コーナー＝赤ゾーンに退避し誤タップを防ぐ。

### 原則4: アイコンは言葉を添える（Icon + Label）
慣用記号（gear/back/restart/pause/play）以外の機能ボタンは **必ずアイコン+ラベルの対**にする（NN/g: home/search/print 以外の単体アイコンは曖昧）。とくに通貨消費導線（強化）はアイコン（コイン）+ラベル（強化）で「これはコインで買う」を非言語的に伝える。

### 原則5: 色は意味に固定（Semantic color, never swapped）
`uiPrimary`緑 = 進む/確定/購入、`uiDanger`赤 = 破壊/危険、`uiDisabled`灰 = 無効専用、無色（枠のみ）= 取消/副次。一度決めた対応は絶対に入れ替えない（NN/g / UX Movement）。灰色は無効以外に使わない（副次ボタンに灰を使うと無効と混同する）。

### 原則6: 通貨は常時可視・消費先を明示（Currency clarity）
単一ソフト通貨「コイン」（UL-013、第二通貨なし・IAPなし・v1.0は課金/広告ゼロ = BR-008）を、**メニュー/リザルト全画面の右上ピルで常時可視**にし、必ずコインアイコン+数値の対で示す（gamigion / Game UI Database）。消費先は「強化」1箇所に集約し、「ショップ/Store」という課金想起語を排して「コインで強化する場所」であることをラベルで確定する（§9）。

### 原則7: アップセルは欠乏の瞬間に、欠けた物を（Contextual upsell）
失敗の瞬間・報酬直後という「欲しさが立つ点」でのみ強化を提示する（gamigion / Homa / Voodoo）。インク切れで橋が届かず失敗したなら、その失敗画面に「インクを増やす」を直接置き、強化画面のインク軸を選択済みで開く。プレイ帯には出さない（原則1）。

### 原則8: チャンキー・ソフト（Chunky soft, juicy press）
「押せる塊」に見せる。大きめ radius + **塗り色の暗トーンのハードオフセット影（blur0/spread0）** が、押下で潰れ本体が影分だけ沈む（＝物理キーの触感）。押下は影潰し + 4pt沈み + squash（既存 Button の挙動を全ボタン共通規格として明文化、NN/g neobrutalism / GDC「Juice It or Lose It」）。影の色は黒でなく塗りの暗トーン（黒はブルータリスト、塗り暗トーンは玩具）。

---

## 2. 競合UIリサーチ（全画面インベントリと2つの意思決定）

> 対象: Happy Glass (Lion Studios), Draw Climber (Voodoo), Love Balls (Ketchapp), Draw Bridge系 (Bravestars/BoomBit)。比較参照として Candy Crush / Toon Blast 系（レベルマップ=ハブ型）。
> 本節は「(a) Home と LevelSelect を分けるか統合か」「(b) 強化/ショップ導線のラベルと通貨明示」を競合証拠で決める。

### 2.1 画面タイプ別インベントリ（一次ソース検証済み）

> 証拠品質: 攻略ガイド/公開レビュー/ストアリスティング/設計分析のテキスト記述に基づく。UIリファレンス（gameuidatabase/interfaceingame/mobbin）はボットブロックでピクセル確認不可のため、未確認は「NV」（Not Verified）と明記（推測なし）。

| 画面 | Happy Glass (Lion) | Draw Climber (Voodoo) | Love Balls (SuperTapx/Lion系) | Draw Bridge系 (BoomBit/Bravestars) | 参照: Candy Crush |
| --- | --- | --- | --- | --- | --- |
| Boot | スキップ可の遊び方動画(Skip右下) | ロゴ→即レース | ローディング→ミニホーム | NV | ロゴ→サガマップ |
| Home/Hub | **ミニタイトル1枚**。Start=**現レベルへ直行**(LSスキップ)。ギア左上 | **ハブなし**。Start→即レース | **独立ミニホーム**(中央緑START・左にLS/音・**右下ストア**) | NV(ワールド選択構造) | **サガマップ=ハブ融合**(下部ナビ Shop/Map) |
| Level Select | 番号グリッド別画面(中央左のボタンから)。★累計で先を解放 | **なし**(純リニア) | 順次解放・タイルに★・スキップ可 | ワールド式(80+) | マップ自体が選択 |
| In-game HUD | **上部の緑インクバー(3セグ=★区間)** / ヒント電球**右上**(100コイン) / ギア左上 / コイン / 下部バナー広告 | **下部中央「DRAW!」パッド** / レベル番号 / コイン | **上部中央インクバー(★マーカー埋込)** / 戻る左上 / シャツ左上 / **ヒント電球+リスタート右上** | 建設:数値**予算(budget)**メーター。Bravestars=**「線は1本」ルール**(メーター無) | 上部:残り**手数の数字** / 下部ブースター |
| Pause | 専用ポーズ記録なし(restart-not-pause型,1試行~5秒) NV | NV | NV | NV | シート型 |
| Clear | ★1-3(インク残量判定)+コイン飛翔。広告でルーレット/2★→3★昇格 | 獲得コイン+**広告×5**→Next | ★+コイン+**動画×2倍** | 3つ星グレード | ★+報酬+Continue |
| Fail | グラス未達/インク切れ→**無料無制限リトライ**。**インク追加販売なし** | コインなし・リトライ | 落下破裂→無限リトライ | 崩落→編集/全消しリトライ | Out of Moves!→金塊+5(ミッドコア) |
| Shop | **コスメギャラリー**(水色15/顔11/鉛筆10=36品,コイン建て)。IAPは別枠($パック/Remove Ads/サブスク) | **独立店なし**。**「Speed/Offline/Arms」アップグレードをコイン**で(切れたら広告) | **シャツアイコン**で3タブ「Pens/Ball Skins/Backgrounds」**全コイン建て** | ヒント2段($0.99 easy mode) | Shopタブ(コイン+$バンドルカード) |

出典: Happy Glass — [Medium 設計分析](https://medium.com/@olinolmstead/happy-glass-game-design-analysis-3700b0186066) / [WriterParty](https://writerparty.com/party/happy-glass-top-tips-walkthrough-cheats-and-strategy-guide/) / [Level Winner](https://www.levelwinner.com/happy-glass-ios-best-tips-tricks-hints/) / [App Store](https://apps.apple.com/us/app/happy-glass/id1425793208)。Draw Climber — [Level Winner](https://www.levelwinner.com/draw-climber-guide-tips-cheats-tricks-to-complete-more-levels/)。Love Balls — [Level Winner](https://www.levelwinner.com/love-balls-cheats-puzzle-solving-tips-tricks/) / [plays.org](https://plays.org/love-balls/)。Build a Bridge — [Rapid Reviews](https://www.rapidreviewsuk.com/build-a-bridge/)。Bravestars Draw Bridge — [Google Play](https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame&hl=en)。Candy Crush — [TechWiser](https://techwiser.com/all-candy-crush-saga-icons-and-symbols-meaning-complete-guide/)。

### 2.2 意思決定A: Home と LevelSelect は **統合**する（ONE Hub 推奨）

**競合証拠（検証済み）**: 調査した物理ドロー系で「**独立したマーケティング的 Home 画面 + 独立した Level-Select**」の2画面構成を持つ作品は**1本もなかった**。支配的パターンは以下の2型のみ:
- **C型（ハイパーカジュアル）**: Draw Climber = Start→即レース、レベル選択画面すら無い純リニア。Helix Jump 等も「Play/Shop/Settings」3アイコンのみ。
- **C寄りハイブリッド（ドロー系の主流）**: Happy Glass = ミニタイトル1枚の Start が**現在レベルへ直行**、レベル選択は「任意参照の別グリッド」。Love Balls / Brain Dots = 中央 START の軽量ミニホーム → レベル選択。いずれも「Start＝再開/直行」で装飾タイトルが play をゲートしない。
- **B型（ミッドコア）**: Candy Crush = **サガマップがハブとレベル選択を融合**。ただしこれはコレクション/装飾メタがあって成立する様式。

InkBridge は★・コイン・強化経済という**進行メタ**を持つため、純C型より Candy-Crush 型の「**グリッド＝ハブ融合**」が適合する。ただし競合の核心的知見「装飾タイトルで play を一段ゲートするな／Start は現在地へ直行させろ」を採り、グリッドを主面に据えつつ「つづきから」を主CTAにする（両者の良いとこ取り）。

**現状の問題**: InkBridge は Home（ワードマーク+あそぶ+ショップ）→ LevelSelect（グリッド）の**2画面**で、Home はワードマークと「あそぶ」ボタンしか持たず、実質「LevelSelect を開くためだけの中継画面」になっている。これは競合が捨てた冗長ゲートそのもので、タップ数を1増やし「チープで薄い」印象の一因。

**決定**: SC-001（Home）と SC-002（LevelSelect）を **1つのハブ画面 `Hub`** に統合する。ハブは開いた瞬間にレベルグリッドを見せ、以下を1画面に配置する:
- **ブランディング**: 上部にコンパクトなワードマーク（画面高25%を専有する巨大ヒーローはやめ、ヘッダ帯に凝縮）
- **レベルグリッド**: 既存 3列タイル（中央スクロール領域）
- **主CTA「つづきから」**: 下部緑ゾーンの Primary L。`findNextLevelId()` の次未クリアレベルへ1タップ（ハイパーカジュアルの「即プレイ」利便をタイル選択の自由と両立）
- **強化導線**: 下部バーの Secondary（コインアイコン+「強化」）
- **設定**: gear（左上・赤ゾーン）
- **コイン残高**: ピル（右上・常時可視）

BootScene は Hub へ直行（従来どおり）。レイアウト詳細は §6。

### 2.3 意思決定B: 「ショップ」→「強化」にラベル変更 + コイン明示

**競合証拠（検証済み）+ 通貨研究**: ドロー系ニッチでは「SHOP」の**文字ラベルは稀**で、テーマ化アイコンが主流（Love Balls=**シャツアイコン**で3タブ、Happy Glass=コスメギャラリー、Brain Dots=ペンコレクション）。消費UIは普遍的に「**コイングリフ+数字のボタン**」、IAPは「**$価格タグ付きバンドルカード**」で視覚分離される（Homescapes teardown / Game UI Database「Currency Store (IAP)」独立分類 / gamigion / Gamesbrief）。とくに**本作に最も近い前例は Draw Climber**で、独立ショップ画面を持たず「**Speed / Offline / Arms のアップグレードボタンをコインで買う**」機能的強化モデル＝まさに InkBridge の2軸強化と同型。「Shop/ショップ/Store」は多くの作品で課金（コインパック・remove-ads）を含む店を指すため、課金を1円も持たない本作で使うと「ここは課金では？」という誤解を生む。

**本作の事実**: コインは単一ソフト通貨（UL-013、第二通貨なし）、**消費先はアップグレードのみ**（インク量/車速の2軸）、v1.0は課金/広告/ネットワーク呼び出しゼロ（BR-008）。つまり当画面は「コインで永続強化を買う場所」であり、「店」ではない。

**候補評価**:

| 候補 | 判定 | 理由 |
| --- | --- | --- |
| ショップ / Store | ✗ | 課金想起。中身（永続強化2軸）と不一致。誤解の元 |
| アップグレード | △ | 意味は正確だが7字カタカナで長くボタン内で窮屈。CJK丸ゴシックの塊感が出ない |
| パワーアップ | △ | 楽しいが「一時ブースター/消費アイテム」を想起させ、永続ステータス強化と齟齬 |
| **強化** | ✓**採用** | 2字・意味明確（永続的な能力向上）・コインアイコンと対で「コインで強化」を非言語で伝達。UL-014/015 の軸名（インク量/車速）とも自然に接続 |

**決定**: 全導線ラベルを **「強化」**（コインアイコン併置）に統一。画面タイトルも「強化」。導線は原則6/7に従い以下に配置（§9 に一覧）:
- **ハブ**: 下部 Secondary「コイン+強化」
- **ポーズシート**: 行「強化」
- **失敗オーバーレイ**: 文脈提示。インク不足が失敗要因なら Primary「インクを増やす」（強化・インク軸を選択済みで開く）。それ以外は控えめな Ghost「強化」
- **クリアオーバーレイ**: 報酬加算後に Ghost/Secondary「強化」（コインが増えた直後＝欲しさが立つ点、原則7）
- **プレイHUD**: 置かない（原則1）

---

## 3. デザイントークン（Refined）

> 既存 `src/render/ui/theme.ts` を基準に、研究が弱いと判定した箇所のみ精緻化（refine）。追加/変更は **NEW / REFINE** で明示。ワールド配色は KEEP。全トークンはコード命名（英語 camelCase）に集約しマジックナンバー散在を禁止（NFR-010）。

### 3.1 カラーパレット

**ワールド（KEEP — 世界観アイデンティティ、変更禁止）**

| token | HEX | 用途 |
| --- | --- | --- |
| `sky` | #A8E4FF | 背景空 |
| `cloud` | #FFFFFF | 雲 |
| `terrainFill` | #A06A3F | 地形本体（土） |
| `terrainGrass` | #6BD24B | 草キャップ |
| `terrainStroke` | #4A2E17 | 地形アウトライン 3px |
| `inkLine` | #F8F5EC | 描線・橋（応力<0.6） |
| `inkBorder` | #2B2440 | 描線ボーダー・UI枠線 |
| `stressMid` | #FFB300 | 応力中間（インク黄も兼用） |
| `stressHigh` | #FF3B30 | 応力最大・破断（インク赤も兼用） |
| `goalFlag` | #FF4F9A | ゴール旗（マゼンタ） |
| `carBody` | #FF7A1A | 車体（+ 既存の carRoof/carGlass 等の付随色は KEEP） |
| `coin` | #FFE14D / stroke #8C6D1F | コイン |
| `star` | #FFE14D / empty #C9C6D9 | 星 |

**UI クローム（REFINE — 「チープ」解消の中核）**

各アクセント色は **500=base（ボタン塗り）/ 700=shadow（チャンキー影・押下面）/ 900=text（濃色文字）/ 100=tint（淡い面）** の役割トーンで持つ（Refactoring UI 9段ランプ / Material 3 トーン間隔でコントラスト保証）。以下は実装に必要な最小セット:

| token | HEX | 役割 | 変更 |
| --- | --- | --- | --- |
| `uiPrimary` | #21C46B | Primaryボタン塗り（緑=確定/購入。アクセントは主CTA専有） | KEEP |
| `uiPrimaryShadow` | #178C4B | Primary チャンキー影/押下面（塗りの暗トーン、黒でない） | KEEP |
| `uiPrimaryText` | #0E3A22 | Primary面上の濃緑文字（白より視認性/彩度調和が高い代替。§下注） | NEW |
| `uiSecondary` | #FFF7E6 | **Secondaryボタン塗り**（純白フラットをやめ、暖色オフホワイト＝クリームの面色で「塊」化） | NEW/REFINE |
| `uiSecondaryShadow` | #E7D9B8 | Secondary チャンキー影（クリームの暗トーン） | NEW |
| `uiPremium` | #FFC531 | 報酬/通貨強調アクセント（コイン購入ボタン塗り・強化の推奨バッジ）。金=報酬（Material/心理） | NEW |
| `uiPremiumShadow` | #C8901A | Premium チャンキー影 | NEW |
| `uiDanger` | #FF3B30 | 破壊操作（進行リセット）・不足額 | KEEP |
| `uiDangerShadow` | #B32820 | Danger チャンキー影 | KEEP |
| `uiDisabled` | #C9C6D9 | 無効塗り（無効専用。副次に灰を使わない） | KEEP |
| `uiDisabledShadow` | #9D9AB0 | 無効影/押下面 | KEEP |
| `uiSurface` | #FFFFFF | カード/モーダル面 | KEEP |
| `uiSurfaceAlt` | #FFF7E6 | パネル副面（クリーム、白の単調さ回避） | NEW |
| `scrim` | rgba(20,18,43,0.6) | モーダル/リザルト暗幕 | KEEP |
| `inkBarHigh` | #21C46B | インク >50%（緑） | KEEP |
| `inkBarMid` | #FFB300 | インク 20–50%（黄） | KEEP |
| `inkBarLow` | #FF3B30 | インク <20%（赤+点滅） | KEEP |
| `textPrimary` | #1E1B33 | 本文・白面/緑面ラベル | KEEP |
| `textSecondary` | #6E6A8A | 補足・キャプション | KEEP |
| `textInverse` | #FFFFFF | 濃色面上テキスト | KEEP |

**Primary文字色の注記（REFINE）**: 現行は Primary面に `textPrimary`(#1E1B33) を載せている（7.0:1、AA可）。視認性は満たすが、より鮮明にしたい場合 `uiPrimaryText`(#0E3A22, 濃緑) は #21C46B 上で ~5.5:1 かつ色相調和が高くプレミアム感が出る。実装は現行 `textPrimary` 維持でも可（AA達成済み）。**白文字(#FFFFFF)は #21C46B 上で 1.9:1 で AA不可なので Primary に白文字を使わない**こと。

**コントラスト実測（AA検証、四捨五入なし）**:
- `textPrimary` on `uiSurface` = 14.9:1（本文AAA）
- `textPrimary` on `uiPrimary` = 7.0:1（本文AA / 大テキストAAA）
- `textPrimary` on `uiSecondary`(#FFF7E6) = ~14.0:1（AAA）
- `textInverse` on `uiDanger` = 3.6:1 → **18pt Bold 以上限定**（大テキストAA）。Danger は枠線ボタン運用（赤枠+赤文字 on 白）を基本にし、赤ベタ面+白文字は使わない
- `uiPrimary`(#21C46B) as UI component on `sky`/`uiSurface` ≥ 3:1（1.4.11可）

**60-30-10 の割付**: 世界（sky/terrain）= 60/30 の寒色パステル基盤。UIアクセント（`uiPrimary`緑）は総被覆 ~10% に抑え、暖色寄り高彩度で世界から浮かせる。`uiPremium` 金は通貨/報酬の局所アクセントに限定（乱用禁止）。

### 3.2 タイポグラフィ（KEEP + 微追加）

丸ゴシック方針（CJKの丸み・遊び心）は本ジャンル適合で既に正解（RetroStyleGames）。スケールは Apple HIG/Material に整合。

| token | size(pt) | weight | 用途 | 変更 |
| --- | --- | --- | --- | --- |
| `display` | 40 | Bold | クリア見出し・大数値・価格 | KEEP |
| `h1` | 28 | Bold | 画面タイトル | KEEP |
| `h2` | 22 | Bold | レベル番号・カード見出し | KEEP |
| `button` | 18 | Bold | ボタンラベル | KEEP |
| `hudNumeral` | 18 | Bold(等幅数字) | コイン残高・インク% | KEEP |
| `body` | 16 | Regular | 本文・設定 | KEEP |
| `label` | 14 | Bold | カード内小見出し・効果値 | NEW（従来アドホックな12/14を統一） |
| `caption` | 13 | Regular | 補足・バージョン | KEEP |
| `labelSmall` | 12 | Bold | タイルのボーナス表記・Lvピップ添字 | NEW（最小12pt = NFR-009） |

- フォントスタック: `"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic UI", -apple-system, system-ui, sans-serif`（KEEP。外部フォント取得なし = NFR-012/013）
- 最小 12pt。行高は 4pt グリッドに載せる（size×1.25 を 4 の倍数へ丸め）。

### 3.3 スペーシング（4ptグリッド, KEEP）

`space1=4 / space2=8 / space3=12 / space4=16 / space6=24 / space8=32 / space12=48`（既存）。追加 `space5=20`（NEW、カード内行間の中間値用・任意）。全レイアウト値は 4 の倍数のみ。

### 3.4 Radius・ボーダー・シャドウ（REFINE — チャンキー化）

| token | 値 | 用途 | 変更 |
| --- | --- | --- | --- |
| `radiusS` | 8pt | トグル・小チップ | KEEP |
| `radiusM` | 12pt | 小カード | KEEP |
| `radiusL` | 20pt | ボタン（L/M）・タイル | KEEP（タイルを 8→**含む場合は 12** 推奨。§4 Tile 参照） |
| `radiusXl` | 28pt | 大パネル・強化カード・オーバーレイ面 | NEW（Material 3 上限。玩具感を上げる） |
| `radiusFull` | 999pt | インクゲージ・コインピル・トグル外形 | KEEP |
| `strokeGame` | 3px | ゲームオブジェクト外周 | KEEP |
| `strokeUi` | 2px | ボタン/カード枠線（`inkBorder`） | KEEP |
| `strokePanel` | 3px | パネル/オーバーレイの太枠（塊感） | NEW（既存 PauseOverlay の ui(3) を token 化） |

**チャンキー影（NEW 規格 — 全ボタン共通）**:
- `shadowDepthL = 6pt`（L primary・大要素。REFINE: 従来一律4→主CTAは6で存在感）
- `shadowDepthM = 4pt`（M/S・カード。= 従来 `shadowOffsetY`）
- 影は `fillRoundedRect` を本体の (0, +depth) にオフセットし、色は各variantの `*Shadow` トーン（塗りの暗トーン、blur0/spread0）。
- 押下: 影を非表示 + 本体を +depth 下移動（既存 Button 挙動）。＝物理キーの沈み込み。
- ぼかし影は使わない（フラット定石 + 描画コスト、NFR-001）。

### 3.5 タッチ/当たり判定（KEEP + 明文化）

`minTouchTarget = 44pt`（全操作要素の最小判定。視覚寸法が小さくても判定は44pt確保）。ターゲット間隔 ≥ `space2`(8pt)。主CTAは視覚 64pt。

---

## 4. コンポーネントカタログ（実装1:1 規格）

> 数値はすべて 390×844 デザインpx。実装時 `layout.ui()` で game px へスケール（既存規約）。各コンポーネントは既存ファイルに対応（§10 マッピング）。

### 4.1 Button（`src/render/ui/Button.ts`）

**Variants**（`styleFor` を拡張）:

| variant | fill | shadow | text | border | 用途 |
| --- | --- | --- | --- | --- | --- |
| `primary` | `uiPrimary` | `uiPrimaryShadow` | `textPrimary` | なし | 主CTA（確定/購入/つづきから/Next/Retry/つづける） |
| `secondary` | `uiSecondary`(#FFF7E6) | `uiSecondaryShadow` | `textPrimary` | `inkBorder` 2px | 副次（強化/Replay/やりなおす/レベル一覧） |
| `premium` | `uiPremium`(#FFC531) | `uiPremiumShadow` | `textPrimary` | なし | 通貨強調CTA（コイン購入ボタン・インクを増やす） |
| `danger` | `uiSurface`(白) | `uiDangerShadow` | `uiDanger` | `uiDanger` 2px | 破壊操作（進行リセット）。赤枠+赤文字 on 白 |
| `ghost` | 透明 | なし（影なし） | `textSecondary` | なし | 低強調テキストリンク（クリアの「強化」「レベル選択」） |
| `icon` | variant色（既定 secondary） | 対応shadow | icon色 | 対応border | 単体アイコン（gear/back/restart/pause） |

**REFINE の要点**: 現状の Secondary は白ベタ+灰枠でフラット→クリーム塗り(#FFF7E6)+濃紺枠2px+チャンキー影に変え「押せる塊」化。これが「チープ」解消の最大レバー。

**Sizes（固定3段 + アイコン — 画面ごとのバラバラを撲滅）**:

| size | W×H(pt) | radius | shadowDepth | font | iconSize | 用途 |
| --- | --- | --- | --- | --- | --- | --- |
| `L` | 280×64 | radiusL(20) | 6 | button(18) | 20 | 画面主CTA（1画面1個） |
| `M` | 220×52 | radiusL(20) | 4 | button(18) | 20 | オーバーレイ内アクション・強化の価格ボタン |
| `S` | 160×44 | radiusM(12) | 4 | button(18) | 18 | 補助アクション・2択の副 |
| `iconM` | 44×44 | radiusM(12) | 4 | — | 24 | gear/back/pause（上コーナー） |
| `iconL` | 56×56 | radiusL(20) | 4 | — | 26 | restart（プレイ右下・親指圏） |

> 移行表: Home「あそぶ」280×64→L / Home「ショップ」132×48→S / Shop「価格」200×52→M / Shop「最大」200×52→M / Result「Replay/Next」160×56→**Sは160×44だが結果は2択並置のため M(220は横に入らない)**… 結果オーバーレイの2択は **横並び時は各 148×52（= “M-narrow”）** を許容例外とする（§6.4 参照）。それ以外は L/M/S に必ず一致させる。

**内部メトリクス**:
- アイコン+ラベルは中央グルーピング、アイコン先行、`ICON_LABEL_GAP = 6pt`（既存）。
- ラベル左右パディング最小 `space3`(12pt)。ラベルがW-2×paddingを超える場合はサイズを1段上げる（切り詰め禁止）。
- 当たり判定 = max(W,44)×max(H,44)（既存）。

**States**（Material 3 準拠 + チャンキー）:

| state | 表現 |
| --- | --- |
| default | 満彩度塗り + チャンキー影（浮き） |
| pressed | 影非表示 + 本体 +depth 沈み + （任意）squash scale 0.98。tap SFX + light haptic（既存 services 経由） |
| disabled | 塗り=`uiDisabled` / 影=`uiDisabledShadow`だが**影を出さずフラット化**（押せない=浮かせない）+ ラベル `textInverse`。無効は色だけでなく「平ら」で示す |
| locked | disabled 表現 + 錠アイコン重畳（Tile 用。§4.5） |

### 4.2 CoinPill（`src/render/ui/CoinCounter.ts`, KEEP + 拡張）

- 右アンカーのピル。height 32pt・`radiusFull`・`uiSurface`塗り・`inkBorder` 2px枠。
- 内容: 左パディング`space3` → コインアイコン(直径16pt, `coin`+`coinStroke`) → gap`space2` → 残高 `hudNumeral`(18 Bold) → 右パディング`space3`。桁変化で右端が動かない（既存）。
- 全画面（ハブ/強化/クリア）で同値・同表記（FR-018 / 原則6）。
- **NEW（任意・推奨）**: ハブと強化画面ではピル自体をタップ可にし「強化」へ誘導（消費先の学習）。IAPが無いため「+（コイン購入）」バッジは付けない（誤解防止）。プレイHUDにはコインピルを置かない（原則1）。

### 4.3 UpgradeCard（`src/render/scenes/ShopScene.ts` のカード, REFINE）

- 寸法: 幅 = 画面幅 − 2×`space4`（左右16pt）/ 高さ **184pt** / `radiusXl`(28)（REFINE: 12→28 で玩具感）/ `uiSurface`塗り + `inkBorder` `strokePanel`(3px) + チャンキー影 depth4（`uiSecondaryShadow`）。
- レイアウト（上→下）:
  1. **ヘッダ行**（top+`space4`）: 左= 軸アイコン(28pt: `ink` / `speed`) + 軸名 `h2`（「インク量」/「車速」）｜ 右= Lvピップ5個（直径12pt, 取得=`uiPrimary`塗り/未取得=`uiSurface`+`uiDisabled`枠2px, 間隔20pt）+ 右端に `Lv{n}` `h2`
  2. **効果行**（top+78pt）: `効果: +{cur}% → 次Lv +{next}%`（`label` 14, `textSecondary`）。MAX時 `効果: +{cur}%（MAX）`
  3. **価格ボタン**（中央, top+132pt, size M）:
     - 購入可: variant `premium`（金・通貨強調）or `primary`（緑・確定）。**本作は `premium` 金を採用**（コイン消費の通貨アクセント）。ラベル= コインアイコン(20) + 価格 `hudNumeral`。価格は大きく（誤購入予防, FR-019）
     - 残高不足: `setEnabled(false)`（フラット灰）+ 下に `あと {shortfall}` `caption` `uiDanger`
     - MAX: ラベル「最大」・`secondary` 無効
- **NEW（文脈バッジ）**: 失敗オーバーレイの「インクを増やす」から遷移した場合、インク量カードの右上に `おすすめ` バッジ（`uiPremium`塗り・`labelSmall`）を出し、当該カードを先頭表示。
- 価格曲線（game_design §7.2）: Lv1=75 / Lv2=90 / Lv3=110 / Lv4=130 / Lv5=155（両軸同一, `economy.upgradePriceBase=75`, growth 1.20）。効果: インク +10%/Lv、車速 +5%/Lv、Max Lv5。

### 4.4 Tile（`src/render/scenes/LevelSelectScene.ts`→ Hub, REFINE）

- 96×96pt / **`radiusM`(12)**（REFINE: 8→12 で友好化）/ `inkBorder` `strokeUi`(2px) + チャンキー影 depth4。当たり判定96×96。
- 中身: レベル番号 `h2`（中央やや上, y=−22pt）/ 星3個（y=+24pt, 各16pt, 間隔18pt, 取得=`star`塗り/未取得=`starEmpty`輪郭）。
- **States**:

| state | fill | 追加 |
| --- | --- | --- |
| locked | `uiDisabled` | 錠アイコン(`lock` NEW, `textSecondary`) + 番号 `textSecondary` + **影なしフラット** |
| unlocked-uncleared | `uiSurface` | 星3輪郭のみ |
| cleared | `uiSurface` | ベスト星数塗り |
| next（次に遊ぶ） | `uiSurface` | scale ±5% / 0.8s 脈動（既存） |
| bonus | `coin`(金地) | `labelSmall`「ボーナス」。錠時は `uiDisabled` |

- ロック時タップ: 6px シェイク×3 + 「前のレベルをクリア」ヒント（既存）。

### 4.5 Toggle（`src/render/ui/Toggle.ts`, KEEP）

- 外形 51×31pt・`radiusFull`。ON=`uiPrimary`地/OFF=`uiDisabled`地。つまみ 27pt円 白 + `inkBorder`。当たり判定はパディングで44pt確保。即時反映+永続（FR-020/021）。

### 4.6 Overlay / Panel（共通規格, NEW 明文化）

- Scrim: 全面 `scrim`(rgba(20,18,43,0.6))。クリアは 150ms フェードイン、失敗は即時（既存 goal.scrimFadeInMs）。scrim 自体をタップ可にしスキップ/何もしないを制御。
- Panel: `uiSurface`（または `uiSurfaceAlt` クリーム）/ `radiusXl`(28) / `inkBorder` `strokePanel`(3px) / チャンキー影 depth6。
- Panel内タイトル `h2` 上寄せ、アクションは縦積み（gap 18pt）または横2択（§6.4）。

### 4.7 HUD要素

**InkGauge（`src/render/draw/InkBarView.ts`, 全面 REFINE — 「インクと読める」化）**

現状の細い234×14バー1本を、**インク瓶アイコン + 塗りバー + 数値%** の複合ゲージに再設計する（ユーザー要望「インク使用がわかるUI」）。

- 位置: 上中央、レベル番号の直下（`safe.top + 24pt` 付近, `setScrollFactor(0)`）。
- 構成（左→右, 横並び, 中央揃え）:
  1. **インク瓶/ペン先アイコン**（NEW `ink` icon, 直径 22pt）: 応力ゾーン色でティント（ok=`inkBarHigh`緑 / low=`inkBarMid`黄 / critical=`inkBarLow`赤）。
  2. **塗りバー**: 幅 **216pt** × 高さ **18pt**（REFINE: 14→18 で視認性）・`radiusFull`。トラック= `uiSurface` α0.4 + `inkBorder` 2px。塗り= ゾーン色、幅 = 216×remainingRatio。
  3. **数値ラベル**: `{percent}%`（`hudNumeral` 18 Bold, `inkBorder`色 or ゾーン色）。残量比を四捨五入した整数%。
- **★閾値マーカー（NEW・競合実証パターン）**: バー上に**★2/★3 の消費閾値を小さな星ティック**として刻む。これは物理ドロー系で唯一実証されたインク可視化パターン — Happy Glass（上部緑バーを3セグメント=★区間に分割）と Love Balls（バー上に★マーカーを埋込）が採用し、「**制約（描ける量）と採点（星）を同一UI要素で伝える**」（[Level Winner: Love Balls](https://www.levelwinner.com/love-balls-cheats-puzzle-solving-tips-tricks/) / [WriterParty: Happy Glass](https://writerparty.com/party/happy-glass-top-tips-walkthrough-cheats-and-strategy-guide/)）。実装: 星3閾値 ≈ 消費 40–50%（＝残量 50–60%地点）、星2閾値 ≈ 消費 60–70%（＝残量 30–40%地点）に、`starEmpty`色の小星(10pt)を左端起点で配置。まだ星を割れる残量なら該当星を `star`色で点灯。これにより「ここで指を離せば★3」が描画中に読める（レベルごとの実閾値は level JSON の star thresholds から算出、game_design §7.4）。
- 低インク挙動（既存踏襲 + 強化）: <50% 黄 / <20% 赤 + 300ms点滅（`ink.blinkPeriodMs`）。アイコンも同色にシフト（色の二重符号化）。枯渇時: 描画不可 + 横シェイク 4–6px/150ms（`ink.depleteShakePx/Ms`）+ 空振り音 + warning haptic（NFR-009 二重符号化）。
- **アップセルは出さない**（原則1: プレイ帯を汚さない）。インク増強の導線は失敗画面/強化画面に集約（§8.4, §9）。

**RestartButton**: `iconL`(56×56, `restart`アイコン, variant secondary), プレイ右下・`safe`右端/下端から各16pt（親指圏, 描画・走行で同位置=P4一貫）。

**PauseButton**: `iconM`(44×44, `pause`アイコン, secondary), 左上・`safe`左上端 + `space4`。走行フェーズでは非表示（HUDはリスタートのみ）。

**LevelLabel**: `LEVEL {n}` or `{n}`（`h2`, `textPrimary`）, 上中央 `safe.top + 8pt`。発進の溜め中に150msフェードアウト（走行フェーズ, FR-005）。

**PauseSheet（`src/render/scenes/play/PauseOverlay.ts`, REFINE — 強化行追加）**

- Panel（§4.6）+ タイトル「ポーズ」`h2`。行（size M, 縦積み gap18）:
  1. 「つづける」primary
  2. 「やりなおす」secondary
  3. **「強化」secondary**（NEW・コインアイコン。§9 全画面導線）
  4. 「レベル一覧」ghost/secondary
- パネル高は行数に応じ再計算（既存ロジック）。

### 4.8 新規アイコン（`src/render/ui/icons.ts` に追加, fill-only）

既存: gear/back/restart/play/coin/pause。**NEW 追加**:
- `ink`: インク瓶（台形ボトル + 短いペン先/滴）または万年筆ニブ。塗りのみ、size内中央、単色ティント可。
- `speed`: 稲妻（既存ブリーフの⚡想定）。塗りのみ。
- `lock`: 南京錠（shackleリング + body矩形。既存 drawLock を icon 化）。
- 全て `drawIcon(g, name, size, {color})` 契約に合わせ、strokePath不使用（fill-only, research §3 のPhaser4線バグ回避）。

---

## 5. 画面インベントリ（統合後）

| ID | 画面 | 変更 |
| --- | --- | --- |
| Boot | 起動 | KEEP（Hubへ直行） |
| **Hub** | ハブ（旧 Home + LevelSelect 統合） | **NEW 統合**（§6.1） |
| Play(draw) | 描画フェーズ | HUD REFINE（InkGauge, §6.2） |
| Play(run) | 走行フェーズ | KEEP（HUDリスタートのみ） |
| Pause | ポーズシート | REFINE（強化行, §6.3） |
| Clear | クリアリザルト | REFINE（強化リンク, §6.4） |
| Fail | 失敗リザルト | REFINE（インクを増やす文脈CTA, §6.4） |
| **強化** | 旧ショップ | REFINE（ラベル/カード, §6.5） |
| Settings | 設定 | KEEP |

---

## 6. 画面別レイアウト仕様（390×844・safe 上47/下34pt）

> 各画面「アンカーマップ」を上/下safeバー + 中央領域で規定。座標は design px。

### 6.1 Hub（統合ハブ）

```
┌───────────────────────────────┐  safe.top(47)
│ [⚙ 44]   InkBridge   (◎ 1,250)│  上バー: gear左 / ワードマークh1中央 / コインピル右
├───────────────────────────────┤  y = safe.top + 16 + 44
│  ┌────┐ ┌────┐ ┌────┐         │
│  │ 1  │ │ 2  │ │ 3  │         │  レベルグリッド（3列 / タイル96 / 間隔16）
│  │★★★│ │★★☆│ │★☆☆│         │  中央スクロール領域
│  └────┘ └────┘ └────┘         │  gridTop = 上バー下端 + space6(24)
│  ┌────┐ ┌────┐ ┌────┐         │
│  │ 4  │ │ 5  │ │ B1 │         │
│  └────┘ └────┘ └────┘  …      │
├───────────────────────────────┤  下バー（固定・スクロールに追従しない）
│  [◎ 強化 S]    ┌──────────┐   │  強化=左S secondary
│                │ つづきから │   │  つづきから= Primary L (280×64)
│                └──────────┘   │  下端 = safe.bottom + space8(32)
└───────────────────────────────┘  safe.bottom(34)
```

- **上バー**（y = `safe.top + space4 + 22`）: gear `iconM` 左（`safe.left + margin+22`）/ ワードマーク `h1` 中央（巨大ヒーローは廃し帯に凝縮）/ コインピル 右（`width - safe.right - margin`）。
- **グリッド**: 既存 3列。gridWidth = 3×96 + 2×16 = 320pt、中央寄せ。gridTop = 上バー下 + `space6`。縦スクロール（タイル数18: 15+3）。
- **下バー（固定）**: 
  - 「つづきから」`primary L`（280×64）中央、下端 `safe.bottom + space8`。onClick → `findNextLevelId()` の Play（全クリア時は「最初から」or 直近レベル）。アイコン `play`。
  - 「強化」`secondary S`（160×44）左寄せ、つづきからの上/左に非交差配置（コインアイコン+「強化」）。
- **主CTA**は「つづきから」1つ（原則2）。タイル選択は副次動線として常時可能。
- 移行: HomeScene を廃し LevelSelectScene を Hub に格上げ（下バーに つづきから/強化 を追加、上バーに gear/ワードマーク/コイン）。

### 6.2 Play — 描画フェーズ

```
┌───────────────────────────────┐
│ [⏸44]        LEVEL 7          │  pause左上 / レベル番号上中央(h2)
│         🖋[████████░░] 78%     │  InkGauge: 瓶アイコン+バー216×18+数値%
│                                │
│              ▶旗               │  ← 全景静止俯瞰（下2/3は描画帯・空白厳守）
│   車  ＼谷／                    │
│        ～描いた線～             │
│                     ┌────┐     │
│                     │ ↺56│     │  restart 右下（親指圏）
└─────────────────────┴────┴─────┘
```

- pause `iconM` 左上 / LevelLabel `h2` 上中央（`safe.top+8`）/ InkGauge その直下（§4.7）/ restart `iconL` 右下（各16pt）。
- 下2/3は描画キャンバス（HUD禁止領域, 原則1）。コイン/強化はプレイ中に出さない。

### 6.3 Pause（§4.7 PauseSheet）

- 中央 Panel（§4.6, `radiusXl`, 太枠, 影depth6）。行4（つづける/やりなおす/強化/レベル一覧）size M 縦積み gap18。scrim 背景。

### 6.4 Clear / Fail（`ResultOverlay.ts`, REFINE）

**Clear**:
```
┌───────────────────────────────┐
│ [レベル選択 ghost]   (◎ 1,274) │  左上ghost / コインピル右（加算後）
│        ★   ★   ★              │  星 順次 200-300ms
│           + 24 ◎               │  獲得コイン display(40)
│   ┌─────────┐   ┌─────────┐    │  横2択（各148×52）
│   │ Replay  │   │ Next ▶  │    │  Replay=secondary / Next=primary(脈動)
│   └─────────┘   └─────────┘    │
│            [ ◎ 強化 ]           │  ghost/secondary（報酬直後の文脈アップセル）
└───────────────────────────────┘
```
- 星3（各88pt相当のバースト演出は既存 GoalSequence）/ 獲得コイン `display` / コインピル右上（加算後値）。
- アクション: 横2択「Replay」`secondary` +「Next/一覧へ」`primary`（各148×52・中心 ±92pt, 既存配置踏襲）。Next は演出とデカップルで ~0.9s後に活性+脈動（既存 goal.nextActivateDelaySec）。
- **NEW**: 2択の下に「強化」`ghost`（コインアイコン）。報酬でコインが増えた直後の自然な導線（原則7）。scrim全域タップ=演出スキップ（既存）。

**Fail**:
```
┌───────────────────────────────┐
│ [レベル選択 ghost]             │
│   ◎←折れ口リング(colorStressHigh)│  失敗原因ハイライト（ワールド内・KEEP）
│        ざんねん                │  h1 textInverse
│      橋が落ちてしまった          │  原因ヒント body
│      ┌──────────────┐          │
│      │  ↺ Retry L    │          │  Retry=primary L（即活性）
│      └──────────────┘          │
│   （インク不足時のみ）           │
│      [ 🖋 インクを増やす ]       │  premium M（文脈アップセル・§8.4）
└───────────────────────────────┘
```
- 「ざんねん」`h1` / 原因ヒント `body`（fall=橋が落ちてしまった 等, 既存 FAIL_HINT）/ Retry `primary L` 即活性（280×64, 下部緑ゾーン）。
- **NEW 文脈アップセル**: 失敗時に「インク使用率が高く（例: 消費 ≥ 有効予算の90% or インク切れ発生）かつ橋が目標に届かず失敗」の条件を満たす場合のみ、Retryの下に「インクを増やす」`premium M`（`ink`アイコン）を出し、強化・インク軸を選択済みで開く（§8.4）。条件を満たさない失敗（転倒/タイムアウト等）では出さない（乱用回避, 原則7）。
- 追加演出なし・軽量暗転（40%）+ 短い残念音のみ（既存, FR-013）。崩落は検死可能に残す。

### 6.5 強化（旧 ShopScene, REFINE）

```
┌───────────────────────────────┐
│ [← 44] 強化          (◎ 1,274) │  back左 / タイトル「強化」h1 / コインピル右
│ ┌───────────────────────────┐ │
│ │ 🖋 インク量    Lv2 ●●○○○   │ │  UpgradeCard（§4.3, radiusXl, 太枠, 影）
│ │ 効果: +20% → 次Lv +30%     │ │
│ │      [ ◎ 90 ]  premium M   │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ ⚡ 車速       Lv0 ○○○○○   │ │
│ │ 効果: +0% → 次Lv +5%       │ │
│ │      [ ◎ 75 ]              │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```
- back `iconM` 左上 / タイトル「強化」`h1`（gear位置の右）/ コインピル右上。
- カード2枚（インク量/車速, §4.3）縦積み・間隔 `space6`。価格ボタンは `premium`（金・通貨強調）。
- 呼び出し元へ戻る（Hub/Pause/Clear/Fail のいずれか。戻り先を保持）。

---

## 7. モーション原則（KEEP）

- イージング4種: `Back.Out`(pop) / `Quad.Out`(settle) / `Sine.InOut`(脈動/点滅) / `Quad.InOut`(シェイク)。
- Duration: 画面遷移200–300ms / ボタン押下 即時 / 確定pop 120ms / 脈動0.8s周期。
- チャンキー押下（影潰し+沈み）は全ボタン共通（§3.4）。juice演出は `TuningConstants.goal.*` に一元化（NFR-010）。

---

## 8. リソース可視化とアップセル（インク特集）

### 8.1 インクの意味
インクは「1回の挑戦で描ける橋の総延長（world m）」。`effectiveBudget = level.inkBudget × (1 + inkCapacityLv × 0.10)`（Lv5で+50%）。Lv0で全レベルクリア可能を維持（BR-005）。インク切れは**失敗ではなく描画停止**（残りで走行判定へ）。

### 8.2 「インクと読める」ゲージ（§4.7 InkGauge）
瓶アイコン + 塗りバー(216×18) + 数値% の複合。細い棒1本を廃し、アイコンで「これはインク資源」を明示。ゾーン色は色+アイコン+点滅+シェイクで二重符号化（NFR-009）。

### 8.3 増強アップセル（分かりやすさの設計）
- **強化画面**: インク量カードを常設（§4.3）。効果を「現在→次Lv」の数値で明示（+10%/Lv）。価格は `premium` 金ボタンで通貨消費を明示。
- **失敗の文脈提示（§6.4/§8.4）**: インク不足で失敗した瞬間に「インクを増やす」を直接提示（欠けた当のものを、欲しさが立つ点で = gamigion/Homa）。
- **クリア直後**: コイン加算直後に「強化」導線（原則7）。
- **プレイHUDには出さない**（原則1）。

### 8.4 インク不足失敗の判定（実装契約）
失敗オーバーレイで「インクを増やす」`premium M` を出す条件（AND）:
1. `failCause` が `fall`（橋が届かず落下）— 転倒/タイムアウト/divergence は対象外
2. `inkBudget.consumed ≥ inkBudget.effectiveBudget × 0.9`（インクをほぼ/完全に使い切った）
3. `inkCapacityLv < economy.maxUpgradeLevel`（強化余地がある）

満たせば「インクを増やす」→ 強化画面をインク軸選択済み（`おすすめ`バッジ, §4.3）で開く。満たさなければ通常の Retry のみ（乱用回避）。

> **競合エビデンスと設計上の但し書き（重要・正直な限界）**: 調査した物理ドロー系で「**インク切れ→インク追加販売**」を行う作品は**1本も無い**。失敗は常に**無料・無制限リトライ**であり、「out of ink → buy more ink」は本ジャンルに前例がない（Happy Glass / Love Balls / Brain Dots いずれもリトライ無料）。「資源切れ→ハード通貨で継続」は Candy Crush「Out of Moves!→金塊で+5」等の**ミッドコア様式**である。したがって本作の「インクを増やす」は、そのミッドコアの誘導とは**別物として設計する**:
> 1. **Retry を絶対にゲートしない**: Retry は常に無料・即時・主CTA（下部緑ゾーン L）。「インクを増やす」はその**下**の副次 `premium M`。プレイ続行に課金/消費を要求しない（罰なし=P3, FR-004）。
> 2. **消費は earned coin・対象は永続強化**: この試行だけの消費アイテムではなく、`inkCapacityLv` の**永続アップグレード**（全レベルに効く）へ誘導する。実マネーではなくコイン消費なので、プレイヤー敵対的な pay-to-continue にはならない。
> 3. **文脈条件を厳守**（上記AND）して乱用しない。転倒/タイムアウトでは出さない。
>
> この設計は「ユーザー要望（インク増強を分かりやすく）」を満たしつつ、ジャンルの『失敗は無料』規範を尊重する折衷。A/Bで出現率・文言・配置を検証すること（Supersonic「never assume — A/B test placement」）。

---

## 9. 「強化」全画面導線マップ（原則6/7）

| 画面 | 導線 | 形 | 条件 |
| --- | --- | --- | --- |
| Hub | 「強化」 | `secondary S`（コイン+強化） | 常設 |
| Hub | コインピル | タップで強化へ（任意） | 常設 |
| Pause | 「強化」 | 行 `secondary M` | 常設 |
| Fail | 「インクを増やす」 | `premium M`（ink） | インク不足失敗時のみ（§8.4） |
| Fail | 「強化」 | `ghost` | 上記非該当時（控えめ） |
| Clear | 「強化」 | `ghost/secondary`（コイン） | 報酬加算後 |
| Play(HUD) | なし | — | 原則1で禁止 |

- ラベルは全て「強化」（+コインアイコン）で統一。課金想起語（ショップ/Store/購入）は画面タイトル/導線から排除（価格ボタン内の金額表示は可）。

---

## 10. Design-as-Code 同期（実装マッピング）

> 実装エージェントが本書 → コードを1:1で反映するための対応表。

| 本書 | コード位置 | 変更種別 |
| --- | --- | --- |
| §3.1 UIカラー追加（uiSecondary/uiPremium/uiSurfaceAlt 等） | `src/render/ui/theme.ts` `color` | MODIFY（キー追加） |
| §3.2 typeトークン label/labelSmall | `theme.ts` `type` | MODIFY（追加） |
| §3.4 radiusXl / strokePanel / shadowDepthL(6) | `theme.ts` `radius`/`stroke`/新規 | MODIFY（追加）。`shadowOffsetY`→ `shadowDepthM`(4) 名整理 + `shadowDepthL`(6) |
| §4.1 Button variants(premium/ghost) + sizes(L/M/S) | `src/render/ui/Button.ts` `styleFor`/`ButtonVariant` + size preset | MODIFY |
| §4.3 UpgradeCard（radiusXl/premium価格/おすすめバッジ） | `src/render/scenes/ShopScene.ts` | MODIFY |
| §4.4 Tile radius 12 + フラット無効 | `LevelSelectScene.ts`→Hub | MODIFY |
| §4.7 InkGauge（アイコン+%） | `src/render/draw/InkBarView.ts` | MODIFY（大） |
| §4.7 PauseSheet 強化行 | `src/render/scenes/play/PauseOverlay.ts` | MODIFY |
| §4.8 新規アイコン ink/speed/lock | `src/render/ui/icons.ts` `IconName`+draw関数 | MODIFY（追加） |
| §6.1 Hub 統合 | `HomeScene.ts` 廃止 / `LevelSelectScene.ts`→`Hub` 格上げ + 下バー | CREATE/MODIFY（`BootScene` の遷移先も更新） |
| §6.4 Clear 強化リンク / Fail インクを増やす | `ResultOverlay.ts`（`FailOverlayData` に ink文脈フラグ追加） | MODIFY |
| §9 強化ラベル統一 | 各 Scene のラベル文字列（'ショップ'→'強化'） | MODIFY |
| 価格Lv4=130 の欠番補完 | `TuningConstants economy`（式で導出済み。表記のみ） | NOOP |

**UL整合**: 「強化」導入は UL に新語追加が必要（`.specify/memory/conventions.md` と `designs/ubiquitous_language.md` に「強化 = アップグレード画面/導線の総称。軸名はインク量/車速を維持」を追記してから実装）。軸名「インク量」(UL-014)/「車速」(UL-015) は不変。「Restart/Retry/Replay」等の既存拘束語は不変。

**HEAL（Figma生成時の自己修復）**: 本書のトークン表を正とし、Figma Variables 生成後は §3 の HEX/サイズと Figma 変数の差分を検出→本書優先で修正。Figma未生成の現段階では theme.ts が実効ソース。

---

## 11. 実装受け入れ基準（Definition of Done）

- [ ] ボタン寸法が L/M/S/iconM/iconL のいずれかに一致（画面固有寸法の全廃。結果2択のM-narrow 148×52 のみ許容例外）
- [ ] Secondary がクリーム塗り+濃紺枠+チャンキー影で「押せる塊」に見える
- [ ] 機能ボタンがアイコン+ラベル対（慣用単体アイコン除く）
- [ ] 「ショップ」表記が全画面から消え「強化」（+コインアイコン）に統一
- [ ] コイン残高ピルがメニュー/リザルト全画面の右上に同値表示、プレイHUDには非表示
- [ ] InkGauge が 瓶アイコン+バー(216×18)+数値% で「インク」と読める
- [ ] 失敗×インク不足で「インクを増やす」が出て強化インク軸へ遷移（§8.4条件）
- [ ] Home が廃止され Hub 1画面（つづきから Primary + グリッド + 強化 + コイン + 設定）
- [ ] 全テキスト/UIコントラストが WCAG AA（§3.1 実測）を満たす
- [ ] 無効/ロックが色だけでなくフラット化/錠アイコンで区別される
```

<!-- 引用一覧は §0/§1 各行のインラインURL。主要出典: Apple HIG, Material Design 3, WCAG 2.2, NN/g(visual hierarchy/icon usability/neobrutalism/60-30-10), Supersonic, Homa, gamigion, Gamesbrief, Game UI Database, Refactoring UI, "Juice It or Lose It"(GDC 2012). -->

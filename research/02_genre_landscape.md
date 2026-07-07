# 「線を引く（draw-to-play）」ジャンル勢力図調査 — 2026年7月版

> 調査日: 2026-07-07 / 調査者: ハイパーカジュアル市場アナリスト（Claude）
> 対象: line-drawing / draw-to-play メカニクスを持つモバイル・Webゲーム群と、比較対象としての物理走行メタの王者 Hill Climb Racing
> 注記: 確度は「高（複数ソースで裏取り済み）/ 中（単一ソースまたは推定値）/ 低（推測・分析）」で明記。

---

## エグゼクティブサマリー

1. **「線を引く」ジャンルのDLヒットは 2018〜2022 年に集中**（Love Balls / Happy Glass → Draw Climber / Draw Joust / Scribble Rider → Save the Doge）。**2025-2026 年にトップチャート級の新規 line-drawing ヒットは確認できなかった**（確度: 中）。
2. ただし**ジャンルは死んでいない**。ロングテール化して (a) Google Play のクローン群（Draw Bridge 系で 1,000万DL級が現役）、(b) Poki / CrazyGames 等の Web ポータル（Happy Glass が Poki のドローイングカテゴリ首位）で evergreen 需要が継続している（確度: 高）。
3. 市場全体は「**ハイパーカジュアルのDLは巨大なまま（2025年 220.5億DL）だが、純広告モデルの経済が崩壊し、ハイブリッドカジュアルが唯一の成長セグメント**（IAP売上 +20% で $4.2B、トップ10タイトルは前年比 +67〜100%）」という構図（確度: 高）。
4. 我々の「線を引いて橋を作り車を走らせるゲーム」は、**検証済みの需要（Draw Bridge クローン群 + Hill Climb 系走行メタ）× 低い品質バー × ハイブリッドカジュアル設計**の交点に位置づけるのが最適（確度: 中〜高、詳細は §g）。

---

## (a) コアメカニクス比較表

| ゲーム | 開発/パブリッシャー | リリース | 何を描くか | 描いたものの物理作用 | 1プレイの長さ | 備考 |
|---|---|---|---|---|---|---|
| **Draw Climber** | Appadvisory / Voodoo | 2020 | キューブの「脚」の形状 | 描いた線が脚として回転し、地形を走破する推進力になる | 30秒〜1分（レース1本） | 走行中に何度でも描き直せるのが中毒性の核 |
| **Draw Joust!** | Voodoo | 2020/2 | 乗り物のシャーシ＋武器の配置 | 描いた形がそのまま物理オブジェクト化し、相手と激突する馬上槍試合 | 15〜45秒（1対戦） | 対戦（PvE風非同期）でリプレイ性を確保 |
| **Happy Glass** | Lion Studios | 2018 | 水を導くランプ・堰・蓋 | 描いた線が静的な剛体になり、液体（流体物理）を誘導 | 10〜30秒（1レベル） | レベル制パズル。インク量でスター評価 |
| **Love Balls** | SuperTapx / Lion Studios | 2018 | 坂・橋・支え | 描いた線が剛体化し、2つのボールを転がして接触させる | 10〜30秒（1レベル） | 「線が短いほど高得点」で解の多様性を担保 |
| **Brain Dots** | Translimit（日本） | 2015 | 自由な線・形 | 剛体化して青玉と赤玉をぶつける | 10〜60秒（1レベル） | ペン収集メタ＋UGCステージ（累計300万ステージ）。2025年6月まで更新継続 |
| **Draw Bridge Games: Car Bridge**（クローン群代表） | GameLord 3D | 2022/1 | 崖間の「橋」を一筆書き | 描いた橋が剛体化し、車が自動走行で渡る | 15〜40秒（1レベル） | 1,000万DL超・評価4.69。車種アンロックの軽いメタあり |
| **Draw Car / Road Draw / Draw the Road 系** | 多数（Web/アプリ） | 2019〜 | 車体そのもの、または走る道 | 描いた車体/道が剛体化して走行 | 15〜60秒 | Poki / CrazyGames / Lagged 等 Web ポータルで定番化 |
| **Scribble Rider** | Voodoo | 2020/6 | 車輪の形状 | 描いた形が回転する車輪になり、地形（水面・段差）に応じて描き替える | 30秒〜1分 | 「地形に合わせて車輪を描き替える」が Draw Climber の正統進化 |
| **Draw Hero 3D / Draw Weapon 系** | CASUAL AZUR GAMES 等 | 2021〜 | 武器・盾・棒 | 描いた形を持って敵と戦う物理アクション | 20〜60秒 | パズル寄り。中規模ヒット止まり |
| **Save the Doge**（draw-to-save 系） | WONDER GROUP（中国） | 2022/7 | 犬を守る「防壁」を一筆書き | 描いた線が剛体シールドになり、蜂の群れ（多数の動体）を防ぐ | 10〜20秒（1レベル） | Happy 系メカニクスの変奏。SNSバイラルの代表例 |
| **Hill Climb Racing**（比較対象） | Fingersoft | 2012 | （描かない） | 傾斜地形×サスペンション物理をスロットル/ブレーキ2ボタンで操作 | 1〜5分（燃料切れまで） | 物理走行×車両アップグレードメタの王者。シリーズ25億DL |

**メカニクス上の分類（分析、確度: 高）**
- **タイプA: 描いたものが「動く」**（Draw Climber の脚、Scribble Rider の車輪、Draw Joust の車体）— 描画→即走行のフィードバックが速く、レース形式でセッションが伸びる。
- **タイプB: 描いたものが「静的な構造物」になる**（Happy Glass / Love Balls / Brain Dots / Draw Bridge / Save the Doge）— レベル制パズルで、コンテンツ制作量が寿命を決める。
- 我々の draw-bridge 企画は**タイプB（橋）×タイプAの走行フェーズ**を持つハイブリッドで、Hill Climb 的な走行の気持ちよさを B に注入できるポジション。

---

## (b) DL数・収益ランキングと 2024-2026 トレンド

### 各タイトルの規模感

| ゲーム | 累計DL | 直近の勢い | 確度 |
|---|---|---|---|
| Hill Climb Racing（1作目） | **20億DL超**（シリーズ25億） | 月間約600万DL / 推定月売上 $40K（広告偏重）。DAU 400万人超 | 高 |
| Hill Climb Racing 2 | シリーズ計に含む | 月間約200万DL / 推定月売上 **$600K**（IAP転換後、過去最高収益） | 高 |
| Happy Glass | **1億〜2.8億DL**（Google Play 1億+、全プラットフォーム計2.8億の報あり） | ピークは2018-2021。2021/3時点で月300万DL・月売上 $9K。現在は Web ポータルの定番 | 中 |
| Love Balls | **約1.7億DL** | 2018年DLチャート支配。現在は沈静 | 中 |
| Scribble Rider | **1億〜1.2億DL** | 直近30日で約17万DL（残存需要あり） | 中 |
| Draw Joust! | **1億DL+**（Google Play表記） | 沈静 | 中 |
| Draw Climber | 月間3,200万DL（2020/2、世界ハイパーカジュアル2位）→ 累計は1億DL級と推定 | 沈静 | 中（累計は推定） |
| Brain Dots | **5,000万DL+** | 2015年ヒットだが 2025年6月時点でもアップデート継続 | 高 |
| Save the Doge | 初速3か月で3,400万DL → 累計5,000万〜1.2億DL | 2022-2023のバイラル。派生クローン多数 | 中 |
| Draw Bridge Games: Car Bridge | **1,000万〜1,100万DL** | 2022年リリースで現役。評価 4.69（7.1万件） | 高 |
| Bridge Race（隣接: 描かずに橋を積む） | **2.5億〜5億DL** | 直近30日 620万DLの報。橋×レースの需要の大きさを証明 | 中 |

### ジャンルは成長中か衰退中か（確度: 高）

- **ハイパーカジュアル全体**: 2025年も**220.5億DL**とDLシェアは圧倒的だが、セグメント年間売上は**$500M未満**（ミッドコア $31B、カジュアル $22B と比較して極小）。「DLは減少傾向・売上は増加」という質への集約が進行中。
- **line-drawing サブジャンル**: DLチャート上位からは退場（2025年ハイパーカジュアルDLトップ10の4割は .io 系）。**新規大型ヒットは 2022 年の Save the Doge が最後**で、以降はクローンのロングテールと Web ポータルでの evergreen 消費に移行。→ **サブジャンルとしては「衰退→定常状態（ニッチ安定）」**。
- **Voodoo の構造転換が象徴的**: ハイパーカジュアルは同社売上の 100%（2021）→ 22-25%（2023-24）。2023年売上 $570M の大半は IAP・ハイブリッド。2024年は累計86億DL・年間7.6億DL。
- **ハイブリッドカジュアルが唯一の成長セグメント**: IAP売上 2025年に **+20% で $4.2B**。Q1'25 +67% YoY → Q2'25 +100% YoY、トップ10で四半期 $126M。パズル（Screw / Block / Sort 系）が牽引（売上 +136.1%、DL -3.3%）。2025年最多DLは Block Blast!（3.66億DL）。

---

## (c) 2025-2026 年の新規 line-drawing ヒットの有無（最新トレンド）

**結論: モバイルのトップチャート級では「なし」**（確度: 中 — 複数のチャート分析記事・AppMagic/センサータワー系レポートに drawing メカニクスの新ヒットが登場しない、という消極的証拠に基づく）。

確認できた 2025-2026 の関連動向:

1. **ハイブリッドカジュアルのヒットはパズル系に集中**（Color Block Jam, Pixel Flow, Screwdom, Magic Sort, All in Hole 等）。GameRefinery 2025年12月レビューは Match3 を「極度に飽和」と評し、新興サブジャンルへの移動を指摘。drawing はこのリストに不在。
2. **トップハイパーカジュアルチャートの約70%が「2025年にローンチ/スケールした」タイトル**に入れ替わっており、チャート回転は速い。つまり良い実装が出れば食い込む余地は構造的にある。
3. **Web/マルチプレイヤー側では drawing が活況**: Poki のドローイングカテゴリ首位は依然 Happy Glass。お絵かき対戦（Drawing Contest 等）や **AIジャッジ付きドローイングゲーム（Artbitrator 等）**が 2024-2026 の新潮流。「2026年末までに主要ドローイングゲームはAI機能を搭載する」との業界予測もある（確度: 低〜中、ソースはニッチメディア）。
4. **Hill Climb Racing 3 が 2025年10月にオープンベータ**（英国・北欧）。リアルタイムPvP＋3D＋IAP主導のハイブリッド設計で、「物理走行×メタ」の王者が次世代機に移行中。線を引くジャンルにとっては「走行フェーズの気持ちよさの基準」がさらに上がることを意味する。
5. TikTok 上では手描き系チャレンジ（"67" drawing 等）や draw-and-guess 系がバイラルしており、**「描く行為」の短尺動画適性は依然高い**（Save the Doge が YouTube/TikTok でバイラルした 2022 年の構造は今も有効）。

---

## (d) リテンション・セッション長ベンチマーク（2025-2026 業界標準）

| 指標 | ハイパーカジュアル | ハイブリッドカジュアル | 全モバイルゲーム上位25% | 確度 |
|---|---|---|---|---|
| **D1 リテンション** | 典型 20-30% / トップ 38-40%（Voodoo の旧公開基準は 50%+） | 30-40% | 26.5-27.7%（2024、前年28-29%から悪化） | 高 |
| **D7 リテンション** | 6-9% / トップ ~15% | **~20%**（Mob Control は 25.1% の報） | — | 高 |
| **D30 リテンション** | <2% | 5%+ / 「今のトップハイパーカジュアルは最低 5-7.5%」 | — | 高 |
| **セッション/DAU** | 平均 ~4回/日（ミッドコアは6-7回） | 同左 | — | 高 |
| **平均セッション長** | 地域差 5.0〜6.85分（Oceania最長 6.85分、アジア・アフリカ ~5分） | より長い | — | 中 |
| **ARPDAU（広告込み）** | **$0.03-0.08** | **$0.15-0.50** | — | 中 |
| **CPI** | 利益が出るのは $0.50 未満（Tier1）/ 上限 $1 | iOS $2.00-5.00+、Android $0.30-1.50 | — | 高 |
| **広告頻度の限界** | 「1分間に4本の広告」でリテンションが 20% まで低下。過剰広告で約40%が離脱 | リワード広告中心へ移行 | — | 中 |

補足（確度: 高）:
- iOS CPI は前年比 **+19%**、ARPU は **+7%** しか伸びておらず、LTV/CPI マージンは圧縮が継続。**「安く買って広告で回収」の算術が成立しなくなったのが 2024-2026 の本質**。
- ソフトローンチ時点で **500レベル以上**、**10-15レベルごとのメカニクス変化**、win streak・ライブイベント搭載が今のトップ「hypercasual on steroids」の標準装備。
- 2026年時点で **36% のスタジオが hyper→hybrid 転換を進行中**。

---

## (e) 成功パターンと失敗パターンの抽出

### 成功パターン（確度: 高、各事例に基づく）

1. **「描く」＝プレイヤーの創造性が攻略に直結する**: Draw Climber / Scribble Rider は「どんなぐちゃぐちゃな線でも動く」ため失敗が楽しく、上達の実感（最適形状の発見）が段階的に訪れる。学習曲線が自然にできる。
2. **描画→物理→結果のフィードバックが1秒以内**: タイプA（描いたものが動く）は特に強い。描き直しがペナルティなしで即時反映される設計が中毒性の核。
3. **描いた結果が毎回違う＝動画映え・バイラル適性**: Save the Doge は口コミ（YouTube/TikTok の攻略・失敗動画）だけで日次 52万→72万DLまで成長。UA費に頼らないオーガニック獲得はこのジャンル最大の武器。
4. **インク量・線の短さをスコア化して「解の探索」を促す**: Love Balls / Happy Glass / Save the Doge の3スター制。一発クリアで終わらせず、リプレイ動機を作る。
5. **軽いメタでも寿命が大きく伸びる**: Brain Dots はペン収集＋UGC（300万ステージ）で 2015 年のゲームが 2025 年も更新継続。Draw Bridge クローンですら「車種アンロック」を入れて評価4.69を維持。
6. **ハイブリッド転換の成功例が方程式化している**: Mob Control はカードコレクションメタ追加で**既存ユーザー LTV +20%**、$200M 年間ランレート、D7 25%。HCR2 は IAP 主導へ転換して過去最高収益。→ 「シンプルな物理コア＋カジュアル級のメタ・LiveOps」が 2026 年の勝ち筋。
7. **馴染みのあるメカニクスは資産**: ハイパーカジュアルでは既知メカニクスとの類似が CPI を下げる（説明不要の広告クリエイティブが作れる）。

### 失敗パターン（確度: 高〜中）

1. **支配戦略によるゲーム性の崩壊（タイプA特有）**: Draw Climber は「単純なL字/直線」がほぼ全地形で最適解になり、発見後は作業化して即離脱。地形バリエーションで対策しないと D7 が持たない（分析、確度: 中）。
2. **広告過剰によるリテンション自壊**: 1分4本で D1 が 20% 台へ。Draw Joust のレビュー欄も広告量への不満が最頻出。短セッションゲームほどインタースティシャルの体感頻度が上がる構造的問題。
3. **コンテンツ枯渇（タイプB特有）**: レベル制パズルは制作速度がプレイ速度に勝てない。500レベル未満でのローンチは現在の基準では即死。手作りレベル依存から、プロシージャル生成やパラメトリックな難度設計に逃がせないと運営コストで詰む。
4. **クローン飽和と差別化不能**: 参入障壁が低く、Draw Bridge 系だけで同名アプリが5本以上並ぶ。ASO・ストア面での埋没が既定路線。品質か配信チャネル（Web含む）かメタで差別化できないものは全滅。
5. **純広告モデルへの依存**: CPI > 広告LTV となった 2024 年以降、メタなし・IAPなしのゲームはスケール投資自体が不可能。Fingersoft ですら 2024 年末に広告収益の「大幅減」で 14 名レイオフ → IAP 転換で回復、という教訓。
6. **描く自由度と物理の乖離**: 描いた形が期待通りに動かない（自己交差線の剛体化バグ、極端な形状での物理破綻）と、このジャンルの魅力である「創造→検証」ループ自体が壊れる。物理エンジンの頑健性は品質の土台（分析、確度: 中）。

---

## (f) ハイブリッドカジュアル化のトレンド（2026年時点の具体例）

**潮流の要約**: 「ハイパーカジュアルの入口の軽さ（低CPI・即プレイ）を維持したまま、カジュアル級のメタ進行・LiveOps・IAP を載せて LTV を 4-7 倍にする」のが 2026 年の業界標準戦略。ARPDAU で $0.03-0.08 → $0.15-0.50 のジャンプがその定量的実体。

具体例:

| 事例 | 施策 | 成果 | 確度 |
|---|---|---|---|
| **Mob Control**（Voodoo） | 9か月かけて Clash Royale 型カードコレクションメタ（チェストタイマーなし）、クラン、PvP拠点防衛、ライブイベントを追加 | 既存ユーザー LTV **+20%**、D7 15%→**25.1%**、**$200M+ 年間ランレート**。Voodoo のハイブリッド売上は3年で 0→$250M | 高 |
| **Hill Climb Racing 2**（Fingersoft） | 広告偏重から IAP 主導（シーズンパス・車両カスタム・イベント）へ再設計 | 「過去最高の収益」。HCR1 の月売上 $40K に対し HCR2 は $600K（DLは1/3なのに売上15倍） | 高 |
| **Hill Climb Racing 3**（2025/10 OB） | 最初からハイブリッド設計: リアルタイムPvP、ガジェット、シーズン運営 | ベータ中（グローバルローンチ日未定） | 高 |
| **Rollic（Zynga系）** | ハイパーカジュアルパブリッシャーがハイブリッドパズルへ全面転換 | AppMagic Q3'25 ハイブリッドカジュアルトップ10の **4枠**を占有 | 中 |
| **業界全体** | win streak・ライブイベント（Royal Match から輸入）、10-15レベル毎のメカニクス変化、AI生成コンテンツによるコレクション/ギャラリーメタ | トップハイパーカジュアルの D30 基準が 5-7.5% に上昇。36% のスタジオが転換中 | 高 |

**このジャンルへの含意**: Brain Dots（ペン収集・UGC）が10年生き残り、Draw Bridge クローンが車種アンロックだけで4.69を維持している通り、**draw系はメタとの相性が良い**（描く道具・描く対象・走らせる車両、の3軸すべてがコレクション化できる）。

---

## (g) 我々の「線を引いて橋を作り車を走らせるゲーム」の市場ポジション示唆

### 1. 需要は実証済み、供給は低品質 — 「クローンに勝つ」ゲームではなく「ジャンルの決定版」を狙う（確度: 中〜高）

- Draw Bridge Games: Car Bridge（GameLord 3D）は**2022年リリースの低予算クローンでも 1,000万DL・評価4.69** を取れている = 検索需要・広告クリエイティブ適性が現存する証拠。
- 一方、隣接の Bridge Race（橋×レース、描かない）は **2.5億〜5億DL**。「橋を作って進む」ファンタジー自体の天井は非常に高い。
- Happy Glass が Poki ドローイングカテゴリ首位を維持している通り、**draw 系は Web で evergreen**。品質の高い draw-bridge 実装はモバイルとWebの両取りが可能。

### 2. ポジショニング: タイプB（橋を描く）×タイプA（車が走る）のハイブリッドメカニクス（確度: 中）

- 純粋パズル（Happy Glass 型）はコンテンツ枯渇が宿命。純粋走行（Draw Climber 型）は支配戦略で崩壊しやすい。
- **「橋を描く（創造）→車が走る（検証・爽快感）」の2フェーズ構造**は両者の弱点を相殺できる稀有な位置。走行フェーズの基準は Hill Climb Racing（サス物理・車体の揺れ・コイン取得・ニアミス演出）に置くべき。
- Save the Doge の教訓: **「描いた結果が毎回違う失敗動画」がUAエンジン**。橋が崩れて車が落ちる瞬間の物理演出は最重要のマーケティング資産として設計する。

### 3. ビジネスモデル: 最初からハイブリッドカジュアル設計（確度: 高）

- 2026年に純広告ハイパーカジュアルとして出すのは経済的に成立しない（CPI > 広告LTV、§d参照）。
- 推奨メタ3軸（すべて draw-bridge と自然に接続する）:
  1. **車両コレクション/アップグレード**（HCR 型: 重量・速度・グリップが橋の設計解を変える → メタがコアの戦略性を深める）
  2. **描く素材のアンロック**（木→鋼→ロープ等、Brain Dots のペン収集の物理版。素材ごとに剛性・コスト・重量が変わる）
  3. **インク（資材）経済**: 使用量でスター評価（Love Balls 型）→ リプレイ動機と難度チューニングのつまみ
- マネタイズ: リワード広告（追加インク・車両お試し）中心＋IAP（車両・素材・広告除去）。インタースティシャルは 1分4本ルールを絶対に超えない。

### 4. 目標KPI（ハイブリッドカジュアル基準で設定すべき）（確度: 高）

| KPI | 最低ライン | 競争力ライン |
|---|---|---|
| D1 | 35% | 40%+ |
| D7 | 12% | 15-20% |
| D30 | 5% | 7.5%+ |
| セッション長 | 6分 | 8分+ |
| ARPDAU | $0.10 | $0.15-0.50 |
| ソフトローンチ時レベル数 | 300+（パラメトリック生成併用） | 500+ ＋ 10-15レベル毎の新要素 |

### 5. 差別化の核（優先順）（分析、確度: 中）

1. **物理の頑健さと気持ちよさ**（橋のたわみ、車のサス、崩落の演出）— クローン群との最大の品質差はここに出る
2. **支配戦略の防止**: 地形・車重・素材制約で「毎回違う橋」を強制する（直線一本で全クリできたら Draw Climber の轍を踏む）
3. **共有適性**: リプレイ/ゴースト/「あなたの橋」スクショの自動生成 — TikTok 導線を製品内に持つ
4. **Web 配信の併用**: Poki / CrazyGames は draw 系の一等地で CPI ゼロのオーガニックチャネル。モバイル前の需要検証にも使える
5. （将来）Brain Dots 型 **UGC ステージ**と、2026 年トレンドの **AI 評価（橋の美しさ/効率をAIが採点）**はハイブリッドメタの拡張候補

### 6. リスク（確度: 中）

- サブジャンルのDLトレンド自体は下り坂→ **UA スケール前提の企画にしない**こと。オーガニック（Web・SNS）＋高LTV設計で小さく黒字化する構造が前提。
- Hill Climb Racing 3 のグローバルローンチ（時期未定）で「物理走行×ハイブリッド」の注目と期待品質が同時に上がる。走行フィールで見劣りすると比較で負ける。

---

## 出典

### 市場・トレンド
- PocketGamer.biz「What happened to hypercasual? The market's evolution over the past year」 https://www.pocketgamer.biz/what-happened-to-hypercasual-the-markets-evolution-over-the-past-year/
- Azur Games「What happened to hypercasual? Market growth over the past year」 https://azurgames.com/blog/what-happened-to-hypercasual-market-growth-over-the-past-year-and-where-it-stands-now/
- Cinevva「Casual Games Trends in 2026 (What the Data Actually Says)」 https://app.cinevva.com/guides/casual-games-trends-2026
- AppMagic「Casual Games Report H1 2025」 https://appmagic.rocks/research/casual-report-h1-2025
- AppMagic「Top 10 Hybridcasual Games in Q1 2025」 https://appmagic.rocks/blog/hybridcasual-q1-2025/?hl=en
- AppMagic「Top 10 Hybridcasual Games in Q3 2025: Rollic Claims 4 Spots」 https://appmagic.rocks/blog/q3hybrid2025
- MAF「Top Mobile Games of 2025」 https://maf.ad/en/blog/top-mobile-games-2025/
- Deconstructor of Fun「State of Mobile 2026」 https://www.deconstructoroffun.com/blog/2026/2/2/state-of-mobile-2026
- Gamesforum Intelligence「Mobile Gaming by Genre: Hypercasual」 https://investgame.net/wp-content/uploads/2025/07/Gamesforum-Intelligence-Hypercasual-Gaming-Report.pdf
- Game Growth Advisor「Hybrid Casual Games 2026」 https://gamegrowthadvisor.com/blog/2026-04-16-hybrid-casual-game-design-strategy-2026/
- Udonis「Casual Games Market in 2026」 https://www.blog.udonis.co/mobile-marketing/mobile-games/casual-games

### ベンチマーク
- GameAnalytics「2025 Mobile Gaming Benchmarks」 https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks
- GameAnalytics「2026 Mobile & PC Gaming Benchmarks」 https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks
- AppAgent「Mobile Game Retention Benchmarks」 https://appagent.com/blog/mobile-game-retention-benchmarks/
- MAF「Mobile Game Retention Benchmarks」 https://maf.ad/en/blog/mobile-game-retention-benchmarks/
- TapNation「KPIs That Matter: Hybrid Casual Games」 https://www.tap-nation.io/blog/kpis-that-matter-metrics-to-track-in-hybrid-casual-games/
- Tenjin「Ad Monetization Benchmark Report 2025 / 2026」 https://tenjin.com/blog/ad-monetization-benchmark-report-2025-ecpm-ad-revenue/ / https://tenjin.com/blog/ad-mon-gaming-2026/
- MegaDigital「CPI Mobile Game 2026」 https://megadigital.ai/en/blog/cpi-mobile-game-guide/
- Admiral Media「Mobile App Marketing Benchmarks 2026」 https://admiral.media/mobile-app-marketing-benchmarks-2026/
- Admix「Hypercasual monetisation doesn't have to hurt retention」 https://blog.admixplay.com/hypercasual-monetisation-doesnt-have-to-hurt-retention/
- Business of Apps「Cost per Install (CPI) Rates (2025)」 https://www.businessofapps.com/ads/cpi/research/cost-per-install/

### 各タイトル
- Sensor Tower「Draw Climber (iOS)」 https://sensortower.com/ios/us/voodoo/app/draw-climber/1495369374/overview
- Sensor Tower「Top Hyper-Casual Games Worldwide February 2020」 https://sensortower.com/blog/top-hyper-casual-games-worldwide-february-2020
- Sensor Tower「Top Mobile Games Worldwide March 2020」 https://sensortower.com/blog/top-mobile-games-worldwide-march-2020-by-downloads
- PocketGamer.biz「Hypercasual surges with the top 3 most downloaded mobile games from Voodoo」 https://www.pocketgamer.biz/comment-and-opinion/72986/hypercasual-surges-top-downloads-voodoo/
- Google Play「Draw Climber」 https://play.google.com/store/apps/details?id=com.appadvisory.drawclimber
- Google Play「Draw Joust!」 https://play.google.com/store/apps/details?id=ru.galya.drawjoust
- AppBrain「Happy Glass」 https://www.appbrain.com/app/happy-glass/com.game5mobile.lineandwater
- Google Play「Happy Glass」 https://play.google.com/store/apps/details/Happy_Glass?id=com.game5mobile.lineandwater
- AppBrain「Love Balls」 https://www.appbrain.com/app/love-balls/com.supertapx.lovedots
- Sensor Tower「The Top Mobile Apps, Games, and Publishers of 2018」 https://sensortower.com/blog/top-apps-games-publishers-2018
- App Store「Brain Dots」 https://apps.apple.com/us/app/brain-dots/id1004227662
- Google Play「Brain Dots」 https://play.google.com/store/apps/details?id=jp.co.translimit.braindots
- Google Play「Draw Bridge Games: Car Bridge」 https://play.google.com/store/apps/details?id=car.bridge.drawing.games
- AppBrain「Draw Bridge Games: Car Bridge」 https://www.appbrain.com/app/draw-bridge-games-car-bridge/car.bridge.drawing.games
- AppBrain「Scribble Rider」 https://www.appbrain.com/app/scribble-rider/com.tapped.drawrider
- Pocket Gamer「Scribble Rider is the best game Voodoo have ever made」 https://www.pocketgamer.com/voodoo/scribble-rider-is-the-best-game-voodoo-have-ever-made/
- Google Play「Draw Hero 3D: Draw Your Weapon」 https://play.google.com/store/apps/details?id=com.draw.hero
- HC.Games「Case study: Save the Doge」 https://hc.games/en/case-study-save-the-doge/
- AppBrain「Save the Doge」 https://www.appbrain.com/app/save-the-doge/com.miracle.savethedoge.an
- AppBrain「Bridge Race」 https://www.appbrain.com/app/bridge-race/com.Garawell.BridgeRace
- Supersonic「Bridge Race case study」 https://supersonic.com/learn/case-studies/bridge-race
- Unity Blog「Bridge Race becomes most downloaded hyper-casual game」 https://blog.unity.com/games/bridge-race-becomes-most-downloaded-hyper-casual-game-with-supersonic

### Hill Climb Racing / Fingersoft
- Fingersoft「Hill Climb Racing IP cruises past 2 Billion installs」 https://fingersoft.com/news/2022/04/26/hill-climb-racing-ip-cruises-past-2-billion-installs/
- WN Hub「Downloads of the Hill Climb Racing series have reached 2.5 billion」 https://wnhub.io/news/other/item-46592
- PocketGamer.biz「Fingersoft's journey to Hill Climb Racing 3」 https://www.pocketgamer.biz/we-kind-of-forgot-that-were-a-game-developer-fingersofts-journey-to-hill-climb-racing-3/
- Fingersoft「Hill Climb Racing 3 Tears Into Open Beta」 https://fingersoft.com/news/2025/10/29/hill-climb-racing-3-tears-into-open-beta/
- Gamesforum「How Fingersoft Masters Long-Term Player Engagement」 https://www.globalgamesforum.com/news/from-organic-growth-to-live-services-how-fingersoft-masters-long-term-player-engagement

### ハイブリッドカジュアル事例
- MAF「Mob Control Analysis: The Anatomy of a Hybrid-Casual Hit」 https://maf.ad/en/blog/mob-control-analysis-hybrid-casual/
- Naavik「Inside Voodoo's #1 Hit: The Story of Mob Control's $200M+ Rise」 https://naavik.co/podcast/inside-voodoos-1-hit-the-story-of-mob-controls-200m-rise/
- Deconstructor of Fun「Voodoo's Secret Sauce: From 0 to 250M Hybridcasual Revenue in 3 Years」 https://www.deconstructoroffun.com/blog/2024/6/3/voodoos-secret-sauce-from-0-to-250m-hybridcasual-revenue-in-3-years
- Naavik「The Evolution of Hybridcasual」 https://naavik.co/deep-dives/evolution-of-hybridcasual-deepdive/

### Web ポータル・その他
- Poki「Drawing Games」 https://poki.com/en/drawing
- CrazyGames「Drawing Games」 https://www.crazygames.com/t/drawing
- Artbitrator「Best Drawing Games 2026」 https://artbitrator.com/blog/best-drawing-games-2026-online-multiplayer
- Deconstructor of Fun「5 Ways Voodoo Dominates the Hyper-Casual Market」 https://www.deconstructoroffun.com/blog/2018/8/1/5-ways-voodoo-dominates-the-hyper-casual-market
- GameAnalytics「How Voodoo identifies hundreds of hit titles」 https://www.gameanalytics.com/customers/voodoo
- Moloco「How to make hyper casual games」 https://www.moloco.com/blog/how-to-make-hyper-casual-games
- MAF「Are Hyper-Casual Games Dying?」 https://maf.ad/en/blog/hyper-casual-games-dying-arguments/

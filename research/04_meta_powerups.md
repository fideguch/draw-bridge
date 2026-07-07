# メタ進行・パワーアップ設計調査 — 「クリア報酬→お金→パワーアップ」の徹底分析

- 調査日: 2026-07-07
- 調査者: ゲームエコノミー設計リサーチ（draw-bridge プロジェクト）
- 対象: ハイパーカジュアル / ハイブリッドカジュアルのメタ進行（Draw Climber, Hill Climb Racing 1/2, line-drawing系, runner系, 業界ナレッジ）
- 方針: 「単なる数値インフレ」ではなく「プレイ体験を変えるパワーアップ」を重視して評価

> 確度表記: **高** = 複数の一次/準一次ソースで裏取り済み、**中** = 単一ソースまたは準拠性の高い二次ソース、**低** = ユーザー報告・推測を含む

---

## 1. Draw Climber のメタ進行 teardown（課題 a）

Voodoo の line-drawing 系代表作。コアは「脚を描いて走る」、メタは **Speed / Offline Earnings（＋スキン）** の2軸＋αという最小構成。

### 1.1 アップグレード構成

| アップグレード | 効果 | ゲームプレイへの影響 | 確度 |
|---|---|---|---|
| Speed | 脚（腕）の回転速度が上がり前進力・モメンタムが増す | 障害物を勢いで突破できる・開けた区間で速い。**体感が変わる**ためプレイヤー人気が最も高い | 高 |
| Offline Earnings | 非プレイ時間にコインが貯まる（レベルアップでレート上昇） | プレイ体験自体は不変。**復帰動機**として機能 | 高 |
| Boosts（Lv18以降開放） | 雷型のスピードブースト等 | 一時的な爽快感ブースト | 中 |
| スキン（ブロック/色/デザイン） | 見た目のみ | 難易度不変のコレクション要素。コインまたは広告視聴で解放 | 高 |

- 攻略ガイドの定説は「**頻繁に遊ぶなら Speed 優先、1日数回しか開かないなら Offline Earnings 優先**」（Level Winner / ChapterCheats）— プレイスタイル別に投資先が分かれる設計。確度: 高
- 重要な設計上の発見: **AI対戦相手はプレイヤーの強さに合わせてスケールする（ラバーバンディング）**。Speed を上げても相対的な難易度は一定に保たれ、「進歩の実感」だけを与える。つまり Draw Climber のアップグレードは半分「演出」であり、勝敗を決めるのは描画スキル。確度: 中
- 価格曲線の公開データは無し。ユーザー報告では **Speed Lv101 付近でステータス上昇が頭打ち（ソフトキャップ）** になるとの記述あり。確度: 低（ユーザーコメント由来）

### 1.2 コイン経済（獲得側）

| ソース | 量 | 確度 |
|---|---|---|
| 通常レベルクリア | 最大 ~20 コイン | 高 |
| ボーナスレベル（5レベルごと） | 100+ コイン | 高 |
| クリア後のリワード広告 | **獲得コイン ×5**（30秒動画。例: ボーナス面で最大500コイン） | 高 |
| 「+500」ボタン（広告視聴） | 一律 +500 コイン | 中 |
| レベル中の落ちコイン・ゴール後のスライド区間 | 少量を散布 | 高 |
| Offline Earnings | レートはアップグレード依存 | 高 |
| 広告視聴での無料アップグレード | **1レベルにつき1回**、コイン不足でも広告でステータス強化可 | 中 |

**Teardown の要点**: 通常クリア 20 コイン vs 広告で ×5 という設計は「広告を見ないと経済がほぼ回らない」水準にレートが張られており、コイン価格曲線そのものが**リワード広告視聴率を最大化する装置**になっている。5レベルごとのボーナス面は「広告温存→ボーナスで×5」という最適行動を生み、セッション内の広告視聴タイミングを制御している。確度: 高（複数ガイドの整合から）

- 出典: [Level Winner – Draw Climber Guide](https://www.levelwinner.com/draw-climber-guide-tips-cheats-tricks-to-complete-more-levels/), [ChapterCheats – Prioritize Speed and Upgrade Character Skills](https://www.chaptercheats.com/cheat/iphone-ipod/470404/draw-climber/hint/126166), [APKDone – Draw Climber](https://apkdone.com/draw-climber/), [App Store – Draw Climber](https://apps.apple.com/us/app/draw-climber/id1495369374)

---

## 2. Hill Climb Racing 1/2 のアップグレードシステム（課題 b）— 物理走行ゲームの王道

### 2.1 HCR1（Fingersoft, 2012）

- 全車両に **4種のアップグレード**（典型は Engine / Suspension / Tires / 4WD）。ゲーム全体で **34種のユニークなアップグレード**が存在。確度: 高
- 各アップグレードの効果（物理に直結）:
  - **Engine**: 加速・最高速。ただし重心が高い車で上げすぎると**ウィリーで転倒**する（上げれば良いわけではない）
  - **Suspension**: 着地の衝撃吸収・安定性。上級者は柔らかめに調整して着地時に「沈ませる」
  - **Tires**: グリップ。氷や砂利で効くが、元々グリップが高い車では**逓減**
  - **4WD**: 全輪駆動化でウィリー抑制・登坂トラクション向上
- 最大レベルはパーツ・車両ごとに異なる（例: Formula は Engine 16 / Grip 20 / Fuel 25 / Downforce 15）。Race Car の全アップグレード総額は **約 4,634,500 コイン**。確度: 中（Fandom wiki）
- Wiki 自身が「**一部のアップグレードは効果が非常に大きく、一部はほぼ無意味**」と明記 — 種類を増やすと死にアップグレードが生まれるという教訓。確度: 中

### 2.2 HCR2（2016）— 価格曲線の実データ

- 各車両 4 属性 × **Lv1→20**、「レベルが上がるごとに徐々に高くなる」設計。確度: 高（公式 wiki）
- **初期車両 Hill Climber の1属性あたり実コスト**（Fandom wiki の実測テーブル、確度: 高）:

| Lv | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| コスト | 800 | 1,500 | 2,200 | 2,900 | 3,700 | 4,500 | 5,400 | 6,400 | 7,400 | 8,600 | 10,000 | 11,000 | 13,000 | 15,000 |

  - 1属性の合計 208,400 / 4属性合計 833,600 コイン（Lv16–20 の残り5レベルで約 116,000 = 全体の56%が後半に集中）
  - 曲線の形: **序盤は増分が大きく（×1.9→×1.5→…）、Lv9 以降は1レベルあたり +10〜15% の緩い指数（準二次曲線）**。純粋指数（×1.5^n など）ではなく「二次関数〜緩指数」で、20レベルという明確なキャップを置く
- **リワード広告/VIP で安いアップグレードを無料化**: 6,000 コイン以下のアップグレードは広告視聴で無料取得可（初期車両なら Lv8 まで無料）。「序盤の進行を広告で加速→後半はコイン経済」への接続として秀逸。確度: 高
- **車両ごとの固有アップグレード（ここが HCR2 の真骨頂）**: 4枠目が車両固有で、**数値でなく挙動そのものを変える** — Moonlander の Thrusters（飛行）、ATV の Grappling Hook（ロープ）、Bolt の Kinetic Wheel（空中チャージ→着地ブースト）、Stocker の Boost Mode、Glider の Wing、Supercar の Air Brake、Rock Bouncer の C.A.M.（登坂アシスト）等。**「新しい車両 = 新しい遊び方」**を成立させる装置。確度: 高
- **Tuning Parts**: 車両に3〜4枠装着するビルド要素（Nitro, Kangaroo, Start Boost, Coin Boost 等19種）。全体最大化には 251.9M コインと、超長期のシンクを担う
- 経済の全景（wiki「Total Cost」）: 全車両解放 1.13M ＋ 全アップグレードMAX 77.6M ＋ 全チューニングMAX 251.9M ＋ Mastery 72M = **総額 402.7M コイン**。広告/VIP で節約できるのは 6.8M（全体の約1.7%）のみ = 広告無料化は「味見」であり経済は壊さない。確度: 高

**HCR から learn すべき王道**: ①アップグレードは物理挙動に直結させ「操作感が変わる」ようにする ②上げすぎると害になる軸（Engine→転倒）を混ぜてビルド判断を生む ③4枠目に「挙動を変える固有枠」を置き車両コレクションと直交させる ④価格は緩指数＋明確なレベルキャップ ⑤安価な序盤アップグレードは広告で無料化して習慣を作る。

- 出典: [HCR2 Fandom – Vehicle Upgrades](https://hillclimbracing2.fandom.com/wiki/Vehicle_Upgrades), [HCR2 Fandom – Total Cost](https://hillclimbracing2.fandom.com/wiki/Total_Cost), [HCR2 Fandom – Hill Climber（レベル別コスト表）](https://hillclimbracing2.fandom.com/wiki/Hill_Climber), [HCR2 Fandom – Tuning Parts](https://hillclimbracing2.fandom.com/wiki/Tuning_Parts), [HCR1 Fandom – Upgrades](https://hillclimbracing.fandom.com/wiki/Upgrades), [GameSkinny – How To Dominate HCR2](https://www.gameskinny.com/tips/how-to-dominate-hill-climb-racing-2/)

---

## 3. line-drawing 系・runner 系成功作のアップグレード網羅リスト（課題 c）

| ゲーム | ジャンル | 恒久アップグレード | ゲームプレイ変化型の要素 | コレクション | 確度 |
|---|---|---|---|---|---|
| **Draw Climber** (Voodoo) | line-draw × race | Speed / Offline Earnings | Boosts（Lv18〜） | スキン（コイン/広告） | 高 |
| **Draw Joust** (Voodoo) | line-draw × battle | **Ink（描画量）** / Power / Health / Offline Earning | 武器（槍・斧・大砲）で戦い方が変わる | 車両スキン | 中 |
| **Scribble Rider** (Voodoo) | line-draw × race | （描くホイール自体がコア） | 描いた形＋素材テクスチャで走破性が変わる | スキン | 中 |
| **Bridge Race** (Supersonic/Garawell) | runner × 建設 | **移動速度 / ブロック所持数（capacity） / 橋建設速度** | — | キャラ80+、ブロック30+、色30+ | 中 |
| **Hill Climb Racing 1/2** | physics driving | Engine / Suspension / Tires(Grip) / 4WD ほか34種 | 車両固有枠（Thrusters, Grappling Hook, Kinetic Wheel…）、Tuning Parts | 車両20+ / 外観カスタム | 高 |
| **Subway Surfers** | endless runner | パワーアップ持続時間 6段階（Magnet / Jetpack / Super Sneakers / **2x Multiplier**、1段階+5秒） | Hoverboard（3→5回、特殊挙動ボード） | キャラ / ボード | 高 |
| **Jetpack Joyride** | endless runner | Vehicle の Magnetization（1台 10,000 コイン） | **Vehicles（Lil Stomper 等6種）が操作を根本から変える**、Gadgets 組み合わせ | 衣装 / ジェットパック | 高 |
| **Crossy Road** | endless hopper | （能力アップグレード無し） | 一部マスコットは世界のテーマ/BGMが変わる | **マスコット 400+（ガチャ）** | 高 |
| **Mob Control** (Voodoo) | runner × strategy | カード（ユニット）レベルアップ | カード種で戦術が変わる、基地建設メタ | カードコレクション | 高 |

**観察されるパターン（確度: 高）**:
1. line-drawing 系のメタは「**Speed ＋ Offline Earnings ＋ スキン**」が最小テンプレ（Draw Climber）で、対戦系になると **Ink（描画リソース）/ Health / Power** が加わる（Draw Joust）
2. runner 系の王道は「**一時パワーアップの持続時間を恒久強化**」（Subway Surfers 型）— 数値でなく「マグネットが5秒長い」という体感差になる
3. LTV が高い作品ほど「**挙動が変わるアンロック**」（JJ の Vehicles、HCR2 の固有枠、Hoverboard）を持つ
4. 「速度 / 所持量 / 収益」の3点セットは arcade-idle 全般の共通言語（Bridge Race, Stacky Dash 等）

- 出典: [Pocket Tactics – Scribble Rider](https://www.pockettactics.com/scribble-rider/download), [RealAPKClub – Draw Joust](https://realapkclub.com/draw-joust-mod-apk/), [Enjoy4fun – Bridge Race Guide](https://enjoy4fun.co.uk/bridge-race/), [Subway Surfers Wiki – Power-Ups](https://subwaysurf.fandom.com/wiki/Power-Ups), [Jetpack Joyride Wiki – Vehicles](https://jetpackjoyride.fandom.com/wiki/Jetpack_Joyride/Vehicles), [Crossy Road Wiki – Prize Machine](https://crossyroad.fandom.com/wiki/Prize_Machine), [MAF – Mob Control Analysis](https://maf.ad/en/blog/mob-control-analysis-hybrid-casual/)

---

## 4. リテンション・LTV を実際に上げると実証されているアップグレード種別（課題 d）

### 4.1 ベンチマーク（確度: 高）

| 指標 | ハイパーカジュアル | ハイブリッドカジュアル |
|---|---|---|
| D1 リテンション | ~30–45% | 45–50%（arcade idle は ~50%） |
| D7 リテンション | 8–12% | **15–22%**（Voodoo の合格ライン: D1 45% / D7 15% / D30 10%） |
| D30 リテンション | ほぼ 0 | ~10% |
| D0 プレイタイム | ~10分 | **~25分**（arcade idle） |
| ARPDAU | $0.03–0.08 | $0.15–0.50 |
| LTV (US) | $0.60–1.50 | それ以上（IAP 比率 15–50%） |

### 4.2 「効く」と報告されているメタ種別（エビデンス付き）

| 種別 | エビデンス | 確度 |
|---|---|---|
| **パワー進行（アップグレード全般）** | GameAnalytics「リテンションを上げる最良の方法は progression と meta layer の提供」。Naavik: 分析した全ヒット作（Dreamdale, Mob Control, Pocket Champs）が Power Progression を基盤に持つ | 高 |
| **コレクション（キャラ/車両/カード）** | Crossy Road: 400+ マスコット＋100コインガチャで3ヶ月 $10M。Pocket Champs: 51 ガジェット収集で D30 が6ヶ月間安定。Mob Control: カード収集 | 高 |
| **挙動が変わるアンロック（横方向進行）** | ゲームデザイン論: 「horizontal progression は数値でなく“遊び方”を変えるから各アンロックが意味を持ち続ける」。JJ Vehicles / HCR2 固有枠が実例 | 中（設計論＋実例、A/B 数値は非公開） |
| **オフライン収益（idle メタ）** | arcade idle サブジャンル自体が「idle メタを載せたら D1 ~50%・D0 25分になった」ことの実証（Homa/Udonis/MAF が一致） | 高 |
| **目に見える構築メタ（基地・建物）** | Mob Control: 「努力の結果が視覚化される」建設メタが core 外の目標を作りリテンションに寄与（収益の85%が広告でも成立） | 中 |
| **イベント/時限要素** | Survivor.io の周年イベントで日次収益 2 倍スパイク（Naavik） | 中 |
| **メタが LTV の主戦場** | ThinkingData: 「LTV の 90% はコアではなくメタで生まれる」 | 中 |

**注意（確度: 高）**: GameAnalytics も Supersonic も「メタはコアが面白い前提でのみ機能する」と強調。メタを載せる順番は「コアの完成 → 経済 → コレクション → イベント」。

- 出典: [GameAnalytics – Hybrid-casual: the secret sauce](https://www.gameanalytics.com/blog/hybrid-casual-higher-retention-better-engagement), [Naavik – The Evolution of Hybridcasual](https://naavik.co/deep-dives/evolution-of-hybridcasual-deepdive/), [Game World Observer – Voodoo D7 15%](https://gameworldobserver.com/2023/07/25/voodoo-hybrid-games-d7-retention-games-and-names-podcast), [Udonis – Idle Arcade](https://www.blog.udonis.co/mobile-marketing/mobile-games/arcade-idle), [Homa – Arcade Idle](https://www.homagames.com/blog/arcade-idle-a-new-hybridcasual-genre-enters-the-game), [ThinkingData – Hypercasual→Hybridcasual](https://thinkingdata.io/blog/breaking-down-the-evolution-of-hypercasual-mobile-games-to-hybridcasual/), [AppSamurai – Hybrid-Casual UA Playbook](https://appsamurai.com/blog/hybrid-casual-games-ua-playbook-how-to-acquire-and-retain-users/), [Digital Training Academy – Crossy Road $10M](http://www.digitaltrainingacademy.com/casestudies/2015/03/gaming_case_study_how_crossy_road_made_10m_in_three_months.php)

---

## 5. 通貨設計: コイン獲得量とアップグレード価格のバランス（課題 e）

### 5.1 通貨の本数
- カジュアル帯は **単一ソフト通貨（コイン）が基本**（Candy Crush 等も実質1通貨）。2本目（宝石/鍵）は IAP を本格化するときに追加。確度: 高
- 我々の規模なら: コイン1本＋（後日）広告置換用のプレミアム通貨、で十分。

### 5.2 価格曲線の定石（確度: 高）
- **idle 系の数学**（Kongregate “The Math of Idle Games”ほか）: コストは指数（1レベルあたり **×1.07〜×1.15**）、生産（獲得）は線形〜緩指数（×1.10 前後）。「コスト成長 > 収入成長」の差分が進行のブレーキになる
- **F2P 全般**: 純粋指数だけだと後半に「壁」ができるため、**指数×マイルストーンのハイブリッド**が主流（例: Lv1→2 = 100、Lv19→20 = 100,000 のような伸び + 5レベルごとに報酬/解放を置く）
- **HCR2 の実測**は「序盤急・後半 +10〜15%/Lv の緩指数、Lv20 キャップ」— 物理系レベルクリアゲーの現実解として最有力のリファレンス
- **キャップ**: HCR2 = 20 レベル、Subway Surfers = 6 レベル、Draw Climber = 実質ソフトキャップ（~Lv100、確度: 低）。**「効果が体感できる粒度」なら 6〜20 レベル、演出的進行なら無限＋ソフトキャップ**

### 5.3 獲得量とのバランス設計（Draw Climber / HCR2 からの逆算、確度: 中〜高）
- 通常クリア報酬はほぼ一定（~20）にし、**インフレは広告倍率（×2〜×5）とボーナス面（5面ごと ×5〜10）で作る** — 獲得側を指数にしない
- **最初のアップグレードは 1〜3 レベルクリア以内に買える価格**にする（例: クリア20コイン×広告×5 = 100 → 初回アップグレード 50〜100）
- 安いアップグレード帯（HCR2 でいう ≤6,000 コイン相当）は**広告視聴で無料化**し、「アップグレードする習慣」を D0 で作る
- 全コンテンツ総額は日次獲得量の 100 倍以上に置いて長期シンクを確保（HCR2 は総額 402M、広告で節約できるのは 1.7% のみ）

- 出典: [Kongregate/Game Developer – The Math of Idle Games Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i), [Game Developer – Balancing Tips: Idle Idol](https://www.gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol), [DEV – Game Economy Balancing](https://dev.to/hiroshi_takamura_c851fe71/game-economy-balancing-how-to-tune-rewards-costs-and-progression-2ale), [Machinations – F2P Economy Design](https://machinations.io/articles/game-economy-design-free-to-play-games), [Udonis – Balanced Mobile Game Economy](https://www.blog.udonis.co/mobile-marketing/mobile-games/balanced-mobile-game-economy)

---

## 6. スキン / 乗り物コレクションの効果（課題 f）

| 方式 | 実例と効果 | 確度 |
|---|---|---|
| **コインガチャ（プライズマシン）** | Crossy Road: 100 コイン=1回のガチャで 400+ マスコット。重複あり・難易度不変。リテンション/バイラリティ/再エンゲージの3本柱の中核で、3ヶ月 $10M・動画広告だけで 20 日 $1M | 高 |
| **広告視聴で解放** | Draw Climber: スキンをコイン or **広告視聴で無料解放**。Supersonic: Screw Master 3D の Daily Calendar で限定スキン（休んだ日は広告でリカバリ）→ 連続ログイン装置化 | 高 |
| **実績/イベント解放** | HCR2: 車両の一部はイベント報酬。Pocket Champs: シーズンイベントでガジェット追加 → D30 が6ヶ月安定 | 中 |
| **性能差のある「乗り物」コレクション** | JJ の Vehicles / HCR2 の車両（固有アップグレード付き）— 見た目＋挙動の両方が変わるため単なるスキンより強い動機。ただしバランス調整コスト増 | 高 |

**設計知見（確度: 高）**:
- スキンは「難易度を変えずに達成感と自己表現を足せる」最安のメタ。Supersonic は**どのスキンがエンゲージされているかを分析してメタ改善に使う**ことを標準プロセス化
- ガチャ形式（Crossy Road 型）は「余剰コインの無限シンク」＋「次は何が出るか」のドーパミンを兼ね、**コイン獲得そのものに意味を持たせ続ける**
- 車両＝性能差ありコレクションにする場合は「初期車で全レベルクリア可能、上位車は楽になる/遊び方が変わる」に留めるのが定石（Crossy Road は完全観賞用に振った）

- 出典: [Crossy Road Wiki – Prize Machine](https://crossyroad.fandom.com/wiki/Prize_Machine), [Game Developer – How Crossy Road made $1M from video ads](https://www.gamedeveloper.com/business/how-i-crossy-road-i-made-1-million-from-video-ads), [Supersonic – Is Your Hyper-Casual Game Fun?](https://supersonic.com/learn/blog/is-your-hyper-casual-game-fun-best-practices-for-boosting-retention), [Gamigion – Inside Supersonic](https://www.gamigion.com/inside-supersonic/)

---

## 7. リワード広告との接続: 定番パターンと効果データ（課題 g）

### 7.1 定番プレースメント（Supersonic の4分類 + 実例）

| パターン | 実例 | 効果データ | 確度 |
|---|---|---|---|
| **経済系: クリア報酬 ×2〜×5** | Draw Climber（×5）, Mob Control（バトル終了時の資源倍率） | リワード広告の watch rate は **40–70%**、完走率 **90%+**。「今すぐ欲しい報酬」に紐づくほど opt-in 上昇 | 高 |
| **進行系: 無料アップグレード / レベルスキップ** | HCR2（≤6,000 コインのアップグレードを広告で無料化）, Draw Climber（レベルごと1回の無料強化） | 序盤の強化習慣を作る。HCR2 では総経済の 1.7% に制限し経済を保護 | 高 |
| **運試し系: スピン/宝箱** | 各社標準 | MAF: 報酬タイプ別エンゲージメントで **ガチャ型 31.1%** が最上位（追加手数 30.5%、デイリー報酬 30.3%） | 中 |
| **コンテンツ解放系: スキン/新車両/ボーナス面** | Draw Climber のスキン広告解放、Screw Master の限定スキン | 「試乗（try before you buy）」として IAP への導線にもなる | 中 |
| **復活/コンティニュー** | runner 系全般（失敗直後） | 「失敗の直後」が最も opt-in が高い placement という業界コンセンサス | 高 |

### 7.2 効果の実証データ（確度: 高）

- リワード広告に**エンゲージしたユーザーはリテンション最大 3.5 倍**、**IAP 購入率 4 倍**（複数ソース一致: AppSamurai / MAF / Udonis）
- リワード広告導入で **ARPDAU +30%〜+66%** の事例。Gismart は Meta Audience Network とのプレースメント最適化で LTV +5% / ARPDAU +5–7%
- トップグロス モバイルゲームの **60% がリワード広告を実装**
- 頻度の目安（カジュアル帯）: **1セッション 6–10 回提示、日次キャップ 15–20 回**
- Supersonic の実例: Bazooka Boy はインタースティシャルを Level 3 → Level 8 に遅らせて playtime 1,200 秒 / LTV $1+ を達成 — 「先に楽しさ、広告は後」原則
- eCPM 目安: リワード動画 $16–20 > インタースティシャル $14 前後（リワードは単価も高い）

**設計原則（確度: 高）**: リワード広告は「プレイヤーが**その瞬間に欲しいもの**（コイン倍率・無料強化・限定スキン）」と交換にする。強制視聴と違いリテンションに中立〜プラスで働くことが繰り返し実証されている。

- 出典: [AppSamurai – Rewarded Ads in Mobile Games](https://appsamurai.com/blog/rewarded-ads-in-mobile-games-strategy-data-and-best-practices/), [MAF – Rewarded Ads Stats 2026](https://maf.ad/en/blog/rewarded-ads-stats/), [MAF – 16 Types of Rewarded Video Ads](https://maf.ad/en/blog/types-of-rewarded-video-ads-game-revenues/), [Udonis – Rewarded Video Ads Statistics](https://www.blog.udonis.co/mobile-marketing/mobile-games/rewarded-video-ads), [Supersonic – How to Improve LTV](https://supersonic.com/learn/blog/how-to-improve-the-ltv-of-your-hyper-casual-game), [adjoe – Increase ARPDAU](https://adjoe.io/blog/increase-arpdau-guide/), [Meta Audience Network – Casual/Hypercasual Monetization](https://www.facebook.com/audiencenetwork/resources/reports/winning-in-casual-hypercasual-game-monetization-2022)

---

## 8. 我々のゲーム（線を引いて橋を作り車を走らせる）への推奨（課題 h）

### 8.1 評価軸
「ユーザーがよりゲームが楽しくなるか」= ①コア動詞（描く・走らせる）の体験を変えるか ②実証済みのリテンション/LTV 効果 ③実装コスト ④数値インフレ耐性（ラバーバンディングで無意味化しないか）。

### 8.2 推奨パワーアップ ランキング

#### 第1位: 新車両アンロック（物理特性が異なる車のコレクション）
- **なぜ楽しくなるか**: 車重・車輪数・サイズ・特殊能力（例: バギー=軽くて跳ねる、トラック=重くて頑丈な橋が必要、バイク=細い橋で渡れる）が変わると、**同じレベルでも描くべき橋が変わる** = 横方向進行の本命。
- **証拠**: Jetpack Joyride の Vehicles・HCR2 の車両×固有アップグレード枠が「挙動が変わるアンロック」の実証例（確度: 高）。Crossy Road は 400+ コレクション＋100コインガチャで 3ヶ月 $10M（確度: 高）。Bridge Race もキャラ80+で最多DLハイパカジュ（確度: 中）。
- **実装指針**: 解放手段をミックスする — コイン購入（経済シンク）/ 広告視聴で1日1台試乗（RV接続）/ 実績解放（Lv50到達等）。初期車で全レベルクリア可能に保つ。

#### 第2位: インク量（描ける線の長さ）アップグレード
- **なぜ楽しくなるか**: 我々のコア動詞「描く」の**解空間を直接広げる**。インクが増えるほど、吊り橋・二重橋・スロープ付きなど**創造的な解法が可能になる**。数値だが体験が変わる稀有な軸。
- **証拠**: Draw Joust が Ink を恒久アップグレードとして採用（line-draw 対戦の実例、確度: 中）。Happy Glass 等の line-draw パズルはインク残量ボーナスでスコア化しており「インク=戦略資源」はジャンル共通言語（確度: 中）。
- **実装指針**: レベル設計は「基本インクでクリア可能、インク増で“美しい/楽な”解が解禁」に。上限キャップ必須（無限に増えるとパズル性が崩壊）。6〜10 レベル程度の浅いキャップを推奨。

#### 第3位: コイン倍率（恒久 multiplier + リワード広告の一時 ×2〜×5）
- **なぜ楽しくなるか**: それ自体は経済ブーストだが、**他の全アップグレード/コレクションの到達速度を上げる「メタのメタ」**であり、リワード広告と最も自然に接続する。
- **証拠**: Draw Climber のクリア時 ×5 広告（確度: 高）、Subway Surfers は 2x Multiplier を恒久アップグレード軸として採用（確度: 高）。リワード広告エンゲージユーザーはリテンション 3.5 倍 / IAP 4 倍 / ARPDAU +30–66%（確度: 高）。
- **実装指針**: クリア画面に「×2〜×5 で受け取る」RV を常設（watch rate 40–70% 期待）。恒久倍率アップグレードは +10%/Lv 程度の緩い伸びで。

#### 第4位: 車速 / エンジン（クリアの爽快感・タイム短縮）
- **なぜ楽しくなるか**: 速度は物理走行ゲーで**最も体感されやすい**軸（Draw Climber でもプレイヤーの最優先投資先）。加速が上がると「勢いでギャップを飛び越える」新しい解法も生まれる。
- **証拠**: Draw Climber の Speed 人気（確度: 高）、HCR の Engine が第一アップグレード（確度: 高）。
- **警告（重要）**: Draw Climber は AI をプレイヤーに合わせてスケールさせるため Speed が実質演出化している（確度: 中）。HCR1 では Engine の上げすぎが転倒を招く。**速度を上げるほど描画の精度が要求される（リスクリターン化する）**設計にすれば、数値インフレでなく「遊び方の選択」になる。手動発動のターボ（ブーストボタン）化も有効。
- **実装指針**: 10〜15 レベルキャップ。レベルごとの相対難易度を速度に依存させない（タイム星評価などで速さに意味を持たせる）。

#### 第5位: オフライン収益（Offline Earnings）
- **なぜ入れるか**: ゲームプレイは変えないが、**「開く理由」を毎朝作る**復帰トリガー。line-draw 系メタの標準装備（Draw Climber / Draw Joust の2作とも採用）。
- **証拠**: idle メタを載せた arcade idle サブジャンルが D1 ~50% / D0 25分を実証（Homa/Udonis、確度: 高）。
- **実装指針**: 上限時間（例: 4〜8時間分）を設け、**受け取り時に「広告で×2」RV を接続**（業界定番）。優先度は上の4つより低く、v1.1 以降でも可。

#### 番外（強く検討推奨）: 橋の素材/線の種類アンロック（ロープ橋・鋼鉄・バネ素材など）
- **なぜ楽しくなるか**: 「描く線そのものの物理特性が変わる」= 本作にしかできない horizontal progression。Scribble Rider が「描くホイールの素材」で同種の差別化に成功（確度: 中）。HCR2 の固有アップグレード枠（Thrusters/Grappling Hook）と同型の「挙動を変える枠」。
- 車両アンロックとどちらかを「性能系」、どちらかを「観賞系」に振るとバランス調整が楽になる。レベルギミック（燃える床→鋼鉄のみ耐える等）と組み合わせるとコンテンツパイプラインにもなる。

### 8.3 経済数値の初期パラメータ案（本調査からの逆算、確度: 中）

| 項目 | 推奨値 | 根拠 |
|---|---|---|
| 通貨 | ソフト通貨1本（コイン） | カジュアル帯の定石（§5.1） |
| 通常クリア報酬 | 20〜30 コイン（ほぼ一定） | Draw Climber 実測（§1.2） |
| ボーナス面 | 5 レベルごと、通常の 5〜10 倍 | Draw Climber（§1.2） |
| クリア時 RV | 報酬 ×3〜×5 | Draw Climber ×5、watch rate 40–70%（§7） |
| アップグレード価格曲線 | 初回 50〜100 コイン、以降 ×1.15〜1.25/Lv（序盤）→ +10〜15%/Lv（中盤以降） | idle 数学 ×1.07–1.15 ＋ HCR2 実測（§5.2） |
| レベルキャップ | 体感系（インク/速度）6〜15 Lv、経済系（倍率/オフライン）10〜20 Lv | HCR2=20 / Subway Surfers=6（§5.2） |
| 安価帯の広告無料化 | 序盤 5 レベル分は RV で無料強化可 | HCR2 の Free-Until パターン（§2.2） |
| 車両ガチャ | 1 回 100〜300 コイン（重複あり→重複は少額コイン変換） | Crossy Road 100 コイン（§6） |
| 初回アップグレード到達 | チュートリアル後 2〜3 レベル以内 | first-purchase 習慣形成（§5.3） |

### 8.4 実装順序の提案
1. **v1.0（コア検証と同時）**: クリア報酬コイン ＋ クリア時 RV ×3〜5 ＋ 車速/インクの2軸アップグレード（各 5 Lv 程度）
2. **v1.1**: 新車両（まず観賞スキン 10〜20 種、ガチャ形式）＋ 広告でスキン/車両お試し
3. **v1.2**: 物理特性つき車両・橋素材（horizontal progression の本格化）＋ 実績解放
4. **v1.3**: オフライン収益 ＋ デイリーカレンダー（限定スキン、Screw Master 型）

---

## 9. 確度サマリと限界

- **高確度**: HCR2 の価格曲線・経済総額（wiki 実測値）、リワード広告の効果指標（複数の業界ソースが一致）、ハイブリッドカジュアルのリテンションベンチマーク、Crossy Road のガチャ経済
- **中確度**: Draw Joust / Scribble Rider / Bridge Race のアップグレード詳細（攻略系二次ソース由来。ストア確認は取れているが数値は未検証）、Mob Control / Naavik の分析
- **低確度**: Draw Climber の価格曲線とソフトキャップ（Lv101 頭打ちはユーザーコメント1件のみ）
- **限界**: 「アップグレード種別ごとの A/B テスト数値」（例: インク量 vs 車速でどちらが D7 を何 % 上げるか）はパブリッシャー非公開情報であり、公開データからは踏み込めない。自前の A/B テスト（remote config でアップグレード解放順を変える）で検証すべき領域。

## 10. 主要出典一覧

1. https://www.levelwinner.com/draw-climber-guide-tips-cheats-tricks-to-complete-more-levels/
2. https://www.chaptercheats.com/cheat/iphone-ipod/470404/draw-climber/hint/126166
3. https://hillclimbracing2.fandom.com/wiki/Vehicle_Upgrades
4. https://hillclimbracing2.fandom.com/wiki/Total_Cost
5. https://hillclimbracing2.fandom.com/wiki/Hill_Climber
6. https://hillclimbracing.fandom.com/wiki/Upgrades
7. https://www.gameanalytics.com/blog/hybrid-casual-higher-retention-better-engagement
8. https://naavik.co/deep-dives/evolution-of-hybridcasual-deepdive/
9. https://gameworldobserver.com/2023/07/25/voodoo-hybrid-games-d7-retention-games-and-names-podcast
10. https://www.blog.udonis.co/mobile-marketing/mobile-games/arcade-idle
11. https://www.homagames.com/blog/arcade-idle-a-new-hybridcasual-genre-enters-the-game
12. https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
13. https://dev.to/hiroshi_takamura_c851fe71/game-economy-balancing-how-to-tune-rewards-costs-and-progression-2ale
14. https://crossyroad.fandom.com/wiki/Prize_Machine
15. https://www.gamedeveloper.com/business/how-i-crossy-road-i-made-1-million-from-video-ads
16. https://appsamurai.com/blog/rewarded-ads-in-mobile-games-strategy-data-and-best-practices/
17. https://maf.ad/en/blog/rewarded-ads-stats/
18. https://supersonic.com/learn/blog/how-to-improve-the-ltv-of-your-hyper-casual-game
19. https://supersonic.com/learn/case-studies/bridge-race
20. https://maf.ad/en/blog/mob-control-analysis-hybrid-casual/
21. https://subwaysurf.fandom.com/wiki/Power-Ups
22. https://jetpackjoyride.fandom.com/wiki/Jetpack_Joyride/Vehicles
23. https://realapkclub.com/draw-joust-mod-apk/
24. https://www.pockettactics.com/scribble-rider/download
25. https://enjoy4fun.co.uk/bridge-race/
26. https://thinkingdata.io/blog/breaking-down-the-evolution-of-hypercasual-mobile-games-to-hybridcasual/
27. https://medium.com/@VideoGameMaster/vertical-vs-horizontal-progression-6349ad8a504d
28. https://gamedesignskills.com/game-design/game-progression/

# Draw Bridge (car.bridge.drawing.games) 市場調査レポート

- 調査日: 2026-07-07
- 調査者: 市場調査サブエージェント
- 対象: 「Draw Bridge: 線を引くゲーム, 橋ゲーム」(Google Play package: `car.bridge.drawing.games`) と YouTube Playables 版「Draw Bridge — Brain Game」、および "draw bridge" 系クローン群

---

## エグゼクティブサマリー

1. **package `car.bridge.drawing.games` の正体は、中国・武漢の GameLord 3D（武汉欢乐泡泡信息技术有限公司）が 2022年1月にリリースした広告特化型ハイパーカジュアルゲーム**。累計インストール 約1,124万、評価4.3（米国表示）/3.9（日本表示）、IAPなし・100%広告収益。2026年5月まで更新が続く現役タイトル。
2. **YouTube Playables 版「Draw Bridge — Brain Game」は別会社（ベトナムの Bravestars Games）製**。名前もメカニクスもほぼ同一だが、Google Play 版（GameLord）とは資本関係のない「同名クローン同士」である（確度: 高）。
3. このジャンルで**最も成功しているのは Bravestars Games の「Draw Bridge Puzzle: Brain Game」で Google Play 単体 5,357万インストール**。Web（CrazyGames/Poki/Agame）・YouTube Playables・iOS まで多面展開しており、GameLord 版（11M）の約5倍の規模。
4. コアループは「**指1本で1本の線を描く → 指を離した瞬間に線に物理が乗り、車が自動で走り出す → 旗（ゴール）到達でクリア / 落下・衝突で失敗 → 即リトライ**」。1レベル5〜15秒の超短サイクル。
5. レビュー最大の不満は圧倒的に**広告頻度**（30秒毎/2〜3レベル毎のインタースティシャル、閉じるボタンが機能しない広告）で、次いで**難易度の平坦さ（直線を引くだけでほぼ全クリア可能）とレベルの使い回し**、**進行データ消失バグ**。高評価側は「コンセプトが気持ちいい」「物理挙動が本物」「リラックスできる」「操作が直感的」。

---

## (a) このゲームの正体

### 基本データ（Google Play 実ページの埋め込みデータから直接取得。確度: 高）

| 項目 | 内容 |
|---|---|
| アプリ名（日本語ストア） | Draw Bridge: 線を引くゲーム, 橋ゲーム |
| アプリ名（英語ストア） | Draw Bridge Games: Car Bridge |
| パッケージ名 | car.bridge.drawing.games |
| デベロッパー | GameLord 3D（実体: 武汉欢乐泡泡信息技术有限公司 = 中国・武漢。サイト: gamelord3d.com、サポート: gamelord-service@outlook.com） |
| リリース日 | **2022年1月25日**（Play ページ埋め込みデータ `"Jan 25, 2022"` / epoch 1643160331） |
| 最終更新 | **2026年5月12日（v1.531）** — 現在も運用中 |
| ダウンロード数 | **10,000,000+（内部実数: 11,237,092）** |
| 評価 | 米国ストア表示 **4.3**（4.2627）/ 日本ストア ld+json では **3.88**。評価数 **75,542** |
| 評価分布 | 5★ 54,397 / 4★ 5,702 / 3★ 4,421 / 2★ 2,498 / 1★ 8,265（5★比率 72%、1★比率 11%） |
| 価格・IAP | 無料。**IAP なし**（"In-app purchases" ラベル自体が存在しない。100%広告収益） |
| 広告 | "Contains ads" ラベルあり |
| コンテンツレーティング | 12+（Sexual Innuendo 警告 — 広告起因とみられる） |
| サイズ / 要件 | 約121〜154MB / Android 6.0+（Aptoide 記載では 7.0+） |
| 展開 | Android、Google Play Games on PC（Windows） |
| エンジン | Unity（クローン群共通。確度: 中） |

- 評価値が日本 3.88 / 米国 4.26 と地域で大きく異なる（日本ユーザーの満足度が相対的に低い）。確度: 中（取得タイミング・地域重み付けの仕様差の可能性あり）。
- GameLord 3D は「Fill Up Fridge: 冷蔵庫収納」「Galaxy 戦闘機シューティング」「Conquer the Tower」「数字で塗り絵」など量産型カジュアルアプリを多数持つポートフォリオ型パブリッシャー。他タイトルには $0.99〜$99.99 の IAP があるが、本作にはない。
- バージョン履歴（Uptodown）: 1.491 (2025/03) → 1.501 (2025/08) → 1.521 (2025/12) → 1.531 (2026/05) と、リリースから4年以上マイナー更新が継続。

Sensor Tower / AppMagic の本作単体の DL・収益推定は無料公開されておらず取得不可（Sensor Tower にページ自体は存在: `app.sensortower.com/publisher/android/GameLord+3D`）。

出典:
- https://play.google.com/store/apps/details?id=car.bridge.drawing.games&hl=ja （ld+json・埋め込みデータを直接解析）
- https://play.google.com/store/apps/details?id=car.bridge.drawing.games&hl=en_US
- https://play.google.com/pc-store/games/details?id=car.bridge.drawing.games&hl=en
- https://applion.jp/Draw-Bridge/android-car.bridge.drawing.games/
- https://www.appbrain.com/app/draw-bridge-games-save-car/car.bridge.drawing.games （検索スニペット: 累計11M DL、4.27/75K）
- https://draw-bridge-gamelord-3d.en.aptoide.com/app
- https://car-bridge-drawing-games.en.uptodown.com/android
- https://appmagic.rocks/publisher/gamelord-3d/1_9080418954315860537/?hl=en

---

## (b) コアループの詳細

### 1レベルの流れ（確度: 高 — 公式説明文・複数プラットフォームの How to play・攻略記事のクロスチェック）

```
レベル開始（車 + 地形 + ゴールの旗が静止表示）
  → 画面をタッチして線を描き始める（指1本ドラッグ、一筆書き）
  → 指を離す = 描画確定
  → 【重要】離した瞬間、線に重力・物理が適用され（たわむ/落ちる）、
     同時に車が自動で走り出す（プレイヤーは運転操作しない）
  → 旗に到達 = クリア → 次レベルへ（クリア時にインタースティシャル広告が挟まる）
  → 失敗（後述） = 即リトライボタン → 同レベル再挑戦（回数制限・スタミナなし）
```

- 公式説明（Bravestars 版、GameLord 版もほぼ同一メカニクス）: 「Touch the screen to start drawing. Hold and drag across to make the shapes you want. **Once you finish, release your finger and the car will run.**」
- Agame 版の説明: 「**The moment your line is done, the car will start driving**」。
- GameLord 版公式: 「drag with one finger to draw a bridge that is stable enough to the car reach flags. **You can draw bridge on only one line**」— 1レベルにつき描けるのは1本の線のみ、という制約がパズル性の核。
- 線は重力に逆らえない（「your car bridge can not fight against gravity」）ため、「描いた線がどこに落ち着くか」の予測がスキル要素。日本の攻略記事も「線を引いたあと重力が働くので、思った場所に橋が架からない」ことを面白さの中心に挙げる。

### 失敗条件（確度: 高）

- 車が**穴・谷に落下**する
- **壁・障害物に衝突**する / 車が転倒する（橋が不安定で崩れる場合を含む）
- 後半レベルの障害: 落とし穴、対向車・動く車両、爆発物、動く足場（Eureka 版攻略記事）

### レベル構造（確度: 中〜高）

- レベルは1000超（米レビュー「I'm above level 1050」）。ただし**実質的なユニーク面は約80〜100で、以降は同じレベルの使い回し**という指摘が複数（「after level 100 it just repeats itself」「After maybe 80 level the game starts to repeat itself」）。
- 難易度は極めて平坦。「**ほぼ全レベルが直線1本で解ける**」というレビューが複数（「you can play the whole game by only drawing straight lines」）。90番台に1〜2面だけ難所がある程度。
- 1レベルの所要時間は**5〜15秒**（「levels take 5 seconds」「Played 30 levels. None took more than 15 seconds」）。
- 追加コンテンツ: 車両アンロック（バイク、スポーツカー、消防車等。公式には「all free to unlock」）。ただし「レベル1050でも1台しか解放されない」というアンロック不全の報告あり（確度: 中）。
- **アプリ内に別ミニゲームを同梱**（タワー侵略系、モンスターマージ系など「4 games in the app」）。トップ画面から遷移でき、実質的に自社ゲームのクロスプロモ兼滞在時間稼ぎ（確度: 中 — 複数レビューで言及）。

### リトライ動線（確度: 高）

- 失敗 → 即時リトライ。ペナルティ・スタミナ・制限時間なし（トライ&エラー前提の設計。CrazyGames も「no attempt limits or countdown timers, stress-free」と説明）。
- ポイ活攻略記事（類似作）によると、**失敗時に広告視聴で必ずコンティニュー可能**、**詰まった面はリワード広告（約60秒）でヒント/スキップ**という動線が典型。
- 日本のポイ活案件では「150ステージクリア」がミッション化されており、1日2〜3時間×3日で到達可能な難易度感。

出典:
- https://play.google.com/store/apps/details?id=car.bridge.drawing.games&hl=en_US （公式説明全文）
- https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame&hl=en （How to play）
- https://www.agame.com/game/draw-bridge-brain-game
- https://www.crazygames.com/game/draw-bridge-brain-game
- https://games.appmatch.jp/1558771114-2/ （Eureka 版攻略）
- https://poikatsu.raimugi.com/poi_drawbridge/ （ポイ活実プレイレポ）
- https://app.gamedia.jp/game/6716 （日本語レビュー: 物理挙動・失敗条件）

---

## (c) ユーザーレビュー分析

### 高評価が褒める点（何が気持ちいいか）

| テーマ | 代表的な声 | 出典 |
|---|---|---|
| コンセプト・メカニクスの快感 | 「it works mechanically and **the concept was neat**」「Its a cool concept」 | Play US / App Store US |
| 物理シミュレーションの本物感 | 「物理計算が生む**リアルな挙動**」が評価点（日本語レビューサイト） | Gamedia |
| 自由な解法・創造性 | 「論理的でも**完全に変な形でも試せる自由**。正解が1つに固定されない」 | CrazyGames 解説 |
| リラックス・手軽さ | 「relaxing」「distract your mind に良い」「チュートリアル不要で直感的」 | App Store / appmatch |
| 難易度の低さが逆に心地よい | 「Most of the levels are really easy... **the ads are not bad like others**」 | Play US |
| 短時間で達成感 | 1面5〜15秒でクリア演出が来る高速報酬ループ | 各レビューから推定（確度: 中） |

数字上は 5★ が72%を占め、「コンセプト自体は広く受けている」ことを裏付ける。1★は11%で、その大半が広告への不満。

### 低評価の不満（頻度順）

1. **広告の頻度・拘束時間**（圧倒的1位）
   - 「**Ads in every 30 seconds** and most of the time you're not allowed to click it off. If you click on the cross, the page just takes you to the ad page」（×ボタンがストア誘導になる偽閉じボタン）
   - 「levels take 5 seconds to pass but **ads take 30 seconds**」「2 ads every minute」「every round, you're stuck watching 2 ads at minimum」
   - 「Nothing but an **ad generator** every 30 seconds」
   - 日本語: 「レベル10くらいに入る広告で**戻るボタンが永遠に出ない**のでそれ以上出来なくなる（多分、同じゲームの広告）どうしろっつーのさ…」
2. **オフライン不可（広告配信のための実質オンライン強制）**
   - 「Can't play with wifi or data turned off. It shows a bad network error... **Because it wants to show you ads**」— 公式の「No wifi needed」表記と矛盾
3. **難易度が平坦・レベル使い回し**
   - 「you can just draw a line about anywhere and beat the level」「No real progression. Bunch of filler levels」「after level 100 it just repeats itself」
4. **進行データ・コインの消失バグ**
   - 「all of my progress was lost... everytime I close the app it deletes all of my progress」
   - 日本語: 「おもしろいですが、**広告を見たあとトップ画面からスタートでコインが無効になってたり**、不具合みたいなことが多いです。…せっかくレベル11まで行って広告を見たのに、戻ったらタイトル画面からでまた最初の説明からでした」
5. **報酬・アンロックの不全**
   - 「I'm above level 1050 and **only have one junky race car unlocked**」— 車両アンロックが公称通り機能していない
6. **広告詐欺（プレイアブル広告と実ゲームの乖離）**
   - 「nothing like it's shown in the ads for it」

### 示唆

- 「コンセプト・物理の快感は本物、しかし広告設計とコンテンツ量で自滅している」というのがレビュー全体の構図。**広告頻度を抑えるだけで NPS が大きく改善する余地**がある。
- 日本ユーザーは広告バグ（閉じられない広告、進行リセット）への言及が多く、日本での評価 3.9 と低い一因とみられる（確度: 中）。

出典: Google Play（英語・日本語レビューを HTML 埋め込みデータから直接抽出）、https://apps.apple.com/us/app/draw-bridge-puzzle-draw-game/id6443484884（iOS 類似作レビュー）

---

## (d) 収益化

### GameLord 版（car.bridge.drawing.games）

| 項目 | 内容 | 確度 |
|---|---|---|
| IAP | **なし**（ストアに IAP ラベル不存在。広告除去オプションすらない） | 高 |
| インタースティシャル | レベルクリア毎〜2、3レベル毎 + 失敗時。実測 15〜30秒級の動画広告。スキップ不可のものが多い | 高（多数のレビュー + ポイ活実測） |
| リワード | 失敗時のコンティニュー、ヒント/ステージスキップ（約60秒枠の報告あり） | 中（ポイ活記事は類似作の可能性） |
| バナー | ジャンル慣行としては常設（Bravestars 版は「複数バナー常時表示」の報告）。GameLord 版単体での明確な証言は未確認 | 低〜中 |
| オンライン強制 | 広告在庫取得のためオフライン時に「bad network error」でプレイ不能になる報告 | 高 |
| クロスプロモ | アプリ内に自社ミニゲーム（タワー侵略・マージ系）を同梱し相互送客。広告視聴を進行の実質条件にする設計 | 中 |
| 広告SDK | 不明（AppBrain の SDK 情報は取得不可。ジャンル標準は AdMob + AppLovin MAX メディエーション。クローン元テンプレは Unity Ads 同梱） | 低 |

- 特筆点: **競合（Bravestars: NO ADS $4.99 / 800円、COMMANDOO: Remove Ads $1.99）が広告除去 IAP を持つのに対し、GameLord 版は広告除去手段が一切ない**。短期 eCPM 最大化に全振りした設計で、レビュー炎上の主因。
- なお「Draw Bridge Puzzle, Car Bridge (complete unity Game + **unity ads** + GDPR)」という**完成品 Unity テンプレートが CodeCanyon で市販**されており、このジャンルのクローンが量産される供給構造がある。

出典:
- Google Play 実ページ解析（IAP ラベル不存在の確認）
- https://poikatsu.raimugi.com/poi_drawbridge/
- https://apps.apple.com/us/app/draw-bridge-puzzle-draw-game/id6443484884
- https://codecanyon.net/item/draw-bridge-puzzle-complete-unity-game-unity-ads/36759470

---

## (e) YouTube Playables 版との違い

### 最重要ファクト: 開発元が違う（確度: 高）

- Playables 版「**Draw Bridge — Brain Game**」（https://www.youtube.com/playables/Ugkx1kIk5VWSM6C-fsFy2F98Lf1fc3ZNlBqI）のページ HTML には開発元として **Bravestars Games** が明記されている（当方でページソースを直接確認）。
- 説明文: 「Fun physics puzzle where you draw roads and bridges to help a car reach its destination. Build safe paths over gaps and obstacles.」
- つまり Playables 版は **Google Play の `car.bridge.drawing.games`（GameLord 3D）の移植ではなく、最大手クローン Bravestars の HTML5 版**（CrazyGames「Draw Bridge」= Unity 2021 製 Web ビルド、2025年4月リリースと同系統）。

### プラットフォーム仕様による違い（確度: 高 — Google 公式デベロッパードキュメント）

| 観点 | Google Play 版（GameLord/Bravestars） | YouTube Playables 版 |
|---|---|---|
| 配布 | APK インストール（120〜270MB） | YouTube アプリ/Web 内で即時起動（HTML5、DLなし） |
| ゲーム内広告 | インタースティシャル/リワード多数 | **ゲーム内の独自広告・IAP・外部誘導は規約で全面禁止** |
| 広告体験 | 開発者側 SDK が 30秒毎に挿入 | YouTube 側が管理: プリロール（自動）+ 自然な区切りのインタースティシャル + オプトイン式リワードのみ |
| 課金 | （Bravestars版）広告除去 IAP | 不可 |
| 進行保存 | 端末ローカル（消失バグ報告多数） | YouTube アカウントに紐づく公式セーブ機構 |
| 収益化の現状 | 広告収益は開発者へ | レベニューシェアは2026年時点で**選抜パブリッシャー限定のパイロット段階**（2026年5→6月で10倍成長との業界報告） |

- 体験面の実質差: Playables 版は「**広告がほぼ無い/軽い Draw Bridge**」であり、Google Play 版最大の不満点（広告地獄）が構造的に存在しない。コアループ自体は同一。
- Bravestars が Playables に出している理由は、CrazyGames 等と同じ「Web 流通によるブランド接触の最大化 + 将来のレベシェア先行者利益」とみられる（確度: 中）。

出典:
- https://www.youtube.com/playables/Ugkx1kIk5VWSM6C-fsFy2F98Lf1fc3ZNlBqI （ソース解析で Bravestars Games を確認）
- https://developers.google.com/youtube/gaming/playables/certification/requirements_monetization
- https://developers.google.com/youtube/gaming/playables/reference/monetization
- https://mediacube.io/en-US/blog/youtube-playables-monetization
- https://www.crazygames.com/game/draw-bridge-brain-game

---

## (f) 「draw bridge」系クローン群の勢力図

### 主要プレイヤー比較

| タイトル | 開発元（国） | プラットフォーム | DL/規模 | 評価 | 収益化 | 状態 |
|---|---|---|---|---|---|---|
| **Draw Bridge Puzzle: Brain Game** | Bravestars Games（ベトナム） | Google Play / iOS（Brave HK Limited名義）/ CrazyGames / Poki / Agame / **YouTube Playables** | **Google Play 50M+（実数 53,567,339）**。累計48M説（AppBrain）、直近30日 約17万DL | Play 4.22（33,481件）/ iOS 3.3（738件） | 広告 + **NO ADS $4.99**（JP 800円）IAP | 2022/07/21 リリース、現役・最成功 |
| **Draw Bridge Games: Car Bridge**（本調査対象） | GameLord 3D（中国・武漢） | Google Play / Play Games PC | **11.2M** | 4.26（US）/3.88（JP）、75,542件 | 広告のみ・IAPなし | 2022/01/25 リリース、現役 |
| **Draw Bridge -知能チェック物理パズルゲーム** | Eureka Studio Inc. | Google Play (com.eurekastudio.drawbridge) / iOS (id1558771114) | **10M+** | 4.0 | 広告（5秒スキップ可）+ ステージスキップ/広告除去 IAP | 日本市場に強い（ポイ活案件・攻略記事多数）。2021年頃〜 |
| Car Climber: Draw Bridge 3D | COMMANDOO JSC（ベトナム） | iOS | 小規模（154件） | 3.6 | 広告 + Remove Ads $1.99 + スターターパック | 3D差別化を試みた派生 |
| Draw Bridge Puzzle | Weegoon | Google Play | 中規模 | — | 広告 | クローン |
| Draw Your Bridge: Brain Puzzle | Gello Studio | Google Play | 中規模 | — | 広告 | クローン |
| Draw a Bridge: Puzzle Games | Brames | Google Play | 小規模 | — | 広告 | クローン |
| Draw Bridge Puzzle（Web） | Eyestorm Pte. LTD | CrazyGames | Web のみ（2025/07、Unity 6） | 9.1/10 | サイト広告 | バイク版・ragdoll 演出 |
| Draw the Bridge（Web） | FreezeNova | 各種 Web ポータル | Web のみ | — | サイト広告 | クローン |
| （供給源）Unity 完成テンプレート | MdoStudio11 | CodeCanyon | ソースコード販売 | — | Unity Ads + GDPR 同梱 | クローン量産の温床 |

### どれが一番成功しているか

**Bravestars Games 版が圧倒的勝者**（確度: 高）。
- Google Play 単体で 53.5M インストールと GameLord 版の約5倍。
- mobilegamer.biz × AppMagic の 2024年上半期データで、Bravestars Publishing は**世界 DL 数ランキング 13位（2.16億 DL）**。「Hair Salon」と並んで Draw Bridge Puzzle が牽引タイトルとして名指しされている。
- 差別化ポイント:
  1. **マルチプラットフォーム流通**（ストア + Web ポータル + YouTube Playables）でストア外からユーザーを刈り取る
  2. **広告除去 IAP（$4.99）**による「不満の出口」の用意
  3. コンテンツレーティング **Everyone**（GameLord 版は広告起因で 12+）
  4. バイク・複数車両・ragdoll などの演出バリエーション
- 一方 GameLord 版は「Play ストア内 ASO（"draw bridge car" キーワード群を詰めた commercial 的タイトル/説明文）+ 広告全振り」の中国型量産モデル。評価数 75K は Bravestars（33K）より多く、**インストールあたりのレビュー発生率が異常に高い = 広告への怒りがレビューを誘発している**とも読める（確度: 低〜中の解釈）。

### 系譜（ジャンルの起源）

「線を描いて物理で解く」ジャンルの直系祖先は **Brain Dots**（Translimit、2015、日本）→ **Love Balls / Happy Glass**（Lion Studios、2018）で世界的に確立し、**Draw Climber**（Voodoo、2019）等を経て、2021〜2022年に「車を旗まで走らせる」bridge-drawing サブジャンルとして Eureka Studio → GameLord 3D → Bravestars が相次いで参入した（確度: 中）。ハイパーカジュアル業界全体は 2024年以降新規リリースが減速し、既存ヒットのハイブリッドカジュアル化・長期運営にシフトしており、Draw Bridge 系が4年運用されているのはその典型例。

出典:
- https://mobilegamer.biz/2024s-top-publishers-by-downloads-so-far/ （AppMagic データ）
- https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame&hl=en （実ページ解析）
- https://www.appbrain.com/app/draw-bridge-puzzle-brain-game/com.bravestars.draw.bridge.drawgame
- https://apps.apple.com/us/app/draw-bridge-puzzle-draw-game/id6443484884
- https://apps.apple.com/us/app/car-climber-draw-bridge-3d/id6446278695
- https://applion.jp/android/app/com.eurekastudio.drawbridge/
- https://www.appbrain.com/app/draw-bridge/com.eurekastudio.drawbridge
- https://www.crazygames.com/game/draw-bridge-puzzle
- https://codecanyon.net/item/draw-bridge-puzzle-complete-unity-game-unity-ads/36759470
- https://poki.com/en/g/love-balls / https://poki.com/en/g/happy-glass

---

## (g) ゲームプレイ動画・実プレイ情報から読み取れる演出詳細

参照した動画・実プレイ資料: DroGames「Draw Bridge - Gameplay Walkthrough Level 1-50 (Android, iOS)」（2022/01/17、6,495回再生、Eureka 版）、Skill Game Walkthrough の Draw Bridge Puzzle プレイリスト、ポイ活実プレイレポ、各 Web ポータルの How to play。

### 描画フェーズ
- 画面をなぞると**線がリアルタイムに描画**される（インク/クレヨン調の太い線）。一筆書き制約があるため、描き直しは「リセットして再描画」。
- 使用インク量に制限がある面も存在（線の長さゲージ）。長い線ほど不安定になり、物理的に「たわむ」（確度: 中）。

### 車が走り出す瞬間（このゲーム最大の「快感ポイント」）
- **指を離した瞬間**に (1) 線が剛体化して重力で落下・着地し、(2) 同時に車のエンジンがかかり自動で右へ走り出す。この「自分の描いた線が世界に物理として置かれ、即座に結果が返る」0秒フィードバックがジャンル共通の中毒性の核（確度: 高 — 「The moment your line is done, the car will start driving」等の複数一次記述）。
- 車はアクセル固定・操作不能。橋のたわみ、傾き、車の跳ね方はすべて物理任せで、**成功でも失敗でも「見世物」になる**（Eyestorm 版は ragdoll を明示的に売りにする）。

### ゴール時の演出
- ゴールは**旗（flags）**として表現され、車が旗に到達するとレベルクリア。クリア時はポップアップ（Level Complete）→ 次レベルボタン → （高頻度で）インタースティシャル広告、の順（確度: 高）。
- 紙吹雪・ファンファーレ級の派手な祝福演出への言及は見つからず、演出はポップアップ中心の軽量なものとみられる（確度: 低〜中。実機確認推奨）。

### 失敗時の演出
- 車が谷に落ちる/障害物に激突して転がる様子がそのまま表示され、Retry ボタンが即出現。ペナルティなし。「失敗が面白い」ragdoll 的挙動がリトライの心理コストを下げている（確度: 中〜高）。

### コイン・報酬演出
- GameLord 版には**コイン経済が存在**（日本語レビュー「広告を見たあと…コインが無効になってたり」から確認）。クリア報酬 + リワード広告ブーストで貯め、車両アンロックに使う構造が推定される（確度: 中）。
- 「フリップ（宙返り）でコイン獲得」という記述が一部流通しているが、一次ソースで確認できず（確度: 低）。
- 車両バリエーション（バイク/スポーツカー/消防車/車椅子絵文字まで公式説明に登場）が実質的なコレクション報酬。ただし前述の通りアンロック不全のレビューあり。

### UI・アートスタイル
- フラット&カラフルな 2D（「Colorful UI」が公式の売り文句）。背景は空・丘などの単純なグラデーション。ステージ番号が大きく表示され、進行感を演出（確度: 中）。

出典:
- https://www.youtube.com/watch?v=ZNXTWcMG15E （メタデータ・説明文を直接取得）
- https://www.youtube.com/playlist?list=PL7buRgWZeZ2mnawMeW_-ZBD1rZ2lH75ta
- https://www.agame.com/game/draw-bridge-brain-game
- https://www.crazygames.com/game/draw-bridge-puzzle
- https://poikatsu.raimugi.com/poi_drawbridge/
- https://app.gamedia.jp/game/6716

---

## 確度サマリー

| 項目 | 確度 |
|---|---|
| (a) パブリッシャー・リリース日・DL 実数・評価・更新日 | 高（Play 実ページの埋め込みデータを直接解析） |
| (b) コアループ・失敗条件・リトライ | 高 |
| (b) レベル総数・使い回し・車両アンロック不全 | 中（レビュー由来） |
| (c) レビューのテーマ分析 | 高（日英の実レビュー原文を抽出） |
| (d) 広告フォーマットの内訳・秒数 | 中（実プレイレポは類似作の可能性が残る） |
| (d) IAP なし | 高 |
| (e) Playables 版 = Bravestars 製 | 高（ページソースで確認） |
| (f) Bravestars が最成功・規模感 | 高（Play 実数 + AppMagic/mobilegamer.biz） |
| (g) 演出詳細（走り出し・失敗） | 中〜高 |
| (g) ゴール/コイン演出の具体的ビジュアル | 低〜中（実機プレイでの確認を推奨） |

## 全出典一覧

1. https://play.google.com/store/apps/details?id=car.bridge.drawing.games&hl=ja
2. https://play.google.com/store/apps/details?id=car.bridge.drawing.games&hl=en_US
3. https://play.google.com/pc-store/games/details?id=car.bridge.drawing.games&hl=en
4. https://www.youtube.com/playables/Ugkx1kIk5VWSM6C-fsFy2F98Lf1fc3ZNlBqI
5. https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame&hl=en
6. https://www.appbrain.com/app/draw-bridge-games-save-car/car.bridge.drawing.games
7. https://www.appbrain.com/app/draw-bridge-puzzle-brain-game/com.bravestars.draw.bridge.drawgame
8. https://www.appbrain.com/app/draw-bridge/com.eurekastudio.drawbridge
9. https://applion.jp/Draw-Bridge/android-car.bridge.drawing.games/
10. https://applion.jp/android/app/com.eurekastudio.drawbridge/
11. https://www.crazygames.com/game/draw-bridge-brain-game
12. https://www.crazygames.com/game/draw-bridge-puzzle
13. https://www.agame.com/game/draw-bridge-brain-game
14. https://apps.apple.com/us/app/draw-bridge-puzzle-draw-game/id6443484884
15. https://apps.apple.com/us/app/car-climber-draw-bridge-3d/id6446278695
16. https://apps.apple.com/jp/app/id1558771114
17. https://car-bridge-drawing-games.en.uptodown.com/android
18. https://draw-bridge-gamelord-3d.en.aptoide.com/app
19. https://poikatsu.raimugi.com/poi_drawbridge/
20. https://games.appmatch.jp/1558771114-2/
21. https://app.gamedia.jp/game/6716
22. https://mobilegamer.biz/2024s-top-publishers-by-downloads-so-far/
23. https://codecanyon.net/item/draw-bridge-puzzle-complete-unity-game-unity-ads/36759470
24. https://developers.google.com/youtube/gaming/playables/certification/requirements_monetization
25. https://developers.google.com/youtube/gaming/playables/reference/monetization
26. https://mediacube.io/en-US/blog/youtube-playables-monetization
27. https://www.youtube.com/watch?v=ZNXTWcMG15E
28. https://appmagic.rocks/publisher/gamelord-3d/1_9080418954315860537/?hl=en
29. https://app.sensortower.com/publisher/android/GameLord+3D
30. https://poki.com/en/g/love-balls

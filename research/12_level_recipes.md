# 12. 競合レベル・レシピ大全（線の"役割"多様化）+ L4-L15 割当 v4

> 作成: 2026-07-08 / スコープ: **オリジナル案 禁止**。全レベルを **文書化された競合実例**（出典付き）に紐づけて再設計する。
> 発端マンデート:「我々は線の役割を使えていない。列挙する — **道にする / 落ちてくる・転がってくるものを防ぐ(shield) / 引っ掛けて道にする(hook) / 一本書きで複数の穴を塞ぐ(multi-seal)**。競合の実例（出典）に基づき 15 型以上のレシピを集め、各スロットに割り当てよ。」
> 先行: [research/11_spatial_patterns.md](./11_spatial_patterns.md)。**11 は "車が地形にハンプを描く" 前提で、可動ハザードが無いため shield/catch/dome/wrap 役割を明示的に除外していた**（11 §1.2「可動ハザード・回転体なし(v1)」「球捕獲は本ゲームに無い動詞」）。本書はその制約を、**並行タスクで実装中の新 rock エンティティ（円 body・spawn位置/半径/初速で落下・転がる、車は通常物理接触で死亡）** が解除する、という前提で全面刷新する。
> 証拠画像（本設計のグラウンドトゥルース）: 10.png(Draw Bridge L210 hook/wrap) / 11.jpeg(Draw Line Bridge: sag-rope + SAVE THE CAR shield) / 12.jpeg(Draw Bridge L69-74 dome-dual-role) / 9.jpeg(自作 = 全ハンプ、反面教師)。

---

## 0. エグゼクティブサマリ（結論先出し）

1. **自作レベルの病理は「線の役割が road ハンプ 1 種に固定」。** 証拠画像 9.jpeg（現行 ch1-l04〜l10+b）は **全 11 面が `∧`/`⌣`/`Ramp` = 壁や谷を越える駆動面（road）1 役割**。競合が同じ "1 本線" 縛りで見せている **shield / hook / multi-seal / dome-dual / catch-redirect** の役割群を一切使っていない。ユーザーの「線の役割を使えていない」は画像で裏が取れる正しい指摘。

2. **役割の多様化を可能にする唯一の鍵は "並行タスクの rock エンティティ"。** 落下/転がる円 body が入ると、線は初めて **"防ぐもの(shield)"・"逸らすもの(catch-redirect)"・"守りながら通す屋根(dome-dual-role)"** になれる。**rock 無しの現行スキーマでは shield 系は原理的に作れない**（11 の除外判断は当時正しかった）。→ **本書のレシピの約半分は rock エンティティに依存**。§4 に **rock 依存/非依存を明示**し、rock が間に合わなくても非依存面（multi-seal / ramp-jump / hook-cantilever / spike 系）だけで出荷できる分割を用意した。

3. **1 ストローク縛りの下での "役割" の本質は「その 1 本に road 以外の仕事を兼任させる」こと。** InkBridge は「車が地形に道を描く」ゲームなので、競合の "人を守る" レシピは全て **"車／走行ルートを守る"** に翻訳する（マンデート「NO people」順守）。兼任のさせ方は 2 型:
   - **(A) road + shield 兼任**: ギャップ**かつ**落石があり、1 本が「渡る橋」と「守る屋根」を同時に担う（= dome-dual-role、証拠 12.jpeg。本ゲームの目玉機構）。
   - **(B) 純 shield / 純 deflector**: 道は**地形**が提供し、1 本は落石を止める壁 / 転石を逸らすランプに専念する（証拠 11.jpeg SAVE THE CAR、Stickman Rescue の屋根）。
   → **(A) は InkBridge ネイティブ**（coin が線=ルート上に自動配置される設計と噛み合う）。**(B) は coin 配置ロジックの微修正が要**（§5.3 で明示）。

4. **競合の "強い形" 知見が難度と juice の両方を作る。** Stickman Rescue の公式攻略「落石には**傾けた頑丈な屋根/アーチ**、矢には**垂直の壁**、直線より**三角・アーチが安定**」は、本ゲームの物理（`breakForceFactor=10`、アーチは荷重を分散して破断しにくい、11 §1.2）と一致。**「落石が乗る→平線は破断/貫通、アーチは耐える」= 直線否定(AD)を "インク欠乏" でなく "落石荷重" で作れる** → 11 §3 の「予算は潤沢、難度は幾何/物理」方針をそのまま強化。

5. **16 レシピ（全て出典付き）を収集し、L4-L15 + B1-B3 に割当（§4）。** 難度は **cognitive complexity（線に兼任させる仕事の数）** で昇順、**隣接スロットは同一 role を持たない**ように交互配置。目玉 dome-dual-role を **L10（中間クライマックス lite）と L15（ボス full）** に二段配置し、その間に shield/hook/multi-seal/catch を挟む。

---

## 1. 役割タクソノミ（マンデート語彙 → 定義 → InkBridge 翻訳 → ネイティブ度）

> **ネイティブ度**: ◎= 1 本が road を兼ね coin 自動配置と噛み合う / ○= 地形が road、線は補助（coin 微修正） / △= 実装可だが要校正。**rock 依存**: 新 rock エンティティが必要か。

| role タグ | マンデート語彙 | 定義（線が担う仕事） | InkBridge 翻訳（NO people） | ネイティブ | rock 依存 |
|---|---|---|---|---|---|
| **road** | 道にする | ギャップ/障害を越える駆動面 | 現行と同じ。橋/ランプ | ◎ | 無 |
| **shield-static** | 落ちてくるものを防ぐ | **真上から落ちる**物を受ける/弾く屋根・アーチ | 車 or ルート上の一点へ落ちる rock を、傾けた屋根で脇へ逸らす | ○ | **有** |
| **shield-dynamic-block** | 転がってくるものを防ぐ | **横から転がってくる**物を止める垂直壁 | 斜面を転がり落ちる rock を、壁/バンプで堰き止める | ○ | **有** |
| **catch-redirect** | （防ぐの発展） | 転石を**受けて別方向へ逸らす**ランプ/漏斗 | 転石をランプで側溝(pit+killY)へ落とし、車の路を空ける | ○ | **有** |
| **hook-cantilever** | 引っ掛けて道にする | 片側の縁/ペグに**引っ掛けて**張り出す片持ち | 片リムにアンカーし対岸/低所へ届かせる（開曲線） | △ | 無 |
| **multi-seal** | 一本書きで複数の穴を塞ぐ | 1 本で**複数の穴/障害**を連続被覆 | 連続した小穴・ハザードを 1 本の道で塞ぐ | ◎ | 無/可 |
| **dome-dual-role** | 防ぐ＋道の兼任 | **同一の 1 本が守る屋根 かつ 走る道**（目玉） | pit 上に落石を弾くアーチを架け、車がその上を走る | ◎ | **有** |
| **sag-rope-over-hazard** | 防ぐ（張り渡し） | ハザード上に**張り渡した**線で下の危険を跨ぐ | pit 内 spike/rock 上に線を張り、車が上を渡る | ○ | 無/可 |
| **ramp-jump** | 道（跳ぶ変種） | **跳躍台**を描き障害を飛び越す | ランプで車を射出、spike/gap/rock を飛び越え着地 | ○ | 無/可 |

**現行の欠落（画像 9 との差分）:** 現行 11 面は全て **road** 一択。上表 **8 つの非 road 役割が丸ごと未使用**。本書はこの 8 役割に文書化競合実例を割り当てて是正する。

---

## 2. レシピ・カタログ（16 型・全て出典付き）

> **凡例（geometry）:** `S`=spawn(車→右進), `G`=goal(旗), `▁`=台/地形, `▽`=pit(落下=killY), `∏`=壁/柱, `^`=spike(静的), `▔`=天井/庇, `●`=rock(新エンティティ), `→/↓`=rock 初速, `~`=描く線, `·`=coin。
> **各レシピ 5 項目必須:** (1)出典 (2)geometry (3)線の role (4)player が解く cognitive task (5)InkBridge feasibility（rock spec 含む）。

---

### R01 — Protective Dome + Road（守る屋根 = 走る道の兼任）★目玉

- **出典**: Draw Bridge (Eureka Studio, com.eurekastudio.drawbridge) **Levels 69-74**, YouTube "Draw Bridge – All Levels Gameplay Android,ios (Levels 69-74)" (2022/04/23)。証拠画像 **12.jpeg**。
- **geometry**:
  ```
        ●↓(落石 or 頭上ハザード)
   S▁▁      ~~~~~        ▁▁G
       \~~/ (pit) \~~/
        ▽  [守る対象] ▽
  ```
  pit 上に 1 本のアーチ。アーチが下の空間を覆い（屋根）、車はアーチの背を渡る。
- **role**: `dome-dual-role`。
- **cognitive task**: 「この 1 本は道か盾か？ → **両方**」。低い平橋は落石を弾けず割れる／高すぎるアーチは車が登れない。**"守れる高さ" と "登れる勾配" の交点** を 1 本で当てる。全ハンプ面には無い二重制約。
- **feasibility**: **rock 依存(有)**。rock spec = pit 中央上方 spawn、半径 ~0.4m、初速 0（自由落下）or 微小 ↓。アーチが落石荷重（静荷重の数倍の衝撃）に耐える必要 → **アーチ形は破断しにくい**（11 §1.2、荷重分散）が、平線は break。`breakForceFactor=10` で 4m 級アーチは耐える見込み、ゴースト録画で衝撃 stress を実測校正。coin はアーチ背（=ルート）に自動配置で ◎ ネイティブ。**本ゲームの看板機構**。

---

### R02 — Hook / Wrap around Hazard Zone（ハザードを引っ掛けて回り込む）

- **出典**: Draw Bridge (Bravestars, com.bravestars.draw.bridge.drawgame) **Level 210**。証拠画像 **10.png**（天井から降りるスパイク/レーザー帯を、線が上→横→回り込んで避けつつ、pit の小台へ経路を作る）。
- **geometry**:
  ```
        ▔▔∏▔▔  (天井 + 下向きハザード柱)
   S▁    ^(危険帯)      ▁G
     ~~~~/        \~~~~   (危険帯の外周を回す開曲線 C/S)
          ▽[小台]▽
  ```
- **role**: `hook-cantilever`（開いた C/フック。**閉ループ(enclosure)ではない** — 11 §2 X01 で閉曲線は Ch1 非採用）。
- **cognitive task**: 「危険帯を**貫かず外周を縫う**」。直線は危険帯に激突。線を一度**上げてから回し込む** S/C の取り回しを考えさせる。「引っ掛けて道にする」を体現。
- **feasibility**: rock 非依存（危険帯は静的 spike 柱 or 天井庇で表現、11 `spike()`/`ceiling()`）。**開曲線に限定**（閉ループ走行は未検証 = 11 X01）。線がソリッド(spike)からクリップされる仕様と整合。片持ち先端のたわみは要校正（11 A04 が△）。coin は回り込む線上に配置 ○。

---

### R03 — Sag-Rope over Pit Hazards（ハザード上に張り渡す）

- **出典**: Draw Line Bridge (Google Play) "COLLECT COINS" パネル。証拠画像 **11.jpeg 上**（pit 内に mine/roller ハザード、上を弛んだロープ線が渡り、coin が弧状）。
- **geometry**:
  ```
   S▁▁ ~~~~~~~~~~~~ ▁▁G   (弛む張り渡し線)
       ▽ ● ^ ● ▽        (pit 内に複数ハザード)
              (killY)
  ```
- **role**: `sag-rope-over-hazard`（張り渡しで下の危険を跨ぐ。multi-seal と親戚）。
- **cognitive task**: 「線を張るが**弛ませ過ぎるとハザードに触れて死ぬ**／張り過ぎるとインク超過」。弛み(sag)の許容窓を、下の複数ハザードの高さで規定。11 のたわみ物理が"敵"から"設計変数"へ。
- **feasibility**: rock 非依存でも可（pit 内 spike）／rock を置けば "転がる地雷" で臨場感↑。**無支持スパン ~5.5m 上限**（11 §1.2）— pit 幅をそれ以内に、または中州で支持。線は spike からクリップ。coin は線上弧に自動配置 ◎。

---

### R04 — Static Shield Roof / Deflect Falling Rock（傾けた屋根で落石を弾く）

- **出典**: Stickman Rescue Draw 2 Save（複数ポータル: gamepix / y8 / filereadynow blog）公式攻略「落石には**真上に傾けた頑丈な屋根/盾**を描き、rock を脇へ逸らす。**三角・アーチが直線より安定**」。+ Happy Glass (level 20 以降)「線で**落ちてくるオレンジ球を cup へ入れない**ようブロック」(supercheats / writerparty 攻略)。
- **geometry**:
  ```
            ●↓
   S▁▁▁▁▁  ~/(傾けた屋根) ▁▁▁▁G   (道は地形、線は屋根のみ)
              \▽(側溝 killY: 逸らした rock の落とし先)
  ```
- **role**: `shield-static`（純盾。道は地形が提供 = 上記翻訳型 B）。
- **cognitive task**: 「**この 1 本は道ではなく蓋**」という発想転換。屋根の**傾き**で rock を車の路から側溝へ逃がす。角度を誤ると rock が車路に落ちる。全ハンプ面と最も対照的な "aha"。
- **feasibility**: **rock 依存(有)**。rock spec = 屋根上方 spawn、半径 ~0.4m、初速 0（落下）。線は非走行 → **coin 配置は地形の走行路側に置く微修正が要**（§5.3）。落石が屋根を割らない強度（傾斜屋根は衝撃を法線方向に逃がす）を録画校正。純盾なので rock が遅れて出荷される場合は本面を後回し可。

---

### R05 — Vertical Wall / Bump: Block Rolling Rock（転石を壁で堰き止める）

- **出典**: Stickman Rescue Draw 2 Save 公式攻略「**矢には車の前に垂直の壁**、多段なら重ね描き」（横から来る運動体を壁で止める）。+ Draw Bridge (Eureka/Bravestars) 説明「**cannon/saw/moving block/spike を橋で覆う**」(CrazyGames "Draw Bridge")。
- **geometry**:
  ```
                    ●→(斜面から転がってくる)
   S▁▁▁▁▁ ~|(垂直壁/バンプ) ╲▁▁▁
              [車はここ]      ▁G
  ```
- **role**: `shield-dynamic-block`（横運動体を堰き止める壁/バンプ）。
- **cognitive task**: 「落ちてくるでなく**転がってくる**を止める」。壁の**位置と高さ** — 低いと rock が乗り越え、遠いと車が先に接触。運動量を読む。
- **feasibility**: **rock 依存(有)**。rock spec = 斜面上方 spawn、初速 → (+x 方向 or 重力で加速)、半径 ~0.4m。壁は rock の運動量を受け止める強度が要（垂直壁は曲げ荷重大 → 短く/三角補強）。車は壁の手前で停止 or 壁が rock を止めた後に前進する timing 設計。coin は地形路側 ○（§5.3）。

---

### R06 — Ramp Deflector: Catch & Redirect Rolling Rock（転石をランプで逸らす）

- **出典**: Draw Physics Line (com.tinygame.drawphysicsline) / Draw Line Physics Puzzles (com.ybs.drawLinesPuzzle) 「線=**ランプ/レバー**で球を目的方向へ propel、壁で bounce」。Brain Dots (jp.co.translimit.braindots) 「線で球を転がし別の球へ当てる」= 運動体の redirect。
- **geometry**:
  ```
        ●→
   S▁▁▁ ~╲(逸らしランプ)        ▁▁G
           ▽(側溝 killY: rock 落下) 
        [車は側溝の手前で止まらず、rock 排除後に通る or ランプ背を通る]
  ```
- **role**: `catch-redirect`。
- **cognitive task**: 「敵を**止める**でなく**利用して逃がす**」。ランプの角度で rock を側溝へ。防御→誘導への一段抽象化（R05 の上位）。
- **feasibility**: **rock 依存(有)**。rock spec = spawn 上流、初速 →。ランプが rock を側溝へ落とす角度、かつ車が安全に通れる形。**ランプ背を車が走る設計にすれば dual（catch+road）でネイティブ ◎**、純 deflector なら coin 微修正。Draw Physics Line 攻略の「複数の短い線でなく…」は 1 本縛りにより 1 本ランプへ集約。

---

### R07 — Cover the Hazard (Saw/Cannon/Spike) with Drivable Bridge（走れる橋でハザードを覆う）

- **出典**: Draw Bridge (Eureka) 公式説明「**cannon, saw, moving block, spike など**を橋で覆う」(CrazyGames Draw Bridge / Google Play)。Draw 2 Bridge (com.draw.bridge.puzzle.drawgame) 「spinning saw / road bump を**飛んでいる橋**で覆う」(softonic)。
- **geometry**:
  ```
   S▁▁ ~~~~~~~~~~ ▁▁G     (橋がハザードの上を覆い、車が渡る)
        ^^^^ (spike床) or ●(saw相当=回る円 rock)
  ```
- **role**: `shield-static`(covering) **+ road** = 実質 dome-dual の平地版。
- **cognitive task**: 「ハザード列の**真上に連続した床**を架け、下の危険に一切触れず全て跨ぐ」。高架の高さと連続性。
- **feasibility**: rock は "saw" を回転円 rock で近似可（半径小・自転）だが**非依存でも spike 床で成立**（11 G02 と同型）。橋がハザードに触れないクリアランス確保。coin は橋上 ◎。**rock 非依存版を先に、rock 版を後で** の二段出荷が可能。

---

### R08 — Multi-Seal: One Stroke Covers Multiple Holes（一本書きで複数穴を塞ぐ）

- **出典**: Draw Line Bridge (証拠 11.jpeg 上、複数ハザード上を 1 本が渡る) + Happy Glass「1 本で複数の穴/漏れを塞ぐ」設計（levelhacks / supercheats 攻略、少描画=高星）+ Draw 2 Bridge「gaps を 1 本の橋で」。
- **geometry**:
  ```
   S▁ ▽ ▁ ▽ ▁ ▽ ▁G      (小穴が連続)
      ~~~~~~~~~~~~~       (1 本で全穴を跨ぐ連続床、中州で支持)
  ```
- **role**: `multi-seal`。
- **cognitive task**: 「穴を**1 個ずつ**塞ぐ発想を捨て、**1 本で全部**繋ぐ経路最適化」。中州(pillar)を支持に使い無支持長を抑える計画性。マンデート「一本書きで複数の穴」を直球で。
- **feasibility**: **rock 非依存 ◎**（純地形）。無支持 ~5.5m 上限を中州で分割（11 A05/B04 の "多支点ロング"）。**最もネイティブかつ rock 不要** → rock が間に合わなくても確実に出荷できる主力。coin は連続床上 ◎。

---

### R09 — Cantilever Support / Prop（片持ちで支えて届かせる）

- **出典**: Happy Glass「level 10 以降、線で**cup を支える**（支柱/片持ち）」(writerparty / supercheats)。Draw Bridge の cantilever reach（11 A04）。
- **geometry**:
  ```
   S▁▁════════          (片リムのみアンカー、対岸遠い)
              ⌐~~~~~▁G   (張り出しの先で低所/対岸へ引っ掛け着地)
        ▽▽▽▽(killY)
  ```
- **role**: `hook-cantilever`。
- **cognitive task**: 「両岸に架けられない → **片側支持で張り出す**」。先端のたわみと着地点を読む。R02(wrap) と別サブ役割（こちらは支持力の話）。
- **feasibility**: rock 非依存。**先端無支持のたわみ制御が要校正**（11 A04 = △）。長さと勾配をゴースト録画で。coin は片持ち上 ○。

---

### R10 — Launch Ramp / Jump（跳躍台で障害を飛ぶ）

- **出典**: Draw Climber (crazygames) / Draw the Hill「終端に**launch ramp**、速度で飛距離」。Draw Physics Line「**ランプで propel**」。Draw Bridge の谷勢い（11 D02 momentum bowl）。
- **geometry**:
  ```
   S▁ ~╱(ランプ)          ·   ·
              ^^^^ or ●   ▁▁G   (spike/rock を飛び越え着地)
              ▽(killY)
  ```
- **role**: `ramp-jump`（road の跳躍変種）。
- **cognitive task**: 「橋で**渡る**でなく**飛び越える**」。ランプ角と助走で放物線を作り、着地台に載せる。速度=`motorSpeedBase 24`(×wheelRadius=7.2m/s) を前提に飛距離設計。
- **feasibility**: rock 非依存でも可（spike を飛ぶ）／rock を跳び越えれば臨場感。着地の転倒（`tipOverAngleRad`）に注意 → ランプ角と着地台の緩衝。**ジャンプは既存物理で成立**（11 に無い新演出 = juice 増）。coin は放物線上に弧配置 ◎。

---

### R11 — Timed Shield: Observe-then-Draw（観察してから引く時限盾）

- **出典**: Stickman Rescue Draw 2 Save 攻略「**引く前に来る障害を観察**。待って状況を見てから動くのが良い時もある」(filereadynow blog)。Happy Glass「描き始めた瞬間に水/球が動き出す」= timing 依存。
- **geometry**:
  ```
        ●→→(転石が既に接近中)
   S▁▁▁ ~|(間に合う位置に壁)  ▁▁G
  ```
- **role**: `shield-dynamic-block`（時限）。
- **cognitive task**: 「**線を確定した瞬間に rock が走り出す**。どこに描けば間に合うか」を、rock の初速から逆算。空間+時間の複合。
- **feasibility**: **rock 依存(有)**。rock spec = 車進行と同時 or ストローク確定時に初速付与。InkBridge は "確定→シミュ開始" なので Happy Glass 同型の timing が自然に出る。R05 の時間軸強化版。coin ○（§5.3）。

---

### R12 — Funnel / Basin Catch（漏斗で受けて溜める・通す）

- **出典**: Happy Glass「level 20 以降、**落ちる球を線でブロックして cup 外へ**」/ Draw Physics Line「球を**同色 cup へ受ける**」。Brain Dots「球を寄せる」。
- **geometry**:
  ```
        ●↓
   S▁▁ ~\_ _/~ ▁▁G   (浅い漏斗/皿で rock を中央保持 or 脇へ)
         (車は皿の縁 or 上を通る)
  ```
- **role**: `catch-redirect`（受け皿型）。
- **cognitive task**: 「落下体を**受けて安全な場所に留める/流す**」。皿の深さと開き角。R06(ランプ逸らし) と別型（留置 vs 排出）。
- **feasibility**: **rock 依存(有)**。11 §2 は "容器/漏斗/受け網はそのままは移らない"（球捕獲動詞が無い）としたが、**rock 導入で初めて成立**。閉ループでなく開いた皿(⌣)なら走行成立。coin は皿縁 ○。要校正(△)。

---

### R13 — Momentum Descent past Rolling Rock（勢い降下で転石を先行回避）

- **出典**: Brain Dots / Draw Physics Line「重力で線を落として球を押す」+ Draw Bridge 降下(11 D01)。転石と競走する降下ライン。
- **geometry**:
  ```
   S▁↑        ●→(併走する転石)
        ~╲▽╱~~ (S 字降下→再上昇で rock を出し抜く)
                ▁G
  ```
- **role**: `catch-redirect`/`road` 複合（rock を出し抜く経路）。
- **cognitive task**: 「転石と**同じ空間を時間差で使う**」。降下速度を稼いで rock より先に隘路を抜ける。timing+速度。
- **feasibility**: **rock 依存(有)**。rock spec = 併走レーン spawn、初速 →。決定論(hash 固定)で rock 挙動を再現可能に（learnings T3: ハンドチューニング禁止、spike sweep で校正）。coin は降下線上 ◎。

---

### R14 — Shield + Road Composite（盾＋道の複合・中級）

- **出典**: Draw Bridge (Eureka) L69-74 の簡易版（証拠 12.jpeg）+ Draw 2 Bridge「gap を渡りつつ saw を覆う」。R01 と R08 の複合。
- **geometry**:
  ```
        ●↓
   S▁ ▽ ~~⌢~~ ▽ ▁G   (穴を塞ぐ道 + 中央で落石を弾くアーチ)
  ```
- **role**: `dome-dual-role`(lite) = shield-static + multi-seal。
- **cognitive task**: 「**穴も塞ぎ、落石も弾き、車も通す**」を 1 本で。2 役割の兼任（複合の入口）。
- **feasibility**: rock 依存(有)。L10（中間クライマックス）向け。アーチ強度 + 支持 + クリアランスの三立をゴースト校正。coin ◎。

---

### R15 — Gauntlet: Roll-Block → Cover → Climb（連続ハザードの複合・ボス素材）

- **出典**: Draw Bridge (Eureka) 後半 + Stickman Rescue の多段ハザード（rock→arrow→pit を連続）。11 H06 Gauntlet の役割多様版。
- **geometry**:
  ```
        ●→        ●↓
   S▁ ~|~ ^^^ ~⌢~ ╱▔ ▁G↑   (壁で転石堰き止め→spike床covering→落石弾き→登坂)
  ```
- **role**: 複合（`shield-dynamic-block` + `shield-static` + `road`）。
- **cognitive task**: 「既習の 3 役割を**一筆の連続蛇行**に凝縮」。~16m の複合ストローク（11 の上限）。
- **feasibility**: rock 依存(有・2 個)。ボス(L15)素材。決定論で 2 rock を再現固定。coin は蛇行線上 ◎。要慎重校正。

---

### R16 — Wrap-Guard around Hazard Column（危険柱を回り込む護り道）

- **出典**: Draw Bridge (Bravestars) L210（証拠 10.png）の派生 + Draw Save! 「線が 3D 化して障害から守る」(App Store id1611699306)。
- **geometry**:
  ```
        ▔∏▔ (上から伸びる spike 柱 = 危険帯)
   S▁ ~~(  )~~ ▁G   (柱の両脇を回り込む護り道)
        ▽    ▽
  ```
- **role**: `hook-cantilever`（回り込み護り）。
- **cognitive task**: 「危険帯を**避けつつ**その両脇を繋ぐ護り道」。R02 の対称版（両脇 wrap）。
- **feasibility**: rock 非依存（静的 spike 柱）。開曲線・非閉ループ厳守。線は spike からクリップ。coin は迂回線上 ○。

---

**集計:** 16 レシピ / 出典 = Draw Bridge(Eureka), Draw Bridge(Bravestars), Draw Line Bridge, Draw 2 Bridge, Stickman Rescue Draw 2 Save, Happy Glass, Draw Physics Line, Draw Line Physics Puzzles, Brain Dots, Draw Climber/Draw the Hill の **10 タイトル**。role 分布 = dome-dual ×3(R01/R14/R15) / shield-static ×2(R04/R07) / shield-dynamic-block ×2(R05/R11) / catch-redirect ×3(R06/R12/R13) / hook-cantilever ×3(R02/R09/R16) / multi-seal ×1(R08) / sag-rope ×1(R03) / ramp-jump ×1(R10)。**road 一択だった現行を 8 役割へ拡張**。

---

## 3. 難度順序（cognitive complexity = 線に兼任させる仕事の数）

| tier | 兼任数 | 代表 role | レシピ |
|---|---|---|---|
| ★1-2 | 1（road のみ、現行 L1-L3 維持） | road | （既存 tutorial） |
| ★3 | 1（road 以外を単独で教える） | multi-seal / ramp-jump / shield-static | R08, R10, R04 |
| ★3-4 | 1（運動体 1 種） | shield-dynamic-block / catch-redirect / hook | R05, R06, R09, R02, R16 |
| ★4 | 2（road + 守り の兼任） | dome-dual(lite) / sag-rope | R01, R03, R14 |
| ★4-5 | 2（時間軸 or 受け皿） | timed-shield / funnel / 併走降下 | R11, R12, R13 |
| ★5 | 3+（複合連続） | gauntlet 複合 | R15 |

---

## 4. スロット割当 v4（L4-L15 + B1-B3）

> **原則:** L1-L3 は road tutorial として維持（既存）。L4 以降を本カタログで置換。**隣接スロットは同一 role タグを持たない**（下表 "隣接OK" 列で検証済）。**rock 依存**列 = 新エンティティ必須か（rock が遅延しても "非依存" 面だけで章骨格が成立するよう配置）。AD = anti-dominant（直線否定を落石荷重/幾何で担保、11 §3 の潤沢予算方針）。

| Slot | レシピ | role タグ | 出典（game / 位置） | 新機構（学習目標） | cognitive task 要点 | rock 依存 | AD | inkFeel | 息抜き | 隣接OK |
|---|---|---|---|---|---|---|---|---|---|---|
| L1-L3 | （維持） | road | 既存 tutorial | 描く→走る→効率星→中間支点 | 道を架ける | 無 | . / . / . | 3.0/3.0/2.5× | — | ✓ |
| **L4** | **R04** | shield-static | Stickman Rescue（落石屋根）/ Happy Glass L20+ | **線は道でなく"蓋"** | 傾け屋根で落石を側溝へ | **有** | Y(落石) | standard 2.5× | — | ✓(前=road) |
| **L5** | **R08** | multi-seal | Draw Line Bridge / Happy Glass | **一本で複数穴を塞ぐ** | 中州支持で連続被覆 | **無** | Y(幾何) | standard 2.5× | — | ✓ |
| **B1** | R08-lite | multi-seal(易) | 同上（coin 大） | 息抜き＋穴塞ぎ復習 | 短い 2 連穴 | 無 | . | generous 3.0× | **息抜き** | ✓ |
| **L6** | **R10** | ramp-jump | Draw Climber / Draw the Hill | **橋でなく跳ぶ** | ランプ角＋助走で放物線 | 無 | Y(幾何) | standard 2.5× | やや息抜き | ✓ |
| **L7** | **R05** | shield-dynamic-block | Stickman Rescue（矢=壁）/ Draw Bridge cover | **転がってくるを壁で止める** | 壁位置＋運動量読み | **有** | Y(転石) | standard 2.5× | — | ✓ |
| **L8** | **R06** | catch-redirect | Draw Physics Line / Brain Dots | **止めるでなく逸らす** | ランプで転石を側溝へ | **有** | Y(転石) | standard 2.5× | — | ✓ |
| **L9** | **R16** | hook-cantilever | Draw Bridge L210 / Draw Save! | **危険柱を回り込む護り道** | 開曲線で両脇 wrap | 無 | Y(幾何) | standard 2.5× | — | ✓ |
| **L10** | **R14** | dome-dual(lite) | Draw Bridge L69-74（簡易） | **盾＋道の兼任(入口)** | 穴塞ぎ＋落石弾き＋走行 | **有** | Y(落石) | standard 2.5× | 中間クライマックス | ✓ |
| **B2** | R03-lite | sag-rope(易) | Draw Line Bridge | 息抜き＋張り渡し | 弛み許容窓（浅） | 無 | . | generous 3.0× | **息抜き** | ✓ |
| **L11** | **R03** | sag-rope-over-hazard | Draw Line Bridge（証拠11上） | **ハザード上に張り渡す** | sag 窓を下の危険で規定 | 無(spike)/可 | Y(幾何) | standard 2.5× | — | ✓ |
| **L12** | **R02** | hook-cantilever(wrap) | Draw Bridge L210（証拠10） | **引っ掛けて危険帯を縫う** | 上げて回す S/C 取り回し | 無 | Y(幾何) | tight 2.0× | — | ✓(前=sag,後=block複合) |
| **L13** | **R11** | shield-dynamic-block(timed) | Stickman Rescue（観察）/ Happy Glass | **時限：確定した瞬間に転石発進** | 初速から逆算した壁位置 | **有** | Y(転石) | standard 2.5× | — | ✓ |
| **L14** | **R12+R08** | catch-redirect + multi-seal | Happy Glass funnel / Draw Line Bridge | **受け皿で逸らし＋複数穴塞ぎ(複合)** | 2 役割の同時解 | **有** | Y(複合) | tight 2.0× | — | ✓ |
| **L15** | **R15**(=R05+R07+R01) | dome-dual(full)複合 | Draw Bridge 後半 / Stickman 多段 | **章ボス：堰き止め→covering→落石弾き→登坂** | 3 役割を一筆蛇行 | **有(×2)** | Y(全機序) | tight 2.0× | — | ✓ |
| **B3** | R01-lite | dome-dual(易・coin祭) | Draw Bridge L69-74 | 章完走＋守る道の再確認 | 緩アーチ＋coin大量 | 有/可 | . | generous 3.0× | **息抜き** | ✓ |

### 4.1 隣接 role の検証（マンデート「隣接は同一 role 禁止」）

L4 shield-static → L5 multi-seal → L6 ramp-jump → L7 shield-dynamic-block → L8 catch-redirect → L9 hook-cantilever → L10 dome-dual → L11 sag-rope → L12 hook-wrap → L13 shield-dynamic-block(timed) → L14 catch-redirect+multi-seal(複合) → L15 dome-dual(複合)。
- 同系が再登場する最短間隔: shield-dynamic-block(L7→L13 = 6 面差)、catch-redirect(L8→L14 = 6 面差)、hook(L9→L12 = 3 面差だがサブ役割違い: 支持 vs 迂回)、dome-dual(L10→L15 = 5 面差、lite→full)。**隣接（±1）で同一 role タグは 0 件**。✓

### 4.2 rock 依存の出荷分割（並行タスク遅延ヘッジ）

- **rock 依存(有)**: L4, L7, L8, L10, L13, L14, L15, (B3)。= **8 面**。
- **rock 非依存**: L5, L6, L9, L11, L12, B1, B2。= **7 面**（+ L1-L3）。
- **フォールバック**: rock が間に合わない場合、**非依存 7 面 + L1-L3 = 10 面で章骨格を先行出荷**し、rock 依存 8 面は "rock 実装完了" をゲートに後追い有効化。**multi-seal(R08)/ramp-jump(R10)/hook(R02,R09,R16)/sag-rope(R03) は rock 無しで役割多様化を単独達成** → ユーザーの「全ハンプ」批判は rock 前でも部分解消できる。

### 4.3 saw-tooth ペーシング（11 §4.2 継承）

- 新機構直後は必ず難度を落とす: L4(落石初出)→L5(易 multi-seal)、L10(中間クライマックス)→[B2 息抜き]→L11(sag)、L15(ボス)→[B3 息抜き]。
- **1 面 1 新役割**で導入し、複合(L14/L15)は既習役割のみで構成（新役割と高難度を同時に課さない）。

---

## 5. Feasibility まとめ・エンジン制約順守（実装ゲート）

### 5.1 新 rock エンティティに求める最小 spec（並行タスクへの契約）

- **形**: 円 body（circle）。**パラメータ**: `spawnPos {x,y}` / `radius`(0.3-0.5m 想定) / `initialVelocity {vx,vy}`（0=自由落下、+x=転がり）。
- **物理**: 通常剛体。重力 `gravityY=-10` で落下、地形/線/車と通常接触。**car は rock との通常接触で死亡**（既存 fail 判定に接触死を追加 or 転倒/killY 経由）。
- **決定論**: rock 挙動は fixedDt 60Hz で再現可能に（learnings T3/T1: 決定論 hash で再現固定、spike sweep で校正、ハンドチューニング禁止）。**rock spawn/初速は level JSON に持たせ、TuningConstants には置かない**（level 固有値の原則、conventions）。
- **新エンティティ = conventions.md に先に追加**（CLAUDE.md「New entity? → Add to conventions.md first」/ learnings T2）。UL 語彙に "Rock/Hazard" を定義。

### 5.2 既存制約の順守（11 §1 + TuningConstants 実測）

- **1 ストローク/試行**（`commitStroke` が 2 本目で throw）→ 全レシピ 1 本で解ける形に設計済。
- **無支持スパン ~5.5m 上限**（`breakForceFactor=10`, `segmentLength=0.8`）→ 長い multi-seal/sag は中州(pillar)で支持。
- **落石荷重での破断**: アーチ/三角は荷重分散で耐え、平線は破断（Stickman 攻略と物理が一致）→ **AD を "インク欠乏" でなく "落石荷重" で作る**新手段（11 §3 予算潤沢方針を強化）。要ゴースト録画で衝撃 stress 実測。
- **鋭角コーナーは車を射出**（~1.4m）→ 多曲がり正解は spline 平滑化（`ch1.ts spline()`）。
- **閉ループ(enclosure)非採用**（11 X01）→ hook/wrap(R02,R16) は**開曲線**厳守。
- **線はソリッド(spike/地形)からクリップ**される既存仕様と全レシピ整合。

### 5.3 純 shield 面の coin 配置（翻訳型 B の唯一の要調整点）

- **課題**: coin は "ルート(線)上に自動配置" が既定だが、R04/R05/R11 等の**純盾面は線が非走行**（道は地形）→ coin を線上に置くと車が拾えない。
- **解**: 純盾面のみ **coin を地形の走行路に沿って配置**（authoring の coin 配置ソースを "解ストローク" から "car 軌跡サンプル" へ切替。ゴースト samples(車の実軌跡, 既に JSON にある `samples[]`) を coin ソースにすれば線非依存で正しく載る）。**dual-role 面(R01/R07/R14 等)は線=ルートなので現行のまま ◎**。

### 5.4 検証（learnings 順守）

- **各面に負の対照**（learnings §A2 T4 vacuous verification 対策）: 不正な盾/ランプで rock が車を殺す/破断することを regression で確認（"pass する検証" に必ず fail ケースを添える）。
- **Gate 3 anti-dominant** は落石面では "直線 1 本 → 落石で破断/貫通" を物理実行で全滅確認（予算引き上げ後の再検証、11 §1.3）。
- **contract テストで数値固定**（learnings T2）: rock spawn/初速/半径、star 閾値、AD 判定を機械固定。文言変更は data-model と両方向整合。

---

## ソース

- **証拠画像（グラウンドトゥルース）**: 10.png Draw Bridge(Bravestars) Level 210 / 11.jpeg Draw Line Bridge(sag-rope + SAVE THE CAR) / 12.jpeg Draw Bridge(Eureka) Levels 69-74 dome-dual / 9.jpeg 自作 atlas（全ハンプ反面教師）。
- Draw Bridge (Eureka Studio): [Google Play](https://play.google.com/store/apps/details?id=com.eurekastudio.drawbridge) / [App Store](https://apps.apple.com/us/app/draw-bridge/id1558771114) / YouTube "All Levels Gameplay (Levels 69-74)" 2022/04/23（証拠12）/ 説明「cannon, saw, moving block, spike を橋で覆う」[CrazyGames](https://www.crazygames.com/game/draw-bridge-brain-game)。
- Draw Bridge (Bravestars, 5000万DL・1本線): [Google Play](https://play.google.com/store/apps/details?id=com.bravestars.draw.bridge.drawgame) / Level 210（証拠10）。
- Draw Line Bridge (Google Play, "COLLECT COINS"/"SAVE THE CAR")（証拠11）。
- Draw 2 Bridge: Draw Save Car: [Google Play](https://play.google.com/store/apps/details?id=com.draw.bridge.puzzle.drawgame) / [softonic](https://draw-2-bridge-draw-save-car.en.softonic.com/android)（「飛んでいる橋で saw/spike/moving block/gap を覆う」）。
- Stickman Rescue Draw 2 Save（落石=傾け屋根/アーチ、矢=垂直壁、三角・アーチが安定、観察してから引く）: [GamePix](https://www.gamepix.com/play/stickman-rescue-draw-2-save) / [filereadynow blog](https://www.filereadynow.com/blog/draw-your-way-to-heroism-in-stickman-rescue) / [Y8](https://www.y8.com/games/stickman_rescue_-_draw_2_save)。
- Happy Glass（L10+ cup を線で支える、L20+ 落ちる球を線でブロック、少描画=高星）: [supercheats walkthrough](https://www.supercheats.com/happy-glass-cheats-tips-strategy/walkthrough/) / [writerparty guide](https://writerparty.com/party/happy-glass-top-tips-walkthrough-cheats-and-strategy-guide/) / [levelhacks 300面](https://www.levelhacks.com/happy-glass-solutions)。
- Draw Physics Line（線=ランプ/レバーで球を propel、壁で bounce、cup へ受ける）: [Google Play](https://play.google.com/store/apps/details?id=com.tinygame.drawphysicsline) / [Steam](https://store.steampowered.com/app/2101740/Draw_Physics_Line/)。
- Draw Line - Physics Puzzles（球を転がして寄せる、方向転換・跳ね返り）: [Google Play](https://play.google.com/store/apps/details?id=com.ybs.drawLinesPuzzle)。
- Brain Dots (TransLimit, 球を転がして別球へ当てる・redirect): [Google Play](https://play.google.com/store/apps/details?id=jp.co.translimit.braindots)。
- Draw Save!（線が3D化して障害から守る = shield/wrap）: [App Store](https://apps.apple.com/us/app/draw-save-puzzle-game/id1611699306)。
- Draw Climber（終端 launch ramp、速度で飛距離）: [CrazyGames](https://www.crazygames.com/game/draw-climber) / Draw the Hill（車用ランプ）。
- 内部根拠: `research/11_spatial_patterns.md`（§1.2 除外判断・§3 予算方針）, `src/tuning/TuningConstants.ts`（breakForceFactor=10, segmentLength=0.8, motorSpeedBase=24, gravityY=-10, tipOverAngleRad=2.1）, `levels/ch1-l07.json`（level JSON 構造: terrain/vehicleSpawn/goalFlag/killY/coins/ghostSolutions.samples）, `CLAUDE.md`（New entity→conventions.md, 1 stroke, killY, Engine Phaser-free）, `.evals/feedback/learnings.md`（T1 vendor quirk・T2 contract固定・T3 校正・T4 負の対照）。

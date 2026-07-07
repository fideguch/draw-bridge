# 非機能要件 — InkBridge（仮）MVP

> [📋 目次](./README.md) | [設定](./workflow_config.md) | [ゲームデザイン](./game_design.md) | [機能要件](./functional_requirements.md) | **非機能要件** | [US](./user_stories.md) | [UL](./ubiquitous_language.md) | [UI](./ui_design_brief.md) | [UX](./ux_protocol.md)

非機能要件とは、**「システムがどの程度の品質で動くべきか」**を定義したものです。本書の全数値は [research/07_decision.md](../research/07_decision.md) の決定（§4 脳汁設計、§7 技術スタック、§8.1 フェーズ1品質バー、§9 リスク対策）を単一の正として写したものです。最終チューニング値は実機で確定しますが、**本書の目標値は合否判定の契約**であり、変更する場合は research への追記とセットで行います。

---

## 要件サマリー

| カテゴリ | ID: タイトル | 優先度 | 主要指標 | 目標値 |
| --- | --- | --- | --- | --- |
| パフォーマンス | [NFR-001](#nfr-001): フレームレート・物理予算 | Must | fps / 物理 step p95 | 60fps / ≤4ms |
| パフォーマンス | [NFR-002](#nfr-002): 入力応答性 | Must | タッチ→視覚反映 | ≤100ms（線先端は同フレーム） |
| パフォーマンス | [NFR-006](#nfr-006): 起動・ロード | Should | コールドスタート / Web初回 / レベル遷移 | ≤3秒 / ≤5秒 / ≤1秒 |
| パフォーマンス | [NFR-013](#nfr-013): サイズ・メモリ | Should | バンドル / アプリ / メモリ | ≤5MB(gzip) / ≤50MB / ≤300MB |
| ユーザビリティ | [NFR-003](#nfr-003): テンポ契約 | Must | L1クリア / リトライ / ループ1周 | ≤25秒 / ≤1秒 / ≤40秒 |
| ユーザビリティ | [NFR-008](#nfr-008): フィードバック統一・テンポ保護 | Must | 演出スキップ可能率 / hit-stop 回数 | 100% / ≤2回・1レベル |
| ユーザビリティ | [NFR-014](#nfr-014): サウンド品質 | Must | Web Audio 遅延 / 同時発音 | ≤50ms / 同種SE最大3重 |
| 信頼性 | [NFR-004](#nfr-004): 決定論契約 | Must | CI内ハッシュ一致率 / 実機許容帯 | 100% / ε0.05m・tick±30 |
| 互換性 | [NFR-005](#nfr-005): プラットフォーム互換性 | Must | 対応OS・ブラウザ・入力 | iOS 16+ / Android 10+ / Chrome・Safari 最新2版 |
| データ | [NFR-007](#nfr-007): 進行データ保全 | Must | 再起動後復元率 / 破損時クラッシュ | 100% / 0件 |
| アクセシビリティ | [NFR-009](#nfr-009): 知覚・操作アクセシビリティ | Must | タッチターゲット / 二重符号化 | ≥44pt / 非色チャネル≥2 |
| 保守性 | [NFR-010](#nfr-010): アーキテクチャ規約 | Must | Engine の Phaser 依存 / マジックナンバー | 0件 / 0件 |
| テスト | [NFR-011](#nfr-011): 品質ゲート | Must | Engine カバレッジ / Gate 通過率 | ≥80% / 100% |
| コンプライアンス | [NFR-012](#nfr-012): プライバシー・レーティング | Must | 外部通信 / 同梱SDK | 0件 / 0個 |

---

## カテゴリ別要件

### パフォーマンス

<a id="nfr-001"></a>

#### NFR-001: フレームレート・物理予算 — Must

> **関連FR:** [FR-003](./functional_requirements.md#fr-003), [FR-005](./functional_requirements.md#fr-005), [FR-006](./functional_requirements.md#fr-006), [FR-011](./functional_requirements.md#fr-011), [FR-012](./functional_requirements.md#fr-012), [FR-025](./functional_requirements.md#fr-025)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §7.2 物理実装パターン・§7.3 着手週スパイク・§9 リスク#1 / [KPI-001](./README.md#kpi-001)

- **説明 / Description**: 中級 Android 実機の Capacitor WebView 上で、描画・走行・破断・ゴール演出（confetti 最大時）を含む全場面で 60fps を維持し、物理 step 時間を予算内に収める。爽快感3場面の根幹となる品質条項。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| フレームレート | 60fps 維持 | 中級 Android 実機（Snapdragon 6xx / Helio G 系）の Capacitor WebView。confetti 最大時（キャノン左右各40〜60個 + レイン60〜100個）を含む |
| 物理 step 時間 | p95 ≤ 4ms | 同上端末。描線 32 セグメント + 車（chassis + wheel×2）+ 地形 chain の最大構成 |
| 描線セグメント数 | 上限 32（開始値 10〜16） | [FR-003](./functional_requirements.md#fr-003) のボディ数上限管理 |
| 物理更新周波数 | 60Hz 固定 | 120Hz 端末はレンダリングのみ高リフレッシュレート、物理は 60Hz 固定 |

- **測定方法 / Measurement**:
  1. **デバッグオーバーレイ実測**（[FR-025](./functional_requirements.md#fr-025)）: fps・物理 step 時間・ボディ数を実行中表示し、対象実機で全15面 + ボーナス面を通しプレイしてログをファイル出力・p95 を算出する。
  2. **着手週スパイクベンチ**（[research/07_decision.md](../research/07_decision.md) §7.3-1）: 同一シーン（崖8m + 固定描線 + 車）で物理方式 A/B/C/D × N=8/16/24/32 の16通りを切替比較し、対象実機 WebView で p95 step を計測する。合格基準は「p95 ≤ 4ms かつ 60fps、C または D で荷重たわみが視認でき破断が誇張なく決まる」。不合格時のみ方式 A + 描画層のみの演出たわみへ後退する。
  3. **CI 回帰ベンチ**: ヘッドレスエンジンで同梱全レベルのゴースト解をリプレイし、`performance.now()` で全 tick の step 時間を記録して p95 を算出する Node スクリプトを GitHub Actions で PR 毎に実行。前回 main の計測値との差分を PR コメントに出力する（合否判定は実機値で行い、CI 値は回帰検出専用）。
- **優先度**: Must

---

<a id="nfr-002"></a>

#### NFR-002: 入力応答性 — Must

> **関連FR:** [FR-001](./functional_requirements.md#fr-001), [FR-010](./functional_requirements.md#fr-010), [FR-014](./functional_requirements.md#fr-014)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §4.1 入力遅延ゼロ描画（Swink 即時応答原則） / [KPI-002](./README.md#kpi-002)

- **説明 / Description**: タッチ入力への視覚・触覚の応答を数値契約化する。描画中の線の先端は平滑化せず生タッチ座標を同フレームで反映する（平滑化は過去点のみに適用）。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| タッチ→視覚反映 | ≤100ms（60fps 換算で 6 フレーム以内） | 全操作（ボタンタップ・描画開始） |
| 線先端の反映 | 同フレーム（≤16.7ms）・生タッチ座標一致 | 描画中の毎フレーム |
| タッチ→ハプティクス | ≤100ms | 線確定・発進・着地・破断・星の各イベント |

- **測定方法 / Measurement**:
  1. **Engine/Render 統合テスト（Vitest）**: pointer 座標列を入力し、直後のレンダフレームで Stroke 先端頂点が生タッチ座標と一致することを assert する（平滑化が過去点のみに適用されることの検証）。
  2. **Playwright E2E**: `page.mouse` のドラッグ入力→Canvas 更新までを `requestAnimationFrame` タイムスタンプで計測し、入力イベント発火から視覚反映まで ≤6 フレーム（100ms）、線先端は 1 フレーム以内であることを assert する。
  3. **HapticsInterface spy 計測**: イベント発火の `performance.now()` と HapticsInterface 呼び出しのタイムスタンプ差 ≤100ms を統合テストで assert する。実機の体感遅延は [FR-025](./functional_requirements.md#fr-025) のチューニングパネルを併用した実機セッションで確認する。
- **優先度**: Must

---

<a id="nfr-006"></a>

#### NFR-006: 起動・ロード — Should

> **関連FR:** [FR-015](./functional_requirements.md#fr-015), [FR-023](./functional_requirements.md#fr-023)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §3.5 1セッションの設計（短セッション前提）・§2.2 Web 配信併用

- **説明 / Description**: 通勤・休憩の短セッションで遊ぶプレイヤーが起動待ちで離脱しないよう、起動・ロード時間を契約化する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| アプリコールドスタート | ≤3秒（起動→ホーム画面の入力受付） | iOS / Android 実機（Capacitor ビルド）、5回計測の中央値 |
| Web 初回ロード | ≤5秒（Interactive 到達） | Lighthouse モバイル既定スロットリング（Slow 4G: 下り1.6Mbps / RTT 150ms） |
| レベル遷移 | ≤1秒 | Next タップ→次レベルの描画入力受付 |

- **測定方法 / Measurement**:
  1. **Android**: `adb shell am start -W <package>/<activity>` の TotalTime とアプリ内 `performance.mark('app-ready')`（ホーム入力受付時点）を 5 回計測し、中央値 ≤3,000ms を確認する。
  2. **iOS**: アプリ内 `performance.mark` ログ（プロセス起動→ホーム入力受付）を実機で 5 回計測し、中央値 ≤3,000ms を確認する。
  3. **Web**: `vite build` 成果物を静的サーバで配信し、Lighthouse CI（モバイル設定・既定スロットリング）で Interactive ≤5s を計測、CI に閾値として設定する。
  4. **レベル遷移**: Playwright E2E で Next クリック→次レベルの描画開始イベントが成立するまで ≤1,000ms を `performance.now()` で計測する。
- **優先度**: Should

---

<a id="nfr-013"></a>

#### NFR-013: サイズ・メモリ — Should

> **関連FR:** [FR-023](./functional_requirements.md#fr-023)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §2.2 Web 配信併用（Poki / CrazyGames 提出前提）・§7.1 スタック採択（Web 版 = 配布資産）

- **説明 / Description**: Web 版がそのまま Poki / CrazyGames の配布資産になる前提のため、バンドルサイズと実行時メモリを契約化する。アセットはプログラム描画を優先し、テクスチャは必要最小限に絞る。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| Web バンドル | ≤5MB（gzip） | `vite build` 成果物の合計 |
| モバイルアプリ | ≤50MB | Android AAB / iOS IPA のファイルサイズ |
| 実行時メモリ | ≤300MB | 全15面 + ボーナス面の連続プレイ中ピーク |

- **測定方法 / Measurement**:
  1. **CI サイズゲート**: `vite build` 後に全成果物を gzip 圧縮した合計サイズを算出し、5MB 超過で fail する Node スクリプトを GitHub Actions に組み込む。
  2. **ビルドサイズ計測**: リリース候補ビルドの AAB / IPA サイズを計測してビルドログに記録し、≤50MB を確認する。
  3. **メモリプロファイル**: Android は `chrome://inspect` で実機 WebView に接続した Chrome DevTools Performance Monitor、iOS は Safari Web Inspector の Timelines で、JS ヒープ + GPU メモリを連続プレイ中に記録しピーク ≤300MB を確認する。
- **優先度**: Should

---

### ユーザビリティ

<a id="nfr-003"></a>

#### NFR-003: テンポ契約 — Must

> **関連FR:** [FR-004](./functional_requirements.md#fr-004), [FR-008](./functional_requirements.md#fr-008), [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013), [FR-017](./functional_requirements.md#fr-017)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §3.5 1セッションの設計・§8.1 フェーズ1品質バー / [KPI-003](./README.md#kpi-003)

- **説明 / Description**: 「1面10〜30秒・失敗しても1秒でやり直せる」テンポをコアループの契約として自動テスト化する。演出追加・レベル改修でテンポが劣化した場合に CI で検出する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| L1 クリア所要 | ≤25秒 | L1 ゴースト解のリプレイ（描画開始→クリア判定） |
| 最初の3面の3連続成功 | 合計 60〜90秒 | L1・L2・L3 のゴースト解リプレイ + 遷移時間の合算 |
| 失敗→リトライ→操作可能 | ≤1秒 | 描画フェーズ・走行フェーズのどちらからでも |
| ループ1周（クリア演出込み） | ≤40秒 | 描画開始→リザルト→Next タップ可能まで |
| 初回起動からフル快感1周（描く→走る→ゴール5拍演出）体験まで | ≤45秒 | 初回起動→L1 で「描く→走る→ゴール5拍演出」を1回体験完了するまで（[FR-017](./functional_requirements.md#fr-017) 主フロー3） |
| Next ボタン活性化 | 演出完了後 1.5〜2.5秒（タップスキップ時は即時） | クリアリザルト |

- **測定方法 / Measurement**:
  1. **テンポ契約自動テスト（CI・ヘッドレスエンジン）**: L1 のゴースト解を再生してクリア到達 tick ≤ 25×60 を assert、L1・L2・L3 の合計 tick + 画面遷移の既定尺が 60〜90 秒帯に収まることを assert する Node スクリプトを GitHub Actions で PR 毎に実行する。
  2. **Playwright E2E（リトライ計測）**: 走行フェーズ中にリスタートボタンをクリックし、初期状態の Canvas 再描画 + 描画入力の受付再開まで ≤1,000ms を `performance.now()` で計測する。
  3. **UI 遷移計測（統合テスト・Vitest fake timers）**: ゴールイベント→5拍演出の既定尺→Next 活性化までのタイマー合計が 1.5〜2.5s に収まること、リザルト中の任意タップで即スキップされることを `vi.useFakeTimers` で検証する。ループ1周はゴースト解リプレイ時間 + 演出尺 + 遷移時間の合算 ≤40s を assert する。
  4. **初回体験 45 秒計測（FTUE 連動）**: 初回起動→L1 のゴースト解リプレイ→ゴール5拍演出既定尺の合算が ≤45 秒に収まることを assert する（[FR-017](./functional_requirements.md#fr-017) 主フロー3「初回起動から 45 秒以内にフル快感 1 周」の合否判定）。
- **優先度**: Must

---

<a id="nfr-008"></a>

#### NFR-008: フィードバック統一・テンポ保護 — Must

> **関連FR:** [FR-012](./functional_requirements.md#fr-012), [FR-013](./functional_requirements.md#fr-013), [FR-014](./functional_requirements.md#fr-014)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §4.3 横断必須（hit-stop 制限）・§9 リスク#10（juice 過剰でテンポ死）・信頼設計 P4

- **説明 / Description**: 操作フィードバック（音・触覚・視覚）の形式をイベント種別毎に一元定義して統一し（P4 Consistency）、演出がテンポを侵食しないよう「全演出スキップ可」「hit-stop 回数制限」「失敗時演出最軽量」を契約化する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| イベント→フィードバック一致 | マッピング表（[FR-014](./functional_requirements.md#fr-014)）とコード実装の一致率 100% | 音・触覚・視覚の3チャネル |
| 演出スキップ | 全リザルト演出のタップスキップ可能率 100% | クリア5拍演出の全段階 |
| hit-stop 回数 | 1レベルあたり ≤2回 | ゴール・大クラッシュ限定 |
| 失敗時演出 | 暗転 + 短い残念音のみ（confetti・スローモーション・カウントアップの発火 0件） | 失敗リザルト |

- **測定方法 / Measurement**:
  1. **マッピング照合テスト**: TuningConstants に定義したイベント→フィードバックのマッピング表を単一ソースとし、各イベント発火時に定義どおりのハプティクス種別・SFX ID・視覚エフェクト ID が呼ばれることを spy で assert する統合テスト（Vitest）。
  2. **hit-stop 回数テスト**: 破断を含むレベルのゴースト解をヘッドレスエンジンでリプレイし、Engine イベントログ中の hit-stop 発火数 ≤2 を assert する。
  3. **Playwright E2E（スキップ検証）**: クリアリザルト表示の 0.2 秒後にタップし、カウントアップ完了値の即時表示 + Next 即活性を検証する。
  4. **失敗パス静的検査**: 失敗リザルトのコードパスからゴール演出モジュール（confetti・スロー・カウントアップ）への参照が 0 件であることを dependency-cruiser の forbidden ルールで CI 検証する。
- **優先度**: Must

---

<a id="nfr-014"></a>

#### NFR-014: サウンド品質 — Must

> **関連FR:** [FR-009](./functional_requirements.md#fr-009), [FR-010](./functional_requirements.md#fr-010), [FR-011](./functional_requirements.md#fr-011), [FR-012](./functional_requirements.md#fr-012)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §4.1 描画中ループ音・§4.2 エンジン音/コイン取得音・§4.3 BGM ダッキング・§7.1 サウンド（Phaser Sound / Web Audio）

- **説明 / Description**: SFX がタッチ・イベントと同期して鳴ることが juice 成立の前提のため、Web Audio の遅延・同時発音・ダッキング・ピッチランダム化を契約化する。ブラウザの自動再生制限に対する AudioContext resume 処理を必須とする。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| Web Audio 再生遅延 | ≤50ms | タッチ起因 SE。全 SE は起動時に事前ロード・デコード済み |
| 同時発音数 | 同種 SE 最大3重 | 4発目の再生要求は再生数を増やさない |
| BGM ダッキング | ゴール瞬間に -6〜-9dB へ 0.2s で遷移 | SFX を立てるため |
| SE ピッチランダム化 | 基準ピッチ ±5% | ストローク毎の描画音基準ピッチを含む |
| AudioContext | 初回タッチで resume、state = `running` | 全ブラウザ・WebView |

- **測定方法 / Measurement**:
  1. **遅延計測ハーネス**: タッチイベントの `performance.now()` と `AudioContext.currentTime` ベースの再生開始時刻の差分を記録するデバッグ計測モードを実装し、実機で 20 回計測して p95 ≤50ms を確認する。全 SE が起動時に `decodeAudioData` 済み（AudioBuffer 保持）であることをユニットテストで assert する。
  2. **SoundManager ユニットテスト（Vitest）**: 同種 SE を 4 回連続で再生要求し、アクティブ再生数が 3 を超えないことを assert する。ピッチランダム化は 100 回サンプリングして全値が ±5% 範囲内であることを assert する。
  3. **ダッキング検証（OfflineAudioContext）**: ゴールイベントを含む 2 秒間をオフラインレンダリングし、BGM ゲインカーブが 0.2s で -6〜-9dB へ遷移することを数値 assert する。
  4. **Playwright E2E**: 初回タップ後に `page.evaluate` で AudioContext の state が `running` であることを assert する。
- **優先度**: Must

---

### 信頼性

<a id="nfr-004"></a>

#### NFR-004: 決定論契約 — Must

> **関連FR:** [FR-005](./functional_requirements.md#fr-005), [FR-015](./functional_requirements.md#fr-015), [FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §7.2 決定論の扱い・§9 リスク#7

- **説明 / Description**: JS ポート物理はブラウザ間ビット一致を保証しないため、決定論契約を2層に分けて定義する。①CI（固定 Node = 固定 V8）内では終了状態ハッシュのビット一致、②実機・エンジン更新時は許容帯検証。リプレイ / ゴースト解は入力再生ではなく**位置サンプル再生**で実装する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| CI 内リプレイ一致 | 終了状態ハッシュ一致率 100%（1,000回実行） | 固定 Node バージョン、同一レベル + 同一描線 |
| 実機・エンジン更新時の許容帯 | 成功/失敗の一致率 100%、最終車両位置差 ≤ε=0.05m、終了 tick 差 ≤±30 | 初期値。感度分析で校正する |
| ゴースト/リプレイ実装方式 | 位置サンプル再生（入力再生の採用 0件） | 全リプレイ機能 |

- **測定方法 / Measurement**:
  1. **run-to-run 決定論スクリプト**（[research/07_decision.md](../research/07_decision.md) §7.3-3）: ヘッドレスエンジンで同一レベル + 同一描線を 1,000 回実行し、終了状態（最終車両位置・終了 tick・成功/失敗・破断ジョイント集合）をシリアライズして SHA-256 ハッシュ比較する Node スクリプト。GitHub Actions（`.nvmrc` で Node バージョン固定）で実行する。
  2. **Gate 2 リプレイ検証**（[FR-026](./functional_requirements.md#fr-026)）: 全レベルのゴースト解をヘッドレスエンジンでリプレイし、許容帯（成功一致 + 位置 ε0.05m + tick±30）内であることを PR 毎に検証する。
  3. **エンジン/ライブラリ更新時の差分検証**: 更新前後で全レベルのゴースト解リプレイ結果を許容帯比較し、逸脱したレベルを一覧出力するスクリプトを実行してから更新をマージする。
- **優先度**: Must

---

### 互換性

<a id="nfr-005"></a>

#### NFR-005: プラットフォーム互換性 — Must

> **関連FR:** [FR-001](./functional_requirements.md#fr-001), [FR-023](./functional_requirements.md#fr-023)
> **根拠:** [research/07_decision.md](../research/07_decision.md) 前提3（iOS/Android 両対応・環境非依存設計）・§7.1 スタック確定

- **説明 / Description**: iOS / Android のネイティブシェル（Capacitor WebView）と Web ブラウザの両方で、縦持ち・セーフエリア対応・マウス/タッチ両入力で動作する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| モバイル OS | iOS 16+ / Android 10+（API 29+） | Capacitor WebView（Chromium ベース） |
| ブラウザ | Chrome・Safari の最新2バージョン | デスクトップ + モバイル |
| 画面向き | 縦持ち固定 | 全プラットフォーム |
| セーフエリア | ノッチ・ホームインジケータ領域と UI 要素の重なり 0件 | ノッチ付き端末 |
| 入力方式 | マウス / タッチの両対応 | 描画・全ボタン操作 |

- **測定方法 / Measurement**:
  1. **Playwright E2E マトリクス**: Chromium + WebKit × モバイルビューポート2種（375×667・414×896）+ デスクトップビューポートで、L1 実描画クリアのスモークテストを実行する。マウス操作と `hasTouch: true` コンテキストのタッチ操作の両方を含める。
  2. **実機スモーク**: 最低ライン端末（iOS 16 / Android 10・API 29）の Capacitor ビルドで「起動→L1 クリア→再起動復元」を手動実行し、チェックリストに記録する。
  3. **セーフエリア検証**: ノッチ付きビューポートの Playwright スクリーンショットで、HUD（インクバー・リスタートボタン・コイン残高）が `env(safe-area-inset-*)` の内側に収まることを画像比較で確認する。
  4. **縦固定検証**: Capacitor 設定（orientation: portrait）のビルド設定を CI で検証し、実機の回転操作でレイアウトが回転しないことを手動確認する。
- **優先度**: Must

---

### データ

<a id="nfr-007"></a>

#### NFR-007: 進行データ保全 — Must

> **関連FR:** [FR-018](./functional_requirements.md#fr-018), [FR-021](./functional_requirements.md#fr-021)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §2.1（競合レビュー不満「進行消失バグ」への直接回答）・信頼設計 P3/P6

- **説明 / Description**: レベル進行・星・コイン・アップグレードLv・設定を自動保存し、強制終了・破損をまたいで復元する。競合レビュー最大級の不満である「進行消失」を構造的に排除する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| 自動保存の実行 | レベル終了毎・購入毎・設定変更毎の3契機で実行率 100% | ユーザー操作不要 |
| 再起動後復元 | 直近クリアまでの進行（星・コイン・アップグレードLv・設定）の復元率 100% | アプリ強制終了後を含む |
| 破損時挙動 | クラッシュ 0件。部分復元を試行し、失敗時のみ初期化 + ユーザー通知 | 破損 JSON・未知 schemaVersion・フィールド欠損 |
| スキーマ互換 | 保存データへの schemaVersion 付与率 100%、旧バージョンからの前方マイグレーション成功率 100% | StorageInterface 経由（Web=localStorage / Capacitor=Preferences） |

- **測定方法 / Measurement**:
  1. **永続化ユニットテスト（Vitest）**: 保存→復元の全フィールド一致を assert し、3契機（レベル終了・購入・設定変更）それぞれで StorageInterface の書き込みが呼ばれることを spy で検証する。
  2. **破損データ注入テスト**: 壊れた JSON・未知 schemaVersion・フィールド欠損の3系統を StorageInterface モックに注入し、「部分復元成功」「初期化 + 通知」の分岐をそれぞれ assert する。
  3. **アトミック書き込みテスト**: 書き込み途中の中断（temp 書き込み後・rename 前の失敗）をシミュレートし、直前の正常データが保持されることを assert する。
  4. **Playwright E2E**: L1 クリア→`page.reload()`→星・コイン残高・解放状態の復元を検証する。実機ではアプリのスワイプキル→再起動で同一シナリオを手動確認する。
- **優先度**: Must

---

### アクセシビリティ

<a id="nfr-009"></a>

#### NFR-009: 知覚・操作アクセシビリティ — Must

> **関連FR:** [FR-002](./functional_requirements.md#fr-002), [FR-006](./functional_requirements.md#fr-006), [FR-014](./functional_requirements.md#fr-014), [FR-020](./functional_requirements.md#fr-020)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §4.2 橋の軋みフィードバック（音・色・粒子・振動の多チャネル設計）・§4.3 横断必須（ハプティクス設定 OFF 提供）

- **説明 / Description**: 応力表示を色のみに依存させず（色覚多様性対応）、タッチターゲット・文字サイズ・感覚チャネルの個別 OFF を保証する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| タッチターゲット | 全操作ボタン ≥44×44pt（44×44 CSS px として測定） | 全画面 |
| 応力表示の二重符号化 | 色変化（白→黄→赤）に加え、非色チャネル ≥2（粉パーティクル + 微振動）を同時提示 | stress 0.6〜1.0 帯 |
| 感覚チャネルの個別 OFF | サウンド / ハプティクスを独立に OFF 可能、反映は即時・永続化 | 設定画面（[FR-020](./functional_requirements.md#fr-020)） |
| 文字サイズ | 全 UI テキスト最小 12pt 以上 | Dynamic Type 相当の基準 |

- **測定方法 / Measurement**:
  1. **Playwright E2E（ターゲットサイズ）**: 全画面の操作ボタン要素の `boundingBox()` を取得し、44×44 CSS px 以上を一括 assert するスクリプトを CI に含める。
  2. **Engine ユニットテスト（二重符号化）**: stress が 0.6 を超えた tick で「色変更イベント」「粉パーティクル生成イベント」「微振動イベント」の3種が発火することを assert する。
  3. **色覚シミュレーション**: Chrome DevTools「Emulate vision deficiencies」（protanopia / deuteranopia / tritanopia の3種）でのスクリーンショットを取得し、軋み状態が色以外（粉・振動表現）で判別できることをレビュー記録に残す。
  4. **設定反映テスト（Playwright + spy）**: サウンド OFF 後の SFX 再生呼び出し 0 件、ハプティクス OFF 後の HapticsInterface 呼び出し 0 件を検証する。
  5. **フォントサイズ検査**: UI フォントサイズは TuningConstants の UI 定数のみから参照させ、最小値未満の指定を grep で検出して 0 件であることを CI 検証する。
- **優先度**: Must

---

### 保守性

<a id="nfr-010"></a>

#### NFR-010: アーキテクチャ規約 — Must

> **関連FR:** [FR-022](./functional_requirements.md#fr-022), [FR-025](./functional_requirements.md#fr-025), [FR-026](./functional_requirements.md#fr-026)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §7.2 環境非依存のコンポーネント設計・§4 冒頭（TuningConstants 集約規約）

- **説明 / Description**: Engine 層（物理・ルール）を Phaser 非依存・ヘッドレス Node 実行可能に保つ（CI ボット検証の前提）。Render は Engine の観測者であり書き戻しを禁止する。チューニング値は TuningConstants + レベル JSON に全集約し、grep で検証可能にする。ファイルは「多数の小さいファイル」原則（高凝集・低結合）で分割する。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| Engine 層の Phaser 依存 | import 0件（ヘッドレス Node 実行可能） | `src/engine/**` |
| Render→Engine 書き戻し | Engine 状態を変更する呼び出し 0件 | Render は観測者 |
| マジックナンバー | TuningConstants + レベル JSON 外の数値リテラル 0件 | Engine・juice 演出コード |
| ファイル行数 | ≤800行/ファイル（典型 200〜400行） | 全ソース |
| 関数行数 | ≤50行/関数 | 全ソース |

- **測定方法 / Measurement**:
  1. **dependency-cruiser ルール**: `src/engine/**` から `phaser` および `src/render/**` への依存を forbidden に設定し、CI で PR 毎に検証する。Render から Engine へは read-only の観測 API のみを公開し、状態変更 API への参照を同ルールで禁止する。
  2. **ヘッドレス実行スモーク**: CI で Engine のみを Node プロセスで起動し、L1 のゴースト解リプレイが完走することを毎 PR 検証する（Gate 2 と共用）。
  3. **ESLint**: `max-lines: 800`・`max-lines-per-function: 50`・`no-magic-numbers`（Engine・演出コードに適用、TuningConstants 参照とレベル JSON 由来値のみ許可）を CI で実行する。
- **優先度**: Must

---

### テスト

<a id="nfr-011"></a>

#### NFR-011: 品質ゲート — Must

> **関連FR:** [FR-024](./functional_requirements.md#fr-024), [FR-026](./functional_requirements.md#fr-026)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §8.1 品質ゲート・§3.3 検証ゲート（支配戦略の CI テスト契約化） / [KPI-004](./README.md#kpi-004)

- **説明 / Description**: レベル品質とコア体験を CI で保証する。全レベルが Gate 0/1/2/3 を通過し、実タッチ E2E とテンポ契約テストが常時グリーンであることを出荷条件とする。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| Engine 層ユニットカバレッジ | ライン ≥80% | Vitest coverage（v8 provider）、閾値未満で CI fail |
| Gate 0/1/2/3 通過率 | 同梱15面 + ボーナス面の 100% | GitHub Actions・固定 Node・PR 毎実行 |
| Gate 3（anti-dominant） | anti-dominant タグ面で直線1本ボットの失敗率 100% | 支配戦略の無効化検証 |
| 実タッチ E2E | L1 を実際に描いてクリアする E2E 1本が常時グリーン | Playwright |
| テンポ契約テスト | [NFR-003](#nfr-003) の全項目を CI で自動判定 | PR 毎実行 |

- **測定方法 / Measurement**:
  1. **カバレッジゲート**: Vitest `--coverage`（provider: v8）で `src/engine/**` のラインカバレッジを算出し、80% 未満で CI を fail させる閾値を設定する。
  2. **Gate パイプライン（GitHub Actions）**: Node バージョンを `.nvmrc` で固定し、Gate 0（Ajv による JSON Schema 検証）→ Gate 1（静的妥当性: 旗到達可能な配置・インク予算 >0 のチェックスクリプト）→ Gate 2（ヘッドレスエンジンでのゴースト解リプレイ、許容帯: 成功一致 + 位置 ε0.05m + tick±30）→ Gate 3（直線1本ボットが anti-dominant タグ面で必ず失敗することの assert）を全レベル対象・PR 毎に実行する。
  3. **実タッチ E2E**: Playwright の `page.mouse.down/move/up` で L1 の解ポリラインを実際に描画し、車の走行→クリア演出→Next 活性化までを検証する 1 本を CI に含める。
- **優先度**: Must

---

### コンプライアンス

<a id="nfr-012"></a>

#### NFR-012: プライバシー・レーティング — Must

> **関連FR:** [FR-022](./functional_requirements.md#fr-022)
> **根拠:** [research/07_decision.md](../research/07_decision.md) §6.1（v1.0 は SDK 非同梱・AdInterface は Noop 注入）・§6.3（将来の ATT/UMP/PrivacyInfo 対応手順）

- **説明 / Description**: v1.0 は外部ネットワーク通信ゼロ（App Store の「Data Not Collected」申告相当）。広告・計測 SDK は同梱せずインターフェース + Noop 実装のみとする。コンテンツは Everyone レーティングで設計する（暴力・恐怖表現なし、失敗はコミカル）。
- **定量目標 / Targets**:

| 指標 | 目標値 | 条件 |
| --- | --- | --- |
| 外部ネットワーク通信 | 実行時の外部ホストへのリクエスト 0件 | Web 版は配信オリジンへの自アセット取得のみ許可 |
| 広告・計測 SDK | 同梱 0個 | AdInterface / AnalyticsInterface / HapticsInterface は Noop または Web/Capacitor 実装のみ |
| 広告 UI 導線 | RV ボタンの表示 0件（フラグ OFF） | v1.0 リリースビルド |
| レーティング | Everyone 相当（暴力・恐怖・ギャンブル表現 0件） | 全アセット・全演出 |
| 将来対応の準備 | ATT / UMP / PrivacyInfo.xcprivacy の対応手順書を設計書に添付 | 実施は v1.1 広告導入時 |

- **測定方法 / Measurement**:
  1. **Playwright ネットワーク監査**: `page.on('request')` で全リクエストを記録し、配信オリジン以外へのリクエスト 0 件を assert する E2E を CI に含める。
  2. **実機通信キャプチャ**: mitmproxy を経由させた実機（Capacitor ビルド）で全15面 + ショップ + 設定を通しプレイし、キャプチャされた外部リクエスト 0 件をリリース前チェックリストで確認する。
  3. **依存監査**: `package.json` と lockfile に対する denylist grep（admob・firebase・sentry・applovin・revenuecat・facebook・appsflyer）で SDK パッケージ 0 件を CI 検証する。
  4. **コンテンツレビュー**: レーティングチェックリスト（暴力・恐怖・ギャンブル表現の有無）で全アセットをレビューし、記録を残す。
- **優先度**: Must

---

[← 機能要件](./functional_requirements.md) | [📋 目次](./README.md) | [US →](./user_stories.md)

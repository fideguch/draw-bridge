# InkBridge デプロイフロー設計（tenhoh 共通設計 準拠）

> 継承元: `~/Desktop/start/work/tenhoh/CasualGames/共通設計/`（2026-06-30版）。本書は InkBridge の**差分のみ**を定義する。
> 秘密情報（鍵の中身・パスワード）は本書にもリポにも書かない。場所とIDのみ（共通ルール準拠）。

## 1. アプリ識別子（共通規約への適合）

| 項目 | 値 | 現状からの変更 |
|---|---|---|
| slug | `inkbridge`（仮 — 最終アプリ名はASO判断で決定後に確定） | — |
| Bundle ID / applicationId | `net.skyapp.inkbridge` | **要変更**（現: `com.medicavice.inkbridge`）|
| パブリッシャー表記 | `Tenhoh llc.` | — |
| Apple Developer Team | **Skyus, Inc. `5JQTL886YT`**（リリース用） | **要変更**（現: 個人 `K3MR27P3G9` = 実機dev用に残す）|
| Google Play Developer | Skyus, Inc.（共通SA `play-publisher@fastlane-501006.iam.gserviceaccount.com`）| — |
| サポート/マーケURL | `https://games.tenhoh.net/app/inkbridge` | 未作成（組織側依頼）|
| プライバシーポリシー | `https://games.tenhoh.net/app/inkbridge/privacy` | 未作成（組織側依頼）|
| 連絡先 | `support@tenhoh.net` | — |

## 2. 共通設計との差分（InkBridge固有）

| 項目 | 共通標準 | InkBridge | 帰結 |
|---|---|---|---|
| 技術スタック | Flutter (+Flame) | **Capacitor 8 + Phaser 4 + Vite** | fastlane/ASC手順は共通のまま。ビルドコマンドのみ `npm run build && npx cap sync` |
| 広告 (AdMob) | あり | **v1.0 なし**（BR-008: 外部通信ゼロ・Noop実装） | App Privacy=**「データ収集なし」**・Play データセーフティ=**収集なし**・ATT不要 |
| 解析 (Firebase) | あり | **v1.0 なし** | Firebaseプロジェクト作成は**スキップ**（立ち上げチェックリスト2番は対象外）|
| IAP | RevenueCat | **なし**（コインのみ経済） | RevenueCat不使用（Binary Quest型）|
| i18n | gen-l10n | 実装済（自前カタログ7言語 en/ja/zh-Hans/ko/id/vi/th） | ストア掲載文も7ロケールで用意可能 |
| スクショ撮影 | `--dart-define=SHOT` | **Playwright**でdevサーバをデバイスviewport撮影 | iOS 6.9" 1320×2868 / Play 1320×2640（≤2:1）を自動生成 |

## 3. Phase 0 — このMacのセットアップ（現状: 鍵・ツール未配置）

確認済み: `~/.appstoreconnect` `~/.config/play` `~/.blitz` fastlane **すべて未配置**。招待（2000fumito@gmail.com）はASC/Play Console双方に受領済み前提。

1. **Xcode**: Settings → Accounts に 2000fumito@gmail.com を追加 → チーム一覧に **Skyus, Inc. (5JQTL886YT)** が見えることを確認。
2. **ASC APIキー**: ASC → ユーザーとアクセス → 統合 → **個人APIキー**（またはAdminに共有キー配置を依頼）→ `.p8` を `~/.appstoreconnect/private_keys/` へ。keyId/issuerId を控える（中身はどこにも書かない）。
3. **Play SA鍵**: 運用者に `skyus-play-sa.json` の安全な受け渡しを依頼 → `~/.config/play/skyus-play-sa.json`（chmod 600）。
4. **fastlane**: `brew install fastlane`（Homebrew Ruby 経由。system ruby 2.6 は不可）。
5. **Androidアップロード鍵**: `keytool -genkeypair -v -keystore ~/.config/play/inkbridge-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` → `android/key.properties`（gitignore済を確認）から参照。Play App Signing 併用。
6. （App Privacy申告をCLI化する場合のみ）blitz 導入 + `asc web auth login` は**実ターミナルでApple ID+2FA**。※非公式API — 収集なし申告のみに限定使用。UIで済ませても工数は小さい。

## 4. リポジトリ側の設定変更（CS-5で実施）

- `capacitor.config.ts`: `appId: 'net.skyapp.inkbridge'`
- iOS `project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER=net.skyapp.inkbridge` / Release構成 `DEVELOPMENT_TEAM=5JQTL886YT`（Debug=個人チーム維持可）/ `IPHONEOS_DEPLOYMENT_TARGET=15.0` / `TARGETED_DEVICE_FAMILY=1`（iPhone専用・iPadスクショ不要化）
- iOS `Info.plist`: `ITSAppUsesNonExemptEncryption=false`（輸出コンプラ恒久回避）
- Android: `applicationId` 変更（`android/app/build.gradle`）+ `key.properties` 参照 + 署名設定。AGP 8.7.2 / Gradle 8.11.1 は 16KB要件を満たす（検証: `zipalign -c -P 16 -v 4 <split.apk>` をリリース時チェックに追加）
- `fastlane/` を作成（Appfile: `net.skyapp.inkbridge` + SA鍵パス / Fastfile: `supply` internal→production / metadata 7ロケール）

## 5. 提出フロー

### iOS（ほぼ全自動）
```
npm run build && npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release archive → .ipa
altool --upload-app（ASC APIキー認証）
asc: metadata(7ロケール) / pricing(--free, base JPN, start-date=Apple TZ今日) / age-rating(全NONE+真偽値質問はすべてfalse: 広告なし) / categories(GAMES_PUZZLE)
App Privacy: 「データを収集しない」を申告（UI 1分 or blitz）
asc validate --app <ID> --platform IOS → asc publish appstore --submit
```
注意: 初回バージョンは「What's New」編集不可。スクショは 6.9"=1320×2868（iPhone 16 Pro Max viewport で Playwright 撮影）。

### Android
```
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease（upload.jks署名）→ zipalign -P 16 検証
fastlane supply --track internal（AAB+掲載文+画像）
Play Console UI（初回のみ）: アプリ作成 / データセーフティ=収集なし / IARC質問票(全項目なし・広告なし→全年齢) / カテゴリ=パズル+タグ / 対象年齢13歳以上 / 「審査に送信」
以降のリリース: fastlane/API のみで完結
```
注意: 初回 production は draft のみ作成可・`changesNotSentForReview` を付けない。フィーチャーグラフィック 1024×500 必須。

## 6. バージョニング/リリース運用
- `package.json` version = マーケティングバージョン。iOS `CFBundleVersion` / Android `versionCode` はリリース毎に単調増加（cap sync では自動更新されない — リリーススクリプトで同期）。
- リリース手順は毎回: build → sync → platform build → upload → (内部トラック/TestFlightで実機確認) → 段階公開。
- Obsidian `CasualGames/InkBridge/` を進捗・ID・申告内容で随時更新（秘密は書かない）。

## 7. 立ち上げチェックリスト（InkBridge版）
1. [ ] 最終アプリ名決定（ASO: "Draw Bridge"系ワードとの兼ね合い）→ slug確定
2. [ ] Bundle `net.skyapp.inkbridge` リネーム（CS-5）
3. [ ] Phase 0 セットアップ（鍵×2・fastlane・keystore）
4. [ ] ASC アプリ作成 → メタデータ/価格/年齢/プライバシー
5. [ ] Play アプリ作成 → SA権限確認 → fastlane構成 → アプリのコンテンツ
6. [ ] `games.tenhoh.net/app/inkbridge` + `/privacy` を組織に依頼
7. [ ] スクショ自動撮影（Playwright, 2サイズ×7ロケール）+ アイコン512/フィーチャー1024×500
8. [ ] 内部トラック/TestFlightで実機QA → 審査提出

## 8. 未決事項（ユーザー判断待ち）
- 最終アプリ名（現: InkBridge 仮）。
- games.tenhoh.net 配下ページの作成依頼先/手段。
- ASC APIキー: 個人キー発行 or 共有キー受け渡しのどちらにするか。

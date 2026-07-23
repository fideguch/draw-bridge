# store-assets/

Master art and derived store/marketing assets for **Draw Bridge Puzzle**
(formerly InkBridge). Not part of the app bundle; used to generate the
native icon sets under `ios/` and `android/`, and Play Store listing assets
under `fastlane/metadata/android/`.

## Provenance

- **Master**: `Orange_car_driving_over_gap_202607161427.jpeg` (car driving
  over a gap on an ink-drawn bridge, sky-blue background), approved by the
  designer on 2026-07-16 for the "Release step ①" rename/icon pass.
  Source file lives outside the repo at
  `~/Downloads/Orange_car_driving_over_gap_202607161427.jpeg`; delivered
  already at 1024x1024, flattened (no alpha channel).
- `icon-1024.png` — the master re-encoded as PNG (RGB, no alpha), the single
  source used to derive every other asset below via Pillow (`sips`-only was
  insufficient for transparent-canvas compositing needed by the Android
  adaptive icon foreground layers).
- Sampled sky-blue background: `#63C2E8` (averaged from a 40x40 patch at the
  master's top-left corner, i.e. pure sky with no artwork). Used as the
  Android adaptive icon background color
  (`android/app/src/main/res/values/ic_launcher_background.xml`).

## Generated assets

| File | Purpose |
| --- | --- |
| `icon-1024.png` | Master PNG, source for all other sizes |
| `play-icon-512.png` | Google Play Store listing icon (512x512) |
| `feature-1024x500.png` | Google Play feature graphic (centered 500px-tall crop of the master; also copied to `fastlane/metadata/android/en-US/images/featureGraphic.png`) |
| `screens/ios/*.png` | iOS 6.9" App Store screenshots (1320x2868) |
| `screens/play/*.png` | Google Play phone screenshots (1320x2640; also copied to `fastlane/metadata/android/ja-JP/images/phoneScreenshots/`) |

Native icon files themselves (`ios/App/App/Assets.xcassets/AppIcon.appiconset/`,
`android/app/src/main/res/mipmap-*/`) are generated from `icon-1024.png` and
are not duplicated here — regenerate via the same Pillow script if the
master art changes.

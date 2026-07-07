import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medicavice.inkbridge',
  appName: 'InkBridge',
  webDir: 'dist',
  // Portrait-only orientation is enforced natively:
  // - ios/App/App/Info.plist  (UISupportedInterfaceOrientations = portrait)
  // - android AndroidManifest (android:screenOrientation="portrait")
  // Letterbox/background behind the WebView matches index.html.
  backgroundColor: '#101216',
  ios: {
    contentInset: 'never',
  },
};

export default config;

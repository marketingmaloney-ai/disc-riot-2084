import type { CapacitorConfig } from '@capacitor/cli';

// Native app wrapper (iOS App Store + Google Play). The web build in dist/ is bundled into the app,
// so the game runs fully offline. See RELEASE.md for build + upload steps.
const config: CapacitorConfig = {
  appId: 'com.maloneymarketing.discriot2084', // permanent once uploaded to either store
  appName: 'Disc Riot 2084',
  webDir: 'dist',
  backgroundColor: '#12052a',
  ios: {
    contentInset: 'never',
    backgroundColor: '#12052a',
    scrollEnabled: false,
  },
  android: {
    backgroundColor: '#12052a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#12052a',
      showSpinner: false,
    },
  },
};

export default config;

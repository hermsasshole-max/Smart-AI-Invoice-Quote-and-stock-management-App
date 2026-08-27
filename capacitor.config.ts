import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartai.invoicequote',
  appName: 'Smart AI Invoice & Quote',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'smart-ai-invoice-quote-and-stock-y242.onrender.com',
      '*.onrender.com',
      '*.google.com',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0B0D13',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
  },
};

export default config;

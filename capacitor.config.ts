import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harrys.aircon',
  appName: 'Harrys Aircon and Electrical',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    ScreenOrientation: {
      orientation: 'unspecified',
    },
  },
};

export default config;

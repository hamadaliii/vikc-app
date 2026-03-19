import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vikc.app',
  appName: 'VIKC',
  webDir: 'out',
  server: {
    url: 'https://vikc-app-9r97.vercel.app',
    cleartext: false,
    allowNavigation: ['vikc-app-9r97.vercel.app']
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#0d0d1a',
  }
};

export default config;

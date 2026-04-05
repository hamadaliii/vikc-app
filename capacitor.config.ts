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
    backgroundColor: '#f8f4ed',
    contentInset: 'never',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    allowsLinkPreview: false,
    scrollEnabled: true,
  }
};

export default config;

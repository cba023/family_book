import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familybook.genealogy',
  appName: '家族族谱',
  webDir: 'dist',
  server: {
    // 直接连接你的服务器
    url: 'http://119ksbn841950.vicp.fun/',
    cleartext: true,
    allowNavigation: ['119ksbn841950.vicp.fun'],
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;

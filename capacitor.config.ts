import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.coniv.app',
  appName: 'CONIV',
  webDir: 'out',
  server: {
    url: 'https://coniv.in',
    cleartext: false
  }
};

export default config;

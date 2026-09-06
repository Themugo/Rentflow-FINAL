import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for CALQULUS PMS PWA / native app wrapper.
 * The biometricService uses Capacitor.isNativePlatform() to gracefully
 * fall back on web — no native build is required for the web app.
 *
 * Native production builds bundle the Vite `dist` output locally so the
 * installed app is not just a remote website inside a WebView.
 * CAPACITOR_SERVER_URL remains an explicit development override when a
 * live server is intentionally required.
 *
 * If building a native Android/iOS app:
 *   1. Keep the bundle identifier below stable for store releases.
 *   2. Set CAPACITOR_SERVER_URL only for live-server development/testing.
 *   3. Run: npx cap add android && npx cap add ios
 */
const config: CapacitorConfig = {
  appId: 'site.calqulus.pms',
  appName: 'CALQULUS PMS',
  webDir: 'dist',
  ...(process.env.CAPACITOR_SERVER_URL
    ? {
        server: {
          url: process.env.CAPACITOR_SERVER_URL,
          cleartext: false,
        },
      }
    : {}),
};

export default config;

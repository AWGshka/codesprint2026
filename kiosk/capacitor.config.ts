import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.givetap.kiosk",
  appName: "GiveTap Kiosk",
  webDir: "www",
  // Dev convenience: point the native webview straight at the running frontend's kiosk
  // route instead of the bundled www/ shell. Comment out for a production bundle.
  // server: { url: "http://192.168.1.10:3000", cleartext: true },
  android: {
    // Kiosk devices stay awake and locked to the app via screen pinning (set up in-app).
    allowMixedContent: false,
  },
};

export default config;

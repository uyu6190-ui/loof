import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.uyu6190.loof",
  appName: "loof",
  webDir: "dist",
  server: {
    iosScheme: "loof"
  },
  plugins: {
    LoofCloud: {
      containerIdentifier: "iCloud.com.uyu6190.loof"
    }
  }
};

export default config;

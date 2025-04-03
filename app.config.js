// Expo config
module.exports = ({ config }) => {
  return {
    ...config,
    name: "Gardens",
    slug: "gardens",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    cli: {
      appVersionSource: "remote"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ece0cb"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gardens.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ece0cb"
      },
      package: "com.gardens.app"
    },
    web: {
      favicon: "./assets/favicon.ico"
    },
    extra: {
      eas: {
        projectId: "156948c3-6dee-41d0-88e7-e81335008877"
      },
      enableBridgeless: true,
      // Expose environment variables
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      WORKER_URL: process.env.WORKER_URL,
      EXPO_PUBLIC_OPENGRAPH_API_KEY: process.env.EXPO_PUBLIC_OPENGRAPH_API_KEY,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN, // Make sure this exists and has R2 permissions
      CLOUDFLARE_R2_ACCESS_KEY: process.env.CLOUDFLARE_R2_ACCESS_KEY,
      CLOUDFLARE_R2_SECRET_KEY: process.env.CLOUDFLARE_R2_SECRET_KEY,
    },
    jsEngine: "hermes",
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-image-picker",
      "expo-local-authentication",
      "expo-sqlite",
      "expo-av",
      "react-native-libsodium",
      "expo-barcode-scanner",
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true
          }
        }
      ]
    ],
    scheme: "gardens"
  };
}; 
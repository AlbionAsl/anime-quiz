// app.config.ts - PRODUCTION BUILD FIX

import 'dotenv/config';

export default {
  expo: {
    name: "SHODOJO",
    slug: "DAILYQUIZ",
    scheme: "SHODOJO",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#121212"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.bluefiremonkey.DAILYQUIZ"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.bluefiremonkey.DAILYQUIZ",
      versionCode: 4, // Increment for new release
      // Remove conditional googleServicesFile - use static path
      googleServicesFile: "./google-services.json",
      permissions: ["INTERNET"],
      compileSdkVersion: 34,
      targetSdkVersion: 34
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-google-signin/google-signin"
    ],
    extra: {
      // Firebase Configuration - with fallbacks for production
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
      
      // Google OAuth Configuration
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
      
      // EAS Configuration
      eas: {
        projectId: "41f87f0b-cee0-45a0-90ee-01a40f634202"
      }
    }
  }
};
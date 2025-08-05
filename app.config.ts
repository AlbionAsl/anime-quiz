// app.config.ts - PRODUCTION BUILD COMPATIBLE

import 'dotenv/config';

// Helper to get environment variable with fallback
const getEnvVar = (key: string, fallback?: string): string | undefined => {
  return process.env[key] || process.env[`EXPO_PUBLIC_${key}`] || fallback;
};

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
      versionCode: 6,
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
      // Firebase Configuration - ensure all variables are available
      FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY') || "AIzaSyA5i7KjUdc2iHMIdLT1MHjwNe4OyJwxQ_0",
      FIREBASE_AUTH_DOMAIN: getEnvVar('FIREBASE_AUTH_DOMAIN') || "animequiz-d1890.firebaseapp.com",
      FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID') || "animequiz-d1890",
      FIREBASE_STORAGE_BUCKET: getEnvVar('FIREBASE_STORAGE_BUCKET') || "animequiz-d1890.appspot.com",
      FIREBASE_MESSAGING_SENDER_ID: getEnvVar('FIREBASE_MESSAGING_SENDER_ID') || "108288016848",
      FIREBASE_APP_ID: getEnvVar('FIREBASE_APP_ID') || "1:108288016848:android:6c3b36e4013177be3a39d5",
      FIREBASE_MEASUREMENT_ID: getEnvVar('FIREBASE_MEASUREMENT_ID'),
      
      // Google OAuth Configuration
      GOOGLE_ANDROID_CLIENT_ID: getEnvVar('GOOGLE_ANDROID_CLIENT_ID'),
      GOOGLE_WEB_CLIENT_ID: getEnvVar('GOOGLE_WEB_CLIENT_ID'),
      
      // EAS Configuration
      eas: {
        projectId: "41f87f0b-cee0-45a0-90ee-01a40f634202"
      }
    }
  }
};
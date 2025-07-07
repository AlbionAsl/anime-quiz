// app.config.ts

import 'dotenv/config';

export default {
  expo: {
    name: "DAILYQUIZ",
    slug: "DAILYQUIZ",
    scheme: "dailyquiz", // THIS IS CRITICAL FOR OAUTH!
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
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
      googleServicesFile: "./google-services.json"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-google-signin/google-signin"
    ],
    extra: {
      // Firebase Configuration
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "AIzaSyAJ2-wWov82Fo7zmuvayyT9c4Uv8r24X1I",
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || "animequiz-d1890.firebaseapp.com",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "animequiz-d1890",
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || "animequiz-d1890.appspot.com",
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || "108288016848",
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || "1:108288016848:web:3f051df26f3d15be3a39d5",
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || "G-R4YF26JYGC",
      
      // Google OAuth Configuration
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID || "108288016848-1mtvl69gp04blpo8g5q4i3ou3fit36kl.apps.googleusercontent.com",
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || "108288016848-cr589bjgpku1sa85temvn01af93osdm7.apps.googleusercontent.com",
      
      // EAS Configuration
      eas: {
        projectId: "41f87f0b-cee0-45a0-90ee-01a40f634202"
      }
    }
  }
};
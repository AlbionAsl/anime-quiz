// src/utils/firebase.ts - PRODUCTION BUILD COMPATIBLE VERSION

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// CRITICAL FIX: Use static import with try-catch for production compatibility
let getReactNativePersistence: any;
try {
  // This import must be at the top level and wrapped in try-catch
  const authModule = require('firebase/auth/react-native');
  getReactNativePersistence = authModule.getReactNativePersistence;
} catch (error) {
  console.warn('React Native persistence not available, using default auth');
}

// Firebase configuration with fallbacks for production
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: Constants.expoConfig?.extra?.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate critical config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase config:', firebaseConfig);
  throw new Error('Missing critical Firebase configuration. Check environment variables.');
}

// Initialize Firebase app (avoid duplicate initialization)
let app;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
} catch (error) {
  console.error('❌ Firebase app initialization error:', error);
  throw error;
}

// Initialize Firestore
let firestore;
try {
  firestore = getFirestore(app);
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.error('❌ Firestore initialization error:', error);
  throw error;
}

// Initialize Auth with proper error handling
let auth;
try {
  // Check if auth is already initialized
  try {
    auth = getAuth(app);
    console.log('✅ Using existing Firebase Auth instance');
  } catch (getAuthError) {
    // Auth not initialized yet, initialize it now
    if (getReactNativePersistence && AsyncStorage) {
      try {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
      } catch (persistenceError) {
        console.warn('⚠️ Failed to initialize with persistence, using default:', persistenceError);
        auth = initializeAuth(app);
        console.log('✅ Firebase Auth initialized without persistence');
      }
    } else {
      auth = initializeAuth(app);
      console.log('✅ Firebase Auth initialized without persistence (module not available)');
    }
  }
} catch (error) {
  console.error('❌ Fatal Firebase Auth initialization error:', error);
  throw error;
}

export { firestore, auth };
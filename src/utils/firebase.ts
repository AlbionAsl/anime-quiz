// src/utils/firebase.ts - CORRECT PERSISTENCE IMPLEMENTATION

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  initializeAuth,
  getReactNativePersistence,
  Auth
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

console.log('🔧 Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

// Initialize Firebase app (avoid duplicate initialization)
let app;
if (getApps().length > 0) {
  app = getApp();
  console.log('✅ Using existing Firebase app');
} else {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
}

// Initialize Firestore
const firestore = getFirestore(app);
console.log('✅ Firestore initialized successfully');

// Initialize Auth with AsyncStorage persistence
// CRITICAL: We must ALWAYS initialize with persistence on first call
// Never use getAuth() for initial setup - it creates auth without persistence!
let auth: Auth;

try {
  console.log('🔐 Initializing Firebase Auth with AsyncStorage persistence...');
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  
  console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
  console.log('📱 User authentication state WILL persist across app restarts');
  
} catch (error: any) {
  // If auth is already initialized, this error will occur
  // In this case, we need to import getAuth to get the existing instance
  if (error.code === 'auth/already-initialized') {
    console.log('⚠️  Auth already initialized, retrieving existing instance...');
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
    console.log('✅ Retrieved existing Firebase Auth instance');
    
    // Check if persistence is set up correctly
    console.log('📱 Auth persistence: Using existing configuration');
  } else {
    console.error('❌ Firebase Auth initialization error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw new Error(`Failed to initialize Firebase Auth: ${error.message}`);
  }
}

// Add auth state listener for debugging
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('🔐 Auth state: User logged in', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });
  } else {
    console.log('🔓 Auth state: No user logged in');
  }
});

export { firestore, auth };
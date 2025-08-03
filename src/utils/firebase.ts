// src/utils/firebase.ts - SIMPLEST MOST COMPATIBLE APPROACH

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase configuration
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.FIREBASE_APP_ID,
  measurementId: Constants.expoConfig?.extra?.FIREBASE_MEASUREMENT_ID
};

// Validate critical config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Missing critical Firebase configuration');
}

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const firestore = getFirestore(app);

// Initialize Auth with React Native persistence using require (SAFEST METHOD)
let auth;

try {
  // Use require to safely import React Native persistence
  const { getReactNativePersistence } = require('firebase/auth/react-native');
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  
  console.log('🔐 Firebase Auth initialized with AsyncStorage persistence');
  
} catch (rnError) {
  try {
    // Fallback: try main auth module
    const firebaseAuth = require('firebase/auth');
    const getReactNativePersistence = firebaseAuth.getReactNativePersistence;
    
    if (getReactNativePersistence) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log('🔐 Firebase Auth initialized with AsyncStorage persistence (fallback)');
    } else {
      throw new Error('No persistence available');
    }
    
  } catch (fallbackError) {
    try {
      // Final fallback: initialize without persistence
      auth = initializeAuth(app);
      console.log('🔐 Firebase Auth initialized without persistence');
    } catch (initError) {
      // Auth might already be initialized
      auth = getAuth(app);
      console.log('🔐 Using existing Firebase Auth instance');
    }
  }
}

export { firestore, auth };
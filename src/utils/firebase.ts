// src/utils/firebase.ts - PRODUCTION-READY VERSION WITH COMPREHENSIVE ERROR HANDLING

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { initializeAuth, Auth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const { getReactNativePersistence } = require('firebase/auth') as any;


// Types for better error handling
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Log configuration loading
console.log('🔧 Loading Firebase configuration...');
console.log('Constants.expoConfig available:', !!Constants.expoConfig);
console.log('Extra config available:', !!Constants.expoConfig?.extra);

// Build Firebase configuration with multiple fallbacks
const buildFirebaseConfig = (): FirebaseConfig => {
  // Try multiple sources for configuration
  const config = {
    apiKey: 
      Constants.expoConfig?.extra?.FIREBASE_API_KEY || 
      Constants.manifest?.extra?.FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      Constants.expoConfig?.extra?.firebaseApiKey, // Alternative naming
      
    authDomain: 
      Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN || 
      Constants.manifest?.extra?.FIREBASE_AUTH_DOMAIN ||
      process.env.FIREBASE_AUTH_DOMAIN ||
      Constants.expoConfig?.extra?.firebaseAuthDomain,
      
    projectId: 
      Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID || 
      Constants.manifest?.extra?.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      Constants.expoConfig?.extra?.firebaseProjectId,
      
    storageBucket: 
      Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET || 
      Constants.manifest?.extra?.FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      Constants.expoConfig?.extra?.firebaseStorageBucket,
      
    messagingSenderId: 
      Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID || 
      Constants.manifest?.extra?.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      Constants.expoConfig?.extra?.firebaseMessagingSenderId,
      
    appId: 
      Constants.expoConfig?.extra?.FIREBASE_APP_ID || 
      Constants.manifest?.extra?.FIREBASE_APP_ID ||
      process.env.FIREBASE_APP_ID ||
      Constants.expoConfig?.extra?.firebaseAppId,
      
    measurementId: 
      Constants.expoConfig?.extra?.FIREBASE_MEASUREMENT_ID || 
      Constants.manifest?.extra?.FIREBASE_MEASUREMENT_ID ||
      process.env.FIREBASE_MEASUREMENT_ID ||
      Constants.expoConfig?.extra?.firebaseMeasurementId ||
      undefined
  };

  // Log what we found (without exposing sensitive data)
  console.log('🔍 Configuration check:', {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'MISSING',
    authDomain: config.authDomain ? `${config.authDomain.substring(0, 20)}...` : 'MISSING',
    projectId: config.projectId || 'MISSING',
    storageBucket: config.storageBucket ? `${config.storageBucket.substring(0, 20)}...` : 'MISSING',
    messagingSenderId: config.messagingSenderId || 'MISSING',
    appId: config.appId ? `${config.appId.substring(0, 15)}...` : 'MISSING',
    measurementId: config.measurementId ? `${config.measurementId.substring(0, 10)}...` : 'OPTIONAL'
  });

  return config as FirebaseConfig;
};

// Validate Firebase configuration
const validateFirebaseConfig = (config: FirebaseConfig): void => {
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey', 
    'authDomain', 
    'projectId', 
    'storageBucket', 
    'messagingSenderId', 
    'appId'
  ];

  const missingFields = requiredFields.filter(field => !config[field] || config[field] === '');
  
  if (missingFields.length > 0) {
    const errorMessage = `❌ Missing required Firebase configuration fields: ${missingFields.join(', ')}`;
    console.error(errorMessage);
    console.error('Available Constants:', {
      expoConfig: !!Constants.expoConfig,
      manifest: !!Constants.manifest,
      extra: !!Constants.expoConfig?.extra,
      platformEnv: process.env.NODE_ENV
    });
    throw new Error(errorMessage);
  }

  // Validate format of critical fields
  if (!config.apiKey.startsWith('AIza')) {
    throw new Error('❌ Invalid Firebase API key format');
  }

  if (!config.authDomain.includes('firebaseapp.com')) {
    throw new Error('❌ Invalid Firebase auth domain format');
  }

  if (!config.appId.includes(':')) {
    throw new Error('❌ Invalid Firebase app ID format');
  }

  console.log('✅ Firebase configuration validation passed');
};

// Initialize Firebase with comprehensive error handling
let app: FirebaseApp;
let firestore: Firestore;
let auth: Auth;

try {
  console.log('🚀 Initializing Firebase...');
  
  // Build and validate configuration
  const firebaseConfig = buildFirebaseConfig();
  validateFirebaseConfig(firebaseConfig);

  // Initialize Firebase app
  console.log('📱 Creating Firebase app...');
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app created successfully');

  // Initialize Firestore
  console.log('🗄️  Initializing Firestore...');
  firestore = getFirestore(app);
  console.log('✅ Firestore initialized successfully');

  // Initialize Auth with AsyncStorage persistence
  console.log('🔐 Initializing Firebase Auth...');
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
    console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
  } catch (authError: any) {
    // Handle case where auth is already initialized
    if (authError.code === 'auth/already-initialized') {
      console.log('⚠️  Firebase Auth already initialized, using existing instance');
      const { getAuth } = require('firebase/auth');
      auth = getAuth(app);
    } else {
      throw authError;
    }
  }

  console.log('🎉 Firebase initialization completed successfully!');

} catch (error: any) {
  console.error('💥 Firebase initialization failed:', error);
  
  // Detailed error logging
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack?.substring(0, 500) // Truncate stack trace
  });

  // Environment debugging info
  console.error('Environment debug info:', {
    platform: Constants.platform,
    isDevice: Constants.isDevice,
    expoVersion: Constants.expoVersion,
    appVersion: Constants.manifest?.version,
    nodeEnv: process.env.NODE_ENV,
    hasExpoConfig: !!Constants.expoConfig,
    hasManifest: !!Constants.manifest,
    hasExtra: !!Constants.expoConfig?.extra,
    extraKeys: Constants.expoConfig?.extra ? Object.keys(Constants.expoConfig.extra) : []
  });

  // Create a more user-friendly error message
  let userFriendlyMessage = 'Failed to initialize Firebase. ';
  
  if (error.message.includes('Missing required Firebase configuration')) {
    userFriendlyMessage += 'Configuration is incomplete. Please check your environment variables.';
  } else if (error.message.includes('Invalid Firebase')) {
    userFriendlyMessage += 'Configuration format is invalid. Please check your Firebase project settings.';
  } else if (error.message.includes('network')) {
    userFriendlyMessage += 'Network error. Please check your internet connection.';
  } else {
    userFriendlyMessage += 'An unexpected error occurred during setup.';
  }

  // In production, you might want to show a user-friendly error screen
  // instead of crashing the app
  if (__DEV__) {
    // In development, re-throw to help with debugging
    throw new Error(`${userFriendlyMessage}\n\nOriginal error: ${error.message}`);
  } else {
    // In production, log the error but provide fallback
    console.error('🆘 Production Firebase error - this should be reported');
    
    // You could implement a fallback mechanism here
    // For now, still throw but with a cleaner message
    throw new Error(userFriendlyMessage);
  }
}

// Health check function
export const checkFirebaseHealth = async (): Promise<boolean> => {
  try {
    console.log('🔍 Running Firebase health check...');
    
    // Test Firestore connection
    const { doc, getDoc } = require('firebase/firestore');
    await getDoc(doc(firestore, 'health', 'check'));
    
    // Test Auth state
    const currentUser = auth.currentUser;
    console.log('Auth state:', currentUser ? 'User logged in' : 'No user');
    
    console.log('✅ Firebase health check passed');
    return true;
  } catch (error) {
    console.error('❌ Firebase health check failed:', error);
    return false;
  }
};

// Export Firebase instances
export { firestore, auth, app };

// Export configuration for debugging
export const getFirebaseConfig = () => {
  try {
    return buildFirebaseConfig();
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    return null;
  }
};

// Export debug info
export const getFirebaseDebugInfo = () => {
  return {
    appInitialized: !!app,
    firestoreInitialized: !!firestore,
    authInitialized: !!auth,
    hasExpoConfig: !!Constants.expoConfig,
    hasExtra: !!Constants.expoConfig?.extra,
    platform: Constants.platform,
    isDevice: Constants.isDevice,
    environment: __DEV__ ? 'development' : 'production'
  };
};
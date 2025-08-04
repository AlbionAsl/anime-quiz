// App.tsx - PRODUCTION BUILD FIX WITH ENHANCED ERROR HANDLING

import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet, Alert, Text, ScrollView } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';
import { preloadAnimeData } from './src/utils/animeCacheUtils';

// Error Boundary Component with better error display
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 App Error Boundary caught error:', error, errorInfo);
    
    // In production, log to crash reporting service
    if (!__DEV__) {
      // Example: Crashlytics.recordError(error);
      
      // Log error details for debugging production crashes
      console.error('Production error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
    
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.errorScrollContent}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>
              The app encountered an unexpected error. Please restart the app.
            </Text>
            
            {__DEV__ && this.state.error && (
              <>
                <Text style={styles.errorSubtitle}>Error Message:</Text>
                <Text style={styles.errorDetails}>
                  {this.state.error.message}
                </Text>
                
                {this.state.error.stack && (
                  <>
                    <Text style={styles.errorSubtitle}>Stack Trace:</Text>
                    <Text style={styles.errorStack}>
                      {this.state.error.stack}
                    </Text>
                  </>
                )}
                
                {this.state.errorInfo?.componentStack && (
                  <>
                    <Text style={styles.errorSubtitle}>Component Stack:</Text>
                    <Text style={styles.errorStack}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

// Firebase initialization wrapper
const initializeFirebase = async (): Promise<void> => {
  try {
    console.log('🔥 Initializing Firebase...');
    
    // Dynamic import to ensure proper module loading
    const firebase = await import('./src/utils/firebase');
    
    if (!firebase.auth || !firebase.firestore) {
      throw new Error('Firebase modules not properly initialized');
    }
    
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

const App: React.FC = () => {
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app with proper error handling
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        console.log('📱 Platform:', Platform.OS);
        console.log('🔧 Dev mode:', __DEV__);

        // Initialize Firebase first
        await initializeFirebase();

        // Hide navigation bar on Android for immersive experience
        if (Platform.OS === 'android') {
          try {
            // Set navigation bar to be translucent
            await NavigationBar.setBackgroundColorAsync('transparent');
            await NavigationBar.setButtonStyleAsync('light');
            console.log('✅ Android navigation bar configured');
          } catch (navError) {
            console.warn('⚠️  Navigation bar configuration failed:', navError);
            // Don't fail the app for this
          }
        }

        // OPTIMIZATION: Preload anime data in background
        console.log('🚀 Starting background data preload...');
        preloadAnimeData().catch(error => {
          console.warn('⚠️  Background preload failed (non-critical):', error);
          // Don't fail the app for this
        });
        
        console.log('✅ App initialization completed successfully');
        setIsInitialized(true);
        
      } catch (error) {
        console.error('❌ Critical app initialization error:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
      }
    };

    initializeApp();
  }, []);

  // Show initialization error if it occurred
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <ScrollView contentContainerStyle={styles.errorScrollContent}>
          <Text style={styles.errorTitle}>Initialization Failed</Text>
          <Text style={styles.errorText}>
            Failed to initialize the app: {initError}
          </Text>
          <Text style={styles.errorText}>
            Please check your internet connection and restart the app.
          </Text>
          
          {__DEV__ && (
            <Text style={styles.errorDetails}>
              Debug Info: Check console logs for more details
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={customDarkTheme}>
          <View style={[styles.container, { backgroundColor: customDarkTheme.colors.background }]}>
            <StatusBar style="light" backgroundColor="transparent" translucent />
            <AppNavigator />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  errorScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginTop: 20,
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  errorText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  errorDetails: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'left',
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#1E1E1E',
    padding: 10,
    borderRadius: 5,
    width: '100%',
  },
  errorStack: {
    fontSize: 10,
    color: '#999999',
    textAlign: 'left',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#1E1E1E',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    marginBottom: 10,
  },
});

export default App;
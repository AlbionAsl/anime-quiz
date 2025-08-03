// App.tsx - WITH COMPREHENSIVE ERROR HANDLING

import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet, Text, Alert } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';
import { preloadAnimeData } from './src/utils/animeCacheUtils';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.log('💥 Error Boundary caught error:', error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('💥 App crashed with error:', error);
    console.error('💥 Error info:', errorInfo);
    console.error('💥 Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo
    });

    // Log detailed error information
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      version: Platform.Version
    };

    console.error('💥 Detailed error info:', JSON.stringify(errorDetails, null, 2));

    // In production, you would send this to a crash reporting service
    // like Sentry, Crashlytics, or Bugsnag
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <PaperProvider theme={customDarkTheme}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
              <Text style={styles.errorMessage}>
                The app encountered an unexpected error. Please restart the app.
              </Text>
              
              {__DEV__ && this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorDetailsTitle}>Error Details (Debug):</Text>
                  <Text style={styles.errorDetailsText}>
                    {this.state.error.message}
                  </Text>
                  {this.state.error.stack && (
                    <Text style={styles.errorStack}>
                      {this.state.error.stack.substring(0, 1000)}...
                    </Text>
                  )}
                </View>
              )}
            </View>
          </PaperProvider>
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

// Firebase Health Check Component
const FirebaseHealthCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFirebase = async () => {
      try {
        console.log('🔍 Checking Firebase health...');
        
        // Dynamic import to catch Firebase initialization errors
        const { checkFirebaseHealth, getFirebaseDebugInfo } = await import('./src/utils/firebase');
        
        const debugInfo = getFirebaseDebugInfo();
        console.log('🔍 Firebase debug info:', debugInfo);
        
        const isHealthy = await checkFirebaseHealth();
        
        if (!isHealthy) {
          throw new Error('Firebase health check failed');
        }
        
        console.log('✅ Firebase is healthy');
        setIsLoading(false);
      } catch (error: any) {
        console.error('❌ Firebase health check error:', error);
        setFirebaseError(error.message);
        setIsLoading(false);
      }
    };

    checkFirebase();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={customDarkTheme}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Initializing app...</Text>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  if (firebaseError) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={customDarkTheme}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Configuration Error</Text>
            <Text style={styles.errorMessage}>
              The app could not connect to Firebase. Please check your internet connection and try again.
            </Text>
            
            {__DEV__ && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Debug Info:</Text>
                <Text style={styles.errorDetailsText}>{firebaseError}</Text>
              </View>
            )}
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app optimizations
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        
        // Hide navigation bar on Android for immersive experience
        if (Platform.OS === 'android') {
          try {
            await NavigationBar.setBackgroundColorAsync('transparent');
            await NavigationBar.setButtonStyleAsync('light');
            console.log('✅ Android navigation bar configured');
          } catch (navError) {
            console.warn('⚠️  Failed to configure navigation bar:', navError);
          }
        }

        // OPTIMIZATION: Preload anime data in background
        console.log('🚀 Starting background data preload...');
        preloadAnimeData().catch(error => {
          console.warn('⚠️  Background preload failed:', error);
        });
        
        console.log('✅ App initialization completed');
      } catch (error) {
        console.warn('⚠️  App initialization warning:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <ErrorBoundary>
      <FirebaseHealthCheck>
        <SafeAreaProvider>
          <PaperProvider theme={customDarkTheme}>
            <View style={[styles.container, { backgroundColor: customDarkTheme.colors.background }]}>
              <StatusBar style="light" backgroundColor="transparent" translucent />
              <AppNavigator />
            </View>
          </PaperProvider>
        </SafeAreaProvider>
      </FirebaseHealthCheck>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorDetails: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    maxHeight: 300,
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#CCCCCC',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#999999',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default App;
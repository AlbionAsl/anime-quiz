// App.tsx - PRODUCTION BUILD FIX WITH ERROR BOUNDARY

import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet, Alert, Text } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';
import { preloadAnimeData } from './src/utils/animeCacheUtils';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
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
    
    // In production, you might want to log this to a crash reporting service
    // Example: Crashlytics.recordError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            The app encountered an unexpected error. Please restart the app.
          </Text>
          {__DEV__ && (
            <Text style={styles.errorDetails}>
              {this.state.error?.message}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize app with proper error handling
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');

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
        <Text style={styles.errorTitle}>Initialization Failed</Text>
        <Text style={styles.errorText}>
          Failed to initialize the app: {initError}
        </Text>
        <Text style={styles.errorText}>
          Please check your internet connection and restart the app.
        </Text>
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
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
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
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'monospace',
  },
});

export default App;
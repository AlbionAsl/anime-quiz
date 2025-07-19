// App.tsx - OPTIMIZED VERSION

import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';
import { preloadAnimeData } from './src/utils/animeCacheUtils';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app optimizations
    const initializeApp = async () => {
      try {
        // Hide navigation bar on Android
        if (Platform.OS === 'android') {
          await NavigationBar.setVisibilityAsync('hidden');
        }

        // OPTIMIZATION: Preload anime data in background
        // This helps reduce loading time when user reaches PlayScreen
        console.log('🚀 Starting background data preload...');
        preloadAnimeData().catch(error => {
          console.warn('⚠️  Background preload failed:', error);
        });
        
      } catch (error) {
        console.warn('⚠️  App initialization warning:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <PaperProvider theme={customDarkTheme}>
      {/* OPTIMIZATION: Ensure consistent background from the start */}
      <View style={[styles.container, { backgroundColor: customDarkTheme.colors.background }]}>
        <StatusBar style="light" hidden={true} />
        <AppNavigator />
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
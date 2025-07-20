// App.tsx - SAFE AREA OPTIMIZED VERSION

import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';
import { preloadAnimeData } from './src/utils/animeCacheUtils';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app optimizations
    const initializeApp = async () => {
      try {
        // Hide navigation bar on Android for immersive experience
        if (Platform.OS === 'android') {
          // Set navigation bar to be translucent
          await NavigationBar.setBackgroundColorAsync('transparent');
          await NavigationBar.setButtonStyleAsync('light');
        }

        // OPTIMIZATION: Preload anime data in background
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
    <SafeAreaProvider>
      <PaperProvider theme={customDarkTheme}>
        {/* OPTIMIZATION: Ensure consistent background from the start */}
        <View style={[styles.container, { backgroundColor: customDarkTheme.colors.background }]}>
          <StatusBar style="light" backgroundColor="transparent" translucent />
          <AppNavigator />
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
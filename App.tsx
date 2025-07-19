// App.tsx

import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';

const App: React.FC = () => {
  useEffect(() => {
    // Hide navigation bar on Android
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  return (
    <PaperProvider theme={customDarkTheme}>
      <StatusBar style="light" hidden={true} />
      <AppNavigator />
    </PaperProvider>
  );
};

export default App;
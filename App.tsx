// App.tsx

import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import customDarkTheme from './src/themes/theme';

const App: React.FC = () => {
  return (
    <PaperProvider theme={customDarkTheme}>
      <StatusBar style="light" backgroundColor={customDarkTheme.colors.surface} />
      <AppNavigator />
    </PaperProvider>
  );
};

export default App;
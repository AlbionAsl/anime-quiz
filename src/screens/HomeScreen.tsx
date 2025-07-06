// src/screens/HomeScreen.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, Surface, useTheme } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';

type HomeScreenProps = {
  navigation?: any;
};

const HomeScreen: React.FC<HomeScreenProps> = () => {
  const theme = useTheme();
  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 24,
      justifyContent: 'center',
    },
    surface: {
      padding: 24,
      borderRadius: 16,
      elevation: 4,
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 24,
      textAlign: 'center',
    },
    email: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 32,
      textAlign: 'center',
    },
    signOutButton: {
      paddingVertical: 8,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
  });

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>You're successfully logged in</Text>
        <Text style={styles.email}>{user?.email}</Text>
        
        <Button
          mode="contained"
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          Sign Out
        </Button>
      </Surface>
    </View>
  );
};

export default HomeScreen;
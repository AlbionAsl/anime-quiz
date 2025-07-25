// src/navigation/AppNavigator.tsx - OPTIMIZED VERSION

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme, Text, Button, Surface } from 'react-native-paper';
import { onAuthStateChanged, User, sendEmailVerification, reload } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../utils/firebase';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import UserCreationScreen from '../screens/UserCreationScreen';
import MainTabNavigator from './MainTabNavigator';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  UserCreation: undefined;
  MainTabs: undefined;
  EmailVerification: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// OPTIMIZED: Email Verification Screen with consistent theming
const EmailVerificationScreen: React.FC<{ user: User }> = ({ user }) => {
  const theme = useTheme();
  const [resending, setResending] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  const checkEmailVerification = async () => {
    setCheckingVerification(true);
    try {
      await reload(user);
      if (user.emailVerified) {
        auth.currentUser?.reload();
      }
    } catch (error) {
      console.error('Error checking verification:', error);
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    try {
      await sendEmailVerification(user);
      alert('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.verificationSurface} elevation={2}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification email to:
        </Text>
        <Text style={[styles.email, { color: theme.colors.primary }]}>
          {user.email}
        </Text>
        <Text style={styles.description}>
          Please check your inbox and click the verification link to activate your account.
        </Text>
        
        <Button
          mode="contained"
          onPress={checkEmailVerification}
          style={styles.button}
          disabled={checkingVerification}
        >
          {checkingVerification ? 'Checking...' : "I've Verified My Email"}
        </Button>
        
        <Button
          mode="outlined"
          onPress={handleResendEmail}
          style={styles.button}
          disabled={resending}
        >
          {resending ? 'Sending...' : 'Resend Verification Email'}
        </Button>
        
        <Button
          mode="text"
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          Sign Out
        </Button>
      </Surface>
    </View>
  );
};

// OPTIMIZED: Enhanced loading screen with better theming
const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
        {message}
      </Text>
    </View>
  );
};

const AppNavigator: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let isComponentMounted = true; // Prevent state updates after unmount

    console.log('🔧 Setting up auth state listener...');

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Prevent updates if component unmounted
      if (!isComponentMounted) return;
      
      console.log('🔐 Auth state changed:', currentUser ? `User logged in (${currentUser.uid})` : 'User logged out');
      
      setAuthChecked(true); // Mark that we've checked auth at least once
      
      if (currentUser) {
        console.log('📧 Email verified:', currentUser.emailVerified);
        
        // Only proceed if email is verified
        if (!currentUser.emailVerified) {
          console.log('❌ Email not verified, signing out user');
          await auth.signOut();
          return;
        }
        
        // FIXED: Only update user state if it's actually different
        if (!user || user.uid !== currentUser.uid) {
          setUser(currentUser);
          setProfileLoading(true);
          
          // Clean up previous profile listener
          if (profileUnsubscribe) {
            profileUnsubscribe();
          }
          
          // Listen for real-time updates to user profile
          const userDocRef = doc(firestore, 'users', currentUser.uid);
          console.log('👤 Setting up profile listener for user:', currentUser.uid);
          
          profileUnsubscribe = onSnapshot(
            userDocRef,
            (docSnap) => {
              // Prevent updates if component unmounted
              if (!isComponentMounted) return;
              
              const profileExists = docSnap.exists();
              console.log('📄 Profile exists:', profileExists);
              
              // FIXED: Only update if state actually changed
              if (hasProfile !== profileExists) {
                if (profileExists) {
                  console.log('✅ User profile found, navigating to main app');
                } else {
                  console.log('🆕 No profile found, showing user creation screen');
                }
                
                setHasProfile(profileExists);
              }
              
              setProfileLoading(false);
              setLoading(false);
            },
            (error) => {
              if (!isComponentMounted) return;
              
              console.error('❌ Error listening to user profile:', error);
              setHasProfile(false);
              setProfileLoading(false);
              setLoading(false);
            }
          );
        } else {
          // User is the same, just update loading states
          setProfileLoading(false);
          setLoading(false);
        }
      } else {
        console.log('🚪 No user found, showing login screen');
        setUser(null);
        setHasProfile(false);
        setProfileLoading(false);
        setLoading(false);
        
        // Clean up profile listener when user signs out
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth listeners');
      isComponentMounted = false; // Prevent further state updates
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []); // FIXED: Remove dependencies that cause re-renders


  // OPTIMIZED: Show loading only when actually needed and with consistent theme
  if (loading || !authChecked || (user && profileLoading)) {
    let loadingMessage = 'Loading...';
    if (!authChecked) {
      loadingMessage = 'Checking authentication...';
    } else if (user && profileLoading) {
      loadingMessage = 'Loading profile...';
    }
    
    console.log('Showing loading screen:', loadingMessage);
    return <LoadingScreen message={loadingMessage} />;
  }

  console.log('Rendering navigation with state:', {
    hasUser: !!user,
    hasProfile,
    loading,
    profileLoading,
    authChecked
  });

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {user ? (
          hasProfile ? (
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          ) : (
            <Stack.Screen name="UserCreation" component={UserCreationScreen} />
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  verificationSurface: {
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  email: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  button: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 8,
  },
  signOutButton: {
    marginTop: 8,
  },
});

export default AppNavigator;
// src/navigation/AppNavigator.tsx

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

// Email Verification Screen Component
const EmailVerificationScreen: React.FC<{ user: User }> = ({ user }) => {
  const theme = useTheme();
  const [resending, setResending] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  const checkEmailVerification = async () => {
    setCheckingVerification(true);
    try {
      await reload(user);
      if (user.emailVerified) {
        // User is verified, the auth state listener will handle navigation
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
        <Text style={styles.email}>{user.email}</Text>
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

const AppNavigator: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    console.log('🔧 Setting up auth state listener...');

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🔐 Auth state changed:', currentUser ? `User logged in (${currentUser.uid})` : 'User logged out');
      
      if (currentUser) {
        console.log('📧 Email verified:', currentUser.emailVerified);
        console.log('💾 Auth persistence working: User found on app restart');
        
        // Only proceed if email is verified
        if (!currentUser.emailVerified) {
          console.log('❌ Email not verified, signing out user');
          await auth.signOut();
          return;
        }
        
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
            const profileExists = docSnap.exists();
            console.log('📄 Profile exists:', profileExists);
            
            if (profileExists) {
              console.log('✅ User profile found, navigating to main app');
            } else {
              console.log('🆕 No profile found, showing user creation screen');
            }
            
            setHasProfile(profileExists);
            setProfileLoading(false);
            setLoading(false);
          },
          (error) => {
            console.error('❌ Error listening to user profile:', error);
            setHasProfile(false);
            setProfileLoading(false);
            setLoading(false);
          }
        );
      } else {
        console.log('🚪 No user found, showing login screen');
        console.log('⚠️  Auth persistence may not be working if this appears on app restart');
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
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  if (loading || (user && profileLoading)) {
    console.log('Showing loading screen');
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  console.log('Rendering navigation with state:', {
    hasUser: !!user,
    hasProfile,
    loading,
    profileLoading
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
    color: '#6C5CE7',
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
// src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  Surface,
  useTheme,
  IconButton,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../utils/firebase';

type LoginScreenProps = {
  navigation: any;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will be handled by the auth state listener
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    Alert.alert('Coming Soon', 'Google sign-in will be implemented soon!');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    surface: {
      padding: 24,
      borderRadius: 16,
      marginBottom: 24,
      elevation: 4,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: 32,
    },
    socialButtonsContainer: {
      gap: 16,
      marginBottom: 24,
    },
    socialButton: {
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    socialButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    socialButtonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
      gap: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outline,
    },
    dividerText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    emailContainer: {
      gap: 16,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
    },
    passwordContainer: {
      position: 'relative',
    },
    loginButton: {
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    backButton: {
      alignSelf: 'center',
      marginTop: 16,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      gap: 4,
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    registerLink: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.surface}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {!showEmailLogin ? (
            <>
              <View style={styles.socialButtonsContainer}>
                <Button
                  mode="outlined"
                  style={styles.socialButton}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                >
                  <View style={styles.socialButtonContent}>
                    <Text style={styles.socialButtonText}>Continue with Google</Text>
                  </View>
                </Button>

                <Button
                  mode="outlined"
                  style={styles.socialButton}
                  onPress={() => setShowEmailLogin(true)}
                  disabled={loading}
                >
                  <View style={styles.socialButtonContent}>
                    <Text style={styles.socialButtonText}>Continue with Email</Text>
                  </View>
                </Button>
              </View>
            </>
          ) : (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Email Login</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.emailContainer}>
                <TextInput
                  mode="outlined"
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                  disabled={loading}
                />

                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="outlined"
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    style={styles.textInput}
                    disabled={loading}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                </View>

                <Button
                  mode="contained"
                  onPress={handleEmailLogin}
                  style={styles.loginButton}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                      <Text style={{ color: theme.colors.onPrimary }}>Signing in...</Text>
                    </View>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <Button
                  mode="text"
                  onPress={() => setShowEmailLogin(false)}
                  style={styles.backButton}
                  disabled={loading}
                >
                  Back to options
                </Button>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
            >
              <Text style={styles.registerLink}>Sign up</Text>
            </Button>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
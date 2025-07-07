// src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  Dialog,
  Portal,
} from 'react-native-paper';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
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
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please fill in all fields to continue.');
      setShowErrorDialog(true);
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        // Sign out the user if email is not verified
        await auth.signOut();
        setShowVerificationDialog(true);
        setLoading(false);
        return;
      }
      
      // If email is verified, navigation will be handled by the auth state listener
    } catch (error: any) {
      setLoading(false);
      
      // Handle specific error cases with user-friendly messages
      let title = 'Login Failed';
      let message = 'An error occurred during login. Please try again.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          title = 'Invalid Email';
          message = 'The email address is not valid. Please check and try again.';
          break;
        case 'auth/user-disabled':
          title = 'Account Disabled';
          message = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/user-not-found':
          title = 'Account Not Found';
          message = 'No account found with this email address. Please check your email or create a new account.';
          break;
        case 'auth/wrong-password':
          title = 'Incorrect Password';
          message = 'The password is incorrect. Please try again.';
          break;
        case 'auth/invalid-credential':
          title = 'Invalid Credentials';
          message = 'The email or password is incorrect. Please check and try again.';
          break;
        case 'auth/too-many-requests':
          title = 'Too Many Attempts';
          message = 'Too many failed login attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          title = 'Network Error';
          message = 'Please check your internet connection and try again.';
          break;
        default:
          if (error.message) {
            message = error.message;
          }
      }
      
      setErrorTitle(title);
      setErrorMessage(message);
      setShowErrorDialog(true);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      // Sign in again to get the user object
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Send verification email
      await sendEmailVerification(userCredential.user);
      
      // Sign out again
      await auth.signOut();
      
      setErrorTitle('Email Sent');
      setErrorMessage('Verification email sent successfully! Please check your inbox.');
      setShowErrorDialog(true);
    } catch (error: any) {
      let message = 'Failed to send verification email. Please try again.';
      
      if (error.code === 'auth/too-many-requests') {
        message = 'Too many requests. Please try again later.';
      }
      
      setErrorTitle('Email Not Sent');
      setErrorMessage(message);
      setShowErrorDialog(true);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorTitle('Coming Soon');
    setErrorMessage('Google sign-in will be implemented soon!');
    setShowErrorDialog(true);
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
    dialogContent: {
      paddingTop: 10,
    },
    dialogText: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 10,
    },
    dialogEmail: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
      marginVertical: 10,
    },
    resendButton: {
      marginTop: 10,
    },
    dialogTitle: {
      textAlign: 'center',
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

      <Portal>
        <Dialog 
          visible={showVerificationDialog} 
          onDismiss={() => setShowVerificationDialog(false)}
          dismissable={false}
        >
          <Dialog.Title>Email Not Verified</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogText}>
              Your email address has not been verified yet.
            </Text>
            <Text style={styles.dialogEmail}>{email}</Text>
            <Text style={styles.dialogText}>
              Please check your inbox and click the verification link to activate your account.
            </Text>
            <Button
              mode="contained"
              onPress={handleResendVerification}
              style={styles.resendButton}
              disabled={resendingEmail}
            >
              {resendingEmail ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                  <Text style={{ color: theme.colors.onPrimary }}>Sending...</Text>
                </View>
              ) : (
                'Resend Verification Email'
              )}
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowVerificationDialog(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showErrorDialog}
          onDismiss={() => setShowErrorDialog(false)}
          dismissable={false}
        >
          <Dialog.Icon icon="alert-circle" size={48} />
          <Dialog.Title style={styles.dialogTitle}>{errorTitle}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>{errorMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowErrorDialog(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
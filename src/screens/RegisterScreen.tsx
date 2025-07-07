// src/screens/RegisterScreen.tsx

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
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../utils/firebase';

type RegisterScreenProps = {
  navigation: any;
};

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmailRegister, setShowEmailRegister] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingSignOut, setPendingSignOut] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please fill in all fields to continue.');
      setShowErrorDialog(true);
      return;
    }

    if (!validateEmail(email)) {
      setErrorTitle('Invalid Email');
      setErrorMessage('Please enter a valid email address.');
      setShowErrorDialog(true);
      return;
    }

    if (password.length < 6) {
      setErrorTitle('Weak Password');
      setErrorMessage('Password must be at least 6 characters long.');
      setShowErrorDialog(true);
      return;
    }

    if (password !== confirmPassword) {
      setErrorTitle('Password Mismatch');
      setErrorMessage('The passwords you entered do not match. Please try again.');
      setShowErrorDialog(true);
      return;
    }

    setLoading(true);
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      
      // Mark that we need to sign out after dialog is dismissed
      setPendingSignOut(true);
      
      // Show verification dialog (don't sign out yet!)
      setShowVerificationDialog(true);
      
    } catch (error: any) {
      let title = 'Registration Failed';
      let message = 'An error occurred during registration. Please try again.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          title = 'Email Already Registered';
          message = 'This email is already associated with an account. Please sign in or use a different email.';
          break;
        case 'auth/invalid-email':
          title = 'Invalid Email';
          message = 'The email address is not valid. Please check and try again.';
          break;
        case 'auth/operation-not-allowed':
          title = 'Registration Disabled';
          message = 'Email/password accounts are not enabled. Please contact support.';
          break;
        case 'auth/weak-password':
          title = 'Weak Password';
          message = 'The password is too weak. Please use a stronger password.';
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
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setErrorTitle('Coming Soon');
    setErrorMessage('Google sign-up will be implemented soon!');
    setShowErrorDialog(true);
  };

  const handleVerificationDialogDismiss = async () => {
    setShowVerificationDialog(false);
    
    // Sign out the user after they acknowledge the dialog
    if (pendingSignOut) {
      try {
        await auth.signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }
    
    // Clear form fields
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowEmailRegister(false);
    setPendingSignOut(false);
    
    // Navigation will be handled by auth state listener after sign out
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
    registerButton: {
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
    loginLink: {
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          {!showEmailRegister ? (
            <>
              <View style={styles.socialButtonsContainer}>
                <Button
                  mode="outlined"
                  style={styles.socialButton}
                  onPress={handleGoogleRegister}
                  disabled={loading}
                >
                  <View style={styles.socialButtonContent}>
                    <Text style={styles.socialButtonText}>Continue with Google</Text>
                  </View>
                </Button>

                <Button
                  mode="outlined"
                  style={styles.socialButton}
                  onPress={() => setShowEmailRegister(true)}
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
                <Text style={styles.dividerText}>Email Registration</Text>
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

                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="outlined"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    style={styles.textInput}
                    disabled={loading}
                    right={
                      <TextInput.Icon
                        icon={showConfirmPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    }
                  />
                </View>

                <Button
                  mode="contained"
                  onPress={handleEmailRegister}
                  style={styles.registerButton}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                      <Text style={{ color: theme.colors.onPrimary }}>Creating account...</Text>
                    </View>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <Button
                  mode="text"
                  onPress={() => setShowEmailRegister(false)}
                  style={styles.backButton}
                  disabled={loading}
                >
                  Back to options
                </Button>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.loginLink}>Sign in</Text>
            </Button>
          </View>
        </Surface>
      </ScrollView>

      <Portal>
        <Dialog visible={showVerificationDialog} dismissable={false}>
          <Dialog.Title>Verify Your Email</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogText}>
              We've sent a verification email to:
            </Text>
            <Text style={styles.dialogEmail}>{email}</Text>
            <Text style={styles.dialogText}>
              Please check your inbox and click the verification link to activate your account.
            </Text>
            <Text style={styles.dialogText}>
              Once verified, you can log in with your credentials.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleVerificationDialogDismiss}>OK</Button>
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

export default RegisterScreen;
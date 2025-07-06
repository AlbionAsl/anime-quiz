// src/screens/UserCreationScreen.tsx

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
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { doc, setDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { auth, firestore } from '../utils/firebase';

type UserCreationScreenProps = {
  navigation: any;
};

const UserCreationScreen: React.FC<UserCreationScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);

  const validateUsername = (username: string) => {
    const regex = /^[a-zA-Z0-9_]+$/;
    if (!username) {
      return 'Username is required';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (username.length > 20) {
      return 'Username must be less than 20 characters';
    }
    if (!regex.test(username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return '';
  };

  const checkUsernameAvailability = async (username: string) => {
    setCheckingUsername(true);
    try {
      const q = query(
        collection(firestore, 'users'),
        where('username', '==', username)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = async (text: string) => {
    setUsername(text);
    const validationError = validateUsername(text);
    
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    // Check availability after validation passes
    const isAvailable = await checkUsernameAvailability(text);
    if (!isAvailable) {
      setUsernameError('Username is already taken');
    } else {
      setUsernameError('');
    }
  };

  const handleCreateProfile = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    if (usernameError) {
      Alert.alert('Error', usernameError);
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Double-check username availability
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        setUsernameError('Username is already taken');
        setLoading(false);
        return;
      }

      // Create user profile
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        username: username,
        email: user.email,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Profile created successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
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
      lineHeight: 24,
    },
    inputContainer: {
      marginBottom: 24,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 12,
      marginTop: 4,
    },
    createButton: {
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 16,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    usernameContainer: {
      position: 'relative',
    },
    checkingIndicator: {
      position: 'absolute',
      right: 16,
      top: 20,
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
          <Text style={styles.title}>Complete Setup</Text>
          <Text style={styles.subtitle}>
            Choose a unique username
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.usernameContainer}>
              <TextInput
                mode="outlined"
                label="Username"
                value={username}
                onChangeText={handleUsernameChange}
                style={styles.textInput}
                disabled={loading}
                error={!!usernameError}
                autoCapitalize="none"
                placeholder="Enter your username"
              />
              {checkingUsername && (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  style={styles.checkingIndicator}
                />
              )}
            </View>
            
            <HelperText 
              type={usernameError ? 'error' : 'info'} 
              visible={!!usernameError || !usernameError && username.length > 0}
              style={styles.helperText}
            >
              {usernameError || 'Username can contain letters, numbers, and underscores'}
            </HelperText>
          </View>

          <Button
            mode="contained"
            onPress={handleCreateProfile}
            style={styles.createButton}
            disabled={loading || !!usernameError || !username || checkingUsername}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                <Text style={{ color: theme.colors.onPrimary }}>Creating profile...</Text>
              </View>
            ) : (
              'Complete Setup'
            )}
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default UserCreationScreen;
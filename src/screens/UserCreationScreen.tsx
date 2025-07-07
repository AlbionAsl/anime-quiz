// src/screens/UserCreationScreen.tsx

import React, { useState, useEffect } from 'react';
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
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);

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

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (username.length >= 3) {
        const validationError = validateUsername(username);
        
        if (validationError) {
          setUsernameError(validationError);
          setIsUsernameAvailable(null);
          return;
        }

        setCheckingUsername(true);
        const isAvailable = await checkUsernameAvailability(username);
        setCheckingUsername(false);
        
        if (!isAvailable) {
          setUsernameError('Username is already taken');
          setIsUsernameAvailable(false);
        } else {
          setUsernameError('');
          setIsUsernameAvailable(true);
        }
      } else if (username.length > 0) {
        setUsernameError(validateUsername(username));
        setIsUsernameAvailable(null);
      } else {
        setUsernameError('');
        setIsUsernameAvailable(null);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleCreateProfile = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    if (!isUsernameAvailable) {
      Alert.alert('Error', 'Username is not available');
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
        setIsUsernameAvailable(false);
        setLoading(false);
        return;
      }

      // Create user profile with lowercase username for uniqueness
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        username: username.toLowerCase(), // Store username in lowercase
        displayUsername: username, // Store original case for display
        email: user.email,
        createdAt: new Date().toISOString(),
        totalQuizzes: 0,
        totalCorrectAnswers: 0,
        stats: {
          allTime: {
            totalQuizzes: 0,
            totalCorrectAnswers: 0,
            averageScore: 0
          },
          categories: {}
        }
      });

      // Navigation will be handled by the auth state listener in AppNavigator
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  const getHelperText = () => {
    if (checkingUsername) {
      return 'Checking availability...';
    }
    if (usernameError) {
      return usernameError;
    }
    if (isUsernameAvailable === true && username.length >= 3) {
      return 'Username is available!';
    }
    if (username.length === 0) {
      return 'Username can contain letters, numbers, and underscores';
    }
    return '';
  };

  const getHelperTextType = () => {
    if (usernameError) return 'error';
    if (isUsernameAvailable === true && username.length >= 3) return 'info';
    return 'info';
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
    availableIcon: {
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
                onChangeText={setUsername}
                style={styles.textInput}
                disabled={loading}
                error={!!usernameError}
                autoCapitalize="none"
                placeholder="Enter your username"
                right={
                  checkingUsername ? (
                    <TextInput.Icon
                      icon={() => (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.primary}
                        />
                      )}
                    />
                  ) : isUsernameAvailable === true && username.length >= 3 ? (
                    <TextInput.Icon
                      icon="check-circle"
                      color={theme.colors.primary}
                    />
                  ) : isUsernameAvailable === false ? (
                    <TextInput.Icon
                      icon="close-circle"
                      color={theme.colors.error}
                    />
                  ) : null
                }
              />
            </View>
            
            <HelperText 
              type={getHelperTextType()} 
              visible={true}
              style={[
                styles.helperText,
                isUsernameAvailable === true && username.length >= 3 && { color: theme.colors.primary }
              ]}
            >
              {getHelperText()}
            </HelperText>
          </View>

          <Button
            mode="contained"
            onPress={handleCreateProfile}
            style={styles.createButton}
            disabled={loading || !!usernameError || !username || checkingUsername || !isUsernameAvailable}
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
// src/screens/QuizScreen.tsx - RANKED QUIZ NO EXIT VERSION

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  BackHandler,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
  ProgressBar,
  Dialog,
  Portal,
  IconButton,
  Chip,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PlayStackParamList } from '../navigation/PlayNavigator';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { firestore, auth } from '../utils/firebase';
import { getDailyQuestions, getUTCDateString } from '../utils/quizUtils';
import { updateRankings } from '../utils/rankingUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type QuizScreenRouteProp = RouteProp<PlayStackParamList, 'Quiz'>;
type QuizScreenNavigationProp = StackNavigationProp<PlayStackParamList, 'Quiz'>;

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  animeId?: number;
  animeName?: string;
  likes?: number;
  dislikes?: number;
}

interface Answer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
}

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 380;

// Timer constants
const QUESTION_TIME_LIMIT = 10; // 10 seconds per question
const FEEDBACK_DISPLAY_TIME = 3000; // 3 seconds to show feedback (increased for voting)

const QuizScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<QuizScreenRouteProp>();
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const { animeId, animeName, date, isPractice = false } = route.params;

  // Existing state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  
  // Like/Dislike state
  const [hasVoted, setHasVoted] = useState(false);
  const [voteType, setVoteType] = useState<'like' | 'dislike' | null>(null);
  
  // NEW: Auto-submit state for ranked quizzes
  const [quizAbandoned, setQuizAbandoned] = useState(false);
  
  // Timer refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerProgress = useRef(new Animated.Value(0)).current;
  
  // NEW: App state ref for tracking
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Determine if this is today's quiz
  const todayDate = getUTCDateString();
  const isToday = !date || date === todayDate;
  const actualIsPractice = isPractice || !isToday;

  // Timer effect
  useEffect(() => {
    if (timerActive && timeLeft > 0 && !showFeedback && !isTimeUp) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Time's up!
            setIsTimeUp(true);
            setTimerActive(false);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeLeft, timerActive, showFeedback, isTimeUp]);

  const getQuizModeIcon = () => {
    return actualIsPractice ? 'school' : 'trophy';
  };

  // Timer progress animation
  useEffect(() => {
    const progress = 1 - (timeLeft / QUESTION_TIME_LIMIT);
    Animated.timing(timerProgress, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, timerProgress]);

  // Reset timer when question changes
  useEffect(() => {
    if (questions.length > 0 && !showResults) {
      resetTimer();
      // CRITICAL: Immediately reset vote state when question changes
      setHasVoted(false);
      setVoteType(null);
    }
  }, [currentQuestionIndex, questions.length, showResults]);

  // NEW: App State Monitoring for Ranked Quizzes
  useEffect(() => {
    if (actualIsPractice || showResults || quizAbandoned) {
      // Don't monitor app state for practice quizzes or completed quizzes
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('🔄 App state changed:', appStateRef.current, '->', nextAppState);
      
      // If app goes to background or inactive during ranked quiz
      if (
        appStateRef.current === 'active' && 
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        console.log('❌ User left app during ranked quiz - auto-submitting with 0/10');
        handleAbandonQuiz('App went to background');
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    appStateRef.current = AppState.currentState;

    return () => {
      subscription?.remove();
    };
  }, [actualIsPractice, showResults, quizAbandoned, answers.length, questions.length]);

  // NEW: Navigation Prevention for Ranked Quizzes
  useFocusEffect(
    React.useCallback(() => {
      if (actualIsPractice || showResults || quizAbandoned) {
        // Don't prevent navigation for practice quizzes
        return;
      }

      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // Prevent default behavior of leaving the screen
        e.preventDefault();
        
        console.log('❌ User tried to navigate away from ranked quiz - auto-submitting with 0/10');
        handleAbandonQuiz('Navigation away from quiz');
      });

      return unsubscribe;
    }, [navigation, actualIsPractice, showResults, quizAbandoned, answers.length, questions.length])
  );

  // Main useEffect for fetching questions and handling back button
  useEffect(() => {
    fetchQuestions();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showResults) {
        // Allow back navigation after quiz is complete
        return false;
      }
      
      if (actualIsPractice) {
        // For practice quizzes, show exit dialog as before
        setShowExitDialog(true);
        return true;
      } else {
        // For ranked quizzes, prevent back navigation and auto-submit
        console.log('❌ User pressed back button during ranked quiz - auto-submitting with 0/10');
        handleAbandonQuiz('Hardware back button pressed');
        return true;
      }
    });

    return () => {
      backHandler.remove();
      cleanupTimer();
    };
  }, [showResults, actualIsPractice, quizAbandoned]);

  // NEW: Handle quiz abandonment for ranked quizzes
  const handleAbandonQuiz = async (reason: string) => {
    if (quizAbandoned || showResults || actualIsPractice || questions.length === 0) {
      // Already handled, is practice quiz, or questions not loaded yet
      return;
    }

    console.log(`🚨 Quiz abandoned: ${reason}`);
    setQuizAbandoned(true);
    cleanupTimer();

    try {
      // Create answers array with all remaining questions as incorrect
      const abandonedAnswers: Answer[] = [...answers];
      
      // Fill in remaining questions as incorrect (always ensure we have 10 total)
      const totalQuestions = 10; // Always 10 questions per quiz
      for (let i = answers.length; i < totalQuestions; i++) {
        // For questions beyond available questions array, create dummy incorrect answers
        abandonedAnswers.push({
          questionId: questions[i]?.id || `question_${i}`,
          selectedOption: -1, // -1 indicates abandoned/no answer
          isCorrect: false,
        });
      }

      // Submit with score of existing correct answers
      await submitQuiz(abandonedAnswers, true);
      
    } catch (error) {
      console.error('Error submitting abandoned quiz:', error);
      // Even if submission fails, navigate away
      navigation.goBack();
    }
  };

  const resetTimer = () => {
    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsTimeUp(false);
    setTimerActive(true);
    timerProgress.setValue(0);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const cleanupTimer = () => {
    setTimerActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTimeUp = () => {
    console.log('⏰ Time is up for question', currentQuestionIndex + 1);
    
    // Record the answer as incorrect (no selection)
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: -1, // -1 indicates no answer due to timeout
      isCorrect: false,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setShowFeedback(true);

    // Auto-advance to next question after showing feedback
    setTimeout(() => {
      // Clear vote state BEFORE advancing to prevent visual bleed-through
      setHasVoted(false);
      setVoteType(null);
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setShowFeedback(false);
      } else {
        // Last question - submit quiz
        submitQuiz(updatedAnswers);
      }
    }, FEEDBACK_DISPLAY_TIME);
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      
      let dailyQuestions: Question[];
      
      if (date && date !== todayDate) {
        // Fetch questions for specific date
        dailyQuestions = await getQuestionsForDate(animeId, date);
      } else {
        // Use the existing getDailyQuestions for today
        dailyQuestions = await getDailyQuestions(animeId, 10);
      }

      if (dailyQuestions.length === 0) {
        setError('No questions available for this category and date');
        setLoading(false);
        return;
      }

      setQuestions(dailyQuestions);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setError('Failed to load questions. Please try again.');
      setLoading(false);
    }
  };

  const getQuestionsForDate = async (animeId: number | null, targetDate: string): Promise<Question[]> => {
    try {
      const category = animeId === null ? 'all' : animeId.toString();
      const dailyQuestionId = `${targetDate}_${category}`;

      const dailyQuestionDoc = await getDoc(
        doc(firestore, 'dailyQuestions', dailyQuestionId)
      );

      if (dailyQuestionDoc.exists()) {
        const data = dailyQuestionDoc.data();
        return data.questions || [];
      }

      console.warn(`No questions found for ${category} on ${targetDate}`);
      return [];
    } catch (error) {
      console.error('Error fetching questions for date:', error);
      return [];
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    // Prevent selection if time is up or feedback is already showing
    if (selectedOption !== null || showFeedback || isTimeUp) return;

    console.log('🎯 Option selected:', optionIndex);
    
    // Stop the timer
    cleanupTimer();
    
    setSelectedOption(optionIndex);
    setShowFeedback(true);

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = optionIndex === currentQuestion.correctAnswer;

    // Record the answer
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex,
      isCorrect,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    // Auto-advance after showing feedback
    setTimeout(() => {
      // Clear vote state BEFORE advancing to prevent visual bleed-through
      setHasVoted(false);
      setVoteType(null);
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setShowFeedback(false);
      } else {
        // Last question - submit quiz
        submitQuiz(updatedAnswers);
      }
    }, FEEDBACK_DISPLAY_TIME);
  };

  // UPDATED: Submit quiz function with abandon flag
  const submitQuiz = async (finalAnswers: Answer[], isAbandoned: boolean = false) => {
    setSubmitting(true);
    cleanupTimer(); // Make sure timer is stopped
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const score = finalAnswers.filter(a => a.isCorrect).length;
      const totalQuestions = 10; // Always 10 questions per quiz
      
      const category = animeId === null ? 'all' : animeId.toString();
      const quizDate = date || todayDate;

      console.log(`📊 Submitting quiz - Score: ${score}/${totalQuestions}, Abandoned: ${isAbandoned}`);

      // Save quiz attempt
      await addDoc(collection(firestore, 'dailyQuizzes'), {
        userId: user.uid,
        date: quizDate,
        category,
        animeName,
        score,
        totalQuestions: totalQuestions, // Always 10
        completedAt: new Date(),
        answers: finalAnswers,
        isPractice: actualIsPractice,
        abandoned: isAbandoned, // Track if quiz was abandoned (only add field if true)
      });

      // Only update user statistics and rankings if it's not practice mode
      if (!actualIsPractice) {
        // Update user statistics
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
          totalQuizzes: increment(1),
          totalCorrectAnswers: increment(score),
          [`categoryScores.${category}`]: increment(score),
        });

        // Update rankings only for non-practice quizzes
        await updateRankings(user.uid, category, score, totalQuestions);
      }

      if (isAbandoned) {
        // Navigate back immediately for abandoned quizzes
        navigation.goBack();
      } else {
        // Show results for completed quizzes
        setShowResults(true);
      }
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      if (isAbandoned) {
        // Even if there's an error, navigate back for abandoned quizzes
        navigation.goBack();
      } else {
        setError('Failed to submit quiz. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // UPDATED: Handle exit - only for practice quizzes
  const handleExit = () => {
    cleanupTimer();
    setShowExitDialog(false);
    navigation.goBack();
  };

  const getQuizModeText = () => {
    if (actualIsPractice) {
      return isToday ? 'Practice Mode' : `Practice - ${date}`;
    }
    return 'Ranked Quiz';
  };

  const handleLikeDislike = async (type: 'like' | 'dislike') => {
    if (hasVoted) return;
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      const questionRef = doc(firestore, 'questions', currentQuestion.id);
      
      // Update the field in Firebase
      const fieldToUpdate = type === 'like' ? 'likes' : 'dislikes';
      await updateDoc(questionRef, {
        [fieldToUpdate]: increment(1)
      });
      
      // Update local state
      setHasVoted(true);
      setVoteType(type);
      
      // Update the local question data for immediate UI feedback
      const updatedQuestions = [...questions];
      const currentQ = updatedQuestions[currentQuestionIndex];
      if (type === 'like') {
        currentQ.likes = (currentQ.likes || 0) + 1;
      } else {
        currentQ.dislikes = (currentQ.dislikes || 0) + 1;
      }
      setQuestions(updatedQuestions);
      
      console.log(`👍 ${type} recorded for question:`, currentQuestion.id);
      
    } catch (error) {
      console.error(`Error recording ${type}:`, error);
    }
  };

  const renderLikeDislikeButtons = () => {
    if (!showFeedback) return null;
    
    const currentQuestion = questions[currentQuestionIndex];
    const likes = currentQuestion.likes || 0;
    const dislikes = currentQuestion.dislikes || 0;
    
    return (
      <View 
        key={`like-dislike-${currentQuestion.id}-${currentQuestionIndex}`}
        style={styles.likeDislikeContainer}
      >
        <Text style={[styles.feedbackPrompt, { color: theme.colors.onSurface }]}>
          How was this question?
        </Text>
        
        <View style={styles.likeDislikeButtons}>
          <Surface 
            style={[
              styles.likeButton,
              voteType === 'like' && hasVoted && styles.likeButtonActive,
              { backgroundColor: (voteType === 'like' && hasVoted) ? '#4CAF50' : theme.colors.surface }
            ]} 
            elevation={1}
          >
            <Button
              mode="text"
              onPress={() => handleLikeDislike('like')}
              disabled={hasVoted}
              style={styles.voteButton}
              labelStyle={[
                styles.voteButtonText,
                { color: (voteType === 'like' && hasVoted) ? 'white' : theme.colors.onSurface }
              ]}
            >
              <MaterialCommunityIcons 
                name="thumb-up" 
                size={20} 
                color={(voteType === 'like' && hasVoted) ? 'white' : theme.colors.onSurface}
              />
            </Button>
          </Surface>
          
          <Surface 
            style={[
              styles.dislikeButton,
              voteType === 'dislike' && hasVoted && styles.dislikeButtonActive,
              { backgroundColor: (voteType === 'dislike' && hasVoted) ? '#F44336' : theme.colors.surface }
            ]} 
            elevation={1}
          >
            <Button
              mode="text"
              onPress={() => handleLikeDislike('dislike')}
              disabled={hasVoted}
              style={styles.voteButton}
              labelStyle={[
                styles.voteButtonText,
                { color: (voteType === 'dislike' && hasVoted) ? 'white' : theme.colors.onSurface }
              ]}
            >
              <MaterialCommunityIcons 
                name="thumb-down" 
                size={20} 
                color={(voteType === 'dislike' && hasVoted) ? 'white' : theme.colors.onSurface}
              />
            </Button>
          </Surface>
        </View>
      </View>
    );
  };

  // Render timer bar
  const renderTimerBar = () => {
    const isRunning = timerActive && !showFeedback && !isTimeUp;
    const barColor = isTimeUp ? theme.colors.error : 
                   timeLeft <= 3 ? '#FF6B6B' : 
                   timeLeft <= 5 ? '#FFA500' : 
                   theme.colors.primary;

    return (
      <View style={styles.timerContainer}>
        <View style={styles.timerInfo}>
          <View style={styles.timerTextContainer}>
            {isTimeUp ? (
              <View style={styles.timeUpContainer}>
                <MaterialCommunityIcons 
                  name="clock-alert-outline" 
                  size={16} 
                  color={theme.colors.error} 
                />
                <Text style={[styles.timeUpText, { color: theme.colors.error }]}>
                  TIME UP!
                </Text>
              </View>
            ) : (
              <Text style={[
                styles.timerText, 
                { color: timeLeft <= 5 ? '#FF6B6B' : theme.colors.onSurface },
                timeLeft <= 3 && styles.urgentTimer
              ]}>
                {timeLeft}s
              </Text>
            )}
          </View>
        </View>
        
        <View style={[styles.timerBarBackground, { backgroundColor: theme.colors.outline }]}>
          <Animated.View
            style={[
              styles.timerBarFill,
              {
                backgroundColor: barColor,
                width: timerProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  if (showResults) {
    const score = answers.filter(a => a.isCorrect).length;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.resultsWrapper}>
          <Surface style={styles.resultsContainer} elevation={2}>
            <Text style={styles.resultTitle}>Quiz Complete!</Text>
            <Text style={styles.categoryText}>{animeName}</Text>
            
            <Chip 
              icon={getQuizModeIcon()}
              style={[
                styles.modeChip, 
                { backgroundColor: actualIsPractice ? theme.colors.secondary : theme.colors.primary }
              ]}
              textStyle={styles.modeChipText}
            >
              {getQuizModeText()}
            </Chip>
            
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreDivider}>/</Text>
              <Text style={styles.scoreTotal}>10</Text>
            </View>

            {actualIsPractice && (
              <Text style={styles.practiceNote}>
                Practice mode - No rankings or stats updated
              </Text>
            )}
            
            <Button
              mode="contained"
              onPress={() => {
                navigation.goBack();
              }}
              style={styles.finishButton}
            >
              Back to {animeName}
            </Button>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = (currentQuestionIndex + 1) / questions.length;

  if (submitting) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>
          {quizAbandoned ? 'Processing abandoned quiz...' : 'Submitting quiz...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        {/* UPDATED: Only show back button for practice quizzes */}
        {actualIsPractice ? (
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => setShowExitDialog(true)}
          />
        ) : (
          <View style={{ width: 48, height: 48 }} />
        )}
        
        <View style={styles.headerCenter}>
          <Text style={styles.questionCounter}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
          <Chip 
            icon={getQuizModeIcon()}
            style={[
              styles.headerModeChip, 
              { backgroundColor: actualIsPractice ? theme.colors.secondary : theme.colors.primary }
            ]}
            textStyle={styles.headerModeChipText}
          >
            {getQuizModeText()}
          </Chip>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <ProgressBar progress={progress} color={theme.colors.primary} style={styles.mainProgressBar} />

      {/* INFO: Info message for ranked quizzes */}
      {!actualIsPractice && (
        <Surface style={[styles.infoBanner, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
          <MaterialCommunityIcons
            name="information"
            size={16}
            color={theme.colors.primary}
          />
          <Text style={[styles.infoText, { color: theme.colors.primary }]}>
            Ranked Quiz: You cannot exit once started!
          </Text>
        </Surface>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.questionCard} elevation={2}>
          {currentQuestion.animeName && currentQuestion.animeName !== 'All Anime' && (
            <View style={styles.animeChipContainer}>
              <Chip 
                icon="gamepad-variant" 
                style={[styles.animeChip, { backgroundColor: theme.colors.primaryContainer }]}
                textStyle={styles.animeChipText}
              >
                {currentQuestion.animeName}
              </Chip>
            </View>
          )}
          
          <Text style={[styles.questionText, isSmallScreen && styles.questionTextSmall]}>
            {currentQuestion.question}
          </Text>
        </Surface>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showCorrect = showFeedback && isCorrect;
            const showIncorrect = showFeedback && isSelected && !isCorrect;
            const showCorrectWhenTimeUp = isTimeUp && isCorrect && !isSelected;

            return (
              <Surface
                key={index}
                style={[
                  styles.optionCard,
                  showCorrect && styles.correctOption,
                  showIncorrect && styles.incorrectOption,
                  showCorrectWhenTimeUp && styles.correctOption,
                ]}
                elevation={1}
              >
                <Button
                  mode="text"
                  onPress={() => handleSelectOption(index)}
                  style={styles.optionButton}
                  labelStyle={[
                    styles.optionText,
                    (showCorrect || showIncorrect || showCorrectWhenTimeUp) && styles.feedbackOptionText,
                    isSmallScreen && styles.optionTextSmall,
                  ]}
                  contentStyle={styles.optionContent}
                  disabled={showFeedback || submitting || isTimeUp}
                >
                  <View style={styles.optionContentWrapper}>
                    <Text style={[styles.optionLetter, isSmallScreen && styles.optionLetterSmall]}>
                      {String.fromCharCode(65 + index)}.
                    </Text>
                    <Text style={[styles.optionTextContent, isSmallScreen && styles.optionTextSmall]}>
                      {option}
                    </Text>
                  </View>
                </Button>
              </Surface>
            );
          })}
        </View>

        {/* Like/Dislike Buttons - Show during feedback */}
        {renderLikeDislikeButtons()}
      </ScrollView>

      {/* Timer Bar - Always at bottom */}
      {renderTimerBar()}

      {/* UPDATED: Exit dialog only for practice quizzes */}
      <Portal>
        <Dialog 
          visible={showExitDialog && actualIsPractice} 
          onDismiss={() => setShowExitDialog(false)}
        >
          <Dialog.Title>Exit Practice Quiz?</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to exit? Your progress will be lost.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExitDialog(false)}>Cancel</Button>
            <Button onPress={handleExit}>Exit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerModeChip: {
    borderRadius: 12,
  },
  headerModeChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'white',
  },
  mainProgressBar: {
    height: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 3,
  },
  // INFO: Info banner styles
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for timer bar
  },
  questionCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    minHeight: 120,
    justifyContent: 'center',
  },
  animeChipContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  animeChip: {
    borderRadius: 16,
  },
  animeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
  },
  questionTextSmall: {
    fontSize: 16,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  correctOption: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  incorrectOption: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  optionButton: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 60,
  },
  optionContent: {
    height: 'auto',
    minHeight: 60,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  optionContentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    gap: 8,
  },
  optionLetter: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
    marginTop: 2,
  },
  optionLetterSmall: {
    fontSize: 14,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'left',
    flex: 1,
    lineHeight: 22,
  },
  optionTextContent: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    textAlign: 'left',
  },
  optionTextSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackOptionText: {
    fontWeight: '600',
  },
  
  // Timer Styles
  timerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timerInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerTextContainer: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  urgentTimer: {
    fontSize: 20,
    color: '#FF6B6B',
  },
  timeUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeUpText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timerBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Like/Dislike Styles
  likeDislikeContainer: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  feedbackPrompt: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  likeDislikeButtons: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  likeButton: {
    borderRadius: 25,
    overflow: 'hidden',
    minWidth: 80,
  },
  dislikeButton: {
    borderRadius: 25,
    overflow: 'hidden',
    minWidth: 80,
  },
  likeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  dislikeButtonActive: {
    backgroundColor: '#F44336',
  },
  voteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  feedbackTimer: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Results Styles
  resultsWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  resultsContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 18,
    opacity: 0.8,
    marginBottom: 16,
  },
  modeChip: {
    borderRadius: 16,
    marginBottom: 16,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  scoreDivider: {
    fontSize: 36,
    marginHorizontal: 4,
    opacity: 0.6,
  },
  scoreTotal: {
    fontSize: 36,
    opacity: 0.8,
  },
  practiceNote: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  finishButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
});

export default QuizScreen;
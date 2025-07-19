// src/screens/QuizScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  BackHandler,
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
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PlayStackParamList } from '../navigation/PlayNavigator';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
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
}

interface Answer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
}

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 380;

const QuizScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<QuizScreenRouteProp>();
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const { animeId, animeName } = route.params;

  // State declarations
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

  useEffect(() => {
    fetchQuestions();

    // Handle hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!showResults) {
        setShowExitDialog(true);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showResults]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      
      // Use the new getDailyQuestions utility for consistent daily questions
      const dailyQuestions = await getDailyQuestions(animeId, 10);

      if (dailyQuestions.length === 0) {
        setError('No questions available for this category');
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

  const handleSelectOption = (optionIndex: number) => {
    if (selectedOption !== null || showFeedback) return;

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
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
        setShowFeedback(false);
      } else {
        // Last question - submit quiz
        submitQuiz(updatedAnswers);
      }
    }, 1500); // Show feedback for 1.5 seconds
  };

  const submitQuiz = async (finalAnswers: Answer[]) => {
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const score = finalAnswers.filter(a => a.isCorrect).length;
      
      const category = animeId === null ? 'all' : animeId.toString();
      const todayDate = getUTCDateString();

      // Save quiz attempt
      await addDoc(collection(firestore, 'dailyQuizzes'), {
        userId: user.uid,
        date: todayDate,
        category,
        animeName,
        score,
        totalQuestions: questions.length,
        completedAt: new Date(),
        answers: finalAnswers,
      });

      // Update user statistics
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        totalQuizzes: increment(1),
        totalCorrectAnswers: increment(score),
        [`categoryScores.${category}`]: increment(score),
      });

      // Update rankings
      await updateRankings(user.uid, category, score, questions.length);

      setShowResults(true);
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExit = () => {
    setShowExitDialog(false);
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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
            
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreDivider}>/</Text>
              <Text style={styles.scoreTotal}>10</Text>
            </View>
            
            <Button
              mode="contained"
              onPress={() => {
                const score = answers.filter(a => a.isCorrect).length;
                const category = animeId === null ? 'all' : animeId.toString();
                navigation.navigate('PlayHome', { 
                  refresh: true,
                  completedCategory: category,
                  score: score,
                  totalQuestions: 10
                });
              }}
              style={styles.finishButton}
            >
              Finish
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Submitting quiz...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => setShowExitDialog(true)}
        />
        <Text style={styles.questionCounter}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ProgressBar progress={progress} color={theme.colors.primary} style={styles.mainProgressBar} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.questionCard} elevation={2}>
          {/* Anime name chip - only show if it's not "All Anime" category */}
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

            return (
              <Surface
                key={index}
                style={[
                  styles.optionCard,
                  showCorrect && styles.correctOption,
                  showIncorrect && styles.incorrectOption,
                ]}
                elevation={1}
              >
                <Button
                  mode="text"
                  onPress={() => handleSelectOption(index)}
                  style={styles.optionButton}
                  labelStyle={[
                    styles.optionText,
                    (showCorrect || showIncorrect) && styles.feedbackOptionText,
                    isSmallScreen && styles.optionTextSmall,
                  ]}
                  contentStyle={styles.optionContent}
                  disabled={showFeedback || submitting}
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
      </ScrollView>

      <Portal>
        <Dialog visible={showExitDialog} onDismiss={() => setShowExitDialog(false)}>
          <Dialog.Title>Exit Quiz?</Dialog.Title>
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
  questionCounter: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainProgressBar: {
    height: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 3,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    marginBottom: 24,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6C5CE7', // Primary color
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
  finishButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 24,
  },
});

export default QuizScreen;
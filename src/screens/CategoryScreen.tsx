// src/screens/CategoryScreen.tsx - OPTIMIZED VERSION

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  ActivityIndicator,
  Snackbar,
  Button,
  Chip,
  IconButton,
  Divider,
} from 'react-native-paper';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestore, auth } from '../utils/firebase';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { PlayStackParamList } from '../navigation/PlayNavigator';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type CategoryScreenNavigationProp = StackNavigationProp<PlayStackParamList, 'Category'>;

interface QuizDate {
  date: string;
  displayDate: string;
  isToday: boolean;
  hasPlayedRanked: boolean;
  hasPracticed: boolean;
  rankedScore?: number;
  rankedTotalQuestions?: number;
  practiceScore?: number;
  practiceTotalQuestions?: number;
}

interface QuizAttempt {
  date: string;
  isPractice: boolean;
  score: number;
  totalQuestions: number;
}

type CategoryScreenProps = StackScreenProps<PlayStackParamList, 'Category'>;

const { width } = Dimensions.get('window');
const numColumns = 3;
const buttonWidth = (width - 64) / numColumns; // Account for padding and gaps

// Cache for quiz dates to avoid repeated fetches
let quizDatesCache: {
  [category: string]: {
    dates: string[];
    timestamp: number;
    ttl: number; // 2 minutes cache
  };
} = {};

const CategoryScreen: React.FC<CategoryScreenProps> = ({ route }) => {
  const theme = useTheme();
  const navigation = useNavigation<CategoryScreenNavigationProp>();
  const { animeId, animeName } = route.params;
  
  const [todayQuiz, setTodayQuiz] = useState<QuizDate | null>(null);
  const [pastQuizzes, setPastQuizzes] = useState<QuizDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = animeId === null ? 'all' : animeId.toString();
  
  // Helper function to get UTC date string
  const getUTCDateString = (date: Date = new Date()): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayDate = getUTCDateString();

  useFocusEffect(
    React.useCallback(() => {
      fetchQuizDates();
    }, [])
  );

  // OPTIMIZED: Batch fetch all quiz dates and completion statuses
  const fetchQuizDates = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting optimized quiz dates fetch...');
      
      // Check cache first
      const now = Date.now();
      const cacheEntry = quizDatesCache[category];
      let availableDates: string[] = [];
      
      if (cacheEntry && (now - cacheEntry.timestamp) < cacheEntry.ttl) {
        console.log('📦 Using cached quiz dates');
        availableDates = cacheEntry.dates;
      } else {
        console.log('🔄 Fetching fresh quiz dates from Firestore');
        
        // Get available quiz dates for this category
        const dailyQuestionsQuery = query(
          collection(firestore, 'dailyQuestions'),
          where('category', '==', category),
          orderBy('date', 'desc')
        );
        
        const questionsSnapshot = await getDocs(dailyQuestionsQuery);
        availableDates = questionsSnapshot.docs.map(doc => doc.data().date);
        
        // Cache the dates
        quizDatesCache[category] = {
          dates: availableDates,
          timestamp: now,
          ttl: 2 * 60 * 1000 // 2 minutes
        };
      }

      // If no dates available, show empty state
      if (availableDates.length === 0) {
        setTodayQuiz(null);
        setPastQuizzes([]);
        setError(null);
        setLoading(false);
        return;
      }

      // OPTIMIZATION: Batch fetch ALL user attempts for this category in ONE query
      const user = auth.currentUser;
      let userAttempts: Map<string, QuizAttempt[]> = new Map();
      
      if (user) {
        console.log('📊 Batch fetching all user attempts...');
        const attemptsQuery = query(
          collection(firestore, 'dailyQuizzes'),
          where('userId', '==', user.uid),
          where('category', '==', category)
        );
        
        const attemptsSnapshot = await getDocs(attemptsQuery);
        
        // Group attempts by date
        attemptsSnapshot.forEach((doc) => {
          const data = doc.data();
          const dateAttempts = userAttempts.get(data.date) || [];
          dateAttempts.push({
            date: data.date,
            isPractice: data.isPractice || false,
            score: data.score,
            totalQuestions: data.totalQuestions
          });
          userAttempts.set(data.date, dateAttempts);
        });
        
        console.log(`✅ Found attempts for ${userAttempts.size} different dates`);
      }

      // OPTIMIZATION: Process all dates in parallel
      const datePromises = availableDates.map(async (date) => {
        const isToday = date === todayDate;
        
        // Get completion status from our batched data
        const attempts = userAttempts.get(date) || [];
        const rankedAttempt = attempts.find(a => !a.isPractice);
        const practiceAttempt = attempts.find(a => a.isPractice);
        
        const quizDate: QuizDate = {
          date,
          displayDate: formatDisplayDate(date),
          isToday,
          hasPlayedRanked: !!rankedAttempt,
          hasPracticed: !!practiceAttempt,
          rankedScore: rankedAttempt?.score,
          rankedTotalQuestions: rankedAttempt?.totalQuestions,
          practiceScore: practiceAttempt?.score,
          practiceTotalQuestions: practiceAttempt?.totalQuestions,
        };
        
        return quizDate;
      });

      // Wait for all dates to be processed
      const processedDates = await Promise.all(datePromises);
      
      // Separate today from past quizzes
      const todayData = processedDates.find(d => d.isToday);
      const pastData = processedDates.filter(d => !d.isToday);
      
      setTodayQuiz(todayData || null);
      setPastQuizzes(pastData);
      setError(null);
      
      console.log('✅ Quiz dates loaded successfully');
    } catch (error) {
      console.error('Error fetching quiz dates:', error);
      setError('Failed to load quiz dates. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00Z');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateString === getUTCDateString()) {
      return 'Today';
    } else if (dateString === getUTCDateString(yesterday)) {
      return 'Yesterday';
    } else {
      // Return just the date part (DD/MM/YYYY)
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  const handlePlayQuiz = (date: string, isPractice: boolean) => {
    const isToday = date === todayDate;
    const quizDate = isToday ? todayQuiz : pastQuizzes.find(q => q.date === date);
    
    // For today's quiz, check if already played (only if not practice mode)
    if (isToday && !isPractice && quizDate?.hasPlayedRanked) {
      setError(`You already played today's quiz! Score: ${quizDate.rankedScore}/${quizDate.rankedTotalQuestions}`);
      return;
    }
    
    // For practice mode, check if already practiced this date
    if (isPractice && quizDate?.hasPracticed) {
      setError(`You already practiced this quiz! Score: ${quizDate.practiceScore}/${quizDate.practiceTotalQuestions}`);
      return;
    }

    navigation.navigate('Quiz', {
      animeId,
      animeName,
      date,
      isPractice,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Clear cache to force fresh fetch
    delete quizDatesCache[category];
    await fetchQuizDates();
  };

  const renderTodaySection = () => {
    if (!todayQuiz) return null;

    return (
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>Today</Text>
        <Text style={styles.sectionSubtitle}>Play for rankings and stats</Text>
        
        <Button
          mode={todayQuiz.hasPlayedRanked ? "outlined" : "contained"}
          onPress={() => handlePlayQuiz(todayQuiz.date, false)}
          disabled={todayQuiz.hasPlayedRanked}
          style={[
            styles.todayButton,
            todayQuiz.hasPlayedRanked && styles.completedButton
          ]}
          icon={todayQuiz.hasPlayedRanked ? "check-circle" : "trophy"}
          contentStyle={styles.todayButtonContent}
        >
          {todayQuiz.hasPlayedRanked 
            ? `Completed - ${todayQuiz.rankedScore}/${todayQuiz.rankedTotalQuestions}`
            : "Play Today's Quiz"
          }
        </Button>
      </View>
    );
  };

  const renderPastQuizButton = ({ item, index }: { item: QuizDate; index: number }) => {
    const isCompleted = item.hasPracticed;
    
    return (
      <TouchableOpacity
        onPress={() => handlePlayQuiz(item.date, true)}
        disabled={isCompleted}
        style={[
          styles.pastQuizButton,
          { width: buttonWidth },
          isCompleted ? styles.completedButton : styles.activeButton
        ]}
        activeOpacity={isCompleted ? 1 : 0.7}
      >
        <Text style={[
          styles.buttonDateText,
          isCompleted && styles.completedDateText
        ]}>
          {item.displayDate}
        </Text>
        {isCompleted && (
          <Text style={styles.buttonScoreText}>
            {item.practiceScore}/{item.practiceTotalQuestions}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
            Loading quiz dates...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.title}>{animeName}</Text>
          <View style={{ width: 48 }} />
        </View>
      </Surface>

      <View style={styles.content}>
        {/* Today's Quiz Section */}
        {renderTodaySection()}

        {/* Divider */}
        {todayQuiz && pastQuizzes.length > 0 && (
          <View style={styles.dividerSection}>
            <Divider style={styles.divider} />
            <Text style={styles.dividerText}>Replay old games</Text>
            <Divider style={styles.divider} />
          </View>
        )}

        {/* Past Quizzes Section */}
        {pastQuizzes.length > 0 && (
          <View style={styles.pastSection}>
            <Text style={styles.pastSectionSubtitle}>Choose a date</Text>
            
            <FlatList
              data={pastQuizzes}
              renderItem={renderPastQuizButton}
              keyExtractor={(item) => item.date}
              numColumns={numColumns}
              contentContainerStyle={styles.pastQuizzesGrid}
              columnWrapperStyle={styles.gridRow}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
            />
          </View>
        )}

        {/* Empty State */}
        {!todayQuiz && pastQuizzes.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="calendar-question" 
              size={64} 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text style={styles.emptyText}>No quiz dates available</Text>
            <Text style={styles.emptySubtext}>
              Quizzes are generated daily. Check back later!
            </Text>
          </View>
        )}
      </View>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={{ backgroundColor: theme.colors.error }}
      >
        {error}
      </Snackbar>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Today Section Styles
  todaySection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
    textAlign: 'center',
  },
  todayButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 250,
  },
  todayButtonContent: {
    paddingVertical: 12,
  },

  // Divider Styles
  dividerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
    opacity: 0.8,
  },

  // Past Quizzes Section Styles
  pastSection: {
    flex: 1,
  },
  pastSectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 20,
  },
  pastQuizzesGrid: {
    alignItems: 'center',
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  pastQuizButton: {
    height: 100,
    marginHorizontal: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeButton: {
    backgroundColor: '#6C5CE7', // Primary color
  },
  completedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6C5CE7',
    opacity: 0.6,
  },
  buttonDateText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: 'white',
  },
  completedDateText: {
    color: '#6C5CE7',
    marginBottom: 4,
  },
  buttonScoreText: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    color: '#6C5CE7',
    opacity: 0.8,
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.4,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default CategoryScreen;
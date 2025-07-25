// src/screens/CategoryScreen.tsx - MONTHLY PAGINATION VERSION

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestore, auth } from '../utils/firebase';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { PlayStackParamList } from '../navigation/PlayNavigator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCardDimensions, responsiveFontSize, responsiveSpacing } from '../utils/responsive';

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

// NEW: Month data structure
interface MonthData {
  monthKey: string; // "2025-01"
  displayName: string; // "January 2025"
  quizDates: QuizDate[];
  totalQuizzes: number;
  practiceCount: number;
}

type CategoryScreenProps = StackScreenProps<PlayStackParamList, 'Category'>;

const { width } = Dimensions.get('window');
const numColumns = 3;
const buttonWidth = (width - 64) / numColumns;

// Cache for quiz dates to avoid repeated fetches
let quizDatesCache: {
  [category: string]: {
    dates: string[];
    timestamp: number;
    ttl: number;
  };
} = {};

const CategoryScreen: React.FC<CategoryScreenProps> = ({ route }) => {
  const theme = useTheme();
  const navigation = useNavigation<CategoryScreenNavigationProp>();
  const { animeId, animeName } = route.params;
  const insets = useSafeAreaInsets();
  
  // Existing state
  const [todayQuiz, setTodayQuiz] = useState<QuizDate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: Monthly pagination state
  const [availableMonths, setAvailableMonths] = useState<MonthData[]>([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [currentMonthData, setCurrentMonthData] = useState<MonthData | null>(null);

    // Helper function to get UTC date string
  const getUTCDateString = (date: Date = new Date()): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const category = animeId === null ? 'all' : animeId.toString();
  const todayDate = getUTCDateString();


  // NEW: Get month key from date string
  const getMonthKey = (dateString: string): string => {
    return dateString.substring(0, 7); // "2025-01-15" -> "2025-01"
  };

  // NEW: Format month display name
  const formatMonthName = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // NEW: Group quiz dates by month
  const groupQuizDatesByMonth = (quizDates: QuizDate[]): MonthData[] => {
    const monthGroups: { [key: string]: QuizDate[] } = {};

    // Group dates by month
    quizDates.forEach(quiz => {
      if (!quiz.isToday) { // Only group past quizzes
        const monthKey = getMonthKey(quiz.date);
        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = [];
        }
        monthGroups[monthKey].push(quiz);
      }
    });

    // Convert to MonthData array and sort by month (newest first)
    const months = Object.keys(monthGroups)
      .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)
      .map(monthKey => {
        const quizDates = monthGroups[monthKey].sort((a, b) => b.date.localeCompare(a.date));
        const practiceCount = quizDates.filter(q => q.hasPracticed).length;
        
        return {
          monthKey,
          displayName: formatMonthName(monthKey),
          quizDates,
          totalQuizzes: quizDates.length,
          practiceCount
        };
      });

    return months;
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchQuizDates();
    }, [])
  );

  // ENHANCED: Fetch and organize quiz dates by month
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
        
        const dailyQuestionsQuery = query(
          collection(firestore, 'dailyQuestions'),
          where('category', '==', category),
          orderBy('date', 'desc')
        );
        
        const questionsSnapshot = await getDocs(dailyQuestionsQuery);
        availableDates = questionsSnapshot.docs.map(doc => doc.data().date);
        
        quizDatesCache[category] = {
          dates: availableDates,
          timestamp: now,
          ttl: 2 * 60 * 1000
        };
      }

      if (availableDates.length === 0) {
        setTodayQuiz(null);
        setAvailableMonths([]);
        setCurrentMonthData(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Batch fetch user attempts
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

      // Process all dates
      const allQuizDates = availableDates.map((date) => {
        const isToday = date === todayDate;
        const attempts = userAttempts.get(date) || [];
        const rankedAttempt = attempts.find(a => !a.isPractice);
        const practiceAttempt = attempts.find(a => a.isPractice);
        
        return {
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
      });

      // Separate today from past quizzes and group by month
      const todayData = allQuizDates.find(d => d.isToday);
      const pastQuizzes = allQuizDates.filter(d => !d.isToday);
      
      setTodayQuiz(todayData || null);
      
      // NEW: Group past quizzes by month
      const monthData = groupQuizDatesByMonth(pastQuizzes);
      setAvailableMonths(monthData);
      
      // Set current month to most recent month with quizzes
      if (monthData.length > 0) {
        setSelectedMonthIndex(0);
        setCurrentMonthData(monthData[0]);
      } else {
        setCurrentMonthData(null);
      }
      
      setError(null);
      console.log(`✅ Quiz dates loaded: ${monthData.length} months available`);
      
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
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit'
      });
    }
  };

  const handlePlayQuiz = (date: string, isPractice: boolean) => {
    const isToday = date === todayDate;
    let quizDate: QuizDate | undefined;
    
    if (isToday) {
      quizDate = todayQuiz || undefined;
    } else {
      quizDate = currentMonthData?.quizDates.find(q => q.date === date);
    }
    
    // Validation logic
    if (isToday && !isPractice && quizDate?.hasPlayedRanked) {
      setError(`You already played today's quiz! Score: ${quizDate.rankedScore}/${quizDate.rankedTotalQuestions}`);
      return;
    }
    
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

  // NEW: Navigate between months
  const handlePreviousMonth = () => {
    if (selectedMonthIndex < availableMonths.length - 1) {
      const newIndex = selectedMonthIndex + 1;
      setSelectedMonthIndex(newIndex);
      setCurrentMonthData(availableMonths[newIndex]);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex > 0) {
      const newIndex = selectedMonthIndex - 1;
      setSelectedMonthIndex(newIndex);
      setCurrentMonthData(availableMonths[newIndex]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
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

  // NEW: Month navigation header
  const renderMonthNavigation = () => {
    if (availableMonths.length === 0) return null;

    return (
      <View style={styles.monthNavigation}>
        <IconButton
          icon="chevron-left"
          size={24}
          onPress={handlePreviousMonth}
          disabled={selectedMonthIndex >= availableMonths.length - 1}
          style={[
            styles.monthNavButton,
            selectedMonthIndex >= availableMonths.length - 1 && styles.disabledNavButton
          ]}
        />
        
        <View style={styles.monthInfo}>
          <Text style={styles.monthTitle}>{currentMonthData?.displayName}</Text>
          <Text style={styles.monthStats}>
            {currentMonthData?.totalQuizzes} quiz{currentMonthData?.totalQuizzes !== 1 ? 'zes' : ''} • {currentMonthData?.practiceCount} practiced
          </Text>
        </View>
        
        <IconButton
          icon="chevron-right"
          size={24}
          onPress={handleNextMonth}
          disabled={selectedMonthIndex <= 0}
          style={[
            styles.monthNavButton,
            selectedMonthIndex <= 0 && styles.disabledNavButton
          ]}
        />
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
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
            Loading quiz dates...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ paddingTop: insets.top }}>
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
      </View>

      <View style={styles.content}>
        {/* Today's Quiz Section */}
        {renderTodaySection()}

        {/* Divider */}
        {todayQuiz && availableMonths.length > 0 && (
          <View style={styles.dividerSection}>
            <Divider style={styles.divider} />
            <Text style={styles.dividerText}>Replay old games</Text>
            <Divider style={styles.divider} />
          </View>
        )}

        {/* Month Navigation */}
        {availableMonths.length > 0 && renderMonthNavigation()}

        {/* Past Quizzes Grid for Selected Month */}
        {currentMonthData && currentMonthData.quizDates.length > 0 && (
          <View style={styles.pastSection}>
            <Text style={styles.pastSectionSubtitle}>Choose a date</Text>
            
            <FlatList
              data={currentMonthData.quizDates}
              renderItem={renderPastQuizButton}
              keyExtractor={(item) => item.date}
              numColumns={numColumns}
              contentContainerStyle={[
                styles.pastQuizzesGrid,
                { paddingBottom: insets.bottom + responsiveSpacing(20) }
              ]}
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
        {!todayQuiz && availableMonths.length === 0 && (
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
        style={{ 
          backgroundColor: theme.colors.error,
          marginBottom: insets.bottom 
        }}
      >
        {error}
      </Snackbar>
    </View>
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
    marginTop: responsiveSpacing(16),
    fontSize: responsiveFontSize(16),
  },
  header: {
    paddingHorizontal: responsiveSpacing(16),
    paddingTop: responsiveSpacing(8),
    paddingBottom: responsiveSpacing(16),
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize(24),
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: responsiveSpacing(20),
  },
  
  // Today Section Styles
  todaySection: {
    alignItems: 'center',
    marginBottom: responsiveSpacing(30),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(28),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(8),
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: responsiveFontSize(14),
    opacity: 0.7,
    marginBottom: responsiveSpacing(20),
    textAlign: 'center',
  },
  todayButton: {
    paddingVertical: responsiveSpacing(8),
    paddingHorizontal: responsiveSpacing(24),
    borderRadius: 12,
    minWidth: 250,
  },
  todayButtonContent: {
    paddingVertical: responsiveSpacing(12),
  },

  // Divider Styles
  dividerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: responsiveSpacing(30),
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: responsiveFontSize(18),
    fontWeight: '600',
    marginHorizontal: responsiveSpacing(16),
    opacity: 0.8,
  },

  // NEW: Month Navigation Styles
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing(20),
    paddingHorizontal: responsiveSpacing(8),
  },
  monthNavButton: {
    margin: 0,
  },
  disabledNavButton: {
    opacity: 0.3,
  },
  monthInfo: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '600',
    textAlign: 'center',
  },
  monthStats: {
    fontSize: responsiveFontSize(12),
    opacity: 0.6,
    textAlign: 'center',
    marginTop: responsiveSpacing(4),
  },

  // Past Quizzes Section Styles
  pastSection: {
    flex: 1,
  },
  pastSectionSubtitle: {
    fontSize: responsiveFontSize(14),
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: responsiveSpacing(20),
  },
  pastQuizzesGrid: {
    alignItems: 'center',
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing(8),
    marginBottom: responsiveSpacing(12),
  },
  pastQuizButton: {
    height: 100,
    marginHorizontal: responsiveSpacing(4),
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsiveSpacing(12),
    paddingHorizontal: responsiveSpacing(8),
  },
  activeButton: {
    backgroundColor: '#6C5CE7',
  },
  completedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6C5CE7',
    opacity: 0.6,
  },
  buttonDateText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    textAlign: 'center',
    color: 'white',
  },
  completedDateText: {
    color: '#6C5CE7',
    marginBottom: responsiveSpacing(4),
  },
  buttonScoreText: {
    fontSize: responsiveFontSize(12),
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
    padding: responsiveSpacing(40),
  },
  emptyText: {
    fontSize: responsiveFontSize(18),
    fontWeight: '600',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: responsiveSpacing(16),
  },
  emptySubtext: {
    fontSize: responsiveFontSize(14),
    opacity: 0.4,
    textAlign: 'center',
    marginTop: responsiveSpacing(8),
  },
});

export default CategoryScreen;
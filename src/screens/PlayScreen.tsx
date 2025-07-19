// src/screens/PlayScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { firestore, auth } from '../utils/firebase';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { PlayStackParamList } from '../navigation/PlayNavigator';
import AnimeCard from '../components/AnimeCard';
import DailyQuizStatus from '../components/DailyQuizStatus';
import { getUTCDateString, getTimeUntilReset } from '../utils/quizUtils';

type PlayScreenNavigationProp = StackNavigationProp<PlayStackParamList, 'PlayHome'>;

interface AnimeItem {
  id: number | null;
  title: string;
  coverImage: string | { uri: string };
  popularity?: number;
  hasPlayedToday?: boolean;
  todayScore?: number;
  questionCount?: number;
}

interface DailyAttempt {
  userId: string;
  date: string;
  category: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  isPractice?: boolean; // Add this to distinguish practice vs ranked
}

interface AnimeWithQuestions {
  animeId: number;
  animeName: string;
  questionCount: number;
}

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

type PlayScreenProps = StackScreenProps<PlayStackParamList, 'PlayHome'>;

const PlayScreen: React.FC<PlayScreenProps> = ({ route }) => {
  const theme = useTheme();
  const navigation = useNavigation<PlayScreenNavigationProp>();
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyAttempts, setDailyAttempts] = useState<Record<string, DailyAttempt>>({});
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle navigation params and refresh
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.refresh) {
        checkDailyAttempts();
        if (route.params.completedCategory && route.params.score !== undefined) {
          setSuccessMessage(`Quiz completed! Score: ${route.params.score}/${route.params.totalQuestions || 10}`);
          setTimeout(() => setSuccessMessage(null), 3000);
        }
        // Clear params to prevent showing message again
        navigation.setParams({ 
          refresh: undefined, 
          completedCategory: undefined, 
          score: undefined,
          totalQuestions: undefined 
        } as any);
      }
    }, [route.params])
  );

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const checkDailyAttempts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const todayDate = getUTCDateString();
      // Get today's ranked attempts (not practice) for the PlayScreen display
      const attemptsQuery = query(
        collection(firestore, 'dailyQuizzes'),
        where('userId', '==', user.uid),
        where('date', '==', todayDate),
        where('isPractice', '!=', true) // Exclude practice attempts
      );

      const snapshot = await getDocs(attemptsQuery);
      const attempts: Record<string, DailyAttempt> = {};

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAttempt;
        // Only include if it's not a practice attempt
        if (!data.isPractice) {
          attempts[data.category] = data;
        }
      });

      setDailyAttempts(attempts);
    } catch (error) {
      console.error('Error checking daily attempts:', error);
    }
  };

  const getAnimeWithQuestions = async (): Promise<AnimeWithQuestions[]> => {
    try {
      // Get all questions and group by animeId
      const questionsSnapshot = await getDocs(collection(firestore, 'questions'));
      const animeQuestionCount: { [key: number]: { name: string; count: number } } = {};

      questionsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.animeId && data.animeName) {
          if (!animeQuestionCount[data.animeId]) {
            animeQuestionCount[data.animeId] = {
              name: data.animeName,
              count: 0
            };
          }
          animeQuestionCount[data.animeId].count++;
        }
      });

      // Convert to array and filter out anime with very few questions (less than 100)
      const animeWithQuestions: AnimeWithQuestions[] = Object.entries(animeQuestionCount)
        .filter(([animeId, info]) => info.count >= 100) // Only show anime with at least 100 questions
        .map(([animeId, info]) => ({
          animeId: parseInt(animeId),
          animeName: info.name,
          questionCount: info.count
        }));

      return animeWithQuestions;
    } catch (error) {
      console.error('Error fetching anime with questions:', error);
      return [];
    }
  };

  const fetchAnimes = async () => {
    try {
      // First, get anime that have questions
      const animeWithQuestions = await getAnimeWithQuestions();
      
      if (animeWithQuestions.length === 0) {
        setError('No anime with questions available.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Create the "All" category first
      const allCategory: AnimeItem = {
        id: null,
        title: 'All Anime',
        coverImage: 'https://via.placeholder.com/300x450/6C5CE7/FFFFFF?text=ALL+ANIME',
        questionCount: animeWithQuestions.reduce((sum, anime) => sum + anime.questionCount, 0)
      };

      // Fetch anime details from the animes collection for those that have questions
      const animesSnapshot = await getDocs(collection(firestore, 'animes'));
      const animeDetails: { [key: number]: { title: string; coverImage: string; popularity: number } } = {};
      
      animesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id) {
          animeDetails[data.id] = {
            title: data.title || 'Unknown Anime',
            coverImage: data.coverImage || 'https://via.placeholder.com/300x450/666/FFFFFF?text=NO+IMAGE',
            popularity: data.popularity || 0
          };
        }
      });

      // Build the final anime list with only anime that have questions
      const animes: AnimeItem[] = [allCategory];

      animeWithQuestions.forEach((animeWithQ) => {
        const details = animeDetails[animeWithQ.animeId];
        animes.push({
          id: animeWithQ.animeId,
          title: details?.title || animeWithQ.animeName,
          coverImage: details?.coverImage || 'https://via.placeholder.com/300x450/666/FFFFFF?text=NO+IMAGE',
          popularity: details?.popularity || 0,
          questionCount: animeWithQ.questionCount
        });
      });

      // Sort by popularity (keeping "All" first), then by question count as secondary sort
      const sortedAnimes = [
        allCategory,
        ...animes.slice(1).sort((a, b) => {
          // Primary sort: popularity (descending)
          const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
          if (popularityDiff !== 0) return popularityDiff;
          
          // Secondary sort: question count (descending)
          return (b.questionCount || 0) - (a.questionCount || 0);
        }),
      ];

      setAnimeList(sortedAnimes);
      setError(null);
    } catch (error) {
      console.error('Error fetching anime:', error);
      setError('Failed to load anime. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnimes();
    checkDailyAttempts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAnimes(), checkDailyAttempts()]);
  };

  const handleAnimePress = (animeId: number | null, animeName: string) => {
    // Navigate to CategoryScreen instead of QuizScreen
    navigation.navigate('Category', {
      animeId,
      animeName,
    });
  };

  const renderAnimeCard = ({ item }: { item: AnimeItem }) => {
    const category = item.id === null ? 'all' : item.id.toString();
    const attempt = dailyAttempts[category];

    return (
      <View style={styles.cardWrapper}>
        <AnimeCard
          anime={item}
          onPress={() => handleAnimePress(item.id, item.title)}
          hasPlayedToday={!!attempt}
          todayScore={attempt?.score}
          totalQuestions={attempt?.totalQuestions}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading anime...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.header} elevation={2}>
        <Text style={styles.title}>Anime Quiz</Text>
        <Text style={styles.subtitle}>Choose an anime category to explore quizzes</Text>
        {animeList.length > 1 && (
          <Text style={styles.animeCount}>
            {animeList.length - 1} anime available with questions
          </Text>
        )}
      </Surface>

      <DailyQuizStatus 
        attempts={Object.values(dailyAttempts)} 
        timeUntilReset={timeUntilReset}
      />

      <FlatList
        data={animeList}
        renderItem={renderAnimeCard}
        keyExtractor={(item) => item.id?.toString() || 'all'}
        numColumns={isSmallScreen ? 2 : 3}
        columnWrapperStyle={isSmallScreen ? styles.row : styles.rowLarge}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No anime with questions available</Text>
            <Text style={styles.emptySubtext}>Questions need to be added to the database</Text>
          </View>
        }
      />

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={{ backgroundColor: theme.colors.error }}
      >
        {error}
      </Snackbar>

      <Snackbar
        visible={!!successMessage}
        onDismiss={() => setSuccessMessage(null)}
        duration={3000}
        style={{ backgroundColor: theme.colors.primary }}
      >
        {successMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  animeCount: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  rowLarge: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cardWrapper: {
    flex: 1,
    padding: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.4,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PlayScreen;
// src/screens/PlayScreen.tsx - OPTIMIZED VERSION

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { getAnimeWithQuestionsCached } from '../utils/animeCacheUtils';

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
  isPractice?: boolean;
}

interface AnimeWithQuestions {
  animeId: number;
  animeName: string;
  questionCount: number;
}

// Cache for anime data to avoid repeated expensive queries
let animeCache: {
  data: AnimeItem[] | null;
  timestamp: number;
  ttl: number; // 5 minutes cache
} = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000
};

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

  // Memoize today's date to avoid recalculation
  const todayDate = useMemo(() => getUTCDateString(), []);

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
    }, [route.params, navigation])
  );

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // OPTIMIZED: More efficient anime fetching with caching
  const getAnimeWithQuestions = useCallback(async (): Promise<AnimeWithQuestions[]> => {
    try {
      // Use the optimized cached version
      console.log('📦 Using cached anime data fetching...');
      return await getAnimeWithQuestionsCached();
    } catch (error) {
      console.error('Error fetching anime with questions:', error);
      return [];
    }
  }, []);

  // OPTIMIZED: Check daily attempts more efficiently
  const checkDailyAttempts = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      console.log('Checking daily attempts for user:', user.uid);
      
      // FIXED: Get ALL attempts for today, then filter client-side
      // This avoids Firestore's != operator issues with missing fields
      const attemptsQuery = query(
        collection(firestore, 'dailyQuizzes'),
        where('userId', '==', user.uid),
        where('date', '==', todayDate)
        // Remove the isPractice filter - we'll filter client-side
      );

      const snapshot = await getDocs(attemptsQuery);
      const attempts: Record<string, DailyAttempt> = {};

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAttempt;
        
        // Filter for ranked attempts (not practice) client-side
        // This handles cases where isPractice is undefined, false, or missing
        const isRankedAttempt = !data.isPractice; // undefined or false = ranked
        
        if (isRankedAttempt) {
          attempts[data.category] = data;
          console.log(`Found ranked attempt for category ${data.category}: ${data.score}/${data.totalQuestions}`);
        } else {
          console.log(`Skipping practice attempt for category ${data.category}`);
        }
      });

      console.log('Daily ranked attempts found:', Object.keys(attempts).length);
      setDailyAttempts(attempts);
    } catch (error) {
      console.error('Error checking daily attempts:', error);
    }
  }, [todayDate]);

  // OPTIMIZED: Fetch animes with caching and parallel operations
  const fetchAnimes = useCallback(async (useCache: boolean = true) => {
    try {
      console.log('Starting fetchAnimes...');
      
      // Check cache first
      const now = Date.now();
      if (useCache && animeCache.data && (now - animeCache.timestamp) < animeCache.ttl) {
        console.log('Using cached anime data');
        setAnimeList(animeCache.data);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Run anime fetching and daily attempts check in parallel
      const [animeWithQuestions] = await Promise.all([
        getAnimeWithQuestions(),
        checkDailyAttempts() // Run this in parallel
      ]);
      
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

      // Fetch anime details in parallel with a single query
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

      // Build the final anime list
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

      // Sort by popularity (keeping "All" first)
      const sortedAnimes = [
        allCategory,
        ...animes.slice(1).sort((a, b) => {
          const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
          if (popularityDiff !== 0) return popularityDiff;
          return (b.questionCount || 0) - (a.questionCount || 0);
        }),
      ];

      // Update cache
      animeCache = {
        data: sortedAnimes,
        timestamp: now,
        ttl: 5 * 60 * 1000 // 5 minutes
      };

      setAnimeList(sortedAnimes);
      setError(null);
    } catch (error) {
      console.error('Error fetching anime:', error);
      setError('Failed to load anime. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAnimeWithQuestions, checkDailyAttempts]);

  // OPTIMIZED: Initial load with cache
  useEffect(() => {
    console.log('PlayScreen: Initial load starting');
    fetchAnimes(true); // Use cache on initial load
  }, [fetchAnimes]);

  // OPTIMIZED: Refresh handler that bypasses cache
  const handleRefresh = useCallback(async () => {
    console.log('PlayScreen: Manual refresh triggered');
    setRefreshing(true);
    
    // Clear cache and fetch fresh data
    animeCache.data = null;
    animeCache.timestamp = 0;
    
    await fetchAnimes(false); // Don't use cache on manual refresh
  }, [fetchAnimes]);

  const handleAnimePress = useCallback((animeId: number | null, animeName: string) => {
    navigation.navigate('Category', {
      animeId,
      animeName,
    });
  }, [navigation]);

  const renderAnimeCard = useCallback(({ item }: { item: AnimeItem }) => {
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
  }, [dailyAttempts, handleAnimePress]);

  // OPTIMIZED: Better loading screen with consistent background
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Surface style={styles.header} elevation={2}>
          <Text style={styles.title}>Anime Quiz</Text>
          <Text style={styles.subtitle}>Choose an anime category to explore quizzes</Text>
        </Surface>
        
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
            Loading anime...
          </Text>
        </View>
      </SafeAreaView>
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
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={6}
        getItemLayout={(data, index) => ({
          length: 180, // Approximate item height
          offset: 180 * Math.floor(index / (isSmallScreen ? 2 : 3)),
          index,
        })}
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
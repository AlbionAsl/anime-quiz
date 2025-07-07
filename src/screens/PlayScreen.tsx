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
}

interface DailyAttempt {
  userId: string;
  date: string;
  category: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
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
      const attemptsQuery = query(
        collection(firestore, 'dailyQuizzes'),
        where('userId', '==', user.uid),
        where('date', '==', todayDate)
      );

      const snapshot = await getDocs(attemptsQuery);
      const attempts: Record<string, DailyAttempt> = {};

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAttempt;
        attempts[data.category] = data;
      });

      setDailyAttempts(attempts);
    } catch (error) {
      console.error('Error checking daily attempts:', error);
    }
  };

  const fetchAnimes = async () => {
    try {
      // First add the "All" category
      const allCategory: AnimeItem = {
        id: null,
        title: 'All Anime',
        coverImage: 'https://via.placeholder.com/300x450/6C5CE7/FFFFFF?text=ALL+ANIME',
      };

      // Fetch anime from Firestore
      const animesSnapshot = await getDocs(collection(firestore, 'animes'));
      const animes: AnimeItem[] = [allCategory];

      animesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id && data.title && data.coverImage) {
          animes.push({
            id: data.id,
            title: data.title,
            coverImage: data.coverImage,
            popularity: data.popularity || 0,
          });
        }
      });

      // Sort by popularity (keeping "All" first)
      const sortedAnimes = [
        allCategory,
        ...animes.slice(1).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
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
    const category = animeId === null ? 'all' : animeId.toString();
    const attempt = dailyAttempts[category];

    if (attempt) {
      // Show score if already played today
      setError(`You already played ${animeName} today! Score: ${attempt.score}/${attempt.totalQuestions}`);
      return;
    }

    navigation.navigate('Quiz', {
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
        <Text style={styles.subtitle}>Choose an anime to start your daily quiz</Text>
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
            <Text style={styles.emptyText}>No anime available</Text>
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
  },
});

export default PlayScreen;
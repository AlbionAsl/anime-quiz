// src/screens/ProfileScreen.tsx - FIXED SAFE AREA VERSION

import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView,
  RefreshControl 
} from 'react-native';
import { 
  Text, 
  Button, 
  useTheme, 
  Surface, 
  Divider,
  ActivityIndicator,
  Avatar,
  IconButton,
  ProgressBar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, firestore } from '../utils/firebase';
import { getMonthString } from '../utils/rankingUtils';

interface UserStats {
  username: string;
  displayUsername?: string; // New field for display purposes
  email: string;
  totalQuizzes: number;
  totalCorrectAnswers: number;
  stats?: {
    allTime?: {
      totalQuizzes: number;
      totalCorrectAnswers: number;
      averageScore: number;
    };
    categories?: {
      [key: string]: {
        totalQuizzes: number;
        totalCorrectAnswers: number;
        averageScore: number;
      };
    };
  };
  createdAt?: string;
}

interface AnimeInfo {
  id: number;
  title: string;
}

const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets(); // Add safe area insets
  const user = auth.currentUser;
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [animeMap, setAnimeMap] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAnimeNames = async (): Promise<{ [key: string]: string }> => {
    try {
      const animesSnapshot = await getDocs(collection(firestore, 'animes'));
      const animeMap: { [key: string]: string } = {
        'all': 'All Anime'
      };
      
      animesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id && data.title) {
          animeMap[data.id.toString()] = data.title;
        }
      });
      
      return animeMap;
    } catch (error) {
      console.error('Error fetching anime names:', error);
      return { 'all': 'All Anime' };
    }
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch anime names and user stats in parallel
      const [animeNamesMap, userDoc] = await Promise.all([
        fetchAnimeNames(),
        getDoc(doc(firestore, 'users', user.uid))
      ]);

      setAnimeMap(animeNamesMap);
      
      if (userDoc.exists()) {
        setUserStats(userDoc.data() as UserStats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const calculateOverallAverage = (): number => {
    if (!userStats || !userStats.totalQuizzes || userStats.totalQuizzes === 0) return 0;
    if (!userStats.totalCorrectAnswers) return 0;
    // Assuming 10 questions per quiz
    const totalPossibleAnswers = userStats.totalQuizzes * 10;
    return (userStats.totalCorrectAnswers / totalPossibleAnswers) * 100;
  };

  const getMembershipDuration = (): string => {
    if (!userStats?.createdAt) return 'New member';
    
    const createdDate = new Date(userStats.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  };

  // Get display username (use displayUsername if available, otherwise fall back to username)
  const getDisplayUsername = (): string => {
    if (!userStats) return 'Anonymous';
    return userStats.displayUsername || userStats.username || 'Anonymous';
  };

  // Get anime name from ID
  const getAnimeName = (categoryId: string): string => {
    return animeMap[categoryId] || `Category ${categoryId}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* FIXED: Add safe area container */}
      <View style={{ paddingTop: insets.top }}>
        {/* Header Section with safe area */}
        <Surface style={styles.headerCard} elevation={2}>
          <Avatar.Text
            size={80}
            label={getDisplayUsername().substring(0, 2).toUpperCase()}
            style={{ backgroundColor: theme.colors.primary }}
          />
          <Text style={styles.username}>{getDisplayUsername()}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.memberDuration}>
            <MaterialCommunityIcons name="clock-outline" size={14} /> Member for {getMembershipDuration()}
          </Text>
        </Surface>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 } // Add bottom safe area
        ]}
      >
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="gamepad-variant"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.statValue}>{userStats?.totalQuizzes || 0}</Text>
            <Text style={styles.statLabel}>Quizzes Played</Text>
          </Surface>

          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.statValue}>{userStats?.totalCorrectAnswers || 0}</Text>
            <Text style={styles.statLabel}>Correct Answers</Text>
          </Surface>

          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="percent"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.statValue}>{calculateOverallAverage().toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </Surface>
        </View>

        {/* Performance Overview */}
        <Surface style={styles.performanceCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance Overview</Text>
            <MaterialCommunityIcons
              name="chart-line"
              size={20}
              color={theme.colors.primary}
            />
          </View>
          
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Overall Accuracy</Text>
            <Text style={styles.performanceValue}>{calculateOverallAverage().toFixed(1)}%</Text>
            <ProgressBar
              progress={calculateOverallAverage() / 100}
              color={theme.colors.primary}
              style={styles.progressBar}
            />
          </View>

          {/* Category Breakdown */}
          {userStats?.stats?.categories && Object.keys(userStats.stats.categories).length > 0 && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.subsectionTitle}>Category Performance</Text>
              {Object.entries(userStats.stats.categories)
                .sort((a, b) => b[1].totalQuizzes - a[1].totalQuizzes)
                .slice(0, 5)
                .map(([categoryId, stats]) => (
                  <View key={categoryId} style={styles.categoryItem}>
                    <View style={styles.categoryNameContainer}>
                      <MaterialCommunityIcons
                        name={categoryId === 'all' ? 'infinity' : 'gamepad-variant'}
                        size={16}
                        color={theme.colors.primary}
                        style={styles.categoryIcon}
                      />
                      <Text style={styles.categoryName} numberOfLines={2}>
                        {getAnimeName(categoryId)}
                      </Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <Text style={styles.categoryQuizzes}>{stats.totalQuizzes} quiz{stats.totalQuizzes !== 1 ? 'zes' : ''}</Text>
                      <Text style={styles.categoryScore}>
                        {stats.averageScore ? stats.averageScore.toFixed(1) : '0.0'}%
                      </Text>
                    </View>
                  </View>
                ))}
            </>
          )}
        </Surface>

        {/* Achievements Section (Placeholder) */}
        <Surface style={styles.achievementsCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <MaterialCommunityIcons
              name="trophy"
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.comingSoonText}>Coming Soon!</Text>
          <Text style={styles.comingSoonSubtext}>
            Unlock achievements by completing quizzes and climbing the rankings
          </Text>
        </Surface>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 20,
  },
  headerCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  email: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  memberDuration: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  performanceCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  performanceItem: {
    marginBottom: 16,
  },
  performanceLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  divider: {
    marginVertical: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    opacity: 0.8,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minWidth: 120,
    justifyContent: 'flex-end',
  },
  categoryQuizzes: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'right',
  },
  categoryScore: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  achievementsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 20,
  },
  comingSoonSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 8,
    marginBottom: 12,
  },
});

export default ProfileScreen;
// src/screens/RankingsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  ActivityIndicator,
  Chip,
  Menu,
  Button,
  IconButton,
  Divider,
  Avatar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { onSnapshot, doc } from 'firebase/firestore';
import { firestore, auth } from '../utils/firebase';
import {
  getLeaderboardData,
  getUserRank,
  getAvailableCategories,
  getMonthString,
} from '../utils/rankingUtils';
import { getUTCDateString } from '../utils/quizUtils';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

type Period = 'daily' | 'monthly' | 'allTime';
type RankingType = 'totalScore' | 'averageScore';

interface LeaderboardPlayer {
  userId: string;
  username: string;
  score: number;
  totalQuestions: number;
  averageScore: number;
  quizCount: number;
  rank: number;
}

interface Category {
  id: string;
  title: string;
}

interface UserRankData {
  rank: number;
  totalPlayers: number;
  score: number;
  averageScore: number;
}

const RankingsScreen: React.FC = () => {
  const theme = useTheme();
  const currentUser = auth.currentUser;

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('daily');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string>('All Anime');
  const [rankingType, setRankingType] = useState<RankingType>('totalScore');
  const [categories, setCategories] = useState<Category[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([]);
  const [userRank, setUserRank] = useState<UserRankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Get period value based on selected period
  const getPeriodValue = (): string => {
    switch (selectedPeriod) {
      case 'daily':
        return getUTCDateString();
      case 'monthly':
        return getMonthString();
      case 'allTime':
        return 'all';
      default:
        return getUTCDateString();
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Set up real-time listener for leaderboard
  useEffect(() => {
    const periodValue = getPeriodValue();
    const cacheId = `${selectedPeriod}_${periodValue}_${selectedCategory}`;
    
    const unsubscribe = onSnapshot(
      doc(firestore, 'leaderboardCache', cacheId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          let players = data.topPlayers || [];
          
          // Sort by average score if that's the selected ranking type
          if (rankingType === 'averageScore') {
            players = [...players]
              .filter(p => selectedPeriod === 'allTime' ? p.quizCount >= 20 : true)
              .sort((a, b) => b.averageScore - a.averageScore)
              .map((p, index) => ({ ...p, rank: index + 1 }));
          }
          
          setLeaderboardData(players);
          setTotalPlayers(data.totalPlayers || players.length);
          setLoading(false);
        } else {
          setLeaderboardData([]);
          setTotalPlayers(0);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to leaderboard:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedPeriod, selectedCategory, rankingType]);

  // Fetch user rank whenever period/category changes
  useEffect(() => {
    if (currentUser) {
      fetchUserRank();
    }
  }, [selectedPeriod, selectedCategory, currentUser]);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const availableCategories = await getAvailableCategories();
      setCategories(availableCategories);
      
      // If the currently selected category is not available, reset to 'all'
      if (!availableCategories.find(cat => cat.id === selectedCategory)) {
        setSelectedCategory('all');
        setSelectedCategoryTitle('All Anime');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchUserRank = async () => {
    if (!currentUser) return;

    try {
      const periodValue = getPeriodValue();
      const rankData = await getUserRank(
        currentUser.uid,
        selectedPeriod,
        periodValue,
        selectedCategory
      );
      setUserRank(rankData);
    } catch (error) {
      console.error('Error fetching user rank:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchUserRank()]);
    setRefreshing(false);
  };

  const handleCategorySelect = (categoryId: string, categoryTitle: string) => {
    setSelectedCategory(categoryId);
    setSelectedCategoryTitle(categoryTitle);
    setMenuVisible(false);
  };

  const getPeriodChips = () => [
    { id: 'daily', label: 'Daily', icon: 'calendar-today' },
    { id: 'monthly', label: 'Monthly', icon: 'calendar-month' },
    { id: 'allTime', label: 'All Time', icon: 'infinity' },
  ];

  const getRankingTypeChips = () => [
    { id: 'totalScore', label: 'Total Score', icon: 'numeric' },
    { id: 'averageScore', label: 'Average Score', icon: 'percent' },
  ];

  const renderLeaderboardItem = (player: LeaderboardPlayer, index: number) => {
    const isCurrentUser = currentUser?.uid === player.userId;
    const showQuizCount = selectedPeriod === 'allTime' && rankingType === 'averageScore';

    return (
      <Surface
        key={player.userId}
        style={[
          styles.leaderboardItem,
          isCurrentUser && styles.currentUserItem,
          { backgroundColor: isCurrentUser ? theme.colors.primaryContainer : theme.colors.surface }
        ]}
        elevation={isCurrentUser ? 2 : 1}
      >
        <View style={styles.rankContainer}>
          {player.rank <= 3 ? (
            <MaterialCommunityIcons
              name={player.rank === 1 ? 'trophy' : player.rank === 2 ? 'medal' : 'medal-outline'}
              size={24}
              color={
                player.rank === 1 ? '#FFD700' : 
                player.rank === 2 ? '#C0C0C0' : 
                '#CD7F32'
              }
            />
          ) : (
            <Text style={styles.rankText}>#{player.rank}</Text>
          )}
        </View>

        <View style={styles.playerInfo}>
          <Avatar.Text
            size={36}
            label={player.username.substring(0, 2).toUpperCase()}
            style={{ backgroundColor: theme.colors.primary }}
          />
          <View style={styles.playerDetails}>
            <Text style={[styles.username, isCurrentUser && styles.currentUserText]}>
              {player.username}
              {isCurrentUser && ' (You)'}
            </Text>
            {showQuizCount && (
              <Text style={styles.quizCountText}>
                {player.quizCount} quizzes
              </Text>
            )}
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={[styles.score, isCurrentUser && styles.currentUserScore]}>
            {rankingType === 'totalScore' ? player.score : `${player.averageScore.toFixed(1)}%`}
          </Text>
          {rankingType === 'totalScore' && (
            <Text style={styles.scoreSubtext}>
              {((player.score / player.totalQuestions) * 100).toFixed(1)}% avg
            </Text>
          )}
        </View>
      </Surface>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading rankings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.header} elevation={2}>
        <Text style={styles.title}>Rankings</Text>
        
        {/* Category Selector */}
        <View style={styles.categorySelector}>
          {categoriesLoading ? (
            <View style={styles.categoriesLoadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.categoriesLoadingText}>Loading categories...</Text>
            </View>
          ) : (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuVisible(true)}
                  style={styles.categoryButton}
                  contentStyle={styles.categoryButtonContent}
                  disabled={categories.length <= 1}
                >
                  <MaterialCommunityIcons name="gamepad-variant" size={16} />
                  <Text style={styles.categoryButtonText}>{selectedCategoryTitle}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} />
                </Button>
              }
            >
              {categories.map((category) => (
                <Menu.Item
                  key={category.id}
                  onPress={() => handleCategorySelect(category.id, category.title)}
                  title={category.title}
                  leadingIcon={category.id === 'all' ? 'infinity' : 'gamepad-variant'}
                />
              ))}
            </Menu>
          )}
          
          {categories.length > 1 && (
            <Text style={styles.categoryCount}>
              {categories.length - 1} anime available
            </Text>
          )}
        </View>

        {/* Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollView}
          contentContainerStyle={styles.chipContainer}
        >
          {getPeriodChips().map((period) => (
            <Chip
              key={period.id}
              selected={selectedPeriod === period.id}
              onPress={() => setSelectedPeriod(period.id as Period)}
              style={[
                styles.chip,
                selectedPeriod === period.id && { backgroundColor: theme.colors.primaryContainer }
              ]}
              textStyle={styles.chipText}
              icon={period.icon}
            >
              {period.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Ranking Type Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollView}
          contentContainerStyle={styles.chipContainer}
        >
          {getRankingTypeChips().map((type) => (
            <Chip
              key={type.id}
              selected={rankingType === type.id}
              onPress={() => setRankingType(type.id as RankingType)}
              style={[
                styles.chip,
                rankingType === type.id && { backgroundColor: theme.colors.primaryContainer }
              ]}
              textStyle={styles.chipText}
              icon={type.icon}
            >
              {type.label}
            </Chip>
          ))}
        </ScrollView>
      </Surface>

      {/* User Rank Card */}
      {userRank && currentUser && (
        <Surface style={styles.userRankCard} elevation={2}>
          <View style={styles.userRankContent}>
            <MaterialCommunityIcons
              name="account-circle"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.userRankText}>Your Rank</Text>
            <Text style={styles.userRankValue}>
              #{userRank.rank} / {userRank.totalPlayers}
            </Text>
            <Text style={styles.userScoreText}>
              {rankingType === 'totalScore' 
                ? `Score: ${userRank.score}`
                : `Average: ${userRank.averageScore.toFixed(1)}%`
              }
            </Text>
          </View>
        </Surface>
      )}

      {/* Leaderboard */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {rankingType === 'averageScore' && selectedPeriod === 'allTime' && (
          <Surface style={[styles.infoCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.infoText}>
              Average score rankings require at least 20 quizzes completed
            </Text>
          </Surface>
        )}

        {categories.length <= 1 && (
          <Surface style={[styles.infoCard, { backgroundColor: theme.colors.errorContainer }]} elevation={1}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={[styles.infoText, { color: theme.colors.error }]}>
              No anime with questions available. Questions need to be added to the database.
            </Text>
          </Surface>
        )}

        {leaderboardData.length > 0 ? (
          <>
            {leaderboardData.map((player, index) => renderLeaderboardItem(player, index))}
            
            {leaderboardData.length === 100 && (
              <Text style={styles.footerText}>
                Showing top 100 players out of {totalPlayers}
              </Text>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={64}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>
              {categories.length > 1 
                ? "Be the first to complete a quiz!"
                : "Questions need to be added before rankings can be displayed"
              }
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  categorySelector: {
    marginBottom: 12,
    alignItems: 'center',
  },
  categoriesLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  categoriesLoadingText: {
    fontSize: 14,
    opacity: 0.7,
  },
  categoryButton: {
    borderRadius: 8,
  },
  categoryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  chipScrollView: {
    marginBottom: 8,
    maxHeight: 48,
  },
  chipContainer: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    marginHorizontal: 4,
  },
  chipText: {
    fontSize: 12,
  },
  userRankCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  userRankContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userRankText: {
    fontSize: 14,
    opacity: 0.8,
    flex: 1,
  },
  userRankValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userScoreText: {
    fontSize: 14,
    opacity: 0.7,
    marginLeft: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  currentUserItem: {
    borderWidth: 2,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 8,
  },
  playerDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
  },
  currentUserText: {
  },
  quizCountText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentUserScore: {
  },
  scoreSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    opacity: 0.8,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.6,
    textAlign: 'center',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    opacity: 0.6,
  },
});

export default RankingsScreen;
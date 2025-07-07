// src/utils/rankingUtils.ts

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './firebase';

interface RankingDocument {
  period: 'daily' | 'monthly' | 'allTime';
  periodValue: string;
  category: string;
  userId: string;
  username: string;
  score: number;
  totalQuestions: number;
  averageScore: number;
  quizCount: number;
  lastUpdated: Date;
}

interface LeaderboardPlayer {
  userId: string;
  username: string;
  score: number;
  totalQuestions: number;
  averageScore: number;
  quizCount: number;
  rank: number;
}

interface LeaderboardCache {
  period: 'daily' | 'monthly' | 'allTime';
  periodValue: string;
  category: string;
  lastUpdated: Date;
  topPlayers: LeaderboardPlayer[];
  totalPlayers?: number;
}

/**
 * Get the current month in YYYY-MM format
 */
export const getMonthString = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Update rankings after a quiz is completed
 */
export const updateRankings = async (
  userId: string,
  category: string,
  score: number,
  totalQuestions: number
) => {
  try {
    const batch = writeBatch(firestore);
    const now = new Date();
    const dailyKey = getUTCDateString();
    const monthlyKey = getMonthString(now);
    
    // Get user data
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const username = userData.username || 'Anonymous';
    const averageScore = (score / totalQuestions) * 100;
    
    // Update daily ranking
    const dailyRankingId = `daily_${dailyKey}_${category}_${userId}`;
    const dailyRankingRef = doc(firestore, 'rankings', dailyRankingId);
    
    batch.set(dailyRankingRef, {
      period: 'daily',
      periodValue: dailyKey,
      category,
      userId,
      username,
      score,
      totalQuestions,
      averageScore,
      quizCount: 1,
      lastUpdated: serverTimestamp()
    });
    
    // Update monthly ranking (accumulative)
    const monthlyRankingId = `monthly_${monthlyKey}_${category}_${userId}`;
    const monthlyRankingRef = doc(firestore, 'rankings', monthlyRankingId);
    const monthlyDoc = await getDoc(monthlyRankingRef);
    
    if (monthlyDoc.exists()) {
      const monthlyData = monthlyDoc.data();
      const newScore = monthlyData.score + score;
      const newTotalQuestions = monthlyData.totalQuestions + totalQuestions;
      const newQuizCount = monthlyData.quizCount + 1;
      
      batch.update(monthlyRankingRef, {
        score: newScore,
        totalQuestions: newTotalQuestions,
        averageScore: (newScore / newTotalQuestions) * 100,
        quizCount: newQuizCount,
        lastUpdated: serverTimestamp()
      });
    } else {
      batch.set(monthlyRankingRef, {
        period: 'monthly',
        periodValue: monthlyKey,
        category,
        userId,
        username,
        score,
        totalQuestions,
        averageScore,
        quizCount: 1,
        lastUpdated: serverTimestamp()
      });
    }
    
    // Update all-time ranking (accumulative)
    const allTimeRankingId = `allTime_all_${category}_${userId}`;
    const allTimeRankingRef = doc(firestore, 'rankings', allTimeRankingId);
    const allTimeDoc = await getDoc(allTimeRankingRef);
    
    if (allTimeDoc.exists()) {
      const allTimeData = allTimeDoc.data();
      const newScore = allTimeData.score + score;
      const newTotalQuestions = allTimeData.totalQuestions + totalQuestions;
      const newQuizCount = allTimeData.quizCount + 1;
      
      batch.update(allTimeRankingRef, {
        score: newScore,
        totalQuestions: newTotalQuestions,
        averageScore: (newScore / newTotalQuestions) * 100,
        quizCount: newQuizCount,
        lastUpdated: serverTimestamp()
      });
    } else {
      batch.set(allTimeRankingRef, {
        period: 'allTime',
        periodValue: 'all',
        category,
        userId,
        username,
        score,
        totalQuestions,
        averageScore,
        quizCount: 1,
        lastUpdated: serverTimestamp()
      });
    }
    
    // Update user stats
    const currentStats = userData.stats || {};
    const categoryStats = currentStats.categories || {};
    const currentCategoryStats = categoryStats[category] || { 
      totalQuizzes: 0, 
      totalCorrectAnswers: 0, 
      averageScore: 0 
    };
    
    const newCategoryQuizzes = currentCategoryStats.totalQuizzes + 1;
    const newCategoryCorrect = currentCategoryStats.totalCorrectAnswers + score;
    const newCategoryAverage = (newCategoryCorrect / (newCategoryQuizzes * totalQuestions)) * 100;
    
    batch.update(userRef, {
      [`stats.categories.${category}`]: {
        totalQuizzes: newCategoryQuizzes,
        totalCorrectAnswers: newCategoryCorrect,
        averageScore: newCategoryAverage
      },
      'stats.allTime.totalQuizzes': (currentStats.allTime?.totalQuizzes || 0) + 1,
      'stats.allTime.totalCorrectAnswers': (currentStats.allTime?.totalCorrectAnswers || 0) + score,
      'stats.allTime.lastUpdated': serverTimestamp()
    });
    
    await batch.commit();
    
    // Trigger leaderboard cache updates
    await Promise.all([
      updateLeaderboardCache('daily', dailyKey, category),
      updateLeaderboardCache('monthly', monthlyKey, category),
      updateLeaderboardCache('allTime', 'all', category)
    ]);
    
  } catch (error) {
    console.error('Error updating rankings:', error);
    throw error;
  }
};

/**
 * Update leaderboard cache for a specific period and category
 */
export const updateLeaderboardCache = async (
  period: 'daily' | 'monthly' | 'allTime',
  periodValue: string,
  category: string
) => {
  try {
    // Query top 100 players by score
    const rankingsQuery = query(
      collection(firestore, 'rankings'),
      where('period', '==', period),
      where('periodValue', '==', periodValue),
      where('category', '==', category),
      orderBy('score', 'desc'),
      orderBy('averageScore', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(rankingsQuery);
    
    const topPlayers: LeaderboardPlayer[] = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        userId: data.userId,
        username: data.username,
        score: data.score,
        totalQuestions: data.totalQuestions,
        averageScore: data.averageScore,
        quizCount: data.quizCount,
        rank: index + 1
      };
    });
    
    // Count total players for this period/category
    const countQuery = query(
      collection(firestore, 'rankings'),
      where('period', '==', period),
      where('periodValue', '==', periodValue),
      where('category', '==', category)
    );
    
    const countSnapshot = await getDocs(countQuery);
    const totalPlayers = countSnapshot.size;
    
    // Update cache
    const cacheId = `${period}_${periodValue}_${category}`;
    await setDoc(doc(firestore, 'leaderboardCache', cacheId), {
      period,
      periodValue,
      category,
      lastUpdated: serverTimestamp(),
      topPlayers,
      totalPlayers
    });
    
  } catch (error) {
    console.error('Error updating leaderboard cache:', error);
  }
};

/**
 * Get leaderboard data from cache
 */
export const getLeaderboardData = async (
  period: 'daily' | 'monthly' | 'allTime',
  periodValue: string,
  category: string
): Promise<LeaderboardCache | null> => {
  try {
    const cacheId = `${period}_${periodValue}_${category}`;
    const cacheDoc = await getDoc(doc(firestore, 'leaderboardCache', cacheId));
    
    if (cacheDoc.exists()) {
      const data = cacheDoc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as LeaderboardCache;
    }
    
    // If cache doesn't exist, try to create it
    await updateLeaderboardCache(period, periodValue, category);
    
    // Try to get it again
    const updatedCacheDoc = await getDoc(doc(firestore, 'leaderboardCache', cacheId));
    if (updatedCacheDoc.exists()) {
      const data = updatedCacheDoc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as LeaderboardCache;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting leaderboard data:', error);
    return null;
  }
};

/**
 * Get user's rank for a specific period and category
 */
export const getUserRank = async (
  userId: string,
  period: 'daily' | 'monthly' | 'allTime',
  periodValue: string,
  category: string
): Promise<{ rank: number; totalPlayers: number; score: number; averageScore: number } | null> => {
  try {
    // First check if user has a ranking document
    const rankingId = `${period}_${periodValue}_${category}_${userId}`;
    const userRankingDoc = await getDoc(doc(firestore, 'rankings', rankingId));
    
    if (!userRankingDoc.exists()) {
      return null;
    }
    
    const userData = userRankingDoc.data();
    
    // Count how many players have a higher score
    const betterPlayersQuery = query(
      collection(firestore, 'rankings'),
      where('period', '==', period),
      where('periodValue', '==', periodValue),
      where('category', '==', category),
      where('score', '>', userData.score)
    );
    
    const betterPlayersSnapshot = await getDocs(betterPlayersQuery);
    const rank = betterPlayersSnapshot.size + 1;
    
    // Get total players
    const allPlayersQuery = query(
      collection(firestore, 'rankings'),
      where('period', '==', period),
      where('periodValue', '==', periodValue),
      where('category', '==', category)
    );
    
    const allPlayersSnapshot = await getDocs(allPlayersQuery);
    const totalPlayers = allPlayersSnapshot.size;
    
    return {
      rank,
      totalPlayers,
      score: userData.score,
      averageScore: userData.averageScore
    };
  } catch (error) {
    console.error('Error getting user rank:', error);
    return null;
  }
};

/**
 * Get available categories from the anime collection
 */
export const getAvailableCategories = async (): Promise<Array<{ id: string; title: string }>> => {
  try {
    const categories = [{ id: 'all', title: 'All Anime' }];
    
    const animesSnapshot = await getDocs(collection(firestore, 'animes'));
    animesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.id && data.title) {
        categories.push({
          id: data.id.toString(),
          title: data.title
        });
      }
    });
    
    // Sort by title, keeping "All Anime" first
    return [
      categories[0],
      ...categories.slice(1).sort((a, b) => a.title.localeCompare(b.title))
    ];
  } catch (error) {
    console.error('Error getting categories:', error);
    return [{ id: 'all', title: 'All Anime' }];
  }
};

// Import the getUTCDateString function from quizUtils
import { getUTCDateString } from './quizUtils';
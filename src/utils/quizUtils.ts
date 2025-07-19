// src/utils/quizUtils.ts - SIMPLIFIED VERSION (Cloud Functions handle question generation)

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { firestore } from './firebase';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  animeId?: number;
  animeName?: string;
  random: number;
  // Usage tracking fields (embedded)
  lastUsed?: Date;
  timesUsed?: number;
  usedDates?: string[]; // Array of YYYY-MM-DD dates
  categories?: string[]; // Categories where used
}

interface DailyQuestions {
  date: string;
  category: string;
  animeName: string;
  questions: Question[];
  generatedAt: Date;
  questionIds: string[]; // For easy tracking
}

// OPTIMIZED: Cache for daily attempts to reduce repeated queries
let dailyAttemptsCache: {
  [userDate: string]: {
    data: Record<string, any>;
    timestamp: number;
    ttl: number;
  };
} = {};

/**
 * Get the current UTC date in YYYY-MM-DD format
 */
export const getUTCDateString = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get questions for a specific date and category (ONLY retrieval, no generation)
 */
export const getQuestionsForDate = async (
  animeId: number | null,
  targetDate: string
): Promise<Question[]> => {
  try {
    const category = animeId === null ? 'all' : animeId.toString();
    const dailyQuestionId = `${targetDate}_${category}`;

    // Try to get pre-generated questions for this date
    const dailyQuestionDoc = await getDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId)
    );

    if (dailyQuestionDoc.exists()) {
      const data = dailyQuestionDoc.data() as DailyQuestions;
      console.log(`Using pre-generated questions for ${category} on ${targetDate}`);
      return data.questions || [];
    }

    // If no pre-generated questions exist for this date, return empty array
    console.warn(`No questions found for ${category} on ${targetDate}`);
    return [];
  } catch (error) {
    console.error('Error fetching questions for date:', error);
    return [];
  }
};

/**
 * OPTIMIZED: Check completion status with caching
 */
export const getQuizCompletionStatus = async (
  userId: string,
  category: string,
  date: string
): Promise<{
  hasPlayedRanked: boolean;
  hasPracticed: boolean;
  rankedScore?: number;
  practiceScore?: number;
  rankedTotalQuestions?: number;
  practiceTotalQuestions?: number;
}> => {
  try {
    const cacheKey = `${userId}_${date}`;
    const now = Date.now();
    
    // Check cache first
    if (dailyAttemptsCache[cacheKey] && 
        (now - dailyAttemptsCache[cacheKey].timestamp) < dailyAttemptsCache[cacheKey].ttl) {
      const cachedData = dailyAttemptsCache[cacheKey].data;
      const categoryData = cachedData[category];
      
      if (categoryData) {
        return categoryData;
      }
    }

    const quizQuery = query(
      collection(firestore, 'dailyQuizzes'),
      where('userId', '==', userId),
      where('category', '==', category),
      where('date', '==', date)
    );

    const snapshot = await getDocs(quizQuery);
    
    let hasPlayedRanked = false;
    let hasPracticed = false;
    let rankedScore: number | undefined;
    let practiceScore: number | undefined;
    let rankedTotalQuestions: number | undefined;
    let practiceTotalQuestions: number | undefined;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isPractice) {
        hasPracticed = true;
        practiceScore = data.score;
        practiceTotalQuestions = data.totalQuestions;
      } else {
        hasPlayedRanked = true;
        rankedScore = data.score;
        rankedTotalQuestions = data.totalQuestions;
      }
    });

    const result = {
      hasPlayedRanked,
      hasPracticed,
      rankedScore,
      practiceScore,
      rankedTotalQuestions,
      practiceTotalQuestions,
    };

    // Cache the result
    if (!dailyAttemptsCache[cacheKey]) {
      dailyAttemptsCache[cacheKey] = {
        data: {},
        timestamp: now,
        ttl: 60 * 1000 // 1 minute cache
      };
    }
    dailyAttemptsCache[cacheKey].data[category] = result;

    return result;
  } catch (error) {
    console.error('Error getting quiz completion status:', error);
    return {
      hasPlayedRanked: false,
      hasPracticed: false,
    };
  }
};

/**
 * SIMPLIFIED: Get daily questions - ONLY retrieves pre-generated questions
 * Since Cloud Functions generate questions at midnight, we never generate here
 */
export const getDailyQuestions = async (
  animeId: number | null,
  questionCount: number = 10
): Promise<Question[]> => {
  const dateString = getUTCDateString();
  const category = animeId === null ? 'all' : animeId.toString();
  const dailyQuestionId = `${dateString}_${category}`;

  try {
    // ONLY try to get pre-generated questions (Cloud Functions handle generation)
    const dailyQuestionDoc = await getDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId)
    );

    if (dailyQuestionDoc.exists()) {
      const data = dailyQuestionDoc.data() as DailyQuestions;
      console.log(`✅ Found pre-generated questions for ${category} on ${dateString}`);
      return data.questions;
    }

    // If no pre-generated questions exist, this means Cloud Function hasn't run yet
    console.warn(`❌ No pre-generated questions found for ${category} on ${dateString}`);
    console.warn(`🔧 Cloud Function should generate questions at midnight UTC`);
    
    // Return empty array - don't try to generate in the app
    return [];

  } catch (error) {
    console.error('Error fetching daily questions:', error);
    return [];
  }
};

/**
 * Check if the user has already played today (only for ranked quizzes)
 */
export const hasPlayedToday = async (
  userId: string,
  category: string
): Promise<boolean> => {
  const dateString = getUTCDateString();
  
  // FIXED: Get all attempts for today, then filter client-side to avoid != operator issues
  const attemptQuery = query(
    collection(firestore, 'dailyQuizzes'),
    where('userId', '==', userId),
    where('date', '==', dateString),
    where('category', '==', category)
    // Remove isPractice filter - we'll check client-side
  );

  const snapshot = await getDocs(attemptQuery);
  
  // Check if any of the attempts are ranked (not practice)
  let hasRankedAttempt = false;
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Ranked attempt if isPractice is undefined, false, or missing
    if (!data.isPractice) {
      hasRankedAttempt = true;
    }
  });
  
  return hasRankedAttempt;
};

/**
 * Get time until next UTC midnight
 */
export const getTimeUntilReset = (): { hours: number; minutes: number; seconds: number } => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
};

/**
 * Get available quiz dates with better query
 */
export const getAvailableQuizDates = async (
  animeId: number | null
): Promise<string[]> => {
  try {
    const category = animeId === null ? 'all' : animeId.toString();
    
    const dailyQuestionsQuery = query(
      collection(firestore, 'dailyQuestions'),
      where('category', '==', category),
      orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(dailyQuestionsQuery);
    const dates: string[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.date) {
        dates.push(data.date);
      }
    });
    
    return dates;
  } catch (error) {
    console.error('Error fetching available quiz dates:', error);
    return [];
  }
};

/**
 * Check if user has completed a specific quiz (either ranked or practice)
 */
export const hasCompletedQuiz = async (
  userId: string,
  category: string,
  date: string,
  isPractice: boolean = false
): Promise<boolean> => {
  try {
    const quizQuery = query(
      collection(firestore, 'dailyQuizzes'),
      where('userId', '==', userId),
      where('category', '==', category),
      where('date', '==', date),
      where('isPractice', '==', isPractice)
    );

    const snapshot = await getDocs(quizQuery);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking quiz completion:', error);
    return false;
  }
};

/**
 * Clear caches - useful for testing or when data changes
 */
export const clearQuizCaches = (): void => {
  dailyAttemptsCache = {};
  console.log('🗑️  Cleared quiz caches');
};
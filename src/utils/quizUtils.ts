// src/utils/quizUtils.ts - Enhanced version with date-specific queries

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
  updateDoc,
  writeBatch,
  DocumentData,
  arrayUnion
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

interface AnimeWithQuestions {
  animeId: number;
  animeName: string;
  questionCount: number;
}

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
 * Get anime that have questions (same logic as PlayScreen)
 */
const getAnimeWithQuestions = async (): Promise<AnimeWithQuestions[]> => {
  try {
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

    const animeWithQuestions: AnimeWithQuestions[] = Object.entries(animeQuestionCount)
      .filter(([animeId, info]) => info.count >= 5)
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

/**
 * Get unused questions for a category - MUCH MORE EFFICIENT!
 */
const getUnusedQuestions = async (
  category: string,
  targetDate: string,
  limit: number = 10
): Promise<Question[]> => {
  try {
    let questionsQuery;
    
    if (category === 'all') {
      // For "All Anime" category, get from all questions
      questionsQuery = query(
        collection(firestore, 'questions'),
        orderBy('random')
      );
    } else {
      // For specific anime
      const animeId = parseInt(category);
      questionsQuery = query(
        collection(firestore, 'questions'),
        where('animeId', '==', animeId),
        orderBy('random')
      );
    }

    const questionsSnapshot = await getDocs(questionsQuery);
    const allQuestions: Question[] = [];

    questionsSnapshot.forEach((doc) => {
      const data = doc.data();
      allQuestions.push({
        id: doc.id,
        question: data.question,
        options: data.options,
        correctAnswer: data.correctAnswer,
        animeId: data.animeId,
        animeName: data.animeName,
        random: data.random,
        // Usage tracking fields
        lastUsed: data.lastUsed?.toDate(),
        timesUsed: data.timesUsed || 0,
        usedDates: data.usedDates || [],
        categories: data.categories || []
      });
    });

    // Filter unused questions (much simpler now!)
    const unusedQuestions = allQuestions.filter(q => {
      // Question is unused if:
      // 1. Never used before (no categories), OR
      // 2. Not used in this specific category AND not used in 'all' category
      if (!q.categories || q.categories.length === 0) {
        return true; // Never used
      }
      
      // Check if used in current category or 'all' category
      return !q.categories.includes(category) && !q.categories.includes('all');
    });

    console.log(`Found ${unusedQuestions.length} unused questions for category ${category}`);

    // If we don't have enough unused questions
    if (unusedQuestions.length < limit) {
      console.warn(`Not enough unused questions for category ${category}. Need ${limit}, have ${unusedQuestions.length}`);
      
      if (unusedQuestions.length > 0) {
        return unusedQuestions.slice(0, Math.min(limit, unusedQuestions.length));
      } else {
        // Get least recently used questions
        return getLeastRecentlyUsedQuestions(category, allQuestions, limit);
      }
    }

    // Use deterministic selection based on date for fairness
    const seed = generateDailySeed(targetDate, category);
    return selectQuestionsWithSeed(unusedQuestions, limit, seed);

  } catch (error) {
    console.error('Error getting unused questions:', error);
    return [];
  }
};

/**
 * Get least recently used questions when no unused questions are available
 */
const getLeastRecentlyUsedQuestions = (
  category: string,
  allQuestions: Question[],
  limit: number
): Question[] => {
  // Filter questions that have been used in this category
  const usedInCategory = allQuestions.filter(q => 
    q.categories && (q.categories.includes(category) || q.categories.includes('all'))
  );

  if (usedInCategory.length === 0) {
    // No questions have been used yet, return first N questions
    return allQuestions.slice(0, limit);
  }

  // Sort by last used date (oldest first)
  const sortedByUsage = usedInCategory.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1; // Never used comes first
    if (!b.lastUsed) return 1;
    return a.lastUsed.getTime() - b.lastUsed.getTime();
  });

  return sortedByUsage.slice(0, limit);
};

/**
 * Generate a seed number from a date string and category
 */
const generateDailySeed = (dateString: string, category: string): number => {
  let hash = 0;
  const str = `${dateString}-${category}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * Select questions deterministically using a seed
 */
const selectQuestionsWithSeed = (questions: Question[], count: number, seed: number): Question[] => {
  const shuffled = [...questions];
  
  // Fisher-Yates shuffle with deterministic seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
};

/**
 * Mark questions as used - MUCH MORE EFFICIENT!
 */
const markQuestionsAsUsed = async (
  questionIds: string[],
  category: string,
  date: string
): Promise<void> => {
  try {
    const batch = writeBatch(firestore);
    const now = new Date();

    for (const questionId of questionIds) {
      const questionRef = doc(firestore, 'questions', questionId);
      
      // Update the question document directly with usage info
      batch.update(questionRef, {
        lastUsed: now,
        timesUsed: increment(1),
        usedDates: arrayUnion(date),
        categories: arrayUnion(category)
      });
    }

    await batch.commit();
    console.log(`Marked ${questionIds.length} questions as used for category ${category} on ${date}`);
  } catch (error) {
    console.error('Error marking questions as used:', error);
    throw error;
  }
};

/**
 * Get questions for a specific date and category
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
 * Get available quiz dates for a category
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
 * Get user's completion status for a specific date and category
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

    return {
      hasPlayedRanked,
      hasPracticed,
      rankedScore,
      practiceScore,
      rankedTotalQuestions,
      practiceTotalQuestions,
    };
  } catch (error) {
    console.error('Error getting quiz completion status:', error);
    return {
      hasPlayedRanked: false,
      hasPracticed: false,
    };
  }
};

/**
 * Pre-generate questions for all categories for a specific date
 */
export const preGenerateQuestionsForDate = async (targetDate?: string): Promise<void> => {
  const date = targetDate || getUTCDateString();
  
  console.log(`Pre-generating questions for date: ${date}`);

  try {
    // Check if questions for this date already exist
    const existingQuery = query(
      collection(firestore, 'dailyQuestions'),
      where('date', '==', date)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      console.log(`Questions for ${date} already exist. Skipping generation.`);
      return;
    }

    // Get all anime with questions
    const animeWithQuestions = await getAnimeWithQuestions();
    
    // Prepare categories: "All Anime" first, then specific anime
    const categories: Array<{ id: string; name: string }> = [
      { id: 'all', name: 'All Anime' }
    ];
    
    // Sort anime by popularity for consistent ordering
    const animesSnapshot = await getDocs(collection(firestore, 'animes'));
    const animeDetails: { [key: number]: { title: string; popularity: number } } = {};
    
    animesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.id) {
        animeDetails[data.id] = {
          title: data.title || 'Unknown Anime',
          popularity: data.popularity || 0
        };
      }
    });

    // Add anime categories sorted by popularity
    animeWithQuestions
      .sort((a, b) => {
        const aPopularity = animeDetails[a.animeId]?.popularity || 0;
        const bPopularity = animeDetails[b.animeId]?.popularity || 0;
        return bPopularity - aPopularity;
      })
      .forEach((anime) => {
        categories.push({
          id: anime.animeId.toString(),
          name: animeDetails[anime.animeId]?.title || anime.animeName
        });
      });

    // Generate questions for each category
    for (const category of categories) {
      console.log(`Generating questions for category: ${category.name} (${category.id})`);
      
      const questions = await getUnusedQuestions(category.id, date, 10);
      
      if (questions.length === 0) {
        console.warn(`No questions available for category ${category.name}`);
        continue;
      }

      // Save daily questions
      const dailyQuestionId = `${date}_${category.id}`;
      const dailyQuestionsData: DailyQuestions = {
        date,
        category: category.id,
        animeName: category.name,
        questions,
        generatedAt: new Date(),
        questionIds: questions.map(q => q.id)
      };

      await setDoc(
        doc(firestore, 'dailyQuestions', dailyQuestionId),
        dailyQuestionsData
      );

      // Mark questions as used (much more efficient now!)
      await markQuestionsAsUsed(questions.map(q => q.id), category.id, date);

      console.log(`Generated ${questions.length} questions for ${category.name}`);
    }

    console.log(`Successfully pre-generated questions for ${date}`);

  } catch (error) {
    console.error('Error pre-generating questions:', error);
    throw error;
  }
};

/**
 * Get daily questions for a specific category (now just retrieves pre-generated questions)
 */
export const getDailyQuestions = async (
  animeId: number | null,
  questionCount: number = 10
): Promise<Question[]> => {
  const dateString = getUTCDateString();
  const category = animeId === null ? 'all' : animeId.toString();
  const dailyQuestionId = `${dateString}_${category}`;

  try {
    // Try to get pre-generated questions
    const dailyQuestionDoc = await getDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId)
    );

    if (dailyQuestionDoc.exists()) {
      const data = dailyQuestionDoc.data() as DailyQuestions;
      console.log(`Using pre-generated questions for ${category} on ${dateString}`);
      return data.questions;
    }

    // If no pre-generated questions exist, try to generate them now
    console.warn(`No pre-generated questions found for ${category} on ${dateString}. Generating now...`);
    
    await preGenerateQuestionsForDate(dateString);
    
    // Try again to get the questions
    const retryDoc = await getDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId)
    );
    
    if (retryDoc.exists()) {
      const data = retryDoc.data() as DailyQuestions;
      return data.questions;
    }

    throw new Error(`Failed to generate questions for category ${category}`);

  } catch (error) {
    console.error('Error fetching daily questions:', error);
    throw error;
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
  
  const attemptQuery = query(
    collection(firestore, 'dailyQuizzes'),
    where('userId', '==', userId),
    where('date', '==', dateString),
    where('category', '==', category),
    where('isPractice', '!=', true) // Only check for ranked attempts
  );

  const snapshot = await getDocs(attemptQuery);
  return !snapshot.empty;
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
 * Cleanup old daily questions (optional utility function)
 */
export const cleanupOldQuestions = async (daysToKeep: number = 30): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysToKeep);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    const oldQuestionsQuery = query(
      collection(firestore, 'dailyQuestions'),
      where('date', '<', cutoffDateString)
    );

    const snapshot = await getDocs(oldQuestionsQuery);
    const batch = writeBatch(firestore);

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old daily question documents`);
  } catch (error) {
    console.error('Error cleaning up old questions:', error);
  }
};

/**
 * Get question usage statistics - MORE EFFICIENT!
 */
export const getQuestionUsageStats = async (): Promise<{
  totalQuestions: number;
  usedQuestions: number;
  unusedQuestions: number;
  categoryStats: { [category: string]: { used: number; total: number } };
}> => {
  try {
    // Single query to get all questions with usage data
    const questionsSnapshot = await getDocs(collection(firestore, 'questions'));

    let totalQuestions = 0;
    let usedQuestions = 0;
    const categoryStats: { [category: string]: { used: number; total: number } } = {};

    questionsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalQuestions++;
      
      // Count as used if it has any usage data
      const isUsed = data.categories && data.categories.length > 0;
      if (isUsed) {
        usedQuestions++;
      }

      // Category stats
      const category = data.animeId ? data.animeId.toString() : 'all';
      if (!categoryStats[category]) {
        categoryStats[category] = { used: 0, total: 0 };
      }
      categoryStats[category].total++;
      
      if (isUsed) {
        categoryStats[category].used++;
      }
    });

    const unusedQuestions = totalQuestions - usedQuestions;

    return {
      totalQuestions,
      usedQuestions,
      unusedQuestions,
      categoryStats
    };
  } catch (error) {
    console.error('Error getting question usage stats:', error);
    return {
      totalQuestions: 0,
      usedQuestions: 0,
      unusedQuestions: 0,
      categoryStats: {}
    };
  }
};

// Helper function for batch updates
import { increment } from 'firebase/firestore';
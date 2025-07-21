// Cloud Function for midnight question generation
// This would be deployed as a Firebase Cloud Function

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Define interfaces for the embedded system
interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  animeId?: number;
  animeName?: string;
  random: number;
  // Embedded usage tracking fields
  lastUsed?: Date;
  timesUsed?: number;
  usedDates?: string[];
  categories?: string[];
}

interface DailyQuestions {
  date: string;
  category: string;
  animeName: string;
  questions: Question[];
  generatedAt: Date;
  questionIds: string[];
}

interface AnimeWithQuestions {
  animeId: number;
  animeName: string;
  questionCount: number;
}

/**
 * Get the current UTC date in YYYY-MM-DD format
 */
const getUTCDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get anime that have questions
 */
const getAnimeWithQuestions = async (): Promise<AnimeWithQuestions[]> => {
  try {
    const questionsSnapshot = await db.collection('questions').get();
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
 * Get unused questions for a category
 */
// functions/src/index.ts - Key fixes for handling the categories array

/**
 * Get unused questions for a category
 * FIXED: Handle missing categories array gracefully
 */
const getUnusedQuestions = async (
  category: string, // "all" or animeId as string
  targetDate: string,
  limit: number = 10
): Promise<Question[]> => {
  try {
    let questionsQuery;

    if (category === 'all') {
      questionsQuery = db.collection('questions').orderBy('random');
    } else {
      const animeId = parseInt(category);
      questionsQuery = db.collection('questions')
        .where('animeId', '==', animeId)
        .orderBy('random');
    }

    const questionsSnapshot = await questionsQuery.get();
    const allQuestions: Question[] = [];

    questionsSnapshot.forEach((doc) => {
      const data = doc.data();
      allQuestions.push({
        id: doc.id,
        question: data.question,
        options: data.options, // Already in object format
        correctAnswer: data.correctAnswer,
        animeId: data.animeId,
        animeName: data.animeName,
        random: data.random,
        // Handle potentially missing fields
        lastUsed: data.lastUsed ? (typeof data.lastUsed === 'string' ? new Date(data.lastUsed) : data.lastUsed.toDate()) : undefined,
        timesUsed: data.timesUsed || 0,
        usedDates: data.usedDates || [],
        categories: data.categories || [], // Default to empty array if missing
      });
    });

    // Filter unused questions - handle missing categories field
    const unusedQuestions = allQuestions.filter((q) => {
      // If categories field doesn't exist or is empty, the question is unused
      if (!q.categories || q.categories.length === 0) {
        return true;
      }
      // Check if this question has been used in the current quiz category
      return !q.categories.includes(category);
    });

    console.log(`Found ${unusedQuestions.length} unused questions for category ${category}`);

    if (unusedQuestions.length < limit) {
      console.warn(`Not enough unused questions for category ${category}. Need ${limit}, have ${unusedQuestions.length}`);
      
      if (unusedQuestions.length > 0) {
        return unusedQuestions.slice(0, Math.min(limit, unusedQuestions.length));
      } else {
        return getLeastRecentlyUsedQuestions(category, allQuestions, limit);
      }
    }

    const seed = generateDailySeed(targetDate, category);
    return selectQuestionsWithSeed(unusedQuestions, limit, seed);
  } catch (error) {
    console.error('Error getting unused questions:', error);
    return [];
  }
};

/**
 * Mark questions as used - Initialize categories array if it doesn't exist
 */
const markQuestionsAsUsed = async (
  questionIds: string[],
  category: string,
  date: string
): Promise<void> => {
  try {
    const batch = db.batch();
    const now = new Date();

    for (const questionId of questionIds) {
      const questionRef = db.collection('questions').doc(questionId);
      
      // First check if the document has categories array
      const doc = await questionRef.get();
      if (doc.exists) {
        const data = doc.data();
        
        if (!data?.categories) {
          // If categories doesn't exist, set it as an array with current category
          batch.set(questionRef, {
            categories: [category]
          }, { merge: true });
        } else {
          // If it exists, use arrayUnion
          batch.update(questionRef, {
            categories: FieldValue.arrayUnion(category)
          });
        }
        
        // Update other fields
        batch.update(questionRef, {
          lastUsed: now,
          timesUsed: FieldValue.increment(1),
          usedDates: FieldValue.arrayUnion(date),
        });
      }
    }

    await batch.commit();
    console.log(`Marked ${questionIds.length} questions as used for category ${category} on ${date}`);
  } catch (error) {
    console.error('Error marking questions as used:', error);
    throw error;
  }
};

/**
 * Get least recently used questions
 */
const getLeastRecentlyUsedQuestions = (
  category: string,
  allQuestions: Question[],
  limit: number
): Question[] => {
  const usedInCategory = allQuestions.filter(q => 
    q.categories && (q.categories.includes(category) || q.categories.includes('all'))
  );

  if (usedInCategory.length === 0) {
    return allQuestions.slice(0, limit);
  }

  const sortedByUsage = usedInCategory.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1;
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
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
};


/**
 * Pre-generate questions for all categories for a specific date
 */
const preGenerateQuestionsForDate = async (targetDate?: string): Promise<void> => {
  const date = targetDate || getUTCDateString();
  
  console.log(`Pre-generating questions for date: ${date}`);

  try {
    // Check if questions for this date already exist
    const existingSnapshot = await db.collection('dailyQuestions')
      .where('date', '==', date)
      .limit(1)
      .get();
    
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
    
    // Get anime details for sorting
    const animesSnapshot = await db.collection('animes').get();
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

      await db.collection('dailyQuestions').doc(dailyQuestionId).set(dailyQuestionsData);

      // Mark questions as used
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
 * Cleanup old daily questions
 */
const cleanupOldQuestions = async (daysToKeep: number = 30): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysToKeep);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    const oldQuestionsSnapshot = await db.collection('dailyQuestions')
      .where('date', '<', cutoffDateString)
      .get();

    const batch = db.batch();
    oldQuestionsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${oldQuestionsSnapshot.size} old daily question documents`);
  } catch (error) {
    console.error('Error cleaning up old questions:', error);
  }
};

/**
 * Get question usage statistics - Updated for embedded system
 */
const getQuestionUsageStats = async (): Promise<{
  totalQuestions: number;
  usedQuestions: number;
  unusedQuestions: number;
  categoryStats: { [category: string]: { used: number; total: number } };
}> => {
  try {
    const questionsSnapshot = await db.collection('questions').get();

    let totalQuestions = 0;
    let usedQuestions = 0;
    const categoryStats: { [category: string]: { used: number; total: number } } = {};

    questionsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalQuestions++;
      
      const isUsed = data.categories && data.categories.length > 0;
      if (isUsed) {
        usedQuestions++;
      }

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

/**
 * Scheduled function that runs every day at midnight UTC
 * to pre-generate questions for all categories
 */
export const generateDailyQuestions = onSchedule(
  {
    schedule: '0 0 * * *', // Every day at midnight UTC
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 300, // 5 minutes timeout
  },
  async (event) => {
    console.log('Starting daily question generation at midnight UTC');
    
    try {
      // Generate questions for today
      await preGenerateQuestionsForDate();
      
      console.log('Successfully generated daily questions');
      
      // Optional: Cleanup old questions (keep last 30 days)
      await cleanupOldQuestions(30);
      
      // Optional: Log usage statistics
      const stats = await getQuestionUsageStats();
      console.log('Question usage statistics:', stats);
      
      // Log completion
      await db.collection('systemLogs').add({
        type: 'dailyQuestionGeneration',
        status: 'success',
        timestamp: new Date(),
        stats
      });
      
    } catch (error) {
      console.error('Error generating daily questions:', error);
      
      // Log error
      await db.collection('systemLogs').add({
        type: 'dailyQuestionGeneration',
        status: 'error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
);

/**
 * Manual function to generate questions for a specific date
 * Can be called via HTTP request for testing or manual generation
 */
export const generateQuestionsForDate = onSchedule(
  {
    schedule: '0 1 * * *', // Backup generation 1 hour later
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running backup question generation');
    
    try {
      // Check if today's questions exist
      const today = getUTCDateString();
      const existingSnapshot = await db
        .collection('dailyQuestions')
        .where('date', '==', today)
        .limit(1)
        .get();
      
      if (existingSnapshot.empty) {
        console.log('No questions found for today, generating...');
        await preGenerateQuestionsForDate();
      } else {
        console.log('Questions already exist for today');
      }
      
    } catch (error) {
      console.error('Error in backup generation:', error);
    }
  }
);

/**
 * Weekly cleanup function
 * Runs every Sunday at 2 AM UTC to clean up old data
 */
export const weeklyCleanup = onSchedule(
  {
    schedule: '0 2 * * 0', // Every Sunday at 2 AM UTC
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running weekly cleanup');
    
    try {
      // Cleanup old daily questions (keep 60 days)
      await cleanupOldQuestions(60);
      
      // Optional: Cleanup old system logs
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of logs
      
      const oldLogsSnapshot = await db
        .collection('systemLogs')
        .where('timestamp', '<', cutoffDate)
        .get();
      
      const batch = db.batch();
      oldLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${oldLogsSnapshot.size} old log entries`);
      
      // Log cleanup completion
      await db.collection('systemLogs').add({
        type: 'weeklyCleanup',
        status: 'success',
        timestamp: new Date(),
        cleanedQuestions: 'completed',
        cleanedLogs: oldLogsSnapshot.size
      });
      
    } catch (error) {
      console.error('Error in weekly cleanup:', error);
      
      await db.collection('systemLogs').add({
        type: 'weeklyCleanup',
        status: 'error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * HTTP function for manual question generation (for testing)
 */
export const manualGenerateQuestions = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (req, res) => {
    // Add basic authentication here if needed
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer anime-quiz-secret-2025') {
      res.status(401).send('Unauthorized');
      return;
    }
    
    try {
      const targetDate = req.query.date as string || undefined;
      
      console.log(`Manual generation request for date: ${targetDate || 'today'}`);
      
      await preGenerateQuestionsForDate(targetDate);
      
      const stats = await getQuestionUsageStats();
      
      res.status(200).json({
        success: true,
        message: 'Questions generated successfully',
        date: targetDate || getUTCDateString(),
        stats
      });
      
    } catch (error) {
      console.error('Error in manual generation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * HTTP function to get question usage statistics
 */
export const getQuestionStats = onRequest(
  {
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const stats = await getQuestionUsageStats();
      
      res.status(200).json({
        success: true,
        stats
      });
      
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);
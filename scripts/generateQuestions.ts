// scripts/generateQuestions.ts
// Manual script to generate questions - can be run locally or on server

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc, writeBatch, arrayUnion, increment, orderBy } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
    const questionsSnapshot = await getDocs(collection(db, 'questions'));
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
const getUnusedQuestions = async (
  category: string,
  targetDate: string,
  limit: number = 10
): Promise<Question[]> => {
  try {
    let questionsQuery;
    
    if (category === 'all') {
      questionsQuery = query(
        collection(db, 'questions'),
        orderBy('random')
      );
    } else {
      const animeId = parseInt(category);
      questionsQuery = query(
        collection(db, 'questions'),
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
        lastUsed: data.lastUsed?.toDate(),
        timesUsed: data.timesUsed || 0,
        usedDates: data.usedDates || [],
        categories: data.categories || []
      });
    });

    // Filter unused questions
    const unusedQuestions = allQuestions.filter(q => {
      if (!q.categories || q.categories.length === 0) {
        return true; // Never used
      }
      return !q.categories.includes(category) && !q.categories.includes('all');
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
 * Mark questions as used - Updated for embedded system
 */
const markQuestionsAsUsed = async (
  questionIds: string[],
  category: string,
  date: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const now = new Date();

    for (const questionId of questionIds) {
      const questionRef = doc(db, 'questions', questionId);
      
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
 * Pre-generate questions for all categories for a specific date
 */
const preGenerateQuestionsForDate = async (targetDate?: string): Promise<void> => {
  const date = targetDate || getUTCDateString();
  
  console.log(`Pre-generating questions for date: ${date}`);

  try {
    // Check if questions for this date already exist
    const existingQuery = query(
      collection(db, 'dailyQuestions'),
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
    
    // Get anime details for sorting
    const animesSnapshot = await getDocs(collection(db, 'animes'));
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
        doc(db, 'dailyQuestions', dailyQuestionId),
        dailyQuestionsData
      );

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

    const oldQuestionsQuery = query(
      collection(db, 'dailyQuestions'),
      where('date', '<', cutoffDateString)
    );

    const snapshot = await getDocs(oldQuestionsQuery);
    const batch = writeBatch(db);

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
 * Get question usage statistics - Updated for embedded system
 */
const getQuestionUsageStats = async (): Promise<{
  totalQuestions: number;
  usedQuestions: number;
  unusedQuestions: number;
  categoryStats: { [category: string]: { used: number; total: number } };
}> => {
  try {
    const questionsSnapshot = await getDocs(collection(db, 'questions'));

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
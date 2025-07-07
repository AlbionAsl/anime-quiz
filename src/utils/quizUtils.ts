// src/utils/quizUtils.ts

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
  DocumentData
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
}

interface DailyQuestions {
  date: string;
  category: string;
  questions: Question[];
  generatedAt: Date;
}

/**
 * Get the current UTC date in YYYY-MM-DD format
 */
export const getUTCDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Get daily questions for a specific category
 */
export const getDailyQuestions = async (
  animeId: number | null,
  questionCount: number = 10
): Promise<Question[]> => {
  const dateString = getUTCDateString();
  const category = animeId === null ? 'all' : animeId.toString();
  const dailyQuestionId = `${dateString}_${category}`;

  try {
    // First, check if we already have questions for today
    const dailyQuestionDoc = await getDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId)
    );

    if (dailyQuestionDoc.exists()) {
      const data = dailyQuestionDoc.data() as DailyQuestions;
      console.log(`Using cached questions for ${category} on ${dateString}`);
      return data.questions;
    }

    // If not, generate new questions for today
    console.log(`Generating new questions for ${category} on ${dateString}`);
    const seed = generateDailySeed(dateString, category);
    
    // Use modulo to create "buckets" for deterministic selection
    const bucketSize = 1000;
    const targetBucket = seed % bucketSize;

    // Fetch questions using the random field for efficient querying
    let questionsQuery;
    if (animeId === null) {
      // For "all" category, fetch from all questions
      questionsQuery = query(
        collection(firestore, 'questions'),
        where('random', '>=', targetBucket),
        where('random', '<', targetBucket + 100),
        orderBy('random'),
        limit(questionCount * 2) // Fetch extra in case we need them
      );
    } else {
      // For specific anime
      questionsQuery = query(
        collection(firestore, 'questions'),
        where('animeId', '==', animeId),
        where('random', '>=', targetBucket),
        where('random', '<', targetBucket + 100),
        orderBy('random'),
        limit(questionCount * 2)
      );
    }

    let snapshot = await getDocs(questionsQuery);
    let questions: Question[] = [];

    // If we didn't get enough questions in the target bucket, wrap around
    if (snapshot.size < questionCount) {
      if (animeId === null) {
        questionsQuery = query(
          collection(firestore, 'questions'),
          orderBy('random'),
          limit(questionCount * 3)
        );
      } else {
        questionsQuery = query(
          collection(firestore, 'questions'),
          where('animeId', '==', animeId),
          orderBy('random'),
          limit(questionCount * 3)
        );
      }
      snapshot = await getDocs(questionsQuery);
    }

    // Convert to Question array
    snapshot.forEach((doc) => {
      const data = doc.data();
      questions.push({
        id: doc.id,
        question: data.question,
        options: data.options,
        correctAnswer: data.correctAnswer,
        animeId: data.animeId,
        animeName: data.animeName,
        random: data.random,
      });
    });

    // Use the seed to deterministically select from available questions
    const selectedQuestions: Question[] = [];
    const availableIndices = questions.map((_, index) => index);
    
    for (let i = 0; i < Math.min(questionCount, questions.length); i++) {
      const seedForIndex = (seed + i) % availableIndices.length;
      const selectedIndex = availableIndices[seedForIndex];
      selectedQuestions.push(questions[selectedIndex]);
      availableIndices.splice(seedForIndex, 1);
    }

    // Cache the selected questions for today
    const dailyQuestionsData: DailyQuestions = {
      date: dateString,
      category,
      questions: selectedQuestions,
      generatedAt: new Date(),
    };

    await setDoc(
      doc(firestore, 'dailyQuestions', dailyQuestionId),
      dailyQuestionsData
    );

    return selectedQuestions;
  } catch (error) {
    console.error('Error fetching daily questions:', error);
    throw error;
  }
};

/**
 * Check if the user has already played today (based on UTC time)
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
    where('category', '==', category)
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
// src/utils/animeCacheUtils.ts - NEW FILE FOR PERFORMANCE OPTIMIZATION

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './firebase';

interface AnimeWithQuestions {
  animeId: number;
  animeName: string;
  questionCount: number;
}

interface AnimeMetadata {
  animeWithQuestions: AnimeWithQuestions[];
  lastUpdated: Timestamp | Date;
  totalQuestions: number;
  generatedAt: Timestamp | Date;
}

// In-memory cache to reduce even Firestore metadata calls
let memoryCache: {
  data: AnimeWithQuestions[] | null;
  timestamp: number;
  ttl: number; // 5 minutes in memory
} = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000
};

/**
 * Get anime with questions using multi-level caching:
 * 1. Memory cache (5 minutes)
 * 2. Firestore metadata cache (1 hour)  
 * 3. Fallback to live query
 */
export const getAnimeWithQuestionsCached = async (): Promise<AnimeWithQuestions[]> => {
  const now = Date.now();
  
  // Level 1: Check memory cache first
  if (memoryCache.data && (now - memoryCache.timestamp) < memoryCache.ttl) {
    console.log('📦 Using memory cache for anime data');
    return memoryCache.data;
  }

  try {
    // Level 2: Check Firestore metadata cache
    const statsDoc = await getDoc(doc(firestore, 'metadata', 'animeStats'));
    
    if (statsDoc.exists()) {
      const statsData = statsDoc.data() as AnimeMetadata;
      // Handle both Firestore Timestamp and Date objects
      const lastUpdated = statsData.lastUpdated instanceof Timestamp 
        ? statsData.lastUpdated.toDate() 
        : new Date(statsData.lastUpdated);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // If stats are recent (less than 1 hour old), use them
      if (lastUpdated && lastUpdated > oneHourAgo) {
        console.log('🗃️  Using Firestore metadata cache for anime data');
        
        // Update memory cache
        memoryCache = {
          data: statsData.animeWithQuestions || [],
          timestamp: now,
          ttl: 5 * 60 * 1000
        };
        
        return statsData.animeWithQuestions || [];
      }
    }

    // Level 3: Fallback to live query and update cache
    console.log('🔄 Generating fresh anime data from questions collection');
    return await generateAndCacheAnimeStats();
    
  } catch (error) {
    console.error('Error in getAnimeWithQuestionsCached:', error);
    
    // If all else fails, try memory cache even if stale
    if (memoryCache.data) {
      console.log('⚠️  Using stale memory cache as fallback');
      return memoryCache.data;
    }
    
    return [];
  }
};

/**
 * Generate anime stats from questions collection and cache the result
 */
const generateAndCacheAnimeStats = async (): Promise<AnimeWithQuestions[]> => {
  try {
    console.log('📊 Generating anime stats from questions collection...');
    
    // Use a more efficient approach - get distinct anime IDs first
    const questionsSnapshot = await getDocs(collection(firestore, 'questions'));
    const animeQuestionCount: { [key: number]: { name: string; count: number } } = {};
    let totalQuestions = 0;

    questionsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalQuestions++;
      
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

    // Filter and convert to array
    const animeWithQuestions: AnimeWithQuestions[] = Object.entries(animeQuestionCount)
      .filter(([animeId, info]) => info.count >= 100) // Only anime with at least 100 questions
      .map(([animeId, info]) => ({
        animeId: parseInt(animeId),
        animeName: info.name,
        questionCount: info.count
      }));

    const now = new Date();
    
    // Cache in Firestore
    const metadataToCache: AnimeMetadata = {
      animeWithQuestions,
      lastUpdated: now,
      totalQuestions,
      generatedAt: now
    };

    try {
      await setDoc(doc(firestore, 'metadata', 'animeStats'), metadataToCache);
      console.log('💾 Successfully cached anime stats to Firestore');
    } catch (cacheError) {
      console.warn('⚠️  Failed to cache anime stats to Firestore:', cacheError);
    }

    // Cache in memory
    memoryCache = {
      data: animeWithQuestions,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000
    };

    console.log(`✅ Generated stats for ${animeWithQuestions.length} anime with ${totalQuestions} total questions`);
    return animeWithQuestions;
    
  } catch (error) {
    console.error('Error generating anime stats:', error);
    throw error;
  }
};

/**
 * Invalidate all caches - useful when data changes
 */
export const invalidateAnimeCache = async (): Promise<void> => {
  console.log('🗑️  Invalidating anime caches...');
  
  // Clear memory cache
  memoryCache = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000
  };

  try {
    // Remove Firestore cache
    await setDoc(doc(firestore, 'metadata', 'animeStats'), {
      lastUpdated: new Date(0), // Set to epoch to force refresh
      animeWithQuestions: [],
      totalQuestions: 0,
      generatedAt: new Date()
    });
    console.log('✅ Successfully invalidated Firestore cache');
  } catch (error) {
    console.warn('⚠️  Failed to invalidate Firestore cache:', error);
  }
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = (): {
  memoryCache: {
    hasData: boolean;
    ageMinutes: number;
    isValid: boolean;
  };
} => {
  const now = Date.now();
  const ageMs = now - memoryCache.timestamp;
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  
  return {
    memoryCache: {
      hasData: !!memoryCache.data,
      ageMinutes,
      isValid: ageMs < memoryCache.ttl
    }
  };
};

/**
 * Preload anime data in the background (for app startup optimization)
 */
export const preloadAnimeData = async (): Promise<void> => {
  try {
    console.log('🚀 Preloading anime data...');
    await getAnimeWithQuestionsCached();
    console.log('✅ Anime data preloaded successfully');
  } catch (error) {
    console.warn('⚠️  Failed to preload anime data:', error);
  }
};

/**
 * Utility to check if we need to refresh anime cache
 */
export const shouldRefreshAnimeCache = async (): Promise<boolean> => {
  try {
    const statsDoc = await getDoc(doc(firestore, 'metadata', 'animeStats'));
    
    if (!statsDoc.exists()) {
      return true;
    }

    const statsData = statsDoc.data() as AnimeMetadata;
    // Handle both Firestore Timestamp and Date objects
    const lastUpdated = statsData.lastUpdated instanceof Timestamp 
      ? statsData.lastUpdated.toDate() 
      : new Date(statsData.lastUpdated);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    return lastUpdated < sixHoursAgo;
  } catch (error) {
    console.error('Error checking cache freshness:', error);
    return true;
  }
};
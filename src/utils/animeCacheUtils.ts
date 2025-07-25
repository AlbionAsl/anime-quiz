// src/utils/animeCacheUtils.ts - ULTRA-OPTIMIZED VERSION

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  query,
  where,
  Timestamp,
  getCountFromServer
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
  version: number; // Add version for cache invalidation
}

// ENHANCED: Multi-level cache with longer TTLs
let memoryCache: {
  data: AnimeWithQuestions[] | null;
  timestamp: number;
  ttl: number; // 30 minutes in memory (increased from 5)
} = {
  data: null,
  timestamp: 0,
  ttl: 30 * 60 * 1000
};

/**
 * ULTRA-OPTIMIZED: Get anime with questions using smart caching and aggregation
 * 1. Memory cache (30 minutes) - instant
 * 2. Firestore metadata cache (24 hours) - very fast
 * 3. Optimized aggregation queries - much faster than full scan
 */
export const getAnimeWithQuestionsCached = async (): Promise<AnimeWithQuestions[]> => {
  const now = Date.now();
  
  // Level 1: Check memory cache first (30 minutes)
  if (memoryCache.data && (now - memoryCache.timestamp) < memoryCache.ttl) {
    console.log('⚡ Using memory cache for anime data (instant)');
    return memoryCache.data;
  }

  try {
    // Level 2: Check Firestore metadata cache (24 hours)
    const statsDoc = await getDoc(doc(firestore, 'metadata', 'animeStats'));
    
    if (statsDoc.exists()) {
      const statsData = statsDoc.data() as AnimeMetadata;
      const lastUpdated = statsData.lastUpdated instanceof Timestamp 
        ? statsData.lastUpdated.toDate() 
        : new Date(statsData.lastUpdated);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Extended from 1 hour
      
      // If stats are recent (less than 24 hours old), use them
      if (lastUpdated && lastUpdated > twentyFourHoursAgo && statsData.animeWithQuestions) {
        console.log('🗃️  Using Firestore metadata cache for anime data (very fast)');
        
        // Update memory cache with longer TTL
        memoryCache = {
          data: statsData.animeWithQuestions,
          timestamp: now,
          ttl: 30 * 60 * 1000
        };
        
        return statsData.animeWithQuestions;
      }
    }

    // Level 3: Generate using optimized method
    console.log('🔄 Generating anime data using optimized aggregation queries...');
    return await generateAnimeStatsOptimized();
    
  } catch (error) {
    console.error('Error in getAnimeWithQuestionsCached:', error);
    
    // If all else fails, try memory cache even if stale
    if (memoryCache.data) {
      console.log('⚠️  Using stale memory cache as fallback');
      return memoryCache.data;
    }
    
    // Last resort: try to get any cached data, even if old
    try {
      const statsDoc = await getDoc(doc(firestore, 'metadata', 'animeStats'));
      if (statsDoc.exists()) {
        const statsData = statsDoc.data() as AnimeMetadata;
        if (statsData.animeWithQuestions) {
          console.log('🆘 Using old cached data as last resort');
          return statsData.animeWithQuestions;
        }
      }
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
    }
    
    return [];
  }
};

/**
 * OPTIMIZED: Generate anime stats using aggregation queries instead of full document scan
 */
const generateAnimeStatsOptimized = async (): Promise<AnimeWithQuestions[]> => {
  try {
    console.log('📊 Using optimized aggregation approach...');
    
    // STRATEGY 1: Try to get unique anime IDs first, then count for each
    const animeIds = await getUniqueAnimeIds();
    
    if (animeIds.length === 0) {
      console.warn('No anime found in questions collection');
      return [];
    }

    console.log(`Found ${animeIds.length} unique anime, counting questions for each...`);
    
    // STRATEGY 2: Use aggregation queries to count questions per anime
    const animeWithQuestions: AnimeWithQuestions[] = [];
    
    // Process in batches to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < animeIds.length; i += batchSize) {
      const batch = animeIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (anime) => {
        try {
          // Use count aggregation query instead of fetching all documents
          const countQuery = query(
            collection(firestore, 'questions'),
            where('animeId', '==', anime.animeId)
          );
          
          const countSnapshot = await getCountFromServer(countQuery);
          const questionCount = countSnapshot.data().count;
          
          if (questionCount >= 100) { // Only include anime with 100+ questions
            return {
              animeId: anime.animeId,
              animeName: anime.animeName,
              questionCount: questionCount
            };
          }
          return null;
        } catch (error) {
          console.warn(`Error counting questions for anime ${anime.animeId}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null) as AnimeWithQuestions[];
      animeWithQuestions.push(...validResults);
      
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(animeIds.length/batchSize)}`);
    }

    const now = new Date();
    
    // Cache the results with version number
    const metadataToCache: AnimeMetadata = {
      animeWithQuestions,
      lastUpdated: now,
      totalQuestions: animeWithQuestions.reduce((sum, anime) => sum + anime.questionCount, 0),
      generatedAt: now,
      version: 2 // Increment version for cache invalidation
    };

    try {
      await setDoc(doc(firestore, 'metadata', 'animeStats'), metadataToCache);
      console.log('💾 Successfully cached optimized anime stats to Firestore');
    } catch (cacheError) {
      console.warn('⚠️  Failed to cache anime stats to Firestore:', cacheError);
    }

    // Cache in memory with longer TTL
    memoryCache = {
      data: animeWithQuestions,
      timestamp: Date.now(),
      ttl: 30 * 60 * 1000
    };

    console.log(`✅ Generated optimized stats for ${animeWithQuestions.length} anime`);
    return animeWithQuestions;
    
  } catch (error) {
    console.error('Error in optimized anime stats generation:', error);
    
    // Fallback to the old method if the optimized one fails
    console.log('🔄 Falling back to legacy method...');
    return await generateAnimeStatsLegacy();
  }
};

/**
 * Get unique anime IDs efficiently
 */
const getUniqueAnimeIds = async (): Promise<Array<{animeId: number, animeName: string}>> => {
  try {
    // Get a sample of questions to find unique anime IDs
    // This is much faster than scanning all questions
    const sampleQuery = query(
      collection(firestore, 'questions'),
      where('animeId', '!=', null)
    );
    
    const sampleSnapshot = await getDocs(sampleQuery);
    const animeMap: { [key: number]: string } = {};
    
    // Collect unique anime IDs and names
    sampleSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.animeId && data.animeName) {
        animeMap[data.animeId] = data.animeName;
      }
    });
    
    return Object.entries(animeMap).map(([animeId, animeName]) => ({
      animeId: parseInt(animeId),
      animeName: animeName
    }));
    
  } catch (error) {
    console.error('Error getting unique anime IDs:', error);
    return [];
  }
};

/**
 * Legacy method as fallback (the original slow method)
 */
const generateAnimeStatsLegacy = async (): Promise<AnimeWithQuestions[]> => {
  try {
    console.log('📊 Using legacy method (slower)...');
    
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

    const animeWithQuestions: AnimeWithQuestions[] = Object.entries(animeQuestionCount)
      .filter(([animeId, info]) => info.count >= 100)
      .map(([animeId, info]) => ({
        animeId: parseInt(animeId),
        animeName: info.name,
        questionCount: info.count
      }));

    const now = new Date();
    
    // Cache the results
    const metadataToCache: AnimeMetadata = {
      animeWithQuestions,
      lastUpdated: now,
      totalQuestions,
      generatedAt: now,
      version: 2
    };

    try {
      await setDoc(doc(firestore, 'metadata', 'animeStats'), metadataToCache);
      console.log('💾 Successfully cached legacy anime stats to Firestore');
    } catch (cacheError) {
      console.warn('⚠️  Failed to cache anime stats to Firestore:', cacheError);
    }

    // Cache in memory
    memoryCache = {
      data: animeWithQuestions,
      timestamp: Date.now(),
      ttl: 30 * 60 * 1000
    };

    console.log(`✅ Generated legacy stats for ${animeWithQuestions.length} anime with ${totalQuestions} total questions`);
    return animeWithQuestions;
    
  } catch (error) {
    console.error('Error generating legacy anime stats:', error);
    throw error;
  }
};

/**
 * ENHANCED: Invalidate all caches with version bump
 */
export const invalidateAnimeCache = async (): Promise<void> => {
  console.log('🗑️  Invalidating anime caches...');
  
  // Clear memory cache
  memoryCache = {
    data: null,
    timestamp: 0,
    ttl: 30 * 60 * 1000
  };

  try {
    // Force refresh by setting old timestamp and bumping version
    await setDoc(doc(firestore, 'metadata', 'animeStats'), {
      lastUpdated: new Date(0), // Set to epoch to force refresh
      animeWithQuestions: [],
      totalQuestions: 0,
      generatedAt: new Date(),
      version: 3 // Bump version to invalidate any existing caches
    });
    console.log('✅ Successfully invalidated Firestore cache');
  } catch (error) {
    console.warn('⚠️  Failed to invalidate Firestore cache:', error);
  }
};

/**
 * ENHANCED: Preload anime data with better error handling
 */
export const preloadAnimeData = async (): Promise<void> => {
  try {
    console.log('🚀 Preloading anime data in background...');
    const startTime = Date.now();
    
    await getAnimeWithQuestionsCached();
    
    const loadTime = Date.now() - startTime;
    console.log(`✅ Anime data preloaded successfully in ${loadTime}ms`);
  } catch (error) {
    console.warn('⚠️  Failed to preload anime data:', error);
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
    ttlMinutes: number;
  };
} => {
  const now = Date.now();
  const ageMs = now - memoryCache.timestamp;
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  const ttlMinutes = Math.floor(memoryCache.ttl / (60 * 1000));
  
  return {
    memoryCache: {
      hasData: !!memoryCache.data,
      ageMinutes,
      isValid: ageMs < memoryCache.ttl,
      ttlMinutes
    }
  };
};

/**
 * Force a fresh reload of anime data (for admin use)
 */
export const forceRefreshAnimeData = async (): Promise<AnimeWithQuestions[]> => {
  console.log('🔄 Force refreshing anime data...');
  
  // Clear all caches
  await invalidateAnimeCache();
  
  // Force regeneration
  return await generateAnimeStatsOptimized();
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
    const lastUpdated = statsData.lastUpdated instanceof Timestamp 
      ? statsData.lastUpdated.toDate() 
      : new Date(statsData.lastUpdated);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Extended from 6 hours
    
    return lastUpdated < twentyFourHoursAgo;
  } catch (error) {
    console.error('Error checking cache freshness:', error);
    return true;
  }
};
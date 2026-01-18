import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORIES_KEY = '@gallery_categories';
const CATEGORY_CACHE_KEY = '@gallery_category_cache';

// Category definitions
export const CATEGORIES = {
  PEOPLE: {
    id: 'people',
    name: 'People',
    icon: 'people-outline',
    description: 'Photos with people',
    keywords: ['person', 'people', 'face', 'portrait', 'selfie', 'group', 'family', 'friends'],
  },
  BEACH: {
    id: 'beach',
    name: 'Beach',
    icon: 'beach-outline',
    description: 'Beach photos',
    keywords: ['beach', 'ocean', 'sea', 'sand', 'shore', 'coast', 'seaside', 'waves'],
  },
  NATURE: {
    id: 'nature',
    name: 'Nature',
    icon: 'leaf-outline',
    description: 'Nature and landscapes',
    keywords: ['nature', 'landscape', 'mountain', 'forest', 'tree', 'flower', 'sunset', 'sunrise', 'sky'],
  },
  FOOD: {
    id: 'food',
    name: 'Food',
    icon: 'restaurant-outline',
    description: 'Food and drinks',
    keywords: ['food', 'meal', 'restaurant', 'dish', 'cooking', 'dinner', 'lunch', 'breakfast'],
  },
  PETS: {
    id: 'pets',
    name: 'Pets',
    icon: 'paw-outline',
    description: 'Pets and animals',
    keywords: ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten', 'bird', 'fish'],
  },
  TRAVEL: {
    id: 'travel',
    name: 'Travel',
    icon: 'airplane-outline',
    description: 'Travel destinations',
    keywords: ['travel', 'vacation', 'trip', 'holiday', 'destination', 'tourist', 'sightseeing'],
  },
  VEHICLES: {
    id: 'vehicles',
    name: 'Vehicles',
    icon: 'car-outline',
    description: 'Cars and vehicles',
    keywords: ['car', 'vehicle', 'bike', 'motorcycle', 'truck', 'bus', 'automobile'],
  },
  SPORTS: {
    id: 'sports',
    name: 'Sports',
    icon: 'football-outline',
    description: 'Sports and activities',
    keywords: ['sport', 'game', 'football', 'basketball', 'soccer', 'tennis', 'gym', 'fitness'],
  },
};

// Analyze media item and return matching categories (synchronous for speed)
const analyzeMediaItem = (mediaItem) => {
  const categories = [];
  const filename = (mediaItem.filename || '').toLowerCase();
  const uri = (mediaItem.uri || '').toLowerCase();
  
  // Check each category based on filename and URI
  Object.values(CATEGORIES).forEach(category => {
    const matches = category.keywords.some(keyword => 
      filename.includes(keyword) || uri.includes(keyword)
    );
    
    if (matches) {
      categories.push(category.id);
    }
  });
  
  // If no categories found, try to infer from common patterns
  if (categories.length === 0) {
    // Check for common photo patterns
    if (filename.includes('img') || filename.includes('photo') || filename.includes('pic')) {
      // Could be any category, but we'll leave it uncategorized for now
    }
  }
  
  return categories;
};

// Categorize all media items
export const categorizeMedia = async (mediaItems) => {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(CATEGORY_CACHE_KEY);
    if (cached) {
      const cacheData = JSON.parse(cached);
      const cacheTime = cacheData.timestamp || 0;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      // Use cache if it's less than 24 hours old
      if (cacheTime > oneDayAgo && cacheData.categories) {
        return cacheData.categories;
      }
    }
    
    const categorized = {};
    
    // Initialize categories
    Object.keys(CATEGORIES).forEach(key => {
      categorized[CATEGORIES[key].id] = [];
    });
    
    // Categorize each media item (batch process for better performance)
    const batchSize = 50;
    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize);
      
      batch.forEach(item => {
        if (!item) return;
        const itemCategories = analyzeMediaItem(item);
        
        itemCategories.forEach(categoryId => {
          if (!categorized[categoryId]) {
            categorized[categoryId] = [];
          }
          categorized[categoryId].push(item);
        });
      });
    }
    
    // Cache the results
    await AsyncStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      categories: categorized,
    }));
    
    return categorized;
  } catch (error) {
    console.error('Error categorizing media:', error);
    return {};
  }
};

// Get media for a specific category
export const getMediaForCategory = async (categoryId, allMedia) => {
  const categorized = await categorizeMedia(allMedia);
  return categorized[categoryId] || [];
};

// Clear category cache
export const clearCategoryCache = async () => {
  await AsyncStorage.removeItem(CATEGORY_CACHE_KEY);
};


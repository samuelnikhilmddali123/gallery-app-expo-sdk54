import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================================
// 🔑 ADD YOUR GOOGLE CLOUD VISION API KEY HERE
// Get it from: https://console.cloud.google.com → APIs → Vision API
// =====================================================================
const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

const AI_CACHE_KEY = 'ai_smart_albums_cache';

// Label rules for each smart album category
const CATEGORY_RULES = {
  goodPics: {
    title: 'Good Pics ✨',
    icon: 'sparkles',
    color: '#FFD700',
    positiveLabels: [
      'smile', 'happy', 'celebration', 'party', 'sunset', 'sunrise',
      'landscape', 'nature', 'food', 'beauty', 'vacation', 'travel',
      'portrait', 'photography', 'art'
    ],
    minScore: 0.75,
  },
  familyPics: {
    title: 'Family Pics 👨‍👩‍👧',
    icon: 'people',
    color: '#7B61FF',
    minFaces: 2,
    positiveLabels: [
      'family', 'group', 'people', 'children', 'child', 'baby',
      'wedding', 'birthday', 'gathering', 'reunion', 'event', 'fun'
    ],
    minScore: 0.65,
  },
  selfies: {
    title: 'Selfies 🤳',
    icon: 'camera-reverse',
    color: '#FF6B6B',
    minFaces: 1,
    maxFaces: 1,
    positiveLabels: ['selfie', 'portrait', 'person', 'face'],
    minScore: 0.65,
  },
};

/**
 * Converts a local media URI to base64 for Vision API
 */
async function uriToBase64(uri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (e) {
    console.warn('aiService: Failed to read image as base64:', e.message);
    return null;
  }
}

/**
 * Calls Google Vision API for a single image
 */
async function analyzeImage(base64Image) {
  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 15 },
          { type: 'FACE_DETECTION', maxResults: 10 },
          { type: 'SAFE_SEARCH_DETECTION' },
        ],
      },
    ],
  };

  const response = await fetch(VISION_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vision API error: ${err}`);
  }

  const data = await response.json();
  return data.responses?.[0] || null;
}

/**
 * Classify a single Vision API response into categories
 */
function classifyResponse(visionResponse) {
  if (!visionResponse) return [];

  const labels = (visionResponse.labelAnnotations || []).map(l => ({
    description: l.description.toLowerCase(),
    score: l.score,
  }));

  const faceCount = (visionResponse.faceAnnotations || []).length;
  const safeSearch = visionResponse.safeSearchAnnotation || {};

  // Filter out explicit content
  const isExplicit = ['LIKELY', 'VERY_LIKELY'].includes(safeSearch.adult) ||
                     ['LIKELY', 'VERY_LIKELY'].includes(safeSearch.violence);
  if (isExplicit) return [];

  const categories = [];

  // Check Good Pics
  const goodPicsMatch = labels.some(
    l => CATEGORY_RULES.goodPics.positiveLabels.some(kw => l.description.includes(kw)) &&
         l.score >= CATEGORY_RULES.goodPics.minScore
  );
  if (goodPicsMatch) categories.push('goodPics');

  // Check Family Pics
  const hasManyFaces = faceCount >= CATEGORY_RULES.familyPics.minFaces;
  const familyLabelMatch = labels.some(
    l => CATEGORY_RULES.familyPics.positiveLabels.some(kw => l.description.includes(kw)) &&
         l.score >= CATEGORY_RULES.familyPics.minScore
  );
  if (hasManyFaces || familyLabelMatch) categories.push('familyPics');

  // Check Selfies (exactly 1 face)
  if (faceCount === 1) categories.push('selfies');

  return categories;
}

/**
 * Main function: Scan a batch of media items with AI
 * @param {Array} mediaItems - Array of {id, uri} objects
 * @param {Function} onProgress - Callback(current, total, categoryKey, mediaId)
 * @returns {Object} { goodPics: [...ids], familyPics: [...ids], selfies: [...ids] }
 */
export async function scanGalleryWithAI(mediaItems, onProgress) {
  // Check for API key
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'YOUR_GOOGLE_VISION_API_KEY') {
    throw new Error('NO_API_KEY');
  }

  const results = { goodPics: [], familyPics: [], selfies: [] };
  const total = Math.min(mediaItems.length, 50); // Limit to 50 to avoid excessive API calls

  for (let i = 0; i < total; i++) {
    const item = mediaItems[i];
    onProgress?.(i + 1, total, null, item.id);

    try {
      const base64 = await uriToBase64(item.uri);
      if (!base64) continue;

      const visionResult = await analyzeImage(base64);
      const categories = classifyResponse(visionResult);

      categories.forEach(cat => {
        if (results[cat]) results[cat].push(item.id);
      });
    } catch (e) {
      console.warn(`aiService: Failed to analyze ${item.id}:`, e.message);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Cache the results
  await AsyncStorage.setItem(AI_CACHE_KEY, JSON.stringify({
    results,
    scannedAt: Date.now(),
    total,
  }));

  return results;
}

/**
 * Load previously cached AI results
 */
export async function loadCachedAIResults() {
  try {
    const raw = await AsyncStorage.getItem(AI_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear AI results cache
 */
export async function clearAICache() {
  await AsyncStorage.removeItem(AI_CACHE_KEY);
}

export { CATEGORY_RULES };

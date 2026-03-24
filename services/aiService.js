import AsyncStorage from '@react-native-async-storage/async-storage';

let FaceDetectorLocal = null;
try {
  // Use a conditional import for native module to prevent app crash
  FaceDetectorLocal = require('expo-face-detector');
} catch (e) {
  console.warn('aiService: FaceDetector not available in this runtime');
}

const AI_CACHE_KEY = 'ai_smart_albums_cache_v2';

export const CATEGORY_RULES = {
  goodPics: {
    title: 'Good Pics ✨',
    icon: 'sparkles',
    color: '#FFD700',
    description: 'High quality smiles and clear faces',
  },
  familyPics: {
    title: 'Family Pics 👨‍👩‍👧',
    icon: 'people',
    color: '#7B61FF',
    description: 'Group photos with 2 or more people',
  },
  selfies: {
    title: 'Selfies 🤳',
    icon: 'camera-reverse',
    color: '#FF6B6B',
    description: 'Individual portraits',
  },
};

/**
 * Check if AI module is available in current runtime
 */
export async function isAIAvailable() {
  if (!FaceDetectorLocal) return false;
  try {
    // Some versions of expo-face-detector use isAvailableAsync
    if (FaceDetectorLocal.isAvailableAsync) {
      return await FaceDetectorLocal.isAvailableAsync();
    }
    return !!FaceDetectorLocal.detectFacesAsync;
  } catch {
    return false;
  }
}

/**
 * On-device analysis using FaceDetector
 */
async function analyzeImageLocally(uri) {
  if (!FaceDetectorLocal || !FaceDetectorLocal.detectFacesAsync) return null;
  
  try {
    const options = {
      mode: FaceDetectorLocal.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetectorLocal.FaceDetectorLandmarks.none,
      runClassifications: FaceDetectorLocal.FaceDetectorClassifications.all,
      minDetectionInterval: 100,
      tracking: false,
    };

    const result = await FaceDetectorLocal.detectFacesAsync(uri, options);
    return result;
  } catch (e) {
    console.warn('aiService: Local analysis failed for', uri, e.message);
    return null;
  }
}

/**
 * Classify based on face detection results
 */
function classifyLocalResult(faceData) {
  if (!faceData || !faceData.faces) return [];

  const faces = faceData.faces;
  const faceCount = faces.length;
  const categories = [];

  // 1. Family Pics: 2 or more faces
  if (faceCount >= 2) {
    categories.push('familyPics');
  }

  // 2. Selfies: Exactly 1 face
  if (faceCount === 1) {
    categories.push('selfies');
  }

  // 3. Good Pics: High smile probability or clear faces
  // If anyone is smiling > 70%, or if it's a clear group photo
  const isSmiling = faces.some(face => (face.smilingProbability || 0) > 0.7);
  const areEyesOpen = faces.every(face => 
    (face.leftEyeOpenProbability === undefined || face.leftEyeOpenProbability > 0.5) &&
    (face.rightEyeOpenProbability === undefined || face.rightEyeOpenProbability > 0.5)
  );

  if ((isSmiling || faceCount > 2) && areEyesOpen) {
    categories.push('goodPics');
  }

  return categories;
}

/**
 * Main function: Scan a batch of media items locally
 */
export async function scanGalleryWithAI(mediaItems, onProgress) {
  const results = { goodPics: [], familyPics: [], selfies: [] };
  const total = mediaItems.length;

  for (let i = 0; i < total; i++) {
    const item = mediaItems[i];
    onProgress?.(i + 1, total, null, item.id);

    try {
      const faceData = await analyzeImageLocally(item.uri);
      const categories = classifyLocalResult(faceData);

      categories.forEach(cat => {
        if (results[cat]) results[cat].push(item.id);
      });
    } catch (e) {
      console.warn(`aiService: Error scanning item ${item.id}:`, e.message);
    }

    // YIELD THE THREAD every 5 items to keep the UI responsive and prevent ANR
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  // Cache results
  await AsyncStorage.setItem(AI_CACHE_KEY, JSON.stringify({
    results,
    scannedAt: Date.now(),
    total,
  }));

  return results;
}

/**
 * Load cached results
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
 * Clear cache
 */
export async function clearAICache() {
  await AsyncStorage.removeItem(AI_CACHE_KEY);
}

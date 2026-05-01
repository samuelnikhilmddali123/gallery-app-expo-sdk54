import AsyncStorage from '@react-native-async-storage/async-storage';

let FaceDetectorLocal = null;
try {
  // FaceDetector is deprecated and may be missing in newer SDKs
  FaceDetectorLocal = require('expo-face-detector');
} catch (e) {
  // Silent catch - feature will be disabled via isAIAvailable()
}

const AI_CACHE_KEY = 'ai_smart_albums_cache_v3'; // Bump version for new logic

const NATURE_KEYWORDS = [
  'beach', 'ocean', 'sea', 'sand', 'shore', 'coast', 'seaside', 'waves',
  'nature', 'landscape', 'mountain', 'forest', 'tree', 'flower', 'sunset', 'sunrise', 'sky',
  'park', 'garden', 'outdoor', 'field', 'valley', 'lake', 'river', 'waterfall'
];

export const CATEGORY_RULES = {
  goodPics: {
    title: 'Good Pics ✨',
    icon: 'sparkles',
    color: '#FFD700',
    description: 'Beautiful nature and landscape photos',
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
    description: 'Portraits and photos matching you',
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
export async function analyzeImageLocally(uri) {
  if (!FaceDetectorLocal || !FaceDetectorLocal.detectFacesAsync) return null;
  
  try {
    const options = {
      mode: FaceDetectorLocal.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetectorLocal.FaceDetectorLandmarks.all, // Need landmarks for matching
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
 * Generate a mathematical "signature" for a face based on landmark ratios.
 * This is a lightweight way to compare faces without a full recognition model.
 */
function getFaceSignature(face) {
  if (!face || !face.leftEyePosition || !face.rightEyePosition || !face.noseBasePosition) return null;
  
  const lx = face.leftEyePosition.x;
  const ly = face.leftEyePosition.y;
  const rx = face.rightEyePosition.x;
  const ry = face.rightEyePosition.y;
  const nx = face.noseBasePosition.x;
  const ny = face.noseBasePosition.y;
  
  // Distances
  const eyeDist = Math.sqrt(Math.pow(rx - lx, 2) + Math.pow(ry - ly, 2));
  const eyeToNoseL = Math.sqrt(Math.pow(nx - lx, 2) + Math.pow(ny - ly, 2));
  const eyeToNoseR = Math.sqrt(Math.pow(nx - rx, 2) + Math.pow(ny - ry, 2));
  const avgEyeToNose = (eyeToNoseL + eyeToNoseR) / 2;
  
  if (eyeDist < 1) return null; // Too small or invalid
  
  const signature = {
    ratio_eye_nose: avgEyeToNose / eyeDist,
  };

  // Optional: mouth ratio if available
  if (face.mouthPosition) {
    const mx = face.mouthPosition.x;
    const my = face.mouthPosition.y;
    const eyeToMouth = Math.sqrt(Math.pow(mx - (lx + rx)/2, 2) + Math.pow(my - (ly + ry)/2, 2));
    signature.ratio_eye_mouth = eyeToMouth / eyeDist;
  }

  return signature;
}

/**
 * Compare two face signatures with a tolerance
 */
function isFaceMatch(sig1, sig2) {
  if (!sig1 || !sig2) return false;
  
  const diff1 = Math.abs(sig1.ratio_eye_nose - sig2.ratio_eye_nose);
  let diff2 = 0;
  if (sig1.ratio_eye_mouth && sig2.ratio_eye_mouth) {
    diff2 = Math.abs(sig1.ratio_eye_mouth - sig2.ratio_eye_mouth);
  }

  // Tight tolerance for ratios
  return diff1 < 0.08 && diff2 < 0.12;
}

/**
 * Classify based on face detection results and metadata
 */
function classifyLocalResult(faceData, itemUri, profileSignature = null) {
  const categories = [];
  const faces = faceData?.faces || [];
  const faceCount = faces.length;
  const uri = (itemUri || '').toLowerCase();

  // 1. Family Pics: 2 or more faces
  if (faceCount >= 2) {
    categories.push('familyPics');
  }

  // 2. Selfies / Me: Exactly 1 face, or matches profile
  const hasProfileMatch = profileSignature && faces.some(f => {
    const sig = getFaceSignature(f);
    return isFaceMatch(sig, profileSignature);
  });

  if (faceCount === 1 || hasProfileMatch) {
    categories.push('selfies');
  }

  // 3. Good Pics: ONLY nature/beaches as requested
  const isNature = NATURE_KEYWORDS.some(keyword => uri.includes(keyword));

  if (isNature) {
    categories.push('goodPics');
  }

  return categories;
}

/**
 * Main function: Scan a batch of media items locally
 */
export async function scanGalleryWithAI(mediaItems, onProgress, profileImageUri = null) {
  const results = { goodPics: [], familyPics: [], selfies: [] };
  const total = mediaItems.length;

  // 1. Get profile signature if provided
  let profileSignature = null;
  if (profileImageUri) {
    try {
      const profileData = await analyzeImageLocally(profileImageUri);
      if (profileData && profileData.faces && profileData.faces.length > 0) {
        profileSignature = getFaceSignature(profileData.faces[0]);
      }
    } catch (e) {
      console.warn('aiService: Profile analysis failed', e.message);
    }
  }

  for (let i = 0; i < total; i++) {
    const item = mediaItems[i];
    onProgress?.(i + 1, total, null, item.id);

    try {
      const faceData = await analyzeImageLocally(item.uri);
      const categories = classifyLocalResult(faceData, item.uri, profileSignature);

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

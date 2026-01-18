import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moveMediaToAppTrash } from './trashService';

const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;
const VAULT_METADATA_KEY = 'vault_metadata';
const TRASH_KEY = '@gallery_trash';

// Ensure vault directory exists
export const ensureVaultDirectory = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
    }
    return true;
  } catch (error) {
    console.error('Error ensuring vault directory:', error);
    return false;
  }
};

// Cache for vault media IDs (for fast filtering)
let vaultMediaIdsCache = null;
let vaultMediaCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

// Get all vault media metadata - optimized with caching
export const getVaultMedia = async (skipFileCheck = false, ignoreCache = false) => {
  try {
    // Return cached data if available and recent (unless ignoring cache)
    const now = Date.now();
    if (!ignoreCache && vaultMediaCache && (now - cacheTimestamp) < CACHE_DURATION && skipFileCheck) {
      return vaultMediaCache;
    }

    await ensureVaultDirectory();
    const metadataJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
    if (!metadataJson) {
      vaultMediaCache = [];
      vaultMediaIdsCache = new Set();
      return [];
    }

    const metadata = JSON.parse(metadataJson);

    // Skip file existence check for faster loading (only check when needed)
    if (skipFileCheck) {
      vaultMediaCache = metadata;
      vaultMediaIdsCache = new Set(metadata.map(m => m.originalId).filter(Boolean));
      cacheTimestamp = now;
      return metadata;
    }

    // Verify files still exist (only when skipFileCheck is false) - optimized batch check
    const existingMedia = [];
    const itemsToCheck = metadata.slice(0, 20); // Limit to 20 checks for speed
    const remainingItems = metadata.slice(20);

    // Check files in parallel (limited batch)
    const checkPromises = itemsToCheck.map(async (item) => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(item.filePath);
        return fileInfo.exists ? item : null;
      } catch (error) {
        return null; // Skip if file check fails
      }
    });

    const checkedItems = await Promise.all(checkPromises);
    existingMedia.push(...checkedItems.filter(Boolean));

    // Add remaining items without checking (optimization - assume they exist)
    existingMedia.push(...remainingItems);

    // Update metadata if some files were deleted
    if (existingMedia.length !== metadata.length) {
      await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(existingMedia));
    }

    vaultMediaCache = existingMedia;
    vaultMediaIdsCache = new Set(existingMedia.map(m => m.originalId).filter(Boolean));
    cacheTimestamp = now;

    return existingMedia;
  } catch (error) {
    console.error('Error getting vault media:', error);
    return [];
  }
};

// Get vault media IDs for fast filtering (cached)
export const getVaultMediaIds = async () => {
  if (vaultMediaIdsCache) {
    return vaultMediaIdsCache;
  }
  await getVaultMedia(true);
  return vaultMediaIdsCache || new Set();
};

// Add media to vault
export const addMediaToVault = async (mediaItem, sourceUri) => {
  try {
    await ensureVaultDirectory();

    // Generate unique filename
    const timestamp = Date.now();
    const extension = mediaItem.filename?.split('.').pop() || (mediaItem.mediaType === 'video' ? 'mp4' : 'jpg');
    const vaultFilename = `vault_${timestamp}_${mediaItem.id || timestamp}.${extension}`;
    const vaultFilePath = `${VAULT_DIR}${vaultFilename}`;

    // Copy file to vault
    await FileSystem.copyAsync({
      from: sourceUri,
      to: vaultFilePath,
    });

    // Create metadata
    const metadata = {
      id: mediaItem.id || `vault_${timestamp}`,
      originalId: mediaItem.id,
      filename: vaultFilename,
      originalFilename: mediaItem.filename,
      filePath: vaultFilePath,
      uri: vaultFilePath,
      mediaType: mediaItem.mediaType || (mediaItem.duration ? 'video' : 'photo'),
      width: mediaItem.width,
      height: mediaItem.height,
      duration: mediaItem.duration,
      creationTime: mediaItem.creationTime || timestamp,
      createdAt: timestamp,
    };

    // Save metadata
    const existingMetadata = await getVaultMedia(true); // Use cache for speed
    existingMetadata.push(metadata);
    await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(existingMetadata));

    // Clear cache to force refresh
    clearVaultCache();

    return metadata;
  } catch (error) {
    console.error('Error adding media to vault:', error);
    throw error;
  }
};

// Clear vault cache (call when vault media changes)
export const clearVaultCache = () => {
  vaultMediaIdsCache = null;
  vaultMediaCache = null;
  cacheTimestamp = 0;
};

// Remove media from vault (Move to Trash)
export const removeMediaFromVault = async (mediaId) => {
  try {
    const metadata = await getVaultMedia(true); // Use cache for speed
    const item = metadata.find(m => m.id === mediaId);

    if (!item) return false;

    // Move to Trash first
    await moveMediaToAppTrash(item);

    // Delete file from Vault (original)
    const fileInfo = await FileSystem.getInfoAsync(item.filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(item.filePath, { idempotent: true });
    }

    // Remove from vault metadata
    const updatedMetadata = metadata.filter(m => m.id !== mediaId);
    await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(updatedMetadata));

    // Clear cache
    clearVaultCache();

    return true;
  } catch (error) {
    console.error('Error removing media from vault:', error);
    return false;
  }
};

// Restore media to vault from trash
export const restoreMediaToVault = async (trashItem) => {
  try {
    await ensureVaultDirectory();

    // 1. Move file back to vault
    // Use original filename if available, or generate one
    // trashItem.filePath points to trash/file
    // We want to move it to vault/file

    const originalFilename = trashItem.originalFilename || trashItem.filename || `restored_${Date.now()}.jpg`;
    const targetPath = `${VAULT_DIR}${originalFilename}`; // Try to maintain original name

    // Handle potential name collision
    let finalPath = targetPath;
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      // If file exists (somehow), rename
      const ext = originalFilename.split('.').pop();
      const name = originalFilename.replace(`.${ext}`, '');
      finalPath = `${VAULT_DIR}${name}_restored_${Date.now()}.${ext}`;
    }

    // Move file
    if (trashItem.filePath) {
      await FileSystem.moveAsync({
        from: trashItem.filePath,
        to: finalPath
      });
    }

    // 2. Add back to Vault Metadata
    // We need to reconstruct the metadata object. 
    // trashItem has most fields, but we should ensure it looks like vault metadata
    const restoredMetadata = {
      id: trashItem.originalId || trashItem.id, // Should be 'vault_...'
      originalId: trashItem.originalId || trashItem.id,
      filename: finalPath.split('/').pop(),
      originalFilename: trashItem.originalFilename,
      filePath: finalPath,
      uri: finalPath,
      mediaType: trashItem.mediaType,
      width: trashItem.width,
      height: trashItem.height,
      duration: trashItem.duration,
      creationTime: trashItem.creationTime,
      createdAt: trashItem.createdAt || Date.now(),
      restoredAt: Date.now()
    };

    const existingMetadata = await getVaultMedia(true);
    existingMetadata.push(restoredMetadata);
    await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(existingMetadata));

    // 3. Remove from Trash List
    const trashData = await AsyncStorage.getItem(TRASH_KEY);
    if (trashData) {
      const trashItems = JSON.parse(trashData);
      const updatedTrash = trashItems.filter(t => t.id !== trashItem.id);
      await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));
    }

    clearVaultCache();
    return true;

  } catch (error) {
    console.error('Error restoring media to vault:', error);
    throw error;
  }
};

// Check if media is in vault
export const isMediaInVault = async (mediaId) => {
  try {
    const vaultMedia = await getVaultMedia();
    return vaultMedia.some(m => m.originalId === mediaId || m.id === mediaId);
  } catch (error) {
    console.error('Error checking if media in vault:', error);
    return false;
  }
};

// Get vault directory path
export const getVaultDirectory = () => VAULT_DIR;

// Delete entire vault (all files and metadata)
export const deleteVault = async () => {
  try {
    // Get all vault media first
    const metadata = await getVaultMedia();

    // Delete all vault files
    for (const item of metadata) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(item.filePath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(item.filePath, { idempotent: true });
        }
      } catch (error) {
        console.error(`Error deleting vault file ${item.filePath}:`, error);
      }
    }

    // Delete vault directory if it exists
    try {
      const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(VAULT_DIR, { idempotent: true });
      }
    } catch (error) {
      console.error('Error deleting vault directory:', error);
    }

    // Clear metadata
    await AsyncStorage.removeItem(VAULT_METADATA_KEY);

    return true;
  } catch (error) {
    console.error('Error deleting vault:', error);
    return false;
  }
};


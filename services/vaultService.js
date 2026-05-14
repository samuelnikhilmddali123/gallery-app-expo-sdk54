import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as MediaLibrary from 'expo-media-library';
import { moveMediaToAppTrash } from './trashService';

// Use app-private storage which is always writable and hidden from gallery scanners
const VAULT_DIR = FileSystem.documentDirectory + '.vault/';
const VAULT_METADATA_KEY = 'vault_metadata_v2';
const OLD_VAULT_METADATA_KEY = 'vault_metadata';
const OLD_PUBLIC_VAULT_DIR = `file:///storage/emulated/0/Android/media/${Constants.expoConfig?.android?.package || 'com.anonymous.galleryapp'}/.vault/`;

// Ensure vault directory exists and handle migration
export const ensureVaultDirectory = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
      // Create .nomedia file (extra safety, though documentDirectory is already private)
      await FileSystem.writeAsStringAsync(`${VAULT_DIR}.nomedia`, '');
      console.log('[VaultService] Vault directory created in private storage.');
    }

    // Attempt to migrate from public directory if it exists and is readable
    await migrateFromPublicVault();

    return true;
  } catch (error) {
    console.error('Error ensuring vault directory:', error);
    return false;
  }
};

const migrateFromPublicVault = async () => {
  try {
    const publicDirInfo = await FileSystem.getInfoAsync(OLD_PUBLIC_VAULT_DIR);
    if (publicDirInfo.exists) {
      console.log('Found legacy public vault, attempting migration...');
      const files = await FileSystem.readDirectoryAsync(OLD_PUBLIC_VAULT_DIR);
      
      for (const filename of files) {
        if (filename === '.nomedia') continue;
        const oldPath = `${OLD_PUBLIC_VAULT_DIR}${filename}`;
        const newPath = `${VAULT_DIR}${filename}`;
        try {
          await FileSystem.moveAsync({ from: oldPath, to: newPath });
          console.log(`Migrated ${filename} to private storage.`);
        } catch (e) {
          // If we can't move (permission), we just skip
        }
      }
      
      // Cleanup public dir if empty
      try {
        await FileSystem.deleteAsync(OLD_PUBLIC_VAULT_DIR, { idempotent: true });
      } catch (e) {}
    }
  } catch (e) {
    // Ignore migration errors
  }
};


// Cache for vault media IDs (for fast filtering)
let vaultMediaIdsCache = null;
let vaultMediaCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

// Get all vault media metadata by scanning the hidden directory
export const getVaultMedia = async (skipFileCheck = false, ignoreCache = false) => {
  try {
    const now = Date.now();
    if (!ignoreCache && vaultMediaCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return vaultMediaCache;
    }

    await ensureVaultDirectory();
    
    // 1. Scan the physical directory
    const files = await FileSystem.readDirectoryAsync(VAULT_DIR);
    const mediaFiles = files.filter(f => f !== '.nomedia');

    // 2. Load metadata to match files with their original info
    const metadataJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
    const metadataMap = metadataJson ? JSON.parse(metadataJson) : {};
    
    const vaultItems = [];
    
    for (const filename of mediaFiles) {
      const filePath = `${VAULT_DIR}${filename}`;
      const itemMetadata = metadataMap[filename] || {};
      
      // If we have metadata, use it, otherwise create basic metadata from file
      vaultItems.push({
        id: itemMetadata.id || `vault_${filename}`,
        originalId: itemMetadata.originalId,
        filename: filename,
        originalFilename: itemMetadata.originalFilename || filename,
        filePath: filePath,
        uri: filePath,
        mediaType: itemMetadata.mediaType || (filename.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'photo'),
        width: itemMetadata.width,
        height: itemMetadata.height,
        duration: itemMetadata.duration,
        creationTime: itemMetadata.creationTime || now,
        createdAt: itemMetadata.createdAt || now,
      });
    }

    // Sort by creation time (newest first)
    vaultItems.sort((a, b) => b.createdAt - a.createdAt);

    vaultMediaCache = vaultItems;
    vaultMediaIdsCache = new Set(vaultItems.map(m => m.originalId).filter(Boolean));
    cacheTimestamp = now;

    return vaultItems;
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

    // Save metadata in a map keyed by vault filename for easy lookup during scans
    const metadataMapJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
    const metadataMap = metadataMapJson ? JSON.parse(metadataMapJson) : {};
    metadataMap[vaultFilename] = metadata;
    await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(metadataMap));

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

    // Remove from vault metadata map
    const metadataMapJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
    if (metadataMapJson) {
      const metadataMap = JSON.parse(metadataMapJson);
      delete metadataMap[item.filename];
      await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(metadataMap));
    }

    // Clear cache
    clearVaultCache();

    return true;
  } catch (error) {
    console.error('Error removing media from vault:', error);
    return false;
  }
};

// Restore media from vault back to public gallery
export const restoreMediaFromVault = async (mediaId) => {
  try {
    const metadata = await getVaultMedia(true);
    const item = metadata.find(m => m.id === mediaId);

    if (!item) {
      console.error('Item not found in vault metadata:', mediaId);
      return false;
    }

    // Check if file exists in vault
    const fileInfo = await FileSystem.getInfoAsync(item.filePath);
    if (!fileInfo.exists) {
      console.error('Vault file does not exist:', item.filePath);
      return false;
    }

    // Use MediaLibrary to create a public asset from the private vault file
    // This automatically handles copying to a public folder and scanning
    const asset = await MediaLibrary.createAssetAsync(item.filePath);
    
    if (asset) {
      // If restore was successful, delete the private copy
      await FileSystem.deleteAsync(item.filePath, { idempotent: true });

      // Remove from vault metadata map
      const metadataMapJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
      if (metadataMapJson) {
        const metadataMap = JSON.parse(metadataMapJson);
        delete metadataMap[item.filename];
        await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(metadataMap));
      }

      // Clear cache
      clearVaultCache();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error restoring media from vault:', error);
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

    const metadataMapJson = await AsyncStorage.getItem(VAULT_METADATA_KEY);
    const metadataMap = metadataMapJson ? JSON.parse(metadataMapJson) : {};
    metadataMap[restoredMetadata.filename] = restoredMetadata;
    await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(metadataMap));

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

    // Clear cache
    clearVaultCache();
    
    return true;
  } catch (error) {
    console.error('Error deleting vault:', error);
    return false;
  }
};


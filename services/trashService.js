import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const TRASH_KEY = '@gallery_trash'; // Defined in TrashScreen, should verify consistency or export from there.
// Ideally consistent, but 'TrashScreen' defines it locally. We should probably export it from a shared constant file, 
// but for now we follow the pattern of VaultService (duplication or shared const).
// Let's use the same key string.

const { MediaTrash } = NativeModules;

/**
 * Get Android version information
 * @returns {Promise<{sdkInt: number, release: string, codename: string, incremental: string, brand: string, model: string, manufacturer: string}>}
 */
export const getAndroidVersion = async () => {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    if (!MediaTrash) {
      console.warn('MediaTrash module not available');
      return null;
    }
    return await MediaTrash.getAndroidVersion();
  } catch (error) {
    console.error('Error getting Android version:', error);
    return null;
  }
};

/**
 * Trash Service - Uses Android's native MediaStore trash feature
 * 
 * This service provides functions to:
 * - Move media to system trash (not permanent delete)
 * - Restore media from trash
 * - Permanently delete media
 * - Get list of trashed items
 */

/**
 * Check if trash is supported on this device
 * @returns {Promise<boolean>}
 */
export const isTrashSupported = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    if (!MediaTrash) {
      console.warn('MediaTrash module not available');
      return false;
    }
    return await MediaTrash.isTrashSupported();
  } catch (error) {
    console.error('Error checking trash support:', error);
    return false;
  }
};

/**
 * Move media items to system trash
 * @param {string[]} assetIds - Array of asset IDs to move to trash
 * @returns {Promise<{successCount: number, totalCount: number, errors: string[]}>}
 */
export const moveToTrash = async (assetIds) => {
  if (Platform.OS !== 'android') {
    throw new Error('Trash is only supported on Android');
  }

  if (!MediaTrash) {
    throw new Error('MediaTrash module not available. Trash not supported on this device.');
  }

  try {
    // Filter out vault items and non-MediaLibrary items
    const validIds = assetIds.filter(id => {
      const idStr = id.toString();
      return idStr &&
        !idStr.startsWith('vault_') &&
        !idStr.startsWith('picked_') &&
        !idStr.startsWith('temp_') &&
        !isNaN(parseInt(idStr));
    });

    if (validIds.length === 0) {
      return {
        successCount: 0,
        totalCount: assetIds.length,
        errors: ['No valid MediaLibrary asset IDs provided']
      };
    }

    const result = await MediaTrash.moveToTrash(validIds);
    return result;
  } catch (error) {
    console.error('Error moving to trash:', error);
    throw error;
  }
};

/**
 * Restore media items from trash
 * @param {string[]} assetIds - Array of asset IDs to restore
 * @returns {Promise<{successCount: number, totalCount: number, errors: string[]}>}
 */
export const restoreFromTrash = async (assetIds) => {
  if (Platform.OS !== 'android') {
    throw new Error('Trash is only supported on Android');
  }

  if (!MediaTrash) {
    throw new Error('MediaTrash module not available. Trash not supported on this device.');
  }

  try {
    const validIds = assetIds.filter(id => {
      const idStr = id.toString();
      return idStr && !isNaN(parseInt(idStr));
    });

    if (validIds.length === 0) {
      return {
        successCount: 0,
        totalCount: assetIds.length,
        errors: ['No valid asset IDs provided']
      };
    }

    const result = await MediaTrash.restoreFromTrash(validIds);
    return result;
  } catch (error) {
    console.error('Error restoring from trash:', error);
    throw error;
  }
};

/**
 * Permanently delete media items (remove from trash)
 * @param {string[]} assetIds - Array of asset IDs to delete permanently
 * @returns {Promise<{successCount: number, totalCount: number, errors: string[]}>}
 */
export const deletePermanently = async (assetIds) => {
  if (Platform.OS !== 'android') {
    throw new Error('Trash is only supported on Android');
  }

  if (!MediaTrash) {
    throw new Error('MediaTrash module not available. Trash not supported on this device.');
  }

  try {
    const validIds = assetIds.filter(id => {
      const idStr = id.toString();
      return idStr && !isNaN(parseInt(idStr));
    });

    if (validIds.length === 0) {
      return {
        successCount: 0,
        totalCount: assetIds.length,
        errors: ['No valid asset IDs provided']
      };
    }

    const result = await MediaTrash.deletePermanently(validIds);
    return result;
  } catch (error) {
    console.error('Error deleting permanently:', error);
    throw error;
  }
};

/**
 * Get all items in trash
 * @returns {Promise<Array<{
 *   id: string,
 *   uri: string,
 *   filename: string,
 *   filePath: string,
 *   dateModified: number,
 *   size: number,
 *   mimeType: string,
 *   mediaType: 'image' | 'video',
 *   duration?: number
 * }>>}
 */
export const getTrashItems = async () => {
  if (Platform.OS !== 'android') {
    return [];
  }

  if (!MediaTrash) {
    console.warn('MediaTrash module not available');
    return [];
  }

  try {
    const items = await MediaTrash.getTrashItems();
    return items || [];
  } catch (error) {
    console.error('Error getting trash items:', error);
    return [];
  }
};


/**
 * Move media to App Trash (local copy) then delete from device
 * Use this when Native Trash is not available or for Folder items
 */
export const moveMediaToAppTrash = async (mediaItem) => {
  try {
    // 1. Get Source URI
    let sourceUri = mediaItem.uri;
    // Attempt to get local URI if it's a MediaLibrary asset
    if (mediaItem.id && !mediaItem.id.toString().startsWith('vault_') && !mediaItem.id.toString().startsWith('picked_')) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
        sourceUri = asset.localUri || asset.uri;
      } catch (e) {
        console.log('Could not get MediaLibrary asset info', e);
      }
    }

    if (!sourceUri) throw new Error('No source URI found');

    // 2. Setup Trash Directory
    const TRASH_DIR = `${FileSystem.documentDirectory}trash/`;
    const dirInfo = await FileSystem.getInfoAsync(TRASH_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(TRASH_DIR, { intermediates: true });
    }

    // 3. Copy to Trash Directory
    const filename = mediaItem.filename || `trash_${Date.now()}.jpg`;
    const destination = `${TRASH_DIR}${Date.now()}_${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination
    });

    // 4. Update Metadata
    const trashItem = {
      ...mediaItem,
      id: mediaItem.id || `trash_${Date.now()}`,
      originalId: mediaItem.id, // Keep original ID if needed
      uri: destination,
      filePath: destination,
      isAppTrash: true, // Marker for TrashScreen to handle it
      deletedAt: Date.now(),
      dateModified: Date.now()
    };

    const currentTrashJson = await AsyncStorage.getItem(TRASH_KEY);
    const currentTrash = currentTrashJson ? JSON.parse(currentTrashJson) : [];

    // Add to list
    const updatedTrash = [trashItem, ...currentTrash];
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));

    // 5. Delete Original - SKIPPED (handled in batch by caller)
    // The caller (HomeScreen) will batch delete all MediaLibrary items at once
    // to avoid multiple permission prompts

    return true;

  } catch (error) {
    console.error('Error moving to App Trash:', error);
    throw error; // Propagate error so caller knows it failed
  }
};

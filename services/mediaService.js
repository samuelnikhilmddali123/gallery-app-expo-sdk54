import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMediaToVault } from './vaultService';

const MEDIA_CACHE_KEY = 'media_gallery_cache';

export const moveMediaToVault = async (mediaItem, shouldDelete = true) => {
  try {
    // Step 1: Get the actual file URI
    let sourceUri = mediaItem.uri;
    let isMediaLibraryAsset = false;

    // If it's a MediaLibrary asset (has numeric ID or valid string ID), get the actual file path
    if (mediaItem.id && !mediaItem.id.toString().startsWith('picked_') && !mediaItem.id.toString().startsWith('temp_') && !mediaItem.id.toString().startsWith('vault_')) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
        sourceUri = asset.localUri || asset.uri;
        isMediaLibraryAsset = true;
      } catch (error) {
        console.log('Could not get MediaLibrary asset info, using provided URI');
        // Still treat as MediaLibrary asset if it has an ID, so we attempt delete
        isMediaLibraryAsset = true;
      }
    }

    if (!sourceUri) {
      throw new Error('Could not get source URI for media');
    }

    // Step 2: Copy to vault (this verifies the copy works)
    const vaultMetadata = await addMediaToVault(mediaItem, sourceUri);

    // Step 3: Verify vault copy exists before deleting original
    const vaultFileInfo = await FileSystem.getInfoAsync(vaultMetadata.filePath);
    if (!vaultFileInfo.exists) {
      throw new Error('Vault copy verification failed');
    }

    // Step 4: Delete from MediaLibrary
    if (shouldDelete && isMediaLibraryAsset && mediaItem.id) {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();

        if (status === 'granted') {
          // Permanently delete the asset from the system gallery
          const success = await MediaLibrary.deleteAssetsAsync([mediaItem.id.toString()]);
          if (!success) {
            console.warn('System delete failed or was cancelled');
            // If system delete fails, we should still proceed as the vault copy is safe
          }
        } else {
          console.error('Media library permission not granted for deletion');
          throw new Error('Permission denied for deleting original file');
        }
      } catch (deleteError) {
        console.error('Error deleting from MediaLibrary:', deleteError);
      }
    } else if (shouldDelete && !isMediaLibraryAsset && sourceUri.startsWith('file://')) {
      // If it's a direct file URI but not in MediaLibrary (e.g. from picker)
      try {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
      } catch (e) {
        console.warn('Failed to delete source file directly:', e);
      }
    }

    return vaultMetadata;
  } catch (error) {
    console.error('Error moving media to vault:', error);
    throw error;
  }
};

// Get media file URI for MediaLibrary assets
export const getMediaUri = async (mediaItem) => {
  try {
    if (mediaItem.id) {
      const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
      return asset.localUri || asset.uri;
    }
    return mediaItem.uri;
  } catch (error) {
    console.error('Error getting media URI:', error);
    return mediaItem.uri;
  }
};

// Filter out vault media from gallery - optimized with caching
export const filterVaultMedia = async (mediaList) => {
  try {
    const { getVaultMediaIds } = await import('./vaultService');
    const vaultOriginalIds = await getVaultMediaIds();

    // Fast filter using Set lookup
    return mediaList.filter(media => !vaultOriginalIds.has(media.id));
  } catch (error) {
    console.error('Error filtering vault media:', error);
    return mediaList;
  }
};

// 🧪 Minimal working delete-to-trash function
export const moveToSystemTrash = async (asset) => {
  try {
    // Fix: accessPrivileges is iOS only and can crash Android
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status !== 'granted') return false;

    // asset must have an ID
    if (!asset || !asset.id) {
      console.warn('moveToSystemTrash called with invalid asset');
      return false;
    }

    await MediaLibrary.deleteAssetsAsync([asset.id.toString()]);
    return true;
  } catch (e) {
    console.log('Trash failed:', e);
    return false;
  }
};

// Cache essential media metadata for instant loading
export const saveMediaCache = async (mediaList) => {
  try {
    if (!mediaList || mediaList.length === 0) return;

    // Only cache top 2000 items to keep storage usage low and loading fast
    // Metadata includes: id, uri, width, height, creationTime, mediaType, duration
    const simplifiedList = mediaList.slice(0, 2000).map(item => ({
      id: item.id,
      uri: item.uri,
      width: item.width,
      height: item.height,
      creationTime: item.creationTime,
      modificationTime: item.modificationTime,
      mediaType: item.mediaType,
      duration: item.duration,
      filename: item.filename
    }));

    await AsyncStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(simplifiedList));
  } catch (error) {
    console.error('Error saving media cache:', error);
  }
};

export const loadMediaCache = async () => {
  try {
    const cachedData = await AsyncStorage.getItem(MEDIA_CACHE_KEY);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Error loading media cache:', error);
  }
  return [];
};

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { addMediaToVault } from './vaultService';

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
        // Force request for ALL permissions to ensure delete capability
        // Force request for ALL permissions to ensure delete capability
        // On Android, passing an object can cause crashes if keys are not expected
        const { status } = await MediaLibrary.requestPermissionsAsync();

        if (status === 'granted') {
          // Pass the ID in an array. 
          const success = await MediaLibrary.deleteAssetsAsync([mediaItem.id], true);
          if (!success) {
            console.warn('System delete dialog declined or delete failed');
          }
        } else {
          console.warn('Media library permission not granted for deletion');
        }
      } catch (deleteError) {
        console.error('Error deleting from MediaLibrary:', deleteError);
        // Do not throw here, as the critical part (vault copy) succeeded.
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

    await MediaLibrary.deleteAssetsAsync([asset.id], true);
    return true;
  } catch (e) {
    console.log('Trash failed:', e);
    return false;
  }
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';

const FOLDERS_KEY = '@gallery_folders';

// Get all folders
export const getFolders = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(FOLDERS_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('Error reading folders', e);
        return [];
    }
};

// Create a new folder
export const createFolder = async (name, coverUri) => {
    try {
        const folders = await getFolders();
        const newFolder = {
            id: Date.now().toString(),
            name,
            coverUri,
            createdAt: Date.now(),
            mediaIds: []
        };

        const updatedFolders = [newFolder, ...folders];
        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return newFolder;
    } catch (e) {
        console.error('Error creating folder', e);
        throw e;
    }
};

// Rename a folder
export const renameFolder = async (folderId, newName) => {
    try {
        const folders = await getFolders();
        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                return { ...folder, name: newName };
            }
            return folder;
        });

        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return true;
    } catch (e) {
        console.error('Error renaming folder', e);
        throw e;
    }
};

// Delete a folder
export const deleteFolder = async (folderId) => {
    try {
        const folders = await getFolders();
        const updatedFolders = folders.filter(f => f.id !== folderId);
        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return true;
    } catch (e) {
        console.error('Error deleting folder', e);
        throw e;
    }
};

// Add media to folder
export const addMediaToFolder = async (folderId, newMediaIds) => {
    try {
        const folders = await getFolders();
        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                // Use Set to avoid duplicates
                const currentIds = new Set(folder.mediaIds || []);
                newMediaIds.forEach(id => currentIds.add(id));
                return { ...folder, mediaIds: Array.from(currentIds) };
            }
            return folder;
        });

        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return true;
    } catch (e) {
        console.error('Error adding media to folder', e);
        throw e;
    }
};

// Remove media from folder
export const removeMediaFromFolder = async (folderId, mediaIdsToRemove) => {
    try {
        const folders = await getFolders();
        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                const newMediaIds = (folder.mediaIds || []).filter(id => !mediaIdsToRemove.includes(id));
                return { ...folder, mediaIds: newMediaIds };
            }
            return folder;
        });

        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return true;
    } catch (e) {
        console.error('Error removing media from folder', e);
        throw e;
    }
};

// Get media items for a folder
export const getFolderMedia = async (folderId) => {
    try {
        const folders = await getFolders();
        const folder = folders.find(f => f.id === folderId);

        if (!folder || !folder.mediaIds || folder.mediaIds.length === 0) {
            return [];
        }

        // Fetch details for these IDs from MediaLibrary
        // We fetch in batches if needed, but for now let's try getting them.
        // MediaLibrary.getAssetsAsync doesn't support fetching by specific list of IDs easily 
        // without fetching ALL or filtering.
        // However, getAssetInfoAsync fetches ONE. If we have many, promises might be slow.
        // Optimized approach: Fetch all assets (cached ideally) and filter?
        // Or fetch individual if count is low.

        // Better approach for large libraries: `getAssetsAsync` with `id` filter is NOT available directly.
        // We map over IDs and `getAssetInfoAsync`.
        // Warning: `getAssetInfoAsync` can be slow for many items.

        const mediaPromises = folder.mediaIds.map(async (id) => {
            try {
                const asset = await MediaLibrary.getAssetInfoAsync(id);
                return asset; // Returns asset object
            } catch (err) {
                console.log(`Could not find asset ${id}`, err);
                return null; // Asset might be deleted from phone
            }
        });

        const results = await Promise.all(mediaPromises);
        return results.filter(item => item !== null);

    } catch (e) {
        console.error('Error getting folder media', e);
        return []; // Return empty on error
    }
};

// Update folder cover
export const updateFolderCover = async (folderId, coverUri) => {
    try {
        const folders = await getFolders();
        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                return { ...folder, coverUri };
            }
            return folder;
        });

        await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
        return true;
    } catch (e) {
        console.error('Error updating folder cover', e);
        throw e;
    }
};

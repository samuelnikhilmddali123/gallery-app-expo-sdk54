import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  AppState,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropdownMenu from '../components/DropdownMenu';
import SideSettingsPanel from '../components/SideSettingsPanel';
import { useDialog } from '../contexts/DialogContext';

import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { useSearch } from '../contexts/SearchContext';
import { getFolders, addMediaToFolder } from '../services/folderService';
import { CATEGORIES, categorizeMedia } from '../services/categorizationService';
import { filterVaultMedia, moveMediaToVault, saveMediaCache, loadMediaCache } from '../services/mediaService';
import { moveMediaToAppTrash } from '../services/trashService';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_SIZE = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// Helper function for video duration
const formatDuration = (duration) => {
  if (!duration) return '';
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Helper function to fetch all media for indexing
const getAllMedia = async () => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return [];

    const result = await MediaLibrary.getAssetsAsync({
      first: 2000, // Fetch a large enough batch for search indexing
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    });
    return result.assets;
  } catch (error) {
    console.error('Error in getAllMedia:', error);
    return [];
  }
};

// Memoized MediaItem component for performance - defined outside to avoid hooks issues
const MediaItem = React.memo(({ item, index, isSelected, onPress, onLongPress, colors }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.item,
        { backgroundColor: colors.itemBackground },
        isSelected && styles.itemSelected
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        contentFit="cover"
        transition={0} // Step 4.2: Optimize thumbnails
        cachePolicy="memory-disk"
        key={`${item.id}_${item.uri}`}
      />

      {/* Light blue overlay when selected */}
      {isSelected && (
        <View style={styles.selectionOverlay} />
      )}

      {/* Check icon at top-right when selected */}
      {isSelected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </View>
      )}

      {/* Safer condition to avoid rendering '0' text */}
      {!!(item.mediaType === 'video' || item.mediaType === MediaLibrary.MediaType.video || (item.duration && item.duration > 0)) && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation, route }) {
  // All hooks must be called before any conditional returns
  const { colors } = useTheme();
  const { isVaultSetup, verifyPassword, unlockVault, isVaultUnlocked } = useVault();
  const { searchQuery, setSearchQuery } = useSearch();
  const [media, setMedia] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false to show UI immediately
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsPanelVisible, setSettingsPanelVisible] = useState(false);
  const menuButtonRef = useRef(null);
  const [menuAnchorPosition, setMenuAnchorPosition] = useState({ x: 16, y: 50 });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionPurpose, setSelectionPurpose] = useState(undefined); // undefined | 'vaultAdd' | 'folderAdd'
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [targetFolderId, setTargetFolderId] = useState(null);
  const [targetFolderName, setTargetFolderName] = useState(null);
  const [categorizedMedia, setCategorizedMedia] = useState({});
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);

  // Pagination & Loading
  const [pageInfo, setPageInfo] = useState({ hasNextPage: true, endCursor: undefined });
  const [loadingMore, setLoadingMore] = useState(false);

  // Dialog Context
  const { showConfirm, showAlert, showCustomConfirm } = useDialog();

  // Ref to track if we've loaded initial data
  const dataLoadedRef = useRef(false);

  // Load All System Data (Albums, Folders)
  const loadAllData = useCallback(async () => {
    try {
      // Fetch albums and folders
      const [albumsResult, foldersResult] = await Promise.all([
        MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true }),
        getFolders()
      ]);

      setAlbums(albumsResult);
      setFolders(foldersResult);
    } catch (error) {
      console.error('Error loading albums/folders:', error);
    }
  }, []);

  // Initialize from cache
  const initFromCache = useCallback(async () => {
    try {
      const cachedMedia = await loadMediaCache();
      if (cachedMedia && cachedMedia.length > 0) {
        console.log(`HomeScreen: Loaded ${cachedMedia.length} items from cache`);
        setMedia(cachedMedia);
        dataLoadedRef.current = true;
        // Start categorization for cached items too
        startCategorization(cachedMedia);
      } else {
        console.log("HomeScreen: No cache found, marking as first launch");
        setIsFirstLaunch(true);
      }
    } catch (error) {
      console.error('Error initializing cache:', error);
    }
  }, []);

  const startCategorization = useCallback(async (mediaItems) => {
    if (mediaItems.length === 0 || isCategorizing) return;

    setIsCategorizing(true);
    try {
      const result = await categorizeMedia(mediaItems);
      setCategorizedMedia(result || {});
    } catch (error) {
      console.error('Categorization error:', error);
    } finally {
      setIsCategorizing(false);
    }
  }, [isCategorizing]);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Memoized search results
  const searchResults = useMemo(() => {
    if (!searchQuery) return { media: media, albums: [], folders: [], isSearching: false };

    const q = searchQuery.toLowerCase().trim();

    // 1. Filter Albums
    const matchedAlbums = albums.filter(a => (a.title || '').toLowerCase().includes(q));

    // 2. Filter Folders
    const matchedFolders = folders.filter(f => (f.name || '').toLowerCase().includes(q));

    // 3. Filter Media (Filename + Categories)

    // Find categories that match the query
    const matchingCategoryIds = Object.values(CATEGORIES)
      .filter(cat =>
        cat.name.toLowerCase().includes(q) ||
        cat.keywords.some(kw => kw.toLowerCase().includes(q))
      )
      .map(cat => cat.id);

    // Get all media IDs that belong to matching categories
    const mediaIdsFromCategories = new Set();
    matchingCategoryIds.forEach(catId => {
      const items = categorizedMedia[catId] || [];
      items.forEach(item => mediaIdsFromCategories.add(item.id.toString()));
    });

    const matchedMedia = media.filter(m => {
      const filenameMatch = (m.filename || '').toLowerCase().includes(q);
      const categoryMatch = mediaIdsFromCategories.has(m.id.toString());
      return filenameMatch || categoryMatch;
    });

    return {
      media: matchedMedia,
      albums: matchedAlbums,
      folders: matchedFolders,
      isSearching: true
    };
  }, [searchQuery, media, albums, folders, categorizedMedia]);

  // Used for selection mode consistency
  const activeMediaList = searchQuery ? searchResults.media : media;

  const filteredMedia = activeMediaList; // Backward compatibility for existing code using filteredMedia

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };
  // Handle Vault Add Mode from route params - using useFocusEffect to ensure it triggers on tab switch
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.selectionPurpose === 'vaultAdd') {
        setIsSelectionMode(true);
        setSelectionPurpose('vaultAdd');
        setSelectedItems(new Set());
        setSearchQuery(''); // Clear any search query preventing visibility

        // Force load if empty (e.g. first time access via Vault) - but don't show loader
        if (media.length === 0) {
          console.log('Media empty in Vault Add mode - forcing load without loader');
          // loadGallery(false); // Helper function not available, rely on loadAllData
          loadAllData();
        }
      } else if (route?.params?.selectionPurpose === 'folderAdd') {
        setIsSelectionMode(true);
        setSelectionPurpose('folderAdd');
        setTargetFolderId(route.params.targetFolderId);
        setTargetFolderName(route.params.targetFolderName);
        setSelectedItems(new Set());
        setSearchQuery('');

        if (media.length === 0) {
          // loadGallery(false);
          loadAllData();
        }
      }
    }, [route?.params?.selectionPurpose, navigation, media.length, loadAllData])
  );

  // Incremental update when returning from crop OR app focus - NO full reload
  useFocusEffect(
    useCallback(() => {
      const syncNewMedia = async () => {
        try {
          // 1. Handle explicit cropped asset return (existing logic)
          if (route?.params?.croppedAsset) {
            console.log("HomeScreen: Focused with croppedAsset param", route.params);
            const { croppedAsset } = route.params;

            // Clear the params immediately
            navigation.setParams({ croppedAsset: undefined, originalAssetId: undefined });

            setMedia(prev => {
              // Check if it already exists (prevent duplicates if scanner was fast)
              if (prev.some(item => item.id?.toString() === croppedAsset.id?.toString())) {
                return prev;
              }

              // We add the cropped asset to the top for immediate visibility
              const newAsset = {
                ...croppedAsset,
                uri: croppedAsset.uri || croppedAsset.localUri,
                mediaType: 'photo',
                creationTime: croppedAsset.creationTime || Date.now() // Fallback for sorting
              };

              return [newAsset, ...prev];
            });
          }

          // 2. Incremental Sync: Check for ANY new system media (e.g. screenshots)
          // Fetch only the latest 10 items to minimize performance impact
          const result = await MediaLibrary.getAssetsAsync({
            first: 10,
            sortBy: [MediaLibrary.SortBy.creationTime], // Strict chronological
            mediaType: MediaLibrary.MediaType.all,
          });

          const latestAssets = result.assets;

          if (latestAssets.length > 0) {
            setMedia(prev => {
              // If existing list is empty, just let loadGallery handle it (or do nothing)
              if (prev.length === 0) return prev;

              // Find items in latestAssets that are NOT in 'prev'
              // We assume 'prev' is sorted newest first. 
              // Optimization: Filter latestAssets against the first ~50 items of 'prev'.

              const existingHeadIds = new Set(prev.slice(0, 50).map(m => m.id));
              const newItems = latestAssets.filter(asset => !existingHeadIds.has(asset.id));

              if (newItems.length > 0) {
                console.log(`HomeScreen: Found ${newItems.length} new incoming assets via sync.`);
                // Prepend new items
                return [...newItems, ...prev];
              }

              return prev;
            });
          }

        } catch (error) {
          console.warn("HomeScreen: Incremental sync failed", error);
        }
      };

      // Run the sync initially on focus
      syncNewMedia();

      // Also listen for AppState changes to handle returning from background (e.g. after screenshot)
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState === 'active') {
          console.log('HomeScreen: App active - Triggering incremental sync');
          syncNewMedia();
        }
      });

      return () => {
        subscription.remove();
      };

    }, [route?.params?.croppedAsset, navigation])
  );

  const isSelectionModeRef = useRef(isSelectionMode);
  const shareInProgressRef = useRef(false); // Guard to prevent share loops

  useEffect(() => {
    isSelectionModeRef.current = isSelectionMode;
  }, [isSelectionMode]);

  const handleLongPress = useCallback((item) => {
    if (!isSelectionModeRef.current) {
      setIsSelectionMode(true);
      setSelectedItems(new Set([item.id.toString()]));
    }
  }, []);

  const handleItemPress = useCallback((item, index) => {
    if (isSelectionModeRef.current) {
      // Toggle selection
      const itemId = item.id.toString();
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
          // Exit selection mode if no items selected
          if (newSet.size === 0) {
            setIsSelectionMode(false);
          }
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      // Normal behavior - open viewer
      navigation.navigate('Viewer', {
        item,
        allItems: filteredMedia,
        initialIndex: index
      });
    }
  }, [filteredMedia, navigation]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectionPurpose(undefined);
    setSelectedItems(new Set());

    // Clear navigation params explicitly
    navigation.setParams({ selectionPurpose: undefined });

    // If we were in vaultAdd mode, go back to Vault screen
    if (selectionPurpose === 'vaultAdd') {
      navigation.navigate('VaultHome');
    } else if (selectionPurpose === 'folderAdd') {
      navigation.navigate('FolderDetail', { folderId: targetFolderId, folderName: targetFolderName });
    }
  }, [selectionPurpose, navigation, targetFolderId, targetFolderName]);



  const handleShareSelected = useCallback(async () => {
    if (shareInProgressRef.current) return;

    try {
      shareInProgressRef.current = true;

      const selectedIds = Array.from(selectedItems);
      const selectedMedia = filteredMedia.filter(item => selectedIds.includes(item.id.toString()));

      if (selectedMedia.length === 0) {
        showAlert('Error', 'No items selected');
        return;
      }

      // Collect asset URIs for Android native sharing
      const uris = [];
      for (const item of selectedMedia) {
        if (item.id && !item.id.toString().startsWith('vault_')) {
          // Use item.uri which is already a valid content:// URI for MediaLibrary assets on Android
          if (item.uri) {
            uris.push(item.uri);
          }
        }
      }

      if (uris.length === 0) {
        showAlert('Error', 'No valid items to share');
        return;
      }

      console.log(`HomeScreen: Sharing ${uris.length} items via NativeModules.MultiShare`);
      console.log('Available NativeModules:', Object.keys(NativeModules)); // Debug: List all modules

      // Exit selection mode
      exitSelectionMode();

      // Share using our custom native module (ONE intent)
      if (NativeModules.MultiShare) {
        await NativeModules.MultiShare.shareImages(uris);
      } else {
        console.warn('NativeModules.MultiShare not found, falling back to basic sharing');
        // Handle fallback if needed, but here we expect the module to exist
      }

    } catch (error) {
      // Ignore user cancellation errors
      const errorMsg = error.message || '';
      if (!errorMsg.includes('User did not share') && !errorMsg.includes('User cancelled')) {
        console.error('HomeScreen: Share error:', error);
        showAlert('Error', 'Failed to share items');
      }
    } finally {
      // Safely reset guard after a delay to ensure Android intent processing completes
      setTimeout(() => {
        shareInProgressRef.current = false;
      }, 1000);
    }
  }, [selectedItems, filteredMedia, exitSelectionMode, showAlert]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedItems.size === 0) return;

    const selectedIds = Array.from(selectedItems);
    const selectedMedia = filteredMedia.filter(item => selectedIds.includes(item.id.toString()));
    const title = selectedItems.size > 1 ? `Delete ${selectedItems.size} items?` : "Delete photo?";

    showCustomConfirm(
      title,
      "Choose how you want to delete these items.",
      [
        {
          text: 'Trash',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              const deletedIds = [];
              const mediaLibraryIds = [];

              // Step 1: Copy all items to trash
              for (const item of selectedMedia) {
                try {
                  const result = await moveMediaToAppTrash(item);
                  if (result) {
                    deletedIds.push(item.id.toString());
                    if (item.id && !item.id.toString().startsWith('vault_') && !item.id.toString().startsWith('picked_')) {
                      mediaLibraryIds.push(item.id);
                    }
                  }
                } catch (trashError) {
                  console.error('Error copying item to trash:', item.id, trashError);
                }
              }

              // Step 2: Delete from MediaLibrary
              if (mediaLibraryIds.length > 0) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                  await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                }
              }

              // Step 3: Update UI
              if (deletedIds.length > 0) {
                setMedia(prev => prev.filter(item => !deletedIds.includes(item.id.toString())));
              }

              exitSelectionMode();
            } catch (error) {
              console.error('Error in trash operation:', error);
              showAlert('Error', 'Failed to move items to trash');
            } finally {
              setLoading(false);
            }
          }
        },
        {
          text: 'Permanently delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const mediaLibraryIds = selectedMedia
                .filter(item => item.id && !item.id.toString().startsWith('vault_') && !item.id.toString().startsWith('picked_'))
                .map(item => item.id);

              if (mediaLibraryIds.length > 0) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                  const success = await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                  if (success) {
                    setMedia(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
                  }
                }
              } else {
                // If no media library IDs (e.g. vault items), just remove from UI
                setMedia(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
              }

              exitSelectionMode();
            } catch (error) {
              console.error('Error in permanent delete:', error);
              showAlert('Error', 'Failed to delete items permanently');
            } finally {
              setLoading(false);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => { }
        }
      ]
    );
  }, [selectedItems, filteredMedia, exitSelectionMode, showCustomConfirm, showAlert]);

  const handleAddToVaultConfirm = useCallback(async () => {
    const selectedCount = selectedItems.size;
    if (selectedCount === 0) return;

    try {
      const selectedIds = Array.from(selectedItems);
      const selectedMedia = filteredMedia.filter(item => selectedIds.includes(item.id.toString()));
      const addedVaultItems = [];

      // 1. Copy to Vault & Track for Rollback
      for (const item of selectedMedia) {
        try {
          const vaultMetadata = await moveMediaToVault(item, false); // Don't delete yet
          if (vaultMetadata) {
            addedVaultItems.push(vaultMetadata);
          }
        } catch (copyError) {
          console.error('Failed to copy item to vault:', item.id, copyError);
        }
      }

      if (addedVaultItems.length === 0) {
        showAlert('Error', 'Failed to copy items to vault.');
        return;
      }

      // 2. Delete from System (Batch)
      const validAssetsToDelete = selectedMedia.filter(
        m => m.id && !m.id.toString().startsWith('vault_') && !m.id.toString().startsWith('picked_')
      );

      let deleteSuccess = false;
      if (validAssetsToDelete.length > 0) {
        const ids = validAssetsToDelete.map(m => m.id);
        try {
          deleteSuccess = await MediaLibrary.deleteAssetsAsync(ids);
        } catch (e) {
          console.error('Delete failed:', e);
          deleteSuccess = false;
        }
      } else {
        deleteSuccess = true;
      }

      // 3. Rollback if Delete Failed
      if (!deleteSuccess && validAssetsToDelete.length > 0) {
        console.log('System delete denied or failed. Rolling back vault copies...');
        for (const vaultItem of addedVaultItems) {
          await removeMediaFromVault(vaultItem.id);
        }
        showAlert('Move Cancelled', 'Original items could not be deleted, so the move was cancelled.');
        return;
      }

      // 4. Success - Clean up and Return
      setMedia(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
      exitSelectionMode();

    } catch (error) {
      console.error('Error adding to vault:', error);
      showAlert('Error', 'An unexpected error occurred.');
    }
  }, [selectedItems, filteredMedia, exitSelectionMode]);

  const handleAddToFolderConfirm = useCallback(async () => {
    const selectedCount = selectedItems.size;
    if (selectedCount === 0) return;

    try {
      const selectedIds = Array.from(selectedItems);
      // Filter out vault items as they cannot be added to system folders
      const validAssets = filteredMedia
        .filter(item => selectedIds.includes(item.id.toString()))
        .filter(m => !m.id.toString().startsWith('vault_'))
        .map(m => m.id);

      if (validAssets.length === 0) {
        showAlert('Error', 'No valid photos selected. Vault items cannot be added to folders.');
        return;
      }

      if (validAssets.length < selectedCount) {
        showAlert('Warning', 'Some items (e.g. Vault items) were skipped.');
      }

      await addMediaToFolder(targetFolderId, validAssets);
      exitSelectionMode();
    } catch (e) {
      console.error('Error adding to folder:', e);
      showAlert('Error', 'Failed to add photos to folder');
    }
  }, [selectedItems, filteredMedia, targetFolderId, exitSelectionMode]);

  const renderItem = useCallback(({ item, index }) => {
    const itemId = item.id.toString();
    const isSelected = selectedItems.has(itemId);

    return (
      <MediaItem
        item={item}
        index={index}
        isSelected={isSelected}
        onPress={() => handleItemPress(item, index)}
        onLongPress={() => handleLongPress(item)}
        colors={colors}
      />
    );
  }, [selectedItems, handleItemPress, handleLongPress, colors]);

  const keyExtractor = useCallback((item, index) => {
    // Include URI in key to force re-render when image changes
    return `${item?.id?.toString() || `media-${index}`}_${item?.uri || ''}`;
  }, []);

  const loadGallery = async (showLoader = true, reset = false) => {
    try {
      if (showLoader) setLoading(true);
      if (!reset && loadingMore) return; // Prevent concurrent loads

      // RESET pagination & cache if requested (CRITICAL for refresh)
      if (reset) {
        console.log("HomeScreen: RESETTING gallery state...");
        setMedia([]);
        setPageInfo({ hasNextPage: true, endCursor: undefined });
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission not granted');
        if (showLoader) setLoading(false);
        return;
      }

      if (!reset) setLoadingMore(true);

      console.log("HomeScreen: Loading batch of media (all types)...");

      const fetchCount = 100; // Efficient batch size for combined fetch
      const currentCursor = reset ? undefined : pageInfo.endCursor;

      if (!reset && !pageInfo.hasNextPage) {
        setLoadingMore(false);
        return;
      }

      // UNIFIED FETCH: Fetch photos and videos together for stable sorting
      // Use modificationTime for fetch to ensure recently created/edited assets (like crops)
      // are included in the first batch even if creationTime is 0/un-indexed.
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        first: fetchCount,
        after: currentCursor,
        sortBy: [[MediaLibrary.SortBy.modificationTime, false]], // Native sort (descending)
      });

      setPageInfo({ hasNextPage: result.hasNextPage, endCursor: result.endCursor });

      if (result.assets.length === 0 && !reset) {
        setLoadingMore(false);
        return;
      }

      console.log("HomeScreen: Loaded batch of", result.assets.length, "items");
      if (result.assets.length > 0) {
        console.log("HomeScreen: Top item metadata:", {
          id: result.assets[0].id,
          creationTime: result.assets[0].creationTime,
          modificationTime: result.assets[0].modificationTime
        });
      }

      // Normalize media types and add fallback sort markers
      const normalizedAssets = result.assets.map(asset => ({
        ...asset,
        mediaType: asset.mediaType === MediaLibrary.MediaType.video ? 'video' : 'photo',
      }));

      // ⚡ PERFORMANCE: Filter vault items before merging to save operations
      const filteredNewMedia = await filterVaultMedia(normalizedAssets);

      let finalMedia = [];
      setMedia(prev => {
        const merged = reset ? filteredNewMedia : [...prev, ...filteredNewMedia];

        // 🔒 STABLE GLOBAL SORT: Enforce strict chronological order (newest first)
        // Deduplicate and Sort
        const uniqueItemsMap = new Map();
        merged.forEach(item => {
          uniqueItemsMap.set(item.id.toString(), item);
        });
        const uniqueItems = Array.from(uniqueItemsMap.values());

        finalMedia = uniqueItems.sort((a, b) => {
          const timeA = a.creationTime || a.modificationTime || 0;
          const timeB = b.creationTime || b.modificationTime || 0;
          if (timeB !== timeA) return timeB - timeA;
          return (b.id?.toString() || '').localeCompare(a.id?.toString() || '');
        });

        return finalMedia;
      });

      // Save to cache after successful fetch (only for top items/initial batch)
      if (reset || !currentCursor) {
        saveMediaCache(finalMedia);
      }

    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      if (showLoader) setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || loading) return;
    if (pageInfo.hasNextPage) {
      console.log("HomeScreen: Triggering loadMore (unified)...");
      loadGallery(false, false);
    }
  };

  const handleRefresh = useCallback(async () => {
    console.log("HomeScreen: Pull-to-refresh triggered");
    setRefreshing(true);
    await loadGallery(false, true); // reset = true
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // Skip loading gallery if entering for vault add (assume media already loaded or handled)
    if (route?.params?.selectionPurpose === 'vaultAdd') {
      return;
    }

    // Google Gallery Behavior:
    // 1. Load from cache immediately (no loader)
    // 2. Then sync with MediaLibrary in background (silent sync)
    // 3. Only show loader if it's truly the first launch and no data exists

    const initialize = async () => {
      await initFromCache();

      // If we have items from cache, don't show the full-screen loader during sync
      const hasCache = dataLoadedRef.current;
      loadGallery(!hasCache);
    };

    initialize();
  }, []);

  // MediaLibrary listener disabled - causes slow reloads after deletion
  // The UI already updates instantly by filtering deleted items from state
  /*
  useEffect(() => {
    console.log("HomeScreen: Setting up MediaLibrary listener...");
   
    const subscription = MediaLibrary.addListener(() => {
      console.log("HomeScreen: MediaLibrary changed! Auto-refreshing...");
      // Refresh gallery when new photos are added
      loadGallery(false, true); // reset = true to get latest photos
    });
   
    return () => {
      console.log("HomeScreen: Removing MediaLibrary listener");
      subscription.remove();
    };
  }, []);
  */

  // Don't reload on vault unlock - media is already loaded
  // useEffect(() => {
  //   if (!isVaultUnlocked) {
  //     loadGallery();
  //   }
  // }, [isVaultUnlocked]);

  useEffect(() => {
    // Hidden Vault Access Logic
    const timeoutId = setTimeout(async () => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) return;

      // 1. Setup Trigger (if not setup)
      if (!isVaultSetup && trimmedQuery.toLowerCase() === 'setup vault') {
        setSearchQuery('');
        navigation.navigate('VaultSetup');
        return;
      }

      // 2. Unlock Trigger (if setup and locked)
      if (isVaultSetup && !isVaultUnlocked) {
        try {
          const isValid = await verifyPassword(trimmedQuery);
          if (isValid) {
            unlockVault();
            setSearchQuery(''); // Clear password from search
            navigation.navigate('VaultHome');
          }
        } catch (error) {
          // Ignore errors during passive check
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isVaultSetup, isVaultUnlocked, verifyPassword, unlockVault, navigation]);

  // --- Rainbow Animation Logic ---
  const rainbowProgress = useSharedValue(0);

  useEffect(() => {
    if (isVaultSetup) {
      // Start animation loop when vault exists (is setup)
      rainbowProgress.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.linear }),
        -1, // Infinite
        false // Do not reverse, just loop 0->1
      );
    } else {
      // Stop and reset immediately if vault is deleted (not setup)
      cancelAnimation(rainbowProgress);
      rainbowProgress.value = 0;
    }
  }, [isVaultSetup]);

  const animatedSearchIconProps = useAnimatedProps(() => {
    // Return default color if vault is not setup
    if (!isVaultSetup) {
      return {
        color: colors.searchPlaceholder,
      };
    }

    const rainbowColors = [
      '#FF0000', // Red
      '#FF7F00', // Orange
      '#FFFF00', // Yellow
      '#00FF00', // Green
      '#0000FF', // Blue
      '#4B0082', // Indigo
      '#9400D3', // Violet
      '#FF0000', // Back to Red for smooth loop
    ];

    const color = interpolateColor(
      rainbowProgress.value,
      [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
      rainbowColors
    );

    return {
      color: color,
    };
  }, [isVaultSetup, colors]);

  const handleMenuPress = () => {
    console.log('Menu button pressed');
    setMenuAnchorPosition({
      x: 16,
      y: 60,
    });
    setMenuVisible(true);
  };

  const handleMenuSelect = (optionId) => {
    setMenuVisible(false);

    switch (optionId) {
      case 'settings':
        setTimeout(() => {
          setSettingsPanelVisible(true);
        }, 100);
        break;
      case 'trash':
        navigation.navigate('Trash');
        break;
      case 'select':
        setIsSelectionMode(true);
        setSelectionPurpose(undefined);
        break;
      default:
        break;
    }
  };



  // Show full-screen loader ONLY if it's the first launch AND we have no data yet
  if (loading && media.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.icon} />
          {isFirstLaunch && (
            <Text style={{ marginTop: 16, color: colors.text, opacity: 0.7 }}>
              Building your gallery...
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const renderContent = () => {
    // Search Results View
    if (searchResults.isSearching) {
      const hasAlbums = searchResults.albums.length > 0;
      const hasFolders = searchResults.folders.length > 0;
      const hasMedia = searchResults.media.length > 0;
      const isEmpty = !hasAlbums && !hasFolders && !hasMedia;

      if (isEmpty) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={colors.searchPlaceholder} />
            <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
              No items found
            </Text>
          </View>
        );
      }

      return (
        <ScrollView style={styles.searchResultsContainer} keyboardShouldPersistTaps="handled">
          {hasAlbums && (
            <View style={styles.resultSection}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Albums ({searchResults.albums.length})</Text>
              {searchResults.albums.map(album => (
                <TouchableOpacity
                  key={album.id}
                  style={styles.searchResultItem}
                  onPress={() => navigation.navigate('AlbumView', { album })}
                >
                  <View style={styles.searchResultIcon}>
                    {album.coverUri ? (
                      <ExpoImage source={{ uri: album.coverUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <Ionicons name="images" size={24} color={colors.icon} />
                    )}
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={[styles.searchResultTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: colors.searchPlaceholder }]}>{album.assetCount} items</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasFolders && (
            <View style={styles.resultSection}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Folders ({searchResults.folders.length})</Text>
              {searchResults.folders.map(folder => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.searchResultItem}
                  onPress={() => navigation.navigate('FolderDetail', { folderId: folder.id, folderName: folder.name })}
                >
                  <View style={styles.searchResultIcon}>
                    {folder.coverUri ? (
                      <ExpoImage source={{ uri: folder.coverUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <Ionicons name="folder" size={24} color={colors.icon} />
                    )}
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={[styles.searchResultTitle, { color: colors.text }]} numberOfLines={1}>{folder.name}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: colors.searchPlaceholder }]}>Folder</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasMedia && (
            <View style={styles.resultSection}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Photos & Videos ({searchResults.media.length})</Text>
              <View style={styles.gridContainer}>
                {searchResults.media.map((item, index) => {
                  const itemId = item.id.toString();
                  const isSelected = selectedItems.has(itemId);
                  return (
                    <MediaItem
                      key={`${item.id}_${item.uri || ''}`}
                      item={item}
                      index={index}
                      isSelected={isSelected}
                      onPress={() => {
                        if (isSelectionMode) {
                          handleItemPress(item, index);
                        } else {
                          navigation.navigate('Viewer', {
                            item,
                            allItems: searchResults.media,
                            initialIndex: index
                          });
                        }
                      }}
                      onLongPress={() => handleLongPress(item)}
                      colors={colors}
                    />
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      );
    }

    // Default Grid View
    return (
      <FlatList
        data={filteredMedia}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.grid,
          filteredMedia.length === 0 && { flex: 1 }
        ]}
        extraData={{ isSelectionMode, selectedItems }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        ListEmptyComponent={
          !loading && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: colors.text, opacity: 0.6 }}>No photos found</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={colors.icon} />
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          {isSelectionMode ? (
            <View style={[styles.selectionHeader, { backgroundColor: colors.itemBackground }]}>
              <TouchableOpacity
                onPress={exitSelectionMode}
                style={styles.cancelButton}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.selectionCount, { color: colors.text }]}>
                {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} selected
              </Text>
              <View style={styles.selectionActions}>
                {(selectionPurpose === 'vaultAdd' || selectionPurpose === 'folderAdd') ? (
                  <TouchableOpacity
                    onPress={selectionPurpose === 'vaultAdd' ? handleAddToVaultConfirm : handleAddToFolderConfirm}
                    style={styles.selectionActionButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={32} color="#007AFF" />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={handleShareSelected}
                      style={styles.selectionActionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-outline" size={24} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteSelected}
                      style={styles.selectionActionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.header}>
              {/* Search Bar Container */}
              <View style={[
                styles.searchBar,
                { backgroundColor: colors.searchBar }
              ]}>
                <AnimatedIonicons
                  name="search"
                  size={16}
                  animatedProps={animatedSearchIconProps}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="name, people, places"
                  placeholderTextColor={colors.searchPlaceholder}
                  style={[styles.searchInput, { color: colors.searchText }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={colors.searchPlaceholder} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                ref={menuButtonRef}
                onPress={handleMenuPress}
                style={styles.menuButton}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={colors.icon} />
              </TouchableOpacity>
            </View>
          )}

          {renderContent()}
        </View>

        <DropdownMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSelect={handleMenuSelect}
          anchorPosition={menuAnchorPosition}
        />

        <SideSettingsPanel
          visible={settingsPanelVisible}
          onClose={() => setSettingsPanelVisible(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333333',
  },
  searchResultIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#333', // fallback
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultSubtitle: {
    fontSize: 14,
  },
  searchResultsContainer: {
    flex: 1,
  },
  resultSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 0,
  },
  mediaItem: {
    margin: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: '100%',
  },
  menuButton: {
    padding: 4,
    marginLeft: 4,
  },
  grid: {
    padding: GAP,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP / 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  itemSelected: {
    opacity: 1,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionActionButton: {
    padding: 4,
  },
  placeholder: {
    width: 60,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
});

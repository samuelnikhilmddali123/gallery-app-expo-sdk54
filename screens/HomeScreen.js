import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import { moveMediaToAppTrash } from '../services/trashService';
import GlassMenu from '../components/GlassMenu';
import { useVault } from '../contexts/VaultContext';
import { moveMediaToVault } from '../services/mediaService';
import AnimatedRainbowSearchIcon from '../components/AnimatedRainbowSearchIcon';

// --- CONFIGURATION ---
const NUM_COLUMNS = 3;
const BATCH_SIZE = 50; 
const { width } = Dimensions.get('window');
const ITEM_SIZE = Math.floor(width / NUM_COLUMNS);

/**
 * 🖼️ MediaItem Component
 */
const MediaItem = React.memo(({ item, backgroundColor, borderColor, onPress, onLongPress, isSelected, isSelectionMode }) => {
  if (item.empty) {
    return <View style={[styles.itemContainer, { backgroundColor: 'transparent', borderLeftWidth: 0 }]} />;
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={[styles.itemContainer, { backgroundColor, borderColor }]}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
      />
      
      {/* Selection Overlay */}
      {isSelected && (
        <View style={styles.selectionOverlay}>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        </View>
      )}

      {item.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Ionicons name="play" size={12} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // --- STATE ---
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  
  // Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const { showAlert, showCustomConfirm } = useDialog();
  const { isVaultSetup, deleteVault, verifyPassword, unlockVault, addMediaToVaultContext } = useVault();

  const selectionPurpose = route.params?.selectionPurpose;

  // Menu State
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // --- REFS ---
  const endCursorRef = useRef(null);
  const hasNextPageRef = useRef(true);
  const isFetchingRef = useRef(false);
  const searchInputRef = useRef(null);

  /**
   * 🛠️ Fetch Logic
   */
  const loadMedia = useCallback(async (after = null, reset = false) => {
    if (isFetchingRef.current) return;
    if (!reset && !hasNextPageRef.current) return;

    isFetchingRef.current = true;
    if (reset) setIsRefreshing(true);
    else if (after) setIsFetchingMore(true);

    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: BATCH_SIZE,
        after: after,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      });

      if (reset) {
        setAssets(result.assets);
      } else {
        setAssets(prev => [...prev, ...result.assets]);
      }

      endCursorRef.current = result.endCursor;
      hasNextPageRef.current = result.hasNextPage;
    } catch (error) {
      console.error('[Gallery] Load Error:', error);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
      setIsFetchingMore(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        loadMedia(null, true);
      } else {
        setIsInitialLoading(false);
      }
    })();
  }, [loadMedia]);

  // --- VAULT SECRET DOOR ---
  useEffect(() => {
    if (isVaultSetup && searchQuery.length >= 4) {
      const checkVaultGate = async () => {
        const isValid = await verifyPassword(searchQuery);
        if (isValid) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSearchQuery('');
          unlockVault();
          navigation.navigate('VaultHome');
        }
      };
      checkVaultGate();
    }
  }, [searchQuery, isVaultSetup, verifyPassword, unlockVault, navigation]);

  // Handle Vault Addition Flow
  useEffect(() => {
    if (selectionPurpose === 'vaultAdd') {
      setIsSelectionMode(true);
      setSelectedItems(new Set());
    }
  }, [selectionPurpose]);

  /**
   * ⚡ Handlers
   */
  const handleRefresh = useCallback(() => {
    hasNextPageRef.current = true;
    endCursorRef.current = null;
    loadMedia(null, true);
  }, [loadMedia]);

  const handleEndReached = useCallback(() => {
    if (hasNextPageRef.current && !isFetchingRef.current && !isInitialLoading) {
      loadMedia(endCursorRef.current);
    }
  }, [loadMedia, isInitialLoading]);

  /**
   * 🔍 Memoized Search + Alignment
   */
  const displayData = useMemo(() => {
    let list = assets;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = assets.filter(asset => 
        (asset.filename || '').toLowerCase().includes(query)
      );
    }

    const remainder = list.length % NUM_COLUMNS;
    if (remainder !== 0) {
      const needed = NUM_COLUMNS - remainder;
      const placeholders = Array.from({ length: needed }, (_, i) => ({
        id: `empty-${i}`,
        empty: true
      }));
      return [...list, ...placeholders];
    }
    return list;
  }, [assets, searchQuery]);

  const toggleSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        if (newSet.size === 0) setIsSelectionMode(false);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleItemPress = useCallback((item) => {
    if (item.empty) return;
    
    if (isSelectionMode) {
      // Toggle selection in selection mode
      toggleSelection(item.id);
    } else {
      // Normal mode -> Open in viewer
      const realAssets = displayData.filter(a => !a.empty);
      navigation.navigate('Viewer', {
        item,
        allItems: realAssets,
        initialIndex: realAssets.findIndex(a => a.id === item.id)
      });
    }
  }, [isSelectionMode, displayData, navigation, toggleSelection]);

  const handleLongPress = useCallback((item) => {
    if (item.empty) return;
    const itemId = item.id;
    const isSelected = selectedItems.has(itemId);

    if (isSelected) {
      // Long press on selected -> Open viewer
      const realAssets = displayData.filter(a => !a.empty);
      navigation.navigate('Viewer', {
        item,
        allItems: realAssets,
        initialIndex: realAssets.findIndex(a => a.id === item.id)
      });
    } else {
      // Long press on unselected -> Toggle selection (Start mode if needed)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSelectionMode(true);
      toggleSelection(itemId);
    }
  }, [selectedItems, displayData, navigation, toggleSelection]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    if (selectionPurpose === 'vaultAdd') {
      navigation.setParams({ selectionPurpose: undefined });
    }
  }, [selectionPurpose, navigation]);

  const handleSearchBarLongPress = useCallback(() => {
    if (!isVaultSetup) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showCustomConfirm(
      "Vault Options",
      "Manage your secure vault settings.",
      [
        {
          text: 'Forgot Password',
          onPress: () => {
            navigation.navigate('ForgotVaultPassword');
          }
        },
        {
          text: 'Reset Vault',
          style: 'destructive',
          onPress: () => {
            showCustomConfirm(
              "Reset Vault?",
              "All files in your vault will be permanently deleted. This cannot be undone.",
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Reset Everything',
                  style: 'destructive',
                  onPress: async () => {
                    const success = await deleteVault();
                    if (success) {
                      showAlert("Vault Reset", "Your vault has been completely cleared. You can set it up again from the menu.", null, 'success');
                    }
                  }
                }
              ],
              'error'
            );
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ],
      'info'
    );
  }, [isVaultSetup, navigation, showCustomConfirm, deleteVault, showAlert]);

  const handleVaultAddSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const selectedIds = Array.from(selectedItems);
    const selectedMedia = assets.filter(a => selectedIds.includes(a.id));

    showAlert(
      'Move to Vault',
      `Move ${selectedIds.length} items to your private vault? They will be removed from your gallery.`,
      async () => {
        try {
          const movedVaultItems = [];
          const idsToDelete = [];

          // 1. Copy all to vault first (without deleting originals yet)
          for (const item of selectedMedia) {
            const vaultMetadata = await moveMediaToVault(item, false);
            movedVaultItems.push(vaultMetadata);
            idsToDelete.push(item.id.toString());
          }
          
          // 2. Batch delete all originals in ONE system request
          if (idsToDelete.length > 0) {
            const success = await MediaLibrary.deleteAssetsAsync(idsToDelete);
            
            if (success) {
              // Only update UI if deletion was successful
              movedVaultItems.forEach(v => addMediaToVaultContext(v));
              setAssets(prev => prev.filter(a => !selectedIds.includes(a.id)));
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              exitSelectionMode();
              navigation.navigate('VaultHome');
            } else {
              // User likely cancelled the deletion permission
              showAlert('Cancelled', 'Items were copied to vault but not removed from gallery.', null, 'warning');
              // We still navigate to vault so they can see the copies
              navigation.navigate('VaultHome');
            }
          }
        } catch (error) {
          console.error('[Home] Vault move error:', error);
          showAlert('Error', 'Failed to move items to vault.', null, 'error');
        }
      },
      'confirm'
    );
  }, [selectedItems, assets, exitSelectionMode, showAlert, addMediaToVaultContext, navigation]);

  const handleShareSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const assetsToShare = assets.filter(a => selectedItems.has(a.id));
    if (assetsToShare.length === 0) return;

    try {
      if (Platform.OS === 'android') {
        const { NativeModules } = require('react-native');
        if (NativeModules.MultiShare) {
          await NativeModules.MultiShare.shareImages(assetsToShare.map(a => a.uri));
          exitSelectionMode();
          return;
        }
      }
      await Sharing.shareAsync(assetsToShare[0].uri);
      exitSelectionMode();
    } catch (error) {
      console.error('[Home] Share error:', error);
    }
  }, [selectedItems, assets, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const selectedIds = Array.from(selectedItems);
    const selectedMedia = assets.filter(a => selectedIds.includes(a.id));
    
    showCustomConfirm(
      selectedIds.length > 1 ? `Delete ${selectedIds.length} items?` : "Delete photo?",
      "Choose how you want to delete these items.",
      [
        {
          text: 'Trash',
          style: 'default',
          onPress: async () => {
            try {
              for (const item of selectedMedia) {
                await moveMediaToAppTrash(item);
              }
              const success = await MediaLibrary.deleteAssetsAsync(selectedIds);
              if (success) {
                setAssets(prev => prev.filter(a => !selectedIds.includes(a.id)));
                exitSelectionMode();
              }
            } catch (error) {
              console.error('[Home] Trash error:', error);
            }
          }
        },
        {
          text: 'Permanently delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await MediaLibrary.deleteAssetsAsync(selectedIds);
              if (success) {
                setAssets(prev => prev.filter(a => !selectedIds.includes(a.id)));
                exitSelectionMode();
              }
            } catch (error) {
              console.error('[Home] Delete error:', error);
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [selectedItems, assets, exitSelectionMode, showCustomConfirm]);

  /**
   * 📏 Performance
   */
  const skeletonColors = useMemo(() => ({
    background: isDarkMode ? '#333' : '#e0e0e0',
    border: isDarkMode ? '#1a1a1a' : '#f0f0f0'
  }), [isDarkMode]);

  const renderItem = useCallback(({ item }) => (
    <MediaItem 
      item={item} 
      onPress={handleItemPress}
      onLongPress={handleLongPress}
      isSelected={selectedItems.has(item.id)}
      isSelectionMode={isSelectionMode}
      backgroundColor={skeletonColors.background}
      borderColor={skeletonColors.border}
    />
  ), [handleItemPress, handleLongPress, selectedItems, isSelectionMode, skeletonColors]);

  const keyExtractor = useCallback((item) => item.id, []);

  // --- RENDERING ---

  if (hasPermission === false) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No permission to access media library.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* 1. Header (Search or Selection) */}
      {isSelectionMode ? (
        <View style={[styles.header, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity onPress={exitSelectionMode} style={styles.menuButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitleSelection, { color: colors.text }]}>
            {selectedItems.size} Selected
          </Text>
          <View style={styles.selectionActions}>
            {selectionPurpose === 'vaultAdd' ? (
              <TouchableOpacity onPress={handleVaultAddSelected} style={styles.actionButton}>
                <Ionicons name="lock-closed" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={handleShareSelected} style={styles.actionButton}>
                  <Ionicons name="share-outline" size={24} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteSelected} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => searchInputRef.current?.focus()}
            onLongPress={handleSearchBarLongPress}
            delayLongPress={800}
            style={[styles.searchBar, { backgroundColor: isDarkMode ? '#222' : '#f0f0f0' }]}
          >
            {isVaultSetup ? (
              <AnimatedRainbowSearchIcon size={18} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="search" size={18} color={'#999'} style={{ marginRight: 8 }} />
            )}
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search photos..."
              placeholderTextColor={'#999'}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={'#999'} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsMenuVisible(true)} style={styles.menuButton}>
            <Ionicons name="menu-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Main Gallery List - Only ONE FlatList used here */}
      {isInitialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          
          // Performance
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          
          ListFooterComponent={
            isFetchingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : <View style={{ height: 100 }} />
          }
          contentContainerStyle={{ flexGrow: 1 }}
          
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}

          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: colors.text, opacity: 0.5 }}>No results found</Text>
            </View>
          }
        />
      )}
      <GlassMenu 
        visible={isMenuVisible} 
        onClose={() => setIsMenuVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  menuButton: {
    padding: 4,
  },
  footerLoader: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderWidth: 0.5,
    borderColor: '#f0f0f0',
  },
  image: {
    flex: 1,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,122,255,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 8,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  headerTitleSelection: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
  },
});

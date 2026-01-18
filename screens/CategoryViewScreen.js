import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_SIZE = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

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
        transition={80}
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

      {(item.mediaType === 'video' || item.mediaType === MediaLibrary.MediaType.video || (item.duration && item.duration > 0)) && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function CategoryViewScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { category, media } = route?.params || {};
  const [loading, setLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const shareInProgressRef = React.useRef(false);

  useEffect(() => {
    if (category) {
      navigation.setOptions({
        title: category.name,
      });
    }
  }, [category, navigation]);

  const handleLongPress = useCallback((item) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedItems(new Set([item.id.toString()]));
    }
  }, [isSelectionMode]);

  const handleItemPress = useCallback((item, index) => {
    if (isSelectionMode) {
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
        allItems: media,
        initialIndex: index
      });
    }
  }, [isSelectionMode, media, navigation]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const handleShareSelected = useCallback(async () => {
    if (shareInProgressRef.current) return;

    try {
      shareInProgressRef.current = true;
      const selectedIds = Array.from(selectedItems);
      const selectedMedia = media.filter(item => selectedIds.includes(item.id.toString()));

      if (selectedMedia.length === 0) {
        Alert.alert('Error', 'No items selected');
        return;
      }

      // Collect asset URIs for Android native sharing
      const uris = [];
      for (const item of media) {
        if (selectedItems.has(item.id.toString()) && !item.id.toString().startsWith('vault_')) {
          // Use item.uri which is already a valid content:// URI for MediaLibrary assets on Android
          if (item.uri) {
            uris.push(item.uri);
          }
        }
      }

      if (uris.length === 0) {
        Alert.alert('Error', 'No valid items to share');
        return;
      }

      console.log(`CategoryView: Sharing ${uris.length} items via NativeModules.MultiShare`);

      // Exit selection mode
      exitSelectionMode();

      // Share using our custom native module (ONE intent)
      if (NativeModules.MultiShare) {
        await NativeModules.MultiShare.shareImages(uris);
      } else {
        console.warn('NativeModules.MultiShare not found');
      }

    } catch (error) {
      // Ignore user cancellation errors
      const errorMsg = error.message || '';
      if (!errorMsg.includes('User did not share') && !errorMsg.includes('User cancelled')) {
        console.error('CategoryView: Share error:', errorMsg);
        Alert.alert('Error', 'Failed to share items');
      }
    } finally {
      // Safely reset guard after a delay
      setTimeout(() => {
        shareInProgressRef.current = false;
      }, 1000);
    }
  }, [selectedItems, media, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    const selectedCount = selectedItems.size;

    Alert.alert(
      'Delete Photos',
      `Are you sure you want to delete ${selectedCount} ${selectedCount === 1 ? 'photo' : 'photos'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const selectedIds = Array.from(selectedItems);
              const selectedMedia = media.filter(item => selectedIds.includes(item.id.toString()));

              // Move to system trash (Android MediaStore)
              const { moveToTrash, isTrashSupported } = require('../services/trashService');

              const isSupported = await isTrashSupported();
              if (isSupported) {
                // Filter out vault items - they need special handling
                const mediaLibraryItems = selectedMedia.filter(item =>
                  item.id &&
                  !item.id.toString().startsWith('vault_') &&
                  !item.id.toString().startsWith('picked_') &&
                  !item.id.toString().startsWith('temp_')
                );

                const vaultItems = selectedMedia.filter(item =>
                  item.id && item.id.toString().startsWith('vault_')
                );

                // Move MediaLibrary items to system trash
                if (mediaLibraryItems.length > 0) {
                  const assetIds = mediaLibraryItems.map(item => item.id.toString());
                  try {
                    const result = await moveToTrash(assetIds);
                    if (result.errors && result.errors.length > 0) {
                      console.warn('Some items failed to move to trash:', result.errors);
                    }
                  } catch (error) {
                    console.error('Error moving to trash:', error);
                    Alert.alert('Error', error.message || 'Failed to move items to trash');
                    return;
                  }
                }

                // For vault items, we still use the old method (custom trash)
                if (vaultItems.length > 0) {
                  const trashData = await AsyncStorage.getItem('@gallery_trash');
                  const trashItems = trashData ? JSON.parse(trashData) : [];

                  vaultItems.forEach(item => {
                    trashItems.push({
                      ...item,
                      deletedAt: Date.now(),
                    });
                  });

                  await AsyncStorage.setItem('@gallery_trash', JSON.stringify(trashItems));
                }
              } else {
                // Fallback: Permanently delete if trash not supported
                const mediaLibraryIds = selectedMedia
                  .filter(item => item.id && !item.id.toString().startsWith('vault_'))
                  .map(item => item.id);

                if (mediaLibraryIds.length > 0) {
                  await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                }
              }

              // Exit selection mode
              exitSelectionMode();

              // Navigate back since items are deleted
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting selected items:', error);
              Alert.alert('Error', 'Failed to delete items');
            }
          },
        },
      ]
    );
  }, [selectedItems, media, exitSelectionMode, navigation]);

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
    return item?.id?.toString() || `category-media-${index}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.icon} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
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
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {String(category?.name || 'Category')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.searchPlaceholder }]}>
              {media?.length || 0} {media?.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      )}

      {!media || media.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={category?.icon || 'images-outline'} size={64} color={colors.searchPlaceholder} />
          <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
            No items in this category
          </Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          windowSize={5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    padding: GAP,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP / 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
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
});


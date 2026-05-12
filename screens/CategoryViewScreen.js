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
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import { moveMediaToAppTrash } from '../services/trashService';



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
        transition={0}
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
  const { categoryId, categoryTitle } = route.params;
  const { colors } = useTheme();
  const { showAlert, showConfirm, showCustomConfirm } = useDialog();
  const { category, media: categoryItems } = route?.params || {};
  const [dimensions, setDimensions] = useState({ width });

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

  const handleLongPress = useCallback((item, index) => {
    const itemId = item.id.toString();
    const isSelected = selectedItems.has(itemId);

    if (isSelected) {
      // Long press on selected -> Open viewer
      navigation.navigate('Viewer', {
        item,
        allItems: categoryItems,
        initialIndex: index
      });
    } else {
      // Long press on unselected -> Toggle selection
      setIsSelectionMode(true);
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(itemId);
        return newSet;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [selectedItems, categoryItems, navigation]);

  const handleItemPress = useCallback((item, index) => {
    if (isSelectionMode) {
      // Toggle selection in selection mode
      const itemId = item.id.toString();
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
      Haptics.selectionAsync();
    } else {
      // Normal behavior - open viewer
      navigation.navigate('Viewer', {
        item,
        allItems: categoryItems,
        initialIndex: index
      });
    }
  }, [isSelectionMode, categoryItems, navigation]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const handleShareSelected = useCallback(async () => {
    if (shareInProgressRef.current) return;

    try {
      shareInProgressRef.current = true;
      const selectedIds = Array.from(selectedItems);
      const selectedMedia = categoryItems.filter(item => selectedIds.includes(item.id.toString()));

      if (selectedMedia.length === 0) {
        showAlert('Error', 'No items selected', null, 'error');
        return;
      }


      // Collect asset URIs for Android native sharing
      const uris = [];
      for (const item of categoryItems) {
        if (selectedItems.has(item.id.toString()) && !item.id.toString().startsWith('vault_')) {
          // Use item.uri which is already a valid content:// URI for MediaLibrary assets on Android
          if (item.uri) {
            uris.push(item.uri);
          }
        }
      }

      if (uris.length === 0) {
        showAlert('Error', 'No valid items to share', null, 'error');
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
        showAlert('Error', 'Failed to share items', null, 'error');
      }

    } finally {
      // Safely reset guard after a delay
      setTimeout(() => {
        shareInProgressRef.current = false;
      }, 1000);
    }
  }, [selectedItems, categoryItems, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;

    const selectedIds = Array.from(selectedItems);
    const selectedMedia = categoryItems.filter(item => selectedIds.includes(item.id.toString()));
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
              const mediaLibraryIds = selectedMedia
                .filter(item => {
                  const idStr = (item.id || '').toString();
                  return idStr && 
                    !idStr.startsWith('vault_') && 
                    !idStr.startsWith('picked_') && 
                    !idStr.startsWith('temp_');
                })
                .map(item => item.id.toString());

              if (mediaLibraryIds.length > 0) {
                // Copy to local trash before system delete to ensure we have a backup
                for (const item of selectedMedia) {
                  try {
                    await moveMediaToAppTrash(item);
                  } catch (e) {
                    console.error('Failed to move to app trash:', item.id, e);
                  }
                }
                
                // Trigger system delete dialog
                const success = await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                if (success) {
                  // Update UI
                  setCategoryItems(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
                  exitSelectionMode();
                  showAlert('Success', `${selectedIds.length} items moved to trash`, null, 'success');
                }
              } else {
                // Non-medialibrary items (e.g. vault)
                for (const item of selectedMedia) {
                  await moveMediaToAppTrash(item);
                }
                setCategoryItems(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
                exitSelectionMode();
                showAlert('Success', `${selectedIds.length} items moved to trash`, null, 'success');
              }
            } catch (error) {
              console.error('Trash error:', error);
              showAlert('Error', 'Failed to move items to trash', null, 'error');
            }
          }
        },
        {
          text: 'Permanently delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const mediaLibraryIds = selectedMedia
                .filter(item => {
                  const idStr = (item.id || '').toString();
                  return idStr && 
                    !idStr.startsWith('vault_') && 
                    !idStr.startsWith('picked_') && 
                    !idStr.startsWith('temp_');
                })
                .map(item => item.id.toString());

              if (mediaLibraryIds.length > 0) {
                const success = await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                if (success) {
                  setCategoryItems(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
                  exitSelectionMode();
                }
              } else {
                setCategoryItems(prev => prev.filter(item => !selectedIds.includes(item.id.toString())));
                exitSelectionMode();
              }
            } catch (error) {
              console.error('Permanent delete error:', error);
              showAlert('Error', 'Failed to delete items permanently', null, 'error');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }, [selectedItems, categoryItems, exitSelectionMode, showAlert, showCustomConfirm]);


  const renderItem = useCallback(({ item, index }) => {
    const itemId = item.id.toString();
    const isSelected = selectedItems.has(itemId);

    return (
      <MediaItem
        item={item}
        index={index}
        isSelected={isSelected}
        onPress={() => handleItemPress(item, index)}
        onLongPress={() => handleLongPress(item, index)}
        colors={colors}
      />
    );
  }, [selectedItems, handleItemPress, handleLongPress, colors]);

  const keyExtractor = useCallback((item, index) => {
    return item?.id?.toString() || `category-media-${index}`;
  }, []);

  const getItemLayout = useCallback((data, index) => {
    const size = getItemSize(dimensions.width);
    return {
      length: size + GAP,
      offset: (size + GAP) * Math.floor(index / NUM_COLUMNS),
      index,
    };
  }, [dimensions.width]);

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
              {categoryItems?.length || 0} {categoryItems?.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      )}

      {categoryItems?.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={category?.icon || 'images-outline'} size={64} color={colors.searchPlaceholder} />
          <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
            No items in this category
          </Text>
        </View>
      ) : (
        <FlatList
          key={`category-${dimensions.width}`}
          data={categoryItems}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          windowSize={3}
          removeClippedSubviews={true}
          maxToRenderPerBatch={NUM_COLUMNS * 2}
          updateCellsBatchingPeriod={30}
          initialNumToRender={NUM_COLUMNS * 6}
          ListFooterComponent={loading ? <ActivityIndicator size="small" color="#007AFF" style={{ padding: 20 }} /> : null}
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


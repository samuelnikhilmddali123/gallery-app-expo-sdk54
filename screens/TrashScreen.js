import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrashItems, restoreFromTrash, deletePermanently, isTrashSupported } from '../services/trashService';
import { restoreMediaToVault } from '../services/vaultService';

const TRASH_KEY = '@gallery_trash'; // For vault items only

// Memoized TrashItem component for performance
const TrashItem = React.memo(({ item, index, isSelected, onPress, onLongPress, colors }) => {
  const isVideo = item.mediaType === 'video' || item.mediaType === MediaLibrary.MediaType.video || (item.duration && item.duration > 0);

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
      <ExpoImage
        source={{ uri: item.uri || item.filePath }}
        style={styles.image}
        contentFit="cover"
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

      {/* Video badge */}
      {isVideo && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}

      {/* Deletion date overlay */}
      {item.dateModified && (
        <View style={styles.dateOverlay}>
          <Text style={styles.dateText}>
            {getDaysAgo(item.dateModified)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.isSelected === nextProps.isSelected
  );
});

// Helper function to get days ago
const getDaysAgo = (timestamp) => {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
};

export default function TrashScreen({ navigation }) {
  const { colors } = useTheme();
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [trashSupported, setTrashSupported] = useState(false);

  useEffect(() => {
    checkTrashSupport();
    loadTrash();

    // Listen for navigation focus to refresh trash
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrash();
    });

    return unsubscribe;
  }, [navigation]);

  const checkTrashSupport = async () => {
    if (Platform.OS === 'android') {
      const supported = await isTrashSupported();
      setTrashSupported(supported);
    }
  };

  const runDiagnostics = async () => {
    try {
      // 1. Check AsyncStorage
      const trashData = await AsyncStorage.getItem(TRASH_KEY);
      const dbCount = trashData ? JSON.parse(trashData).length : 0;

      // 2. Check FileSystem
      const TRASH_DIR = `${FileSystem.documentDirectory}trash/`;
      const dirInfo = await FileSystem.getInfoAsync(TRASH_DIR);
      let fileCount = 0;
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(TRASH_DIR);
        fileCount = files.length;
      }

      Alert.alert(
        'Diagnostics',
        `DB Items: ${dbCount}\nFiles on Disk: ${fileCount}\nRaw Data: ${trashData ? trashData.substring(0, 100) : 'null'}...`
      );
    } catch (e) {
      Alert.alert('Diag Error', e.message);
    }
  };

  const loadTrash = async () => {
    try {
      setLoading(true);
      const allTrashItems = [];

      // Load system trash (Android MediaStore)
      if (Platform.OS === 'android' && trashSupported) {
        try {
          const systemTrash = await getTrashItems();
          allTrashItems.push(...systemTrash);
        } catch (error) {
          console.error('Error loading system trash:', error);
        }
      }

      // Load vault items from AsyncStorage (custom trash)
      try {
        const trashData = await AsyncStorage.getItem(TRASH_KEY);
        console.log('[TrashScreen] Raw trash data:', trashData);
        if (trashData) {
          const vaultItems = JSON.parse(trashData);
          console.log('[TrashScreen] Parsed items count:', vaultItems.length);
          // Filter out items that no longer exist
          for (const item of vaultItems) {
            try {
              const fileUri = item.filePath || item.uri;
              if (fileUri) {
                const { exists } = await FileSystem.getInfoAsync(fileUri);
                // Debug: Show item even if it doesn't exist to verify DB save
                allTrashItems.push({
                  ...item,
                  dateModified: item.deletedAt || Date.now(),
                  _debug_exists: exists
                });
              } else {
                allTrashItems.push({ ...item, dateModified: Date.now(), _debug_error: 'no_uri' });
              }
            } catch (error) {
              console.warn('Error checking trash item:', error);
              allTrashItems.push({ ...item, dateModified: Date.now(), _debug_error: true });
            }
          }
        }
      } catch (error) {
        console.error('Error loading vault trash:', error);
      }

      // Sort by date modified (newest first)
      allTrashItems.sort((a, b) => {
        const dateA = a.dateModified || 0;
        const dateB = b.dateModified || 0;
        return dateB - dateA;
      });

      setTrashItems(allTrashItems);
    } catch (error) {
      console.error('Error loading trash:', error);
    } finally {
      setLoading(false);
    }
  };

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
        item: { ...item, isTrash: true },
        allItems: trashItems.map(i => ({ ...i, isTrash: true })),
        initialIndex: index
      });
    }
  }, [isSelectionMode, trashItems, navigation]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const restoreItem = async (item) => {
    try {
      const isVaultItem = item.id && item.id.toString().startsWith('vault_');
      const isAppTrashItem = item.isAppTrash;

      if (isVaultItem) {
        // Restore vault item using service
        await restoreMediaToVault(item);
        Alert.alert('Success', 'Item restored to Vault');
      } else if (isAppTrashItem) {
        // Restore app trash item - save back to gallery, then delete trash copy
        if (item.filePath) {
          await MediaLibrary.createAssetAsync(item.filePath);
          await FileSystem.deleteAsync(item.filePath, { idempotent: true });
        }

        // Remove from trash list
        const trashData = await AsyncStorage.getItem(TRASH_KEY);
        if (trashData) {
          const trashItems = JSON.parse(trashData);
          const updatedTrash = trashItems.filter(t => t.id !== item.id);
          await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));
        }
        Alert.alert('Success', 'Item restored');
      } else if (Platform.OS === 'android' && trashSupported) {
        // Restore from system trash
        const result = await restoreFromTrash([item.id.toString()]);
        if (result.successCount > 0) {
          Alert.alert('Success', 'Item restored');
        } else {
          Alert.alert('Error', result.errors?.[0] || 'Failed to restore item');
        }
      }

      loadTrash();
    } catch (error) {
      console.error('Error restoring item:', error);
      Alert.alert('Error', error.message || 'Failed to restore item');
    }
  };

  const restoreSelected = useCallback(async () => {
    const selectedCount = selectedItems.size;
    if (selectedCount === 0) return;

    Alert.alert(
      'Restore Items',
      `Restore ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} from trash?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const selectedIds = Array.from(selectedItems);
              const selectedItemsData = trashItems.filter(item => selectedIds.includes(item.id.toString()));

              const vaultItems = selectedItemsData.filter(item =>
                item.id && item.id.toString().startsWith('vault_')
              );
              const appTrashItems = selectedItemsData.filter(item => item.isAppTrash);
              const systemItems = selectedItemsData.filter(item =>
                !item.isAppTrash && !(item.id && item.id.toString().startsWith('vault_'))
              );

              // Restore vault items
              for (const item of vaultItems) {
                try {
                  await restoreMediaToVault(item);
                } catch (e) {
                  console.error("Failed to restore vault item", item.id, e);
                }
              }

              // Restore App Trash Items
              for (const item of appTrashItems) {
                if (item.filePath) {
                  await MediaLibrary.createAssetAsync(item.filePath);
                  await FileSystem.deleteAsync(item.filePath, { idempotent: true });
                }
              }

              // Update AsyncStorage (Remove restored vault AND app trash items)
              const localRestoredIds = [...vaultItems, ...appTrashItems].map(i => i.id);
              if (localRestoredIds.length > 0) {
                const trashData = await AsyncStorage.getItem(TRASH_KEY);
                if (trashData) {
                  const trashItems = JSON.parse(trashData);
                  const updatedTrash = trashItems.filter(t => !localRestoredIds.includes(t.id));
                  await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));
                }
              }

              // Restore system trash items
              if (systemItems.length > 0 && Platform.OS === 'android' && trashSupported) {
                const assetIds = systemItems.map(item => item.id.toString());
                const result = await restoreFromTrash(assetIds);
                if (result.errors && result.errors.length > 0) {
                  console.warn('Some items failed to restore:', result.errors);
                }
              }

              exitSelectionMode();
              Alert.alert('Success', `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} restored`);
              loadTrash();
            } catch (error) {
              console.error('Error restoring selected items:', error);
              Alert.alert('Error', error.message || 'Failed to restore items');
            }
          },
        },
      ]
    );
  }, [selectedItems, trashItems, trashSupported, exitSelectionMode]);

  const deletePermanentlyItem = async (item) => {
    Alert.alert(
      'Delete Permanently',
      'Are you sure you want to permanently delete this item? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const isVaultItem = item.id && item.id.toString().startsWith('vault_');
              const isAppTrashItem = item.isAppTrash;

              if (isVaultItem || isAppTrashItem) {
                // Delete file
                if (item.filePath) {
                  try {
                    const { exists } = await FileSystem.getInfoAsync(item.filePath);
                    if (exists) {
                      await FileSystem.deleteAsync(item.filePath, { idempotent: true });
                    }
                  } catch (error) {
                    console.error('Error deleting file:', error);
                  }
                }

                // Remove from custom trash list
                const trashData = await AsyncStorage.getItem(TRASH_KEY);
                if (trashData) {
                  const trashItems = JSON.parse(trashData);
                  const updatedTrash = trashItems.filter(t => t.id !== item.id);
                  await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));
                }
              } else if (Platform.OS === 'android' && trashSupported) {
                // Permanently delete from system trash
                const result = await deletePermanently([item.id.toString()]);
                if (result.errors && result.errors.length > 0) {
                  Alert.alert('Error', result.errors[0] || 'Failed to delete item');
                  return;
                }
              }

              loadTrash();
            } catch (error) {
              console.error('Error deleting permanently:', error);
              Alert.alert('Error', error.message || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const deleteSelectedPermanently = useCallback(async () => {
    const selectedCount = selectedItems.size;
    if (selectedCount === 0) return;

    Alert.alert(
      'Delete Permanently',
      `Are you sure you want to permanently delete ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const selectedIds = Array.from(selectedItems);
              const selectedItemsData = trashItems.filter(item => selectedIds.includes(item.id.toString()));

              const localItems = selectedItemsData.filter(item =>
                (item.id && item.id.toString().startsWith('vault_')) || item.isAppTrash
              );
              const systemItems = selectedItemsData.filter(item =>
                !item.isAppTrash && !(item.id && item.id.toString().startsWith('vault_'))
              );

              // Delete local files (vault + app trash)
              for (const item of localItems) {
                if (item.filePath) {
                  try {
                    const { exists } = await FileSystem.getInfoAsync(item.filePath);
                    if (exists) {
                      await FileSystem.deleteAsync(item.filePath, { idempotent: true });
                    }
                  } catch (error) {
                    console.error('Error deleting local file:', error);
                  }
                }
              }

              // Remove local items from custom trash list
              if (localItems.length > 0) {
                const trashData = await AsyncStorage.getItem(TRASH_KEY);
                if (trashData) {
                  const trashItems = JSON.parse(trashData);
                  const localIds = localItems.map(item => item.id);
                  const updatedTrash = trashItems.filter(t => !localIds.includes(t.id));
                  await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));
                }
              }

              // Permanently delete system trash items
              if (systemItems.length > 0 && Platform.OS === 'android' && trashSupported) {
                const assetIds = systemItems.map(item => item.id.toString());
                const result = await deletePermanently(assetIds);
                if (result.errors && result.errors.length > 0) {
                  console.warn('Some items failed to delete:', result.errors);
                }
              }

              exitSelectionMode();
              Alert.alert('Success', `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} deleted permanently`);
              loadTrash();
            } catch (error) {
              console.error('Error deleting selected items:', error);
              Alert.alert('Error', error.message || 'Failed to delete items');
            }
          },
        },
      ]
    );
  }, [selectedItems, trashItems, trashSupported, exitSelectionMode]);

  const emptyTrash = useCallback(async () => {
    if (trashItems.length === 0) return;

    Alert.alert(
      'Empty Trash',
      `Are you sure you want to permanently delete all ${trashItems.length} ${trashItems.length === 1 ? 'item' : 'items'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Trash',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all local files (vault + app trash)
              const localItems = trashItems.filter(item =>
                (item.id && item.id.toString().startsWith('vault_')) || item.isAppTrash
              );

              for (const item of localItems) {
                if (item.filePath) {
                  try {
                    const { exists } = await FileSystem.getInfoAsync(item.filePath);
                    if (exists) {
                      await FileSystem.deleteAsync(item.filePath, { idempotent: true });
                    }
                  } catch (error) {
                    console.error('Error deleting local file:', error);
                  }
                }
              }

              // Clear local trash list
              await AsyncStorage.setItem(TRASH_KEY, JSON.stringify([]));

              // Delete all system trash items
              const systemItems = trashItems.filter(item =>
                !item.isAppTrash && !(item.id && item.id.toString().startsWith('vault_'))
              );

              if (systemItems.length > 0 && Platform.OS === 'android' && trashSupported) {
                const assetIds = systemItems.map(item => item.id.toString());
                await deletePermanently(assetIds);
              }

              Alert.alert('Success', 'Trash emptied');
              loadTrash();
            } catch (error) {
              console.error('Error emptying trash:', error);
              Alert.alert('Error', error.message || 'Failed to empty trash');
            }
          },
        },
      ]
    );
  }, [trashItems, trashSupported]);

  const renderItem = useCallback(({ item, index }) => {
    const itemId = item.id.toString();
    const isSelected = selectedItems.has(itemId);

    return (
      <TrashItem
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
    return item?.id?.toString() || `trash-${index}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Recycle Bin</Text>
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
              onPress={restoreSelected}
              style={styles.selectionActionButton}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={24} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteSelectedPermanently}
              style={styles.selectionActionButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={24} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Recycle Bin</Text>
          <TouchableOpacity onPress={runDiagnostics} style={{ padding: 8 }}>
            <Ionicons name="bug-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          {trashItems.length > 0 && (
            <TouchableOpacity
              onPress={emptyTrash}
              style={styles.emptyButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={24} color="#ff3b30" />
            </TouchableOpacity>
          )}
          {trashItems.length === 0 && <View style={styles.placeholder} />}
        </View>
      )}

      <FlatList
        data={trashItems}
        keyExtractor={keyExtractor}
        numColumns={3}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-outline" size={64} color={colors.searchPlaceholder} />
            <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
              Trash is empty
            </Text>
          </View>
        }
      />
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  emptyButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    gap: 16,
  },
  selectionActionButton: {
    padding: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 4,
  },
  item: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 4,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dateText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
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
});

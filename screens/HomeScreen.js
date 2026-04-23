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
  Platform,
  UIManager,
  AppState,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import DropdownMenu from '../components/DropdownMenu';
import SideSettingsPanel from '../components/SideSettingsPanel';
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { getFolders, addMediaToFolder } from '../services/folderService';
import { CATEGORIES, categorizeMedia } from '../services/categorizationService';
import { filterVaultMedia, moveMediaToVault, saveMediaCache, loadMediaCache } from '../services/mediaService';
import { moveMediaToAppTrash } from '../services/trashService';
import { removeMediaFromVault } from '../services/vaultService';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 12;
const ITEM_SIZE = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

/**
 * 🌠 MediaItem Component
 * Highly optimized with memoization and internal Reanimated logic for animations.
 */
const MediaItem = React.memo(({ item, index, isSelected, isDeleting, deletionType, onPress, onLongPress }) => {
  const deleteProgress = useSharedValue(0);

  useEffect(() => {
    if (isDeleting) {
      if (deletionType === 'trash') {
        deleteProgress.value = withTiming(1, { duration: 300 });
      } else if (deletionType === 'vault') {
        // Smoke effect to top
        deleteProgress.value = withTiming(3, { 
          duration: 1500, 
          easing: Easing.bezier(0.4, 0, 0.2, 1) 
        });
      } else {
        // Spin shrink delete
        deleteProgress.value = withTiming(2, { duration: 600, easing: Easing.bezier(0.2, 0.64, 0.21, 1) });
      }
    } else {
      deleteProgress.value = 0;
    }
  }, [isDeleting, deletionType]);

  const animatedStyle = useAnimatedStyle(() => {
    const scaleBase = isSelected ? 0.92 : 1;
    
    if (deleteProgress.value === 0) return { opacity: 1, transform: [{ scale: scaleBase }] };
    
    if (deleteProgress.value <= 1) { // Trash fade
      return { opacity: 1 - deleteProgress.value, transform: [{ scale: scaleBase }] };
    }
    
    if (deleteProgress.value <= 2) { // Spin jump delete
      const p = deleteProgress.value - 1; 
      return {
        opacity: 1 - (p * 0.8),
        transform: [
          { translateY: p * 60 },
          { scale: scaleBase * (1 - p) },
          { rotate: `${p * 180}deg` }
        ]
      };
    }

    // Vault Smoke
    const p = deleteProgress.value - 2; 
    return {
      opacity: 1 - p,
      zIndex: 1000,
      transform: [
        { translateY: p * -600 },
        { translateX: p * 50 },
        { scale: 1 - (p * 0.5) },
        { rotate: `${p * 15}deg` }
      ]
    };
  });

  const isVideo = item.mediaType === 'video';

  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(item, index)}
        onLongPress={() => onLongPress(item)}
        style={styles.mediaImage}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={item.id}
        />

        {isVideo && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        )}

        {isSelected && (
          <View style={styles.selectionOverlay}>
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) => (
  prev.item.id === next.item.id &&
  prev.isSelected === next.isSelected &&
  prev.isDeleting === next.isDeleting &&
  prev.deletionType === next.deletionType &&
  prev.onPress === next.onPress &&
  prev.onLongPress === next.onLongPress
));

export default function HomeScreen({ navigation, route }) {
  // Theme & Context
  const { colors, weatherInfo, weatherMode } = useTheme();
  const { isVaultSetup, verifyPassword, unlockVault } = useVault();
  const { showCustomConfirm, showAlert } = useDialog();

  // Primary State
  const [media, setMedia] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsPanelVisible, setSettingsPanelVisible] = useState(false);
  const [menuAnchorPosition, setMenuAnchorPosition] = useState({ x: 16, y: 50 });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [deletingItems, setDeletingItems] = useState(new Set());
  const [lastDeletionType, setLastDeletionType] = useState('trash');
  const [selectionPurpose, setSelectionPurpose] = useState(undefined);
  const [targetFolderId, setTargetFolderId] = useState(null);
  const [targetFolderName, setTargetFolderName] = useState(null);

  // Search Metadata
  const [categorizedMedia, setCategorizedMedia] = useState({});
  const [isCategorizing, setIsCategorizing] = useState(false);

  // Pagination & Locks
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const endCursorRef = useRef(undefined);
  const dataLoadedRef = useRef(false);
  const isInitialSyncDoneRef = useRef(false);
  const loadMoreTimerRef = useRef(null);

  /**
   * 🌈 RAINBOW ANIMATION (Vault Indicator)
   */
  const rainbowProgress = useSharedValue(0);
  const RAINBOW_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF3B30'];
  
  useEffect(() => {
    if (isVaultSetup) {
      rainbowProgress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rainbowProgress);
      rainbowProgress.value = 0;
    }
  }, [isVaultSetup]);

  const animatedSearchIconStyle = useAnimatedStyle(() => ({
    color: isVaultSetup 
      ? interpolateColor(rainbowProgress.value, [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1], RAINBOW_COLORS)
      : colors.searchPlaceholder
  }));

  /**
   * 📥 Fetch Logic (Core Engine)
   */
  const fetchMediaBatch = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    if (!isRefresh && !hasMoreRef.current) return;

    try {
      isFetchingRef.current = true;
      if (isRefresh) setRefreshing(true);
      else setLoadingMore(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Gallery access is needed.');
        return;
      }

      const fetchCount = 100;
      const currentCursor = isRefresh ? undefined : endCursorRef.current;

      const result = await MediaLibrary.getAssetsAsync({
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        first: fetchCount,
        after: currentCursor,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const filteredAssets = await filterVaultMedia(result.assets);

      setMedia(prev => {
        // Optimize: Pre-map IDs to avoid repeated .toString() calls in UI thread (Large Perf Gain)
        const existingItemsMap = new Map();
        prev.forEach(item => {
          if (!item._idStr) item._idStr = item.id.toString();
          existingItemsMap.set(item._idStr, item);
        });

        const merged = isRefresh ? filteredAssets : [...prev, ...filteredAssets];
        const uniqueItems = [];
        const seenIds = new Set();
        
        merged.forEach(incoming => {
          if (!incoming._idStr) incoming._idStr = incoming.id.toString();
          if (!seenIds.has(incoming._idStr)) {
            seenIds.add(incoming._idStr);
            uniqueItems.push(existingItemsMap.get(incoming._idStr) || incoming);
          }
        });

        let final;
        if (isRefresh || prev.length === 0) {
          final = uniqueItems.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0)).slice(0, 3000);
        } else {
          final = uniqueItems.slice(0, 3000);
        }
        
        if (isRefresh || prev.length === 0) {
          saveMediaCache(final.slice(0, 500));
          dataLoadedRef.current = true;
        }
        return final;
      });

      hasMoreRef.current = result.hasNextPage;
      endCursorRef.current = result.endCursor;

    } catch (error) {
      console.error('Fetch Batch Error:', error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  const handleLoadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMoreRef.current) return;
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    loadMoreTimerRef.current = setTimeout(() => fetchMediaBatch(false), 300);
  }, [fetchMediaBatch]);

  /**
   * 🛠️ Initialization Hooks
   */
  useEffect(() => {
    const initialize = async () => {
      const cache = await loadMediaCache();
      if (cache?.length > 0) {
        setMedia(cache);
        dataLoadedRef.current = true;
      } else {
        setLoading(true);
      }
      await fetchMediaBatch(true);
      isInitialSyncDoneRef.current = true;
      
      // Load albums/folders in background
      Promise.all([
        MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true }),
        getFolders()
      ]).then(([a, f]) => {
        setAlbums(a);
        setFolders(f);
      });
    }
    initialize();
  }, [fetchMediaBatch]);

  // Hidden Vault Unlock Logic
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const q = searchQuery.trim();
      if (!q) return;
      if (!isVaultSetup && q.toLowerCase() === 'setup vault') {
        setSearchQuery('');
        navigation.navigate('VaultSetup');
      } else if (isVaultSetup) {
        const isValid = await verifyPassword(q);
        if (isValid) { unlockVault(); setSearchQuery(''); navigation.navigate('VaultHome'); }
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, isVaultSetup, verifyPassword, unlockVault, navigation]);

  /**
   * 🔍 Search Filtering Logic
   */
  const searchResults = useMemo(() => {
    if (!searchQuery) return { media, albums: [], folders: [], isSearching: false };
    const q = searchQuery.toLowerCase().trim();
    
    // Find matching categories
    const catIds = Object.values(CATEGORIES).filter(c => 
      c.name.toLowerCase().includes(q) || c.keywords.some(kw => kw.toLowerCase().includes(q))
    ).map(c => c.id);

    const categoryItemIds = new Set();
    catIds.forEach(id => (categorizedMedia[id] || []).forEach(item => categoryItemIds.add(item.id.toString())));

    return {
      media: media.filter(m => (m.filename || '').toLowerCase().includes(q) || categoryItemIds.has(m.id.toString())),
      albums: albums.filter(a => (a.title || '').toLowerCase().includes(q)),
      folders: folders.filter(f => (f.name || '').toLowerCase().includes(q)),
      isSearching: true
    };
  }, [searchQuery, media, albums, folders, categorizedMedia]);

  const activeMedia = searchQuery ? searchResults.media : media;

  /**
   * ⚡ Selection Mode Actions
   */
  const toggleSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(itemId);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleItemPress = useCallback((item, index) => {
    const id = item._idStr || item.id.toString();
    if (isSelectionMode) {
      // Tap always toggles selection in selection mode
      toggleSelection(id);
    } else {
      // Normal mode -> Open viewer
      const realIdx = activeMedia.findIndex(m => m.id === item.id);
      navigation.navigate('Viewer', { 
        item, 
        allItems: activeMedia, 
        initialIndex: realIdx >= 0 ? realIdx : index, 
        selectedId: item.id 
      });
    }
  }, [isSelectionMode, activeMedia, navigation, toggleSelection]);

  const handleLongPress = useCallback((item, index) => {
    const id = item._idStr || item.id.toString();
    if (isSelectionMode && selectedItems.has(id)) {
      // Long press on selected -> Open viewer
      const realIdx = activeMedia.findIndex(m => m.id === item.id);
      navigation.navigate('Viewer', { 
        item, 
        allItems: activeMedia, 
        initialIndex: realIdx >= 0 ? realIdx : index, 
        selectedId: item.id 
      });
    } else if (!isSelectionMode) {
      // Long press on unselected -> Start selection mode
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSelectionMode(true);
      setSelectedItems(new Set([id]));
    }
  }, [isSelectionMode, selectedItems, activeMedia, navigation]);

  const exitSelectionMode = useCallback(() => {
    Haptics.selectionAsync();
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setSelectionPurpose(undefined);
    navigation.setParams({ selectionPurpose: undefined });
  }, [navigation]);

  const handleShareSelected = useCallback(async () => {
    try {
      const items = activeMedia.filter(m => selectedItems.has(m.id.toString()));
      const uris = items.filter(m => m.id && !m.id.toString().startsWith('vault_')).map(m => m.uri);
      if (uris.length === 0) return;
      exitSelectionMode();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (NativeModules.MultiShare) await NativeModules.MultiShare.shareImages(uris);
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uris[0]);
    } catch (e) {
      console.warn('Share error:', e);
    }
  }, [selectedItems, activeMedia, exitSelectionMode]);

  const handleDeleteSelected = useCallback(() => {
    const selectedMedia = activeMedia.filter(m => selectedItems.has(m.id.toString()));
    showCustomConfirm(selectedItems.size > 1 ? `Delete ${selectedItems.size} items?` : "Delete photo?", "Choose deletion type.", [
      { text: 'Trash', style: 'default', onPress: async () => {
          const libIds = selectedMedia.filter(m => !isNaN(parseInt(m.id))).map(m => m.id.toString());
          for (const item of selectedMedia) await moveMediaToAppTrash(item);
          if (libIds.length > 0 && await MediaLibrary.deleteAssetsAsync(libIds)) {
            setLastDeletionType('trash'); setDeletingItems(new Set(selectedItems));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await new Promise(r => setTimeout(r, 400));
            setMedia(prev => prev.filter(m => !selectedItems.has(m.id.toString())));
            exitSelectionMode();
            setDeletingItems(new Set());
          }
      }},
      { text: 'Permanently delete', style: 'destructive', onPress: async () => {
          const libIds = selectedMedia.filter(m => !isNaN(parseInt(m.id))).map(m => m.id.toString());
          if (libIds.length > 0 && await MediaLibrary.deleteAssetsAsync(libIds)) {
            setLastDeletionType('delete'); setDeletingItems(new Set(selectedItems));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await new Promise(r => setTimeout(r, 700));
            setMedia(prev => prev.filter(m => !selectedItems.has(m.id.toString())));
            exitSelectionMode();
            setDeletingItems(new Set());
          }
      }},
      { text: 'Cancel', style: 'cancel' }
    ]);
  }, [selectedItems, activeMedia, showCustomConfirm, exitSelectionMode]);

  const handleVaultAddConfirm = useCallback(async () => {
    const items = activeMedia.filter(m => selectedItems.has(m.id.toString()));
    const added = [];
    try {
      for (const item of items) {
        const meta = await moveMediaToVault(item, false);
        if (meta) added.push(meta);
      }
      const libIds = items.filter(m => !isNaN(parseInt(m.id))).map(m => m.id.toString());
      if (libIds.length > 0 && !(await MediaLibrary.deleteAssetsAsync(libIds))) {
        for (const v of added) await removeMediaFromVault(v.id);
        return;
      }
      setLastDeletionType('vault'); setDeletingItems(new Set(selectedItems));
      exitSelectionMode();
      await new Promise(r => setTimeout(r, 1500));
      setMedia(prev => prev.filter(m => !selectedItems.has(m.id.toString())));
      setDeletingItems(new Set());
    } catch (e) { console.error(e); }
  }, [selectedItems, activeMedia, exitSelectionMode]);

  /**
   * 🖼️ Rendering Components
   */
  const renderItem = useCallback(({ item, index }) => {
    const id = item._idStr || item.id.toString();
    return (
      <MediaItem
        item={item} index={index}
        isSelected={selectedItems.has(id)}
        isDeleting={deletingItems.has(id)}
        deletionType={lastDeletionType}
        onPress={handleItemPress}
        onLongPress={(item) => handleLongPress(item, index)}
      />
    );
  }, [selectedItems, deletingItems, lastDeletionType, handleItemPress, handleLongPress]);


  const renderContent = () => {
    if (searchQuery) {
      const isEmpty = !searchResults.albums.length && !searchResults.folders.length && !searchResults.media.length;
      if (isEmpty) return (
        <View style={styles.emptyCenter}>
          <Ionicons name="search-outline" size={64} color={colors.searchPlaceholder} />
          <Text style={{ color: colors.searchPlaceholder, marginTop: 12 }}>No items found</Text>
        </View>
      );

      return (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {searchResults.albums.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Albums</Text>
              {searchResults.albums.map(a => (
                <TouchableOpacity key={a.id} style={styles.rowItem} onPress={() => navigation.navigate('AlbumView', { album: a })}>
                  <View style={styles.rowIcon}>{a.coverUri ? <Image source={{ uri: a.coverUri }} style={styles.full} /> : <Ionicons name="images" size={24} color={colors.icon} />}</View>
                  <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{a.title}</Text><Text style={{ color: colors.searchPlaceholder }}>{a.assetCount} items</Text></View>
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {searchResults.folders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Folders</Text>
              {searchResults.folders.map(f => (
                <TouchableOpacity key={f.id} style={styles.rowItem} onPress={() => navigation.navigate('FolderDetail', { folderId: f.id, folderName: f.name })}>
                  <View style={styles.rowIcon}>{f.coverUri ? <Image source={{ uri: f.coverUri }} style={styles.full} /> : <Ionicons name="folder" size={24} color={colors.icon} />}</View>
                  <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{f.name}</Text><Text style={{ color: colors.searchPlaceholder }}>Folder</Text></View>
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {searchResults.media.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos & Videos</Text>
              <View style={styles.searchGrid}>
                {searchResults.media.map((item, idx) => renderItem({ item, index: idx }))}
              </View>
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={media}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={[styles.grid, media.length === 0 && styles.center]}
        initialNumToRender={12}
        windowSize={5}
        maxToRenderPerBatch={8}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={100}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMediaBatch(true)} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.7}
        ListFooterComponent={loadingMore && <ActivityIndicator style={{ padding: 20 }} color={colors.icon} />}
        ListEmptyComponent={!loading && (
          <View style={styles.emptyCenter}>
            <Ionicons name="image-outline" size={64} color={colors.text} style={{ opacity: 0.2 }} />
            <Text style={{ color: colors.text, opacity: 0.6, marginTop: 12 }}>No photos found</Text>
          </View>
        )}
      />
    );
  };

  if (loading && media.length === 0) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.emptyCenter}><ActivityIndicator size="large" color={colors.icon} /></View>
    </SafeAreaView>
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1 }}>
          {isSelectionMode ? (
            <View style={[styles.selectionHeader, { backgroundColor: colors.itemBackground }]}>
              <TouchableOpacity onPress={exitSelectionMode} style={{ padding: 8 }}><Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>{selectedItems.size} selected</Text>
              <View style={styles.selectionActions}>
                {selectionPurpose ? (
                  <TouchableOpacity onPress={selectionPurpose === 'vaultAdd' ? handleVaultAddConfirm : exitSelectionMode} style={{ padding: 4 }}><Ionicons name="checkmark-circle" size={32} color="#007AFF" /></TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={handleShareSelected} style={{ padding: 4 }}><Ionicons name="share-outline" size={24} color={colors.icon} /></TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteSelected} style={{ padding: 4 }}><Ionicons name="trash-outline" size={24} color="#ff3b30" /></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.header}>
              <View style={[styles.searchBar, { backgroundColor: colors.searchBar }]}>
                <AnimatedIonicons name="search" size={16} style={animatedSearchIconStyle} />
                <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="name, people, places" placeholderTextColor={colors.searchPlaceholder} style={[styles.searchInput, { color: colors.searchText }]} autoCapitalize="none" />
                {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={16} color={colors.searchPlaceholder} /></TouchableOpacity>}
                {weatherMode && weatherInfo && (
                   <TouchableOpacity onPress={() => navigation.navigate('Weather')} style={styles.weather}>
                     <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{weatherInfo.temperature}°</Text>
                     <Text style={{ fontSize: 14 }}>{weatherInfo.emoji}</Text>
                   </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setSettingsPanelVisible(true)} style={{ padding: 6 }}><Ionicons name="menu-outline" size={26} color={colors.icon} /></TouchableOpacity>
            </View>
          )}
          {renderContent()}
        </View>
        <DropdownMenu visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={(id) => { if(id==='select') setIsSelectionMode(true); setMenuVisible(false); }} anchorPosition={menuAnchorPosition} />
        <SideSettingsPanel visible={settingsPanelVisible} onClose={() => setSettingsPanelVisible(false)} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 12, height: 40, borderRadius: 20, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  weather: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(150,150,150,0.3)', paddingLeft: 8, gap: 3 },
  grid: { padding: GAP / 2, paddingBottom: 100 },
  item: { width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(150,150,150,0.1)' },
  mediaImage: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', bottom: 8, right: 8, width: 24, height: 24, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(123, 97, 255, 0.2)', borderWidth: 3, borderColor: '#7B61FF', borderRadius: 16 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, backgroundColor: '#7B61FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  selectionActions: { flexDirection: 'row', gap: 15 },
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flexGrow: 1, justifyContent: 'center' },
  section: { marginVertical: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16, marginBottom: 12 },
  rowItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  rowIcon: { width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(150,150,150,0.1)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '100%' },
  searchGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GAP / 2 }
});

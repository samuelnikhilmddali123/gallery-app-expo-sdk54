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
import { useTheme } from '../contexts/ThemeContext';

// --- CONFIGURATION ---
const NUM_COLUMNS = 3;
const BATCH_SIZE = 50; 
const { width } = Dimensions.get('window');
const ITEM_SIZE = Math.floor(width / NUM_COLUMNS);

/**
 * 🖼️ MediaItem Component
 */
const MediaItem = React.memo(({ item, backgroundColor, borderColor, onPress }) => {
  if (item.empty) {
    return <View style={[styles.itemContainer, { backgroundColor: 'transparent', borderLeftWidth: 0 }]} />;
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={() => onPress(item)}
      style={[styles.itemContainer, { backgroundColor, borderColor }]}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
      />
      {item.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Ionicons name="play" size={12} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // --- STATE ---
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);

  // --- REFS ---
  const endCursorRef = useRef(null);
  const hasNextPageRef = useRef(true);
  const isFetchingRef = useRef(false);

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

  const handleItemPress = useCallback((item) => {
    if (item.empty) return;
    const realAssets = displayData.filter(a => !a.empty);
    navigation.navigate('Viewer', {
      item,
      allItems: realAssets,
      initialIndex: realAssets.findIndex(a => a.id === item.id)
    });
  }, [displayData, navigation]);

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
      backgroundColor={skeletonColors.background}
      borderColor={skeletonColors.border}
    />
  ), [handleItemPress, skeletonColors]);

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
      
      {/* 1. Header (Search Bar) - Always above the list */}
      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: isDarkMode ? '#222' : '#f0f0f0' }]}>
          <Ionicons name="search" size={18} color={'#999'} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search photos..."
            placeholderTextColor={'#999'}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={'#999'} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.menuButton}>
          <Ionicons name="menu-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

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
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
});

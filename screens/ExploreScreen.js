import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { filterVaultMedia } from '../services/mediaService';
import { CATEGORIES, categorizeMedia } from '../services/categorizationService';
import { useDialog } from '../contexts/DialogContext';


const { width } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const GAP = 16;
const CATEGORY_CARD_WIDTH = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function ExploreScreen({ navigation }) {
  const { colors } = useTheme();
  const { showAlert } = useDialog();
  const [media, setMedia] = useState([]);

  const [categorizedMedia, setCategorizedMedia] = useState({});
  const [loading, setLoading] = useState(false); // Start with false for immediate UI
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async (refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('MediaLibrary permission not granted');
        if (refresh) setLoading(false);
        return;
      }

      // Load photos and videos in parallel, reduce initial load for faster startup
      const [photosRes, videosRes] = await Promise.all([
        MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 200, // Reduced from 1000 for faster initial load
          sortBy: MediaLibrary.SortBy.creationTime,
        }),
        MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.video,
          first: 200, // Reduced from 1000 for faster initial load
          sortBy: MediaLibrary.SortBy.creationTime,
        }),
      ]);

      const videosWithType = videosRes.assets.map(asset => ({
        ...asset,
        mediaType: 'video',
      }));

      const photosWithType = photosRes.assets.map(asset => ({
        ...asset,
        mediaType: 'photo',
      }));

      const allMedia = [...photosWithType, ...videosWithType].sort(
        (a, b) => (b.creationTime || 0) - (a.creationTime || 0)
      );

      const filteredMedia = await filterVaultMedia(allMedia);
      setMedia(filteredMedia);
      if (refresh) setLoading(false);

      // Categorize media in background (with timeout to prevent hanging)
      setCategorizing(true);
      try {
        const categorized = await Promise.race([
          categorizeMedia(filteredMedia),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Categorization timeout')), 20000) // Reduced timeout
          )
        ]);
        setCategorizedMedia(categorized || {});
      } catch (catError) {
        console.error('Error categorizing media:', catError);
        // Set empty categories on error
        setCategorizedMedia({});
      } finally {
        setCategorizing(false);
      }
    } catch (error) {
      console.error('Error loading media:', error);
      if (refresh) {
        showAlert('Error', 'Failed to load media. Please try again.', null, 'error');
      }

      if (refresh) setLoading(false);
    }
  };

  const getCategoryCount = (categoryId) => {
    return categorizedMedia[categoryId]?.length || 0;
  };

  const getCategoryPreview = (categoryId) => {
    const items = categorizedMedia[categoryId] || [];
    return items.slice(0, 4); // Get first 4 items for preview
  };

  const renderCategoryCard = ({ item: category }) => {
    const count = getCategoryCount(category.id);
    const previewItems = getCategoryPreview(category.id);

    if (count === 0) {
      return null; // Don't show empty categories
    }

    return (
      <TouchableOpacity
        style={[styles.categoryCard, { backgroundColor: colors.itemBackground }]}
        onPress={() => {
          navigation.navigate('CategoryView', {
            category,
            media: categorizedMedia[category.id] || [],
          });
        }}
        activeOpacity={0.7}
      >
        {/* Preview Grid */}
        <View style={styles.previewGrid}>
          {previewItems.map((mediaItem, index) => {
            if (!mediaItem || !mediaItem.uri) return null;
            return (
              <View key={mediaItem.id || `preview-${index}`} style={styles.previewItem}>
                <Image
                  source={{ uri: mediaItem.uri }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
              </View>
            );
          })}
          {previewItems.length < 4 && (
            <View style={[styles.previewItem, styles.previewPlaceholder, { backgroundColor: colors.searchBar }]}>
              <Ionicons name={category?.icon || 'image-outline'} size={24} color={colors.icon} />
            </View>
          )}
        </View>

        {/* Category Info */}
        <View style={styles.categoryInfo}>
          <View style={styles.categoryHeader}>
            <Ionicons name={category?.icon || 'image-outline'} size={24} color={colors.icon} />
            <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
              {String(category?.name || 'Category')}
            </Text>
          </View>
          <Text style={[styles.categoryCount, { color: colors.searchPlaceholder }]}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const categoriesList = Object.values(CATEGORIES).filter(
    category => getCategoryCount(category.id) > 0
  );

  if (loading || categorizing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        </View>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.icon} />
          <Text style={[styles.loadingText, { color: colors.searchPlaceholder }]}>
            {categorizing ? 'Categorizing photos...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: colors.searchPlaceholder }]}>
          Discover your photos by category
        </Text>
      </View>

      {categoriesList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={colors.searchPlaceholder} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No categories found
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.searchPlaceholder }]}>
            {media.length === 0 
              ? 'No photos found in your gallery'
              : 'Categories are based on photo filenames and keywords. Try renaming photos with descriptive names like "beach.jpg" or "family.jpg"'}
          </Text>
          {media.length > 0 && (
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: colors.icon }]}
              onPress={loadMedia}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>Refresh Categories</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={categoriesList}
          renderItem={renderCategoryCard}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={categorizing}
              onRefresh={loadMedia}
              tintColor={colors.icon}
            />
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  list: {
    padding: GAP,
  },
  categoryCard: {
    width: CATEGORY_CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: GAP,
    marginHorizontal: GAP / 2,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: CATEGORY_CARD_WIDTH * 0.6,
  },
  previewItem: {
    width: '50%',
    height: '50%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    padding: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  categoryCount: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


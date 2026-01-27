import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function AlbumsScreen({ navigation }) {
  const { colors } = useTheme();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false for immediate UI

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('MediaLibrary permission not granted');
        setLoading(false);
        return;
      }

      const albumsData = await MediaLibrary.getAlbumsAsync();

      // Get assets for each album in parallel (optimized)
      // Limit initial load to first 20 albums for speed
      const albumsToLoad = albumsData.slice(0, 20);
      const remainingAlbums = albumsData.slice(20);

      const albumsWithAssets = await Promise.all(
        albumsToLoad.map(async (album) => {
          try {
            const assets = await MediaLibrary.getAssetsAsync({
              album: album,
              first: 1,
              sortBy: MediaLibrary.SortBy.creationTime,
            });
            return {
              ...album,
              coverUri: assets.assets[0]?.uri || null,
              assetCount: album.assetCount || 0,
            };
          } catch (error) {
            return {
              ...album,
              coverUri: null,
              assetCount: album.assetCount || 0,
            };
          }
        })
      );

      // Add remaining albums without cover images (load in background)
      const remainingWithDefaults = remainingAlbums.map(album => ({
        ...album,
        coverUri: null,
        assetCount: album.assetCount || 0,
      }));

      setAlbums([...albumsWithAssets, ...remainingWithDefaults]);
      setLoading(false);

      // Load cover images for remaining albums in background
      if (remainingAlbums.length > 0) {
        setTimeout(async () => {
          const remainingWithCovers = await Promise.all(
            remainingAlbums.map(async (album) => {
              try {
                const assets = await MediaLibrary.getAssetsAsync({
                  album: album,
                  first: 1,
                  sortBy: MediaLibrary.SortBy.creationTime,
                });
                return {
                  ...album,
                  coverUri: assets.assets[0]?.uri || null,
                  assetCount: album.assetCount || 0,
                };
              } catch (error) {
                return {
                  ...album,
                  coverUri: null,
                  assetCount: album.assetCount || 0,
                };
              }
            })
          );
          setAlbums(prev => {
            const updated = [...prev];
            remainingWithCovers.forEach((album, index) => {
              const existingIndex = updated.findIndex(a => a.id === album.id);
              if (existingIndex >= 0) {
                updated[existingIndex] = album;
              }
            });
            return updated;
          });
        }, 300);
      }
    } catch (error) {
      console.error('Error loading albums:', error);
      setLoading(false);
    }
  };

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.albumItem, { backgroundColor: colors.itemBackground }]}
      onPress={() => {
        // Navigate to AlbumViewScreen to show media from this album
        navigation.navigate('AlbumView', { album: item });
      }}
      activeOpacity={0.7}
    >
      {item.coverUri ? (
        <ExpoImage
          source={{ uri: item.coverUri }}
          style={styles.albumCover}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.albumCover, styles.albumPlaceholder, { backgroundColor: colors.searchBar }]}>
          <Ionicons name="images-outline" size={40} color={colors.icon} />
        </View>
      )}
      <View style={styles.albumInfo}>
        <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={1}>
          {String(item.title || '')}
        </Text>
        <Text style={[styles.albumCount, { color: colors.searchPlaceholder }]}>
          {item.assetCount} {item.assetCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.icon} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Albums</Text>
      </View>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        renderItem={renderAlbumItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={64} color={colors.searchPlaceholder} />
            <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
              No albums found
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  albumCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  albumPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  albumCount: {
    fontSize: 14,
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


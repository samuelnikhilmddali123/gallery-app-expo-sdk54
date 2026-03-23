import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { loadCachedAIResults } from '../services/aiService';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const [aiResults, setAiResults] = React.useState(null);
  const [thumbnailMap, setThumbnailMap] = React.useState({});
  const [systemFolders, setSystemFolders] = React.useState([]);
  const [profileImage, setProfileImage] = React.useState(null);
  const [profileName, setProfileName] = React.useState('Emily Hawthorne');
  const [originalName, setOriginalName] = React.useState('Emily Hawthorne');

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        const cached = await loadCachedAIResults();
        if (cached) {
          setAiResults(cached.results);
          fetchThumbnails(cached.results);
        }
        loadSystemAlbums();
        
        // Persistent Profile Image
        const storedImage = await require('@react-native-async-storage/async-storage').default.getItem('gallery_profile_image');
        if (storedImage) {
           setProfileImage(storedImage);
        }

        // Persistent Profile Name
        const storedName = await require('@react-native-async-storage/async-storage').default.getItem('gallery_profile_name');
        if (storedName) {
           setProfileName(storedName);
           setOriginalName(storedName);
        }
      };
      fetchData();
    }, [])
);

  const loadSystemAlbums = async () => {
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      const prioritizedNames = ['Screenshots', 'WhatsApp', 'WhatsApp Images', 'Instagram', 'Downloads', 'Facebook', 'Snapchat'];
      const filtered = albums
        .filter(a => prioritizedNames.some(p => a.title.toLowerCase().includes(p.toLowerCase())))
        .sort((a, b) => b.assetCount - a.assetCount)
        .slice(0, 6);
      setSystemFolders(filtered);
    } catch (e) {
      console.warn('Profile: Failed to load system albums', e);
    }
  };

  const fetchThumbnails = async (results) => {
    const allIds = [...(results.goodPics || []).slice(0, 4), ...(results.familyPics || []).slice(0, 4)];
    if (!allIds.length) return;
    const map = {};
    for (const id of allIds) {
      if (thumbnailMap[id]) continue;
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(id);
        if (asset) map[id] = asset.localUri || asset.uri;
      } catch (e) {
        console.warn('Profile: Failed to load thumbnail', id);
      }
    }
    setThumbnailMap(prev => ({ ...prev, ...map }));
  };

  const pickImage = async () => {
    const { status } = await require('expo-image-picker').requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access camera roll is required!');
      return;
    }
    const result = await require('expo-image-picker').launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      
      try {
        const FileSystem = require('expo-file-system');
        const filename = `profile_picture_${Date.now()}.jpg`;
        const dest = `${FileSystem.documentDirectory}${filename}`;
        
        // Copy to permanent storage
        await FileSystem.copyAsync({ from: uri, to: dest });
        
        setProfileImage(dest);
        await require('@react-native-async-storage/async-storage').default.setItem('gallery_profile_image', dest);
      } catch (e) {
        console.error('Failed to save profile picture', e);
        // Fallback to original URI if copy fails
        setProfileImage(uri);
        await require('@react-native-async-storage/async-storage').default.setItem('gallery_profile_image', uri);
      }
    }
  };

  const [isEditingName, setIsEditingName] = React.useState(false);

  const editName = () => {
    setIsEditingName(true);
  };

  const handleNameSubmit = async () => {
    if (profileName === originalName) {
      setIsEditingName(false);
      return;
    }

    setIsEditingName(false);
    setOriginalName(profileName);
    await require('@react-native-async-storage/async-storage').default.setItem('gallery_profile_name', profileName);
  };

  const albums = [
    { id: 1, title: 'Good pics with me', count: aiResults?.goodPics?.length || 0, ids: aiResults?.goodPics?.slice(0, 4) || [], isAI: true },
    { id: 2, title: 'Family pics', count: aiResults?.familyPics?.length || 0, ids: aiResults?.familyPics?.slice(0, 4) || [], isAI: true },
    { id: 3, title: 'First dance', count: 15, images: [1,2,3,4] },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <TouchableOpacity 
            onPress={pickImage}
            activeOpacity={0.8}
            style={[styles.avatarContainer, { borderColor: colors.primary }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.border }]}>
               {profileImage ? (
                 <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%' }} />
               ) : (
                 <Ionicons name="person" size={50} color={colors.primary} />
               )}
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
               <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.nameContainer}>
            {isEditingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={profileName}
                  onChangeText={setProfileName}
                  style={[styles.profileNameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                  autoFocus
                  onBlur={handleNameSubmit}
                  onSubmitEditing={handleNameSubmit}
                />
                <TouchableOpacity onPress={handleNameSubmit}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.profileName, { color: colors.text }]}>{profileName}</Text>
                <TouchableOpacity onPress={editName} style={styles.editButton}>
                   <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* AI Smart Albums Banner */}
        <TouchableOpacity
          style={[styles.aiBanner, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('SmartAlbums')}
          activeOpacity={0.85}
        >
          <View style={styles.aiBannerLeft}>
            <View style={styles.aiIconBg}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.aiBannerTitle}>✨ AI Smart Albums</Text>
              <Text style={styles.aiBannerSub}>Auto-detect Good Pics & Family Pics</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My albums</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Albums')}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsScroll}>
            {albums.map((album) => (
              <TouchableOpacity 
                key={album.id} 
                style={styles.albumCard} 
                onPress={() => navigation.navigate(album.isAI ? 'SmartAlbums' : 'Albums')}
              >
                <View style={styles.albumGrid}>
                  {[0,1,2,3].map(i => {
                    const id = album.ids?.[i];
                    return (
                      <View key={i} style={[styles.albumImage, { backgroundColor: album.isAI && aiResults ? colors.primary + '11' : colors.border }]}>
                        {id && thumbnailMap[id] ? (
                          <Image source={{ uri: thumbnailMap[id] }} style={styles.thumbImageFill} />
                        ) : (
                          album.isAI && i === 0 && (
                            <Ionicons name="sparkles" size={14} color={colors.primary + '44'} style={{ alignSelf: 'center', marginTop: 15 }} />
                          )
                        )}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.albumInfo}>
                  <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                  <Text style={[styles.albumCount, { color: colors.textSecondary }]}>{album.count} items</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My folders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Folders')}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsScroll}>
            {systemFolders.length > 0 ? (
              systemFolders.map((folder) => (
                <TouchableOpacity 
                  key={folder.id} 
                  style={styles.folderCard} 
                  onPress={() => navigation.navigate('AlbumView', { album: folder })}
                >
                  <View style={[styles.folderIconPlaceholder, { backgroundColor: colors.border }]}>
                    <Ionicons name="folder" size={40} color={colors.primary} />
                  </View>
                  <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={1}>{folder.title}</Text>
                  <Text style={[styles.folderCount, { color: colors.textSecondary }]}>{folder.assetCount} items</Text>
                </TouchableOpacity>
              ))
            ) : (
              [1,2,3].map(i => (
                <View key={i} style={styles.folderCard}>
                   <View style={[styles.folderIconPlaceholder, { backgroundColor: colors.border }]} />
                   <View style={{ height: 10, width: 60, backgroundColor: colors.border, marginTop: 8 }} />
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },
  profileSection: { alignItems: 'center', marginTop: 10 },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  avatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  profileName: { fontSize: 24, fontWeight: '700' },
  profileNameInput: {
    fontSize: 24,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingVertical: 4,
    minWidth: 150,
  },
  editButton: {
    padding: 4,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBannerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiBannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  albumsScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  albumCard: { width: 150, marginRight: 15 },
  folderCard: { width: 120, marginRight: 15 },
  albumGrid: {
    width: 150,
    height: 100,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 15,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 8,
  },
  folderIconPlaceholder: {
    width: 120,
    height: 100,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  folderCount: { fontSize: 12, marginTop: 2 },
  albumImage: { width: '49%', height: '49%' },
  albumTitle: { fontSize: 13, fontWeight: '700' },
  albumInfo: { marginTop: 2 },
  albumCount: { fontSize: 11, fontWeight: '600' },
  thumbImageFill: { width: '100%', height: '100%', borderRadius: 4 },
});


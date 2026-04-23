import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../contexts/ThemeContext';
import { loadCachedAIResults } from '../services/aiService';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useDialog } from '../contexts/DialogContext';


export default function ProfileScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { showAlert } = useDialog();
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
      showAlert('Permission required', 'Permission to access camera roll is required!', null, 'error');
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
        <TouchableOpacity 
          onPress={() => {
            Haptics.selectionAsync();
            navigation.goBack();
          }} 
          style={styles.headerButton}
        >
          <BlurView
            intensity={30}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.backButtonGlass}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </BlurView>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <TouchableOpacity 
            onPress={() => {
              Haptics.selectionAsync();
              pickImage();
            }}
            activeOpacity={0.8}
            style={styles.avatarWrapper}
          >
            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.avatarContainer, 
                { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                  shadowOpacity: isDarkMode ? 0.35 : 0.15,
                }
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: 'transparent' }]}>
                 {profileImage ? (
                   <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%' }} />
                 ) : (
                   <Ionicons name="person" size={50} color={colors.primary} />
                 )}
              </View>
            </BlurView>
            
            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.avatarEditBadge, { backgroundColor: colors.primary + 'CC' }]}
            >
               <Ionicons name="camera" size={12} color="#fff" />
            </BlurView>
          </TouchableOpacity>
          
          <BlurView 
            intensity={40} 
            tint={isDarkMode ? 'dark' : 'light'} 
            style={[
              styles.namePill,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
              }
            ]}
          >
            <View style={[styles.nameInnerHighlight, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' }]}>
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
          </BlurView>
        </View>

        {/* AI Smart Albums Banner */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            Haptics.selectionAsync();
            navigation.navigate('SmartAlbums');
          }}
          style={styles.aiBannerContainer}
        >
          <BlurView 
            intensity={60} 
            tint={isDarkMode ? 'dark' : 'light'} 
            style={[
              styles.aiBannerGlass,
              { 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                shadowOpacity: isDarkMode ? 0.35 : 0.15,
              }
            ]}
          >
            <View style={[styles.aiBannerHighlight, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' }]}>
              <View style={[styles.aiBannerLeft, { backgroundColor: 'transparent' }]}>
                <View style={[styles.aiIconBg, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons name="sparkles" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.aiBannerTitle, { color: colors.text }]}>✨ AI Smart Albums</Text>
                  <Text style={[styles.aiBannerSub, { color: colors.textSecondary }]}>Auto-detect Good Pics & Family Pics</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </BlurView>
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
                activeOpacity={0.8}
              >
                <BlurView 
                  intensity={40} 
                  tint={isDarkMode ? 'dark' : 'light'} 
                  style={[
                    styles.albumGridGlass, 
                    { 
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                      shadowOpacity: isDarkMode ? 0.35 : 0.1,
                    }
                  ]}
                >
                  <View style={[styles.tileHighlight, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' }]}>
                    <View style={styles.albumGrid}>
                      {[0,1,2,3].map(i => {
                        const id = album.ids?.[i];
                        return (
                          <View key={i} style={[styles.albumImage, { backgroundColor: 'transparent' }]}>
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
                  </View>
                </BlurView>
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
                  activeOpacity={0.8}
                >
                  <BlurView 
                    intensity={40} 
                    tint={isDarkMode ? 'dark' : 'light'} 
                    style={[
                      styles.folderIconGlass, 
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                        shadowOpacity: isDarkMode ? 0.35 : 0.1,
                      }
                    ]}
                  >
                    <View style={[styles.tileHighlight, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' }]}>
                      <View style={[styles.folderIconPlaceholder, { backgroundColor: 'transparent' }]}>
                        <Ionicons name="folder" size={40} color={colors.primary} />
                      </View>
                    </View>
                  </BlurView>
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

const { width } = Dimensions.get('window');

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
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scrollContent: { paddingBottom: 150 },
  profileSection: { alignItems: 'center', marginTop: 10 },
  avatarWrapper: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatarContainer: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glassCard: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  glassInner: {
    borderRadius: 19,
    borderTopWidth: 1.2,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    flex: 1,
  },
  namePill: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 30,
    backgroundColor: 'transparent',
    borderWidth: 1,
    overflow: 'hidden',
  },
  nameInnerHighlight: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  aiBannerContainer: {
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 24,
    overflow: 'hidden',
  },
  aiBannerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  aiBannerHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 17,
    borderRadius: 23,
    borderTopWidth: 1.2,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    flex: 1,
  },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBannerTitle: { fontSize: 16, fontWeight: '700' },
  aiBannerSub: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  section: { marginTop: 35, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  albumsScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  albumCard: { width: 160, marginRight: 15 },
  folderCard: { width: 130, marginRight: 15 },
  albumGridGlass: {
    width: 160,
    height: 106,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginBottom: 10,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  tileHighlight: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    borderTopWidth: 1.2,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  folderIconGlass: {
    width: 130,
    height: 106,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  folderIconPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  folderCount: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  albumImage: { width: '49%', height: '49%', borderRadius: 8 },
  albumTitle: { fontSize: 14, fontWeight: '700', marginLeft: 4 },
  albumInfo: { marginTop: 2 },
  albumCount: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  thumbImageFill: { width: '100%', height: '100%', borderRadius: 8 },
});


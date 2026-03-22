import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();

  const albums = [
    { id: 1, title: 'Good pics with me', count: 12, images: [1,2,3,4] },
    { id: 2, title: 'Family pics', count: 8, images: [1,2,3,4] },
    { id: 3, title: 'First dance', count: 15, images: [1,2,3,4] },
  ];

  const memories = [
    { id: 1, likes: 20 },
    { id: 2, likes: 55 },
    { id: 3, likes: 12 },
    { id: 4, likes: 8 },
  ];

  const folders = [
    { id: 1, name: 'Screenshots', count: 156 },
    { id: 2, name: 'Downloads', count: 42 },
    { id: 3, name: 'WhatsApp', count: 890 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My profile</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="person-add-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <View style={[styles.avatarContainer, { borderColor: colors.primary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.border }]}>
               <Ionicons name="person" size={50} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>Emily Hawthorne</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>Bride's family</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Add memories</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="videocam-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Add greeting</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My albums</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Albums')}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsScroll}>
            {albums.map((album) => (
              <TouchableOpacity key={album.id} style={styles.albumCard} onPress={() => navigation.navigate('Albums')}>
                <View style={styles.albumGrid}>
                  {[1,2,3,4].map(i => (
                    <View key={i} style={[styles.albumImage, { backgroundColor: colors.border }]} />
                  ))}
                </View>
                <Text style={[styles.albumTitle, { color: colors.text }]}>{album.title}</Text>
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
            {folders.map((folder) => (
              <TouchableOpacity key={folder.id} style={styles.folderCard} onPress={() => navigation.navigate('Folders')}>
                <View style={[styles.folderIconPlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons name="folder" size={40} color={colors.primary} />
                </View>
                <Text style={[styles.albumTitle, { color: colors.text }]}>{folder.name}</Text>
                <Text style={[styles.folderCount, { color: colors.textSecondary }]}>{folder.count} items</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My memories</Text>
            <TouchableOpacity><Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={styles.memoriesGrid}>
            {memories.map((memory) => (
              <View key={memory.id} style={[styles.memoryCard, { backgroundColor: colors.border }]}>
                <View style={styles.memoryLikes}>
                  <Ionicons name="heart" size={14} color="#fff" />
                  <Text style={styles.likesText}>{memory.likes}</Text>
                </View>
              </View>
            ))}
          </View>
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
  },
  avatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  profileName: { fontSize: 24, fontWeight: '700', marginBottom: 5 },
  roleBadge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontSize: 13, fontWeight: '600' },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 25,
    paddingHorizontal: 20,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
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
  albumTitle: { fontSize: 14, fontWeight: '600' },
  memoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  memoryCard: { width: '47%', aspectRatio: 0.8, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 },
  memoryLikes: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  likesText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});


import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { getVaultMedia, removeMediaFromVault, ensureVaultDirectory } from '../services/vaultService';
import { moveMediaToVault } from '../services/mediaService';
import VaultPasswordScreen from './VaultPasswordScreen';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_SIZE = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function VaultScreen({ navigation, onLock }) {
  const { colors } = useTheme();
  const { lockVault, isVaultUnlocked, unlockVault, verifyPassword } = useVault();
  const [vaultMedia, setVaultMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasswordScreen, setShowPasswordScreen] = useState(false);
  const appState = useRef(AppState.currentState);

  // Lock vault when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has gone to background, lock vault
        lockVault();
        if (onLock) onLock();
      }
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [lockVault, onLock]);

  // Note: Screenshot protection (FLAG_SECURE) requires native code changes
  // For full implementation, you would need to:
  // 1. Create a custom native module or
  // 2. Use expo-build-properties with a config plugin
  // The structure is in place, but requires native Android/iOS code

  // Load vault media - optimized
  const loadVaultMedia = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      // Use skipFileCheck for faster loading, but force cache bypass if not showing loader (refreshing)
      const ignoreCache = !showLoader;
      const media = await getVaultMedia(true, ignoreCache);
      // Sort by creation time (newest first)
      media.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setVaultMedia(media);
    } catch (error) {
      console.error('Error loading vault media:', error);
      Alert.alert('Error', 'Failed to load vault media');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Check if vault is unlocked when screen loads
    if (!isVaultUnlocked) {
      setShowPasswordScreen(true);
    } else {
      loadVaultMedia();
    }
  }, []);

  // Load media when vault is unlocked
  useEffect(() => {
    if (isVaultUnlocked && !showPasswordScreen) {
      loadVaultMedia();
    }
  }, [isVaultUnlocked, showPasswordScreen]);



  // Handle long press to remove from vault
  const handleLongPress = async (item) => {
    // Directly remove without confirmation
    const success = await removeMediaFromVault(item.id);
    if (success) {
      loadVaultMedia();
    } else {
      Alert.alert('Error', 'Failed to remove item from vault');
    }
  };


  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.item, { backgroundColor: colors.itemBackground }]}
      onPress={() => navigation.navigate('Viewer', {
        item,
        allItems: vaultMedia,
        initialIndex: index
      })}
      onLongPress={() => handleLongPress(item)}
    >
      <Image
        source={{ uri: item.uri || item.filePath }}
        style={styles.image}
        contentFit="cover"
        transition={80}
      />
      {item.mediaType === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Your Vault is Empty</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Go to your main Gallery and tap the Lock icon to secure photos
      </Text>
    </View>
  );

  // Show password screen if vault is not unlocked
  if (showPasswordScreen && !isVaultUnlocked) {
    return (
      <VaultPasswordScreen
        onUnlock={() => {
          unlockVault();
          setShowPasswordScreen(false);
          loadVaultMedia();
        }}
      />
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.icon} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              lockVault();
              if (onLock) onLock();
              navigation.goBack();
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Vault</Text>
          <View style={styles.backButton} />
        </View>

        {/* Grid */}
        <FlatList
          data={vaultMedia}
          keyExtractor={(item, index) => item?.id?.toString() || `vault-${index}`}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.grid,
            vaultMedia.length === 0 && styles.gridEmpty,
          ]}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadVaultMedia(false);
          }}
        />

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#007AFF' }]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Photos', params: { selectionPurpose: 'vaultAdd' } })}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    padding: GAP,
  },
  gridEmpty: {
    flexGrow: 1,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP / 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


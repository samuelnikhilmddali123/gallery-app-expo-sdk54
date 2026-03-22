import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, FlatList, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../contexts/ThemeContext';
import { scanGalleryWithAI, loadCachedAIResults, clearAICache, CATEGORY_RULES } from '../services/aiService';

const { width } = Dimensions.get('window');
const THUMB = (width - 48) / 3;

export default function SmartAlbumsScreen({ navigation }) {
  const { colors } = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [smartAlbums, setSmartAlbums] = useState(null);
  const [mediaMap, setMediaMap] = useState({});
  const [activeTab, setActiveTab] = useState('goodPics');
  const [cachedAt, setCachedAt] = useState(null);

  useEffect(() => {
    loadCache();
  }, []);

  const loadCache = async () => {
    const cached = await loadCachedAIResults();
    if (cached) {
      setSmartAlbums(cached.results);
      setCachedAt(cached.scannedAt);
      fetchMediaForIds(Object.values(cached.results).flat());
    }
  };

  const fetchMediaForIds = async (ids) => {
    if (!ids.length) return;
    const map = {};
    for (const id of ids) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(id);
        if (asset) map[id] = asset.localUri || asset.uri;
      } catch {}
    }
    setMediaMap(prev => ({ ...prev, ...map }));
  };

  const startScan = async () => {
    setIsScanning(true);
    setProgress({ current: 0, total: 0 });

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow media access to scan photos.');
        setIsScanning(false);
        return;
      }

      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 50,
        sortBy: MediaLibrary.SortBy.modificationTime,
      });

      const results = await scanGalleryWithAI(
        assets.map(a => ({ id: a.id, uri: a.uri })),
        (current, total) => setProgress({ current, total })
      );

      setSmartAlbums(results);
      setCachedAt(Date.now());
      await fetchMediaForIds(Object.values(results).flat());

    } catch (e) {
      if (e.message === 'NO_API_KEY') {
        Alert.alert(
          '🔑 API Key Required',
          'To use AI Smart Albums, please add your Google Cloud Vision API key in:\n\nservices/aiService.js\n\nGet a free key at:\nconsole.cloud.google.com',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Scan failed', e.message);
      }
    }

    setIsScanning(false);
  };

  const handleClearCache = () => {
    Alert.alert('Clear AI Results', 'Remove all AI scan results and start fresh?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await clearAICache();
          setSmartAlbums(null);
          setMediaMap({});
          setCachedAt(null);
        }
      }
    ]);
  };

  const tabs = Object.entries(CATEGORY_RULES).map(([key, val]) => ({
    key, label: val.title, icon: val.icon, color: val.color,
    count: smartAlbums?.[key]?.length || 0,
  }));

  const activeIds = smartAlbums?.[activeTab] || [];

  const renderPhoto = ({ item: id }) => (
    <TouchableOpacity
      style={[styles.thumb, { backgroundColor: colors.border }]}
      onPress={() => {
        if (mediaMap[id]) {
          // Navigate to viewer if available
        }
      }}
    >
      {mediaMap[id] ? (
        <Image source={{ uri: mediaMap[id] }} style={styles.thumbImage} contentFit="cover" />
      ) : (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Smart Albums</Text>
          {cachedAt && (
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Last scanned {Math.round((Date.now() - cachedAt) / 60000)}m ago
            </Text>
          )}
        </View>
        {smartAlbums && (
          <TouchableOpacity onPress={handleClearCache} style={styles.backBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Scan Button Area */}
      {!smartAlbums && !isScanning && (
        <View style={styles.scanPrompt}>
          <View style={[styles.aiIconCircle, { backgroundColor: colors.accent }]}>
            <Ionicons name="sparkles" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.scanTitle, { color: colors.text }]}>Discover Your Best Moments</Text>
          <Text style={[styles.scanDesc, { color: colors.textSecondary }]}>
            Our AI will scan your gallery and automatically sort photos into{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Good Pics</Text>,{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Family Pics</Text>, and more.
          </Text>

          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: colors.primary }]}
            onPress={startScan}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.scanButtonText}>Scan My Gallery with AI</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Requires Google Cloud Vision API key. Up to 50 photos are analyzed per scan.
            </Text>
          </View>
        </View>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <View style={styles.scanPrompt}>
          <View style={[styles.aiIconCircle, { backgroundColor: colors.accent }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={[styles.scanTitle, { color: colors.text }]}>Analyzing your photos…</Text>
          <Text style={[styles.scanDesc, { color: colors.textSecondary }]}>
            {progress.current} of {progress.total} photos scanned
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.primary,
              width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '5%'
            }]} />
          </View>
        </View>
      )}

      {/* Results */}
      {smartAlbums && !isScanning && (
        <>
          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabs}
          >
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  { backgroundColor: activeTab === tab.key ? colors.primary : colors.surface,
                    borderColor: activeTab === tab.key ? colors.primary : colors.border }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.tabLabel, { color: activeTab === tab.key ? '#fff' : colors.text }]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabBadge, {
                  backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.3)' : colors.border
                }]}>
                  <Text style={[styles.tabCount, { color: activeTab === tab.key ? '#fff' : colors.textSecondary }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Photos Grid */}
          {activeIds.length === 0 ? (
            <View style={styles.emptyResult}>
              <Ionicons name="image-outline" size={50} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No photos found in this category
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeIds}
              keyExtractor={id => id}
              numColumns={3}
              renderItem={renderPhoto}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Rescan Button */}
          <TouchableOpacity
            style={[styles.rescanButton, { borderColor: colors.primary }]}
            onPress={startScan}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.rescanText, { color: colors.primary }]}>Rescan Photos</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  scanPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  aiIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scanTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  scanDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 8,
    elevation: 4,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  tabsScroll: { flexGrow: 0, marginTop: 8 },
  tabs: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabCount: { fontSize: 11, fontWeight: '700' },
  grid: { padding: 12, gap: 4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    margin: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  emptyResult: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  rescanText: { fontSize: 15, fontWeight: '600' },
});

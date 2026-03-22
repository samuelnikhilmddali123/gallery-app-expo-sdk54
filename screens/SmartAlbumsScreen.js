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
import { scanGalleryWithAI, loadCachedAIResults, clearAICache, CATEGORY_RULES, isAIAvailable } from '../services/aiService';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  withDelay,
  Easing,
  runOnJS
} from 'react-native-reanimated';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB = (width - 48) / 3;

// --- Floating Smoke Media Component ---
const FloatingPhoto = ({ uri, onComplete }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue((Math.random() - 0.5) * 100);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withTiming(-SCREEN_HEIGHT * 0.7, {
      duration: 3000,
      easing: Easing.out(Easing.quad),
    }, () => runOnJS(onComplete)());
    
    translateX.value = withTiming(translateX.value + (Math.random() - 0.5) * 150, {
      duration: 3000,
    });

    opacity.value = withSequence(
      withTiming(1, { duration: 500 }),
      withDelay(1500, withTiming(0, { duration: 1000 }))
    );

    scale.value = withTiming(1.2, { duration: 3000 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingPhoto, animatedStyle]}>
      <Image 
        source={{ uri }} 
        style={styles.smokeImage} 
        contentFit="cover"
        transition={200}
      />
    </Animated.View>
  );
};

export default function SmartAlbumsScreen({ navigation }) {
  const { colors } = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [smartAlbums, setSmartAlbums] = useState(null);
  const [mediaMap, setMediaMap] = useState({});
  const [activeTab, setActiveTab] = useState('goodPics');
  const [cachedAt, setCachedAt] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [scanStream, setScanStream] = useState([]); // For smoke animation
  const maxSmokeItems = 12; // Performance limit

  useEffect(() => {
    checkSupport();
    loadCache();
  }, []);

  const checkSupport = async () => {
    const available = await isAIAvailable();
    setIsSupported(available);
  };

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

    const available = await isAIAvailable();
    if (!available) {
      Alert.alert(
        '🚀 Rebuild Required',
        'Your AI Smart Albums feature needs to be linked to your app. Please run:\n\nnpx expo run:android\n\n(or recreate your development build) to enable on-device AI.',
        [{ text: 'OK' }]
      );
      setIsScanning(false);
      setIsSupported(false);
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow media access to scan photos.');
        setIsScanning(false);
        return;
      }

      // Fetch ALL photos from the library
      let allAssets = [];
      let hasNextPage = true;
      let after = null;

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1000, // Batch size
          after: after,
          sortBy: MediaLibrary.SortBy.modificationTime,
        });
        allAssets = [...allAssets, ...result.assets];
        hasNextPage = result.hasNextPage;
        after = result.endCursor;
        
        // Safety break if gallery is unusually huge, but let's allow up to 10k for now
        if (allAssets.length >= 10000) break;
      }

      const uriLookup = {};
      allAssets.forEach(a => uriLookup[a.id] = a.uri);

      const results = await scanGalleryWithAI(
        allAssets.map(a => ({ id: a.id, uri: a.uri })),
        (current, total, category, id) => {
          setProgress({ current, total });
          if (uriLookup[id]) {
            setScanStream(prev => {
              const newItem = { id: `${id}_${Date.now()}`, uri: uriLookup[id] };
              return [...prev.slice(-maxSmokeItems), newItem];
            });
          }
        }
      );

      setSmartAlbums(results);
      setCachedAt(Date.now());
      await fetchMediaForIds(Object.values(results).flat());

    } catch (e) {
      Alert.alert('Scan failed', e.message);
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
            Our on-device AI will scan your gallery locally and automatically sort photos into{' '}
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
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Private & Secure. All processing happens locally on your device. No data ever leaves your phone.
            </Text>
          </View>
        </View>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <View style={styles.scanningOverlay}>
          {/* Floating Smoke Items */}
          <View style={styles.smokeContainer} pointerEvents="none">
            {scanStream.map((item) => (
              <FloatingPhoto 
                key={item.id} 
                uri={item.uri} 
                onComplete={() => setScanStream(prev => prev.filter(i => i.id !== item.id))}
              />
            ))}
          </View>

          <View style={styles.scanPrompt}>
            <Text style={[styles.scanTitle, { color: colors.text, marginTop: 100 }]}>AI Analysis in Progress…</Text>
            <Text style={[styles.scanDesc, { color: colors.textSecondary }]}>
              Finding your best moments • {progress.current}/{progress.total}
            </Text>
            <Text style={[styles.smokeHint, { color: colors.primary }]}>Your photos are floating up like magic ✨</Text>
            
            <View style={[styles.progressBarFull, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, {
                backgroundColor: colors.primary,
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '5%'
              }]} />
            </View>
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
  // --- Smoke Animation Styles ---
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 100,
  },
  smokeContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  floatingPhoto: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#eee',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  smokeImage: { width: '100%', height: '100%' },
  smokeHint: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginTop: 10,
    fontStyle: 'italic',
    opacity: 0.8
  },
  progressBarFull: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 20,
  },
});

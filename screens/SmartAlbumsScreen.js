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
import { useAI } from '../contexts/AIContext';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useDialog } from '../contexts/DialogContext';


import { CATEGORY_RULES } from '../services/aiService';
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
  const { colors, isDarkMode } = useTheme();
  const { showConfirm, showAlert } = useDialog();
  const { isAnalyzing, progress, lastScannedUri, results, scannedAt, isSupported, startScan, clearResults } = useAI();
  const [mediaMap, setMediaMap] = useState({});

  const [activeTab, setActiveTab] = useState('goodPics');
  const [fullMediaItems, setFullMediaItems] = useState([]); // Array of full asset objects for viewer
  const [scanStream, setScanStream] = useState([]); // Local store for floating items
  const maxSmokeItems = 12;

  // React to background scan stream for smoke animation
  useEffect(() => {
    if (isAnalyzing && lastScannedUri) {
        setScanStream(prev => {
            const newItem = { id: `${Date.now()}_${Math.random()}`, uri: lastScannedUri };
            return [...prev.slice(-maxSmokeItems), newItem];
        });
    }
  }, [isAnalyzing, lastScannedUri]);

  // Load media items whenever results change or tab changes
  useEffect(() => {
    if (results) {
        fetchMediaForTab(activeTab);
    }
  }, [results, activeTab]);

  const fetchMediaForTab = async (tab) => {
    const ids = results[tab] || [];
    if (!ids.length) {
        setFullMediaItems([]);
        return;
    }
    
    const assets = [];
    const map = {};
    
    // Batch fetch assets to get full metadata (width, height, duration etc)
    // We do it in chunks to avoid blocking bread
    const CHUNK_SIZE = 50;
    const items = ids.slice(0, 200); // Limit total shown in grid for performance
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        try {
            const result = await MediaLibrary.getAssetsAsync({
                ids: chunk,
            });
            assets.push(...result.assets);
            result.assets.forEach(a => {
                map[a.id] = a.uri;
            });
        } catch (e) {
            console.warn('SmartAlbums: Chunk fetch failed', e);
        }
    }
    
    setMediaMap(prev => ({ ...prev, ...map }));
    setFullMediaItems(assets);
  };

  const tabs = Object.entries(CATEGORY_RULES).map(([key, val]) => ({
    key, label: val.title, icon: val.icon, color: val.color,
    count: results?.[key]?.length || 0,
  }));

  const renderPhoto = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.thumb, { backgroundColor: colors.border }]}
      onPress={() => {
          navigation.navigate('Viewer', {
              item,
              allItems: fullMediaItems,
              initialIndex: index
          });
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.thumbImage} contentFit="cover" transition={100} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            Haptics.selectionAsync();
            navigation.goBack();
          }} 
          style={styles.backBtn}
        >
          <BlurView
            intensity={30}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.backBtnGlass}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </BlurView>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Smart Albums</Text>
          {scannedAt && (
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Last scanned {Math.round((Date.now() - scannedAt) / 60000)}m ago
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {results && (
            <TouchableOpacity onPress={() => {
                Haptics.selectionAsync();
                showConfirm(
                  'Clear AI Results', 
                  'Remove all AI scan results and start fresh?', 
                  clearResults,
                  null,
                  true
                );
            }} style={styles.backBtn}>
              <BlurView
                intensity={30}
                tint={isDarkMode ? 'dark' : 'light'}
                style={styles.backBtnGlass}
              >
                <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              </BlurView>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scan Button Area */}
      {!results && !isAnalyzing && (
        <View style={styles.scanPromptContainer}>
          <BlurView
            intensity={40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.scanCard, { borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)' }]}
          >
            <View style={[styles.aiIconCircle, { backgroundColor: colors.primary + '15' }]}>
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
              onPress={() => {
                Haptics.selectionAsync();
                startScan();
              }}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.scanButtonText}>Scan My Gallery with AI</Text>
            </TouchableOpacity>

            <View style={[styles.infoBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.primary + '22' }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Private & Secure. All processing happens locally on your device. No data ever leaves your phone.
              </Text>
            </View>
          </BlurView>
        </View>
      )}

      {/* Scanning Progress */}
      {isAnalyzing && (
        <View style={styles.scanningOverlay}>
          <BlurView
            intensity={60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          
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
            <Text style={[styles.scanTitle, { color: colors.text }]}>AI Analysis in Progress…</Text>
            <Text style={[styles.scanDesc, { color: colors.textSecondary }]}>
              Finding your best moments • {progress.current}/{progress.total}
            </Text>
            <Text style={[styles.smokeHint, { color: colors.primary }]}>Analysis continues even if you close this screen ✨</Text>
            
            <View style={[styles.progressBarFull, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.progressFill, {
                backgroundColor: colors.primary,
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '5%'
              }]} />
            </View>
          </View>
        </View>
      )}

      {/* Results */}
      {results && !isAnalyzing && (
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
                  { 
                    backgroundColor: activeTab === tab.key ? colors.primary : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
                    borderColor: activeTab === tab.key ? colors.primary : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                  }
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.key);
                }}
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
                  backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                }]}>
                  <Text style={[styles.tabCount, { color: activeTab === tab.key ? '#fff' : colors.textSecondary }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Photos Grid */}
          {fullMediaItems.length === 0 ? (
            <View style={styles.emptyResult}>
              <Ionicons name="image-outline" size={50} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No photos found in this category
              </Text>
            </View>
          ) : (
            <FlatList
              data={fullMediaItems}
              keyExtractor={item => item.id}
              numColumns={3}
              renderItem={renderPhoto}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Rescan Button */}
          <View style={styles.footer}>
            <TouchableOpacity
                style={[styles.rescanButton, { borderColor: colors.primary }]}
                onPress={startScan}
            >
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={[styles.rescanText, { color: colors.primary }]}>Rescan Photos</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    zIndex: 110,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backBtnGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerTextContainer: { flex: 1, alignItems: 'center' },
  headerRight: { width: 44 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  scanPromptContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  scanCard: {
    padding: 30,
    borderRadius: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  aiIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scanTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  scanDesc: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 20,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoText: { fontSize: 13, flex: 1, lineHeight: 20 },
  tabsScroll: { flexGrow: 0, marginTop: 10 },
  tabs: { paddingHorizontal: 20, gap: 10, paddingVertical: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabBadge: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabCount: { fontSize: 10, fontWeight: '700' },
  grid: { padding: 16, gap: 4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    margin: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: { width: '100%', height: '100%', borderRadius: 12 },
  emptyResult: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 100,
  },
  emptyText: { fontSize: 16, textAlign: 'center', opacity: 0.6 },
  footer: {
      paddingBottom: 20
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  rescanText: { fontSize: 15, fontWeight: '600' },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanPrompt: {
    width: '90%',
    padding: 30,
    alignItems: 'center',
    gap: 10,
    zIndex: 101,
  },
  smokeHint: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginTop: 15,
    fontStyle: 'italic',
    paddingHorizontal: 20,
    textAlign: 'center'
  },
  progressBarFull: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 25,
  },
  progressFill: { height: '100%', borderRadius: 6 },
  floatingPhoto: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  smokeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    zIndex: 100,
  },
  smokeImage: { width: '100%', height: '100%' },
});

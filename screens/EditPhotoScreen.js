import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import CropEditor from '../components/CropEditor';
import FilteredImage from '../components/FilteredImage';

const { width, height } = Dimensions.get('window');

// Slider Control Component - Modernized
function SliderControl({ icon, label, value, min, max, onValueChange, colors }) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderPress = (evt) => {
    const sliderWidth = width - 120; // Adjusted for new layout
    const x = evt.nativeEvent.locationX;
    const newValue = Math.max(min, Math.min(max, (x / sliderWidth) * (max - min) + min));
    onValueChange(newValue);
  };

  return (
    <View style={styles.adjustmentRow}>
      <View style={styles.adjustmentIconContainer}>
        <Ionicons name={icon} size={18} color={colors.icon} />
      </View>
      <View style={styles.sliderWrapper}>
        <TouchableOpacity
          style={styles.sliderContainer}
          activeOpacity={1}
          onPress={handleSliderPress}
        >
          <View style={[styles.slider, { backgroundColor: colors.searchBar }]}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: colors.icon,
                },
              ]}
            />
            <View
              style={[
                styles.sliderThumb,
                {
                  left: `${percentage}%`,
                  backgroundColor: colors.icon,
                },
              ]}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.adjustmentLabelRow}>
          <Text style={[styles.adjustmentLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.adjustmentValue, { color: colors.searchPlaceholder }]}>
            {Math.round(value * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function EditPhotoScreen({ route, navigation }) {
  const { item } = route?.params || {};
  const { colors } = useTheme();
  const { showAlert, showConfirm } = useDialog();
  const [editedUri, setEditedUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tools'); // 'tools', 'filters', 'adjust'
  const [activeAdjustment, setActiveAdjustment] = useState('brightness'); // 'brightness', 'contrast', 'saturation'
  const imageRef = useRef();

  // Lock orientation to portrait when editing
  useEffect(() => {
    const lockOrientation = async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
    lockOrientation();
    return () => {
      // Revert to allowing all orientations when leaving
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Initialize editedUri when component mounts
  useEffect(() => {
    try {
      if (item) {
        const uri = item.uri || item.filePath || item.localUri;
        if (uri) {
          setEditedUri(uri);
          setIsReady(true);
          setError(null);
        } else {
          setError('No image URI found');
          showAlert('Error', 'No image URI found', () => navigation?.goBack?.());
        }
      } else {
        setError('No image to edit');
        showAlert('Error', 'No image to edit', () => navigation?.goBack?.());
      }
    } catch (err) {
      console.error('Error initializing EditPhotoScreen:', err);
      setError(err.message || 'Failed to initialize editor');
      showAlert('Error', 'Failed to initialize editor', () => navigation?.goBack?.());
    }
  }, [item, navigation]);

  // Edit parameters
  const [saturation, setSaturation] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [filter, setFilter] = useState(null);

  const adjustments = [
    { id: 'brightness', label: 'Brightness', icon: 'sunny-outline', min: 0, max: 2 },
    { id: 'contrast', label: 'Contrast', icon: 'contrast-outline', min: 0, max: 2 },
    { id: 'saturation', label: 'Saturation', icon: 'color-palette-outline', min: 0, max: 2 },
  ];

  const filters = [
    { id: 'none', name: 'Original', icon: 'image-outline' },
    { id: 'vintage', name: 'Vintage', icon: 'camera-outline' },
    { id: 'blackwhite', name: 'B&W', icon: 'contrast-outline' },
    { id: 'sepia', name: 'Sepia', icon: 'color-palette-outline' },
    { id: 'cool', name: 'Cool', icon: 'snow-outline' },
    { id: 'warm', name: 'Warm', icon: 'sunny-outline' },
  ];

  // Crop State
  const [isCropping, setIsCropping] = useState(false);

  const handleCrop = () => setIsCropping(true);

  const handleRotate = async () => {
    try {
      const sourceUri = editedUri || item?.uri || item?.filePath;
      if (!sourceUri) return;

      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ rotate: 90 }],
        { compress: 0.9 }
      );
      setEditedUri(result.uri);
    } catch (error) {
      console.error('Error rotating photo:', error);
      showAlert('Error', 'Failed to rotate photo');
    }
  };

  const handleCropComplete = (result) => {
    setIsCropping(false);
    if (result?.success && result?.croppedAsset) {
      navigation.replace('Viewer', {
        item: result.croppedAsset,
        allItems: [result.croppedAsset],
        initialIndex: 0,
        refreshKey: Date.now(),
        originalAssetId: item?.id
      });
    }
  };

  const applyFilter = (filterId) => {
    if (filter === filterId) {
      setFilter(null); // Toggle off if already selected
    } else {
      setFilter(filterId);
    }
  };

  const applyAdjustments = async () => {
    // No-op: Visual updates are handled by FilteredImage props (brightness/contrast/saturation).
    // State updates (setBrightness etc.) trigger re-render automatically.
  };


  const savePhoto = async () => {
    try {
      if (!editedUri) return showAlert('Error', 'No image to save');
      setSaving(true);

      // Capture the rendered view (FilteredImage) which contains all edits (filters, brightness, etc.)
      // We must wait for a brief moment or ensure view is ready (it should be)

      const capturedUri = await captureRef(imageRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile'
      });

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return showAlert('Permission Required', 'Please grant media library access');

      const asset = await MediaLibrary.createAssetAsync(capturedUri);
      const fullAsset = await MediaLibrary.getAssetInfoAsync(asset.id);

      navigation.navigate('MainTabs', {
        screen: 'Photos',
        params: {
          croppedAsset: {
            ...fullAsset,
            uri: fullAsset.localUri || fullAsset.uri
          },
          originalAssetId: item?.id
        }
      });

      showAlert('Success', 'Photo updated successfully!');
    } catch (error) {
      console.error('Error saving photo:', error);
      showAlert('Error', `Failed to save photo: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isReady || !editedUri || error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top', 'bottom']}>
        <View style={styles.loader}>
          {error ? (
            <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" color="#fff" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tools':
        return (
          <View style={styles.tabContentContainer}>
            <TouchableOpacity style={styles.toolButtonCompact} onPress={handleCrop}>
              <View style={[styles.iconCircle, { backgroundColor: colors.searchBar }]}>
                <Ionicons name="crop-outline" size={24} color={colors.icon} />
              </View>
              <Text style={[styles.toolLabelCompact, { color: colors.text }]}>Crop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButtonCompact} onPress={handleRotate}>
              <View style={[styles.iconCircle, { backgroundColor: colors.searchBar }]}>
                <Ionicons name="refresh-outline" size={24} color={colors.icon} />
              </View>
              <Text style={[styles.toolLabelCompact, { color: colors.text }]}>Rotate</Text>
            </TouchableOpacity>
          </View>
        );
      case 'filters':
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
            {filters.map((f) => (
              <TouchableOpacity key={f.id} style={styles.filterButtonCompact} onPress={() => applyFilter(f.id)}>
                <View style={[styles.filterIconCircle, { backgroundColor: filter === f.id ? colors.icon : colors.searchBar }]}>
                  <Ionicons name={f.icon} size={24} color={filter === f.id ? '#fff' : colors.icon} />
                </View>
                <Text style={[styles.filterLabelCompact, { color: colors.text, opacity: filter === f.id ? 1 : 0.7 }]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      case 'adjust':
        const currentAdj = adjustments.find(a => a.id === activeAdjustment);
        const adjValue = activeAdjustment === 'brightness' ? brightness : activeAdjustment === 'contrast' ? contrast : saturation;
        const updateAdjValue = (val) => {
          if (activeAdjustment === 'brightness') setBrightness(val);
          else if (activeAdjustment === 'contrast') setContrast(val);
          else setSaturation(val);
          applyAdjustments();
        };

        return (
          <View style={styles.adjustContainer}>
            {/* Single Dynamic Slider */}
            <View style={styles.singleSliderArea}>
              <SliderControl
                icon={currentAdj.icon}
                label={currentAdj.label}
                value={adjValue}
                min={currentAdj.min}
                max={currentAdj.max}
                onValueChange={updateAdjValue}
                colors={colors}
              />
            </View>

            {/* Adjustment Type Selector */}
            <View style={styles.adjustmentSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adjustScrollContent}>
                {adjustments.map((adj) => (
                  <TouchableOpacity
                    key={adj.id}
                    style={styles.adjustTypeButton}
                    onPress={() => setActiveAdjustment(adj.id)}
                  >
                    <View style={[
                      styles.adjustIconCircle,
                      { backgroundColor: activeAdjustment === adj.id ? colors.icon : colors.searchBar }
                    ]}>
                      <Ionicons
                        name={adj.icon}
                        size={20}
                        color={activeAdjustment === adj.id ? '#fff' : colors.icon}
                      />
                    </View>
                    <Text style={[
                      styles.adjustTypeLabel,
                      { color: colors.text, opacity: activeAdjustment === adj.id ? 1 : 0.6 }
                    ]}>
                      {adj.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#fff' }]}>Edit</Text>
        <TouchableOpacity onPress={savePhoto} style={styles.headerButton} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={28} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Image Preview - Centered between header and bottom panel */}
      <View style={styles.imageContainer}>
        <FilteredImage
          ref={imageRef}
          uri={editedUri}
          width={width}
          height={height - 56 - 200 - 40} // Approximate available space: screen - header - panel - safeAreas
          filterType={filter}
          brightness={brightness}
          contrast={contrast}
          saturation={saturation}
        />
      </View>

      {/* Modern Bottom Editor Panel */}
      <View style={[styles.bottomPanel, { backgroundColor: colors.background }]}>
        {/* Top Section: Tab-specific content */}
        <View style={styles.panelContentArea}>
          {renderTabContent()}
        </View>

        {/* Bottom Section: Persistent tab switcher */}
        <View style={styles.tabSwitcher}>
          {['tools', 'filters', 'adjust'].map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
              <Text style={[
                styles.tabText,
                { color: activeTab === tab ? colors.icon : colors.text, opacity: activeTab === tab ? 1 : 0.6 }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {activeTab === tab && <View style={[styles.activeIndicator, { backgroundColor: colors.icon }]} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Crop Editor Modal */}
      {isCropping && (
        <CropEditor visible={isCropping} imageUri={editedUri} onClose={() => setIsCropping(false)} onComplete={handleCropComplete} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, height: 56 },
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  image: { width: '100%', height: '100%' },

  // Bottom Panel
  bottomPanel: { height: 200, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  panelContentArea: { flex: 1, justifyContent: 'center' },
  tabSwitcher: { flexDirection: 'row', height: 60, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  tabButton: { paddingHorizontal: 20, height: '100%', justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  activeIndicator: { position: 'absolute', bottom: 12, width: 4, height: 4, borderRadius: 2 },

  // Tab Content: Tools
  tabContentContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  toolButtonCompact: { alignItems: 'center', paddingHorizontal: 16 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  toolLabelCompact: { fontSize: 11, fontWeight: '500' },

  // Tab Content: Filters
  filtersScrollContent: { paddingHorizontal: 20, alignItems: 'center' },
  filterButtonCompact: { alignItems: 'center', marginRight: 16 },
  filterIconCircle: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  filterLabelCompact: { fontSize: 11, fontWeight: '500' },

  // Tab Content: Adjust
  adjustContainer: { flex: 1, justifyContent: 'space-between', paddingVertical: 10 },
  singleSliderArea: { paddingHorizontal: 20, justifyContent: 'center', flex: 1 },
  adjustmentSelector: { height: 74, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.03)' },
  adjustScrollContent: { paddingHorizontal: 20, alignItems: 'center' },
  adjustTypeButton: { alignItems: 'center', marginRight: 24 },
  adjustIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  adjustTypeLabel: { fontSize: 10, fontWeight: '600' },
  adjustmentRow: { flexDirection: 'row', alignItems: 'center' },
  adjustmentIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  sliderWrapper: { flex: 1, marginLeft: 12 },
  sliderContainer: { height: 32, justifyContent: 'center' },
  slider: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 1.5 },
  sliderThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, top: -5.5, borderWidth: 2, borderColor: '#fff' },
  adjustmentLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  adjustmentLabel: { fontSize: 12, fontWeight: '600' },
  adjustmentValue: { fontSize: 11, fontWeight: '700' },
});


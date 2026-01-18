import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CropEditor({ visible, imageUri, onClose, onComplete }) {
    const { colors } = useTheme();

    const [processing, setProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [previewUri, setPreviewUri] = useState(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [selectedRatio, setSelectedRatio] = useState(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Crop box position (0-1 normalized)
    const cropX = useSharedValue(0.1);
    const cropY = useSharedValue(0.1);
    const cropWidth = useSharedValue(0.8);
    const cropHeight = useSharedValue(0.8);

    // For gesture tracking
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const startWidth = useSharedValue(0);
    const startHeight = useSharedValue(0);

    // Load preview
    useEffect(() => {
        if (visible && imageUri) {
            console.log("CropEditor: Loading preview...");
            setLoading(true);

            ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 500 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
            )
                .then(result => {
                    console.log("CropEditor: Preview loaded");
                    setPreviewUri(result.uri);
                    setImageSize({ width: result.width, height: result.height });
                    setLoading(false);
                })
                .catch(err => {
                    console.error("CropEditor: Preview error:", err);
                    Alert.alert("Error", "Failed to load image");
                    setLoading(false);
                    onClose();
                });
        }
    }, [visible, imageUri]);

    const onContainerLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    // Apply aspect ratio
    const applyAspectRatio = (ratio) => {
        if (!ratio) {
            setSelectedRatio(null);
            return;
        }

        setSelectedRatio(ratio);

        const imageRatio = imageSize.width / imageSize.height;
        let newWidth = 0.8;
        let newHeight = 0.8;

        if (ratio > imageRatio) {
            newWidth = 0.8;
            newHeight = (0.8 * imageRatio) / ratio;
        } else {
            newHeight = 0.8;
            newWidth = (0.8 * ratio) / imageRatio;
        }

        cropWidth.value = withSpring(newWidth);
        cropHeight.value = withSpring(newHeight);
        cropX.value = withSpring((1 - newWidth) / 2);
        cropY.value = withSpring((1 - newHeight) / 2);
    };

    // Pan gesture for moving crop box
    const panGesture = Gesture.Pan()
        .onStart(() => {
            startX.value = cropX.value;
            startY.value = cropY.value;
        })
        .onUpdate((e) => {
            if (!containerSize.width) return;

            const dx = e.translationX / containerSize.width;
            const dy = e.translationY / containerSize.height;

            const maxX = 1 - cropWidth.value;
            const maxY = 1 - cropHeight.value;

            cropX.value = Math.max(0, Math.min(startX.value + dx, maxX));
            cropY.value = Math.max(0, Math.min(startY.value + dy, maxY));
        });

    // Create resize gesture for each corner
    const createResizeGesture = (corner) => Gesture.Pan()
        .onStart(() => {
            startX.value = cropX.value;
            startY.value = cropY.value;
            startWidth.value = cropWidth.value;
            startHeight.value = cropHeight.value;
        })
        .onUpdate((e) => {
            if (!containerSize.width) return;

            const dx = e.translationX / containerSize.width;
            const dy = e.translationY / containerSize.height;

            const minSize = 0.2;

            if (corner === 'tl') {
                const newX = Math.max(0, Math.min(startX.value + dx, startX.value + startWidth.value - minSize));
                const newY = Math.max(0, Math.min(startY.value + dy, startY.value + startHeight.value - minSize));
                const newW = startWidth.value - (newX - startX.value);
                const newH = startHeight.value - (newY - startY.value);

                cropX.value = newX;
                cropY.value = newY;
                cropWidth.value = Math.max(minSize, newW);
                cropHeight.value = Math.max(minSize, newH);
            } else if (corner === 'tr') {
                const newY = Math.max(0, Math.min(startY.value + dy, startY.value + startHeight.value - minSize));
                const newW = Math.max(minSize, Math.min(startWidth.value + dx, 1 - startX.value));
                const newH = startHeight.value - (newY - startY.value);

                cropY.value = newY;
                cropWidth.value = newW;
                cropHeight.value = Math.max(minSize, newH);
            } else if (corner === 'bl') {
                const newX = Math.max(0, Math.min(startX.value + dx, startX.value + startWidth.value - minSize));
                const newW = startWidth.value - (newX - startX.value);
                const newH = Math.max(minSize, Math.min(startHeight.value + dy, 1 - startY.value));

                cropX.value = newX;
                cropWidth.value = Math.max(minSize, newW);
                cropHeight.value = newH;
            } else if (corner === 'br') {
                const newW = Math.max(minSize, Math.min(startWidth.value + dx, 1 - startX.value));
                const newH = Math.max(minSize, Math.min(startHeight.value + dy, 1 - startY.value));

                cropWidth.value = newW;
                cropHeight.value = newH;
            }
        });

    const tlGesture = createResizeGesture('tl');
    const trGesture = createResizeGesture('tr');
    const blGesture = createResizeGesture('bl');
    const brGesture = createResizeGesture('br');

    // Animated crop box style
    const animatedCropStyle = useAnimatedStyle(() => {
        if (!containerSize.width) return {};

        return {
            position: 'absolute',
            left: cropX.value * containerSize.width,
            top: cropY.value * containerSize.height,
            width: cropWidth.value * containerSize.width,
            height: cropHeight.value * containerSize.height,
            borderWidth: 3,
            borderColor: '#fff',
            backgroundColor: 'rgba(0,0,0,0.3)',
        };
    });

    // Save cropped image
    const handleDone = async () => {
        console.log("===================================");
        console.log("CROP SAVE: Button clicked!");
        console.log("===================================");
        setProcessing(true);

        try {
            console.log("CROP SAVE: Requesting permissions...");
            // Check permissions first
            const { status } = await MediaLibrary.requestPermissionsAsync();
            console.log("CROP SAVE: Permission status =", status);
            if (status !== 'granted') {
                Alert.alert("Permission Required", "Please grant media library access");
                setProcessing(false);
                return;
            }

            const SAFE_MAX = 1800;
            const targetW = SAFE_MAX;
            const targetH = Math.round((imageSize.height / imageSize.width) * SAFE_MAX);

            const x = cropX.value;
            const y = cropY.value;
            const w = cropWidth.value;
            const h = cropHeight.value;

            const originX = Math.max(0, Math.round(x * targetW));
            const originY = Math.max(0, Math.round(y * targetH));
            const width = Math.max(50, Math.round(w * targetW));
            const height = Math.max(50, Math.round(h * targetH));

            console.log("CROP: Coordinates:", { originX, originY, width, height });

            // Crop the image
            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    { resize: { width: SAFE_MAX } },
                    { crop: { originX, originY, width, height } }
                ],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );

            console.log("CROP: Step 4 - Manipulation complete!");
            console.log("CROP: Temp file URI:", result.uri);
            console.log("CROP: Result dimensions:", result.width, "x", result.height);

            console.log("CROP: Step 5 - Saving to MediaLibrary...");

            // CRITICAL: Save the cropped image to device storage
            const savedAsset = await MediaLibrary.createAssetAsync(result.uri);

            // VERIFY save succeeded
            if (!savedAsset || !savedAsset.id) {
                throw new Error('Cropped image not saved - no asset returned');
            }

            console.log("===================================");
            console.log("CROP: SAVED TO GALLERY!");
            console.log("Asset ID:", savedAsset.id);
            console.log("Asset URI:", savedAsset.uri);
            console.log("Asset filename:", savedAsset.filename);
            console.log("Asset creation time:", savedAsset.creationTime);
            console.log("Asset dimensions:", savedAsset.width, "x", savedAsset.height);
            console.log("===================================");

            // Get full asset info to verify accessibility
            const assetInfo = await MediaLibrary.getAssetInfoAsync(savedAsset.id);
            console.log("CROP: Asset verified!");
            console.log("Local URI:", assetInfo.localUri);
            console.log("URI:", assetInfo.uri);
            console.log("Media Type:", assetInfo.mediaType);

            // Close editor and pass cropped asset immediately (no Alert)
            console.log("CROP: Closing editor...");
            console.log("CROP: Passing cropped asset info...");
            console.log("Using localUri:", assetInfo.localUri);

            onClose();

            // Pass the saved asset with CORRECT URI (localUri points to cropped file)
            onComplete({
                success: true,
                croppedAsset: {
                    ...savedAsset,
                    uri: assetInfo.localUri || assetInfo.uri, // Use localUri for cropped image
                    localUri: assetInfo.localUri,
                    mediaType: 'photo',
                    width: assetInfo.width,
                    height: assetInfo.height
                },
                refresh: true
            });

        } catch (error) {
            console.error("CROP: Failed:", error);
            Alert.alert("Error", "Failed to crop image: " + error.message);
            setProcessing(false);
        }
    };

    if (!visible) return null;

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.itemBackground }]}>
                    <TouchableOpacity onPress={onClose} disabled={processing}>
                        <Ionicons name="close" size={28} color={colors.icon} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Crop</Text>
                    <TouchableOpacity onPress={handleDone} disabled={processing || loading}>
                        {processing ? (
                            <ActivityIndicator color={colors.icon} />
                        ) : (
                            <Ionicons name="checkmark" size={28} color={colors.icon} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Preview */}
                <View style={styles.preview}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.icon} />
                    ) : previewUri ? (
                        <View style={styles.imageWrapper} onLayout={onContainerLayout}>
                            <Image
                                source={{ uri: previewUri }}
                                style={styles.image}
                                contentFit="contain"
                            />

                            {containerSize.width > 0 && (
                                <GestureDetector gesture={panGesture}>
                                    <Animated.View style={animatedCropStyle}>
                                        <View style={styles.gridV1} />
                                        <View style={styles.gridV2} />
                                        <View style={styles.gridH1} />
                                        <View style={styles.gridH2} />

                                        <GestureDetector gesture={tlGesture}>
                                            <Animated.View style={[styles.handle, styles.tl]} />
                                        </GestureDetector>
                                        <GestureDetector gesture={trGesture}>
                                            <Animated.View style={[styles.handle, styles.tr]} />
                                        </GestureDetector>
                                        <GestureDetector gesture={blGesture}>
                                            <Animated.View style={[styles.handle, styles.bl]} />
                                        </GestureDetector>
                                        <GestureDetector gesture={brGesture}>
                                            <Animated.View style={[styles.handle, styles.br]} />
                                        </GestureDetector>
                                    </Animated.View>
                                </GestureDetector>
                            )}
                        </View>
                    ) : null}
                </View>

                {/* Controls */}
                <View style={[styles.controls, { backgroundColor: colors.itemBackground }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Quick Ratios</Text>

                    <View style={styles.ratioButtons}>
                        <TouchableOpacity
                            style={[styles.ratioBtn, {
                                backgroundColor: selectedRatio === null ? colors.icon : colors.searchBar
                            }]}
                            onPress={() => applyAspectRatio(null)}
                        >
                            <Text style={[styles.ratioText, {
                                color: selectedRatio === null ? '#fff' : colors.text
                            }]}>Reset</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.ratioBtn, {
                                backgroundColor: selectedRatio === 1 ? colors.icon : colors.searchBar
                            }]}
                            onPress={() => applyAspectRatio(1)}
                        >
                            <Text style={[styles.ratioText, {
                                color: selectedRatio === 1 ? '#fff' : colors.text
                            }]}>1:1</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.ratioBtn, {
                                backgroundColor: selectedRatio === 4 / 3 ? colors.icon : colors.searchBar
                            }]}
                            onPress={() => applyAspectRatio(4 / 3)}
                        >
                            <Text style={[styles.ratioText, {
                                color: selectedRatio === 4 / 3 ? '#fff' : colors.text
                            }]}>4:3</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.ratioBtn, {
                                backgroundColor: selectedRatio === 16 / 9 ? colors.icon : colors.searchBar
                            }]}
                            onPress={() => applyAspectRatio(16 / 9)}
                        >
                            <Text style={[styles.ratioText, {
                                color: selectedRatio === 16 / 9 ? '#fff' : colors.text
                            }]}>16:9</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.hint, { color: colors.searchPlaceholder }]}>
                        👆 Drag box to move • Drag corners to resize
                    </Text>
                </View>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 9999,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 50,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    preview: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    imageWrapper: {
        width: SCREEN_WIDTH - 40,
        height: SCREEN_HEIGHT * 0.55,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gridV1: {
        position: 'absolute',
        left: '33.33%',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    gridV2: {
        position: 'absolute',
        left: '66.66%',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    gridH1: {
        position: 'absolute',
        top: '33.33%',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    gridH2: {
        position: 'absolute',
        top: '66.66%',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    handle: {
        position: 'absolute',
        width: 30,
        height: 30,
        backgroundColor: '#fff',
        borderRadius: 15,
        borderWidth: 3,
        borderColor: '#007AFF',
    },
    tl: { top: -15, left: -15 },
    tr: { top: -15, right: -15 },
    bl: { bottom: -15, left: -15 },
    br: { bottom: -15, right: -15 },
    controls: {
        padding: 20,
        paddingBottom: 40,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    ratioButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    ratioBtn: {
        flex: 1,
        paddingVertical: 10,
        marginHorizontal: 3,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratioText: {
        fontSize: 12,
        fontWeight: '600',
    },
    hint: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
});

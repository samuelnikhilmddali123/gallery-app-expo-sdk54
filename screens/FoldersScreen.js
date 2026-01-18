import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../contexts/ThemeContext';
import { getFolders, createFolder, renameFolder, deleteFolder, updateFolderCover } from '../services/folderService';
import { useDialog } from '../contexts/DialogContext';

const getScreenDimensions = () => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
};

const COLUMN_COUNT = 2;
const GAP = 12;
const getItemSize = (screenWidth) => (screenWidth - (GAP * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

const FolderItem = React.memo(({ item, onPress, onLongPress, colors, isDarkMode, size }) => {
    const [thumbnailUri, setThumbnailUri] = useState(item.coverUri);

    useEffect(() => {
        let isMounted = true;

        const loadThumbnail = async () => {
            if (item.coverUri) {
                if (isMounted) setThumbnailUri(item.coverUri);
                return;
            }

            if (item.mediaIds && item.mediaIds.length > 0) {
                try {
                    // Fetch the first media item as thumbnail logic
                    // User requested "oldest or first-created". 
                    // Since mediaIds are typically appended, index 0 is likely oldest added.
                    // For true "oldest creation time", we'd need to fetch them all, which is too heavy for list items.
                    // Accessing the first one is O(1) and consistent.
                    const firstId = item.mediaIds[0];
                    const asset = await MediaLibrary.getAssetInfoAsync(firstId);

                    if (isMounted && asset) {
                        setThumbnailUri(asset.localUri || asset.uri);
                    }
                } catch (error) {
                    // Fail silently, placeholder will show
                    console.debug('Failed to load thumbnail for folder', item.id);
                }
            } else {
                if (isMounted) setThumbnailUri(null);
            }
        };

        loadThumbnail();

        return () => {
            isMounted = false;
        };
    }, [item.coverUri, item.mediaIds]);

    return (
        <TouchableOpacity
            style={[
                styles.folderItem,
                {
                    width: size,
                    backgroundColor: colors.cardBackground,
                    shadowOpacity: isDarkMode ? 0.3 : 0.05,
                    elevation: isDarkMode ? 4 : 2,
                }
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={500}
            activeOpacity={0.7}
        >
            <View style={styles.imageContainer}>
                {thumbnailUri ? (
                    <Image
                        source={{ uri: thumbnailUri }}
                        style={styles.folderImage}
                        contentFit="cover"
                        transition={200}
                        preferHighDynamicRange
                    />
                ) : (
                    <View style={[styles.placeholderImage, { backgroundColor: colors.searchBar }]}>
                        <Ionicons name="folder-open-outline" size={40} color={colors.searchPlaceholder} />
                    </View>
                )}
            </View>
            <View style={styles.folderInfo}>
                <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={[styles.folderCount, { color: colors.searchPlaceholder }]}>
                    {item.mediaIds ? item.mediaIds.length : 0} items
                </Text>
            </View>
        </TouchableOpacity>
    );
});

export default function FoldersScreen({ navigation }) {
    const { colors, isDarkMode } = useTheme();
    const { showDialog, hideDialog, showAlert, showConfirm } = useDialog();

    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderCover, setNewFolderCover] = useState(null);

    // Rename State
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [folderToRename, setFolderToRename] = useState(null);
    const [renameText, setRenameText] = useState('');

    // Smooth rotation support
    const [dimensions, setDimensions] = useState(getScreenDimensions());

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions({ width: window.width, height: window.height });
        });
        return () => subscription?.remove();
    }, []);

    const loadFolders = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getFolders();
            setFolders(data);
        } catch (error) {
            console.error('Failed to load folders', error);
            showAlert('Error', 'Failed to load folders');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadFolders();
        });
        return unsubscribe;
    }, [navigation, loadFolders]);

    const handlePickCover = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled) {
                setNewFolderCover(result.assets[0].uri);
            }
        } catch (error) {
            showAlert('Error', 'Failed to pick image');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            showAlert('Required', 'Please enter a folder name');
            return;
        }

        try {
            await createFolder(newFolderName.trim(), newFolderCover);
            setCreateModalVisible(false);
            setNewFolderName('');
            setNewFolderCover(null);
            loadFolders();
        } catch (error) {
            showAlert('Error', 'Failed to create folder');
        }
    };

    const handleRenameFolder = async () => {
        if (!renameText.trim()) {
            showAlert('Required', 'Please enter a folder name');
            return;
        }

        try {
            if (folderToRename) {
                await renameFolder(folderToRename.id, renameText.trim());
                setRenameModalVisible(false);
                setFolderToRename(null);
                setRenameText('');
                loadFolders();
            }
        } catch (error) {
            showAlert('Error', 'Failed to rename folder');
        }
    };

    const handleChangeCover = async (folder) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled) {
                await updateFolderCover(folder.id, result.assets[0].uri);
                loadFolders(); // Reload to show new cover
            }
        } catch (error) {
            showAlert('Error', 'Failed to update cover image');
        }
    };

    const handleDeleteFolder = (folder) => {
        showConfirm(
            'Delete Folder',
            `Are you sure you want to delete "${folder.name}"? This will not delete the photos inside, only the folder.`,
            async () => {
                try {
                    await deleteFolder(folder.id);
                    loadFolders();
                } catch (error) {
                    showAlert('Error', 'Failed to delete folder');
                }
            },
            null,
            true // Destructive
        );
    };

    const handleLongPress = useCallback((folder) => {
        showDialog({
            title: folder.name,
            message: 'Select an action',
            actions: [
                {
                    text: 'Rename',
                    onPress: () => {
                        hideDialog();
                        // Small timeout to allow dialog to close smoothly
                        setTimeout(() => {
                            setFolderToRename(folder);
                            setRenameText(folder.name);
                            setRenameModalVisible(true);
                        }, 100);
                    }
                },
                {
                    text: 'Change Cover',
                    onPress: () => {
                        hideDialog();
                        handleChangeCover(folder);
                    }
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        hideDialog();
                        // Small timeout
                        setTimeout(() => handleDeleteFolder(folder), 100);
                    }
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: hideDialog
                }
            ]
        });
    }, [showDialog, hideDialog, handleChangeCover]);

    const renderFolderItem = useCallback(({ item }) => (
        <FolderItem
            item={item}
            onPress={() => navigation.navigate('FolderDetail', { folderId: item.id, folderName: item.name })}
            onLongPress={() => handleLongPress(item)}
            colors={colors}
            isDarkMode={isDarkMode}
            size={getItemSize(dimensions.width)}
        />
    ), [navigation, colors, handleLongPress, isDarkMode, dimensions.width]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Folders</Text>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]} // Assuming primary color exists or use generic
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <Ionicons name="add" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                ) : (
                    <FlatList
                        data={folders}
                        renderItem={renderFolderItem}
                        keyExtractor={item => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={styles.list}
                        columnWrapperStyle={styles.columnWrapper}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="folder-outline" size={64} color={colors.searchPlaceholder} />
                                <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
                                    No folders yet. Create one!
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Create Folder Modal */}
                <Modal
                    visible={createModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCreateModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalOverlay}
                    >
                        <View style={[styles.modalContent, { backgroundColor: colors.itemBackground }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>New Folder</Text>

                            <TouchableOpacity onPress={handlePickCover} style={styles.coverPicker}>
                                {newFolderCover ? (
                                    <Image source={{ uri: newFolderCover }} style={styles.coverPreview} />
                                ) : (
                                    <View style={[styles.coverPlaceholder, { backgroundColor: colors.searchBar }]}>
                                        <Ionicons name="image-outline" size={32} color={colors.searchPlaceholder} />
                                        <Text style={[styles.coverText, { color: colors.searchPlaceholder }]}>Add Cover</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TextInput
                                style={[styles.input, { color: colors.text, backgroundColor: colors.searchBar }]}
                                placeholder="Folder Name"
                                placeholderTextColor={colors.searchPlaceholder}
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                                autoFocus
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalButton}
                                    onPress={() => setCreateModalVisible(false)}
                                >
                                    <Text style={[styles.modalButtonText, { color: colors.searchPlaceholder }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.createButton]}
                                    onPress={handleCreateFolder}
                                >
                                    <Text style={styles.createButtonText}>Create</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* Rename Folder Modal */}
                <Modal
                    visible={renameModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setRenameModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalOverlay}
                    >
                        <View style={[styles.modalContent, { backgroundColor: colors.itemBackground }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename Folder</Text>

                            <TextInput
                                style={[styles.input, { color: colors.text, backgroundColor: colors.searchBar }]}
                                placeholder="Folder Name"
                                placeholderTextColor={colors.searchPlaceholder}
                                value={renameText}
                                onChangeText={setRenameText}
                                autoFocus
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalButton}
                                    onPress={() => setRenameModalVisible(false)}
                                >
                                    <Text style={[styles.modalButtonText, { color: colors.searchPlaceholder }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.createButton]}
                                    onPress={handleRenameFolder}
                                >
                                    <Text style={styles.createButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
                {/* Floating Action Button */}
                <TouchableOpacity
                    style={[
                        styles.fab,
                        {
                            backgroundColor: colors.fabColor,
                            shadowOpacity: isDarkMode ? 0.25 : 0.1,
                            shadowRadius: isDarkMode ? 3.84 : 2,
                        }
                    ]}
                    onPress={() => setCreateModalVisible(true)}
                    activeOpacity={0.8}
                >
                </TouchableOpacity>

            </SafeAreaView>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#007AFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        padding: GAP,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    folderItem: {
        marginBottom: GAP,
        borderRadius: 12,
        overflow: 'hidden',
        // Base shadow styles - overridden by inline styles
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
    },
    folderImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderInfo: {
        padding: 12,
    },
    folderName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    folderCount: {
        fontSize: 12,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 20,
    },
    coverPicker: {
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    coverPreview: {
        width: 120,
        height: 120,
        borderRadius: 12,
    },
    coverPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coverText: {
        marginTop: 8,
        fontSize: 12,
    },
    input: {
        width: '100%',
        padding: 12,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    createButton: {
        backgroundColor: '#007AFF',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

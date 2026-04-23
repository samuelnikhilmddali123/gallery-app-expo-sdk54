import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import { getFolderMedia, addMediaToFolder, deleteFolder, removeMediaFromFolder } from '../services/folderService';
import { moveMediaToAppTrash } from '../services/trashService';
import * as MediaLibrary from 'expo-media-library';

const getScreenDimensions = () => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
};

const COLUMN_COUNT = 3;
const GAP = 2;
const getItemSize = (screenWidth) => (screenWidth - (GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export default function FolderDetailScreen({ navigation, route }) {
    const { folderId, folderName } = route.params;
    const { colors } = useTheme();
    const { showConfirm, showCustomConfirm, showAlert } = useDialog();
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [dimensions, setDimensions] = useState(getScreenDimensions());

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions({ width: window.width, height: window.height });
        });
        return () => subscription?.remove();
    }, []);

    const loadMedia = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getFolderMedia(folderId);
            setMedia(data);
        } catch (error) {
            console.error('Failed to load folder media', error);
            showAlert('Error', 'Failed to load photos', null, 'error');
        } finally {

            setLoading(false);
        }
    }, [folderId]);


    useEffect(() => {
        loadMedia();
    }, [loadMedia]);

    const handleAddPhotos = () => {
        // Navigate to Photos tab with selection mode parameters
        navigation.navigate('MainTabs', {
            screen: 'Photos',
            params: {
                selectionPurpose: 'folderAdd',
                targetFolderId: folderId,
                targetFolderName: folderName
            }
        });
    };

    const deleteThisFolder = () => {
        showConfirm(
            'Delete Folder',
            'Are you sure you want to delete this folder? Photos will not be deleted from your device.',
            async () => {
                try {
                    await deleteFolder(folderId);
                    navigation.goBack();
                    showAlert('Success', 'Folder deleted', null, 'success');
                } catch (e) {
                    showAlert('Error', 'Failed to delete folder', null, 'error');
                }
            },
            null,
            true,
            'warning'
        );
    };


    const handleRemoveSelected = async () => {
        const itemsToRemove = Array.from(selectedItems);
        if (itemsToRemove.length === 0) return;

        showCustomConfirm(
            `Actions for ${itemsToRemove.length} items`,
            "Choose how you want to proceed.",
            [
                {
                    text: 'Remove from Folder',
                    style: 'default',
                    onPress: async () => {
                        try {
                            await removeMediaFromFolder(folderId, itemsToRemove);
                            setSelectedItems(new Set());
                            setIsSelectionMode(false);
                            loadMedia();
                            showAlert('Success', 'Removed from folder', null, 'success');
                        } catch (e) {
                            showAlert('Error', 'Failed to remove items');
                        }
                    }
                },
                {
                    text: 'Trash',
                    style: 'default',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const selectedMedia = media.filter(m => itemsToRemove.includes(m.id));
                            
                            // 1. Move to app trash (copy + backup)
                            for (const item of selectedMedia) {
                                try {
                                    await moveMediaToAppTrash(item);
                                } catch (e) {
                                    console.error('FolderDetail: Trash copy failed', e);
                                }
                            }

                            const mediaLibraryIds = selectedMedia
                                .filter(item => item.id && !item.id.toString().startsWith('vault_') && !item.id.toString().startsWith('picked_'))
                                .map(item => item.id.toString());

                            if (mediaLibraryIds.length > 0) {
                                const { status } = await MediaLibrary.requestPermissionsAsync();
                                if (status === 'granted') {
                                    // 2. Trigger native delete
                                    await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                                }
                            }
                            
                            // 3. Remove from folder records
                            await removeMediaFromFolder(folderId, itemsToRemove);
                            
                            setSelectedItems(new Set());
                            setIsSelectionMode(false);
                            loadMedia();
                            showAlert('Success', 'Items moved to trash', null, 'success');
                        } catch (e) {
                            showAlert('Error', 'Failed to move to trash');
                        } finally {
                            setLoading(false);
                        }
                    }
                },
                {
                    text: 'Permanently delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const selectedMedia = media.filter(m => itemsToRemove.includes(m.id));
                            const mediaLibraryIds = selectedMedia
                                .filter(item => item.id && !item.id.toString().startsWith('vault_') && !item.id.toString().startsWith('picked_'))
                                .map(item => item.id.toString());

                            if (mediaLibraryIds.length > 0) {
                                const { status } = await MediaLibrary.requestPermissionsAsync();
                                if (status === 'granted') {
                                    const success = await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
                                    if (success) {
                                        await removeMediaFromFolder(folderId, itemsToRemove);
                                    }
                                }
                            } else {
                                await removeMediaFromFolder(folderId, itemsToRemove);
                            }

                            setSelectedItems(new Set());
                            setIsSelectionMode(false);
                            loadMedia();
                        } catch (e) {
                            showAlert('Error', 'Failed to delete items');
                        } finally {
                            setLoading(false);
                        }
                    }
                },
                {
                    text: 'Cancel',
                    style: 'cancel'
                }
            ]
        );
    };

    const renderItem = ({ item }) => {

        const isSelected = selectedItems.has(item.id);
        const itemSize = getItemSize(dimensions.width);

        return (
            <TouchableOpacity
                style={[
                    styles.item,
                    {
                        backgroundColor: colors.cardBackground,
                        width: itemSize,
                        height: itemSize,
                    }
                ]}
                onPress={() => {
                    if (isSelectionMode) {
                        setSelectedItems(prev => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                        });
                    } else {
                        // Navigate to viewer with this context?
                        // For simplicity, navigating to general Viewer might need context adjustment
                        // Or just use ViewerScreen with passed full list.
                        // Assuming ViewerScreen can take `allItems`
                        navigation.navigate('Viewer', {
                            item: item,
                            allItems: media,
                            initialIndex: media.indexOf(item)
                        });
                    }
                }}
                onLongPress={() => {
                    setIsSelectionMode(true);
                    setSelectedItems(new Set([item.id]));
                }}
                activeOpacity={0.8}
            >
                <Image
                    source={{ uri: item.uri }}
                    style={styles.image}
                    contentFit="cover"
                    transition={100}
                />
                {isSelected && (
                    <View style={styles.selectionOverlay}>
                        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                            {folderName}
                        </Text>
                    </View>

                    <View style={styles.headerActions}>
                        {isSelectionMode ? (
                            <TouchableOpacity onPress={handleRemoveSelected}>
                                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        ) : (
                            <>

                                <TouchableOpacity onPress={deleteThisFolder} style={styles.actionButton}>
                                    <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                ) : (
                    <FlatList
                        data={media}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="images-outline" size={64} color={colors.searchPlaceholder} />
                                <Text style={[styles.emptyText, { color: colors.searchPlaceholder }]}>
                                    Empty folder
                                </Text>
                            </View>
                        }
                    />
                )}
                {!isSelectionMode && (
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: '#007AFF' }]}
                        onPress={handleAddPhotos}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={32} color="#FFF" />
                    </TouchableOpacity>
                )}
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        paddingRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
    },
    list: {
        padding: 0,
    },
    item: {
        marginRight: GAP,
        marginBottom: GAP,
        backgroundColor: '#eee',
    },
    image: {
        width: '100%',
        height: '100%',
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
    selectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    }
});

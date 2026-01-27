import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Modal,
    ScrollView,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom Progress Bar Component
function ProgressBar({ currentTime, duration, onSeek, onIsInteracting }) {
    const [seeking, setSeeking] = useState(false);
    const layoutWidth = useRef(0);

    const handleTouch = (evt) => {
        if (layoutWidth.current > 0 && duration > 0) {
            const { locationX } = evt.nativeEvent;
            const percentage = Math.max(0, Math.min(1, locationX / layoutWidth.current));
            onSeek(percentage * duration);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            // Use Capture phase to grab the touch before any overlay or parent can
            onStartShouldSetPanResponderCapture: () => true,
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                setSeeking(true);
                onIsInteracting?.(true);
                handleTouch(evt); // Immediate seek on tap
            },
            onPanResponderMove: (evt) => {
                handleTouch(evt);
            },
            onPanResponderRelease: () => {
                setSeeking(false);
                onIsInteracting?.(false);
            },
            onPanResponderTerminate: () => {
                setSeeking(false);
                onIsInteracting?.(false);
            },
            onPanResponderTerminationRequest: () => false, // Don't let other gestures take over
        })
    ).current;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <View
            style={styles.progressBarContainer}
            onLayout={(e) => {
                layoutWidth.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
        >
            <View style={styles.progressBarBackground} pointerEvents="none">
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <View style={[styles.progressThumb, { left: `${progress}%` }]} pointerEvents="none" />
        </View>
    );
}

export default function CustomVideoControls({
    player,
    visible,
    onToggleControls,
    onRequestFullscreen,
    onIsInteracting
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioTracks, setAudioTracks] = useState([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
    const [showAudioMenu, setShowAudioMenu] = useState(false);

    // Listen to player state changes
    useEffect(() => {
        if (!player) return;

        const playingSubscription = player.addListener('playingChange', (newIsPlaying) => {
            setIsPlaying(newIsPlaying);
        });

        const playbackSubscription = player.addListener('playbackStateChange', (e) => {
            if (e.playbackState === 'finished') {
                setIsPlaying(false);
            }
        });

        const timeSubscription = player.addListener('timeUpdate', (newTime) => {
            setCurrentTime(newTime.currentTime);
            setDuration(newTime.duration || 0);
        });

        return () => {
            playingSubscription?.remove();
            playbackSubscription?.remove();
            timeSubscription?.remove();
        };
    }, [player]);

    // Get audio tracks
    useEffect(() => {
        if (!player) return;

        try {
            // Get available audio tracks from player
            const tracks = player.availableAudioMixingModes || [];
            setAudioTracks(tracks);

            // Get current track
            const current = player.currentAudioMixingMode;
            setCurrentAudioTrack(current);
        } catch (error) {
            console.log('Audio tracks not available:', error);
        }
    }, [player]);

    const handlePlayPause = useCallback(() => {
        if (!player || player.status !== 'readyToPlay') return;

        try {
            const isFinished = player.playbackState === 'finished';

            if (isFinished) {
                player.currentTime = 0;
                player.play();
            } else {
                if (isPlaying) {
                    player.pause();
                } else {
                    player.play();
                }
            }
        } catch (error) {
            console.log('Failed to toggle play/pause:', error);
        }
    }, [player, isPlaying]);

    const handleSeek = useCallback((value) => {
        if (!player || player.status !== 'readyToPlay') return;
        try {
            player.currentTime = value;
        } catch (error) {
            console.log('Failed to seek:', error);
        }
    }, [player]);

    const handleAudioTrackSelect = useCallback((track) => {
        if (!player) return;

        try {
            player.currentAudioMixingMode = track;
            setCurrentAudioTrack(track);
            setShowAudioMenu(false);
        } catch (error) {
            console.log('Failed to change audio track:', error);
        }
    }, [player]);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!visible) return null;

    return (
        <View
            style={styles.container}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
        >
            {/* Top Controls */}
            <View style={styles.topControls}>
                <TouchableOpacity
                    onPress={onRequestFullscreen}
                    style={styles.controlButton}
                >
                    <Ionicons name="expand" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Center Play/Pause */}
            <View style={styles.centerControls}>
                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={styles.playPauseButton}
                >
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={48}
                        color="#fff"
                    />
                </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                    <ProgressBar
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={handleSeek}
                        onIsInteracting={onIsInteracting}
                    />
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                {/* Control Buttons */}
                <View style={styles.controlsRow}>
                    {/* Audio/Language Button */}
                    {audioTracks.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setShowAudioMenu(true)}
                            style={styles.controlButton}
                        >
                            <Ionicons name="language" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Audio Track Selection Modal */}
            <Modal
                visible={showAudioMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAudioMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAudioMenu(false)}
                >
                    <View
                        style={styles.audioMenu}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={styles.menuTitle}>Audio Track</Text>
                        <ScrollView>
                            {audioTracks.map((track, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        currentAudioTrack === track && styles.menuItemSelected
                                    ]}
                                    onPress={() => handleAudioTrackSelect(track)}
                                >
                                    <Text style={styles.menuItemText}>{track}</Text>
                                    {currentAudioTrack === track && (
                                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'space-between',
    },
    topControls: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
    },
    centerControls: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playPauseButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomControls: {
        padding: 16,
        paddingBottom: 32,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    progressBarContainer: {
        flex: 1,
        height: 60,
        justifyContent: 'center',
        marginHorizontal: 8,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
    progressThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#007AFF',
        marginLeft: -6,
        top: '50%',
        marginTop: -6,
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
        minWidth: 40,
        textAlign: 'center',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    controlButton: {
        padding: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioMenu: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: SCREEN_WIDTH * 0.8,
        maxHeight: 400,
        overflow: 'hidden',
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuItemSelected: {
        backgroundColor: '#f0f8ff',
    },
    menuItemText: {
        fontSize: 16,
    },
});

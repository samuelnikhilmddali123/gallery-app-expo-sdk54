import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions, FlatList, Alert, AppState, TouchableOpacity as RNTouchableOpacity, TouchableOpacity, PanResponder, Modal, ScrollView, NativeModules } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video'; // NEW: Import from expo-video
import { TouchableOpacity as GHTouchableOpacity, Gesture, GestureDetector } from 'react-native-gesture-handler'; // Better touch handling with gestures
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av'; // Keep Audio for focus management if needed
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import ZoomableImage from '../components/ZoomableImage';
import { useDialog } from '../contexts/DialogContext';
import { moveToSystemTrash } from '../services/mediaService';
import * as ScreenOrientation from 'expo-screen-orientation';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

// Get initial dimensions
const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

// Helper to check if item is video
const isVideoItem = (mediaItem) => {
  return mediaItem?.mediaType === 'video' ||
    mediaItem?.mediaType === MediaLibrary.MediaType.video ||
    (mediaItem?.duration && mediaItem.duration > 0);
};

// Helper for language names
const getLanguageName = (code) => {
  if (!code) return 'Default';
  const languageMap = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'bn': 'Bengali',
    'te': 'Telugu',
    'mr': 'Marathi',
    'ta': 'Tamil',
    'ur': 'Urdu',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'ar': 'Arabic',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'pl': 'Polish',
    'uk': 'Ukrainian',
    'id': 'Indonesian',
    'ms': 'Malay',
    'th': 'Thai',
  };

  // Clean up code (sometimes it might be en-US or en_US)
  const baseCode = code.split(/[-_]/)[0].toLowerCase();
  return languageMap[baseCode] || code.toUpperCase();
};

// --- Video Content Component ---
// Separated to allow cleaner use of hooks
// --- Custom Video Controls ---
// --- ProgressBar Component ---
const ProgressBar = ({ progress, onSeek, duration, onIsInteracting }) => {
  const layoutWidth = useRef(0);

  const handleTouch = (evt) => {
    if (layoutWidth.current > 0 && duration > 0) {
      const { locationX } = evt.nativeEvent;
      const percent = Math.max(0, Math.min(1, locationX / layoutWidth.current));
      onSeek(percent * duration);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onIsInteracting?.(true);
        handleTouch(evt);
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt);
      },
      onPanResponderRelease: () => {
        onIsInteracting?.(false);
      },
      onPanResponderTerminate: () => {
        onIsInteracting?.(false);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View
      style={controlStyles.progressBarContainer}
      onLayout={(e) => {
        layoutWidth.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: '100%', justifyContent: 'center', width: '100%' }} pointerEvents="none">
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
          <View style={[controlStyles.progressBarFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
        </View>
      </View>
    </View>
  );
};

const CustomVideoControls = ({
  player,
  isPlaying,
  onPlayPause,
  duration,
  currentTime,
  onToggleFullscreen,
  visible,
  onSeek,
  isLandscape,
  onIsInteracting
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(1.0);

  useEffect(() => {
    if (!player) return;

    // Initial sync
    setCurrentPlaybackRate(player.playbackRate || 1.0);
    setAvailableAudioTracks(player.availableAudioTracks || []);
    setCurrentAudioTrack(player.audioTrack);

    // Listen for changes
    const rateSub = player.addListener('playbackRateChange', (e) => {
      setCurrentPlaybackRate(e.playbackRate);
    });

    return () => {
      rateSub.remove();
    };
  }, [player]);

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds && timeInSeconds !== 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handleSpeedSelect = (rate) => {
    if (player) {
      player.playbackRate = rate;
      setCurrentPlaybackRate(rate);
    }
    setShowSpeedMenu(false);
    setShowSettings(false);
  };

  const handleAudioSelect = (track) => {
    if (player) {
      player.audioTrack = track;
      setCurrentAudioTrack(track);
    }
    setShowAudioMenu(false);
    setShowSettings(false);
  };

  if (!visible) return null;

  return (
    <View style={controlStyles.controlsContainer} pointerEvents="box-none">
      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <TouchableOpacity
          style={controlStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettings(false)}
        >
          <View style={controlStyles.menuContainer}>
            <Text style={controlStyles.menuTitle}>Video Settings</Text>

            <TouchableOpacity
              style={controlStyles.menuItem}
              onPress={() => setShowSpeedMenu(true)}
            >
              <View style={controlStyles.menuItemLeft}>
                <Ionicons name="speedometer-outline" size={20} color="#fff" />
                <Text style={controlStyles.menuItemText}>Playback Speed</Text>
              </View>
              <Text style={controlStyles.menuItemValue}>{currentPlaybackRate}x</Text>
            </TouchableOpacity>

            {availableAudioTracks.length > 1 && (
              <TouchableOpacity
                style={controlStyles.menuItem}
                onPress={() => setShowAudioMenu(true)}
              >
                <View style={controlStyles.menuItemLeft}>
                  <Ionicons name="language-outline" size={20} color="#fff" />
                  <Text style={controlStyles.menuItemText}>Audio Track</Text>
                </View>
                <Text style={controlStyles.menuItemValue}>
                  {getLanguageName(currentAudioTrack?.language)}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={controlStyles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={controlStyles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Speed Selection Modal */}
      <Modal
        visible={showSpeedMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSpeedMenu(false)}
      >
        <TouchableOpacity
          style={controlStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSpeedMenu(false)}
        >
          <View style={controlStyles.menuContainer}>
            <Text style={controlStyles.menuTitle}>Playback Speed</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {speedOptions.map(rate => (
                <TouchableOpacity
                  key={rate}
                  style={[controlStyles.menuItem, currentPlaybackRate === rate && controlStyles.menuItemSelected]}
                  onPress={() => handleSpeedSelect(rate)}
                >
                  <Text style={controlStyles.menuItemText}>{rate === 1.0 ? 'Normal' : `${rate}x`}</Text>
                  {currentPlaybackRate === rate && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Audio Selection Modal */}
      <Modal
        visible={showAudioMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAudioMenu(false)}
      >
        <TouchableOpacity
          style={controlStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAudioMenu(false)}
        >
          <View style={controlStyles.menuContainer}>
            <Text style={controlStyles.menuTitle}>Audio Tracks</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {availableAudioTracks.map((track, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[controlStyles.menuItem, currentAudioTrack === track && controlStyles.menuItemSelected]}
                  onPress={() => handleAudioSelect(track)}
                >
                  <Text style={controlStyles.menuItemText}>{getLanguageName(track.language)}</Text>
                  {currentAudioTrack === track && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom bar container - consumes taps to prevent toggling controls when tapping near buttons */}
      <TouchableOpacity
        activeOpacity={1}
        style={controlStyles.bottomBar}
        onPress={(e) => {
          // Consume event
        }}
        pointerEvents="auto"
      >
        <TouchableOpacity onPress={onPlayPause} style={controlStyles.smallControlBtn}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="white" />
        </TouchableOpacity>

        <Text style={controlStyles.timeText}>
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </Text>

        <ProgressBar
          progress={progress}
          onSeek={onSeek}
          duration={duration || 0}
          onIsInteracting={onIsInteracting}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={controlStyles.smallControlBtn}>
            <Ionicons name="settings-outline" size={22} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onToggleFullscreen} style={controlStyles.smallControlBtn}>
            <Ionicons name={isLandscape ? "contract-outline" : "scan-outline"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// --- Video Content Component ---
const VideoContent = ({ mediaItem, isActive, onToggleUI, videoStates, dimensions, controlsVisible, controlsOpacity }) => {
  const [videoUri, setVideoUri] = useState(null);
  const [isReady, setIsReady] = useState(false); // NEW: Gate rendering
  const [loadError, setLoadError] = useState(false); // NEW: Track errors
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false); // Track if user has interacted with video
  const [isInteracting, setIsInteracting] = useState(false); // Track if user is seeking/dragging
  const { showAlert } = useDialog();

  // Player Hook - Only init when valid URI exists
  const player = useVideoPlayer(videoUri, (player) => {
    if (videoUri) {
      player.loop = true;
      player.muted = false;
      player.timeUpdateEventInterval = 0.1;
    }
  });

  // Use refs for flags that shouldn't trigger re-renders or reset inconsistently
  const loadedIdRef = useRef(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const videoRef = useRef(null);

  // Clean up on unmount or ID change
  useEffect(() => {
    return () => {
      setIsReady(false);
      setLoadError(false);
      setVideoUri(null);
      setHasInteracted(false); // Reset interaction state for new video
      loadedIdRef.current = null;
    };
  }, [mediaItem.id]); // Reset when ID changes

  // Cleanup video on screen exit
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          if (player && player.status === 'readyToPlay') {
            // Check if player is still valid (not released)
            // Expo Modules shared objects throw when used after release
            player.pause();
          }
        } catch (e) {
          // If player is already released, this will catch the native error
          console.log('ViewerScreen: Player already released or failed to pause', e.message);
        }
        if (videoRef.current) {
          videoRef.current = null;
        }
      };
    }, [player])
  );

  // Custom Control State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoDims, setVideoDims] = useState({
    width: mediaItem.width || 0,
    height: mediaItem.height || 0
  });

  // Resolve Video URI
  useEffect(() => {
    // If we already have the URI cached for this ID, just use it
    if (loadedIdRef.current === mediaItem.id) return;

    // Reset state for new item
    setIsReady(false);
    setLoadError(false);
    setVideoUri(null);
    setCurrentTime(0);
    setDuration(0);
    hasRestoredRef.current = false;

    const cachedUri = videoStates?.current?.[mediaItem.id]?.uri;
    if (cachedUri) {
      setVideoUri(cachedUri);
      loadedIdRef.current = mediaItem.id;
      setIsReady(true);
      return;
    }

    let isMounted = true;

    const loadUri = async () => {
      try {
        let uri = null;
        const isVault = mediaItem.id && mediaItem.id.toString().startsWith('vault_');
        const isTrash = mediaItem.isTrash || mediaItem.isAppTrash;

        // 1. Prioritize direct paths for Vault and Trash items
        if ((isVault || isTrash) && (mediaItem.filePath || mediaItem.uri || mediaItem.localUri)) {
          uri = mediaItem.filePath || mediaItem.uri || mediaItem.localUri;
        }
        // 2. Otherwise try MediaLibrary for regular assets
        else if (mediaItem.id && !mediaItem.id.toString().startsWith('picked_') && !mediaItem.id.toString().startsWith('temp_')) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            try {
              const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
              if (asset) {
                uri = asset.localUri || asset.uri;
                if (asset.width && asset.height) {
                  setVideoDims({ width: asset.width, height: asset.height });
                }
              } else {
                // Asset not found in media library (might be in system trash or recently moved)
                uri = mediaItem.localUri || mediaItem.filePath || mediaItem.uri;
              }
            } catch (err) {
              console.warn("VideoContent: getAssetInfoAsync failed", err);
              uri = mediaItem.localUri || mediaItem.filePath || mediaItem.uri;
            }
          } else {
            uri = mediaItem.localUri || mediaItem.filePath || mediaItem.uri;
          }
        }
        // 3. Last resort fallback
        else {
          uri = mediaItem.localUri || mediaItem.filePath || mediaItem.uri;
        }

        if (isMounted) {
          if (uri) {
            setVideoUri(uri);
            loadedIdRef.current = mediaItem.id;
            // Cache the URI for faster remounts (rotation)
            if (videoStates?.current) {
              videoStates.current[mediaItem.id] = {
                ...videoStates.current[mediaItem.id],
                uri: uri
              };
            }
            setIsReady(true); // Only set ready when we strictly have a URI
          } else {
            console.error("VideoContent: Could not resolve URI for", mediaItem.id);
            setLoadError(true);
          }
        }
      } catch (e) {
        console.error("Error determining video URI", e);
        if (isMounted) setLoadError(true);
      }
    };
    loadUri();
    return () => { isMounted = false; };
  }, [mediaItem.id, videoStates]);


  // Event Listeners for Custom Controls & Restoration
  useEffect(() => {
    if (!player || !isReady) return;

    const restoreState = () => {
      if (hasRestoredRef.current || !videoStates?.current?.[mediaItem.id]) return;
      const state = videoStates.current[mediaItem.id];

      // Only restore if we have a valid non-zero position saved within the last 5 minutes
      if (Date.now() - state.timestamp < 300000 && state.currentTime > 0.1) {
        console.log(`VideoContent: Restoring state for ${mediaItem.id} to ${state.currentTime}`);

        hasRestoredRef.current = true;
        isRestoringRef.current = true;
        player.currentTime = state.currentTime;

        // Lock out updates for 2 seconds to let the player stabilize
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 2000);

        // If it was playing, resume after a short delay to allow seek to settle
        if (state.isPlaying && isActive) {
          setTimeout(() => {
            try {
              if (isActive && player && player.status === 'readyToPlay') {
                player.play();
              }
            } catch (e) {
              console.warn('ViewerScreen: Failed to resume playback in timeout', e);
            }
          }, 500);
        }
      } else {
        // If no state to restore, mark as "done" so we don't keep trying
        hasRestoredRef.current = true;
      }
    };

    // If player is already ready (e.g. on re-render), try restoring immediately
    if (player.status === 'readyToPlay') {
      if (duration === 0) setDuration(player.duration);
      restoreState();
    }

    const playbackSub = player.addListener('playbackStateChange', (e) => {
      if (e.playbackState === 'finished') {
        setIsPlaying(false);
      }
    });

    const statusSub = player.addListener('statusChange', (s) => {
      if (s.status === 'readyToPlay') {
        console.log(`VideoContent: Status readyToPlay - restoring state`);
        setDuration(player.duration); // Update duration
        restoreState();
      }
    });

    const playSub = player.addListener('playingChange', (e) => {
      setIsPlaying(e.isPlaying);
      if (e.isPlaying) {
        setHasInteracted(true);
      }
      if (videoStates?.current?.[mediaItem.id]) {
        videoStates.current[mediaItem.id].isPlaying = e.isPlaying;
        videoStates.current[mediaItem.id].timestamp = Date.now();
      }
    });

    const timeSub = player.addListener('timeUpdate', (e) => {
      // Update local state for UI immediately
      setCurrentTime(e.currentTime);

      // Secondary safety check for duration (if it was 0 previously)
      if (player.duration > 0) {
        setDuration((prev) => (prev === 0 ? player.duration : prev));
      }

      // DEEP STABILITY: If we are restoring OR the player just reset to 0 
      // while we have a saved position, skip saving this 0 or old value.
      if (isRestoringRef.current) return;

      if (videoStates?.current) {
        const prevState = videoStates.current[mediaItem.id];

        // SOFT LOCKOUT: If player emits a time that is significantly behind 
        // the last known good position within 5s of mount, ignore it.
        // This stops movies from restarting because of native buffering/orientation events.
        if (prevState && prevState.currentTime > 0.5) {
          if (e.currentTime < prevState.currentTime - 0.5 && Date.now() - prevState.timestamp < 5000) {
            return;
          }
        }

        videoStates.current[mediaItem.id] = {
          ...prevState,
          currentTime: e.currentTime,
          isPlaying: player.playing,
          uri: videoUri,
          timestamp: Date.now()
        };
      }
    });

    return () => {
      playbackSub.remove();
      statusSub.remove();
      playSub.remove();
      timeSub.remove();
    };
  }, [player, mediaItem.id, videoStates, isActive, isReady]);

  // Pause when inactive
  useEffect(() => {
    try {
      if (!isActive && player && player.status === 'readyToPlay' && isPlaying) {
        player.pause();
      }
    } catch (e) {
      console.warn('ViewerScreen: Error pausing background video', e);
    }
  }, [isActive, player, isPlaying]);

  const togglePlay = () => {
    if (!player || player.status !== 'readyToPlay') return;

    try {
      // Check if video is finished using player's native state
      const isFinished = player.playbackState === 'finished';

      if (isFinished) {
        // Precise restart: seek to 0 and play in one go
        player.currentTime = 0;
        setCurrentTime(0);
        player.play();
        setHasInteracted(true);
      } else {
        // Normal toggle
        if (isPlaying) {
          player.pause();
        } else {
          setHasInteracted(true);
          player.play();
        }
      }
    } catch (e) {
      console.error('ViewerScreen: Error toggling play', e);
    }
  };

  const handleRewind10 = () => {
    if (player) {
      const newTime = Math.max(0, currentTime - 10);
      player.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleForward10 = () => {
    if (player && duration) {
      const newTime = Math.min(duration, currentTime + 10);
      player.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeek = (time) => {
    if (player && player.status === 'readyToPlay') {
      try {
        player.currentTime = time;
        setCurrentTime(time); // Optimistic update
      } catch (e) {
        console.warn('ViewerScreen: Seek failed', e);
      }
    }
  };

  const toggleFullscreen = async () => {
    try {
      const orientation = await ScreenOrientation.getOrientationAsync();
      console.log('Current Orientation:', orientation);
      if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP || orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
        console.log('Locking to LANDSCAPE');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        console.log('Locking to PORTRAIT_UP');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch (e) {
      console.error('Error toggling fullscreen:', e);
      showAlert('Error', 'Failed to toggle fullscreen');
    }
  };

  const videoBoxStyle = useMemo(() => {
    const { width: sw, height: sh } = dimensions;
    if (!videoDims.width || !videoDims.height) {
      return { width: sw, height: sh, position: 'absolute' };
    }

    const { width: vw, height: vh } = videoDims;
    const videoAspect = vw / vh;
    const screenAspect = sw / sh;

    let width, height;
    if (videoAspect > screenAspect) {
      width = sw;
      height = sw / videoAspect;
    } else {
      height = sh;
      width = sh * videoAspect;
    }

    return {
      width,
      height,
      position: 'absolute',
      left: (sw - width) / 2,
      top: (sh - height) / 2,
    };
  }, [videoDims, dimensions]);

  const videoControlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  // Render Logic
  // 1. Error state
  if (loadError) {
    return (
      <View style={{ width: dimensions.width, height: dimensions.height, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color="white" />
        <Text style={{ color: 'white', marginTop: 10 }}>Failed to load video</Text>
      </View>
    );
  }

  // 2. Loading state (strictly gated)
  if (!isReady || !videoUri) {
    return (
      <View style={{ width: dimensions.width, height: dimensions.height, backgroundColor: '#000' }} />
    );
  }

  return (
    <View style={{ width: dimensions.width, height: dimensions.height, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      {/* Background Video Layer */}
      <View style={videoBoxStyle} pointerEvents="box-none">
        {player && (
          <VideoView
            ref={videoRef}
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls={false}
            allowsFullscreen={false} // We handle rotation manually
            requiresLinearPlayback={false}
            contentFit="contain"
          />
        )}
      </View>

      {/* Transparent overlay for toggling controls - middle layer, captures taps on empty areas */}
      {/* Only active after user has interacted, otherwise initial play button handles touches */}
      {hasInteracted && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (!isInteracting) {
              onToggleUI();
            }
          }}
        />
      )}

      {/* Initial Play Button Overlay - Shows before user interaction - rendered on top */}
      {!hasInteracted && !isPlaying && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={controlStyles.initialPlayOverlay}>
            <TouchableOpacity onPress={togglePlay} style={controlStyles.initialPlayButton}>
              <Ionicons name="play" size={60} color="white" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Center Overlay Controls - YouTube style (only show after interaction) */}
      {hasInteracted && (
        <Animated.View style={[StyleSheet.absoluteFill, videoControlsStyle]} pointerEvents="box-none">
          <View style={controlStyles.centerControlsContainer} pointerEvents="box-none">
            {/* Rewind 10s */}
            <TouchableOpacity
              onPress={() => !isInteracting && handleRewind10()}
              style={controlStyles.centerButton}
            >
              <Ionicons name="play-back" size={32} color="white" />
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={() => !isInteracting && togglePlay()}
              style={controlStyles.centerButtonLarge}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" style={{ marginLeft: isPlaying ? 0 : 4 }} />
            </TouchableOpacity>

            {/* Forward 10s */}
            <TouchableOpacity
              onPress={() => !isInteracting && handleForward10()}
              style={controlStyles.centerButton}
            >
              <Ionicons name="play-forward" size={32} color="white" />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls Layer */}
          {/* Video Bottom Controls */}
          <CustomVideoControls
            player={player}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            duration={duration}
            currentTime={currentTime}
            onToggleFullscreen={toggleFullscreen}
            visible={true}
            onSeek={handleSeek}
            isLandscape={dimensions.width > dimensions.height}
            onIsInteracting={setIsInteracting}
          />
        </Animated.View>
      )}
    </View>
  );
};

// --- Image Content Component ---
const ImageContent = ({ mediaItem, isActive, onZoomChange, onToggleUI, refreshKey, dimensions }) => {
  // Initialize with synchronously available URI - NO ASYNC BLOCKING
  const [imageUri, setImageUri] = useState(() => {
    // Prioritize URIs based on source type
    const isVault = mediaItem.id && mediaItem.id.toString().startsWith('vault_');
    const isTrash = mediaItem.isTrash || mediaItem.isAppTrash;

    // Return immediately available URI
    if (isVault || isTrash) {
      return mediaItem.filePath || mediaItem.uri || mediaItem.localUri;
    }
    return mediaItem.uri || mediaItem.localUri || mediaItem.filePath;
  });

  const loadedIdRef = useRef(null);
  const screenDims = Dimensions.get('window');
  const [layout, setLayout] = useState({ width: screenDims.width, height: screenDims.height });

  useEffect(() => {
    // Reset URI when media item changes
    const currentKey = `${mediaItem.id}_${refreshKey || ''}`;

    // If switching to a new item, reset to its immediate URI
    if (loadedIdRef.current !== currentKey) {
      const isVault = mediaItem.id && mediaItem.id.toString().startsWith('vault_');
      const isTrash = mediaItem.isTrash || mediaItem.isAppTrash;

      const immediateUri = (isVault || isTrash)
        ? (mediaItem.filePath || mediaItem.uri || mediaItem.localUri)
        : (mediaItem.uri || mediaItem.localUri || mediaItem.filePath);

      setImageUri(immediateUri);
      loadedIdRef.current = currentKey;
    }

    // NON-BLOCKING: Try to enhance URI in background
    // This runs AFTER the image is already rendering
    let isMounted = true;

    const enhanceUri = async () => {
      // Skip enhancement for vault items (they already have optimal path)
      if (mediaItem.id && !mediaItem.id.toString().startsWith('vault_') && !mediaItem.id.toString().startsWith('picked_')) {
        try {
          const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
          const enhancedUri = asset.localUri || asset.uri;

          // Only update if we got a different/better URI
          if (isMounted && enhancedUri && enhancedUri !== imageUri) {
            console.log('ImageContent: Enhanced URI from MediaLibrary');
            setImageUri(enhancedUri);
          }
        } catch (e) {
          // Silently fail - we already have the initial URI rendering
          console.log('ImageContent: MediaLibrary enhancement skipped:', e.message);
        }
      }
    };

    enhanceUri();
    return () => { isMounted = false; };
  }, [mediaItem.id, refreshKey]);

  const imageKey = `${mediaItem.id}_${refreshKey || ''}`;

  return (
    <View
      style={{
        width: dimensions.width,
        height: dimensions.height,
        justifyContent: 'center',
        backgroundColor: '#000' // Dark background to avoid flash
      }}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      <ZoomableImage
        key={imageKey}
        source={{ uri: imageUri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={imageKey}
        onZoomChange={onZoomChange}
        isActive={isActive}
        onPress={onToggleUI}
        containerWidth={layout.width}
        containerHeight={layout.height}
        intrinsicWidth={mediaItem.width}
        intrinsicHeight={mediaItem.height}
      />
    </View>
  );
};


// --- Media Item Wrapper ---
const MediaItem = React.memo(({ mediaItem, index, isActive, onZoomChange, onToggleUI, refreshKey, videoStates, dimensions, controlsVisible, controlsOpacity }) => {
  const isVideo = isVideoItem(mediaItem);

  if (isVideo) {
    return <VideoContent
      mediaItem={mediaItem}
      isActive={isActive}
      onToggleUI={onToggleUI}
      videoStates={videoStates}
      dimensions={dimensions}
      controlsVisible={controlsVisible}
      controlsOpacity={controlsOpacity}
    />;
  } else {
    return <ImageContent mediaItem={mediaItem} isActive={isActive} onZoomChange={onZoomChange} onToggleUI={onToggleUI} refreshKey={refreshKey} dimensions={dimensions} />;
  }
}, (prev, next) => {
  return prev.isActive === next.isActive &&
    prev.mediaItem.id === next.mediaItem.id &&
    prev.refreshKey === next.refreshKey &&
    prev.dimensions.width === next.dimensions.width &&
    prev.dimensions.height === next.dimensions.height;
});

MediaItem.displayName = 'MediaItem';

// --- Main Screen ---
export default function ViewerScreen({ route, navigation: navProp }) {
  const routeParams = route?.params || {};
  const { item, allItems, initialIndex, refreshKey, originalAssetId } = routeParams;
  const navHook = useNavigation();
  const navigation = navHook || navProp;

  const [mediaItems, setMediaItems] = useState(allItems && allItems.length > 0 ? allItems : (item ? [item] : []));
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef(null);
  // Persist video playback state across rotation/re-renders
  const videoStates = useRef({});

  // Track screen dimensions for orientation changes
  const [dimensions, setDimensions] = useState(getScreenDimensions());
  // Track if device is in landscape orientation (video maximized)
  const [isLandscape, setIsLandscape] = useState(false);
  // Use ref instead of state to avoid triggering re-renders during rotation
  const isRotatingRef = useRef(false);
  const rotationOpacity = useSharedValue(1);
  const currentIndexRef = useRef(initialIndex || 0);

  // Keep currentIndexRef in sync for rotation logic
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Dialog Context
  const { showConfirm, showAlert } = useDialog();

  // Toggle Controls Logic
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useSharedValue(1);

  const toggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  useEffect(() => {
    controlsOpacity.value = withTiming(controlsVisible ? 1 : 0, { duration: 300 });
  }, [controlsVisible]);

  const topBarStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const shareInProgressRef = useRef(false);

  // Unlock screen orientation for Viewer, lock on exit
  // Handle screen dimensions
  useEffect(() => {
    const enableRotation = async () => {
      await ScreenOrientation.unlockAsync();
    };
    enableRotation();

    // Listen for dimension changes (orientation changes)
    const dimensionSubscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('ViewerScreen: Dimensions changed:', window.width, 'x', window.height);

      // 1. Mark rotation as in-progress immediately
      isRotatingRef.current = true;

      // 2. Capture stable index BEFORE state updates
      const stableIndex = currentIndexRef.current;

      // 3. Fade out FlatList to hide the blink/jump
      rotationOpacity.value = 0;

      // 4. Update states
      const landscape = window.width > window.height;
      setIsLandscape(landscape);
      setDimensions({ width: window.width, height: window.height });

      // 5. Correct scroll position after layout settlement
      // Using a slightly longer delay to ensure FlatList layout cycle completes
      setTimeout(() => {
        if (flatListRef.current) {
          console.log('ViewerScreen: Correcting scroll to index', stableIndex);
          flatListRef.current.scrollToIndex({
            index: stableIndex,
            animated: false,
            viewPosition: 0
          });
        }

        // 6. Fade back in after scroll correction
        setTimeout(() => {
          rotationOpacity.value = withTiming(1, { duration: 150 });
          // Unlock index updates
          isRotatingRef.current = false;
        }, 100);
      }, 100);
    });

    return () => {
      dimensionSubscription?.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []); // Remove currentIndex dependency, use ref instead

  // Configure Audio for Video
  useEffect(() => {
    // We set this once to allow playback in silence mode
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    }).catch(e => console.warn("Audio mode error", e));
  }, []);

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  // Scroll to initial
  useEffect(() => {
    if (initialIndex !== undefined && flatListRef.current && mediaItems.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [initialIndex, mediaItems.length]);

  // Scroll position is now handled directly in the dimension change listener
  // This effect is removed to prevent redundant scroll corrections

  const currentItem = mediaItems[currentIndex];

  // Custom back handler to pass cropped asset to HomeScreen
  const handleBackPress = useCallback(() => {
    // If this is a cropped image (has originalAssetId), pass it to HomeScreen
    if (originalAssetId && currentItem) {
      console.log('ViewerScreen: Passing cropped asset to HomeScreen', { originalAssetId, currentItem });
      navigation.navigate('MainTabs', {
        screen: 'Photos',
        params: {
          croppedAsset: currentItem,
          originalAssetId: originalAssetId
        }
      });
    } else {
      navigation.goBack();
    }
  }, [originalAssetId, currentItem, navigation]);

  // Vertical swipe gesture to exit Viewer
  const verticalSwipeGesture = Gesture.Pan()
    .enabled(!isZoomed) // Only enable when not zoomed
    .activeOffsetY([-50, 50]) // Require 50px vertical movement to activate
    .failOffsetX([-20, 20]) // Fail if horizontal movement exceeds 20px
    .onEnd((event) => {
      'worklet';
      // If vertical velocity is significant, exit
      const verticalVelocity = Math.abs(event.velocityY);
      const horizontalVelocity = Math.abs(event.velocityX);

      // Only trigger if vertical movement is dominant
      if (verticalVelocity > 500 && verticalVelocity > horizontalVelocity) {
        runOnJS(handleBackPress)();
      }
    });

  const handleDelete = () => {
    if (!currentItem) return;

    showConfirm(
      'Delete photo?',
      'This item will be moved to trash.',
      async () => {
        try {
          const success = await moveToSystemTrash(currentItem);
          if (success) {
            const newItems = [...mediaItems];
            newItems.splice(currentIndex, 1);
            if (newItems.length === 0) navigation.goBack();
            else {
              setMediaItems(newItems);
              setCurrentIndex(curr => Math.min(curr, newItems.length - 1));
              setIsZoomed(false);
            }
          } else {
            showAlert('Error', 'Failed to move to trash');
          }
        } catch (e) {
          showAlert('Error', 'Failed to move to trash');
        }
      },
      null, // Cancel callback (optional)
      true // Destructive
    );
  };

  const handleShare = async () => {
    if (shareInProgressRef.current) return;

    try {
      shareInProgressRef.current = true;
      let uri = currentItem.uri || currentItem.filePath;

      // Ensure we use the most reliable URI (already content:// for MediaLibrary assets)
      if (currentItem.id && !currentItem.id.toString().startsWith('vault_')) {
        // We prioritize currentItem.uri if available as it's the exact MediaStore URI
        uri = currentItem.uri || `content://media/external/images/media/${currentItem.id}`;
      }

      if (uri) {
        console.log(`Viewer: Sharing item via NativeModules.MultiShare`);
        if (NativeModules.MultiShare) {
          // Pass as an array even for single item for consistency
          await NativeModules.MultiShare.shareImages([uri]);
        } else {
          console.warn('NativeModules.MultiShare not found');
        }
      }
    } catch (error) {
      const errorMsg = error.message || '';
      if (!errorMsg.includes('User did not share') && !errorMsg.includes('User cancelled')) {
        console.error('Viewer: Share error:', errorMsg);
        showAlert('Error', 'Failed to share item');
      }
    } finally {
      // Safely reset guard after a delay
      setTimeout(() => {
        shareInProgressRef.current = false;
      }, 1000);
    }
  };

  const handleEdit = () => {
    if (isVideoItem(currentItem)) return showAlert('Info', 'Video editing not supported');
    navigation.dispatch(CommonActions.navigate({ name: 'EditPhoto', params: { item: currentItem } }));
  };

  const renderItem = useCallback(({ item, index }) => {
    return (
      <MediaItem
        key={item.id} // Added key to stabilize FlatList items
        mediaItem={item}
        index={index}
        isActive={index === currentIndex}
        onZoomChange={setIsZoomed}
        onToggleUI={toggleControls}
        refreshKey={refreshKey}
        videoStates={videoStates}
        dimensions={dimensions}
        controlsVisible={controlsVisible}
        controlsOpacity={controlsOpacity}
      />
    );
  }, [currentIndex, toggleControls, refreshKey, dimensions, controlsVisible, videoStates, controlsOpacity]); // ✅ Added all dependencies

  const getItemLayout = useCallback((data, index) => ({
    length: dimensions.width,
    offset: dimensions.width * index,
    index
  }), [dimensions.width]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    // Only update index if NOT rotating to prevent jumping
    if (!isRotatingRef.current && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  // Use dynamic dimensions for proper orientation handling
  const { width: screenWidth, height: screenHeight } = dimensions;
  const styles = useMemo(() => getStyles(screenWidth, screenHeight), [screenWidth, screenHeight]);

  const flatListStyle = useAnimatedStyle(() => ({
    opacity: rotationOpacity.value,
  }));

  if (!currentItem && mediaItems.length === 0) return null;
  const isPhoto = currentItem && !isVideoItem(currentItem);

  return (
    <GestureDetector gesture={verticalSwipeGesture}>
      <View style={styles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, flatListStyle]}>
          <FlatList
            ref={flatListRef}
            data={mediaItems}
            renderItem={renderItem}
            keyExtractor={item => item.id?.toString() || Math.random().toString()}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed && (!isLandscape || isPhoto)}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex || 0}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
          />
        </Animated.View>

        {/* Top Bar with Controls - Rendered AFTER FlatList to be on top */}
        <Animated.View style={[styles.safeArea, topBarStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={handleBackPress} style={styles.actionButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
                {isPhoto && !isLandscape && (
                  <TouchableOpacity onPress={handleEdit} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>

      </View>
    </GestureDetector>
  );
}

const getStyles = (width, height) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  safeArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, elevation: 10 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8, zIndex: 101 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { width, height, justifyContent: 'center', alignItems: 'center' },
  image: { width, height },
  video: { width, height },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playButtonContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  playButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' }
});

const controlStyles = StyleSheet.create({
  controlsContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerControlsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  initialPlayOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  initialPlayButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  centerButtonLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  largePlayButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  smallControlBtn: { padding: 8 },
  timeText: { color: '#fff', fontSize: 14, marginHorizontal: 12, fontVariant: ['tabular-nums'] },
  progressBarContainer: {
    flex: 1,
    height: 60,
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuItemSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
  },
  menuItemValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

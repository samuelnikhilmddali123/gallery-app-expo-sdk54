import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions, Alert, AppState, TouchableOpacity as RNTouchableOpacity, TouchableOpacity, PanResponder, Modal, ScrollView, NativeModules, Platform, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Video as ExpoAVVideo, Audio } from 'expo-av';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import ZoomableImage from '../components/ZoomableImage';
import { useDialog } from '../contexts/DialogContext';
import { moveToSystemTrash } from '../services/mediaService';
import * as ScreenOrientation from 'expo-screen-orientation';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';

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

// Helper for time formatting
const formatTime = (timeInSeconds) => {
  if (!timeInSeconds && timeInSeconds !== 0) return '0:00';
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Helper for language names
const getLanguageName = (code) => {
  if (!code) return 'Default';
  const languageMap = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
    'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese',
    'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu', 'mr': 'Marathi', 'ta': 'Tamil',
    'ur': 'Urdu', 'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam', 'pa': 'Punjabi',
    'ar': 'Arabic', 'tr': 'Turkish', 'vi': 'Vietnamese', 'pl': 'Polish', 'uk': 'Ukrainian',
    'id': 'Indonesian', 'ms': 'Malay', 'th': 'Thai'
  };
  const baseCode = code.split(/[-_]/)[0].toLowerCase();
  return languageMap[baseCode] || code.toUpperCase();
};

// --- Video Content Component ---
// --- Scrubbing Preview Component ---
const ScrubbingPreview = ({ videoUri, duration, scrubX, isScrubbing, containerWidth, colors }) => {
  const [previewTime, setPreviewTime] = useState(0);
  const previewPlayer = useVideoPlayer(videoUri || '', (player) => {
    player.muted = true;
  });
  const lastPreviewUpdateRef = useRef(0);
  const previewThrottleMs = 100; // Update preview every 100ms

  useAnimatedReaction(
    () => ({ x: scrubX.value, active: isScrubbing.value }),
    (data) => {
      if (data.active && containerWidth > 0) {
        const time = (data.x / containerWidth) * duration;

        // PERFORMANCE: Throttle preview time updates
        const now = Date.now();
        if (now - lastPreviewUpdateRef.current >= previewThrottleMs) {
          lastPreviewUpdateRef.current = now;
          runOnJS(setPreviewTime)(time);
        }
      }
    }
  );

  useEffect(() => {
    if (previewPlayer && isScrubbing.value) {
      previewPlayer.seekBy(previewTime - previewPlayer.currentTime);
    }
  }, [previewTime]);

  const animatedStyle = useAnimatedStyle(() => {
    // Keep within bounds: popup is 120px wide
    const halfWidth = 60;
    const clampedX = Math.max(halfWidth, Math.min(containerWidth - halfWidth, scrubX.value));

    return {
      opacity: withTiming(isScrubbing.value ? 1 : 0, { duration: 150 }),
      transform: [
        { translateX: clampedX - halfWidth },
        { translateY: withTiming(isScrubbing.value ? -10 : 10, { duration: 200 }) },
        { scale: withTiming(isScrubbing.value ? 1 : 0.8, { duration: 200 }) }
      ]
    };
  });

  if (!videoUri) return null;

  return (
    <Animated.View style={[controlStyles.previewContainer, animatedStyle]}>
      <View style={[controlStyles.previewContent, { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#000' }]}>
        <VideoView
          player={previewPlayer}
          style={controlStyles.previewVideo}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={controlStyles.previewTimeOverlay}>
          <Text style={controlStyles.previewTimeText}>{formatTime(previewTime)}</Text>
        </View>
      </View>
      <View style={controlStyles.previewArrow} />
    </Animated.View>
  );
};

// --- ProgressBar Component ---
const ProgressBar = ({ progress, onSeek, duration, onIsInteracting, onScrubToggle, scrubX, isScrubbing, setIsSeeking }) => {
  const [layout, setLayout] = useState({ width: 0, x: 0 });
  const containerRef = useRef(null);
  const lastSeekCallRef = useRef(0);
  const throttleMs = 100; // Throttle onSeek calls to 100ms (10 times/sec)

  const handleTouch = (absoluteX, isThrottled = true) => {
    if (layout.width > 0 && duration > 0) {
      const relativeX = absoluteX - layout.x;
      const percent = Math.max(0, Math.min(1, relativeX / layout.width));
      const timeInSeconds = percent * duration;

      // PERFORMANCE: Throttle onSeek calls during scrubbing
      const now = Date.now();
      if (!isThrottled || now - lastSeekCallRef.current >= throttleMs) {
        lastSeekCallRef.current = now;
        onSeek(timeInSeconds, true); // true indicates active scrubbing
      }
    }
  };

  const gesture = Gesture.Pan()
    .manualActivation(false)
    .onStart((e) => {
      isScrubbing.value = true;
      runOnJS(onIsInteracting)?.(true);
      runOnJS(onScrubToggle)?.(true);
      if (setIsSeeking) runOnJS(setIsSeeking)(true);

      // Update scrubX on native thread (smooth animation)
      const relativeX = e.absoluteX - layout.x;
      scrubX.value = Math.max(0, Math.min(layout.width, relativeX));

      // Call handleTouch without throttle on start for instant feedback
      runOnJS(handleTouch)(e.absoluteX, false);
    })
    .onUpdate((e) => {
      // PERFORMANCE: Update scrubX directly on native thread (no runOnJS)
      // This keeps the thumb animation smooth at 60 FPS
      const relativeX = e.absoluteX - layout.x;
      scrubX.value = Math.max(0, Math.min(layout.width, relativeX));

      // Throttled seek call to JS thread
      runOnJS(handleTouch)(e.absoluteX, true);
    })
    .onEnd((e) => {
      isScrubbing.value = false;
      runOnJS(onIsInteracting)?.(false);
      if (setIsSeeking) runOnJS(setIsSeeking)(false);

      // Final position update (no throttle for accuracy)
      const relativeX = e.absoluteX - layout.x;
      const percent = Math.max(0, Math.min(1, relativeX / layout.width));
      runOnJS(onSeek)(percent * duration, false); // false = not scrubbing, execute immediately

      runOnJS(onScrubToggle)?.(false);
    })
    .onFinalize(() => {
      isScrubbing.value = false;
      runOnJS(onIsInteracting)?.(false);
      runOnJS(onScrubToggle)?.(false);
      if (setIsSeeking) runOnJS(setIsSeeking)(false);
    });

  const tapGesture = Gesture.Tap()
    .onStart((e) => {
      // Update scrubX immediately for visual feedback
      const relativeX = e.absoluteX - layout.x;
      scrubX.value = Math.max(0, Math.min(layout.width, relativeX));

      if (setIsSeeking) runOnJS(setIsSeeking)(true);

      // Tap is instant, no throttle
      runOnJS(handleTouch)(e.absoluteX, false);
      
      // Since Tap has no "end" gesture handler that always fires, 
      // we hide preview after a small delay
      setTimeout(() => {
        if (setIsSeeking) runOnJS(setIsSeeking)(false);
      }, 1000);
    });

  const composed = Gesture.Simultaneous(gesture, tapGesture);

  return (
    <View
      ref={containerRef}
      style={controlStyles.progressBarContainer}
      onLayout={() => {
        if (containerRef.current) {
          containerRef.current.measure((x, y, width, height, pageX, pageY) => {
            setLayout({ width, x: pageX });
          });
        }
      }}
    >
      <GestureDetector gesture={composed}>
        <View style={{ height: '100%', justifyContent: 'center', width: '100%' }}>
          <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
            <View style={[controlStyles.progressBarFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
          </View>
          {/* Animated Thumb */}
          <Animated.View
            style={[
              controlStyles.progressBarThumb,
              useAnimatedStyle(() => {
                const thumbX = isScrubbing.value
                  ? scrubX.value
                  : (progress / 100) * layout.width;

                return {
                  transform: [
                    { translateX: thumbX },
                    { scale: withTiming(isScrubbing.value ? 1.5 : 1, { duration: 100 }) }
                  ],
                  // Remove 'left' from styles or reset it if needed
                  left: 0,
                };
              })
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
};

const CustomVideoControls = ({
  player, // Use expo-video player object
  videoUri,
  isPlaying,
  onPlayPause,
  duration,
  currentTime,
  onToggleFullscreen,
  visible,
  onSeek,
  isLandscape,
  onIsInteracting,
  onScrubToggle,
  colors,
  availableAudioTracks = [],
  currentAudioTrack = null,
  onAudioSelect,
  availableTextTracks = [],
  currentTextTrack = null,
  onTextSelect
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showTextMenu, setShowTextMenu] = useState(false);

  // Scrubbing Shared Values
  const scrubX = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(1.0);

  useEffect(() => {
    if (!player) return;
    setCurrentPlaybackRate(player.playbackRate);
  }, [player, visible]); // Sync speed when visible

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

  const handleAudioTrackChange = (track) => {
    onAudioSelect?.(track);
    setShowAudioMenu(false);
    setShowSettings(false);
  };

  const handleTextTrackChange = (track) => {
    onTextSelect?.(track);
    setShowTextMenu(false);
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

            {availableTextTracks.length > 0 && (
              <TouchableOpacity
                style={controlStyles.menuItem}
                onPress={() => setShowTextMenu(true)}
              >
                <View style={controlStyles.menuItemLeft}>
                  <Ionicons name="chatbox-ellipses-outline" size={20} color="#fff" />
                  <Text style={controlStyles.menuItemText}>Captions</Text>
                </View>
                <Text style={controlStyles.menuItemValue}>
                  {currentTextTrack ? getLanguageName(currentTextTrack.language) : 'Off'}
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
                  onPress={() => handleAudioTrackChange(track)}
                >
                  <Text style={controlStyles.menuItemText}>{getLanguageName(track.language)}</Text>
                  {currentAudioTrack === track && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Caption Selection Modal */}
      <Modal
        visible={showTextMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTextMenu(false)}
      >
        <TouchableOpacity
          style={controlStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTextMenu(false)}
        >
          <View style={controlStyles.menuContainer}>
            <Text style={controlStyles.menuTitle}>Captions</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[controlStyles.menuItem, currentTextTrack === null && controlStyles.menuItemSelected]}
                onPress={() => handleTextTrackChange(null)}
              >
                <Text style={controlStyles.menuItemText}>Off</Text>
                {currentTextTrack === null && <Ionicons name="checkmark" size={20} color="#007AFF" />}
              </TouchableOpacity>
              {availableTextTracks.map((track, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[controlStyles.menuItem, currentTextTrack === track && controlStyles.menuItemSelected]}
                  onPress={() => handleTextTrackChange(track)}
                >
                  <Text style={controlStyles.menuItemText}>{getLanguageName(track.language)}</Text>
                  {currentTextTrack === track && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom bar container - consumes touches to prevent toggling UI when interacting with controls */}
      <View
        style={controlStyles.bottomBar}
        onStartShouldSetResponder={() => true}
        pointerEvents="auto"
      >
        <TouchableOpacity onPress={onPlayPause} style={controlStyles.smallControlBtn}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="white" />
        </TouchableOpacity>

        <Text style={controlStyles.timeText}>
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </Text>

        <View
          style={{ flex: 1 }}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width - 24)} // Subtract margins
        >
          {isSeeking && (
            <ScrubbingPreview
              videoUri={videoUri}
              duration={duration || 0}
              scrubX={scrubX}
              isScrubbing={isScrubbing}
              containerWidth={progressBarWidth}
              colors={colors}
            />
          )}
          <ProgressBar
            progress={progress}
            onSeek={onSeek}
            duration={duration || 0}
            onIsInteracting={onIsInteracting}
            onScrubToggle={onScrubToggle}
            scrubX={scrubX}
            isScrubbing={isScrubbing}
            setIsSeeking={setIsSeeking}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={controlStyles.smallControlBtn}>
            <Ionicons name="settings-outline" size={22} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onToggleFullscreen} style={controlStyles.smallControlBtn}>
            <Ionicons name={isLandscape ? "contract-outline" : "scan-outline"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- Video Content Component ---
const VideoContent = ({ mediaItem, isActive, onToggleUI, videoStates, dimensions, controlsVisible, controlsOpacity, isZoomed }) => {
  const { colors } = useTheme();
  const [videoUri, setVideoUri] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showAlert } = useDialog();

  const [isPlaying, setIsPlaying] = useState(videoStates?.current?.[mediaItem.id]?.isPlaying || false);
  const [hasInteracted, setHasInteracted] = useState(!!videoStates?.current?.[mediaItem.id] || false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [shouldShowVideo, setShouldShowVideo] = useState(!!videoStates?.current?.[mediaItem.id] || false);

  const [currentTime, setCurrentTime] = useState(videoStates?.current?.[mediaItem.id]?.currentTime || 0);
  const [duration, setDuration] = useState(0);
  const hasRestoredRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

  // 1. Resolve URI
  useEffect(() => {
    let isMounted = true;
    const loadUri = async () => {
      try {
        let uri = null;
        const isVault = mediaItem.id && mediaItem.id.toString().startsWith('vault_');
        const isTrash = mediaItem.isTrash || mediaItem.isAppTrash;
        let initialUri = (isVault || isTrash)
          ? (mediaItem.filePath || mediaItem.uri || mediaItem.localUri)
          : (mediaItem.uri || mediaItem.localUri || mediaItem.filePath);

        if (isVault || isTrash) {
          uri = initialUri;
        } else if (mediaItem.id && !mediaItem.id.toString().startsWith('picked_') && !mediaItem.id.toString().startsWith('temp_')) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            try {
              const asset = await MediaLibrary.getAssetInfoAsync(mediaItem.id);
              if (asset) {
                uri = (Platform.OS === 'android') ? (asset.uri || asset.localUri) : (asset.localUri || asset.uri);
              } else {
                uri = initialUri;
              }
            } catch (err) {
              uri = initialUri;
            }
          } else {
            uri = initialUri;
          }
        } else {
          uri = initialUri;
        }

        if (isMounted) {
          if (uri) {
            setVideoUri(uri);
            setIsReady(true);
          } else {
            setLoadError(true);
          }
        }
      } catch (e) {
        console.error("VideoContent: Error resolving URI", e);
        if (isMounted) setLoadError(true);
      }
    };
    loadUri();
    return () => { isMounted = false; };
  }, [mediaItem.id]);

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
  });

  // Handle source updates reactively
  useEffect(() => {
    if (player && videoUri) {
      console.log(`VideoContent: Updating player source to ${videoUri}`);
      player.replace(videoUri);
      
      // Auto-play if component is already active
      if (isActive) {
        console.log('VideoContent: Auto-playing after source update');
        player.play();
        setShouldShowVideo(true);
        setHasInteracted(true);
      }
    }
  }, [player, videoUri, isActive]);

  const availableAudioTracks = player?.availableAudioTracks || [];
  const currentAudioTrack = player?.selectedAudioTrack || null;
  const availableTextTracks = player?.availableSubtitleTracks || [];
  const currentTextTrack = player?.selectedSubtitleTrack || null;

  // 2. Lifecycle Sync
  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
      setShouldShowVideo(true);
      setHasInteracted(true);
    } else {
      player.pause();
    }
  }, [player, isActive]);

  // 3. Listeners & Time Tracking
  useEffect(() => {
    if (!player) return;

    let interval;

    // Time Tracking Listener - Primary source
    const timeUpdateSub = player.addListener('timeUpdate', ({ currentTime: pos }) => {
      // expo-video provides seconds (float)
      setCurrentTime(pos);
      if (videoStates?.current?.[mediaItem.id]) {
        videoStates.current[mediaItem.id].currentTime = pos;
      }
    });

    // Playback State Tracking
    const playingSub = player.addListener('playingChange', ({ isPlaying: isPlayingNow }) => {
      console.log(`VideoContent: playingChange: ${isPlayingNow}`);
      setIsPlaying(isPlayingNow);
      
      if (videoStates?.current?.[mediaItem.id]) {
        videoStates.current[mediaItem.id].isPlaying = isPlayingNow;
      }

      // Start/Stop fallback polling for smoother UI timer
      if (isPlayingNow) {
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
          if (player && player.playing) {
            setCurrentTime(player.currentTime);
          }
        }, 500); // Update every 500ms
      } else {
        if (interval) clearInterval(interval);
      }
    });

    // Status Tracking (Duration & Restoration)
    const statusSub = player.addListener('statusChange', ({ status: newStatus }) => {
      console.log(`VideoContent: statusChange: ${newStatus}`);
      if (newStatus === 'readyToPlay') {
        if (player.duration > 0) {
          setDuration(player.duration);
        }
        
        // Safe Restoration Logic
        const cachedTime = videoStates?.current?.[mediaItem.id]?.currentTime;
        if (cachedTime > 0.1 && !hasRestoredRef.current) {
          console.log(`VideoContent: Restoring playback to ${cachedTime}`);
          // Use a small delay to ensure player is truly ready for seeking
          setTimeout(() => {
            if (player) {
              player.seekBy(cachedTime - player.currentTime);
              hasRestoredRef.current = true;
            }
          }, 100);
        }
      }
    });

    // Initial Sync
    if (player.duration > 0) {
      setDuration(player.duration);
    }
    
    // Set initial playing state
    setIsPlaying(player.playing);
    if (player.playing) {
      interval = setInterval(() => {
        if (player) setCurrentTime(player.currentTime);
      }, 500);
    }

    return () => {
      timeUpdateSub.remove();
      playingSub.remove();
      statusSub.remove();
      if (interval) clearInterval(interval);
    };
  }, [player, videoUri, mediaItem.id]);

  useFocusEffect(
    useCallback(() => {
      const handleAppStateChange = (nextAppState) => {
        if (nextAppState.match(/inactive|background/) && player) {
          player.pause();
        }
      };
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription.remove();
    }, [player])
  );

  // 4. Handlers
  const togglePlay = () => {
    if (!player) return;
    const currentlyPlaying = player.playing;
    console.log(`VideoContent: togglePlay (current: ${currentlyPlaying})`);
    if (currentlyPlaying) {
      player.pause();
    } else {
      player.play();
    }
    if (!hasInteracted) setHasInteracted(true);
  };

  const handleAudioSelect = (track) => player?.setAudioTrack(track);
  const handleTextSelect = (track) => player?.setSubtitleTrack(track);
  const handleRewind10 = () => player?.seekBy(-10);
  const handleForward10 = () => player?.seekBy(10);
  const handleSeek = (timeInSeconds) => {
    if (player) {
      player.seekBy(timeInSeconds - player.currentTime);
      setCurrentTime(timeInSeconds);
    }
  };

  const handleScrubToggle = (isScrubbing) => {
    if (!player) return;
    if (isScrubbing) {
      wasPlayingBeforeScrubRef.current = isPlaying;
      player.pause();
    } else if (wasPlayingBeforeScrubRef.current) {
      player.play();
    }
  };

  const toggleFullscreen = async () => {
    try {
      const orientation = await ScreenOrientation.getOrientationAsync();
      if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP || orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch (e) {
      showAlert('Error', 'Failed to toggle fullscreen');
    }
  };

  const videoBoxStyle = useMemo(() => ({
    width: dimensions.width,
    height: dimensions.height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  }), [dimensions.width, dimensions.height]);

  const videoControlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  if (loadError) {
    return (
      <View style={{ width: dimensions.width, height: dimensions.height, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color="white" />
        <Text style={{ color: 'white', marginTop: 10 }}>Failed to load video</Text>
      </View>
    );
  }

  if (!isReady || !videoUri) {
    return <View style={{ width: dimensions.width, height: dimensions.height, backgroundColor: '#000' }} />;
  }

  return (
    <View style={videoBoxStyle}>
      {/* Background Video Layer - Centered via videoBoxStyle flex */}
      {shouldShowVideo && (
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          nativeControls={false}
        />
      )}

      {/* PHASE 2: STATIC THUMBNAIL OVERLAY (Shown until video is mounted) */}
      {!shouldShowVideo && (
        <ImageContent
          mediaItem={mediaItem}
          isActive={isActive}
          onZoomChange={() => { }}
          onToggleUI={onToggleUI}
          refreshKey={mediaItem.id}
          dimensions={dimensions}
          isZoomed={isZoomed}
        />
      )}

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
            videoUri={videoUri}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            duration={duration}
            currentTime={currentTime}
            onToggleFullscreen={toggleFullscreen}
            visible={true}
            onSeek={handleSeek}
            isLandscape={dimensions.width > dimensions.height}
            onIsInteracting={setIsInteracting}
            onScrubToggle={handleScrubToggle}
            colors={colors}
            availableAudioTracks={availableAudioTracks}
            currentAudioTrack={currentAudioTrack}
            onAudioSelect={handleAudioSelect}
            availableTextTracks={availableTextTracks}
            currentTextTrack={currentTextTrack}
            onTextSelect={handleTextSelect}
          />
        </Animated.View>
      )}
    </View >
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
const MediaItem = React.memo(({ mediaItem, index, isActive, isNear, onZoomChange, onToggleUI, refreshKey, videoStates, dimensions, controlsVisible, controlsOpacity, isZoomed }) => {
  const isVideo = isVideoItem(mediaItem);

  if (isVideo) {
    // PHASE 2 AGGRESSIVE RESOURCE MANAGEMENT:
    // ONLY render VideoContent for the active item.
    // Neighbors (isNear && !isActive) ONLY show a static thumbnail.
    // This ensures strictly ONE VideoPlayer/VideoView exists at any time.
    if (!isActive) {
      return (
        <ImageContent
          mediaItem={mediaItem}
          isActive={false}
          onZoomChange={() => { }}
          onToggleUI={onToggleUI}
          refreshKey={refreshKey}
          dimensions={dimensions}
          isZoomed={false}
        />
      );
    }

    return (
      <VideoContent
        mediaItem={mediaItem}
        isActive={isActive}
        onToggleUI={onToggleUI}
        videoStates={videoStates}
        dimensions={dimensions}
        controlsVisible={controlsVisible}
        controlsOpacity={controlsOpacity}
        isZoomed={isZoomed}
      />
    );
  }

  return (
    <ImageContent
      mediaItem={mediaItem}
      isActive={isActive}
      onZoomChange={onZoomChange}
      onToggleUI={onToggleUI}
      refreshKey={refreshKey}
      dimensions={dimensions}
    />
  );
}, (prev, next) => {
  return prev.mediaItem.id === next.mediaItem.id &&
    prev.isActive === next.isActive &&
    prev.isNear === next.isNear && // Important for memory gating
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
  
  // Debug Log output exactly matching requested schema
  const currentItemSnapshot = mediaItems[currentIndex];
  useEffect(() => {
    if (currentItemSnapshot) {
      console.log("Opened:", currentItemSnapshot.id, currentItemSnapshot.uri);
    }
  }, [currentIndex, currentItemSnapshot]);
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

  // Configure Audio for Video - Removed conflict with expo-video
  /*
  useEffect(() => {
    // We set this once to allow playback in silence mode
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    }).catch(e => console.warn("Audio mode error", e));
  }, []);
  */

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  useEffect(() => {
    if (initialIndex !== undefined && flatListRef.current && mediaItems.length > initialIndex) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [initialIndex, mediaItems.length]);

  // Scroll position is now handled directly in the dimension change listener
  // This effect is removed to prevent redundant scroll corrections

  const currentItem = mediaItems[currentIndex];

  // Preload adjacent images to keep paging smooth.
  useEffect(() => {
    const nearbyUris = [currentIndex - 1, currentIndex + 1]
      .map((index) => mediaItems[index])
      .filter((item) => item && !isVideoItem(item))
      .map((item) => item.uri || item.localUri || item.filePath)
      .filter(Boolean);

    if (nearbyUris.length > 0) {
      Image.prefetch(nearbyUris).catch(() => { });
    }
  }, [currentIndex, mediaItems]);

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
    .failOffsetX([-20, 20]) // Quickly fail on horizontal intent so FlatList swipe wins
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
    // Logic for aggressive memory management
    const isNear = Math.abs(index - currentIndex) <= 1;

    return (
      <MediaItem
        key={item.id}
        mediaItem={item}
        index={index}
        isActive={index === currentIndex}
        isNear={isNear} // Pass memory gating flag
        onZoomChange={setIsZoomed}
        onToggleUI={toggleControls}
        refreshKey={refreshKey}
        videoStates={videoStates}
        dimensions={dimensions}
        controlsVisible={controlsVisible}
        controlsOpacity={controlsOpacity}
        isZoomed={isZoomed}
      />
    );
  }, [currentIndex, toggleControls, refreshKey, dimensions, controlsVisible, videoStates, controlsOpacity, isZoomed]);

  const getItemLayout = useCallback((data, index) => ({
    length: dimensions.width,
    offset: dimensions.width * index,
    index
  }), [dimensions.width]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    // Only update index if NOT rotating to prevent jumping
    if (!isRotatingRef.current && viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndexRef.current) {
        setCurrentIndex(newIndex);
        setIsZoomed(false); // Reset zoom state when moving to a new item
      }
    }
  }).current;

  const handleMomentumScrollEnd = useCallback((event) => {
    if (isRotatingRef.current) return;

    const offsetX = event.nativeEvent?.contentOffset?.x ?? 0;
    const pageWidth = dimensions.width || 1;
    const newIndex = Math.max(0, Math.min(mediaItems.length - 1, Math.round(offsetX / pageWidth)));

    if (newIndex !== currentIndexRef.current) {
      setCurrentIndex(newIndex);
      setIsZoomed(false);
    }
  }, [dimensions.width, mediaItems.length]);

  // Use dynamic dimensions for proper orientation handling
  const { width: screenWidth, height: screenHeight } = dimensions;
  const styles = useMemo(() => getStyles(screenWidth, screenHeight), [screenWidth, screenHeight]);

  const flatListStyle = useAnimatedStyle(() => ({
    opacity: rotationOpacity.value,
  }));

  if (!currentItem && mediaItems.length === 0) return null;
  const isPhoto = currentItem && !isVideoItem(currentItem);

  return (
      <View style={styles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, flatListStyle]}>
          <FlatList
            ref={flatListRef}
            data={mediaItems}
            renderItem={renderItem}
            keyExtractor={item => item.id?.toString() || Math.random().toString()}
            horizontal
            pagingEnabled
            directionalLockEnabled
            bounces={false}
            overScrollMode="never"
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex && mediaItems.length > initialIndex ? initialIndex : 0}
            removeClippedSubviews={true}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            onScrollToIndexFailed={info => {
              const wait = new Promise(resolve => setTimeout(resolve, 300));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
              });
            }}
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
  // Scrubbing Preview
  previewContainer: {
    position: 'absolute',
    width: 120,
    height: 80,
    bottom: 60, // Positioned above the progress bar container
    zIndex: 1000,
    pointerEvents: 'none',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  previewTimeOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
  },
  previewTimeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  previewArrow: {
    position: 'absolute',
    bottom: -6,
    left: 60 - 6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  progressBarThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    top: '50%',
    marginTop: -6,
    marginLeft: -6,
  },
});

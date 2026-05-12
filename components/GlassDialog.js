import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Pressable, BackHandler } from 'react-native';
import SafeBlurView from './SafeBlurView';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const GlassDialog = ({ visible, title, message, actions = [], type = 'info', onDismiss }) => {
  const { colors, isDarkMode } = useTheme();
  
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withTiming(1, { duration: 220 });
      opacity.value = withTiming(1, { duration: 220 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);


  // Handle Android Back Button
  useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (onDismiss) onDismiss();
        return true;
      });
      return () => backHandler.remove();
    }
  }, [visible, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;


  const getTypeIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#4CD964' };
      case 'error': return { name: 'alert-circle', color: '#FF3B30' };
      case 'warning': return { name: 'warning', color: '#FF9500' };
      case 'info':
      default: return { name: 'information-circle', color: '#007AFF' };
    }
  };

  const icon = getTypeIcon();

  const handleAction = (onPress) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) onPress();
  };


  // Separate actions: Cancel at bottom, others together
  const cancelActions = actions.filter(a => a.style === 'cancel' || a.text.toLowerCase() === 'cancel');
  const mainActions = actions.filter(a => a.style !== 'cancel' && a.text.toLowerCase() !== 'cancel');

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onDismiss}
      animationType="none"
    >
      <View style={styles.container}>
        {/* Backdrop View - Dark semi-transparent overlay */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.fullScreen} onPress={onDismiss} />
        </Animated.View>

        {/* Animated Dialog Body */}
        <Animated.View style={[styles.dialogBody, animatedStyle]}>
          {/* Main Glass Surface using hardware-accelerated SafeBlurView */}
          <SafeBlurView 
            intensity={isDarkMode ? 50 : 70} 
            tint={isDarkMode ? "dark" : "light"} 
            experimentalBlurMethod="dimezisBlurView"
            style={[
              styles.blurContainer,
              { 
                backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.12)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)'
              }
            ]}
          >

            {/* Very subtle glass highlight */}
            <View style={StyleSheet.absoluteFill}>
              <Svg height="100%" width="100%">
                <Defs>
                  <SvgGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={isDarkMode ? "white" : "white"} stopOpacity={isDarkMode ? "0.05" : "0.1"} />
                    <Stop offset="0.5" stopColor="white" stopOpacity="0.02" />
                    <Stop offset="1" stopColor="white" stopOpacity={isDarkMode ? "0.03" : "0.05"} />
                  </SvgGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#glassSheen)" />
              </Svg>
            </View>
            
            <View style={styles.content}>

              {/* Type Icon & Heading */}
              <View style={styles.headerRow}>
                <Ionicons name={icon.name} size={42} color={icon.color} style={styles.typeIcon} />
                {title && <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>{title}</Text>}
              </View>

              {message && <Text style={[styles.message, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#000000' }]}>{message}</Text>}


              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {mainActions.length > 0 && (
                  <View style={styles.row}>
                    {mainActions.map((action, index) => (
                      <TouchableOpacity
                        key={`main-${index}`}
                        style={[
                          styles.capsuleButton, 
                          { backgroundColor: action.style === 'destructive' ? '#EB5757' : '#2F80ED', flex: 1 },
                          styles.shadowProps
                        ]}
                        onPress={() => handleAction(action.onPress)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actionText, { color: '#FFFFFF' }]} numberOfLines={1}>
                          {action.text}
                        </Text>
                      </TouchableOpacity>
                    ))}

                  </View>
                )}

                {cancelActions.map((action, index) => (
                  <TouchableOpacity
                    key={`cancel-${index}`}
                    style={[
                      styles.capsuleButton, 
                      styles.cancelButton, 
                      styles.shadowProps,
                      { 
                        marginTop: mainActions.length > 0 ? 12 : 0,
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#444444'
                      }
                    ]}
                    onPress={() => handleAction(action.onPress)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionText, { color: '#FFFFFF' }]}>
                      {action.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SafeBlurView>
        </Animated.View>
      </View>
    </Modal>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },


  dialogBody: {
    width: "85%",
    minHeight: 220,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',

  },





  gradientOverlay: {
    opacity: 0.15, // Subtle overlay to enhance glass sheen
  },
  content: {
    padding: 20,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  typeIcon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  message: {
    fontSize: 14,
    color: '#000000',
    opacity: 0.85,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 28,
  },

  actionsContainer: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  capsuleButton: {
    height: 48,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cancelButton: {
    backgroundColor: '#444444',
    width: '100%',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  shadowProps: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default GlassDialog;



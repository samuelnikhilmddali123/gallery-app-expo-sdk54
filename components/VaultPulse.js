import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate,
} from 'react-native-reanimated';

/**
 * ✨ VaultPulse - Pure Photo Vortex
 * A continuous 3D horizontal stream of photos with no central icon.
 * Minimalist, mysterious, and premium.
 */
const PHOTO_SIZE = 8; // Slightly larger since there's no central icon
const ORBIT_RADIUS_X = 14;
const ORBIT_RADIUS_Y = 4;

const PhotoParticle = ({ index, rotation, uri }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Stagger 5 photos for a fuller vortex
    const phase = (index * 0.2);
    const val = (rotation.value + phase) % 1;
    const angle = val * Math.PI * 2;
    
    // 3D Horizontal Orbit
    const x = Math.cos(angle) * ORBIT_RADIUS_X;
    const y = Math.sin(angle) * ORBIT_RADIUS_Y;
    
    // Depth Simulation
    const scale = interpolate(Math.sin(angle), [-1, 1], [0.5, 1.3]);
    const opacity = interpolate(Math.sin(angle), [-1, 0, 1], [0.15, 0.6, 1]);
    const zIndex = Math.sin(angle) > 0 ? 3 : 1;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: scale },
        { rotate: `${val * 360}deg` }
      ],
      opacity: opacity,
      zIndex: zIndex,
    };
  });

  return (
    <Animated.View style={[styles.photoContainer, animatedStyle]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
      ) : (
        <View style={styles.photoFallback} />
      )}
    </Animated.View>
  );
};

const VaultPulse = ({ vaultMedia = [] }) => {
  const rotation = useSharedValue(0);

  // Use 5 photos for a rich, continuous vortex
  const displayMedia = Array(5).fill(null).map((_, i) => {
    if (vaultMedia && vaultMedia.length > 0) {
      return vaultMedia[i % vaultMedia.length]?.uri;
    }
    return null;
  });

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { 
        duration: 4000, 
        easing: Easing.linear 
      }),
      -1,
      false
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* The Photo Vortex */}
      {displayMedia.map((uri, i) => (
        <PhotoParticle key={i} index={i} rotation={rotation} uri={uri} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  photoContainer: {
    position: 'absolute',
    width: PHOTO_SIZE,
    height: PHOTO_SIZE + 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    borderWidth: 0.4,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: '#222',
    // Subtle shadow for depth
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  }
});

export default VaultPulse;

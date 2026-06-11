import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  interpolateColor,
  useDerivedValue,
  withSequence
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

const AnimatedRainbowSearchIcon = ({ size = 20 }) => {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Continuous color cycle
    progress.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1, // infinite
      false // don't reverse, just loop 0->1
    );

    // Subtle breathing pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 0.2, 0.4, 0.6, 0.8, 1],
      [
        '#7B61FF', // Purple
        '#FF61D2', // Pink
        '#61A5FF', // Blue
        '#61FFF7', // Cyan
        '#A561FF', // Violet
        '#7B61FF', // Back to Purple
      ]
    );

    return {
      color,
      transform: [{ scale: pulse.value }],
      textShadowColor: color,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    };
  });

  return (
    <AnimatedIonicons
      name="search"
      size={size}
      style={animatedStyle}
    />
  );
};

export default React.memo(AnimatedRainbowSearchIcon);

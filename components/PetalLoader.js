import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing
} from 'react-native-reanimated';

/**
 * ✨ PetalLoader (Balanced Sequential Glass Version)
 * Adjusted speed for a more elegant and steady sequential rotation.
 */
const PETAL_COUNT = 6;
const SIZE = 24;
const RADIUS = 9;
const PETAL_W = 6;
const PETAL_H = 8.5;

const Petal = ({ index, rotation }) => {
  const angle = (index * 360) / PETAL_COUNT;
  const rad = (angle * Math.PI) / 180;
  
  const x = Math.cos(rad) * RADIUS;
  const y = Math.sin(rad) * RADIUS;

  const petalStyle = useAnimatedStyle(() => {
    const step = 1 / PETAL_COUNT;
    const start = index * step;
    const end = (index + 1) * step;
    
    let progress = 0;
    if (rotation.value >= start && rotation.value < end) {
      progress = (rotation.value - start) / step;
    }

    return {
      backgroundColor: 'rgba(255, 255, 255, 0.35)',
      opacity: 0.9,
      transform: [
        { rotate: `${(progress * 360) + angle + 45}deg` }
      ],
      shadowOpacity: 0.4,
    };
  });

  return (
    <Animated.View 
      style={[
        styles.petal,
        {
          width: PETAL_W,
          height: PETAL_H,
          left: SIZE / 2 + x - PETAL_W / 2,
          top: SIZE / 2 + y - PETAL_H / 2,
        },
        petalStyle
      ]}
    />
  );
};

const PetalLoader = () => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { 
        duration: 2400, // Balanced speed: 0.4s per petal (2.4s total cycle)
        easing: Easing.linear 
      }),
      -1,
      false
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {[...Array(PETAL_COUNT)].map((_, i) => (
          <Petal key={i} index={i} rotation={rotation} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  inner: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
  },
  petal: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 2,
    elevation: 2,
  },
});

export default PetalLoader;

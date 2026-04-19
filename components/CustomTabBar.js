import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';

const BUBBLE_SIZE = 44;

// Safety fallback for environments where BlurView is not supported or native code is missing
const SafeBlurView = ({ children, style, intensity, tint }) => {
  try {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  } catch (e) {
    return (
      <View style={[style, { backgroundColor: tint === 'dark' ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)' }]}>
        {children}
      </View>
    );
  }
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { isDarkMode } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (containerWidth > 0) {
      const tabWidth = containerWidth / state.routes.length;
      const targetX = tabWidth * state.index + (tabWidth - BUBBLE_SIZE) / 2;
      
      translateX.value = withSpring(targetX, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [state.index, containerWidth]);

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View style={styles.floatingContainer} onLayout={onLayout}>
      <SafeBlurView
        intensity={50}
        tint="dark"
        style={styles.blurWrapper}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.bubble, animatedBubbleStyle]} />
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            let iconName;
            if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
            else if (route.name === 'Profile') iconName = isFocused ? 'person' : 'person-outline';

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.tabButton}
              >
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeBlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    width: '40%',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 999,
  },
  blurWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomTabBar;

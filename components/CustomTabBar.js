import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import SafeBlurView from './SafeBlurView';

const BUBBLE_SIZE = 48;

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
    <View style={styles.floatingContainer}>
      <SafeBlurView
        intensity={50}
        tint="dark"
        style={styles.blurWrapper}
      >
        <View style={styles.content} onLayout={onLayout}>
          <Animated.View style={[styles.bubble, animatedBubbleStyle]} />
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              // Trigger haptic feedback
              Haptics.selectionAsync();

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
            else if (route.name === 'Albums') iconName = isFocused ? 'images' : 'images-outline';
            else if (route.name === 'Weather') iconName = isFocused ? 'cloudy' : 'cloudy-outline';

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
    bottom: 24,
    alignSelf: 'center',
    width: '65%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
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
    top: '50%',
    marginTop: -BUBBLE_SIZE / 2,
    backgroundColor: 'rgba(123, 97, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(123, 97, 255, 0.4)',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomTabBar;

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing,
    withSequence
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export default function WeatherMiniIcon({ iconId, size = 20, color = '#FFFFFF' }) {
    const isNight = iconId?.includes('n');
    const type = iconId?.substring(0, 2) || '01';

    const rotation = useSharedValue(0);
    const float = useSharedValue(0);

    useEffect(() => {
        // Subtle slow rotation for sun/moon
        rotation.value = withRepeat(
            withTiming(360, { duration: 15000, easing: Easing.linear }),
            -1, false
        );
        // Gentle float for clouds
        float.value = withRepeat(
            withSequence(
                withTiming(2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1, true
        );
    }, []);

    const rotationStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    const floatStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: float.value }]
    }));

    // Mapping condition type to icons
    switch (type) {
        case '01': // Clear
            return (
                <Animated.View style={rotationStyle}>
                    <Ionicons name={isNight ? 'moon' : 'sunny'} size={size} color={isNight ? '#E2E8F0' : '#FFD700'} />
                </Animated.View>
            );
        case '02': // Partly cloudy
            return (
                <View style={styles.container}>
                    <Animated.View style={[{ position: 'absolute', top: -2, right: -2 }, rotationStyle]}>
                        <Ionicons name={isNight ? 'moon' : 'sunny'} size={size * 0.7} color={isNight ? '#E2E8F0' : '#FFD700'} />
                    </Animated.View>
                    <Animated.View style={floatStyle}>
                        <Ionicons name="cloud" size={size * 0.8} color="#FFFFFF" />
                    </Animated.View>
                </View>
            );
        case '03':
        case '04':
        case '50': // Cloudy / Mist
            return (
                <Animated.View style={floatStyle}>
                    <Ionicons name="cloud" size={size} color="#FFFFFF" />
                </Animated.View>
            );
        case '09':
        case '10': // Rain
            return (
                <View style={styles.container}>
                    <Animated.View style={floatStyle}>
                        <Ionicons name="cloud" size={size * 0.9} color="#D1D5DB" />
                    </Animated.View>
                    <View style={{ position: 'absolute', bottom: -2 }}>
                        <Ionicons name="water" size={size * 0.4} color="#60A5FA" />
                    </View>
                </View>
            );
        case '11': // Storm
            return (
                <View style={styles.container}>
                    <Animated.View style={floatStyle}>
                        <Ionicons name="cloud" size={size} color="#6B7280" />
                    </Animated.View>
                    <Ionicons name="flash" size={size * 0.5} color="#FBBF24" style={{ position: 'absolute', bottom: -2 }} />
                </View>
            );
        case '13': // Snow
            return (
                <View style={styles.container}>
                    <Animated.View style={floatStyle}>
                        <Ionicons name="cloud" size={size} color="#F3F4F6" />
                    </Animated.View>
                    <Ionicons name="snow" size={size * 0.4} color="#FFFFFF" style={{ position: 'absolute', bottom: -2 }} />
                </View>
            );
        default:
            return <Ionicons name="cloud" size={size} color={color} />;
    }
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 24,
        height: 24,
    }
});

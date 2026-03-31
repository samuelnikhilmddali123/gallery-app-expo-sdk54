import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence, 
    Easing,
    withDelay
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export default function AnimatedWeatherIcon({ conditionCode, size = 120 }) {
    // Condition Code matching OpenWeatherMap (01d, 02d, 03d, 04d, 09d, 10d, 11d, 13d, 50d)
    const isNight = conditionCode?.includes('n');
    const type = conditionCode?.substring(0, 2) || '01';

    // Shared Values
    const rotation = useSharedValue(0);
    const float = useSharedValue(0);
    const rain = useSharedValue(0);
    const flash = useSharedValue(1);

    useEffect(() => {
        // Sun/Moon Rotation
        rotation.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1, false
        );
        // Cloud floating
        float.value = withRepeat(
            withSequence(
                withTiming(15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1, true
        );
        // Rain falling
        rain.value = withRepeat(
            withTiming(size * 0.5, { duration: 800, easing: Easing.linear }),
            -1, false
        );
        // Lightning Flash
        flash.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000 }), // wait
                withTiming(0, { duration: 100 }), // flash out
                withTiming(1, { duration: 100 }), // flash in
                withTiming(0, { duration: 100 }),
                withTiming(1, { duration: 100 })
            ),
            -1, true
        );
    }, []);

    const sunAnimStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    const cloudAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: float.value }]
    }));

    const cloudBgAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: -float.value * 0.5 }]
    }));

    const rainDropStyle1 = useAnimatedStyle(() => ({
        transform: [{ translateY: rain.value }],
        opacity: 1 - (rain.value / (size * 0.5))
    }));
    
    // Create custom staggered drop effect
    const rainDropStyle2 = useAnimatedStyle(() => {
        const offset = (rain.value + size * 0.25) % (size * 0.5);
        return {
            transform: [{ translateY: offset }],
            opacity: 1 - (offset / (size * 0.5))
        };
    });

    const flashAnimStyle = useAnimatedStyle(() => ({
        opacity: flash.value
    }));

    // Rendering based on type
    switch (type) {
        case '01': // Clear
            return (
                <Animated.View style={[styles.container, sunAnimStyle]}>
                    <Ionicons name={isNight ? 'moon' : 'sunny'} size={size} color={isNight ? '#E2E8F0' : '#FFD700'} />
                </Animated.View>
            );
        
        case '02': // Few clouds (Sun + cloud)
            return (
                <View style={styles.container}>
                    <Animated.View style={[{ position: 'absolute', top: -size*0.1, right: -size*0.1 }, sunAnimStyle]}>
                        <Ionicons name={isNight ? 'moon' : 'sunny'} size={size * 0.7} color={isNight ? '#E2E8F0' : '#FFD700'} />
                    </Animated.View>
                    <Animated.View style={[cloudAnimStyle, { zIndex: 2, marginTop: size * 0.3 }]}>
                        <Ionicons name="cloud" size={size * 0.9} color="#ffffff" style={styles.cloudShadow} />
                    </Animated.View>
                </View>
            );
            
        case '03': // Scattered clouds
        case '04': // Broken clouds
        case '50': // Mist
            return (
                <View style={styles.container}>
                    <Animated.View style={[{ position: 'absolute', left: -size*0.2, top: size*0.1, opacity: 0.7 }, cloudBgAnimStyle]}>
                        <Ionicons name="cloud" size={size * 0.7} color="#EAFAFE" />
                    </Animated.View>
                    <Animated.View style={[cloudAnimStyle, { zIndex: 2, marginTop: size * 0.2 }]}>
                        <Ionicons name="cloud" size={size} color="#ffffff" style={styles.cloudShadow} />
                    </Animated.View>
                </View>
            );

        case '09': // Shower rain
        case '10': // Rain
            return (
                <View style={styles.container}>
                    <Animated.View style={[cloudAnimStyle, { zIndex: 2 }]}>
                        <Ionicons name="cloud" size={size} color="#D1D5DB" style={styles.cloudShadow} />
                    </Animated.View>
                    {/* Rain drops */}
                    <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle1}>
                            <View style={[styles.drop, { height: size * 0.2 }]} />
                        </Animated.View>
                    </View>
                    <View style={{ position: 'absolute', left: size * 0.5, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle2}>
                            <View style={[styles.drop, { height: size * 0.2 }]} />
                        </Animated.View>
                    </View>
                    <View style={{ position: 'absolute', left: size * 0.8, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle1}>
                            <View style={[styles.drop, { height: size * 0.2 }]} />
                        </Animated.View>
                    </View>
                </View>
            );

        case '11': // Thunderstorm
            return (
                <View style={styles.container}>
                    <Animated.View style={[cloudAnimStyle, { zIndex: 3 }]}>
                        <Ionicons name="cloud" size={size} color="#6B7280" style={styles.cloudShadow} />
                    </Animated.View>
                    {/* Lightning */}
                    <Animated.View style={[{ position: 'absolute', left: size * 0.4, top: size * 0.5, zIndex: 4 }, flashAnimStyle]}>
                        <Ionicons name="flash" size={size * 0.5} color="#FBBF24" style={styles.lightningShadow} />
                    </Animated.View>
                    {/* Rain */}
                    <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle1}><View style={[styles.drop, { height: size * 0.2, backgroundColor: '#93C5FD' }]} /></Animated.View>
                    </View>
                    <View style={{ position: 'absolute', left: size * 0.7, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle2}><View style={[styles.drop, { height: size * 0.2, backgroundColor: '#93C5FD' }]} /></Animated.View>
                    </View>
                </View>
            );

        case '13': // Snow
            return (
                <View style={styles.container}>
                    <Animated.View style={[cloudAnimStyle, { zIndex: 2 }]}>
                        <Ionicons name="cloud" size={size} color="#F3F4F6" style={styles.cloudShadow} />
                    </Animated.View>
                    {/* Snowflakes */}
                    <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.5, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle1}><Ionicons name="snow" size={size*0.2} color="#fff" /></Animated.View>
                    </View>
                    <View style={{ position: 'absolute', left: size * 0.5, top: size * 0.6, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle2}><Ionicons name="snow" size={size*0.2} color="#fff" /></Animated.View>
                    </View>
                    <View style={{ position: 'absolute', left: size * 0.8, top: size * 0.5, zIndex: 1 }}>
                        <Animated.View style={rainDropStyle1}><Ionicons name="snow" size={size*0.2} color="#fff" /></Animated.View>
                    </View>
                </View>
            );

        default:
            return <Ionicons name="cloud" size={size} color="#ffffff" />;
    }
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    cloudShadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 10 },
        textShadowRadius: 15,
    },
    lightningShadow: {
        textShadowColor: 'rgba(251, 191, 36, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    drop: {
        width: 4,
        borderRadius: 2,
        backgroundColor: '#60A5FA',
    }
});

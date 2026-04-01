import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing, 
    withDelay,
    withSequence
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Extremely realistic real-time rain simulation
const RainDrop = ({ delay, startX, duration, isHeavy }) => {
    const translateY = useSharedValue(-100);
    
    useEffect(() => {
        translateY.value = withDelay(delay, withRepeat(
            withTiming(height + 100, { duration, easing: Easing.linear }),
            -1, false
        ));
    }, []);
    
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }, { rotate: '10deg' }],
        left: startX,
        opacity: isHeavy ? 0.6 : 0.3,
        height: isHeavy ? 40 : 25,
        width: isHeavy ? 2.5 : 1.5,
    }));
    
    return <Animated.View style={[styles.rainDrop, style]} />;
};

// Realistic real-time snow simulation
const SnowFlake = ({ delay, startX, duration, size }) => {
    const translateY = useSharedValue(-50);
    const translateX = useSharedValue(0);
    
    useEffect(() => {
        translateY.value = withDelay(delay, withRepeat(
            withTiming(height + 50, { duration, easing: Easing.linear }),
            -1, false
        ));
        translateX.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(30, { duration: duration / 3, easing: Easing.inOut(Easing.sin) }),
                withTiming(-30, { duration: duration / 3, easing: Easing.inOut(Easing.sin) })
            ),
            -1, true
        ));
    }, []);
    
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
        left: startX,
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity: Math.random() * 0.5 + 0.3,
    }));
    
    return <Animated.View style={[styles.snowFlake, style]} />;
};

// Realistic real-time moving fog/clouds using overlapping deep radial gradients
const CloudLayer = ({ delay, startY, duration, size, reverse }) => {
    const translateX = useSharedValue(reverse ? width + size : -size);
    
    useEffect(() => {
        translateX.value = withDelay(delay, withRepeat(
            withTiming(reverse ? -size * 1.5 : width + size * 1.5, { duration, easing: Easing.linear }),
            -1, false
        ));
    }, []);
    
    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { scaleY: 0.7 } // Make them wider than tall, like typical thick clouds
        ],
        top: startY,
        width: size,
        height: size,
        position: 'absolute',
    }));
    
    return (
        <Animated.View style={style}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Defs>
                    <SvgRadialGradient id={`grad-${size}`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
                        <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
                        <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </SvgRadialGradient>
                </Defs>
                <Circle cx={size/2} cy={size/2} r={size/2} fill={`url(#grad-${size})`} />
            </Svg>
        </Animated.View>
    );
};

// Sun Glow / Halo for clear weather
const SunGlow = () => {
    const scale = useSharedValue(1);
    
    useEffect(() => {
        scale.value = withRepeat(
            withTiming(1.15, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
            -1, true
        );
    }, []);
    
    const style = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value }
        ],
        position: 'absolute',
        top: height * 0.05, // Behind the temperature display
        left: (width - 500) / 2, // Centered horizontally
        width: 500,
        height: 500,
        opacity: 0.8,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
    }));
    
    return (
        <Animated.View style={style} pointerEvents="none">
            <Svg width="500" height="500" viewBox="0 0 500 500">
                <Defs>
                    <SvgRadialGradient id="sunGlowGrad" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.3" />
                        <Stop offset="25%" stopColor="#FFA500" stopOpacity="0.1" />
                        <Stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
                    </SvgRadialGradient>
                </Defs>
                <Circle cx="250" cy="250" r="250" fill="url(#sunGlowGrad)" />
            </Svg>
        </Animated.View>
    );
};

// Drifting light motes / sun beams
const LightMote = ({ delay, startX, startY, duration, size }) => {
    const translateY = useSharedValue(startY);
    const opacity = useSharedValue(0.1);
    
    useEffect(() => {
        translateY.value = withDelay(delay, withRepeat(
            withTiming(startY - 200, { duration, easing: Easing.linear }),
            -1, false
        ));
        opacity.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(0.8, { duration: duration / 2 }),
                withTiming(0.1, { duration: duration / 2 })
            ),
            -1, false
        ));
    }, []);
    
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        left: startX,
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity: opacity.value,
        backgroundColor: '#FFF2C8',
        position: 'absolute',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    }));
    
    return <Animated.View style={style} />;
};

export default function AnimatedWeatherBackground({ conditionCode }) {
    const type = conditionCode?.substring(0, 2) || '01';

    const particles = useMemo(() => {
        const items = [];
        const isRain = type === '09' || type === '10' || type === '11';
        const isSnow = type === '13';
        const isSunny = type === '01';
        const isCloudy = type === '02' || type === '03' || type === '04' || type === '50';

        if (isSunny) {
            // A huge, slowly pulsing beautiful sun halo
            items.push(<SunGlow key="sun_halo" />);
            // Sun flares / light motes drifting upwards
            for (let i = 0; i < 20; i++) {
                items.push(
                    <LightMote 
                        key={`mote-${i}`}
                        delay={Math.random() * 5000}
                        startX={Math.random() * width}
                        startY={height * 0.4 + Math.random() * (height * 0.3)} // bottom-mid drifting up
                        duration={8000 + Math.random() * 6000}
                        size={4 + Math.random() * 8}
                    />
                );
            }
        }

        if (isCloudy || isRain || isSnow) {
            // Background moving fog/clouds for atmosphere
            for (let i = 0; i < 6; i++) {
                items.push(
                    <CloudLayer 
                        key={`cloud-${i}`} 
                        delay={0}
                        startY={Math.random() * (height / 2) - 100}
                        duration={40000 + Math.random() * 40000}
                        size={300 + Math.random() * 300}
                        reverse={i % 2 === 0}
                    />
                );
            }
        }

        if (isRain) {
            // Dense, angled high-speed rain
            for (let i = 0; i < 150; i++) {
                items.push(
                    <RainDrop 
                        key={`rain-${i}`} 
                        delay={Math.random() * 3000} 
                        startX={(Math.random() * width * 1.5) - (width * 0.25)} 
                        duration={500 + Math.random() * 700}
                        isHeavy={i % 4 === 0}
                    />
                );
            }
        } else if (isSnow) {
            // Drifting, soft snow
            for (let i = 0; i < 120; i++) {
                items.push(
                    <SnowFlake 
                        key={`snow-${i}`} 
                        delay={Math.random() * 6000} 
                        startX={Math.random() * width} 
                        duration={4000 + Math.random() * 5000}
                        size={3 + Math.random() * 6}
                    />
                );
            }
        }
        return items;
    }, [conditionCode]);

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {particles}
        </View>
    );
}

const styles = StyleSheet.create({
    rainDrop: {
        position: 'absolute',
        top: -100,
        backgroundColor: '#82A0C2',
        borderRadius: 2,
    },
    snowFlake: {
        position: 'absolute',
        top: -50,
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    cloud: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
    }
});

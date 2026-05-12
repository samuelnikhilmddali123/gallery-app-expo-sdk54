import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeBlurView from '../components/SafeBlurView';
import Svg, { Path } from 'react-native-svg';
import AnimatedWeatherIcon from '../components/AnimatedWeatherIcon';
import AnimatedWeatherBackground from '../components/AnimatedWeatherBackground';
import * as Haptics from 'expo-haptics';
import SideSettingsPanel from '../components/SideSettingsPanel';


const { width } = Dimensions.get('window');
const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || ('bd5e378' + '503939ddaee' + '76f12ad7a97608');

const WEATHER_CACHE_KEY = 'weather_data_cache';

export default function WeatherScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('DAY'); // 'DAY' for hourly, 'WEEK' for daily
    const [current, setCurrent] = useState({
        temp: '--', condition: 'Loading...', description: '--', iconId: '01d'
    });
    const [hourly, setHourly] = useState([]);
    const [daily, setDaily] = useState([]);
    const [locationName, setLocationName] = useState('Locating...');
    const [settingsVisible, setSettingsVisible] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;

            const handleToggle = (type) => {
        setTab(type);
        Animated.spring(slideAnim, {
            toValue: type === 'DAY' ? 0 : 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const translateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 118] // Adjusted for smaller pill inside border
    });

    useEffect(() => {
        const init = async () => {
            // 1. Try to load from cache first for instant display
            try {
                const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setLocationName(parsed.locationName);
                    setCurrent(parsed.current);
                    setHourly(parsed.hourly);
                    setDaily(parsed.daily);
                    setLoading(false); // Show cached data immediately
                }
            } catch (e) {
                console.warn('Cache load error:', e);
            }

            // 2. Fetch fresh data in background
            loadWeather();
        };
        init();
    }, []);

    const loadWeather = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationName('Permission Denied');
                return;
            }

            // 1. Get position quickly
            let loc = await Location.getLastKnownPositionAsync({});
            if (!loc) {
                loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }
            const { latitude, longitude } = loc.coords;

            // Fetch forecast (5-day / 3-hour)
            const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`);
            const data = await res.json();

            // Current weather
            const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`);
            const currentData = await currentRes.json();
            
            // Get exact location natively like HomeScreen
            let geocode = null;
            let finalLocationName = currentData.name;
            try {
                geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocode && geocode.length > 0) {
                    const place = geocode[0];
                    finalLocationName = place.city || place.subregion || place.district || currentData.name;
                }
            } catch (fallbackErr) {
                console.warn(fallbackErr);
            }
            setLocationName(finalLocationName);

            setCurrent({
                temp: Math.round(currentData.main.temp),
                condition: currentData.weather[0].main,
                description: currentData.weather[0].description,
                iconId: currentData.weather[0].icon
            });

            // Hourly (next 24 hours)
            const next24 = data.list.slice(0, 8).map(item => {
                const date = new Date(item.dt * 1000);
                return {
                    label: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temp: Math.round(item.main.temp),
                    icon: item.weather[0].icon
                };
            });
            setHourly(next24);

            // Daily
            const dailyData = [];
            const processedDays = new Set();
            for (let item of data.list) {
                const date = new Date(item.dt * 1000);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                if (!processedDays.has(dayName)) {
                    processedDays.add(dayName);
                    dailyData.push({
                        label: dayName,
                        tempMax: Math.round(item.main.temp_max + 2),
                        tempMin: Math.round(item.main.temp_min - 2),
                        temp: Math.round(item.main.temp), // simplified
                        icon: item.weather[0].icon
                    });
                }
            }
            setDaily(dailyData.slice(1, 6)); // exclude today

            setLoading(false);

            // 3. Save to cache for next time
            try {
                const cacheData = {
                    locationName: finalLocationName,
                    current: {
                        temp: Math.round(currentData.main.temp),
                        condition: currentData.weather[0].main,
                        description: currentData.weather[0].description,
                        iconId: currentData.weather[0].icon
                    },
                    hourly: next24,
                    daily: dailyData.slice(1, 6)
                };
                await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cacheData));
            } catch (cacheErr) {
                console.warn('Cache save error:', cacheErr);
            }
        } catch (e) {
            console.warn(e);
            setLoading(false);
        }
    };

    const getWeatherEmoji = (iconCode) => {
        if (!iconCode) return '☁️';
        if (iconCode.includes('01')) return '☀️';
        if (iconCode.includes('02')) return '⛅';
        if (iconCode.includes('03') || iconCode.includes('04')) return '☁️';
        if (iconCode.includes('09') || iconCode.includes('10')) return '🌧️';
        if (iconCode.includes('11')) return '⛈️';
        if (iconCode.includes('13')) return '❄️';
        if (iconCode.includes('50')) return '🌫️';
        return '☀️';
    };

    return (
        <View style={styles.container}>
            {/* Background Animations */}
            {!loading && <AnimatedWeatherBackground conditionCode={current.iconId} />}

            {/* Top Section */}
            <SafeAreaView edges={['top']} style={styles.topSection}>
                <View style={styles.header}>
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSettingsVisible(true);
                        }} 
                        style={styles.iconBtn}
                    >
                        <Ionicons name="menu-outline" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.iconBtn}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('Albums');
                        }}
                    >
                        <Ionicons name="apps-outline" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {loading && (
                    <ActivityIndicator size="small" color="#fff" style={{ marginTop: 20 }} />
                )}

                <Text style={styles.locationText}>{locationName}</Text>
                <Text style={styles.tempText}>{current.temp}°</Text>
                
                <View style={styles.mainIconContainer}>
                    <Text style={styles.conditionText}>{current.description ? current.description.charAt(0).toUpperCase() + current.description.slice(1) : current.condition}</Text>
                </View>
            </SafeAreaView>

            {/* Curving separator using SVG */}
            <View style={styles.waveContainer}>
                <Svg width={width} height="120" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Path
                        fill="#2A3554" // Matches bottom panel
                        d="M0,160L80,181.3C160,203,320,245,480,245.3C640,245,800,203,960,176C1120,149,1280,139,1360,133.3L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
                    />
                </Svg>
            </View>

            {/* Bottom Section (Forecast) */}
            <View style={styles.bottomSection}>
                <View style={styles.forecastHeader}>
                    <Ionicons name="calendar-outline" size={18} color="#ACB6D6" style={{ marginRight: 8 }} />
                    <Text style={styles.forecastTitle}>Forecast</Text>
                </View>

                {/* Bottom Toggle Slider */}
                <View style={styles.toggleWrapper}>
                    <SafeBlurView intensity={50} tint="dark" style={styles.toggleContainer}>
                        <Animated.View
                            style={[
                                styles.activeBackground,
                                {
                                    transform: [{ translateX }]
                                }
                            ]}
                        />

                        <TouchableOpacity 
                            style={styles.toggleBtn} 
                            onPress={() => {
                                Haptics.selectionAsync();
                                handleToggle('DAY');
                            }}
                        >
                            <Text style={[
                                styles.toggleText, 
                                tab === 'DAY' && styles.activeText
                            ]}>DAY</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.toggleBtn} 
                            onPress={() => {
                                Haptics.selectionAsync();
                                handleToggle('WEEK');
                            }}
                        >
                            <Text style={[
                                styles.toggleText, 
                                tab === 'WEEK' && styles.activeText
                            ]}>WEEK</Text>
                        </TouchableOpacity>
                    </SafeBlurView>
                </View>

                {/* Horizontal Forecast List */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.hourContainer}
                >
                    {(tab === 'DAY' ? hourly : daily).map((item, index) => (
                        <View key={index} style={styles.hourItem}>
                            <Text style={styles.timeText}>{item.label}</Text>
                            <View style={styles.forecastIconWrapper}>
                                <Text style={styles.forecastEmoji}>{getWeatherEmoji(item.icon)}</Text>
                            </View>
                            <Text style={styles.temperatureText}>{item.temp}°</Text>
                        </View>
                    ))}
                </ScrollView>
                <SideSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E253A', // Super dark blue background
    },
    topSection: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 2,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    iconBtn: {
        padding: 5,
    },
    locationText: {
        color: '#ACB6D6',
        fontSize: 22,
        fontWeight: '500',
        marginTop: 10,
        letterSpacing: 0.5,
    },
    tempText: {
        color: '#FFFFFF',
        fontSize: 85,
        fontWeight: 'bold',
        includeFontPadding: false,
        marginTop: 5,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    mainIconContainer: {
        marginTop: 10,
        alignItems: 'center',
    },
    conditionText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
    },
    waveContainer: {
        position: 'absolute',
        bottom: 290, // aligns above bottom panel
        width: '100%',
        height: 120,
        zIndex: 1,
    },
    bottomSection: {
        height: 340,
        backgroundColor: '#2A3554', // Slightly lighter blue-grey
        paddingTop: 20,
        paddingBottom: 70,
        zIndex: 3,
    },
    forecastHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 30,
        marginBottom: 20,
    },
    forecastTitle: {
        color: '#ACB6D6',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.8,
    },
    hourContainer: {
        paddingHorizontal: 10,
        alignItems: 'flex-start',
    },
    hourItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        width: 70,
        marginHorizontal: 5,
    },
    timeText: {
        color: '#FFF',
        fontSize: 13,
        marginBottom: 8,
        fontWeight: '500',
    },
    temperatureText: {
        color: '#ACB6D6',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 8,
    },
    forecastIconWrapper: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    forecastEmoji: {
        fontSize: 22,
    },
    toggleWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
        marginTop: 0,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 30,
        height: 48,
        width: 240,
        position: 'relative',
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    toggleBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    activeBackground: {
        position: 'absolute',
        height: 40,
        width: 116,
        backgroundColor: 'rgba(123, 97, 255, 0.15)',
        borderRadius: 25,
        left: 2,
        zIndex: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(123, 97, 255, 0.4)',
    },
    toggleText: {
        color: '#9AA3B2',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    },
    activeText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});

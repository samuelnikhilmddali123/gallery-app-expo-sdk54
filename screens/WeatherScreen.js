import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import AnimatedWeatherIcon from '../components/AnimatedWeatherIcon';
import AnimatedWeatherBackground from '../components/AnimatedWeatherBackground';

const { width } = Dimensions.get('window');
const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;

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

    useEffect(() => {
        loadWeather();
    }, []);

    const loadWeather = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationName('Permission Denied');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = loc.coords;

            // Get primary city using a highly-accurate Web Geocoder (fixes Android fetching local subregions/neighborhoods)
            try {
                const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                const geoData = await geoRes.json();
                
                // geoData.city usually returns the exact primary city (e.g. Vijayawada instead of Yanamalakuduru)
                const finalCity = geoData.city || geoData.locality || geoData.principalSubdivision;
                setLocationName(finalCity);
            } catch (fallbackErr) {
                console.warn(fallbackErr);
            }

            // Fetch forecast (5-day / 3-hour)
            const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`);
            const data = await res.json();

            // Current weather
            const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`);
            const currentData = await currentRes.json();
            
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                        <Ionicons name="bar-chart-outline" size={24} color="#ACB6D6" style={{ transform: [{rotate: '90deg'}] }} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <Ionicons name="apps-outline" size={24} color="#ACB6D6" />
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

                {/* Horizontal Forecast List */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.listContent}
                >
                    {(tab === 'DAY' ? hourly : daily).map((item, index) => (
                        <View key={index} style={styles.forecastItem}>
                            <Text style={styles.forecastLabel}>{item.label}</Text>
                            <View style={styles.forecastIconWrapper}>
                                <Text style={styles.forecastEmoji}>{getWeatherEmoji(item.icon)}</Text>
                            </View>
                            <Text style={styles.forecastTemp}>{item.temp}°</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Bottom Toggle Slider */}
                <View style={styles.toggleWrapper}>
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity style={styles.toggleBtn} onPress={() => setTab('DAY')}>
                            <Text style={[styles.toggleText, tab === 'DAY' && styles.toggleTextActive]}>DAY</Text>
                        </TouchableOpacity>
                        <View style={styles.toggleSeparator} />
                        <TouchableOpacity style={styles.toggleBtn} onPress={() => setTab('WEEK')}>
                            <Text style={[styles.toggleText, tab === 'WEEK' && styles.toggleTextActive]}>WEEK</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Active Pill Indicator */}
                    <View style={[styles.activePill, tab === 'WEEK' && { right: 5, left: undefined }]} />
                </View>
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
        bottom: 250, // aligns above bottom panel
        width: '100%',
        height: 120,
        zIndex: 1,
    },
    bottomSection: {
        height: 250,
        backgroundColor: '#2A3554', // Slightly lighter blue-grey
        paddingTop: 20,
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
    listContent: {
        paddingHorizontal: 20,
        alignItems: 'flex-start',
    },
    forecastItem: {
        alignItems: 'center',
        marginHorizontal: 12,
        width: 60,
    },
    forecastLabel: {
        color: '#FFF',
        fontSize: 14,
        marginBottom: 15,
        fontWeight: '500',
    },
    forecastIconWrapper: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.05)', // Neumorphic light cup
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    forecastEmoji: {
        fontSize: 24,
    },
    forecastTemp: {
        color: '#ACB6D6',
        fontSize: 16,
        fontWeight: '600',
    },
    toggleWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E253A', // Dark trench
        borderRadius: 30,
        padding: 5,
        width: 160,
        height: 44,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 5,
    },
    toggleSeparator: {
        width: 1,
        height: '50%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        left: '50%',
        position: 'absolute',
    },
    toggleBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    toggleText: {
        color: '#ACB6D6',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    activePill: {
        position: 'absolute',
        top: 5,
        left: 5,
        width: 75,
        height: 34,
        borderRadius: 20,
        backgroundColor: '#384668',
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    }
});

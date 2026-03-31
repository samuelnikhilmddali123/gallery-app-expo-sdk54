import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler, Switch, Alert, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';

const PANEL_WIDTH = 300;
const ANIMATION_DURATION = 350;

export default function SideSettingsPanel({ visible, onClose }) {
    const { isDarkMode, toggleDarkMode, colors, weatherMode, toggleWeatherMode, weatherData } = useTheme();
    const { isVaultSetup, deleteVault } = useVault();
    const navigation = useNavigation();
    const translateX = useSharedValue(PANEL_WIDTH);

    useEffect(() => {
        translateX.value = withTiming(visible ? 0 : PANEL_WIDTH, { duration: ANIMATION_DURATION });
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });
        return () => backHandler.remove();
    }, [visible, onClose]);

    const panelStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, PANEL_WIDTH], [0.5, 0]),
        backgroundColor: '#000',
    }));

    const [shouldRender, setShouldRender] = useState(false);
    useEffect(() => {
        if (visible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), ANIMATION_DURATION);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!shouldRender && !visible) return null;

    const NavItem = ({ icon, label, onPress, color, badge }) => (
        <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => {
                onClose();
                setTimeout(onPress, 150);
            }}
        >
            <View style={styles.navLeft}>
                <View style={[styles.iconBg, { backgroundColor: (color || colors.primary) + '15' }]}>
                    <Ionicons name={icon} size={20} color={color || colors.primary} />
                </View>
                <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {badge && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} opacity={0.3} />
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={shouldRender || visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
                <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                </Animated.View>

                <Animated.View style={[styles.panel, panelStyle, { backgroundColor: colors.surface }]}>
                    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <View style={styles.headerInfo}>
                                <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="images" size={24} color="#fff" />
                                </View>
                                <View>
                                    <Text style={[styles.headerTitle, { color: colors.text }]}>Gallery App</Text>
                                    <Text style={[styles.headerSub, { color: colors.textSecondary }]}>v1.2.5 Premium</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                            <Text style={[styles.sectionTitle, { color: colors.primary }]}>BROWSE</Text>
                            <NavItem icon="home-outline" label="Gallery Home" onPress={() => navigation.navigate('Home')} />
                            <NavItem icon="sparkles-outline" label="AI Smart Albums" onPress={() => navigation.navigate('SmartAlbums')} badge="New" color="#FF61B6" />
                            <NavItem icon="calendar-outline" label="Calendar View" onPress={() => navigation.navigate('Calendar')} />
                            <NavItem icon="trash-outline" label="Recycle Bin" onPress={() => navigation.navigate('Trash')} />
                            <NavItem icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />

                            <View style={styles.divider} />
                            <Text style={[styles.sectionTitle, { color: colors.primary }]}>APPEARANCE</Text>
                            <View style={styles.navItem}>
                                <View style={styles.navLeft}>
                                    <View style={[styles.iconBg, { backgroundColor: colors.border }]}>
                                        <Ionicons name={isDarkMode ? "moon" : "sunny"} size={20} color={colors.text} />
                                    </View>
                                    <Text style={[styles.navLabel, { color: colors.text }]}>Dark Mode</Text>
                                </View>
                                <Switch value={isDarkMode} onValueChange={toggleDarkMode} trackColor={{ false: '#767577', true: colors.primary }} />
                            </View>

                            {/* Weather Theme Toggle */}
                            <View style={styles.navItem}>
                                <TouchableOpacity 
                                    style={styles.navLeft}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        onClose();
                                        setTimeout(() => navigation.navigate('Weather'), 150);
                                    }}
                                >
                                    <View style={[styles.iconBg, { backgroundColor: (weatherMode ? colors.primary : colors.border) + '25' }]}>
                                        <Text style={{ fontSize: 18 }}>
                                            {weatherData ? ({
                                              sunny: '☀️', partlyCloudy: '⛅', cloudy: '☁️',
                                              rainy: '🌧️', stormy: '⛈️', snowy: '❄️',
                                              foggy: '🌫️', night: '🌙'
                                            }[weatherData.themeKey] || '🌤️') : '🌤️'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.navLabel, { color: colors.text }]}>Weather Theme</Text>
                                        {weatherData && weatherMode && (
                                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                                                {weatherData.temperature}°C · {weatherData.cityName}
                                            </Text>
                                        )}
                                        {!weatherMode && (
                                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Off – using manual theme</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                <Switch
                                    value={weatherMode}
                                    onValueChange={toggleWeatherMode}
                                    trackColor={{ false: '#767577', true: colors.primary }}
                                    thumbColor={weatherMode ? colors.primary : '#f4f3f4'}
                                />
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        height: '100%',
        flex: 1
    },
    panel: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderBottomWidth: 1,
    },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    headerSub: { fontSize: 12, opacity: 0.6 },
    closeBtn: { padding: 4 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, marginTop: 20, opacity: 0.8 },
    navItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
    navLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    navLabel: { fontSize: 15, fontWeight: '600' },
    divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.1)', marginVertical: 16 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' }
});

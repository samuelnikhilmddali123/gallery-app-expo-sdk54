import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { fetchWeather, WEATHER_INFO } from '../services/weatherService';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// ─────────────────────────────────────────────────────────────────────────────
// Weather theme colour palettes
// Each key maps to { light, dark } variants so Dark-Mode still works.
// ─────────────────────────────────────────────────────────────────────────────
const WEATHER_PALETTES = {
  sunny: {
    light: {
      background:     '#FFF8E7',
      surface:        '#FFFFFF',
      text:           '#2C1810',
      textSecondary:  '#7A5C45',
      border:         '#FFE0A3',
      searchBar:      '#fff3cd',
      searchText:     '#2C1810',
      searchPlaceholder: '#C9A870',
      icon:           '#E88000',
      itemBackground: '#fff3cd',
      cardBackground: '#FFFFFF',
      tabBarBackground: '#FFF8E7',
      fabColor:       '#FF8C00',
      primary:        '#FF8C00',
      accent:         '#FFE0A3',
      cardShadow:     'rgba(255, 140, 0, 0.18)',
      gradientStart:  '#FFD700',
      gradientEnd:    '#FF8C00',
    },
    dark: {
      background:     '#1A1200',
      surface:        '#2A1F00',
      text:           '#FFE8A0',
      textSecondary:  '#C9A870',
      border:         '#3D2E00',
      searchBar:      '#2A1F00',
      searchText:     '#FFE8A0',
      searchPlaceholder: '#8C6B30',
      icon:           '#FFB300',
      itemBackground: '#2A1F00',
      cardBackground: '#2A1F00',
      tabBarBackground: '#1A1200',
      fabColor:       '#FFB300',
      primary:        '#FFB300',
      accent:         '#3D2E00',
      cardShadow:     'rgba(255, 179, 0, 0.3)',
      gradientStart:  '#3D2E00',
      gradientEnd:    '#1A1200',
    },
  },

  partlyCloudy: {
    light: {
      background:     '#F0F4FF',
      surface:        '#FFFFFF',
      text:           '#1C2340',
      textSecondary:  '#6170A0',
      border:         '#D0D8F0',
      searchBar:      '#E0E8FF',
      searchText:     '#1C2340',
      searchPlaceholder: '#8090C0',
      icon:           '#5060A0',
      itemBackground: '#E8EEFF',
      cardBackground: '#FFFFFF',
      tabBarBackground: '#F0F4FF',
      fabColor:       '#5B8DEF',
      primary:        '#5B8DEF',
      accent:         '#D0D8F0',
      cardShadow:     'rgba(91, 141, 239, 0.12)',
      gradientStart:  '#A0C4FF',
      gradientEnd:    '#5B8DEF',
    },
    dark: {
      background:     '#0D1120',
      surface:        '#1A2040',
      text:           '#C8D8FF',
      textSecondary:  '#7080B0',
      border:         '#2A3560',
      searchBar:      '#1A2040',
      searchText:     '#C8D8FF',
      searchPlaceholder: '#4050A0',
      icon:           '#7090E0',
      itemBackground: '#1A2040',
      cardBackground: '#1A2040',
      tabBarBackground: '#0D1120',
      fabColor:       '#5B8DEF',
      primary:        '#5B8DEF',
      accent:         '#2A3560',
      cardShadow:     'rgba(91, 141, 239, 0.25)',
      gradientStart:  '#2A3560',
      gradientEnd:    '#0D1120',
    },
  },

  cloudy: {
    light: {
      background:     '#EDEEF2',
      surface:        '#F8F9FC',
      text:           '#22262F',
      textSecondary:  '#697080',
      border:         '#D4D8E2',
      searchBar:      '#E0E3EB',
      searchText:     '#22262F',
      searchPlaceholder: '#9298A8',
      icon:           '#555B70',
      itemBackground: '#E4E8F0',
      cardBackground: '#F8F9FC',
      tabBarBackground: '#EDEEF2',
      fabColor:       '#7B8BA0',
      primary:        '#7B8BA0',
      accent:         '#D4D8E2',
      cardShadow:     'rgba(100, 110, 130, 0.12)',
      gradientStart:  '#B0B8C8',
      gradientEnd:    '#7B8BA0',
    },
    dark: {
      background:     '#0E1015',
      surface:        '#18202A',
      text:           '#C8CDD8',
      textSecondary:  '#6A7080',
      border:         '#252D38',
      searchBar:      '#18202A',
      searchText:     '#C8CDD8',
      searchPlaceholder: '#4A5060',
      icon:           '#8090A8',
      itemBackground: '#18202A',
      cardBackground: '#18202A',
      tabBarBackground: '#0E1015',
      fabColor:       '#7B8BA0',
      primary:        '#7B8BA0',
      accent:         '#252D38',
      cardShadow:     'rgba(150, 160, 180, 0.2)',
      gradientStart:  '#252D38',
      gradientEnd:    '#0E1015',
    },
  },

  rainy: {
    light: {
      background:     '#EAF2FB',
      surface:        '#FFFFFF',
      text:           '#1A2840',
      textSecondary:  '#4A6080',
      border:         '#BDD4EA',
      searchBar:      '#D6E8F7',
      searchText:     '#1A2840',
      searchPlaceholder: '#6A90B0',
      icon:           '#1E6FA8',
      itemBackground: '#D6E8F7',
      cardBackground: '#FFFFFF',
      tabBarBackground: '#EAF2FB',
      fabColor:       '#1E6FA8',
      primary:        '#1E6FA8',
      accent:         '#BDD4EA',
      cardShadow:     'rgba(30, 111, 168, 0.15)',
      gradientStart:  '#6EC6FF',
      gradientEnd:    '#1E6FA8',
    },
    dark: {
      background:     '#060E18',
      surface:        '#0D1C2E',
      text:           '#A8C8E8',
      textSecondary:  '#4A6880',
      border:         '#162440',
      searchBar:      '#0D1C2E',
      searchText:     '#A8C8E8',
      searchPlaceholder: '#2A4860',
      icon:           '#3A90D0',
      itemBackground: '#0D1C2E',
      cardBackground: '#0D1C2E',
      tabBarBackground: '#060E18',
      fabColor:       '#3A90D0',
      primary:        '#3A90D0',
      accent:         '#162440',
      cardShadow:     'rgba(58, 144, 208, 0.3)',
      gradientStart:  '#162440',
      gradientEnd:    '#060E18',
    },
  },

  stormy: {
    light: {
      background:     '#E8E8F0',
      surface:        '#F0F0F8',
      text:           '#1A1A30',
      textSecondary:  '#5A5A70',
      border:         '#C0C0D8',
      searchBar:      '#D8D8EC',
      searchText:     '#1A1A30',
      searchPlaceholder: '#8080A0',
      icon:           '#4040A0',
      itemBackground: '#D8D8EC',
      cardBackground: '#F0F0F8',
      tabBarBackground: '#E8E8F0',
      fabColor:       '#6040FF',
      primary:        '#6040FF',
      accent:         '#C0C0D8',
      cardShadow:     'rgba(96, 64, 255, 0.2)',
      gradientStart:  '#8060FF',
      gradientEnd:    '#4020C0',
    },
    dark: {
      background:     '#050510',
      surface:        '#0D0D20',
      text:           '#B0B0E0',
      textSecondary:  '#5050A0',
      border:         '#181838',
      searchBar:      '#0D0D20',
      searchText:     '#B0B0E0',
      searchPlaceholder: '#303060',
      icon:           '#8080D0',
      itemBackground: '#0D0D20',
      cardBackground: '#0D0D20',
      tabBarBackground: '#050510',
      fabColor:       '#8060FF',
      primary:        '#8060FF',
      accent:         '#181838',
      cardShadow:     'rgba(128, 96, 255, 0.4)',
      gradientStart:  '#181838',
      gradientEnd:    '#050510',
    },
  },

  snowy: {
    light: {
      background:     '#F0F6FF',
      surface:        '#FFFFFF',
      text:           '#1A2840',
      textSecondary:  '#6080A0',
      border:         '#C8DDF0',
      searchBar:      '#E0EEF8',
      searchText:     '#1A2840',
      searchPlaceholder: '#7090B0',
      icon:           '#4080C0',
      itemBackground: '#E0EEF8',
      cardBackground: '#FFFFFF',
      tabBarBackground: '#F0F6FF',
      fabColor:       '#60A0E0',
      primary:        '#60A0E0',
      accent:         '#C8DDF0',
      cardShadow:     'rgba(96, 160, 224, 0.15)',
      gradientStart:  '#A8D8FF',
      gradientEnd:    '#60A0E0',
    },
    dark: {
      background:     '#08101C',
      surface:        '#101C30',
      text:           '#C0D8F0',
      textSecondary:  '#5070A0',
      border:         '#182840',
      searchBar:      '#101C30',
      searchText:     '#C0D8F0',
      searchPlaceholder: '#304060',
      icon:           '#6090D0',
      itemBackground: '#101C30',
      cardBackground: '#101C30',
      tabBarBackground: '#08101C',
      fabColor:       '#60A0E0',
      primary:        '#60A0E0',
      accent:         '#182840',
      cardShadow:     'rgba(96, 160, 224, 0.3)',
      gradientStart:  '#182840',
      gradientEnd:    '#08101C',
    },
  },

  foggy: {
    light: {
      background:     '#F0EFEC',
      surface:        '#FAF9F7',
      text:           '#28261E',
      textSecondary:  '#706858',
      border:         '#D8D4C8',
      searchBar:      '#E8E5DE',
      searchText:     '#28261E',
      searchPlaceholder: '#908070',
      icon:           '#706858',
      itemBackground: '#E8E5DE',
      cardBackground: '#FAF9F7',
      tabBarBackground: '#F0EFEC',
      fabColor:       '#8B7D6B',
      primary:        '#8B7D6B',
      accent:         '#D8D4C8',
      cardShadow:     'rgba(100, 90, 80, 0.12)',
      gradientStart:  '#C8C0B0',
      gradientEnd:    '#8B7D6B',
    },
    dark: {
      background:     '#101008',
      surface:        '#1C1C10',
      text:           '#C8C4B0',
      textSecondary:  '#706858',
      border:         '#282818',
      searchBar:      '#1C1C10',
      searchText:     '#C8C4B0',
      searchPlaceholder: '#484838',
      icon:           '#908070',
      itemBackground: '#1C1C10',
      cardBackground: '#1C1C10',
      tabBarBackground: '#101008',
      fabColor:       '#8B7D6B',
      primary:        '#8B7D6B',
      accent:         '#282818',
      cardShadow:     'rgba(140, 130, 110, 0.25)',
      gradientStart:  '#282818',
      gradientEnd:    '#101008',
    },
  },

  night: {
    light: {
      background:     '#0A0A1A',
      surface:        '#14141F',
      text:           '#E0DEFF',
      textSecondary:  '#8080BB',
      border:         '#282840',
      searchBar:      '#1A1A2E',
      searchText:     '#E0DEFF',
      searchPlaceholder: '#5050A0',
      icon:           '#A090F0',
      itemBackground: '#1A1A2E',
      cardBackground: '#14141F',
      tabBarBackground: '#0A0A1A',
      fabColor:       '#9370FF',
      primary:        '#9370FF',
      accent:         '#282840',
      cardShadow:     'rgba(147, 112, 255, 0.3)',
      gradientStart:  '#9370FF',
      gradientEnd:    '#4030A0',
    },
    dark: {
      background:     '#000008',
      surface:        '#080810',
      text:           '#C0BCFF',
      textSecondary:  '#5050A0',
      border:         '#141428',
      searchBar:      '#080810',
      searchText:     '#C0BCFF',
      searchPlaceholder: '#303050',
      icon:           '#8070C0',
      itemBackground: '#080810',
      cardBackground: '#080810',
      tabBarBackground: '#000008',
      fabColor:       '#7060D0',
      primary:        '#7060D0',
      accent:         '#141428',
      cardShadow:     'rgba(112, 96, 208, 0.4)',
      gradientStart:  '#141428',
      gradientEnd:    '#000008',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Default fallback (no weather fetched yet – same as original "light" theme)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_LIGHT = {
  background:     '#f8f9ff',
  surface:        '#ffffff',
  text:           '#1a1c1e',
  textSecondary:  '#6c727a',
  border:         '#eef0f2',
  searchBar:      '#ffffff',
  searchText:     '#000000',
  searchPlaceholder: '#aeb5bc',
  icon:           '#333333',
  itemBackground: '#ffffff',
  cardBackground: '#ffffff',
  tabBarBackground: '#ffffff',
  fabColor:       '#7B61FF',
  primary:        '#7B61FF',
  accent:         '#EBE8FF',
  cardShadow:     'rgba(123, 97, 255, 0.1)',
  gradientStart:  '#7B61FF',
  gradientEnd:    '#5B41DF',
};

const DEFAULT_DARK = {
  background:     '#000000',
  surface:        '#1a1a1a',
  text:           '#ffffff',
  textSecondary:  '#aaaaaa',
  border:         '#333333',
  searchBar:      '#2a2a2a',
  searchText:     '#ffffff',
  searchPlaceholder: '#888888',
  icon:           '#ffffff',
  itemBackground: '#2a2a2a',
  cardBackground: '#1a1a1a',
  tabBarBackground: '#1a1a1a',
  fabColor:       '#7B61FF',
  primary:        '#7B61FF',
  accent:         '#EBE8FF',
  cardShadow:     'rgba(0,0,0,0.5)',
  gradientStart:  '#7B61FF',
  gradientEnd:    '#5B41DF',
};

// How often to refresh weather (30 minutes)
const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [weatherData, setWeatherData] = useState(null); // { themeKey, temperature, description, cityName, isNight }
  const [weatherMode, setWeatherMode] = useState(true);  // Can be toggled by user

  // ── Load persisted prefs ──────────────────────────────────────────────────
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [savedDark, savedWeatherMode] = await Promise.all([
          AsyncStorage.getItem('darkMode'),
          AsyncStorage.getItem('weatherMode'),
        ]);
        if (savedDark !== null) setIsDarkMode(savedDark === 'true');
        if (savedWeatherMode !== null) setWeatherMode(savedWeatherMode === 'true');
      } catch (e) {
        console.error('[ThemeContext] Error loading prefs:', e);
      }
    };
    loadPrefs();
  }, []);

  // ── Fetch weather & keep refreshing ─────────────────────────────────────
  const refreshWeather = useCallback(async () => {
    const data = await fetchWeather();
    if (data) setWeatherData(data);
  }, []);

  useEffect(() => {
    if (!weatherMode) return;
    refreshWeather();
    const interval = setInterval(refreshWeather, WEATHER_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [weatherMode, refreshWeather]);

  // ── Navigation bar sync ──────────────────────────────────────────────────
  useEffect(() => {
    const sync = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const bg = isDarkMode ? '#000000' : '#ffffff';
        await NavigationBar.setBackgroundColorAsync(bg);
        await NavigationBar.setButtonStyleAsync(isDarkMode ? 'light' : 'dark');
      } catch (e) {
        console.error('[ThemeContext] NavBar error:', e);
      }
    };
    sync();
  }, [isDarkMode]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toggleDarkMode = async () => {
    try {
      const next = !isDarkMode;
      setIsDarkMode(next);
      await AsyncStorage.setItem('darkMode', next.toString());
    } catch (e) {
      console.error('[ThemeContext] Error saving darkMode:', e);
      setIsDarkMode(v => !v);
    }
  };

  const toggleWeatherMode = async () => {
    try {
      const next = !weatherMode;
      setWeatherMode(next);
      await AsyncStorage.setItem('weatherMode', next.toString());
      if (next) refreshWeather();
    } catch (e) {
      console.error('[ThemeContext] Error saving weatherMode:', e);
    }
  };

  // ── Resolve current colour set ───────────────────────────────────────────
  const resolveColors = () => {
    if (weatherMode && weatherData?.themeKey) {
      const palette = WEATHER_PALETTES[weatherData.themeKey];
      return palette ? (isDarkMode ? palette.dark : palette.light) : (isDarkMode ? DEFAULT_DARK : DEFAULT_LIGHT);
    }
    return isDarkMode ? DEFAULT_DARK : DEFAULT_LIGHT;
  };

  const colors = resolveColors();

  const theme = {
    isDarkMode,
    toggleDarkMode,
    weatherMode,
    toggleWeatherMode,
    weatherData,
    refreshWeather,
    colors,
    // convenience: emoji + label for current condition
    weatherInfo: weatherData ? {
      ...( require('../services/weatherService').WEATHER_INFO[weatherData.themeKey] || { label: '', emoji: '' }),
      temperature: weatherData.temperature,
      cityName: weatherData.cityName,
      description: weatherData.description,
    } : null,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

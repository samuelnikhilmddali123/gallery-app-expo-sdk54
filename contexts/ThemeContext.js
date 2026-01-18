import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize with default, load async in background (non-blocking)
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Don't block on theme load

  // Load saved theme preference in background
  useEffect(() => {
    // Use setTimeout to not block initial render
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('darkMode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'true');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    // Load theme after initial render
    setTimeout(() => {
      loadTheme();
    }, 0);
  }, []);

  // Save theme preference
  const toggleDarkMode = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('darkMode', newValue.toString());
      console.log('Dark mode toggled to:', newValue);
    } catch (error) {
      console.error('Error saving theme:', error);
      // Revert on error
      setIsDarkMode(!isDarkMode);
    }
  };

  const theme = {
    isDarkMode,
    toggleDarkMode,
    isLoading,
    colors: {
      background: isDarkMode ? '#000000' : '#ffffff',
      surface: isDarkMode ? '#1a1a1a' : '#ffffff',
      text: isDarkMode ? '#ffffff' : '#000000',
      textSecondary: isDarkMode ? '#aaaaaa' : '#666666',
      border: isDarkMode ? '#333333' : '#e0e0e0',
      searchBar: isDarkMode ? '#2a2a2a' : '#f2f2f2',
      searchText: isDarkMode ? '#ffffff' : '#000000',
      searchPlaceholder: isDarkMode ? '#888888' : '#777777',
      icon: isDarkMode ? '#ffffff' : '#333333',
      itemBackground: isDarkMode ? '#2a2a2a' : '#eaeaea',
      cardBackground: isDarkMode ? '#1a1a1a' : '#ffffff',
      tabBarBackground: isDarkMode ? '#1a1a1a' : '#ffffff',
      fabColor: isDarkMode ? '#007AFF' : '#4A90E2',
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};


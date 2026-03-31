import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { VaultProvider, useVault } from './contexts/VaultContext';
import { DialogProvider } from './contexts/DialogContext';
import { AIProvider } from './contexts/AIContext';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';

import HomeScreen from './screens/HomeScreen';
import AlbumsScreen from './screens/AlbumsScreen';
import AlbumViewScreen from './screens/AlbumViewScreen';
import FoldersScreen from './screens/FoldersScreen';
import FolderDetailScreen from './screens/FolderDetailScreen';
import VaultPasswordScreen from './screens/VaultPasswordScreen';
import SettingsScreen from './screens/SettingsScreen';
import ViewerScreen from './screens/ViewerScreen';
import EditPhotoScreen from './screens/EditPhotoScreen';
import TrashScreen from './screens/TrashScreen';
import VaultScreen from './screens/VaultScreen';
import VaultSetupScreen from './screens/VaultSetupScreen';
import ForgotVaultPasswordScreen from './screens/ForgotVaultPasswordScreen';
import ProfileScreen from './screens/ProfileScreen';
import CalendarScreen from './screens/CalendarScreen';
import SmartAlbumsScreen from './screens/SmartAlbumsScreen';
import WeatherScreen from './screens/WeatherScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (focused) {
            if (route.name === 'Home') iconName = 'home';
            else if (route.name === 'Profile') iconName = 'person';
          } else {
            if (route.name === 'Home') iconName = 'home-outline';
            else if (route.name === 'Profile') iconName = 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          height: 75 + insets.bottom,
          paddingBottom: insets.bottom + 15,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isDarkMode } = useTheme();
  const { isVaultSetup, isVaultUnlocked, unlockVault, isLoading } = useVault();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? '#000' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
        <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#000'} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={isDarkMode ? "light" : "dark"} backgroundColor={isDarkMode ? "#000000" : "#ffffff"} />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MainTabs">
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Albums" component={AlbumsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Folders" component={FoldersScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="SmartAlbums" component={SmartAlbumsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="VaultPassword" component={VaultPasswordScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="AlbumView" component={AlbumViewScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="FolderDetail" component={FolderDetailScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Viewer" component={ViewerScreen} options={{ animation: 'fade', contentStyle: { backgroundColor: '#000', flex: 1 }, gestureEnabled: true, headerShown: false, statusBarHidden: true }} />
        <Stack.Screen name="EditPhoto" component={EditPhotoScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
        <Stack.Screen name="Trash" component={TrashScreen} />
        <Stack.Screen name="VaultHome" component={VaultScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="VaultSetup" component={VaultSetupScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="ForgotVaultPassword" component={ForgotVaultPasswordScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="Weather" component={WeatherScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AIProvider>
          <DialogProvider>
            <VaultProvider>
              <AppNavigator />
            </VaultProvider>
          </DialogProvider>
        </AIProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

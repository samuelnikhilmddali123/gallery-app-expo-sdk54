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
import { SearchProvider } from './contexts/SearchContext';
import { VaultProvider, useVault } from './contexts/VaultContext';
import { DialogProvider } from './contexts/DialogContext';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import AlbumsScreen from './screens/AlbumsScreen';
import AlbumViewScreen from './screens/AlbumViewScreen';
import FoldersScreen from './screens/FoldersScreen'; // NEW
import FolderDetailScreen from './screens/FolderDetailScreen'; // NEW
import VaultPasswordScreen from './screens/VaultPasswordScreen';
import SettingsScreen from './screens/SettingsScreen';
import ViewerScreen from './screens/ViewerScreen';
import EditPhotoScreen from './screens/EditPhotoScreen';
import TrashScreen from './screens/TrashScreen';
import VaultScreen from './screens/VaultScreen';
import VaultSetupScreen from './screens/VaultSetupScreen';
import ForgotVaultPasswordScreen from './screens/ForgotVaultPasswordScreen';

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

          if (route.name === 'Photos') {
            iconName = focused ? 'images' : 'images-outline';
          } else if (route.name === 'Albums') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'Folders') {
            iconName = focused ? 'folder' : 'folder-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.icon,
        tabBarInactiveTintColor: colors.searchPlaceholder,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.searchBar,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
        },
      })}
    >
      <Tab.Screen
        name="Photos"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Photos',
        }}
      />
      <Tab.Screen
        name="Albums"
        component={AlbumsScreen}
        options={{
          tabBarLabel: 'Albums',
        }}
      />
      <Tab.Screen
        name="Folders"
        component={FoldersScreen}
        options={{
          tabBarLabel: 'Folders',
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isDarkMode } = useTheme();
  const { isVaultSetup, isVaultUnlocked, unlockVault, isLoading } = useVault();

  // Show loading screen only if vault status is still loading
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
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="MainTabs"
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right'
          }}
        />
        <Stack.Screen
          name="VaultPassword"
          component={VaultPasswordScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="AlbumView"
          component={AlbumViewScreen}
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="FolderDetail"
          component={FolderDetailScreen}
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="Viewer"
          component={ViewerScreen}
          options={{
            animation: 'fade',
            contentStyle: { backgroundColor: '#000', flex: 1 },
            gestureEnabled: true,
            headerShown: false,
            statusBarHidden: true,
          }}
        />
        <Stack.Screen
          name="EditPhoto"
          component={EditPhotoScreen}
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="Trash" component={TrashScreen} />
        <Stack.Screen
          name="VaultHome"
          component={VaultScreen}
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="VaultSetup"
          component={VaultSetupScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="ForgotVaultPassword"
          component={ForgotVaultPasswordScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import * as ScreenOrientation from 'expo-screen-orientation';

export default function App() {
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SearchProvider>
          <DialogProvider>
            <VaultProvider>
              <AppNavigator />
            </VaultProvider>
          </DialogProvider>
        </SearchProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

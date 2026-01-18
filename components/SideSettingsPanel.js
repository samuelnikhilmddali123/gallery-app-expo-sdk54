import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';

const PANEL_WIDTH = 320;
const ANIMATION_DURATION = 300;

export default function SideSettingsPanel({ visible, onClose }) {
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const { isVaultSetup, isLoading, deleteVault } = useVault();
  const navigation = useNavigation();
  const translateX = useSharedValue(PANEL_WIDTH);

  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, { duration: ANIMATION_DURATION });
    } else {
      translateX.value = withTiming(PANEL_WIDTH, { duration: ANIMATION_DURATION });
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [visible, onClose]);

  const panelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: visible ? withTiming(0.5, { duration: ANIMATION_DURATION }) : withTiming(0, { duration: ANIMATION_DURATION }),
    };
  });

  // Don't render if not visible and panel is fully off-screen
  // Use a state to track visibility instead of accessing shared value
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    } else {
      // Delay unmount to allow animation to complete
      const timer = setTimeout(() => setShouldRender(false), ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender && !visible) return null;

  return (
    <View style={[styles.container, {
      pointerEvents: visible ? 'auto' : 'none',
      elevation: visible ? 10 : -1,
    }]}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {visible && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        )}
      </Animated.View>
      <Animated.View style={[styles.panel, panelStyle, { backgroundColor: colors.surface }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'right']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <View style={styles.settingsContent}>
              {/* Dark Mode Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={isDarkMode ? "moon" : "moon-outline"}
                    size={24}
                    color={colors.icon}
                    style={styles.settingIcon}
                  />
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      Switch between light and dark theme
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#767577', true: '#4CAF50' }}
                  thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                />
              </View>

              {/* Vault Options */}
              {/* Vault Options */}
              {isVaultSetup ? (
                <>
                  {/* Forgot Password Option */}
                  <TouchableOpacity
                    style={styles.settingItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('ForgotVaultPassword');
                    }}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons
                        name="key-outline"
                        size={24}
                        color={colors.icon}
                        style={styles.settingIcon}
                      />
                      <View style={styles.settingTextContainer}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>Forgot Vault Password</Text>
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                          Reset your vault password using security questions
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                  </TouchableOpacity>

                  {/* Delete Vault Option */}
                  <TouchableOpacity
                    style={styles.settingItem}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        Alert.alert(
                          'Delete Vault',
                          'Are you sure you want to delete the entire vault? This will permanently delete all vault files and cannot be undone.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                const success = await deleteVault();
                                if (success) {
                                  Alert.alert('Success', 'Vault has been deleted successfully.');
                                } else {
                                  Alert.alert('Error', 'Failed to delete vault. Please try again.');
                                }
                              },
                            },
                          ]
                        );
                      }, 300);
                    }}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons
                        name="trash-outline"
                        size={24}
                        color="#ff6b6b"
                        style={styles.settingIcon}
                      />
                      <View style={styles.settingTextContainer}>
                        <Text style={[styles.settingTitle, { color: '#ff6b6b' }]}>Delete Vault</Text>
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                          Permanently delete all vault files and settings
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                  </TouchableOpacity>
                </>
              ) : (
                /* Setup Vault Option - Exists only when not setup */
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => {
                    onClose();
                    navigation.navigate('VaultSetup');
                  }}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={24}
                      color={colors.primary}
                      style={styles.settingIcon}
                    />
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingTitle, { color: colors.text }]}>Set up Vault</Text>
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                        Create a secure private folder
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  settingsContent: {
    flex: 1,
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
});


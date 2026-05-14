import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import SafeBlurView from './SafeBlurView';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useVault } from '../contexts/VaultContext';

const { width, height } = Dimensions.get('window');
const MENU_WIDTH = width * 0.7;

const GlassMenu = ({ visible, onClose }) => {
  const { colors, isDarkMode, toggleDarkMode } = useTheme();
  const { isVaultSetup } = useVault();
  const navigation = useNavigation();

  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withTiming(1, { duration: 250 });
      
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => backHandler.remove();
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, onClose]);


  const handleAction = (screen) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    if (screen) {
      // Small delay for smooth transition after menu closes
      setTimeout(() => {
        navigation.navigate(screen);
      }, 100);
    }
  };

  const MenuItem = ({ icon, label, onPress, color, rightElement }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name={icon} size={22} color={color || colors.text} />
        </View>
        <Text style={[styles.menuItemLabel, { color: colors.text }]}>{label}</Text>
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={18} color={colors.text} opacity={0.3} />
      )}
    </TouchableOpacity>
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateX: (1 - scale.value) * (MENU_WIDTH / 2) }, // Expand from right
      { translateY: (1 - scale.value) * -(height * 0.1) } // Expand from top
    ],
  }));

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Animated.View style={[styles.menuWrapper, animatedStyle]}>
          <SafeBlurView
            intensity={isDarkMode ? 40 : 60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.blurContainer,
              {
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                backgroundColor: isDarkMode ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.75)',
              }
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Options</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <MenuItem 
                icon="calendar-outline" 
                label="Calendar" 
                onPress={() => handleAction('Calendar')} 
              />
              <MenuItem 
                icon="images-outline" 
                label="Albums" 
                onPress={() => handleAction('Albums')} 
              />
              {!isVaultSetup && (
                <MenuItem 
                  icon="lock-closed-outline" 
                  label="Vault" 
                  onPress={() => handleAction('VaultSetup')} 
                  color="#7B61FF"
                />
              )}
              <MenuItem 
                icon="trash-outline" 
                label="Recycle Bin" 
                onPress={() => handleAction('Trash')} 
                color="#FF3B30"
              />
              
              <View style={[styles.divider, { backgroundColor: colors.text + '20' }]} />
              
              <MenuItem 
                icon="swap-vertical-outline" 
                label="Sort By" 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Placeholder for sort logic
                  onClose();
                }} 
              />

              <MenuItem 
                icon={isDarkMode ? "moon" : "sunny"} 
                label="Dark Mode" 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDarkMode();
                }}
                rightElement={
                  <View style={[styles.toggle, { backgroundColor: isDarkMode ? colors.primary : '#ccc' }]}>
                    <View style={[styles.toggleCircle, { transform: [{ translateX: isDarkMode ? 12 : 0 }] }]} />
                  </View>
                }
              />

              <MenuItem 
                icon="settings-outline" 
                label="Settings" 
                onPress={() => handleAction('Settings')} 
              />
            </ScrollView>
          </SafeBlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuWrapper: {
    position: 'absolute',
    top: 70,
    right: 20,
    width: MENU_WIDTH,
    maxHeight: height * 0.7,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  blurContainer: {
    padding: 20,
    borderRadius: 30,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: 4,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  toggleCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'white',
  },
});

export default GlassMenu;

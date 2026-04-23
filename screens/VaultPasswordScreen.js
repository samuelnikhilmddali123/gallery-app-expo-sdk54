import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { useDialog } from '../contexts/DialogContext';

export default function VaultPasswordScreen({ route, onUnlock }) {
  const navigation = useNavigation();
  // Get onUnlock from route params if provided, otherwise use prop
  const unlockCallback = route?.params?.onUnlock || onUnlock;
  const { colors } = useTheme();
  const { verifyPassword, isLoading, unlockVault } = useVault();
  const { showAlert } = useDialog();

  const [password, setPassword] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Handle Android back button - navigate back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate back (to Settings or previous screen)
    if (navigation) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // If no back history, navigate to Settings
        navigation.navigate('MainTabs', { screen: 'Settings' });
      }
    }
  };

  const handleVerify = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const valid = await verifyPassword(password.trim());

      if (valid) {
        // Success - unlock the vault
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (unlockCallback) {
          unlockCallback();
        } else {
          // If no callback, just unlock and open Vault
          unlockVault();
          navigation.replace('VaultHome');
        }

        setPassword('');
        setAttempts(0);
      } else {
        // Wrong password
        setAttempts(prev => prev + 1);
        setError('Incorrect password. Please try again.');
        setPassword('');

        if (attempts >= 2) {
          showAlert(
            'Too Many Attempts',
            'You have entered the wrong password multiple times. You can use "Forgot Password" to reset it using security questions.'
          );
          setAttempts(0);
        }
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setError('Failed to verify password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.icon} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Back Button */}
        <View style={[styles.topBar, { borderBottomColor: colors.searchBar }]}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.itemBackground }]}>
              <Ionicons name="lock-closed" size={48} color={colors.icon} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Vault Locked
            </Text>
            <Text style={[styles.subtitle, { color: colors.searchPlaceholder }]}>
              Enter your vault password to access the gallery
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <View style={[styles.inputContainer, { backgroundColor: colors.searchBar }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.searchPlaceholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter vault password"
                placeholderTextColor={colors.searchPlaceholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                onSubmitEditing={handleVerify}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Attempts Warning */}
            {attempts > 0 && attempts < 3 && (
              <View style={[styles.warningContainer, { backgroundColor: colors.itemBackground }]}>
                <Ionicons name="warning-outline" size={20} color="#FFA500" />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  {3 - attempts} attempt(s) remaining
                </Text>
              </View>
            )}
          </View>

          {/* Unlock Button */}
          <TouchableOpacity
            style={[
              styles.unlockButton,
              { backgroundColor: colors.icon },
              (!password.trim() || isVerifying) && styles.unlockButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={!password.trim() || isVerifying}
            activeOpacity={0.8}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-open" size={24} color="#fff" />
                <Text style={styles.unlockButtonText}>Unlock Vault</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordLink}
            onPress={() => {
              showAlert(
                'Forgot Password?',
                'You can reset your vault password using security questions from Settings > Privacy & Security > Forgot Password.'
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.icon }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingRight: 8,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  unlockButtonDisabled: {
    opacity: 0.5,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '500',
  },
});


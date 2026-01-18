import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDialog } from '../contexts/DialogContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import VaultScreen from './VaultScreen';
import ProfileScreen from './ProfileScreen';
import VaultSetupScreen from './VaultSetupScreen';
import ForgotVaultPasswordScreen from './ForgotVaultPasswordScreen';

export default function SettingsScreen({ navigation }) {
  const { colors, isDarkMode, toggleDarkMode } = useTheme();
  const {
    isVaultSetup,
    isVaultUnlocked,
    unlockVault,
    verifyPassword,
    getSecurityQuestions,
    resetVault,
    deleteVault,
  } = useVault();
  const { showConfirm, showAlert } = useDialog();
  /*
   * REMOVED:
   * const [showVault, setShowVault] = useState(false);
   * replaced with clean navigation logic
   */
  const [showProfile, setShowProfile] = useState(false);
  const [showVaultSetup, setShowVaultSetup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSecurityQuestions, setShowSecurityQuestions] = useState(false);

  const securityQuestions = getSecurityQuestions() || [];

  const handleVaultPress = () => {
    if (!isVaultSetup) {
      navigation.navigate('VaultSetup');
      return;
    }

    if (!isVaultUnlocked) {
      navigation.navigate('VaultPassword');
      return;
    }

    navigation.navigate('VaultHome');
  };

  const handleChangePassword = () => {
    if (!isVaultUnlocked) {
      showAlert('Error', 'Please unlock vault first');
      return;
    }
    setShowChangePassword(true);
  };

  const handleViewSecurityQuestions = () => {
    if (!isVaultSetup) {
      showAlert('No Vault', 'Please set up a vault first');
      return;
    }
    setShowSecurityQuestions(true);
  };

  const handleDeleteVault = () => {
    showConfirm(
      'Delete Vault',
      'Are you sure you want to permanently delete your vault? This will delete all vault files and cannot be undone.',
      async () => {
        const success = await deleteVault();
        if (success) {
          showAlert('Success', 'Vault has been deleted successfully');
        } else {
          showAlert('Error', 'Failed to delete vault. Please try again.');
        }
      },
      null,
      true // Destructive
    );
  };

  const settingsSections = [
    {
      title: 'Appearance',
      items: [
        {
          id: 'darkMode',
          title: 'Dark Mode',
          icon: isDarkMode ? 'moon' : 'moon-outline',
          type: 'toggle',
          value: isDarkMode,
          onPress: toggleDarkMode,
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        ...(!isVaultSetup
          ? [
            {
              id: 'setupVault',
              title: 'Set up Vault',
              icon: 'lock-closed-outline',
              type: 'navigation',
              badge: 'Recommended',
              onPress: () => setShowVaultSetup(true),
            },
          ]
          : []),
        ...(isVaultSetup && isVaultUnlocked
          ? [
            {
              id: 'changePassword',
              title: 'Change Vault Password',
              icon: 'key-outline',
              type: 'navigation',
              onPress: handleChangePassword,
            },
            {
              id: 'securityQuestions',
              title: 'Security Questions',
              icon: 'shield-checkmark-outline',
              type: 'navigation',
              badge: `${securityQuestions.length} Questions`,
              onPress: handleViewSecurityQuestions,
            },
          ]
          : []),
        ...(isVaultSetup
          ? [
            {
              id: 'forgotPassword',
              title: 'Forgot Password',
              icon: 'key-outline',
              type: 'navigation',
              onPress: () => setShowForgotPassword(true),
            },
            {
              id: 'deleteVault',
              title: 'Delete Vault',
              icon: 'trash-outline',
              type: 'navigation',
              destructive: true,
              onPress: handleDeleteVault,
            },
          ]
          : []),
      ],
    },
    {
      title: 'Storage',
      items: [
        {
          id: 'recycle',
          title: 'Recycle Bin',
          icon: 'trash-outline',
          type: 'navigation',
          onPress: () => navigation.navigate('Trash'),
        },
        {
          id: 'storage',
          title: 'Storage Management',
          icon: 'folder-outline',
          type: 'navigation',
          onPress: () => {
            showAlert('Storage', 'Storage management coming soon');
          },
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Profile',
          icon: 'person-outline',
          type: 'navigation',
          onPress: () => setShowProfile(true),
        },
        {
          id: 'about',
          title: 'About',
          icon: 'information-circle-outline',
          type: 'navigation',
          onPress: async () => {
            let aboutText = 'Gallery App\nVersion 1.0.0\n\nA secure and private gallery application with vault protection.';

            if (Platform.OS === 'android') {
              try {
                const { getAndroidVersion } = require('../services/trashService');
                const versionInfo = await getAndroidVersion();
                if (versionInfo) {
                  aboutText += `\n\nDevice Info:\nAndroid ${versionInfo.release} (API ${versionInfo.sdkInt})\n${versionInfo.manufacturer} ${versionInfo.model}`;

                  // Check trash support
                  const { isTrashSupported } = require('../services/trashService');
                  const trashSupported = await isTrashSupported();
                  aboutText += `\n\nTrash Support: ${trashSupported ? 'Yes ✓' : 'No ✗'}`;
                  if (!trashSupported) {
                    aboutText += `\n(Requires Android 10+ / API 29+)`;
                  }
                }
              } catch (error) {
                console.error('Error getting device info:', error);
              }
            }

            showAlert('About', aboutText);
          },
        },
      ],
    },
  ];

  /*
   * REMOVED: ChangePasswordModal, SecurityQuestionsModal, VaultScreen rendering inside Settings
   * (Actually keeping Modals as they are part of settings UI interaction, but removing VaultScreen return)
   */

  // Change Password Modal
  const ChangePasswordModal = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async () => {
      if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('Error', 'Please fill in all fields');
        return;
      }

      if (newPassword.length < 4) {
        showAlert('Error', 'Password must be at least 4 characters');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('Error', 'New passwords do not match');
        return;
      }

      const isValid = await verifyPassword(currentPassword);
      if (!isValid) {
        showAlert('Error', 'Current password is incorrect');
        return;
      }

      const success = await resetVault(newPassword, securityQuestions);
      if (success) {
        showAlert('Success', 'Password changed successfully', () => setShowChangePassword(false));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showAlert('Error', 'Failed to change password');
      }
    };

    return (
      <Modal
        visible={showChangePassword}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChangePassword(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setShowChangePassword(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
              <View style={styles.modalCloseButton} />
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
              <View style={[styles.inputContainer, { backgroundColor: colors.searchBar }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Current password"
                  placeholderTextColor={colors.searchPlaceholder}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, { backgroundColor: colors.searchBar, marginTop: 12 }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="New password"
                  placeholderTextColor={colors.searchPlaceholder}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, { backgroundColor: colors.searchBar, marginTop: 12 }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.searchPlaceholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.icon }]}
                onPress={handleSubmit}
              >
                <Text style={styles.modalButtonText}>Change Password</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // Security Questions Modal
  const SecurityQuestionsModal = () => {
    return (
      <Modal
        visible={showSecurityQuestions}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSecurityQuestions(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowSecurityQuestions(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Security Questions</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {securityQuestions.length === 0 ? (
              <View style={styles.emptyQuestions}>
                <Ionicons name="shield-outline" size={64} color={colors.searchPlaceholder} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No Security Questions</Text>
                <Text style={[styles.emptySubtext, { color: colors.searchPlaceholder }]}>
                  Security questions are not set up
                </Text>
              </View>
            ) : (
              securityQuestions.map((q, index) => (
                <View key={index} style={[styles.questionCard, { backgroundColor: colors.itemBackground }]}>
                  <View style={styles.questionHeader}>
                    <Ionicons name="help-circle-outline" size={20} color={colors.icon} />
                    <Text style={[styles.questionNumber, { color: colors.text }]}>
                      Question {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {String(q.question || 'No question set')}
                  </Text>
                  <View style={[styles.answerContainer, { backgroundColor: colors.searchBar }]}>
                    <Ionicons name="lock-closed" size={16} color={colors.searchPlaceholder} />
                    <Text style={[styles.answerText, { color: colors.searchPlaceholder }]}>
                      Answer is hidden for security
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (showProfile) {
    return (
      <ProfileScreen
        navigation={{
          ...navigation,
          goBack: () => setShowProfile(false),
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.searchPlaceholder }]}>
          Manage your app preferences and privacy
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.searchPlaceholder }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionContent, { backgroundColor: colors.itemBackground }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingRow,
                    itemIndex !== section.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.searchBar,
                    },
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={item.destructive ? '#ff6b6b' : colors.icon}
                    />
                    <View style={styles.settingTextContainer}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: item.destructive ? '#ff6b6b' : colors.text },
                        ]}
                      >
                        {String(item.title || '')}
                      </Text>
                      {item.badge && item.badge.trim() && (
                        <Text style={[styles.badge, { color: colors.searchPlaceholder }]}>
                          {item.badge}
                        </Text>
                      )}
                    </View>
                  </View>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value}
                      onValueChange={() => {
                        if (item.onPress) {
                          item.onPress();
                        }
                      }}
                      trackColor={{ false: colors.searchBar, true: colors.icon }}
                      thumbColor={item.value ? '#fff' : '#f4f3f4'}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.searchPlaceholder} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modals */}
      <Modal
        visible={showVaultSetup}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVaultSetup(false)}
      >
        <VaultSetupScreen
          onComplete={() => setShowVaultSetup(false)}
          onCancel={() => setShowVaultSetup(false)}
        />
      </Modal>

      <Modal
        visible={showForgotPassword}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <ForgotVaultPasswordScreen
          onComplete={() => setShowForgotPassword(false)}
          onCancel={() => setShowForgotPassword(false)}
        />
      </Modal>

      <ChangePasswordModal />
      <SecurityQuestionsModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 56,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    fontSize: 13,
    marginTop: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCloseButton: {
    padding: 4,
    width: 32,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
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
  modalButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 22,
  },
  answerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  answerText: {
    fontSize: 14,
  },
  emptyQuestions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

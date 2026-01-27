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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDialog } from '../contexts/DialogContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import SecurityQuestionDropdown from '../components/SecurityQuestionDropdown';

export default function VaultSetupScreen({ onComplete, onCancel }) {
  const { colors } = useTheme();
  const { setupVault } = useVault();
  const navigation = useNavigation();
  const { showConfirm, showAlert } = useDialog();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [questions, setQuestions] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => backHandler.remove();
  }, [onCancel]);

  const handleCancel = () => {
    // Simply navigate back without confirmation
    if (onCancel) {
      onCancel();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // If no back history, navigate to main tabs
      navigation.navigate('MainTabs');
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    // Validation
    if (!password || password.length < 4) {
      showAlert('Error', 'Password must be at least 4 characters long');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    // Validate all questions and answers are filled
    const allFilled = questions.every(q => q.question.trim() && q.answer.trim());
    if (!allFilled) {
      showAlert('Error', 'Please select all security questions and provide answers');
      return;
    }

    // Check for duplicate questions (shouldn't happen with dropdown, but safety check)
    const questionTexts = questions.map(q => q.question.trim().toLowerCase());
    const uniqueQuestions = new Set(questionTexts);
    if (uniqueQuestions.size !== questions.length) {
      showAlert('Error', 'Security questions must be unique. Please select different questions.');
      return;
    }

    const success = await setupVault(password, questions);
    if (success) {
      showAlert('Success', 'Vault setup completed successfully', () => {
        if (onComplete) {
          onComplete();
        } else {
          // Navigate to Home as requested
          navigation.navigate('MainTabs');
        }
      });
    } else {
      showAlert('Error', 'Failed to set up vault. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header with Close Button */}
        <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Vault Setup</Text>
          <View style={styles.closeButton} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {!onCancel && <Text style={[styles.title, { color: colors.text }]}>Vault Setup</Text>}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Set up a secure vault to protect your private content
            </Text>
          </View>

          {/* Password Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vault Password</Text>

            <View style={[styles.inputContainer, { backgroundColor: colors.searchBar }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter password"
                placeholderTextColor={colors.searchPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.searchBar, marginTop: 12 }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Confirm password"
                placeholderTextColor={colors.searchPlaceholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Questions Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Questions</Text>
            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              Answer these questions to recover your vault if you forget your password
            </Text>

            {questions.map((q, index) => {
              // Get already selected questions (excluding current one)
              const disabledQuestions = questions
                .map((q, i) => i !== index ? q.question : '')
                .filter(q => q.trim() !== '');

              return (
                <View key={index} style={styles.questionContainer}>
                  <Text style={[styles.questionLabel, { color: colors.text }]}>
                    Question {index + 1}
                  </Text>
                  <SecurityQuestionDropdown
                    selectedQuestion={q.question}
                    onSelect={(question) => handleQuestionChange(index, 'question', question)}
                    disabledQuestions={disabledQuestions}
                  />
                  <TextInput
                    style={[styles.answerInput, { backgroundColor: colors.searchBar, color: colors.text, marginTop: 12 }]}
                    placeholder={`Enter your answer`}
                    placeholderTextColor={colors.searchPlaceholder}
                    value={q.answer}
                    onChangeText={(text) => handleQuestionChange(index, 'answer', text)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: '#007AFF' }]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Complete Setup</Text>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
    width: 32,
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
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
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 16,
    marginBottom: 12,
  },
  answerInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


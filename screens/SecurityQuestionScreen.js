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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { useDialog } from '../contexts/DialogContext';


export default function SecurityQuestionScreen({ onUnlock }) {
  const { colors } = useTheme();
  const { verifySecurityQuestions, getSecurityQuestions, isLoading } = useVault();
  const { showAlert } = useDialog();

  
  const [answers, setAnswers] = useState(['', '', '']);
  const [attempts, setAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAnswers, setShowAnswers] = useState([false, false, false]);

  const questions = getSecurityQuestions() || [];

  // Prevent back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      showAlert(
        'Exit App',
        'You must answer security questions to access the gallery.',
        null,
        'info'
      );
      return true;
    });


    return () => backHandler.remove();
  }, []);

  const updateAnswer = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const toggleShowAnswer = (index) => {
    const updated = [...showAnswers];
    updated[index] = !updated[index];
    setShowAnswers(updated);
  };

  const handleVerify = async () => {
    // Check if all answers are filled
    if (answers.some(a => !a.trim())) {
      showAlert('Error', 'Please answer all security questions', null, 'error');
      return;
    }


    setIsVerifying(true);

    try {
      const valid = await verifySecurityQuestions(answers);
      
      if (valid) {
        // Success - unlock the app
        if (onUnlock) {
          onUnlock();
        }
      } else {
        // Wrong answers
        setAttempts(prev => prev + 1);
        
        if (attempts >= 2) {
          showAlert(
            'Too Many Attempts',
            'You have exceeded the maximum number of attempts. Please try again later.',
            null,
            'error'
          );

          // Clear answers and reset attempts after a delay
          setTimeout(() => {
            setAnswers(['', '', '']);
            setAttempts(0);
          }, 2000);
        } else {
          showAlert(
            'Incorrect Answers',
            `Incorrect answers. You have ${3 - attempts - 1} attempt(s) remaining.`,
            null,
            'warning'
          );

          setAnswers(['', '', '']);
        }
      }
    } catch (error) {
      console.error('Error verifying security questions:', error);
      showAlert('Error', 'Failed to verify answers. Please try again.', null, 'error');
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

  if (!questions || questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Ionicons name="lock-closed" size={64} color={colors.icon} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              Security Questions Not Set
            </Text>
            <Text style={[styles.errorText, { color: colors.searchPlaceholder }]}>
              Please set up security questions in Settings to protect your gallery.
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
              Security Verification
            </Text>
            <Text style={[styles.subtitle, { color: colors.searchPlaceholder }]}>
              Answer your security questions to access the gallery
            </Text>
          </View>

          {/* Security Questions */}
          <View style={styles.questionsContainer}>
            {(questions || []).map((q, index) => {
              if (!q) return null;
              return (
                <View key={index} style={styles.questionBlock}>
                  <Text style={[styles.questionLabel, { color: colors.text }]}>
                    Question {index + 1}
                  </Text>
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {String(q.question || 'No question set')}
                  </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.searchBar }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Your answer"
                    placeholderTextColor={colors.searchPlaceholder}
                    value={answers[index]}
                    onChangeText={(text) => updateAnswer(index, text)}
                    secureTextEntry={!showAnswers[index]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => toggleShowAnswer(index)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                  <Ionicons
                    name={showAnswers[index] ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>
              );
            })}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, { backgroundColor: colors.icon }]}
            onPress={handleVerify}
            disabled={isVerifying || answers.some(a => !a.trim())}
            activeOpacity={0.8}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.verifyButtonText}>Verify & Unlock</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Attempts Warning */}
          {attempts > 0 && attempts < 3 && (
            <View style={[styles.warningContainer, { backgroundColor: colors.itemBackground }]}>
              <Ionicons name="warning-outline" size={20} color="#FFA500" />
              <Text style={[styles.warningText, { color: colors.text }]}>
                {3 - attempts} attempt(s) remaining
              </Text>
            </View>
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
  },
  questionsContainer: {
    marginBottom: 24,
  },
  questionBlock: {
    marginBottom: 24,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 22,
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
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
});


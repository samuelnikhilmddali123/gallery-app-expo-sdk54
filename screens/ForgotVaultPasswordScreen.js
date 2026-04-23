import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { useDialog } from '../contexts/DialogContext';


export default function ForgotVaultPasswordScreen({ onComplete, onCancel }) {
  const { colors } = useTheme();
  const { verifySecurityQuestions, resetVault, getSecurityQuestions } = useVault();
  const { showAlert } = useDialog();
  const navigation = useNavigation();


  const [step, setStep] = useState(0); // 0 = verify answers, 1 = reset password
  const [answers, setAnswers] = useState(['', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const questions = getSecurityQuestions() || [];

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigation.goBack();
    }
  };

  const updateAnswer = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const verifyAnswers = async () => {
    if (answers.some(a => !a.trim())) {
      showAlert('Error', 'Please answer all security questions', null, 'error');
      return;
    }


    const valid = await verifySecurityQuestions(answers);
    if (valid) {
      setStep(1);
    } else {
      showAlert('Error', 'Incorrect answers. Try again.', null, 'error');
      setAnswers(['', '', '']);
    }

  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      showAlert('Error', 'Password must be at least 4 characters', null, 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'Passwords do not match', null, 'error');
      return;
    }

    const qs = getSecurityQuestions();
    if (!qs) {
      showAlert('Error', 'Unable to retrieve security questions', null, 'error');
      return;
    }


    const success = await resetVault(newPassword, qs);
    if (success) {
      showAlert('Success', 'Password reset successfully', () => {
        if (onComplete) {
          onComplete();
        } else {
          navigation.goBack();
        }
      }, 'success');
    } else {
      showAlert('Error', 'Failed to reset password', null, 'error');
    }

  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {step === 0 ? 'Forgot Password' : 'Reset Password'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {step === 0 ? (
            <>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Answer your security questions
              </Text>

              {questions.map((q, i) => (
                <View key={i} style={styles.block}>
                  <Text style={[styles.question, { color: colors.text }]}>
                    {String(q.question || '')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.searchBar, color: colors.text },
                    ]}
                    placeholder="Your answer"
                    placeholderTextColor={colors.searchPlaceholder}
                    value={answers[i]}
                    onChangeText={(t) => updateAnswer(i, t)}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={styles.button}
                onPress={verifyAnswers}
              >
                <Text style={styles.buttonText}>Verify Answers</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                Create a new vault password
              </Text>

              <View style={[styles.inputWrap, { backgroundColor: colors.searchBar }]}>
                <TextInput
                  style={[styles.flexInput, { color: colors.text }]}
                  placeholder="New password"
                  placeholderTextColor={colors.searchPlaceholder}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.inputWrap,
                  { backgroundColor: colors.searchBar, marginTop: 12 },
                ]}
              >
                <TextInput
                  style={[styles.flexInput, { color: colors.text }]}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.searchPlaceholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={resetPassword}
              >
                <Text style={styles.buttonText}>Reset Password</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  closeBtn: { marginRight: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  content: { padding: 20 },
  desc: { fontSize: 16, marginBottom: 20 },
  block: { marginBottom: 20 },
  question: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  flexInput: { flex: 1, fontSize: 16 },
  button: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

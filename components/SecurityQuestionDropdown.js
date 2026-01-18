import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Predefined security questions
export const SECURITY_QUESTIONS = [
  'What is the name of the street where you lived during your teenage years?',
  'What is the nickname your family uses for you?',
  'What was the model or name of your first vehicle?',
  'What is the name of a teacher who significantly influenced you?',
  'What was the name of your childhood best friend?',
];

export default function SecurityQuestionDropdown({ 
  selectedQuestion, 
  onSelect, 
  disabledQuestions = [] 
}) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const availableQuestions = SECURITY_QUESTIONS.filter(
    q => !disabledQuestions.includes(q)
  );

  const handleSelect = (question) => {
    onSelect(question);
    setIsOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.dropdown,
          { 
            backgroundColor: colors.searchBar,
            borderColor: colors.border,
          }
        ]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dropdownText,
            { 
              color: selectedQuestion ? colors.text : colors.searchPlaceholder 
            }
          ]}
          numberOfLines={2}
        >
          {String(selectedQuestion || 'Select a security question')}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={colors.icon} 
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.itemBackground }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Security Question
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableQuestions}
              keyExtractor={(item, index) => `question-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.questionItem,
                    { 
                      backgroundColor: colors.searchBar,
                      borderBottomColor: colors.border,
                    },
                    selectedQuestion === item && {
                      backgroundColor: colors.icon + '20',
                    }
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {item}
                  </Text>
                  {selectedQuestion === item && (
                    <Ionicons name="checkmark" size={20} color={colors.icon} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    minHeight: 50,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    padding: 8,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    marginRight: 12,
  },
});


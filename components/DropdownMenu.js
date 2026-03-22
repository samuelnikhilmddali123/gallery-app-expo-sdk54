import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function DropdownMenu({ visible, onClose, onSelect, anchorPosition }) {
  const { colors } = useTheme();
  const menuOptions = [
    { id: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
    { id: 'trash', label: 'Trash', icon: 'trash-outline' },
  ];

  if (!visible) return null;

  // Calculate menu position - align to right side of screen
  const menuRight = anchorPosition?.x || 16;
  const menuTop = anchorPosition?.y || 50;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.menu,
            {
              top: menuTop,
              right: menuRight,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <TouchableOpacity
            key="select"
            style={styles.menuItem}
            onPress={() => {
              onSelect('select');
              onClose();
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Select</Text>
          </TouchableOpacity>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.menuItem}
              onPress={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <Ionicons name={option.icon} size={20} color={colors.icon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menu: {
    position: 'absolute',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
  },
});


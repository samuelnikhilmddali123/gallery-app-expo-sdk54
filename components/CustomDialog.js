import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const CustomDialog = ({ visible, title, message, actions = [], onDismiss }) => {
    const { colors, isDarkMode } = useTheme();

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={[
                    styles.dialogContainer,
                    {
                        backgroundColor: colors.cardBackground || (isDarkMode ? '#1a1a1a' : '#ffffff'),
                        shadowColor: "#000",
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: isDarkMode ? 0.3 : 0.1,
                        shadowRadius: 4,
                        elevation: 5,
                    }
                ]}>
                    {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
                    {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}

                    <View style={styles.buttonContainer}>
                        {actions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.button}
                                onPress={() => {
                                    if (action.onPress) action.onPress();
                                    // if (onDismiss) onDismiss(); // Typically actions handle closing, or the context does
                                }}
                                activeOpacity={0.6}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    { color: colors.primary || '#007AFF' }, // Default blue
                                    action.style === 'cancel' && { color: colors.searchPlaceholder || '#666' },
                                    action.style === 'destructive' && { color: '#ff3b30' },
                                    action.textStyle
                                ]}>
                                    {action.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    dialogContainer: {
        width: Math.min(width - 48, 320),
        borderRadius: 16,
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 8,
    },
    button: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
    }
});

export default CustomDialog;

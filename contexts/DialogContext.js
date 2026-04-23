import React, { createContext, useState, useContext, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import GlassDialog from '../components/GlassDialog';


const DialogContext = createContext();

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

export const DialogProvider = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        actions: [],
        type: 'info'
    });

    const showDialog = useCallback(({ title, message, actions, type = 'info' }) => {
        // Trigger haptic based on type
        switch (type) {
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            default:
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
        }

        setConfig({ title, message, actions, type: type || 'info' });
        setVisible(true);
    }, []);


    const hideDialog = useCallback(() => {
        setVisible(false);
    }, []);

    // Helper for simple "OK" Alert
    const showAlert = useCallback((title, message, onPress, type = 'info') => {
        showDialog({
            title,
            message,
            type: type || 'info',
            actions: [
                {
                    text: 'OK',
                    onPress: () => {
                        if (onPress) onPress();
                        hideDialog();
                    }
                }
            ]
        });
    }, [showDialog, hideDialog]);

    // Helper for Confirmation Dialog
    const showConfirm = useCallback((title, message, onConfirm, onCancel, destructive = false, type = 'warning') => {
        showDialog({
            title,
            message,
            type: type || 'warning',
            actions: [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                        if (onCancel) onCancel();
                        hideDialog();
                    }
                },
                {
                    text: destructive ? 'Delete' : 'Confirm',
                    style: destructive ? 'destructive' : 'default',
                    onPress: () => {
                        if (onConfirm) onConfirm();
                        hideDialog();
                    }
                }
            ]
        });
    }, [showDialog, hideDialog]);

    // Helper for custom actions confirmation
    const showCustomConfirm = useCallback((title, message, actions, type = 'warning') => {
        // Wrapper to ensure hideDialog is called
        const wrappedActions = actions.map(action => ({
            ...action,
            onPress: () => {
                if (action.onPress) action.onPress();
                hideDialog(); // Auto close on any action
            }
        }));
        showDialog({ title, message, actions: wrappedActions, type: type || 'warning' });
    }, [showDialog, hideDialog]);

    return (
        <DialogContext.Provider value={{ showDialog, hideDialog, showAlert, showConfirm, showCustomConfirm }}>
            {children}
            <GlassDialog
                visible={visible}
                title={config.title}
                message={config.message}
                actions={config.actions}
                type={config.type}
                onDismiss={hideDialog}
            />
        </DialogContext.Provider>
    );
};

import React, { createContext, useState, useContext, useCallback } from 'react';
import CustomDialog from '../components/CustomDialog';

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
        actions: []
    });

    const showDialog = useCallback(({ title, message, actions }) => {
        setConfig({ title, message, actions });
        setVisible(true);
    }, []);

    const hideDialog = useCallback(() => {
        setVisible(false);
    }, []);

    // Helper for simple "OK" Alert
    const showAlert = useCallback((title, message, onPress) => {
        showDialog({
            title,
            message,
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
    const showConfirm = useCallback((title, message, onConfirm, onCancel, destructive = false) => {
        showDialog({
            title,
            message,
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
    const showCustomConfirm = useCallback((title, message, actions) => {
        // Wrapper to ensure hideDialog is called
        const wrappedActions = actions.map(action => ({
            ...action,
            onPress: () => {
                if (action.onPress) action.onPress();
                hideDialog(); // Auto close on any action
            }
        }));
        showDialog({ title, message, actions: wrappedActions });
    }, [showDialog, hideDialog]);

    return (
        <DialogContext.Provider value={{ showDialog, hideDialog, showAlert, showConfirm, showCustomConfirm }}>
            {children}
            <CustomDialog
                visible={visible}
                title={config.title}
                message={config.message}
                actions={config.actions}
                onDismiss={hideDialog}
            />
        </DialogContext.Provider>
    );
};

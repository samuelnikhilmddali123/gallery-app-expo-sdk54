import React, { createContext, useState, useContext, useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { deleteVault as deleteVaultFiles } from '../services/vaultService';

const VaultContext = createContext();

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};

export const VaultProvider = ({ children }) => {
  const [isVaultSetup, setIsVaultSetup] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState(null);
  const [securityQuestions, setSecurityQuestions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = React.useRef(AppState.currentState);

  // Load vault setup status - optimized with parallel loading
  useEffect(() => {
    const loadVaultStatus = async () => {
      try {
        // Load all SecureStore items in parallel for faster initialization
        const [setupStatus, storedPassword, storedQuestions] = await Promise.all([
          SecureStore.getItemAsync('vault_setup_complete'),
          SecureStore.getItemAsync('vault_password'),
          SecureStore.getItemAsync('vault_questions'),
        ]);
        
        if (setupStatus === 'true') {
          setIsVaultSetup(true);
          if (storedPassword) setVaultPassword(storedPassword);
          if (storedQuestions) {
            try {
              setSecurityQuestions(JSON.parse(storedQuestions));
            } catch (e) {
              console.error('Error parsing security questions:', e);
            }
          }
          // If vault is set up, app starts locked
          setIsVaultUnlocked(false);
        }
      } catch (error) {
        console.error('Error loading vault status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadVaultStatus();
  }, []);

  // Lock app when it goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has gone to background, lock it
        if (isVaultSetup) {
          setIsVaultUnlocked(false);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [isVaultSetup]);

  const setupVault = async (password, questions) => {
    try {
      await SecureStore.setItemAsync('vault_password', password);
      await SecureStore.setItemAsync('vault_questions', JSON.stringify(questions));
      await SecureStore.setItemAsync('vault_setup_complete', 'true');
      setIsVaultSetup(true);
      setVaultPassword(password);
      setSecurityQuestions(questions);
      return true;
    } catch (error) {
      console.error('Error setting up vault:', error);
      return false;
    }
  };

  const verifyPassword = async (password) => {
    try {
      const storedPassword = await SecureStore.getItemAsync('vault_password');
      return storedPassword === password;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  };

  const verifySecurityQuestions = async (answers) => {
    try {
      const storedQuestions = await SecureStore.getItemAsync('vault_questions');
      if (!storedQuestions) return false;
      
      const questions = JSON.parse(storedQuestions);
      // Check if all 3 answers match (case-insensitive)
      return questions.every((q, index) => 
        q.answer.toLowerCase().trim() === answers[index]?.toLowerCase().trim()
      );
    } catch (error) {
      console.error('Error verifying security questions:', error);
      return false;
    }
  };

  const resetVault = async (newPassword, newQuestions) => {
    try {
      await SecureStore.setItemAsync('vault_password', newPassword);
      await SecureStore.setItemAsync('vault_questions', JSON.stringify(newQuestions));
      setVaultPassword(newPassword);
      setSecurityQuestions(newQuestions);
      setIsVaultUnlocked(false);
      return true;
    } catch (error) {
      console.error('Error resetting vault:', error);
      return false;
    }
  };

  const unlockVault = () => {
    setIsVaultUnlocked(true);
  };

  const lockVault = () => {
    setIsVaultUnlocked(false);
  };

  const getSecurityQuestions = () => {
    return securityQuestions;
  };

  const deleteVault = async () => {
    try {
      // Delete all vault files and metadata
      await deleteVaultFiles();
      
      // Clear all secure store items
      await SecureStore.deleteItemAsync('vault_password');
      await SecureStore.deleteItemAsync('vault_questions');
      await SecureStore.deleteItemAsync('vault_setup_complete');
      
      // Reset state
      setIsVaultSetup(false);
      setIsVaultUnlocked(false);
      setVaultPassword(null);
      setSecurityQuestions(null);
      
      return true;
    } catch (error) {
      console.error('Error deleting vault:', error);
      return false;
    }
  };

  const value = {
    isVaultSetup,
    isVaultUnlocked,
    isLoading,
    setupVault,
    verifyPassword,
    verifySecurityQuestions,
    resetVault,
    unlockVault,
    lockVault,
    getSecurityQuestions,
    deleteVault,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};


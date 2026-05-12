import React, { createContext, useState, useContext, useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { deleteVault as deleteVaultFiles, getVaultMedia as fetchVaultMedia } from '../services/vaultService';

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
  const [vaultMedia, setVaultMedia] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
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
          // Pre-load vault media for synchronization with Home screen
          loadVaultMedia(false);
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

  const loadVaultMedia = async (ignoreCache = true) => {
    try {
      setIsMediaLoading(true);
      const media = await fetchVaultMedia(false, ignoreCache);
      setVaultMedia(media);
      return media;
    } catch (error) {
      console.error('Error loading vault media in context:', error);
      return [];
    } finally {
      setIsMediaLoading(false);
    }
  };

  const addMediaToVaultContext = (newItem) => {
    setVaultMedia(prev => [newItem, ...prev]);
  };

  const removeMediaFromVaultContext = (mediaId) => {
    setVaultMedia(prev => prev.filter(item => item.id !== mediaId));
  };

  const deleteVault = async () => {
    console.log('[VaultContext] Starting vault deletion...');
    try {
      // 1. Reset local state immediately for UI responsiveness
      setIsVaultSetup(false);
      setIsVaultUnlocked(false);
      setVaultPassword(null);
      setSecurityQuestions(null);
      setVaultMedia([]);

      // 2. Clear all secure store items
      await Promise.all([
        SecureStore.deleteItemAsync('vault_password'),
        SecureStore.deleteItemAsync('vault_questions'),
        SecureStore.deleteItemAsync('vault_setup_complete')
      ]);
      
      // 3. Delete all vault files and metadata via service
      // We do this after clearing secure storage so that even if file deletion fails, 
      // the vault is effectively "removed" from the user's perspective.
      await deleteVaultFiles();
      
      console.log('[VaultContext] Vault deletion successful.');
      return true;
    } catch (error) {
      console.error('[VaultContext] Error during vault deletion:', error);
      // Even if there was an error, we've cleared the password and setup flag,
      // so we return true to indicate the vault is "gone" for the user.
      return true; 
    }
  };

  const value = {
    isVaultSetup,
    isVaultUnlocked,
    isLoading,
    vaultMedia,
    isMediaLoading,
    loadVaultMedia,
    addMediaToVaultContext,
    removeMediaFromVaultContext,
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


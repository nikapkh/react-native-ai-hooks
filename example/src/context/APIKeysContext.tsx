import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type SupportedProvider = 'anthropic' | 'openai' | 'gemini';

type APIKeysState = {
  anthropic: string;
  openai: string;
  gemini: string;
};

type APIKeysContextValue = {
  keys: APIKeysState;
  activeProvider: SupportedProvider;
  isReady: boolean;
  setActiveProvider: (provider: SupportedProvider) => void;
  updateKey: (provider: SupportedProvider, value: string) => void;
  saveKeys: () => Promise<void>;
  getActiveKey: () => string;
};

const STORAGE_KEY = 'react_native_ai_hooks_example_api_keys_v1';

const defaultKeys: APIKeysState = {
  anthropic: '',
  openai: '',
  gemini: '',
};

const APIKeysContext = createContext<APIKeysContextValue | null>(null);

export function APIKeysProvider({ children }: { children: React.ReactNode }) {
  const [keys, setKeys] = useState<APIKeysState>(defaultKeys);
  const [activeProvider, setActiveProvider] = useState<SupportedProvider>('anthropic');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadKeys = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<APIKeysState>;
          setKeys({
            anthropic: parsed.anthropic ?? '',
            openai: parsed.openai ?? '',
            gemini: parsed.gemini ?? '',
          });
        }
      } catch {
        // Keep defaults if storage is unavailable or payload is invalid.
      } finally {
        setIsReady(true);
      }
    };

    loadKeys().catch(() => setIsReady(true));
  }, []);

  const updateKey = useCallback((provider: SupportedProvider, value: string) => {
    setKeys(prev => ({
      ...prev,
      [provider]: value.trim(),
    }));
  }, []);

  const saveKeys = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }, [keys]);

  const getActiveKey = useCallback(() => {
    return keys[activeProvider] ?? '';
  }, [activeProvider, keys]);

  const value = useMemo<APIKeysContextValue>(
    () => ({
      keys,
      activeProvider,
      isReady,
      setActiveProvider,
      updateKey,
      saveKeys,
      getActiveKey,
    }),
    [activeProvider, getActiveKey, isReady, keys, saveKeys, updateKey],
  );

  return <APIKeysContext.Provider value={value}>{children}</APIKeysContext.Provider>;
}

export function useAPIKeys() {
  const context = useContext(APIKeysContext);
  if (!context) {
    throw new Error('useAPIKeys must be used inside APIKeysProvider');
  }
  return context;
}

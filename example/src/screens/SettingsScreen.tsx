import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { useAPIKeys } from '../context/APIKeysContext';

function getTitle(provider: 'anthropic' | 'openai' | 'gemini') {
  if (provider === 'anthropic') {
    return 'Anthropic API Key';
  }
  if (provider === 'openai') {
    return 'OpenAI API Key';
  }
  return 'Gemini API Key';
}

export function SettingsScreen() {
  const { keys, updateKey, saveKeys } = useAPIKeys();
  const [isSaving, setIsSaving] = useState(false);

  const providers = useMemo<Array<'anthropic' | 'openai' | 'gemini'>>(
    () => ['anthropic', 'openai', 'gemini'],
    [],
  );

  const onSave = async () => {
    try {
      setIsSaving(true);
      await saveKeys();
      Alert.alert('Saved', 'Your API keys were saved locally on this device.');
    } catch {
      Alert.alert('Error', 'Could not save keys. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.subHeader}>
        Add your API keys below. They are stored locally using AsyncStorage.
      </Text>

      {providers.map(provider => (
        <View style={styles.inputGroup} key={provider}>
          <Text style={styles.label}>{getTitle(provider)}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            onChangeText={value => updateKey(provider, value)}
            placeholder={`Enter ${provider} key`}
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={keys[provider]}
          />
        </View>
      ))}

      <Pressable onPress={onSave} style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}>
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Keys'}</Text>
      </Pressable>

      <Text style={styles.note}>
        Security tip: For production apps, prefer routing requests through your own backend proxy.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  subHeader: {
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d5dde9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  note: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});

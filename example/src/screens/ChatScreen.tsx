import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAIStream } from 'react-native-ai-hooks';

import { ProviderPicker } from '../components/ProviderPicker';
import { useAPIKeys } from '../context/APIKeysContext';

const NO_KEY_WARNING = 'Please enter your API key in Settings to start chatting';

const modelMap: Record<'anthropic' | 'openai' | 'gemini', string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
};

export function ChatScreen() {
  const { activeProvider, setActiveProvider, getActiveKey } = useAPIKeys();
  const [prompt, setPrompt] = useState('');

  const activeApiKey = getActiveKey();
  const hasApiKey = activeApiKey.length > 0;

  const streamOptions = useMemo(
    () => ({
      apiKey: activeApiKey,
      provider: activeProvider,
      model: modelMap[activeProvider],
      temperature: 0.6,
      maxTokens: 700,
    }),
    [activeApiKey, activeProvider],
  );

  const { response, isLoading, error, streamResponse, abort, clearResponse } = useAIStream(streamOptions);

  const onSend = async () => {
    if (!hasApiKey || !prompt.trim()) {
      return;
    }
    await streamResponse(prompt.trim());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Stream Chat</Text>
        <Text style={styles.subHeader}>Live token streaming demo using your saved API keys.</Text>

        <ProviderPicker onChange={setActiveProvider} value={activeProvider} />

        {!hasApiKey && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{NO_KEY_WARNING}</Text>
          </View>
        )}

        <View style={styles.outputCard}>
          <Text style={styles.outputLabel}>Assistant Output</Text>
          {isLoading ? <ActivityIndicator color="#0f172a" style={styles.loader} /> : null}
          <Text style={styles.outputText}>{response || 'Start a prompt to see streamed output here.'}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TextInput
          multiline
          onChangeText={setPrompt}
          placeholder="Ask anything..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={prompt}
        />

        <View style={styles.buttonRow}>
          <Pressable
            disabled={!hasApiKey || isLoading || !prompt.trim()}
            onPress={onSend}
            style={[styles.buttonPrimary, (!hasApiKey || isLoading || !prompt.trim()) && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>

          <Pressable disabled={!isLoading} onPress={abort} style={[styles.buttonGhost, !isLoading && styles.buttonDisabledGhost]}>
            <Text style={styles.buttonGhostText}>Stop</Text>
          </Pressable>

          <Pressable onPress={clearResponse} style={styles.buttonGhost}>
            <Text style={styles.buttonGhostText}>Clear</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 14,
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  subHeader: {
    color: '#475569',
    lineHeight: 20,
    marginBottom: 6,
  },
  warningBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningText: {
    color: '#9a3412',
    fontWeight: '600',
  },
  outputCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5dde9',
    borderRadius: 16,
    padding: 14,
    minHeight: 180,
  },
  outputLabel: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  loader: {
    marginBottom: 8,
  },
  outputText: {
    color: '#111827',
    lineHeight: 22,
  },
  errorText: {
    color: '#b91c1c',
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d5dde9',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    textAlignVertical: 'top',
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonGhost: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  buttonGhostText: {
    color: '#334155',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonDisabledGhost: {
    opacity: 0.5,
  },
});

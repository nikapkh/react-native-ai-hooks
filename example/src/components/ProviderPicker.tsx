import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SupportedProvider } from '../context/APIKeysContext';

type ProviderPickerProps = {
  value: SupportedProvider;
  onChange: (provider: SupportedProvider) => void;
};

const options: Array<{ label: string; value: SupportedProvider }> = [
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
];

export function ProviderPicker({ value, onChange }: ProviderPickerProps) {
  return (
    <View style={styles.row}>
      {options.map(option => {
        const active = value === option.value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#d2dae6',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  pillText: {
    color: '#334155',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ffffff',
  },
});

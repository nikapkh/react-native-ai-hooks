import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';

import { APIKeysProvider } from './src/context/APIKeysContext';
import { ChatScreen } from './src/screens/ChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type ScreenName = 'chat' | 'settings';

function ExampleAppShell() {
  const [screen, setScreen] = useState<ScreenName>('chat');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <Text style={styles.brand}>react-native-ai-hooks</Text>
        <View style={styles.segmentRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('chat')}
            style={[styles.segmentButton, screen === 'chat' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, screen === 'chat' && styles.segmentTextActive]}>Chat</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('settings')}
            style={[styles.segmentButton, screen === 'settings' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, screen === 'settings' && styles.segmentTextActive]}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>{screen === 'chat' ? <ChatScreen /> : <SettingsScreen />}</View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <APIKeysProvider>
      <ExampleAppShell />
    </APIKeysProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    padding: 4,
    alignSelf: 'flex-start',
  },
  segmentButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#0f172a',
  },
  segmentText: {
    color: '#334155',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
});

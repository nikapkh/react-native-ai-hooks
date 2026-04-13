# Example App

This Expo app demonstrates secure API key handling and hook usage.

## Features

- Settings screen with local key storage using AsyncStorage
- Global context for Anthropic/OpenAI/Gemini keys
- Chat screen using useAIStream
- Friendly warning when no API key is available

## Run

1. Install dependencies

```bash
cd example
npm install
```

2. Start app

```bash
npm run start
```

3. Open Settings, save at least one key, return to Chat.

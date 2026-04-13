[![npm downloads](https://img.shields.io/npm/dw/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![npm version](https://img.shields.io/npm/v/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![GitHub stars](https://img.shields.io/github/stars/nikapkh/react-native-ai-hooks)](https://github.com/nikapkh/react-native-ai-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# react-native-ai-hooks

AI hooks for React Native — add Claude, OpenAI & Gemini to your app in minutes.

## Installation

```bash
npm install react-native-ai-hooks
```

## Hooks

- `useAIChat()` — multi-turn chat with streaming
- `useAIStream()` — real-time token streaming  
- `useImageAnalysis()` — camera/gallery → AI description
- `useAIForm()` — AI-powered form validation

## Quick Start

```tsx
import { useAIChat } from 'react-native-ai-hooks';

const { messages, sendMessage, isLoading } = useAIChat({
  apiKey: 'your-api-key',
  provider: 'claude',
});
```

## Providers

| Provider | Status |
|----------|--------|
| Claude (Anthropic) | ✅ |
| OpenAI | ✅ |
| Gemini | 🔜 |

## License

MIT
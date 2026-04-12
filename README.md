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
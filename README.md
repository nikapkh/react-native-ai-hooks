[![npm downloads](https://img.shields.io/npm/dw/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![npm version](https://img.shields.io/npm/v/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![GitHub stars](https://img.shields.io/github/stars/nikapkh/react-native-ai-hooks)](https://github.com/nikapkh/react-native-ai-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# react-native-ai-hooks

> The missing AI layer for React Native. Add Claude, OpenAI & Gemini to your app in minutes — not days.

No boilerplate. No provider lock-in. Just hooks.

## Why?

Every React Native developer building AI features writes the same code:
- Fetch setup for each provider
- Loading/error state management
- Streaming token handling
- Image encoding for vision APIs
- Speech-to-text plumbing

**react-native-ai-hooks does all of this for you.**

## Install

```bash
npm install react-native-ai-hooks
```

## 7 Hooks. One API.

### 💬 useAIChat — multi-turn conversation
```tsx
const { messages, sendMessage, isLoading, error, clear } = useAIChat({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
});
```

### ⚡ useAIStream — real-time token streaming
```tsx
const { response, streamResponse, abortStream, isLoading } = useAIStream({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
});
```

### 👁️ useImageAnalysis — camera & gallery vision
```tsx
const { analyzeImage, description, isLoading } = useImageAnalysis({
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai',
});
```

### 📝 useAIForm — intelligent form validation
```tsx
const { validateField, autocompleteField, validations } = useAIForm({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
});
```

### 🎙️ useAIVoice — speak, get AI response
```tsx
const { startRecording, stopRecording, transcription, response } = useAIVoice({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
});
```

### 🌍 useAITranslate — real-time translation
```tsx
const { translate, translatedText, setTargetLanguage } = useAITranslate({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
  targetLanguage: 'Spanish',
});
```

### 📄 useAISummarize — instant summarization
```tsx
const { summarize, summary, isLoading } = useAISummarize({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'claude',
  length: 'short', // 'short' | 'medium' | 'long'
});
```

## Provider Support

| Provider | Chat | Stream | Vision | Voice |
|----------|------|--------|--------|-------|
| Claude (Anthropic) | ✅ | ✅ | ✅ | ✅ |
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | 🔜 | 🔜 |

## Architecture

- **Unified provider abstraction** — same API regardless of Claude, GPT, or Gemini
- **Exponential backoff** — automatic retry on rate limits (429) and server errors
- **AbortController** — cancel in-flight requests instantly
- **TypeScript-first** — 20+ strict interfaces, no implicit `any`
- **Zero dependencies** — only React and React Native

## ⚠️ Security

Never expose API keys in client-side code. Use a backend proxy:

```tsx
// ✅ Safe — proxy your requests
const { messages, sendMessage } = useAIChat({
  baseUrl: 'https://your-backend.com/api/ai',
});

// ❌ Never do this in production
const { messages } = useAIChat({ apiKey: 'sk-...' });
```

## Example App

A full example app is included in `/example` — Settings screen, Chat UI, multi-provider switching.

## License

MIT © [nikapkh](https://github.com/nikapkh)
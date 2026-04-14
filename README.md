[![npm downloads](https://img.shields.io/npm/dw/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![npm version](https://img.shields.io/npm/v/react-native-ai-hooks)](https://npmjs.com/package/react-native-ai-hooks)
[![GitHub stars](https://img.shields.io/github/stars/nikapkh/react-native-ai-hooks)](https://github.com/nikapkh/react-native-ai-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# react-native-ai-hooks

Build AI features in React Native without rebuilding the same plumbing every sprint.

One hooks-first API for Claude, OpenAI, and Gemini.

## Why use this?

Most teams burn time on the same AI integration work:

- Provider-specific request/response wiring
- Retry, timeout, and error edge cases
- Streaming token parsing
- State handling for loading, cancellation, and failures

This library gives you that foundation out of the box so you can ship product features, not infra glue.

| What you want | What this gives you |
|---|---|
| Ship chat quickly | Drop-in hooks with minimal setup |
| Avoid provider lock-in | Unified interface across providers |
| Handle real-world failures | Built-in retries, backoff, timeout, abort |
| Keep code clean | Strong TypeScript types and predictable APIs |

## Quick Start

```tsx
// npm install react-native-ai-hooks

import { useAIChat } from 'react-native-ai-hooks';

export function Assistant() {
  const { messages, sendMessage, isLoading, error } = useAIChat({
    provider: 'anthropic',
    apiKey: process.env.EXPO_PUBLIC_AI_KEY ?? '',
    model: 'claude-sonnet-4-20250514',
  });

  // Example action
  async function onAsk() {
    await sendMessage('Draft a warm onboarding message for new users.');
  }

  return null;
}
```

## Hooks

- 💬 useAIChat: multi-turn conversation
- ⚡ useAIStream: token streaming
- 👁️ useImageAnalysis: image and vision workflows
- 📝 useAIForm: AI-assisted form validation
- 🎙️ useAIVoice: speech-to-text plus AI response
- 🌍 useAITranslate: real-time translation
- 📄 useAISummarize: concise text summaries
- 🧠 useAICode: generate and explain code

## Provider Support

| Provider | Chat | Stream | Vision | Voice |
|---|---|---|---|---|
| Anthropic Claude | ✅ | ✅ | ✅ | ✅ |
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | 🔜 | 🔜 |

## Security

Use a backend proxy in production. Do not ship permanent provider API keys in app binaries.

```tsx
const { sendMessage } = useAIChat({
  baseUrl: 'https://your-backend.com/api/ai',
});
```

## Example App

See [example](./example) for a full app with provider switching, API key settings, and streaming chat.

## Deep Technical Docs

Detailed architecture and implementation references now live in [docs](./docs):

- [Architecture Guide](./docs/ARCHITECTURE_GUIDE.md)
- [Technical Specification](./docs/TECHNICAL_SPECIFICATION.md)
- [Implementation Summary](./docs/IMPLEMENTATION_COMPLETE.md)
- [Internal Architecture Notes](./docs/ARCHITECTURE.md)

## License

MIT © [nikapkh](https://github.com/nikapkh)
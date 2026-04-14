# Technical Specification: react-native-ai-hooks v1.0

## 1. System Design Overview

### 1.1 Architecture Layers

```
┌─────────────────────────────────────────┐
│     React Native Application            │
├─────────────────────────────────────────┤
│  useAIChat / useAIStream / useAIForm /  │
│  useImageAnalysis / ... (8 hooks)       │
├─────────────────────────────────────────┤
│  ProviderFactory (Unified Interface)    │
├─────────────────────────────────────────┤
│  fetchWithRetry (Resilience Layer)      │
├─────────────────────────────────────────┤
│  fetch() / HTTP Network Layer           │
├─────────────────────────────────────────┤
│  Anthropic / OpenAI / Gemini APIs       │
└─────────────────────────────────────────┘
```

### 1.2 Request Flow Diagram

```
User Action (sendMessage)
    ↓
Hook captures input + state
    ↓
ProviderFactory.makeRequest()
    ↓
Validate input (prompt non-empty, apiKey present)
    ↓
Build provider-specific request body
    ↓
fetchWithRetry(url, options)
    ↓
AbortController timeout setup
    ↓
Fetch attempt #1
    ├─ Success → Normalize response → Return AIResponse
    ├─ 429 Rate Limit → Calculate backoff → Retry
    ├─ 5xx Server Error → Wait → Retry
    ├─ Timeout → Backoff → Retry
    └─ Max retries exceeded → Throw error
    ↓
Hook catches error (stored in state)
    ↓
Component re-render with error + results
```

---

## 2. Core Components Specification

### 2.1 ProviderFactory Class

**Interface:**
```typescript
class ProviderFactory {
  constructor(config: ProviderConfig);
  makeRequest(request: ProviderRequest): Promise<AIResponse>;
  
  // Private provider-specific methods
  private makeAnthropicRequest(request: ProviderRequest): Promise<AIResponse>
  private makeOpenAIRequest(request: ProviderRequest): Promise<AIResponse>
  private makeGeminiRequest(request: ProviderRequest): Promise<AIResponse>
  
  // Private normalizers
  private normalizeAnthropicResponse(data: AnthropicResponse): AIResponse
  private normalizeOpenAIResponse(data: OpenAIResponse): AIResponse
  private normalizeGeminiResponse(data: GeminiResponse): AIResponse
}
```

**Request Flow (makeRequest):**
1. Route by `config.provider` to specific handler
2. Build provider-specific request body
3. Call `fetchWithRetry` with provider headers
4. Parse raw response
5. Call provider-specific normalizer
6. Return standardized `AIResponse`

**Response Normalization:**
```
Provider Response (varying format)
    ↓
Extract text content (provider-specific path)
    ↓
Extract token usage (if available)
    ↓
Return standardized { text, raw, usage }
```

### 2.2 fetchWithRetry Function

**Retry Strategy:**
```
┌──────────────────────────────────────────┐
│ Fetch attempt with AbortController       │
├──────────────────────────────────────────┤
│ Response OK? YES → Return response       │
│             NO  → Check error type       │
├──────────────────────────────────────────┤
│ Error Type Analysis:                     │
│ ├─ 429 (Rate Limit) → Calculate wait    │
│ ├─ 5xx (Server Error) → Backoff retry   │
│ ├─ Timeout → Backoff retry              │
│ └─ Other (4xx, etc.) → Maybe retry      │
├──────────────────────────────────────────┤
│ Retry Count < Max?                       │
│ YES → Sleep(delay) → Retry               │
│ NO  → Throw final error                  │
└──────────────────────────────────────────┘
```

**Backoff Calculation:**
- Initial: `baseDelay` (default 1000ms)
- After attempt N: `baseDelay * (multiplier ^ N)`
- Capped at: `maxDelay` (default 10000ms)
- Special: 429 responses check `Retry-After` header first

### 2.3 Hook Pattern (All 8 Hooks)

**Common Structure:**
```typescript
export function useAI*(options: UseAI*Options): UseAI*Return {
  // 1. State hooks (data, loading, error)
  const [data, setData] = useState(...);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 2. Refs for lifecycle management
  const isMountedRef = useRef(true);
  
  // 3. Memoized provider config
  const providerConfig = useMemo(() => ({...}), [deps]);
  const provider = useMemo(() => createProvider(providerConfig), [providerConfig]);
  
  // 4. Callback functions (memoized)
  const primaryAction = useCallback(async (...) => {
    // Try → update state → catch → finally
  }, [deps]);
  
  // 5. Cleanup
  useState(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  // 6. Return public API
  return { data, isLoading, error, primaryAction, ... };
}
```

**Error Safety Pattern:**
```typescript
try {
  const result = await provider.makeRequest(params);
  if (isMountedRef.current) setData(result);  // Guard
} catch (err) {
  if (isMountedRef.current) setError(err.message);  // Guard
} finally {
  if (isMountedRef.current) setIsLoading(false);  // Guard
}
```

---

## 3. Provider Integration Details

### 3.1 Anthropic (Claude)

**Endpoint:** `https://api.anthropic.com/v1/messages`  
**Auth:** Header `x-api-key: {apiKey}`  
**Request Body:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "temperature": 0.7,
  "system": "optional system prompt",
  "messages": [
    {"role": "user", "content": "prompt"},
    {"role": "assistant", "content": "response"},
    ...
  ]
}
```

**Response Structure:**
```json
{
  "content": [
    {"type": "text", "text": "response text"}
  ],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

**Streaming Format:**
```
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}
data: [DONE]
```

### 3.2 OpenAI (GPT)

**Endpoint:** `https://api.openai.com/v1/chat/completions`  
**Auth:** Header `Authorization: Bearer {apiKey}`  
**Request Body:**
```json
{
  "model": "gpt-4",
  "max_tokens": 1024,
  "temperature": 0.7,
  "messages": [
    {"role": "user", "content": "prompt"},
    ...
  ]
}
```

**Response Structure:**
```json
{
  "choices": [
    {"message": {"content": "response text"}}
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**Streaming Format:**
```
data: {"choices":[{"delta":{"content":"hello"}}]}
data: {"choices":[{"delta":{"content":" world"}}]}
data: [DONE]
```

### 3.3 Google Gemini

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`  
**Auth:** URL parameter `key`  
**Request Body:**
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "prompt"}]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 1024,
    "temperature": 0.7
  }
}
```

**Response Structure:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {"text": "response text"}
        ]
      }
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 20
  }
}
```

---

## 4. Type System Specification

### 4.1 Core Types

```typescript
// Provider identification
type AIProviderType = 'anthropic' | 'openai' | 'gemini';

// Configuration
interface ProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;          // For proxy routing
  timeout?: number;          // ms, default 30000
  maxRetries?: number;       // default 3
}

// Standardized response
interface AIResponse {
  text: string;              // The AI's response
  raw: Record<string, any>;  // Provider's original response
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: string;            // Error message if failed
}

// Request options
interface AIRequestOptions {
  system?: string;           // System prompt
  temperature?: number;      // 0.0-2.0
  maxTokens?: number;       // Output limit
  topP?: number;            // Nucleus sampling
  stopSequences?: string[]; // Stop tokens
}

// Message protocol
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;        // Unix ms
}
```

### 4.2 Hook-Specific Types

```typescript
// useAIChat
interface UseAIChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  abort: () => void;           // Cancel in-flight request
  clearMessages: () => void;
}

// useAIStream
interface UseAIStreamReturn {
  response: string;           // Accumulated response
  isLoading: boolean;
  error: string | null;
  streamResponse: (prompt: string) => Promise<void>;
  abort: () => void;
  clearResponse: () => void;
}

// useAIForm
interface FormValidationRequest {
  formData: Record<string, unknown>;
  validationSchema?: Record<string, string>;
  customInstructions?: string;
}

interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;  // Field → Error message
  raw: unknown;                      // AI's raw response
}

interface UseAIFormReturn {
  validationResult: FormValidationResult | null;
  isLoading: boolean;
  error: string | null;
  validateForm: (input: FormValidationRequest) => Promise<FormValidationResult | null>;
  clearValidation: () => void;
}
```

---

## 5. State Management Patterns

### 5.1 Loading State Transitions

```
Initial
  ↓
User action (sendMessage)
  ↓
setIsLoading(true)
  ↓
Make API request via ProviderFactory
  ↓
Response received / Error thrown
  ↓
setIsLoading(false)
setData(result) OR setError(message)
  ↓
Component re-renders with new state
```

### 5.2 Error Lifecycle

```
No error (null)
  ↓
API request fails (caught in try/catch)
  ↓
setError(err.message)
  ↓
User sees error UI
  ↓
clearMessages() / clearValidation() / etc.
  ↓
Back to null
```

### 5.3 Message History (useAIChat specific)

```
Initial: messages = []
  ↓
User: sendMessage("Hello")
  ↓
Add to state: messages = [{role: 'user', content: 'Hello', timestamp}]
  ↓
API responds
  ↓
Add to state: messages = [..., {role: 'assistant', content: 'Hi!', timestamp}]
  ↓
Next turn reuses messages array as context
```

---

## 6. Performance Characteristics

### 6.1 Hook Initialization

| Phase | Time | Notes |
|-------|------|-------|
| Component mount | 0ms | setState calls queued |
| useMemo (config) | <1ms | Runs during render |
| useMemo (provider) | <1ms | Runs during render |
| Return from hook | 1ms | Ready for use |

### 6.2 First Request

| Phase | Time | Notes |
|-------|------|-------|
| User calls sendMessage | 0ms | Sync |
| Hook updates state | 0ms | Sync (queued) |
| Provider.makeRequest | 0ms | Sync (builds request) |
| Network request | 100-300ms | Provider latency |
| Response parsing | 1-10ms | JSON parse |
| State update | 0ms | Sync (queued) |
| React re-render | 5-20ms | Component update |

### 6.3 Retry Overhead (Worst Case)

| Attempt | Delay | Total | Notes |
|---------|-------|-------|-------|
| 1 | 0ms | 0ms | First try |
| 2 | 1s | 1s | After first fail |
| 3 | 2s | 3s | After second fail |
| 4 | 4s | 7s | After third fail |
| Throw | - | 7s | Max total |

---

## 7. Security Considerations

### 7.1 API Key Protection

**❌ Unsafe:**
```typescript
const apiKey = 'sk-abc123...';  // Hardcoded
export { useAIChat };
// Key exposed in client code
```

**✅ Safe:**
```typescript
// Pattern 1: Environment variable
const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY!;

// Pattern 2: Backend proxy (recommended)
const { sendMessage } = useAIChat({
  baseUrl: 'https://my-backend.com/api/ai',
  apiKey: 'client-token'  // Short-lived
});
// Backend:
// 1. Validates client token
// 2. Adds real API key from env
// 3. Makes call to provider
// 4. Returns response to client
```

### 7.2 Rate Limiting Protection

**Automatic:**
- fetchWithRetry handles 429 responses
- Respects Retry-After header
- Exponential backoff prevents DOS

**Manual (app level):**
- Per-user token buckets
- Time-window rate limiters
- Backend request throttling

### 7.3 Timeout Protection

**Request Level:**
```typescript
const hook = useAIChat({
  timeout: 30000  // 30 second max per request
});
```

**Application Level:**
- AbortController used internally
- Automatic cleanup on component unmount
- Memory not leaked from pending requests

---

## 8. Error Recovery Mechanisms

### 8.1 Network Error Recovery

```
Network Error
  ↓ (caught in try/catch)
Increment attempt counter
  ↓ (attempt < maxRetries)
Calculate backoff delay
  ↓
Sleep for delay
  ↓
Retry fetch
  ↓ (success)
Update state with data
  ↓ (max retries exceeded)
Store error in state
```

### 8.2 Provider Error Recovery

| Error | Response | User Action |
|-------|----------|-------------|
| 400 (Bad Request) | Not retried | Fix request |
| 401 (Unauthorized) | Not retried | Check API key |
| 429 (Rate Limited) | Retried w/ backoff | Wait or upgrade plan |
| 500 (Server Error) | Retried automatically | Retry after delay |
| Timeout | Retried w/ backoff | Check network |

---

## 9. Extension Architecture

### 9.1 Adding Provider X

```typescript
// 1. Add to type union
export type AIProviderType = 'anthropic' | 'openai' | 'gemini' | 'provider-x';

// 2. Implement in ProviderFactory
class ProviderFactory {
  private async makeProviderXRequest(request: ProviderRequest): Promise<AIResponse> {
    // Build request with Provider X's spec
    // Call fetchWithRetry
    // Normalize response
  }
  
  private normalizeProviderXResponse(data: ProviderXResponse): AIResponse {
    // Extract text from provider-specific format
    // Extract usage if available
    // Return AIResponse
  }
}

// 3. Add to makeRequest routing
async makeRequest(request: ProviderRequest): Promise<AIResponse> {
  switch (this.config.provider) {
    case 'provider-x':
      return this.makeProviderXRequest(request);
    // ...
  }
}

// 4. Add default model to hooks
const DEFAULT_MODEL_MAP = {
  // ...
  'provider-x': 'provider-x-default-model'
};

// 5. Test all 8 hooks with new provider
```

### 9.2 Adding Hook Y

```typescript
// 1. Define types
interface UseAIYOptions {
  apiKey: string;
  provider?: AIProviderType;
  model?: string;
  // ... hook-specific options
}

interface UseAIYReturn {
  // ... hook-specific state
  performAction: (input: YInput) => Promise<YOutput>;
  clearState: () => void;
}

// 2. Implement hook
export function useAIY(options: UseAIYOptions): UseAIYReturn {
  // Follow the standard hook pattern
  const provider = useMemo(() => createProvider(config), [config]);
  const performAction = useCallback(..., [deps]);
  // ... etc
}

// 3. Export from index.ts
export { useAIY } from './hooks/useAIY';
```

---

## 10. Deployment Architecture

### 10.1 Local Development

```
React Native App (Expo)
    ↓
[API Key in .env.local]
    ↓
useAIChat({ apiKey: process.env.EXPO_PUBLIC_Claude_API_KEY })
    ↓
Direct request to anthropic.com
```

### 10.2 Production with Proxy

```
React Native App (Production)
    ↓
[No API key stored]
    ↓
useAIChat({ baseUrl: 'https://api.company.com/ai' })
    ↓
Backend API Proxy (Request Validation)
    ↓
Backend adds API key from secure storage
    ↓
Request to anthropic.com / openai.com / etc
    ↓
Response back through proxy
    ↓
Client receives normalized response
```

### 10.3 Multi-Region Deployment

```
useAIChat({ baseUrl: process.env.REACT_APP_API_ENDPOINT })
    ↓
env = production-us → https://api-us.company.com
env = production-eu → https://api-eu.company.com
env = production-ap → https://api-ap.company.com
    ↓
[Same client code, different backends]
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// Provider factory normalization
expect(normalizeAnthropicResponse(rawResponse)).toEqual({
  text: 'hello',
  raw: rawResponse,
  usage: {...}
});

// Retry logic
expect(retryCount).toBe(3);
expect(lastDelay).toBeCloseTo(4000, 500);

// Hook state management
expect(hook.isLoading).toBe(false);
expect(hook.messages).toHaveLength(2);
expect(hook.error).toBe(null);
```

### 11.2 Integration Tests

```typescript
// Multi-turn conversation
await sendMessage('Hello');
expect(messages).toHaveLength(2);
await sendMessage('How are you?');
expect(messages).toHaveLength(4);

// Provider switching
const chatWithOpenAI = useAIChat({ provider: 'openai' });
const chatWithClaude = useAIChat({ provider: 'anthropic' });
// Both should work with same API
```

### 11.3 E2E Tests

```typescript
// Real API call with credentials
const { messages } = useAIChat({ apiKey: realKey });
await sendMessage('test');
expect(messages[1].content).toMatch(/test|hello|hi/i);

// Rate limit retry behavior
// (Send 10+ requests in quick succession)
// Expect all eventually succeed with retries
```

---

## 12. Version & Compatibility

| Component | Min Version | Notes |
|-----------|---|---|
| React | 18.0.0 | Hooks required |
| React Native | 0.70.0 | Fetch API required |
| Node.js | 14.0.0 | For builds |
| TypeScript | 4.5.0+ | For types |

---

**Specification Version:** 1.0  
**Last Updated:** April 13, 2026  
**Status:** Complete and Production Ready

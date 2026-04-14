/**
 * React Native AI Hooks - Production Architecture
 * 
 * This file documents the complete internal architecture of the react-native-ai-hooks
 * library, designed for type-safety, multi-provider support, and optimal performance.
 */

/**
 * CORE ARCHITECTURE PRINCIPLES
 * ============================
 * 
 * 1. Provider Abstraction Layer
 *    - All API calls go through ProviderFactory
 *    - Supports Anthropic, OpenAI, Gemini with uniform interface
 *    - Easy to extend with new providers
 * 
 * 2. Unified Response Normalization
 *    - Every provider returns standardized AIResponse object
 *    - Includes text content, raw response, and token usage
 *    - Enables seamless provider switching
 * 
 * 3. Resilience & Retry Logic
 *    - fetchWithRetry handles exponential backoff
 *    - Automatic rate-limit (429) handling with Retry-After header
 *    - Timeout support using AbortController
 *    - Configurable max retries and delays
 * 
 * 4. Performance Optimization
 *    - useMemo for provider config to prevent recreations
 *    - useCallback for all callback functions
 *    - Proper cleanup for abort controllers and timers
 *    - Minimal re-renders through optimized dependencies
 * 
 * 5. Error Handling Consistency
 *    - All hooks follow same error pattern
 *    - Errors caught and stored in hook state
 *    - Abort errors handled gracefully (no-op vs throw)
 * 
 * 
 * PROVIDER FACTORY ARCHITECTURE
 * =============================
 * 
 * The ProviderFactory class (src/utils/providerFactory.ts) is the central hub
 * for all API communications. It:
 * 
 * - Normalizes request/response formats across providers
 * - Handles authentication (API keys, OAuth for different providers)
 * - Manages baseUrl configuration for proxy/backend integration
 * - Applies consistent rate-limit and timeout handling
 * 
 * Usage:
 *   const provider = createProvider({
 *     provider: 'anthropic',
 *     apiKey: 'your-key',
 *     model: 'claude-sonnet-4-20250514',
 *     baseUrl: 'https://your-proxy.com', // Optional
 *     timeout: 30000,
 *     maxRetries: 3
 *   });
 * 
 *   const response = await provider.makeRequest({
 *     prompt: 'Hello, world!',
 *     options: { temperature: 0.7, maxTokens: 1024 },
 *     context: [] // Previous messages
 *   });
 * 
 * Response Structure:
 *   {
 *     text: string,           // The AI response
 *     raw: object,            // Raw provider response
 *     usage: {
 *       inputTokens?: number,
 *       outputTokens?: number,
 *       totalTokens?: number
 *     }
 *   }
 * 
 * 
 * FETCH WITH RETRY UTILITY
 * ========================
 * 
 * The fetchWithRetry function (src/utils/fetchWithRetry.ts) wraps fetch with:
 * 
 * - Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
 * - Max delay cap: prevents excessive wait times
 * - Rate limit handling: respects Retry-After header (429 status)
 * - Timeout support: AbortController with configurable timeout
 * - Server error retries: automatic retry on 5xx errors
 * 
 * Configuration:
 *   {
 *     maxRetries: 3,              // Total attempts
 *     baseDelay: 1000,            // Initial delay (ms)
 *     maxDelay: 10000,            // Cap delay (ms)
 *     timeout: 30000,             // Per-request timeout (ms)
 *     backoffMultiplier: 2        // Exponential backoff factor
 *   }
 * 
 * 
 * HOOK ARCHITECTURE
 * =================
 * 
 * All hooks follow a consistent pattern:
 * 
 * 1. useAIChat - Multi-turn conversations
 *    - Manages message history
 *    - Auto-includes system prompt and context
 *    - Returns messages array + send/abort/clear functions
 * 
 * 2. useAIStream - Real-time token streaming
 *    - Streams responses token-by-token
 *    - Handles both Anthropic and OpenAI stream formats
 *    - Supports abort and cleanup
 * 
 * 3. useAIForm - Form validation against AI schema
 *    - Validates entire form at once
 *    - Parses AI response into errors object
 *    - Returns FormValidationResult with isValid flag
 * 
 * 4. useImageAnalysis - Vision model integration
 *    - Accepts URI or base64 image
 *    - Supports Anthropic and OpenAI vision models
 *    - Auto-converts URIs to base64
 * 
 * 5. useAITranslate - Real-time translation
 *    - Auto-detects source language
 *    - Supports configurable target language
 *    - Debounced auto-translate option
 * 
 * 6. useAISummarize - Text summarization
 *    - Adjustable summary length (short/medium/long)
 *    - Maintains text accuracy and fidelity
 * 
 * 7. useAICode - Code generation and explanation
 *    - Generate code in any language
 *    - Explain existing code with focus options
 * 
 * 
 * TYPE DEFINITIONS
 * ================
 * 
 * Core types (src/types/index.ts):
 * 
 * - Message: Single message object with role, content, timestamp
 * - AIProviderType: Union of 'anthropic' | 'openai' | 'gemini'
 * - ProviderConfig: Configuration for creating providers
 * - AIResponse: Normalized response structure
 * - AIRequestOptions: Parameters for AI requests
 * - UseAI*Options: Hook configuration interfaces
 * - UseAI*Return: Hook return type interfaces
 * - FormValidationRequest/Result: Form validation types
 * - *Response: Provider-specific response interfaces
 * 
 * 
 * MULTI-PROVIDER SUPPORT
 * ======================
 * 
 * Supported Providers:
 * 
 * Provider    | Base URL                           | Auth Header
 * ------------|------------------------------------|-----------------------
 * Anthropic   | api.anthropic.com/v1/messages      | x-api-key
 * OpenAI      | api.openai.com/v1/chat/completions | Authorization: Bearer
 * Gemini      | generativelanguage.googleapis.com   | Key in URL param
 * 
 * To use different provider:
 *   const { sendMessage } = useAIChat({
 *     apiKey: 'your-key',
 *     provider: 'openai',  // ← Change provider
 *     model: 'gpt-4'       // ← Use provider-specific model
 *   });
 * 
 * Router automatically selects matching endpoint and auth method.
 * 
 * 
 * SECURITY BEST PRACTICES
 * =======================
 * 
 * 1. API Key Management
 *    - Store keys in environment variables, never hardcode
 *    - Consider passing through backend proxy (baseUrl option)
 * 
 * 2. Backend Proxy Pattern
 *    - Set baseUrl to your backend endpoint
 *    - Backend validates and authenticates requests
 *    - Example: https://my-api.com/ai (then /v1/messages appended)
 * 
 * 3. Rate Limiting
 *    - All providers have rate limits
 *    - fetchWithRetry handles 429 responses automatically
 *    - Implement customer-side throttling for high-volume apps
 * 
 * 4. Timeout Configuration
 *    - Default: 30 seconds per request
 *    - Adjust based on model complexity and network
 *    - Lower timeout for real-time UX requirements
 * 
 * 
 * PERFORMANCE TUNING
 * ==================
 * 
 * 1. Hook Dependencies
 *    - Memoized provider configs via useMemo
 *    - Wrapped callbacks with useCallback
 *    - Deps list carefully curated to prevent recreations
 * 
 * 2. Message Management
 *    - Store message history in component state
 *    - Consider pagination for large conversations
 *    - useCallback for sendMessage prevents parent re-renders
 * 
 * 3. Streaming Performance
 *    - Streaming in useAIStream is incremental
 *    - Response state updates are batched by React
 *    - Large responses streamed smoothly token-by-token
 * 
 * 4. Image Analysis
 *    - Image conversion to base64 happens async
 *    - Large images may take time to convert
 *    - Consider file size limits on client-side
 * 
 * 
 * EXTENDING THE LIBRARY
 * =====================
 * 
 * To add a new AI provider:
 * 
 * 1. Add provider type to AIProviderType union
 * 2. Implement makeXyzRequest method in ProviderFactory
 * 3. Implement normalizeXyzResponse method
 * 4. Add default model to DEFAULT_MODEL_MAP in hooks
 * 5. Test with all hook types
 * 
 * To add a new hook:
 * 
 * 1. Define UseAIXyzOptions interface in types
 * 2. Define UseAIXyzReturn interface in types
 * 3. Create src/hooks/useAIXyz.ts
 * 4. Use ProviderFactory for all API calls
 * 5. Follow same error/loading/cleanup patterns
 * 6. Export from src/index.ts
 * 
 * 
 * ERROR HANDLING PATTERNS
 * =======================
 * 
 * All hooks follow this pattern:
 * 
 *   try {
 *     // API call via ProviderFactory
 *   } catch (err) {
 *     if (isMountedRef.current) {
 *       setError(err.message);
 *     }
 *   } finally {
 *     if (isMountedRef.current) {
 *       setIsLoading(false);
 *     }
 *   }
 * 
 * The isMountedRef prevents state updates on unmounted components.
 * 
 * 
 * STREAMING IMPLEMENTATION
 * ========================
 * 
 * Streaming works by parsing newline-delimited JSON from response.body:
 * 
 * Anthropic Format:
 *   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}
 * 
 * OpenAI Format:
 *   data: {"choices":[{"delta":{"content":"hello"}}]}
 * 
 * Both formats handled in useAIStream with provider-specific parsing.
 * 
 * 
 * TESTING STRATEGY
 * ================
 * 
 * Unit tests should verify:
 * - Provider factory normalization for each provider
 * - Retry logic with mock fetch
 * - Hook state management (loading, error, data)
 * - Callback cleanup on unmount
 * - JSON parsing in form validation
 * 
 * Integration tests should verify:
 * - Multi-turn conversation flow
 * - Image analysis with different mime types
 * - Form validation with complex schemas
 * - Streaming response handling
 * 
 * E2E tests should verify:
 * - Real API calls with live keys
 * - Provider switching credentials
 * - Rate limit retry behavior
 * - Error recovery workflows
 */

export {};

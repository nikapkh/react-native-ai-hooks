/**
 * Core Message Types
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/**
 * AI Provider Types
 */
export type AIProviderType = 'anthropic' | 'openai' | 'gemini';

export interface ProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Standardized API Response
 */
export interface AIResponse {
  text: string;
  raw: Record<string, unknown>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: string;
}

/**
 * API Request Options
 */
export interface AIRequestOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Hook Options Interface
 */
export interface UseAIChatOptions {
  apiKey: string;
  provider?: AIProviderType;
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface UseAIStreamOptions extends UseAIChatOptions {}

export interface UseAIFormOptions {
  apiKey: string;
  provider?: AIProviderType;
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface UseImageAnalysisOptions {
  apiKey: string;
  provider?: AIProviderType;
  model?: string;
  system?: string;
  maxTokens?: number;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  uriToBase64?: (uri: string) => Promise<string>;
}

/**
 * Normalized Internal API Structures
 */
export interface NormalizedMessage {
  role: 'user' | 'assistant';
  content: NormalizedContent;
}

export type NormalizedContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | Array<NormalizedContent>;

/**
 * Provider-Specific Raw Responses
 */
export interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { type: string; message?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Form Validation Input/Output
 */
export interface FormValidationRequest {
  formData: Record<string, unknown>;
  validationSchema?: Record<string, string>;
  customInstructions?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  raw: unknown;
}

/**
 * Generic Hook Return Types
 */
export interface UseAIChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  abort: () => void;
  clearMessages: () => void;
}

export interface UseAIStreamReturn {
  response: string;
  isLoading: boolean;
  error: string | null;
  streamResponse: (prompt: string) => Promise<void>;
  abort: () => void;
  clearResponse: () => void;
}

export interface UseImageAnalysisReturn {
  description: string;
  isLoading: boolean;
  error: string | null;
  analyzeImage: (uri: string, prompt?: string) => Promise<string | null>;
  clearDescription: () => void;
}

export interface UseAIFormReturn {
  validationResult: FormValidationResult | null;
  isLoading: boolean;
  error: string | null;
  validateForm: (input: FormValidationRequest) => Promise<FormValidationResult | null>;
  clearValidation: () => void;
}
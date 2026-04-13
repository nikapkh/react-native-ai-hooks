export { useAIChat } from './hooks/useAIChat';
export { useAIStream } from './hooks/useAIStream';
export { useImageAnalysis } from './hooks/useImageAnalysis';
export { useAIForm } from './hooks/useAIForm';
export { useAIVoice } from './hooks/useAIVoice';
export { useAITranslate } from './hooks/useAITranslate';
export { useAISummarize } from './hooks/useAISummarize';
export { useAICode } from './hooks/useAICode';

// Type exports
export type {
  Message,
  AIProviderType,
  ProviderConfig,
  AIResponse,
  AIRequestOptions,
  UseAIChatOptions,
  UseAIChatReturn,
  UseAIStreamOptions,
  UseAIStreamReturn,
  UseImageAnalysisOptions,
  UseImageAnalysisReturn,
  UseAIFormOptions,
  UseAIFormReturn,
  FormValidationRequest,
  FormValidationResult,
} from './types';

// Utility exports for advanced use cases
export { createProvider, ProviderFactory } from './utils/providerFactory';
export { fetchWithRetry } from './utils/fetchWithRetry';
export type { AIResponse, AIRequestOptions } from './utils/providerFactory';
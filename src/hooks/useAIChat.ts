import { useCallback, useRef, useState, useMemo } from 'react';
import type { Message, UseAIChatOptions, UseAIChatReturn } from '../types';
import { createProvider } from '../utils/providerFactory';

const DEFAULT_MODEL_MAP = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4',
  gemini: 'gemini-pro',
};

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Memoize provider config to prevent unnecessary recreations
  const providerConfig = useMemo(
    () => ({
      provider: (options.provider || 'anthropic') as 'anthropic' | 'openai' | 'gemini',
      apiKey: options.apiKey,
      model: options.model || DEFAULT_MODEL_MAP[options.provider || 'anthropic'],
      baseUrl: options.baseUrl,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    }),
    [options],
  );

  const provider = useMemo(() => createProvider(providerConfig), [providerConfig]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        setError('Message cannot be empty');
        return;
      }

      setError(null);
      const userMessage: Message = {
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev: Message[]) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const aiResponse = await provider.makeRequest({
          prompt: content,
          options: {
            system: options.system,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
          context: messages.map((msg: Message) => ({
            role: msg.role,
            content: msg.content,
          })),
        });

        const assistantMessage: Message = {
          role: 'assistant',
          content: aiResponse.text,
          timestamp: Date.now(),
        };

        if (isMountedRef.current) {
          setMessages((prev: Message[]) => [...prev, assistantMessage]);
        }
      } catch (err) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to send message';
          setError(message);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [provider, messages, options],
  );

  // Cleanup on unmount
  useState(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    abort,
    clearMessages,
  };
}
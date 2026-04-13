import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { UseAIStreamOptions, UseAIStreamReturn } from '../types';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const DEFAULT_MODEL_MAP = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4',
  gemini: 'gemini-pro',
};

export function useAIStream(options: UseAIStreamOptions): UseAIStreamReturn {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const providerConfig = useMemo(
    () => ({
      provider: options.provider || 'anthropic',
      apiKey: options.apiKey,
      model: options.model || DEFAULT_MODEL_MAP[options.provider || 'anthropic'],
      baseUrl: options.baseUrl,
    }),
    [options],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, []);

  const clearResponse = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);

  const streamResponse = useCallback(
    async (prompt: string) => {
      abort();
      setResponse('');
      setError(null);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        let url = '';
        let body: Record<string, unknown> = {};
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (providerConfig.provider === 'anthropic') {
          url = `${providerConfig.baseUrl || 'https://api.anthropic.com'}/v1/messages`;
          headers['x-api-key'] = options.apiKey;
          headers['anthropic-version'] = '2023-06-01';
          body = {
            model: providerConfig.model,
            max_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.7,
            stream: true,
            system: options.system,
            messages: [{ role: 'user', content: prompt }],
          };
        } else if (providerConfig.provider === 'openai') {
          url = `${providerConfig.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
          headers.Authorization = `Bearer ${options.apiKey}`;
          body = {
            model: providerConfig.model,
            max_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.7,
            stream: true,
            system: options.system,
            messages: [{ role: 'user', content: prompt }],
          };
        } else {
          throw new Error(`Streaming not supported for provider: ${providerConfig.provider}`);
        }

        const apiResponse = await fetchWithRetry(
          url,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          },
          {
            timeout: options.timeout || 30000,
            maxRetries: options.maxRetries ?? 3,
          },
        );

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(errorText || `API error: ${apiResponse.status}`);
        }

        if (!apiResponse.body) {
          throw new Error('Streaming not supported in this environment');
        }

        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);

              if (providerConfig.provider === 'anthropic') {
                if (
                  parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  typeof parsed.delta.text === 'string'
                ) {
                  if (isMountedRef.current) {
                    setResponse((prev: string) => prev + parsed.delta.text);
                  }
                }
              } else if (providerConfig.provider === 'openai') {
                if (
                  parsed.choices?.[0]?.delta?.content &&
                  typeof parsed.choices[0].delta.content === 'string'
                ) {
                  if (isMountedRef.current) {
                    setResponse((prev: string) => prev + parsed.choices[0].delta.content);
                  }
                }
              }
            } catch {
              // Ignore malformed stream chunks
            }
          }
        }
      } catch (err) {
        if (isMountedRef.current && (err as Error).name !== 'AbortError') {
          const message = err instanceof Error ? err.message : 'Failed to stream response';
          setError(message);
        }
      } finally {
        abortControllerRef.current = null;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [abort, options, providerConfig],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    response,
    isLoading,
    error,
    streamResponse,
    abort,
    clearResponse,
  };
}
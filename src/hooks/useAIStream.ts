import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAIStreamOptions {
  apiKey: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

interface UseAIStreamReturn {
  response: string;
  isLoading: boolean;
  error: string | null;
  streamResponse: (prompt: string) => Promise<void>;
  abortStream: () => void;
  clearResponse: () => void;
}

export function useAIStream(options: UseAIStreamOptions): UseAIStreamReturn {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const clearResponse = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);

  const streamResponse = useCallback(
    async (prompt: string) => {
      abortStream();
      setResponse('');
      setError(null);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: options.model || 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.7,
            stream: true,
            system: options.system,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(errorText || `Claude API error: ${apiResponse.status}`);
        }

        if (!apiResponse.body) {
          throw new Error('Streaming is not supported in this environment.');
        }

        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line || !line.startsWith('data:')) {
              continue;
            }

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(payload);
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta' &&
                typeof parsed.delta.text === 'string'
              ) {
                setResponse(prev => prev + parsed.delta.text);
              }
            } catch {
              // Ignore malformed stream chunks and keep consuming the stream.
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || 'Failed to stream response');
        }
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [abortStream, options],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    response,
    isLoading,
    error,
    streamResponse,
    abortStream,
    clearResponse,
  };
}
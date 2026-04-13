import { useCallback, useState, useRef, useMemo } from 'react';
import type { UseImageAnalysisOptions, UseImageAnalysisReturn } from '../types';
import { createProvider } from '../utils/providerFactory';

const DEFAULT_MODEL_MAP = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4-vision',
  gemini: 'gemini-pro-vision',
};

const DATA_URI_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/;

function getMediaTypeFromUri(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.includes('.png')) return 'image/png';
  if (normalized.includes('.webp')) return 'image/webp';
  if (normalized.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa !== 'function') {
    throw new Error('Base64 conversion unavailable. Provide uriToBase64 in hook options.');
  }

  return btoa(binary);
}

async function defaultUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read image from URI: ${response.status}`);
  }

  const imageBuffer = await response.arrayBuffer();
  return arrayBufferToBase64(imageBuffer);
}

/**
 * Analyzes an image with a vision-capable model and stores the generated description.
 *
 * @param options Vision configuration including provider credentials, model selection,
 * request limits, and optional URI-to-base64 conversion for React Native environments.
 * @returns Image analysis state with the latest description, loading/error flags, and
 * actions to analyze a new image or clear the stored description.
 */
export function useImageAnalysis(options: UseImageAnalysisOptions): UseImageAnalysisReturn {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

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

  const normalizeImage = useCallback(
    async (image: string, mediaType?: string): Promise<{ base64: string; mediaType: string }> => {
      const dataUriMatch = image.match(DATA_URI_REGEX);
      if (dataUriMatch) {
        return {
          base64: dataUriMatch[2],
          mediaType: mediaType || dataUriMatch[1],
        };
      }

      const isLikelyUri = /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|assets-library:\/\/)/i.test(image);

      if (isLikelyUri) {
        const toBase64 = options.uriToBase64 || defaultUriToBase64;
        const base64 = await toBase64(image);
        return {
          base64,
          mediaType: mediaType || getMediaTypeFromUri(image),
        };
      }

      return {
        base64: image,
        mediaType: mediaType || 'image/jpeg',
      };
    },
    [options.uriToBase64],
  );

  const clearDescription = useCallback(() => {
    setDescription('');
    setError(null);
  }, []);

  const analyzeImage = useCallback(
    async (uri: string, prompt?: string) => {
      if (!uri) {
        setError('Image URI is required');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing API key');
        return null;
      }

      setError(null);
      setIsLoading(true);

      try {
        const imagData = await normalizeImage(uri);
        const analysisPrompt = prompt || 'Describe this image in detail.';

        const base_url = providerConfig.baseUrl || 'https://api.anthropic.com';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        let url = '';
        let body: Record<string, unknown> = {};

        if (providerConfig.provider === 'anthropic') {
          url = `${base_url}/v1/messages`;
          headers['x-api-key'] = options.apiKey;
          headers['anthropic-version'] = '2023-06-01';
          body = {
            model: providerConfig.model,
            max_tokens: options.maxTokens ?? 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: imagData.mediaType,
                      data: imagData.base64,
                    },
                  },
                  {
                    type: 'text',
                    text: analysisPrompt,
                  },
                ],
              },
            ],
          };
        } else if (providerConfig.provider === 'openai') {
          url = `${providerConfig.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
          headers.Authorization = `Bearer ${options.apiKey}`;
          body = {
            model: providerConfig.model,
            max_tokens: options.maxTokens ?? 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${imagData.mediaType};base64,${imagData.base64}`,
                    },
                  },
                  {
                    type: 'text',
                    text: analysisPrompt,
                  },
                ],
              },
            ],
          };
        } else {
          throw new Error(`Image analysis not supported for provider: ${providerConfig.provider}`);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `API error: ${response.status}`);
        }

        const data = await response.json();
        let resultText = '';

        if (providerConfig.provider === 'anthropic') {
          resultText = data?.content?.[0]?.text || '';
        } else if (providerConfig.provider === 'openai') {
          resultText = data?.choices?.[0]?.message?.content || '';
        }

        if (!resultText) {
          throw new Error('No description returned by vision API');
        }

        if (isMountedRef.current) {
          setDescription(resultText);
        }
        return resultText;
      } catch (err) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to analyze image';
          setError(message);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [normalizeImage, options, providerConfig],
  );

  useState(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    description,
    isLoading,
    error,
    analyzeImage,
    clearDescription,
  };
}
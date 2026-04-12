import { useCallback, useState } from 'react';

interface UseImageAnalysisOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  system?: string;
  uriToBase64?: (uri: string) => Promise<string>;
}

interface AnalyzeImageInput {
  image: string;
  mediaType?: string;
  prompt?: string;
}

interface UseImageAnalysisReturn {
  description: string;
  isLoading: boolean;
  error: string | null;
  analyzeImage: (input: AnalyzeImageInput) => Promise<string | null>;
  clearDescription: () => void;
}

interface ParsedImageData {
  base64: string;
  mediaType: string;
}

const DATA_URI_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/;

function getMediaTypeFromUri(uri: string): string {
  const normalized = uri.toLowerCase();

  if (normalized.includes('.png')) {
    return 'image/png';
  }
  if (normalized.includes('.webp')) {
    return 'image/webp';
  }
  if (normalized.includes('.gif')) {
    return 'image/gif';
  }

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
    throw new Error('Base64 conversion is unavailable. Provide uriToBase64 in hook options.');
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

export function useImageAnalysis(options: UseImageAnalysisOptions): UseImageAnalysisReturn {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeImage = useCallback(
    async (image: string, mediaType?: string): Promise<ParsedImageData> => {
      const dataUriMatch = image.match(DATA_URI_REGEX);
      if (dataUriMatch) {
        const matchedMediaType = dataUriMatch[1];
        const base64Data = dataUriMatch[2];
        return {
          base64: base64Data,
          mediaType: mediaType || matchedMediaType,
        };
      }

      const isLikelyUri = /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|assets-library:\/\/)/i.test(
        image,
      );

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
    async (input: AnalyzeImageInput) => {
      setIsLoading(true);
      setError(null);

      try {
        const parsedImage = await normalizeImage(input.image, input.mediaType);

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
            system: options.system,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: parsedImage.mediaType,
                      data: parsedImage.base64,
                    },
                  },
                  {
                    type: 'text',
                    text: input.prompt || 'Describe this image in detail.',
                  },
                ],
              },
            ],
          }),
        });

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(errorText || `Claude API error: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        const textResult = data?.content?.find?.(
          (item: { type?: string; text?: string }) => item?.type === 'text',
        )?.text;

        if (!textResult) {
          throw new Error('No description returned from Claude vision API.');
        }

        setDescription(textResult);
        return textResult;
      } catch (err) {
        const message = (err as Error).message || 'Failed to analyze image';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [normalizeImage, options],
  );

  return {
    description,
    isLoading,
    error,
    analyzeImage,
    clearDescription,
  };
}
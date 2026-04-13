import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAITranslateOptions {
  apiKey: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  initialTargetLanguage?: string;
  autoTranslate?: boolean;
  debounceMs?: number;
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
}

interface UseAITranslateReturn {
  sourceText: string;
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
  isTranslating: boolean;
  error: string | null;
  setSourceText: (text: string) => void;
  setTargetLanguage: (language: string) => void;
  translateText: (overrideText?: string) => Promise<TranslationResult | null>;
  clearTranslation: () => void;
}

interface ClaudeTextBlock {
  type?: string;
  text?: string;
}

interface ClaudeApiResult {
  content?: ClaudeTextBlock[];
  error?: {
    message?: string;
  };
}

function getClaudeTextContent(data: unknown): string {
  const content = (data as ClaudeApiResult)?.content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter(item => item?.type === 'text' && typeof item.text === 'string')
    .map(item => item.text as string)
    .join('\n')
    .trim();
}

function parseJsonFromText<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(candidate) as T;
}

/**
 * Translates source text into a target language with optional automatic debounced translation.
 *
 * @param options Translation configuration including API key, model/system settings,
 * temperature/token controls, initial target language, and auto-translate behavior.
 * @returns Translation state with source/translated text, detected source language,
 * target language, status/error flags, and actions to update text/language, translate,
 * or reset translation state.
 */
export function useAITranslate(options: UseAITranslateOptions): UseAITranslateReturn {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(options.initialTargetLanguage || 'English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const clearTranslation = useCallback(() => {
    setSourceText('');
    setTranslatedText('');
    setDetectedSourceLanguage('');
    setError(null);
  }, []);

  const translateText = useCallback(
    async (overrideText?: string) => {
      const textToTranslate = (overrideText ?? sourceText).trim();

      if (!textToTranslate) {
        setError('No text to translate.');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing Claude API key.');
        return null;
      }

      setIsTranslating(true);
      setError(null);

      try {
        const prompt = [
          'Detect source language and translate text.',
          'Return JSON only using this schema:',
          '{"detectedSourceLanguage":"string","targetLanguage":"string","translatedText":"string"}',
          `Target language: ${targetLanguage}`,
          'Text:',
          textToTranslate,
        ].join('\n');

        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: options.model || 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens ?? 800,
            temperature: options.temperature ?? 0.2,
            system:
              options.system ||
              'You are a translation assistant. Always detect source language and translate accurately. Return valid JSON only.',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        const data = (await apiResponse.json()) as ClaudeApiResult;
        if (!apiResponse.ok) {
          throw new Error(data?.error?.message || `Claude API error: ${apiResponse.status}`);
        }

        const text = getClaudeTextContent(data);
        if (!text) {
          throw new Error('No translation returned by Claude API.');
        }

        const parsed = parseJsonFromText<{
          translatedText?: string;
          detectedSourceLanguage?: string;
          targetLanguage?: string;
        }>(text);

        const result: TranslationResult = {
          translatedText: parsed?.translatedText?.trim() || '',
          detectedSourceLanguage: parsed?.detectedSourceLanguage?.trim() || 'Unknown',
          targetLanguage: parsed?.targetLanguage?.trim() || targetLanguage,
        };

        if (!result.translatedText) {
          throw new Error('Invalid translation format returned by Claude API.');
        }

        setTranslatedText(result.translatedText);
        setDetectedSourceLanguage(result.detectedSourceLanguage);
        return result;
      } catch (err) {
        const message = (err as Error).message || 'Failed to translate text';
        setError(message);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsTranslating(false);
        }
      }
    },
    [options.apiKey, options.maxTokens, options.model, options.system, options.temperature, sourceText, targetLanguage],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (options.autoTranslate === false) {
      return;
    }

    const text = sourceText.trim();
    if (!text) {
      setTranslatedText('');
      setDetectedSourceLanguage('');
      return;
    }

    const timer = setTimeout(() => {
      translateText(text).catch(() => undefined);
    }, options.debounceMs ?? 500);

    return () => clearTimeout(timer);
  }, [options.autoTranslate, options.debounceMs, sourceText, targetLanguage, translateText]);

  return {
    sourceText,
    translatedText,
    detectedSourceLanguage,
    targetLanguage,
    isTranslating,
    error,
    setSourceText,
    setTargetLanguage,
    translateText,
    clearTranslation,
  };
}

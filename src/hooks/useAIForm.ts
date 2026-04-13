import { useCallback, useRef, useState, useMemo } from 'react';
import type { UseAIFormOptions, UseAIFormReturn, FormValidationRequest, FormValidationResult } from '../types';
import { createProvider } from '../utils/providerFactory';

const DEFAULT_MODEL_MAP = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4',
  gemini: 'gemini-pro',
};

function parseJsonFromText<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(candidate) as T;
}

/**
 * Validates form payloads using an AI model and returns structured validation errors.
 *
 * @param options Validation configuration including provider, API key, model, transport
 * settings, and generation controls used when composing validation prompts.
 * @returns Form validation state containing the latest validation result,
 * loading/error indicators, and actions to validate data or clear prior results.
 */
export function useAIForm(options: UseAIFormOptions): UseAIFormReturn {
  const [validationResult, setValidationResult] = useState<FormValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
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

  const provider = useMemo(() => createProvider(providerConfig), [providerConfig]);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setError(null);
  }, []);

  const validateForm = useCallback(
    async (input: FormValidationRequest): Promise<FormValidationResult | null> => {
      if (!input.formData || Object.keys(input.formData).length === 0) {
        setError('Form data is empty');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing API key');
        return null;
      }

      setError(null);
      setIsLoading(true);

      try {
        const schemaText = input.validationSchema ? JSON.stringify(input.validationSchema) : 'Use common validation best practices';
        const prompt = [
          'Validate the following form data.',
          'Return ONLY valid JSON with this schema: {"errors": {"fieldName": "errorMessage"}}',
          'If all fields are valid, return: {"errors": {}}',
          `Validation schema: ${schemaText}`,
          `Custom instructions: ${input.customInstructions || 'None'}`,
          'Form data:',
          JSON.stringify(input.formData),
        ].join('\n');

        const aiResponse = await provider.makeRequest({
          prompt,
          options: {
            system:
              options.system ||
              'You are a form validation assistant. Return ONLY valid JSON responses, no markdown or explanations.',
            temperature: options.temperature ?? 0.2,
            maxTokens: options.maxTokens ?? 800,
          },
        });

        const parsed = parseJsonFromText<{ errors?: Record<string, string> }>(aiResponse.text);
        const errors = parsed?.errors || {};
        const isValid = Object.keys(errors).length === 0;

        const result: FormValidationResult = {
          isValid,
          errors,
          raw: parsed,
        };

        if (isMountedRef.current) {
          setValidationResult(result);
        }
        return result;
      } catch (err) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to validate form';
          setError(message);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [provider, options],
  );

  useState(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    validationResult,
    isLoading,
    error,
    validateForm,
    clearValidation,
  };
}
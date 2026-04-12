import { useCallback, useRef, useState } from 'react';

interface UseAIFormOptions {
  apiKey: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ValidateFieldInput {
  fieldName: string;
  value: string;
  formData?: Record<string, string>;
  validationRule?: string;
}

interface AutocompleteFieldInput {
  fieldName: string;
  value: string;
  formData?: Record<string, string>;
  instruction?: string;
  maxSuggestions?: number;
}

interface AIFieldValidation {
  isValid: boolean;
  feedback: string;
  suggestion?: string;
}

interface UseAIFormReturn {
  validations: Record<string, AIFieldValidation>;
  autocomplete: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
  validateField: (input: ValidateFieldInput) => Promise<AIFieldValidation | null>;
  autocompleteField: (input: AutocompleteFieldInput) => Promise<string[] | null>;
  clearFormAI: () => void;
  cancelRequests: () => void;
}

function extractTextContent(data: unknown): string {
  const content = (data as { content?: Array<{ type?: string; text?: string }> })?.content;
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

export function useAIForm(options: UseAIFormOptions): UseAIFormReturn {
  const [validations, setValidations] = useState<Record<string, AIFieldValidation>>({});
  const [autocomplete, setAutocomplete] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validationAbortRef = useRef<AbortController | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);

  const cancelRequests = useCallback(() => {
    validationAbortRef.current?.abort();
    autocompleteAbortRef.current?.abort();
    validationAbortRef.current = null;
    autocompleteAbortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearFormAI = useCallback(() => {
    setValidations({});
    setAutocomplete({});
    setError(null);
  }, []);

  const sendClaudeRequest = useCallback(
    async (prompt: string, signal: AbortSignal) => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
            'You are a form assistant. Return precise, concise, JSON-only responses with no markdown unless explicitly requested.',
          messages: [{ role: 'user', content: prompt }],
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Claude API error: ${response.status}`);
      }

      return response.json();
    },
    [options],
  );

  const validateField = useCallback(
    async (input: ValidateFieldInput) => {
      validationAbortRef.current?.abort();
      const controller = new AbortController();
      validationAbortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const prompt = [
          'Validate this single form field and return JSON only.',
          'Schema: {"isValid": boolean, "feedback": string, "suggestion": string}',
          `Field: ${input.fieldName}`,
          `Value: ${input.value}`,
          `Rule: ${input.validationRule || 'Use common real-world validation best practices.'}`,
          `Other form values: ${JSON.stringify(input.formData || {})}`,
          'If valid, feedback should be short and positive. suggestion can be empty string.',
        ].join('\n');

        const data = await sendClaudeRequest(prompt, controller.signal);
        const text = extractTextContent(data);

        if (!text) {
          throw new Error('No validation content returned from Claude API.');
        }

        const parsed = parseJsonFromText<AIFieldValidation>(text);

        if (typeof parsed?.isValid !== 'boolean' || typeof parsed?.feedback !== 'string') {
          throw new Error('Invalid validation response format returned by Claude API.');
        }

        const result: AIFieldValidation = {
          isValid: parsed.isValid,
          feedback: parsed.feedback,
          suggestion: typeof parsed.suggestion === 'string' ? parsed.suggestion : undefined,
        };

        setValidations(prev => ({
          ...prev,
          [input.fieldName]: result,
        }));

        return result;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return null;
        }

        const message = (err as Error).message || 'Failed to validate field';
        setError(message);
        return null;
      } finally {
        validationAbortRef.current = null;
        setIsLoading(false);
      }
    },
    [sendClaudeRequest],
  );

  const autocompleteField = useCallback(
    async (input: AutocompleteFieldInput) => {
      autocompleteAbortRef.current?.abort();
      const controller = new AbortController();
      autocompleteAbortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const prompt = [
          'Generate form autocomplete suggestions for one field and return JSON only.',
          'Schema: {"suggestions": string[]}',
          `Field: ${input.fieldName}`,
          `Current value: ${input.value}`,
          `Max suggestions: ${input.maxSuggestions ?? 5}`,
          `Instruction: ${input.instruction || 'Provide useful, natural completions for this field value.'}`,
          `Other form values: ${JSON.stringify(input.formData || {})}`,
          'Suggestions should be unique, concise, and ordered best-first.',
        ].join('\n');

        const data = await sendClaudeRequest(prompt, controller.signal);
        const text = extractTextContent(data);

        if (!text) {
          throw new Error('No autocomplete content returned from Claude API.');
        }

        const parsed = parseJsonFromText<{ suggestions?: unknown }>(text);
        const suggestions = Array.isArray(parsed?.suggestions)
          ? parsed.suggestions.filter((item): item is string => typeof item === 'string')
          : [];

        const limitedSuggestions = suggestions.slice(0, input.maxSuggestions ?? 5);

        setAutocomplete(prev => ({
          ...prev,
          [input.fieldName]: limitedSuggestions,
        }));

        return limitedSuggestions;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return null;
        }

        const message = (err as Error).message || 'Failed to generate autocomplete suggestions';
        setError(message);
        return null;
      } finally {
        autocompleteAbortRef.current = null;
        setIsLoading(false);
      }
    },
    [sendClaudeRequest],
  );

  return {
    validations,
    autocomplete,
    isLoading,
    error,
    validateField,
    autocompleteField,
    clearFormAI,
    cancelRequests,
  };
}
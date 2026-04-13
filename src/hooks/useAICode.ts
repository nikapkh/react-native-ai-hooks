import { useCallback, useRef, useState } from 'react';

interface UseAICodeOptions {
  apiKey: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  defaultLanguage?: string;
}

interface GenerateCodeInput {
  prompt: string;
  language?: string;
}

interface ExplainCodeInput {
  code: string;
  language?: string;
  focus?: string;
}

interface UseAICodeReturn {
  language: string;
  generatedCode: string;
  explanation: string;
  isLoading: boolean;
  error: string | null;
  setLanguage: (language: string) => void;
  generateCode: (input: GenerateCodeInput) => Promise<string | null>;
  explainCode: (input: ExplainCodeInput) => Promise<string | null>;
  clearCodeState: () => void;
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

/**
 * Generates and explains code using an AI model while tracking language and request state.
 *
 * @param options Code assistant configuration including API key, model/system prompt,
 * token/temperature controls, and default programming language.
 * @returns Code assistant state with selected language, generated code, explanation text,
 * loading/error indicators, and actions to generate code, explain code, or clear outputs.
 */
export function useAICode(options: UseAICodeOptions): UseAICodeReturn {
  const [language, setLanguage] = useState(options.defaultLanguage || 'typescript');
  const [generatedCode, setGeneratedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const clearCodeState = useCallback(() => {
    setGeneratedCode('');
    setExplanation('');
    setError(null);
  }, []);

  const sendClaudeRequest = useCallback(
    async (prompt: string) => {
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options.model || 'claude-sonnet-4-20250514',
          max_tokens: options.maxTokens ?? 1800,
          temperature: options.temperature ?? 0.2,
          system:
            options.system ||
            'You are an expert software engineer. Produce practical, correct code and clear explanations.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = (await apiResponse.json()) as ClaudeApiResult;
      if (!apiResponse.ok) {
        throw new Error(data?.error?.message || `Claude API error: ${apiResponse.status}`);
      }

      const text = getClaudeTextContent(data);
      if (!text) {
        throw new Error('No content returned by Claude API.');
      }

      return text;
    },
    [options.apiKey, options.maxTokens, options.model, options.system, options.temperature],
  );

  const generateCode = useCallback(
    async (input: GenerateCodeInput) => {
      const taskPrompt = input.prompt.trim();
      const selectedLanguage = (input.language || language).trim();

      if (!taskPrompt) {
        setError('No code generation prompt provided.');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing Claude API key.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setLanguage(selectedLanguage);

      try {
        const prompt = [
          `Generate ${selectedLanguage} code for the following request:`,
          taskPrompt,
          'Return runnable code and include brief usage notes only when necessary.',
        ].join('\n');

        const result = await sendClaudeRequest(prompt);
        setGeneratedCode(result);
        return result;
      } catch (err) {
        const message = (err as Error).message || 'Failed to generate code';
        setError(message);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [language, options.apiKey, sendClaudeRequest],
  );

  const explainCode = useCallback(
    async (input: ExplainCodeInput) => {
      const code = input.code.trim();
      const selectedLanguage = (input.language || language).trim();

      if (!code) {
        setError('No code provided for explanation.');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing Claude API key.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setLanguage(selectedLanguage);

      try {
        const prompt = [
          `Explain the following ${selectedLanguage} code.`,
          input.focus ? `Focus: ${input.focus}` : 'Focus: logic, structure, and potential pitfalls.',
          'Code:',
          code,
        ].join('\n');

        const result = await sendClaudeRequest(prompt);
        setExplanation(result);
        return result;
      } catch (err) {
        const message = (err as Error).message || 'Failed to explain code';
        setError(message);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [language, options.apiKey, sendClaudeRequest],
  );

  return {
    language,
    generatedCode,
    explanation,
    isLoading,
    error,
    setLanguage,
    generateCode,
    explainCode,
    clearCodeState,
  };
}

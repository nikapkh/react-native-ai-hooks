import { useCallback, useRef, useState } from 'react';

type SummaryLength = 'short' | 'medium' | 'long';

interface UseAISummarizeOptions {
  apiKey: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  defaultLength?: SummaryLength;
}

interface SummarizeInput {
  text: string;
  length?: SummaryLength;
}

interface UseAISummarizeReturn {
  summary: string;
  length: SummaryLength;
  isLoading: boolean;
  error: string | null;
  setLength: (length: SummaryLength) => void;
  summarizeText: (input: SummarizeInput) => Promise<string | null>;
  clearSummary: () => void;
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

function lengthInstruction(length: SummaryLength): string {
  if (length === 'short') {
    return 'Produce a concise summary in 2-4 bullet points.';
  }

  if (length === 'long') {
    return 'Produce a detailed summary with key points, context, and implications in 3-5 short paragraphs.';
  }

  return 'Produce a balanced summary in 1-2 paragraphs plus a short bullet list of key takeaways.';
}

/**
 * Summarizes long-form text with selectable output length (short, medium, or long).
 *
 * @param options Summarization configuration including API key, model/system behavior,
 * token/temperature controls, and default summary length.
 * @returns Summarization state with current summary text, selected length,
 * loading/error indicators, and actions to set length, generate summaries, or clear output.
 */
export function useAISummarize(options: UseAISummarizeOptions): UseAISummarizeReturn {
  const [summary, setSummary] = useState('');
  const [length, setLength] = useState<SummaryLength>(options.defaultLength || 'medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const clearSummary = useCallback(() => {
    setSummary('');
    setError(null);
  }, []);

  const summarizeText = useCallback(
    async (input: SummarizeInput) => {
      const text = input.text.trim();
      const selectedLength = input.length || length;

      if (!text) {
        setError('No text provided for summarization.');
        return null;
      }

      if (!options.apiKey) {
        setError('Missing Claude API key.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setLength(selectedLength);

      try {
        const prompt = [
          'Summarize the following text.',
          lengthInstruction(selectedLength),
          'Text:',
          text,
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
            max_tokens: options.maxTokens ?? 1200,
            temperature: options.temperature ?? 0.3,
            system:
              options.system ||
              'You are an expert summarization assistant. Keep summaries faithful to source text and avoid fabrications.',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        const data = (await apiResponse.json()) as ClaudeApiResult;
        if (!apiResponse.ok) {
          throw new Error(data?.error?.message || `Claude API error: ${apiResponse.status}`);
        }

        const result = getClaudeTextContent(data);
        if (!result) {
          throw new Error('No summary returned by Claude API.');
        }

        setSummary(result);
        return result;
      } catch (err) {
        const message = (err as Error).message || 'Failed to summarize text';
        setError(message);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [length, options.apiKey, options.maxTokens, options.model, options.system, options.temperature],
  );

  return {
    summary,
    length,
    isLoading,
    error,
    setLength,
    summarizeText,
    clearSummary,
  };
}

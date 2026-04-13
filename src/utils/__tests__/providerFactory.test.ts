import { createProvider } from '../providerFactory';
import { fetchWithRetry } from '../fetchWithRetry';

jest.mock('../fetchWithRetry', () => ({
  fetchWithRetry: jest.fn(),
}));

describe('ProviderFactory', () => {
  const mockedFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

  const createResponse = (body: unknown): Response => {
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  };

  beforeEach(() => {
    mockedFetchWithRetry.mockReset();
  });

  it('normalizes Anthropic responses to the shared AIResponse shape', async () => {
    const anthropicRaw = {
      content: [{ type: 'text', text: 'Hello from Claude' }],
      usage: {
        input_tokens: 12,
        output_tokens: 34,
      },
    };

    mockedFetchWithRetry.mockResolvedValueOnce(createResponse(anthropicRaw));

    const provider = createProvider({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      model: 'claude-sonnet-4-20250514',
    });

    const result = await provider.makeRequest({
      prompt: 'Say hello',
      options: { maxTokens: 256, temperature: 0.2 },
    });

    expect(result).toEqual({
      text: 'Hello from Claude',
      raw: anthropicRaw,
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
      },
    });

    expect(mockedFetchWithRetry).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'anthropic-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
      expect.objectContaining({
        timeout: 30000,
        maxRetries: 3,
      }),
    );
  });

  it('normalizes OpenAI responses to the shared AIResponse shape', async () => {
    const openAIRaw = {
      choices: [{ message: { content: 'Hello from GPT' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    mockedFetchWithRetry.mockResolvedValueOnce(createResponse(openAIRaw));

    const provider = createProvider({
      provider: 'openai',
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
    });

    const result = await provider.makeRequest({
      prompt: 'Say hello',
      options: { maxTokens: 128, temperature: 0.5 },
    });

    expect(result).toEqual({
      text: 'Hello from GPT',
      raw: openAIRaw,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    });

    expect(mockedFetchWithRetry).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer openai-key',
        }),
      }),
      expect.objectContaining({
        timeout: 30000,
        maxRetries: 3,
      }),
    );
  });
});

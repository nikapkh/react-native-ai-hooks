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

  const createErrorResponse = (status: number, body: unknown): Response => {
    return {
      ok: false,
      status,
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

    const [url, requestInit, retryOptions] = mockedFetchWithRetry.mock.calls[0];

    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer openai-key',
        }),
      }),
    );
    expect(retryOptions).toEqual(
      expect.objectContaining({
        timeout: 30000,
        maxRetries: 3,
      }),
    );

    const openAIBody = JSON.parse(String((requestInit as RequestInit).body));
    expect(openAIBody).toMatchObject({
      model: 'gpt-4o-mini',
      max_tokens: 128,
      temperature: 0.5,
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    expect(openAIBody.system).toBeUndefined();
  });

  it('prepends OpenAI system prompt into messages when provided', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        choices: [{ message: { content: 'ok' } }],
      }),
    );

    const provider = createProvider({
      provider: 'openai',
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
    });

    await provider.makeRequest({
      prompt: 'Say hello',
      context: [{ role: 'assistant', content: 'existing assistant context' }],
      options: {
        system: 'You are concise',
      },
    });

    const [, requestInit] = mockedFetchWithRetry.mock.calls[0];
    const openAIBody = JSON.parse(String((requestInit as RequestInit).body));

    expect(openAIBody.messages).toEqual([
      { role: 'system', content: 'You are concise' },
      { role: 'assistant', content: 'existing assistant context' },
      { role: 'user', content: 'Say hello' },
    ]);
    expect(openAIBody.system).toBeUndefined();
  });

  it('maps Gemini request configuration and normalizes Gemini responses', async () => {
    const geminiRaw = {
      candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
      usageMetadata: {
        promptTokenCount: 7,
        candidatesTokenCount: 9,
        totalTokenCount: 16,
      },
    };

    mockedFetchWithRetry.mockResolvedValueOnce(createResponse(geminiRaw));

    const provider = createProvider({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-1.5-pro',
      baseUrl: 'https://gemini-proxy.example.com',
      timeout: 45000,
      maxRetries: 5,
    });

    const result = await provider.makeRequest({
      prompt: 'Summarize this text',
      context: [{ role: 'assistant', content: 'Earlier response context' }],
      options: { maxTokens: 200, temperature: 0.3 },
    });

    expect(result).toEqual({
      text: 'Hello from Gemini',
      raw: geminiRaw,
      usage: {
        inputTokens: 7,
        outputTokens: 9,
        totalTokens: 16,
      },
    });

    const [url, requestInit, retryOptions] = mockedFetchWithRetry.mock.calls[0];

    expect(url).toBe(
      'https://gemini-proxy.example.com/v1beta/models/gemini-1.5-pro:generateContent?key=gemini-key',
    );
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(retryOptions).toEqual(
      expect.objectContaining({
        timeout: 45000,
        maxRetries: 5,
      }),
    );

    const geminiBody = JSON.parse(String((requestInit as RequestInit).body));
    expect(geminiBody).toMatchObject({
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.3,
      },
      contents: [
        {
          role: 'model',
          parts: [{ text: 'Earlier response context' }],
        },
        {
          role: 'user',
          parts: [{ text: 'Summarize this text' }],
        },
      ],
    });
  });

  it('throws on unknown provider values in both URL routing and request routing', async () => {
    const provider = createProvider({
      provider: 'anthropic',
      apiKey: 'key',
      model: 'model',
    }) as unknown as {
      config: { provider: string };
      getBaseUrl: () => string;
      makeRequest: (request: { prompt: string }) => Promise<unknown>;
    };

    provider.config.provider = 'unknown';

    expect(() => provider.getBaseUrl()).toThrow('Unknown provider: unknown');
    await expect(provider.makeRequest({ prompt: 'hello' })).rejects.toThrow('Unknown provider: unknown');
  });

  it('maps provider API error payloads to thrown errors', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(401, {
        error: { message: 'Anthropic invalid key' },
      }),
    );

    const anthropicProvider = createProvider({
      provider: 'anthropic',
      apiKey: 'bad-key',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(anthropicProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('Anthropic invalid key');

    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(401, {
        error: { message: 'OpenAI invalid key' },
      }),
    );

    const openAIProvider = createProvider({
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'gpt-4o-mini',
    });

    await expect(openAIProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('OpenAI invalid key');

    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(429, {
        error: { message: 'Gemini rate limited' },
      }),
    );

    const geminiProvider = createProvider({
      provider: 'gemini',
      apiKey: 'bad-key',
      model: 'gemini-1.5-pro',
    });

    await expect(geminiProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('Gemini rate limited');
  });

  it('falls back to status-based messages when provider error payloads have no message', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(500, {
        error: {},
      }),
    );

    const anthropicProvider = createProvider({
      provider: 'anthropic',
      apiKey: 'bad-key',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(anthropicProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');

    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(502, {
        error: {},
      }),
    );

    const openAIProvider = createProvider({
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'gpt-4o-mini',
    });

    await expect(openAIProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');

    mockedFetchWithRetry.mockResolvedValueOnce(
      createErrorResponse(503, {
        error: {},
      }),
    );

    const geminiProvider = createProvider({
      provider: 'gemini',
      apiKey: 'bad-key',
      model: 'gemini-1.5-pro',
    });

    await expect(geminiProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');
  });

  it('falls back to generic API error when provider error JSON parsing fails', async () => {
    const createMalformedErrorResponse = (status: number): Response =>
      ({
        ok: false,
        status,
        json: async () => {
          throw new Error('invalid json');
        },
        text: async () => 'bad payload',
      }) as unknown as Response;

    mockedFetchWithRetry.mockResolvedValueOnce(createMalformedErrorResponse(500));

    const anthropicProvider = createProvider({
      provider: 'anthropic',
      apiKey: 'bad-key',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(anthropicProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');

    mockedFetchWithRetry.mockResolvedValueOnce(createMalformedErrorResponse(500));

    const openAIProvider = createProvider({
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'gpt-4o-mini',
    });

    await expect(openAIProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');

    mockedFetchWithRetry.mockResolvedValueOnce(createMalformedErrorResponse(500));

    const geminiProvider = createProvider({
      provider: 'gemini',
      apiKey: 'bad-key',
      model: 'gemini-1.5-pro',
    });

    await expect(geminiProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('API error');
  });

  it('throws when provider payloads do not include text content', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        content: [{ type: 'image' }],
      }),
    );

    const anthropicProvider = createProvider({
      provider: 'anthropic',
      apiKey: 'key',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(anthropicProvider.makeRequest({ prompt: 'x' })).rejects.toThrow(
      'No text content returned by Anthropic API',
    );

    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        choices: [{ message: { content: '' } }],
      }),
    );

    const openAIProvider = createProvider({
      provider: 'openai',
      apiKey: 'key',
      model: 'gpt-4o-mini',
    });

    await expect(openAIProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('No text content returned by OpenAI API');

    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        candidates: [{ content: { parts: [{ text: '' }] } }],
      }),
    );

    const geminiProvider = createProvider({
      provider: 'gemini',
      apiKey: 'key',
      model: 'gemini-1.5-pro',
    });

    await expect(geminiProvider.makeRequest({ prompt: 'x' })).rejects.toThrow('No text content returned by Gemini API');
  });

  it('maps Gemini context user role to user message role in request body', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    );

    const provider = createProvider({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-1.5-pro',
    });

    await provider.makeRequest({
      prompt: 'new prompt',
      context: [{ role: 'user', content: 'existing user msg' }],
    });

    const [, requestInit] = mockedFetchWithRetry.mock.calls[0];
    const geminiBody = JSON.parse(String((requestInit as RequestInit).body));

    expect(geminiBody.contents[0]).toEqual({
      role: 'user',
      parts: [{ text: 'existing user msg' }],
    });
  });

  it('uses zero defaults for missing Anthropic usage values', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      createResponse({
        content: [{ type: 'text', text: 'No usage provided' }],
      }),
    );

    const provider = createProvider({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      model: 'claude-sonnet-4-20250514',
    });

    const result = await provider.makeRequest({ prompt: 'hello' });

    expect(result.usage).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: 0,
    });
  });
});

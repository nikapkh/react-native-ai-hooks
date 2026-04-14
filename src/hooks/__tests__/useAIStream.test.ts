import React from 'react';
import { act, create } from 'react-test-renderer';
import { useAIStream } from '../useAIStream';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

jest.mock('../../utils/fetchWithRetry', () => ({
  fetchWithRetry: jest.fn(),
}));

type HookRenderResult<T> = {
  result: {
    readonly current: T;
  };
  unmount: () => void;
};

function renderHook<T>(hook: () => T): HookRenderResult<T> {
  let hookValue: T | undefined;
  let renderer: ReturnType<typeof create> | undefined;

  function TestComponent() {
    hookValue = hook();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return {
    result: {
      get current(): T {
        if (hookValue === undefined) {
          throw new Error('Hook value is not available yet');
        }
        return hookValue;
      },
    },
    unmount: () => {
      if (!renderer) {
        return;
      }
      act(() => {
        renderer.unmount();
      });
    },
  };
}

function createControlledStreamResponse(): {
  response: Response;
  pushLine: (line: string) => Promise<void>;
  close: () => Promise<void>;
} {
  const encoder = new TextEncoder();
  const pendingReads: Array<(result: ReadableStreamReadResult<Uint8Array>) => void> = [];

  const reader = {
    read: jest.fn(
      () =>
        new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => {
          pendingReads.push(resolve);
        }),
    ),
  };

  const response = {
    ok: true,
    status: 200,
    body: {
      getReader: () => reader,
    },
    text: async () => '',
  } as unknown as Response;

  const resolveNextRead = async (result: ReadableStreamReadResult<Uint8Array>) => {
    const resolver = pendingReads.shift();
    if (!resolver) {
      throw new Error('No pending read to resolve');
    }
    resolver(result);
    await Promise.resolve();
  };

  return {
    response,
    pushLine: async (line: string) => {
      await resolveNextRead({ done: false, value: encoder.encode(line) });
    },
    close: async () => {
      await resolveNextRead({ done: true, value: undefined });
    },
  };
}

describe('useAIStream', () => {
  const mockedFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

  beforeEach(() => {
    mockedFetchWithRetry.mockReset();
  });

  it('streams OpenAI chunks token-by-token into response state', async () => {
    const stream = createControlledStreamResponse();
    mockedFetchWithRetry.mockResolvedValueOnce(stream.response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
      }),
    );

    let streamPromise: Promise<void> | undefined;

    await act(async () => {
      streamPromise = result.current.streamResponse('Say hello');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.response).toBe('');

    await act(async () => {
      await stream.pushLine('data: {"choices":[{"delta":{"content":"Hel"}}]}\n');
    });
    expect(result.current.response).toBe('Hel');

    await act(async () => {
      await stream.pushLine('data: {"choices":[{"delta":{"content":"lo"}}]}\n');
    });
    expect(result.current.response).toBe('Hello');

    await act(async () => {
      await stream.pushLine('data: [DONE]\n');
    });

    await act(async () => {
      await stream.close();
      await streamPromise;
    });

    expect(result.current.response).toBe('Hello');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    expect(mockedFetchWithRetry).toHaveBeenCalledTimes(1);

    const [url, requestInit] = mockedFetchWithRetry.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');

    const parsedBody = JSON.parse(String((requestInit as RequestInit).body));
    expect(parsedBody).toMatchObject({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: 'Say hello' }],
    });

    unmount();
  });

  it('streams Anthropic chunks token-by-token into response state', async () => {
    const stream = createControlledStreamResponse();
    mockedFetchWithRetry.mockResolvedValueOnce(stream.response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'anthropic',
        apiKey: 'anthropic-key',
        model: 'claude-sonnet-4-20250514',
      }),
    );

    let streamPromise: Promise<void> | undefined;

    await act(async () => {
      streamPromise = result.current.streamResponse('Describe this');
    });

    await act(async () => {
      await stream.pushLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n');
    });
    expect(result.current.response).toBe('Hi');

    await act(async () => {
      await stream.pushLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n');
    });
    expect(result.current.response).toBe('Hi there');

    await act(async () => {
      await stream.close();
      await streamPromise;
    });

    const [url, requestInit] = mockedFetchWithRetry.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((requestInit as RequestInit).headers).toEqual(
      expect.objectContaining({
        'x-api-key': 'anthropic-key',
        'anthropic-version': '2023-06-01',
      }),
    );

    unmount();
  });

  it('surfaces API error text when the streaming endpoint responds with non-2xx status', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server exploded',
    } as unknown as Response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });

    expect(result.current.error).toBe('Server exploded');
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it('falls back to status-based API error when error text is empty', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => '',
    } as unknown as Response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });

    expect(result.current.error).toBe('API error: 429');

    unmount();
  });

  it('sets a descriptive error when Response.body is missing', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: null,
      text: async () => '',
    } as unknown as Response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });

    expect(result.current.error).toBe('Streaming not supported in this environment');
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it('does not set error state for AbortError rejections', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockedFetchWithRetry.mockRejectedValueOnce(abortError);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it('uses fallback message when stream request throws a non-Error value', async () => {
    mockedFetchWithRetry.mockRejectedValueOnce('network down');

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });

    expect(result.current.error).toBe('Failed to stream response');

    unmount();
  });

  it('ignores empty and non-data lines while processing stream chunks', async () => {
    const stream = createControlledStreamResponse();
    mockedFetchWithRetry.mockResolvedValueOnce(stream.response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'openai',
        apiKey: 'openai-key',
      }),
    );

    let streamPromise: Promise<void> | undefined;
    await act(async () => {
      streamPromise = result.current.streamResponse('hello');
    });

    await act(async () => {
      await stream.pushLine('\n');
    });
    await act(async () => {
      await stream.pushLine('event: ping\n');
    });
    await act(async () => {
      await stream.pushLine('data: {"choices":[{"delta":{"content":"ok"}}]}\n');
    });

    expect(result.current.response).toBe('ok');

    await act(async () => {
      await stream.close();
      await streamPromise;
    });

    unmount();
  });

  it('defaults to anthropic provider and default model when omitted', async () => {
    const stream = createControlledStreamResponse();
    mockedFetchWithRetry.mockResolvedValueOnce(stream.response);

    const { result, unmount } = renderHook(() =>
      useAIStream({
        apiKey: 'anthropic-key',
      }),
    );

    let streamPromise: Promise<void> | undefined;
    await act(async () => {
      streamPromise = result.current.streamResponse('hello');
    });

    await act(async () => {
      await stream.pushLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"default"}}\n');
      await stream.close();
      await streamPromise;
    });

    const [url, requestInit] = mockedFetchWithRetry.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');

    const parsedBody = JSON.parse(String((requestInit as RequestInit).body));
    expect(parsedBody.model).toBe('claude-sonnet-4-20250514');
    expect(result.current.response).toBe('default');

    unmount();
  });

  it('clears response and error when clearResponse is called', async () => {
    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'gemini',
        apiKey: 'gemini-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('hello');
    });
    expect(result.current.error).toBe('Streaming not supported for provider: gemini');

    act(() => {
      result.current.clearResponse();
    });

    expect(result.current.response).toBe('');
    expect(result.current.error).toBeNull();

    unmount();
  });

  it('sets an error when streaming is requested for an unsupported provider', async () => {
    const { result, unmount } = renderHook(() =>
      useAIStream({
        provider: 'gemini',
        apiKey: 'gemini-key',
      }),
    );

    await act(async () => {
      await result.current.streamResponse('Hello');
    });

    expect(result.current.error).toBe('Streaming not supported for provider: gemini');
    expect(result.current.isLoading).toBe(false);
    expect(mockedFetchWithRetry).not.toHaveBeenCalled();

    unmount();
  });
});

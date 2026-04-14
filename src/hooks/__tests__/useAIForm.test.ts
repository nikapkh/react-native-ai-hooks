import React from 'react';
import { act, create } from 'react-test-renderer';
import { useAIForm } from '../useAIForm';
import { createProvider } from '../../utils/providerFactory';

jest.mock('../../utils/providerFactory', () => ({
  createProvider: jest.fn(),
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

describe('useAIForm', () => {
  const mockedCreateProvider = createProvider as jest.MockedFunction<typeof createProvider>;

  beforeEach(() => {
    mockedCreateProvider.mockReset();
  });

  it('populates validation errors from AI JSON response', async () => {
    const makeRequest = jest.fn().mockResolvedValue({
      text: '{"errors":{"email":"Invalid email","password":"Must be at least 8 characters"}}',
      raw: {},
    });

    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'openai',
        apiKey: 'test-key',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;

    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: { email: 'not-an-email', password: '123' },
        validationSchema: { email: 'email', password: 'minLength:8' },
      });
    });

    expect(validationResult).toEqual({
      isValid: false,
      errors: {
        email: 'Invalid email',
        password: 'Must be at least 8 characters',
      },
      raw: {
        errors: {
          email: 'Invalid email',
          password: 'Must be at least 8 characters',
        },
      },
    });

    expect(result.current.validationResult).toEqual(validationResult);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    expect(makeRequest).toHaveBeenCalledTimes(1);
    const providerRequest = makeRequest.mock.calls[0][0] as { prompt: string; options: Record<string, unknown> };
    expect(providerRequest.prompt).toContain('Validation schema: {"email":"email","password":"minLength:8"}');
    expect(providerRequest.prompt).toContain('"email":"not-an-email"');
    expect(providerRequest.options).toEqual(
      expect.objectContaining({
        temperature: 0.2,
        maxTokens: 800,
      }),
    );

    unmount();
  });

  it('supports fenced JSON responses and parses errors correctly', async () => {
    const makeRequest = jest.fn().mockResolvedValue({
      text: '```json\n{"errors":{"name":"Name is required"}}\n```',
      raw: {},
    });

    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'anthropic',
        apiKey: 'anthropic-key',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;

    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: { name: '' },
      });
    });

    expect(validationResult).toEqual({
      isValid: false,
      errors: {
        name: 'Name is required',
      },
      raw: {
        errors: {
          name: 'Name is required',
        },
      },
    });
    expect(result.current.validationResult).toEqual(validationResult);
    expect(result.current.error).toBeNull();

    unmount();
  });

  it('returns null and sets error when form data is empty', async () => {
    const makeRequest = jest.fn();
    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'openai',
        apiKey: 'test-key',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;
    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: {},
      });
    });

    expect(validationResult).toBeNull();
    expect(result.current.error).toBe('Form data is empty');
    expect(makeRequest).not.toHaveBeenCalled();

    unmount();
  });

  it('returns null and sets error when API key is missing', async () => {
    const makeRequest = jest.fn();
    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'openai',
        apiKey: '',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;
    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: { email: 'x@example.com' },
      });
    });

    expect(validationResult).toBeNull();
    expect(result.current.error).toBe('Missing API key');
    expect(makeRequest).not.toHaveBeenCalled();

    unmount();
  });

  it('captures provider/parsing failures in error state', async () => {
    const makeRequest = jest.fn().mockRejectedValue(new Error('Provider failed'));
    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'openai',
        apiKey: 'test-key',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;
    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: { email: 'bad' },
      });
    });

    expect(validationResult).toBeNull();
    expect(result.current.error).toBe('Provider failed');
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it('clears prior validation result and error when clearValidation is called', async () => {
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({
        text: '{"errors":{"email":"Invalid email"}}',
        raw: {},
      })
      .mockRejectedValueOnce(new Error('Second call failed'));

    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        provider: 'openai',
        apiKey: 'test-key',
      }),
    );

    await act(async () => {
      await result.current.validateForm({
        formData: { email: 'bad' },
      });
    });

    expect(result.current.validationResult).not.toBeNull();

    await act(async () => {
      await result.current.validateForm({
        formData: { email: 'bad-again' },
      });
    });

    expect(result.current.error).toBe('Second call failed');

    act(() => {
      result.current.clearValidation();
    });

    expect(result.current.validationResult).toBeNull();
    expect(result.current.error).toBeNull();

    unmount();
  });

  it('builds provider config with defaults when provider/model are omitted', () => {
    const makeRequest = jest.fn();
    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { unmount } = renderHook(() =>
      useAIForm({
        apiKey: 'default-key',
      }),
    );

    expect(mockedCreateProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'default-key',
      }),
    );

    unmount();
  });

  it('treats missing errors object in AI response as a valid form result', async () => {
    const makeRequest = jest.fn().mockResolvedValue({
      text: '{}',
      raw: {},
    });

    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        apiKey: 'test-key',
      }),
    );

    let validationResult: Awaited<ReturnType<typeof result.current.validateForm>> | undefined;
    await act(async () => {
      validationResult = await result.current.validateForm({
        formData: { name: 'Jane' },
      });
    });

    expect(validationResult).toEqual({
      isValid: true,
      errors: {},
      raw: {},
    });
    expect(result.current.error).toBeNull();

    unmount();
  });

  it('uses fallback error message when provider throws a non-Error value', async () => {
    const makeRequest = jest.fn().mockRejectedValue('bad response');
    mockedCreateProvider.mockReturnValue({ makeRequest } as unknown as ReturnType<typeof createProvider>);

    const { result, unmount } = renderHook(() =>
      useAIForm({
        apiKey: 'test-key',
      }),
    );

    await act(async () => {
      await result.current.validateForm({
        formData: { email: 'x@example.com' },
      });
    });

    expect(result.current.error).toBe('Failed to validate form');
    expect(result.current.isLoading).toBe(false);

    unmount();
  });
});

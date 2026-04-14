import { fetchWithRetry } from '../fetchWithRetry';

describe('fetchWithRetry', () => {
  let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;

  const createResponse = (status: number, body: unknown, retryAfter?: string): Response => {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'retry-after') {
            return retryAfter ?? null;
          }
          return null;
        },
      },
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  };

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retries 429 responses with exponential backoff delays', async () => {
    const allDelays: number[] = [];
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number) => {
      allDelays.push(Number(delay));
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    fetchSpy
      .mockResolvedValueOnce(createResponse(429, { error: 'rate_limited' }, '1'))
      .mockResolvedValueOnce(createResponse(429, { error: 'rate_limited' }))
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    const response = await fetchWithRetry(
      'https://api.example.com/test',
      { method: 'POST' },
      { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 2, timeout: 1000 },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // allDelays contains: [abort_timeout, retry_delay, abort_timeout, retry_delay, abort_timeout]
    // Extract only the odd-indexed elements (1, 3) which are the retry delays
    const retryDelays = [allDelays[1], allDelays[3]];
    expect(retryDelays).toEqual([1000, 2000]);

    randomSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('uses default retry options when none are provided', async () => {
    fetchSpy.mockResolvedValueOnce(createResponse(200, { ok: true }));

    const response = await fetchWithRetry('https://api.example.com/default-options');

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx responses with jittered backoff and then succeeds', async () => {
    const allDelays: number[] = [];
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number) => {
      allDelays.push(Number(delay));
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    fetchSpy
      .mockResolvedValueOnce(createResponse(500, { error: 'server_error' }))
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    const response = await fetchWithRetry(
      'https://api.example.com/test',
      { method: 'POST' },
      { maxRetries: 1, baseDelay: 1000, timeout: 30000 },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // [attempt1 timeout, retry delay, attempt2 timeout]
    expect(allDelays[1]).toBe(1000);

    randomSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('retries AbortError failures and then succeeds', async () => {
    const allDelays: number[] = [];
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number) => {
      allDelays.push(Number(delay));
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const abortError = Object.assign(new Error('timeout'), { name: 'AbortError' });

    fetchSpy
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    const response = await fetchWithRetry(
      'https://api.example.com/test',
      { method: 'GET' },
      { maxRetries: 1, baseDelay: 500, timeout: 1234 },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // [attempt1 timeout, retry delay, attempt2 timeout]
    expect(allDelays[1]).toBe(500);

    randomSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('throws immediately when an error is explicitly marked non-retryable', async () => {
    const nonRetryableError = Object.assign(new Error('do not retry'), { isRetryable: false });

    fetchSpy.mockRejectedValueOnce(nonRetryableError);

    await expect(
      fetchWithRetry('https://api.example.com/test', { method: 'GET' }, { maxRetries: 3 }),
    ).rejects.toThrow('do not retry');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries unknown errors until max retries are exhausted', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const retryError = new Error('network down');

    fetchSpy.mockRejectedValue(retryError);

    await expect(
      fetchWithRetry('https://api.example.com/test', { method: 'GET' }, { maxRetries: 1, baseDelay: 1, timeout: 1 }),
    ).rejects.toThrow('network down');

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    randomSpy.mockRestore();
  });

  it('throws a fallback error when retries are disabled before entering the loop', async () => {
    await expect(
      fetchWithRetry('https://api.example.com/test', { method: 'GET' }, { maxRetries: -1 }),
    ).rejects.toThrow('Fetch failed after retries');
  });
});

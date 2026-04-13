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

    setTimeoutSpy.mockRestore();
  });
});

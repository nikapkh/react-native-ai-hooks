/**
 * Fetch with exponential backoff, timeout, and rate-limit handling
 */

interface FetchWithRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  backoffMultiplier?: number;
}

interface RetryableError extends Error {
  statusCode?: number;
  isRetryable?: boolean;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 30000,
    backoffMultiplier = 2,
  } = options || {};

  let lastError: RetryableError | undefined;

  const getBackoffDelay = (attempt: number) =>
    Math.min(baseDelay * Math.pow(backoffMultiplier, attempt) * (1 + Math.random() * 0.3), maxDelay);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getBackoffDelay(attempt);

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Handle server errors (5xx) with retry
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = getBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const error = err as RetryableError;

      // Handle timeout
      if (error.name === 'AbortError') {
        error.isRetryable = attempt < maxRetries;

        if (attempt < maxRetries) {
          const delay = getBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      lastError = error;

      if (error.isRetryable === false) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

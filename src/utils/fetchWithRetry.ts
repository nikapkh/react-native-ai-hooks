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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Handle server errors (5xx) with retry
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
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
          const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      lastError = error;

      // Non-retryable errors should throw immediately
      if (!error.isRetryable && attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

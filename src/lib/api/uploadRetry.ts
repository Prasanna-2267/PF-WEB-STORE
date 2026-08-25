type RetryableApiFailure = {
  status?: number;
  code?: string;
};

const retryable = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const failure = error as RetryableApiFailure;
  return failure.status === 0
    || failure.status === 429
    || (typeof failure.status === 'number' && failure.status >= 500)
    || failure.code === 'NETWORK_ERROR'
    || failure.code === 'REQUEST_ABORTED';
};

/**
 * Binary PUT and finalize are idempotent for one server-issued upload ID.
 * Retrying only those steps avoids duplicate upload sessions while recovering
 * from a lost response, rate limit, or temporary storage outage.
 */
export async function retryUploadStep<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !retryable(error)) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryUploadStep } from './uploadRetry';

describe('retryUploadStep', () => {
  afterEach(() => vi.useRealTimers());

  it('retries transient server failures and returns the confirmed response', async () => {
    vi.useFakeTimers();
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 503, code: 'STORAGE_PROVIDER_UNAVAILABLE' })
      .mockResolvedValueOnce({ id: 'content-1' });
    const resultPromise = retryUploadStep(operation);
    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toEqual({ id: 'content-1' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry validation, conflict, or authorization failures', async () => {
    const failure = { status: 409, code: 'CONTENT_NAME_CONFLICT' };
    const operation = vi.fn().mockRejectedValue(failure);
    await expect(retryUploadStep(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

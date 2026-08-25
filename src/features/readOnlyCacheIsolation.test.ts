import { beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/useAuthStore';
import { academyReadOnlyKeys } from '@/features/academy/readOnly/academyReadOnlyApi';
import { adminReadOnlyKeys } from '@/features/admin/readOnly/adminReadOnlyApi';

describe('Phase 5C read-only cache isolation', () => {
  beforeEach(() => queryClient.clear());

  it('never resolves Academy A data from the Academy B key', () => {
    queryClient.setQueryData(academyReadOnlyKeys.students('academy-a', { page: 1, limit: 25 }), { items: ['A'] });
    expect(queryClient.getQueryData(academyReadOnlyKeys.students('academy-b', { page: 1, limit: 25 }))).toBeUndefined();
  });

  it('never resolves Admin A data from the Admin B key', () => {
    queryClient.setQueryData(adminReadOnlyKeys.academies('admin-a', { page: 1, limit: 25 }), { items: ['A'] });
    expect(queryClient.getQueryData(adminReadOnlyKeys.academies('admin-b', { page: 1, limit: 25 }))).toBeUndefined();
  });

  it('central logout clears all domain query data', async () => {
    queryClient.setQueryData(academyReadOnlyKeys.courses('academy-a', { page: 1, limit: 25 }), { items: ['course'] });
    queryClient.setQueryData(adminReadOnlyKeys.students('admin-a', { page: 1, limit: 25 }), { items: ['student'] });
    await useAuthStore.getState().logout();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('retries only network, rate-limit, and server failures once', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe('function');
    const shouldRetry = retry as (failureCount: number, error: Error) => boolean;
    expect(shouldRetry(0, new ApiError('offline', 0))).toBe(true);
    expect(shouldRetry(0, new ApiError('limited', 429))).toBe(true);
    expect(shouldRetry(0, new ApiError('unavailable', 503))).toBe(true);
    expect(shouldRetry(0, new ApiError('denied', 403))).toBe(false);
    expect(shouldRetry(1, new ApiError('unavailable', 503))).toBe(false);
  });
});

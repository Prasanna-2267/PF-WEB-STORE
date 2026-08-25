import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        if (!(error instanceof ApiError)) return true;
        return error.status === 0 || error.status === 429 || error.status >= 500;
      },
    },
    mutations: { retry: false },
  },
});

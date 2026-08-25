import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { AcademyOverview } from '@/lib/api/contracts';

export function useLiveAcademyOverviewQuery(academyId: string | null) {
  const query = useQuery({
    queryKey: ['academy', academyId, 'overview'],
    enabled: Boolean(academyId),
    queryFn: ({ signal }) => apiRequest<AcademyOverview>('/api/academy/overview', { signal }),
  });
  return { ...query, loading: query.isLoading };
}

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toIncidentEvent } from '@/lib/incident';
import type { IncidentListResponse, IncidentEvent } from '@/types/api';

// 알림/이력 소스: GET /api/v1/incidents (사건 단위, JWT 인증).
// raw 프레임(/events) 대신 사건 단위로 받아 중복(낙상 다수 프레임 등)을 제거한다.
export function useAllEvents(limit = 50) {
  return useQuery({
    queryKey: ['events-feed', limit],
    queryFn: async (): Promise<IncidentEvent[]> => {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await apiFetch<IncidentListResponse>(`/api/v1/incidents?${params}`);
      return (data.items ?? []).map(toIncidentEvent);
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}
